# Xion Launcher release: builds Xion Client for every version, builds the launcher,
# publishes the GitHub release (which every installed launcher auto-updates from) and deploys the website.
#   Run from D:\XionLauncher:   powershell -ExecutionPolicy Bypass -File .tools\release.ps1
# Needs: GitHub CLI signed in (gh auth login) and Vercel CLI signed in (npx vercel login).
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$ver = (Get-Content package.json -Raw | ConvertFrom-Json).version
$tag = "v$ver"
Write-Host "== Releasing Xion Launcher $ver ==" -ForegroundColor Cyan

# 1. Xion Client jars (JDK 25 bundled in .tools\jdk)
$env:JAVA_HOME = (Resolve-Path ".tools\jdk\jdk-25.0.4.1+1").Path
Write-Host "-- Building Xion Client for every Minecraft version (this takes a while)"
node xion-client-mod\tools\build.js
if ($LASTEXITCODE -ne 0) {
  # A failed version keeps its previous jar in src\assets\mods, so the release still works for it.
  Write-Host "Some Xion Client versions failed to build (see above); their previous jars are kept." -ForegroundColor Yellow
}

# 2. Move the previous build out of dist\ (same layout as dist\old-<version>)
Get-ChildItem dist -File | Where-Object { $_.Name -match '(\d+\.\d+\.\d+)' -and $Matches[1] -ne $ver -and $_.Name -notmatch '^latest' } | ForEach-Object {
  $old = "dist\old-" + ($_.Name | Select-String -Pattern '\d+\.\d+\.\d+').Matches[0].Value
  New-Item -ItemType Directory -Force $old | Out-Null
  Move-Item $_.FullName $old -Force
}

# 3. Launcher: Windows installer + portable, then Linux (AppImage/.deb/.tar.gz) if this machine can build it
Write-Host "-- Building the launcher"
npx electron-builder --win --publish never
if ($LASTEXITCODE -ne 0) { throw "Windows build failed" }
npx electron-builder --linux --publish never
if ($LASTEXITCODE -ne 0) { Write-Host "Linux build skipped/failed on this machine - Windows release continues." -ForegroundColor Yellow }

# 4. GitHub release (installed launchers check releases/latest every 3 hours and on start)
$assets = @(
  "dist\Xion-Launcher-Setup-$ver.exe", "dist\Xion-Launcher-Setup-$ver.exe.blockmap", "dist\latest.yml",
  "dist\XionLauncher-Portable-$ver.exe",
  "dist\Xion-Launcher-$ver-linux-x86_64.AppImage", "dist\Xion-Launcher-$ver-linux-amd64.deb",
  "dist\Xion-Launcher-$ver-linux-x64.tar.gz", "dist\latest-linux.yml"
) | Where-Object { Test-Path $_ }
# latest-linux.yml must belong to this version, or Linux installs would be pointed at an old build
if ((Test-Path "dist\latest-linux.yml") -and -not (Select-String -Path "dist\latest-linux.yml" -Pattern "version: $ver" -Quiet)) {
  $assets = $assets | Where-Object { $_ -ne "dist\latest-linux.yml" }
}
Write-Host "-- Publishing $tag to GitHub with:" ; $assets | ForEach-Object { Write-Host "   $_" }
gh release create $tag @assets --repo anisbabu/xion-launcher --title $tag --notes-file ".tools\notes-$ver.md" --latest
if ($LASTEXITCODE -ne 0) { throw "GitHub release failed (is gh signed in? does $tag already exist?)" }

# 5. Website (download links already point at $tag)
Write-Host "-- Deploying the website"
Push-Location website
git add -A; git commit -m "Release $tag" ; git push
npx vercel --prod --yes
Pop-Location

Write-Host "== $tag is live. Installed launchers update on their next check (start, or within 3 hours). ==" -ForegroundColor Green
