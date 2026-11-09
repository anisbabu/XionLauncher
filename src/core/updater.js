// Launcher updates from the GitHub releases of anisbabu/xion-launcher, on every kind of install:
//   Windows installer (NSIS), Linux AppImage and .deb  → electron-updater downloads in the background and installs
//                                                        when the launcher closes (the .deb asks for the password once).
//   Windows portable .exe and Linux .tar.gz            → we download the new build ourselves and swap it in right
//                                                        after the launcher closes, so the next start is the new version.
// The "Restart to update" button does the same, then opens the launcher again.
const { app } = require('electron')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawn } = require('child_process')
const { Readable } = require('stream')
const { getJSON, UA } = require('./download')

const REPO = 'anisbabu/xion-launcher'
const SITE = 'https://xion-launcher.vercel.app/#download'
const EVERY = 3 * 60 * 60 * 1000

let state = { state: 'idle', version: app.getVersion() }
let notify = () => {}
let pending = null // self-managed update waiting to be swapped in: { file, kind }
let swapped = false

const portableExe = () => process.env.PORTABLE_EXECUTABLE_FILE || ''
const isTarball = () => process.platform === 'linux' && !process.env.APPIMAGE && !fs.existsSync(path.join(process.resourcesPath, 'package-type'))
const selfManaged = () => !!portableExe() || isTarball()

function set (next) {
  state = { ...state, ...next }
  notify(state)
}

const newer = (a, b) => {
  const pa = String(a).replace(/^v/, '').split('.').map(Number)
  const pb = String(b).replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0)
  return false
}

function writable (dir) {
  try { fs.accessSync(dir, fs.constants.W_OK); return true } catch { return false }
}

// Streams a release asset to disk with progress, checking the size GitHub reports.
async function download (asset, dest) {
  // One plain request (not the hedged two-way fetch the launcher uses for small calls): this file is big.
  const get = globalThis.fetch.chromium || globalThis.fetch
  const res = await get(asset.browser_download_url, { headers: { 'User-Agent': UA }, redirect: 'follow' })
  if (!res.ok || !res.body) throw new Error('HTTP ' + res.status)
  const total = asset.size || Number(res.headers.get('content-length')) || 0
  const tmp = dest + '.part'
  const out = fs.createWriteStream(tmp)
  let got = 0, shown = -1
  try {
    const body = res.body[Symbol.asyncIterator] ? res.body : Readable.fromWeb(res.body)
    for await (const chunk of body) {
      got += chunk.length
      if (!out.write(chunk)) await new Promise(r => out.once('drain', r))
      const pct = total ? Math.floor(got / total * 100) : 0
      if (pct !== shown) { shown = pct; set({ state: 'downloading', percent: pct }) }
    }
  } finally { await new Promise(r => out.end(r)) }
  if (total && got !== total) { fs.rmSync(tmp, { force: true }); throw new Error('Download was cut off') }
  fs.renameSync(tmp, dest)
}

async function checkSelf () {
  if (state.state === 'downloading' || state.state === 'ready') return
  const r = await getJSON(`https://api.github.com/repos/${REPO}/releases/latest`)
  if (!r || !r.tag_name || !newer(r.tag_name, app.getVersion())) return
  const latest = r.tag_name.replace(/^v/, '')
  const kind = portableExe() ? 'portable' : 'tarball'
  const want = kind === 'portable' ? /^XionLauncher-Portable-.*\.exe$/i : /linux-x64\.tar\.gz$/i
  const asset = (r.assets || []).find(a => want.test(a.name))
  const target = kind === 'portable' ? path.dirname(portableExe()) : path.dirname(process.execPath)
  // Without the asset or write access to the install folder, just point to the download page.
  if (!asset || !writable(target)) return set({ state: 'portable', latest, url: SITE })
  const dir = path.join(app.getPath('userData'), 'updates')
  fs.mkdirSync(dir, { recursive: true })
  for (const f of fs.readdirSync(dir)) if (!f.includes(latest)) fs.rmSync(path.join(dir, f), { force: true, recursive: true })
  const file = path.join(dir, asset.name)
  set({ state: 'downloading', latest, percent: 0 })
  try {
    if (!fs.existsSync(file) || fs.statSync(file).size !== asset.size) await download(asset, file)
    pending = { file, kind }
    set({ state: 'ready', latest })
  } catch (e) {
    console.error('[updater]', e && e.message)
    set({ state: 'idle' })
  }
}

// Writes a small script that waits for this launcher to exit, swaps in the new build and (optionally) starts it.
function swap (relaunch) {
  if (!pending || swapped) return false
  swapped = true
  const pid = process.pid
  if (pending.kind === 'portable') {
    const exe = portableExe()
    const script = path.join(os.tmpdir(), `xion-update-${pid}.cmd`)
    fs.writeFileSync(script, [
      '@echo off',
      'setlocal',
      'for /l %%i in (1,1,60) do (',
      `  copy /y "${pending.file}" "${exe}" >nul 2>&1 && goto done`,
      '  ping -n 2 127.0.0.1 >nul',
      ')',
      'goto end',
      ':done',
      `del "${pending.file}" >nul 2>&1`,
      relaunch ? `start "" "${exe}"` : '',
      ':end',
      '(goto) 2>nul & del "%~f0"'
    ].join('\r\n'))
    spawn('cmd.exe', ['/c', script], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } else {
    const dir = path.dirname(process.execPath)
    const script = path.join(os.tmpdir(), `xion-update-${pid}.sh`)
    const q = s => `'${String(s).replace(/'/g, "'\\''")}'`
    fs.writeFileSync(script, [
      '#!/bin/sh',
      `while kill -0 ${pid} 2>/dev/null; do sleep 1; done`,
      `STAGE=$(mktemp -d) || exit 1`,
      `tar -xzf ${q(pending.file)} -C "$STAGE" || exit 1`,
      // The tarball holds one top folder; copy its contents over the install.
      'SRC="$STAGE"; [ "$(ls -1 "$STAGE" | wc -l)" = "1" ] && [ -d "$STAGE/$(ls -1 "$STAGE")" ] && SRC="$STAGE/$(ls -1 "$STAGE")"',
      `cp -a "$SRC"/. ${q(dir)}/ && rm -f ${q(pending.file)}`,
      'rm -rf "$STAGE"',
      relaunch ? `nohup ${q(process.execPath)} >/dev/null 2>&1 &` : '',
      'rm -f "$0"'
    ].join('\n'), { mode: 0o755 })
    spawn('/bin/sh', [script], { detached: true, stdio: 'ignore' }).unref()
  }
  return true
}

function start (send) {
  notify = s => send('update:state', s)
  if (!app.isPackaged) return
  if (selfManaged()) {
    const run = () => checkSelf().catch(() => {})
    setTimeout(run, 8000)
    setInterval(run, EVERY)
    // Closing the launcher normally installs the update for the next start.
    app.on('will-quit', () => swap(false))
    return
  }
  const { autoUpdater } = require('electron-updater')
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.on('update-available', i => set({ state: 'downloading', latest: i.version, percent: 0 }))
  autoUpdater.on('download-progress', p => set({ state: 'downloading', percent: Math.round(p.percent) }))
  autoUpdater.on('update-downloaded', i => set({ state: 'ready', latest: i.version }))
  autoUpdater.on('error', e => { if (state.state === 'downloading') set({ state: 'idle' }); console.error('[updater]', e && e.message) })
  const run = () => { if (state.state !== 'ready') autoUpdater.checkForUpdates().catch(() => {}) }
  setTimeout(run, 8000)
  setInterval(run, EVERY)
}

/** Restarts into the downloaded update (installs silently, launcher reopens). */
function install () {
  if (state.state !== 'ready') return false
  if (selfManaged()) {
    if (!swap(true)) return false
    setImmediate(() => app.quit())
    return true
  }
  setImmediate(() => require('electron-updater').autoUpdater.quitAndInstall(true, true))
  return true
}

module.exports = { start, install, get: () => state }
