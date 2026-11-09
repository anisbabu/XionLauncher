const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage } = require('electron')
const network = require('./src/core/network')
// Trust the Windows certificate store before any request is made (see network.js).
network.trustSystemCertificates()
network.installDnsFallback()
const path = require('path')
const fs = require('fs')
const os = require('os')
const store = require('./src/core/store')
const accounts = require('./src/core/accounts')
const versions = require('./src/core/versions')
const launcher = require('./src/core/launch')
const servers = require('./src/core/servers')
const mods = require('./src/core/mods')
const skins = require('./src/core/skins')
const modrinth = require('./src/core/modrinth')
const themes = require('./src/core/themes')
const license = require('./src/core/license')
const cosmetics = require('./src/core/cosmetics')
const updater = require('./src/core/updater')
const pvp = require('./src/core/pvp')
const { getJSON } = require('./src/core/download')

let win

function send (ch, payload) {
  if (!win || win.isDestroyed()) return
  // Bring the launcher back if it was hidden while the game ran.
  if (ch === 'launch:closed' && !win.isVisible()) win.show()
  win.webContents.send(ch, payload)
}

function createWindow () {
  win = new BrowserWindow({
    width: 1360,
    height: 800,
    minWidth: 1100,
    minHeight: 680,
    frame: false,
    backgroundColor: '#07070d',
    show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })
  win.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'))
  win.once('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.on('maximize', () => send('win:state', { maximized: true }))
  win.on('unmaximize', () => send('win:state', { maximized: false }))
}

// Wraps handlers so errors reach the renderer as { error } instead of rejected IPC.
function handle (ch, fn) {
  ipcMain.handle(ch, async (_e, ...args) => {
    try { return { ok: true, data: await fn(...args) } } catch (e) {
      const msg = typeof e === 'string' ? e : (e && (e.message || e.name)) || String(e)
      return { ok: false, error: msg }
    }
  })
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus() } })

app.whenReady().then(() => {
  network.configureChromiumDns(app)
  network.useChromiumFetch()
  store.load()

  handle('win:min', () => win.minimize())
  handle('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()))
  handle('win:close', () => win.close())

  handle('app:info', () => ({
    version: app.getVersion(),
    totalMem: Math.floor(os.totalmem() / 1048576),
    root: store.ROOT,
    platform: process.platform
  }))
  handle('state:get', () => {
    const d = store.get()
    return { profiles: d.profiles, selectedProfile: d.selectedProfile, settings: d.settings, ...accounts.list() }
  })

  handle('accounts:offline', name => accounts.addOffline(name))
  handle('accounts:microsoft', async () => {
    try { return await accounts.addMicrosoft() } catch (e) {
      const code = typeof e === 'string' ? e : (e && e.name) || ''
      if (/gui\.closed|cancel/i.test(code)) throw new Error('Sign-in was cancelled.')
      if (/account\.gamepass|xbox|profile/i.test(code)) throw new Error('No Minecraft profile found on this Microsoft account.')
      throw e
    }
  })
  handle('accounts:remove', id => accounts.remove(id))
  handle('accounts:select', id => accounts.select(id))

  handle('profiles:save', p => {
    const d = store.get()
    const clean = {
      id: p.id || store.uid(),
      name: String(p.name || 'New Profile').slice(0, 40),
      loader: p.loader === 'quilt' ? 'quilt' : 'fabric',
      version: p.version || 'latest-release',
      loaderVersion: p.loaderVersion || 'latest',
      icon: p.icon || 'grass',
      optimize: p.optimize !== false,
      mods: Array.isArray(p.mods) ? p.mods.filter(s => mods.CATALOG.some(m => m.slug === s)) : mods.defaultSelection(),
      created: p.created || Date.now()
    }
    const i = d.profiles.findIndex(x => x.id === clean.id)
    if (i >= 0) d.profiles[i] = { ...d.profiles[i], ...clean }
    else d.profiles.push(clean)
    store.save()
    return d.profiles
  })
  handle('profiles:delete', id => {
    const d = store.get()
    d.profiles = d.profiles.filter(x => x.id !== id)
    if (d.selectedProfile === id) d.selectedProfile = d.profiles[0] ? d.profiles[0].id : null
    store.save()
    return d.profiles
  })
  handle('profiles:select', id => { store.get().selectedProfile = id; store.save() })
  handle('profiles:folder', id => {
    const dir = path.join(store.get().settings.gameRoot || store.ROOT, 'instances', id)
    fs.mkdirSync(path.join(dir, 'mods'), { recursive: true })
    return shell.openPath(dir)
  })

  const modsDir = id => path.join(store.get().settings.gameRoot || store.ROOT, 'instances', id, 'mods')
  handle('mods:catalog', () => ({ catalog: mods.CATALOG, defaults: mods.defaultSelection(), clientVersions: launcher.supportedClientVersions() }))
  handle('mods:list', id => mods.list(modsDir(id)))
  // Xion PvP mode: its own stored profile (version, mod picks, stats).
  handle('pvp:get', () => {
    const p = pvp.profile(store.get())
    return {
      catalog: pvp.CATALOG, servers: pvp.SERVERS, mods: p.mods, version: p.version,
      versions: launcher.supportedClientVersions(),
      playtime: p.playtime || 0, launches: p.launches || 0, lastPlayed: p.lastPlayed || 0
    }
  })
  handle('pvp:setMods', list => {
    const p = pvp.profile(store.get())
    const known = new Set(pvp.CATALOG.map(m => m.slug))
    p.mods = (Array.isArray(list) ? list : []).filter(x => known.has(x))
    delete p.blocked
    store.save()
    return p.mods
  })
  handle('pvp:setVersion', v => {
    const p = pvp.profile(store.get())
    if (!launcher.supportedClientVersions().includes(v)) throw new Error('Xion Client does not support ' + v)
    p.version = v
    store.save()
    return v
  })
  handle('mods:toggle', (id, file) => { mods.toggle(modsDir(id), path.basename(file)); return mods.list(modsDir(id)) })

  handle('skin:get', () => skins.get())
  handle('skin:pick', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Choose a skin (64×64 PNG)', filters: [{ name: 'Skin', extensions: ['png'] }], properties: ['openFile'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('skin:set', (file, slim) => skins.set(file, slim))
  handle('skin:reset', () => skins.reset())
  handle('skin:model', slim => skins.setModel(slim))

  const gameOf = async id => versions.resolveVersion((store.get().profiles.find(p => p.id === id) || {}).version || 'latest-release')
  handle('modrinth:search', async (q, profileId, offset) => modrinth.search({ query: q, game: profileId ? await gameOf(profileId) : null, offset }))
  handle('modrinth:installed', id => modrinth.installedIds(modsDir(id)))
  handle('modrinth:install', async (id, projectId) => modrinth.install(modsDir(id), projectId, await gameOf(id), l => send('launch:log', l)))
  handle('modrinth:uninstall', (id, projectId) => modrinth.uninstall(modsDir(id), projectId))

  handle('settings:save', s => {
    const d = store.get()
    d.settings = { ...d.settings, ...s }
    store.save()
    return d.settings
  })
  // Themes + Xion Premium
  handle('themes:list', () => {
    const s = store.get().settings
    const premium = license.verify(s.licenseKey).valid
    return { themes: themes.THEMES, current: themes.effective(s.theme, premium).id, premium }
  })
  // Cosmetics: the cape set and the player's pick (Xion+ capes need a valid key).
  handle('cosmetics:list', () => {
    const s = store.get().settings
    const own = cosmetics.custom(s)
    const list = own ? [{ ...own, src: cosmetics.customDataUrl(s) }, ...cosmetics.catalog()] : cosmetics.catalog()
    return { capes: list, selected: s.cape || '', premium: license.verify(s.licenseKey).valid }
  })
  // Xion+ only: the renderer sends the cape already drawn onto a 256x128 canvas.
  handle('cosmetics:upload', dataUrl => {
    const s = store.get().settings
    if (!license.verify(s.licenseKey).valid) throw new Error('PREMIUM')
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''))
    if (!m || m[1].length > 3_000_000) throw new Error('That image could not be used.')
    const png = Buffer.from(m[1], 'base64')
    const size = nativeImage.createFromBuffer(png).getSize()
    if (size.width !== 256 || size.height !== 128) throw new Error('That image could not be used.')
    s.cape = cosmetics.saveCustom(s, png)
    s.capeRev = (s.capeRev || 0) + 1
    store.save()
    return s.cape
  })
  handle('cosmetics:removeCustom', () => {
    const s = store.get().settings
    if (s.cape === s.customCape) { s.cape = ''; s.capeRev = (s.capeRev || 0) + 1 }
    cosmetics.removeCustom(s)
    store.save()
    return s.cape
  })
  handle('cosmetics:set', id => {
    const s = store.get().settings
    const c = id ? cosmetics.byId(id, s) : null
    if (id && !c) throw new Error('Unknown cape')
    if (c && c.tier === 'pro' && !license.verify(s.licenseKey).valid) throw new Error('PREMIUM')
    s.cape = c ? c.id : ''
    s.capeRev = (s.capeRev || 0) + 1
    store.save()
    return s.cape
  })
  handle('themes:set', id => {
    const s = store.get().settings
    const t = themes.byId(id)
    if (t.premium && !license.verify(s.licenseKey).valid) throw new Error('PREMIUM')
    s.theme = t.id
    store.save()
    return t.id
  })
  // Windows Filter Keys (switched on by holding Shift for 8 seconds, easy while sneaking) makes every
  // key register about a second late and repeat. Only read here; the player turns it off themselves.
  handle('system:filterKeys', () => {
    if (process.platform !== 'win32') return false
    try {
      const out = require('child_process').execFileSync('reg', ['query', 'HKCU\\Control Panel\\Accessibility\\Keyboard Response', '/v', 'Flags'], { encoding: 'utf8', windowsHide: true })
      return (parseInt((/Flags\s+REG_SZ\s+(\d+)/.exec(out) || [])[1] || '0', 10) & 1) === 1
    } catch { return false }
  })

  handle('license:status', () => {
    const r = license.verify(store.get().settings.licenseKey)
    return { ...(r.valid ? { premium: true, name: r.name, email: r.email } : { premium: false }), device: license.deviceIdDisplay() }
  })
  handle('license:activate', key => {
    const r = license.verify(key)
    if (!r.valid) throw new Error(r.reason)
    store.get().settings.licenseKey = String(key).trim()
    store.save()
    return { premium: true, name: r.name, email: r.email }
  })
  handle('license:remove', () => {
    const s = store.get().settings
    s.licenseKey = ''
    if (themes.byId(s.theme).premium) s.theme = 'nightfall'
    store.save()
    return { premium: false }
  })

  handle('settings:pickJava', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Select java executable', filters: [{ name: 'Java', extensions: process.platform === 'win32' ? ['exe'] : ['*'] }], properties: ['openFile'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('settings:pickDir', async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Select game directory', properties: ['openDirectory', 'createDirectory'] })
    return r.canceled ? null : r.filePaths[0]
  })
  handle('settings:openRoot', () => shell.openPath(store.get().settings.gameRoot || store.ROOT))

  handle('versions:vanilla', () => versions.vanillaVersions())
  handle('versions:loaderGames', loader => versions.loaderGameVersions(loader))
  handle('versions:loaders', (loader, game) => versions.loaderVersions(loader, game))

  handle('game:launch', async (profileId, opts) => {
    const res = await launcher.launch(profileId, opts, send)
    if (store.get().settings.closeOnLaunch) win.hide()
    return res
  })
  handle('game:kill', () => launcher.kill())

  handle('news:get', async () => {
    const CDN = 'https://launchercontent.mojang.com'
    const [news, notes] = await Promise.all([
      getJSON(CDN + '/v2/news.json').catch(() => ({ entries: [] })),
      getJSON(CDN + '/v2/javaPatchNotes.json').catch(() => ({ entries: [] }))
    ])
    const articles = (news.entries || [])
      .filter(e => /java/i.test(e.category || ''))
      .map(e => {
        const img = e.newsPageImage || e.playPageImage
        return { title: e.title, tag: 'News', date: e.date, link: e.readMoreLink, image: img ? CDN + img.url : null }
      })
    const patches = (notes.entries || []).slice(0, 10).map(e => ({
      title: e.title,
      tag: e.type === 'snapshot' ? 'Snapshot' : 'Release',
      date: e.date,
      link: 'https://minecraft.wiki/w/Java_Edition_' + encodeURIComponent(e.version.replace(/-snapshot-/, ' Snapshot ').replace(/ /g, '_')),
      image: e.image ? CDN + e.image.url : null
    }))
    return [...articles, ...patches].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 12)
  })
  handle('server:status', async host => {
    const r = await getJSON('https://api.mcsrvstat.us/3/' + encodeURIComponent(host))
    return { online: !!r.online, players: r.players ? r.players.online : 0, max: r.players ? r.players.max : 0, icon: r.icon || null }
  })
  handle('net:diagnose', () => network.diagnose())
  handle('open:external', url => { if (/^https?:\/\//.test(url)) shell.openExternal(url) })

  handle('servers:versions', () => servers.paperVersions())
  handle('servers:list', () => servers.list())
  handle('servers:create', cfg => servers.create(cfg))
  handle('servers:remove', id => servers.remove(id))
  handle('servers:start', id => servers.start(id, send))
  handle('servers:stop', id => servers.stop(id))
  handle('servers:command', (id, cmd) => servers.command(id, cmd))
  handle('servers:folder', id => {
    const srv = store.get().servers.find(s => s.id === id)
    const dir = servers.dirOf(srv)
    fs.mkdirSync(dir, { recursive: true })
    return shell.openPath(dir)
  })

  // Xion Store (cosmetics) API on the Xion website. Runs here so the renderer keeps a strict CSP.
  handle('cos:api', async (route, body, token) => {
    if (!/^(shop|locker|wear|admin)$/.test(String(route))) throw new Error('Unknown store route')
    const url = 'https://xion-launcher.vercel.app/api/cosmetics?r=' + route + (body && body.query ? '&' + new URLSearchParams(body.query) : '')
    const post = body && !body.query
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 30000)
    try {
      const r = await fetch(url, {
        method: post ? 'POST' : 'GET',
        signal: ctrl.signal,
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'XionLauncher/' + app.getVersion(), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: post ? JSON.stringify(body) : undefined
      })
      let data = {}
      try { data = await r.json() } catch {}
      if (!r.ok) throw new Error(data.error || `Store is not reachable right now (${r.status}).`)
      return data
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('The store took too long to answer. Try again.')
      if (/fetch failed|ENOTFOUND|ECONN/i.test(e.message)) throw new Error('No connection to the store. Check your internet.')
      throw e
    } finally { clearTimeout(t) }
  })

  handle('update:get', () => updater.get())
  handle('update:install', () => updater.install())

  createWindow()
  updater.start(send)
})

process.on('uncaughtException', e => send('launch:log', '[Xion] ' + (e && e.stack)))

app.on('before-quit', () => servers.stopAll())
app.on('window-all-closed', () => app.quit())
