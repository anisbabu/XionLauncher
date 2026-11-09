const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')
const store = require('./store')
const versions = require('./versions')
const java = require('./java')
const { getJSON, downloadFile } = require('./download')

const FILL = 'https://fill.papermc.io/v3/projects/paper'
const procs = {}

async function paperVersions () {
  const p = await getJSON(FILL)
  return Object.values(p.versions).flat().filter(v => !/pre|rc/i.test(v))
}

function dirOf (srv) {
  return path.join(store.get().settings.gameRoot || store.ROOT, 'servers', srv.id)
}

function list () {
  return store.get().servers.map(s => ({ ...s, running: !!procs[s.id], dir: dirOf(s) }))
}

function create ({ name, version, memory, port, onlineMode }) {
  const d = store.get()
  const srv = {
    id: store.uid(),
    name: String(name || 'My Server').slice(0, 32),
    version,
    memory: Number(memory) || 2048,
    port: Number(port) || 25565,
    onlineMode: !!onlineMode,
    created: Date.now()
  }
  d.servers.push(srv)
  store.save()
  return srv
}

function remove (id) {
  if (procs[id]) throw new Error('Stop the server first.')
  const d = store.get()
  d.servers = d.servers.filter(s => s.id !== id)
  store.save()
}

function writeProps (dir, srv) {
  const file = path.join(dir, 'server.properties')
  let props = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : ''
  const set = (k, v) => {
    const re = new RegExp(`^${k.replace('.', '\\.')}=.*$`, 'm')
    props = re.test(props) ? props.replace(re, `${k}=${v}`) : props + `${k}=${v}\n`
  }
  set('server-port', srv.port)
  set('online-mode', srv.onlineMode)
  set('motd', `${srv.name} \\u00a77- powered by \\u00a7dXion`)
  fs.writeFileSync(file, props)
}

async function start (id, emit) {
  const d = store.get()
  const srv = d.servers.find(s => s.id === id)
  if (!srv) throw new Error('Server not found.')
  if (procs[id]) return
  const root = d.settings.gameRoot || store.ROOT
  const dir = dirOf(srv)
  fs.mkdirSync(dir, { recursive: true })
  const log = l => emit('server:log', { id, line: l })

  log(`[Xion] Fetching latest Paper build for ${srv.version}…`)
  const build = await getJSON(`${FILL}/versions/${encodeURIComponent(srv.version)}/builds/latest`)
  const dl = build.downloads['server:default']
  const jar = path.join(dir, 'paper.jar')
  const stamp = path.join(dir, '.paper-build')
  const current = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8') : ''
  if (current !== dl.name || !fs.existsSync(jar)) {
    log(`[Xion] Downloading ${dl.name} (${(dl.size / 1048576).toFixed(1)} MB)…`)
    if (fs.existsSync(jar)) fs.unlinkSync(jar)
    await downloadFile(dl.url, jar)
    fs.writeFileSync(stamp, dl.name)
  }

  let javaPath = d.settings.javaPath
  if (!javaPath || !fs.existsSync(javaPath)) {
    const mcv = srv.version.split('-')[0]
    let component = 'java-runtime-delta'
    try { component = ((await versions.versionJSON(mcv)).javaVersion || {}).component || 'jre-legacy' } catch {}
    log(`[Xion] Preparing Java (${component})…`)
    javaPath = await java.ensureRuntime(root, component)
    javaPath = javaPath.replace(/javaw\.exe$/, 'java.exe')
  }

  fs.writeFileSync(path.join(dir, 'eula.txt'), '# Accepted in Xion Launcher (https://aka.ms/MinecraftEULA)\neula=true\n')
  writeProps(dir, srv)

  log('[Xion] Starting server…')
  const proc = spawn(javaPath, [`-Xms${Math.min(1024, srv.memory)}M`, `-Xmx${srv.memory}M`, '-jar', 'paper.jar', '--nogui'], { cwd: dir, windowsHide: true })
  procs[id] = proc
  const pipe = buf => String(buf).split(/\r?\n/).filter(Boolean).forEach(log)
  proc.stdout.on('data', pipe)
  proc.stderr.on('data', pipe)
  proc.on('close', code => {
    delete procs[id]
    log(`[Xion] Server stopped (exit code ${code}).`)
    emit('server:state', { id, running: false })
  })
  proc.on('error', e => log('[Xion] ' + e.message))
  emit('server:state', { id, running: true })
}

function command (id, cmd) {
  const p = procs[id]
  if (p) p.stdin.write(cmd + '\n')
}

function stop (id) {
  const p = procs[id]
  if (!p) return
  p.stdin.write('stop\n')
  setTimeout(() => { if (procs[id] === p) p.kill() }, 20000)
}

function stopAll () { Object.keys(procs).forEach(stop) }

module.exports = { paperVersions, list, create, remove, start, stop, command, stopAll, dirOf }
