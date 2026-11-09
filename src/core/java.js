const fs = require('fs')
const path = require('path')
const { getJSON, downloadFile, pool } = require('./download')

const RUNTIMES = 'https://launchermeta.mojang.com/v1/products/java-runtime/2ec0cc96c44e5a76b9c8b7c39df7210883d12871/all.json'

function platformKey () {
  if (process.platform === 'win32') return process.arch === 'arm64' ? 'windows-arm64' : (process.arch === 'ia32' ? 'windows-x86' : 'windows-x64')
  if (process.platform === 'darwin') return process.arch === 'arm64' ? 'mac-os-arm64' : 'mac-os'
  return process.arch === 'ia32' ? 'linux-i386' : 'linux'
}

function javaBin (dir) {
  if (process.platform === 'win32') return path.join(dir, 'bin', 'javaw.exe')
  if (process.platform === 'darwin') return path.join(dir, 'jre.bundle', 'Contents', 'Home', 'bin', 'java')
  return path.join(dir, 'bin', 'java')
}

// Installs Mojang's official Java runtime for the given component (e.g. java-runtime-delta)
// and returns the path to its java executable.
async function ensureRuntime (root, component, onProgress) {
  const dir = path.join(root, 'runtime', component)
  const bin = javaBin(dir)
  const marker = path.join(dir, '.installed')
  if (fs.existsSync(bin) && fs.existsSync(marker)) return bin

  const all = await getJSON(RUNTIMES)
  const entries = (all[platformKey()] || {})[component]
  if (!entries || !entries.length) throw new Error(`No official Java runtime "${component}" for this platform.`)
  const manifest = await getJSON(entries[0].manifest.url)
  const files = Object.entries(manifest.files)

  for (const [p, f] of files) if (f.type === 'directory') fs.mkdirSync(path.join(dir, p), { recursive: true })
  const jobs = files.filter(([, f]) => f.type === 'file').map(([p, f]) => async () => {
    const dest = path.join(dir, p)
    await downloadFile(f.downloads.raw.url, dest, f.downloads.raw.sha1)
    if (f.executable && process.platform !== 'win32') fs.chmodSync(dest, 0o755)
  })
  await pool(jobs, 16, (d, t) => onProgress && onProgress(d, t))
  fs.writeFileSync(marker, entries[0].version.name)
  return bin
}

module.exports = { ensureRuntime }
