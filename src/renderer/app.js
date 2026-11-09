/* global xion, heroScene */
const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

const state = {
  profiles: [],
  selectedProfile: null,
  settings: {},
  accounts: [],
  active: null,
  info: {},
  vanilla: null,
  launch: 'idle',
  servers: [],
  selectedServer: null,
  serverLogs: {}
}

/* ---------------- Icons ---------------- */
const CUBES = {
  grass: { top: '#6cc44a', left: '#8a5a33', right: '#6e4626', strip: ['#5aae3c', '#4b9631'] },
  fabric: { top: '#e9d3a6', left: '#c8ae80', right: '#a68c62', stitch: true },
  quilt: { top: '#c58cff', left: '#9a5ce0', right: '#7a40be', stitch: true },
  stone: { top: '#9d9daa', left: '#7d7d8a', right: '#64646f' },
  diamond: { top: '#7af0ff', left: '#33c2d9', right: '#1d97ad', gem: true },
  gold: { top: '#ffe066', left: '#e6b422', right: '#b88a12', gem: true },
  tnt: { top: '#e8e2d6', left: '#db3b2a', right: '#b02b1e', band: true },
  nether: { top: '#a33a3a', left: '#7e2a2a', right: '#5f1f1f' },
  end: { top: '#f2f0b3', left: '#d7d38c', right: '#b3ae6a' },
  xion: { top: '#c58cff', left: '#7b5cff', right: '#2fb8ff', gem: true }
}
function cube (name) {
  const c = CUBES[name] || CUBES.grass
  let extra = ''
  if (c.strip) extra += `<polygon points="3,9 16,16 16,20 3,13" fill="${c.strip[0]}"/><polygon points="16,16 29,9 29,13 16,20" fill="${c.strip[1]}"/>`
  if (c.stitch) extra += '<path d="M9.5 5.5 L22.5 12.5 M9.5 12.5 L22.5 5.5" stroke="rgba(255,255,255,.55)" stroke-width="1" stroke-dasharray="1.6 1.4" fill="none"/>'
  if (c.gem) extra += '<polygon points="16,6 21,9 16,12 11,9" fill="rgba(255,255,255,.55)"/><polygon points="7,15 10,17 10,21 7,19" fill="rgba(255,255,255,.3)"/><polygon points="25,15 22,17 22,21 25,19" fill="rgba(0,0,0,.18)"/>'
  if (c.band) extra += '<polygon points="3,14 16,21 16,25 3,18" fill="#f4efe6"/><polygon points="16,21 29,14 29,18 16,25" fill="#d8d2c6"/>'
  return `<svg class="pi" viewBox="0 0 32 32" style="stroke:none"><polygon points="16,2 29,9 16,16 3,9" fill="${c.top}"/><polygon points="3,9 16,16 16,30 3,23" fill="${c.left}"/><polygon points="16,16 29,9 29,23 16,30" fill="${c.right}"/>${extra}<polygon points="16,2 29,9 16,16 3,9" fill="none" stroke="rgba(255,255,255,.18)" stroke-width=".6"/></svg>`
}
const ICONS = Object.keys(CUBES)
const LOADER_NAME = { vanilla: 'Fabric', fabric: 'Fabric', quilt: 'Quilt' }
const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
  folder: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M9 7V4h6v3"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  paper: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none"/></svg>',
  bolt: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor" stroke="none"/></svg>',
  puzzle: '<svg viewBox="0 0 24 24"><path d="M10 3a2 2 0 014 0v2h4a1 1 0 011 1v4h-2a2 2 0 000 4h2v4a1 1 0 01-1 1h-4v-2a2 2 0 00-4 0v2H6a1 1 0 01-1-1v-4h2a2 2 0 000-4H5V6a1 1 0 011-1h4z"/></svg>'
}

/* ---------------- Helpers ---------------- */
function toast (msg, type = '') {
  const el = document.createElement('div')
  el.className = 'toast ' + type
  el.innerHTML = `<i></i><div>${esc(msg)}</div>`
  $('#toasts').appendChild(el)
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 260) }, type === 'err' ? 6500 : 3500)
}

const cleanErr = e => String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

async function api (ch, ...args) {
  try { return await xion.call(ch, ...args) } catch (e) {
    toast(cleanErr(e), 'err')
    throw e
  }
}

function headUrl (acc, size = 64) {
  if (!acc) return `https://mc-heads.net/avatar/MHF_Steve/${size}`
  return `https://mc-heads.net/avatar/${encodeURIComponent(acc.type === 'microsoft' ? acc.uuid : acc.name)}/${size}`
}
function bodyUrl (acc) {
  const id = acc ? (acc.type === 'microsoft' ? acc.uuid : acc.name) : 'MHF_Steve'
  return `https://mc-heads.net/body/${encodeURIComponent(id)}/240`
}
const activeAccount = () => state.accounts.find(a => a.id === state.active)
window.activeAccount = activeAccount // used by the Store module (store/store.js)
const selectedProfile = () => state.profiles.find(p => p.id === state.selectedProfile) || state.profiles[0]

const isOptimized = p => p.optimize !== false

function versionLabel (p) {
  const v = p.version === 'latest-release' ? (state.vanilla ? state.vanilla.latest.release : 'Latest') : p.version === 'latest-snapshot' ? 'Snapshot' : p.version
  return `Xion ${v}`
}

/* ---------------- Hero 3D skin ---------------- */
const heroSkin = (() => {
  let viewer = null
  let loadedFor = null
  const cache = {}
  function ensure () {
    if (viewer || typeof skinview3d === 'undefined') return viewer
    const canvas = $('#heroSkin')
    if (!canvas) return null
    const box = canvas.parentElement
    viewer = new skinview3d.SkinViewer({ canvas, width: box.clientWidth || 400, height: box.clientHeight || 400 })
    viewer.zoom = 0.58
    viewer.fov = 38
    viewer.autoRotate = false
    viewer.globalLight.intensity = 2.6
    viewer.cameraLight.intensity = 0.8
    viewer.controls.enableZoom = false
    viewer.playerObject.rotation.y = -0.45
    viewer.animation = new skinview3d.IdleAnimation()
    new ResizeObserver(() => viewer.setSize(box.clientWidth, box.clientHeight)).observe(box)
    // gentle sway so the model feels alive
    const sway = () => { if (viewer && !viewer.renderPaused) viewer.playerObject.rotation.y = -0.45 + Math.sin(performance.now() / 2600) * 0.35; requestAnimationFrame(sway) }
    sway()
    return viewer
  }
  async function load (acc) {
    const v = ensure()
    if (!v) return
    const key = acc ? acc.id : 'none'
    if (loadedFor === key) return
    loadedFor = key
    if (cache[key]) return v.loadSkin(cache[key].skin, { model: cache[key].slim ? 'slim' : 'default' })
    v.loadSkin(stevePng(), { model: 'default' })
    if (!acc) return
    try {
      const s = await xion.call('skin:get')
      if (s.skin && loadedFor === key) {
        cache[key] = s
        v.loadSkin(s.skin, { model: s.slim ? 'slim' : 'default' })
      }
    } catch {}
  }
  return {
    load,
    refresh (acc) { loadedFor = null; if (acc) delete cache[acc.id]; load(acc) },
    pause () { if (viewer) viewer.renderPaused = true },
    resume () { if (viewer) viewer.renderPaused = false }
  }
})()

/* ---------------- Window ---------------- */
$$('[data-win]').forEach(b => b.addEventListener('click', () => xion.call('win:' + b.dataset.win)))

/* ---------------- Navigation ---------------- */
// Slides the highlight pill under the active top tab.
function moveInk () {
  const ink = $('#tabInk')
  const active = $('.tabs .nav.active')
  if (!ink) return
  if (!active) { ink.style.opacity = '0'; return }
  ink.style.opacity = '1'
  ink.style.left = active.offsetLeft + 'px'
  ink.style.width = active.offsetWidth + 'px'
}
window.addEventListener('resize', moveInk)

function go (page) {
  document.body.dataset.page = page
  $$('.nav').forEach(n => n.classList.toggle('active', n.dataset.page === page))
  moveInk()
  if (page === 'play') heroSkin.resume(); else heroSkin.pause()
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + page))
  if (page === 'play') heroScene.resume(); else heroScene.pause()
  if (page === 'servers') loadServers()
  if (page === 'mods') initMods()
  if (page === 'player') initPlayer()
  else if (player.viewer) player.viewer.renderPaused = true
  if (page === 'logs') scrollConsole(true)
  if (page === 'pvp') initPvp()
  window.dispatchEvent(new CustomEvent('xion:page', { detail: page }))
}

// The Store page lives in store/store.js (an ES module); it listens for these events.
$$('.nav').forEach(n => n.addEventListener('click', () => go(n.dataset.page)))
$$('[data-goto]').forEach(n => n.addEventListener('click', () => {
  go(n.dataset.goto)
  if (n.dataset.goto === 'profiles') setTimeout(() => openProfileEditor({ loader: 'fabric' }), 150)
}))

/* ---------------- Accounts ---------------- */
function renderAccounts () {
  const acc = activeAccount()
  $('#chipHead').src = headUrl(acc, 64)
  $('#chipName').textContent = acc ? acc.name : 'Add account'
  $('#chipType').textContent = acc ? (acc.type === 'microsoft' ? 'Microsoft account' : 'Offline account') : 'Not signed in'
  const tag = $('#nametag')
  if (tag) tag.textContent = acc ? acc.name : 'Guest'
  heroSkin.load(acc)
  window.dispatchEvent(new CustomEvent('xion:account'))

  const list = $('#accountList')
  if (!state.accounts.length) {
    list.innerHTML = '<div class="acc-empty">No accounts yet. Sign in with Microsoft or create an offline account.</div>'
    return
  }
  list.innerHTML = state.accounts.map(a => `
    <div class="acc ${a.id === state.active ? 'active' : ''}" data-id="${esc(a.id)}">
      <img src="${headUrl(a, 64)}" alt="">
      <div class="meta"><b>${esc(a.name)}</b><small>${a.type === 'microsoft' ? 'Microsoft' : 'Offline'}</small></div>
      <button class="rm" data-rm="${esc(a.id)}" title="Remove">${ICON.x}</button>
    </div>`).join('')
}

$('#accountChip').addEventListener('click', e => { e.stopPropagation(); $('#accountMenu').classList.toggle('open') })
document.addEventListener('click', e => {
  if (!e.target.closest('#accountMenu')) $('#accountMenu').classList.remove('open')
  if (!e.target.closest('#profilePop') && !e.target.closest('#profilePickBtn')) $('#profilePop').classList.remove('open')
})
$('#accountList').addEventListener('click', async e => {
  const rm = e.target.closest('[data-rm]')
  if (rm) {
    e.stopPropagation()
    const r = await api('accounts:remove', rm.dataset.rm)
    Object.assign(state, { accounts: r.accounts, active: r.active })
    return renderAccounts()
  }
  const row = e.target.closest('.acc')
  if (row) {
    const r = await api('accounts:select', row.dataset.id)
    Object.assign(state, { accounts: r.accounts, active: r.active })
    renderAccounts()
    $('#accountMenu').classList.remove('open')
  }
})

$('#addMicrosoft').addEventListener('click', async () => {
  const btn = $('#addMicrosoft')
  btn.disabled = true
  const old = btn.innerHTML
  btn.innerHTML = '<span class="spinner" style="border-color:#0002;border-top-color:#222"></span> Waiting for Microsoft…'
  try {
    const acc = await api('accounts:microsoft')
    const r = await xion.call('accounts:select', acc.id)
    Object.assign(state, { accounts: r.accounts, active: r.active })
    renderAccounts()
    toast(`Signed in as ${acc.name}`, 'ok')
    $('#accountMenu').classList.remove('open')
  } catch {} finally {
    btn.disabled = false
    btn.innerHTML = old
  }
})

$('#addOffline').addEventListener('click', () => {
  $('#accountMenu').classList.remove('open')
  openModal(`
    <h2>Offline account</h2>
    <p class="sub">Play with any username. Works in singleplayer and on servers with online-mode off.</p>
    <div class="field"><label>Username</label><input type="text" id="offName" maxlength="16" placeholder="Steve" autocomplete="off"></div>
    <div class="row gap" style="align-items:center"><img id="offPreview" src="https://mc-heads.net/avatar/MHF_Steve/48" style="width:48px;height:48px;border-radius:10px;image-rendering:pixelated"><span class="muted small">3–16 characters: letters, numbers and _</span></div>
    <div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="offSave">Add account</button></div>`)
  const input = $('#offName')
  let tmr
  input.addEventListener('input', () => {
    clearTimeout(tmr)
    tmr = setTimeout(() => { if (/^\w{3,16}$/.test(input.value)) $('#offPreview').src = `https://mc-heads.net/avatar/${encodeURIComponent(input.value)}/48` }, 400)
  })
  const save = async () => {
    const acc = await api('accounts:offline', input.value)
    const r = await xion.call('accounts:select', acc.id)
    Object.assign(state, { accounts: r.accounts, active: r.active })
    renderAccounts()
    closeModal()
    toast(`Welcome, ${acc.name}!`, 'ok')
  }
  input.addEventListener('keydown', e => { if (e.key === 'Enter') save().catch(() => {}) })
  $('#offSave').addEventListener('click', () => save().catch(() => {}))
  setTimeout(() => input.focus(), 50)
})

/* ---------------- Modal ---------------- */
function openModal (html) {
  $('#modal').innerHTML = html
  $('#modalBack').classList.add('open')
  $$('#modal [data-close]').forEach(b => b.addEventListener('click', closeModal))
}
function closeModal () { $('#modalBack').classList.remove('open') }
$('#modalBack').addEventListener('mousedown', e => { if (e.target.id === 'modalBack') closeModal() })
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal() })

/* ---------------- Profiles ---------------- */
function renderProfiles () {
  const sel = selectedProfile()
  if (state.catalog) renderChips()
  // Launch button subtitle
  if (state.launch === 'idle') {
    const game = sel ? resolveGame(sel.version) : null
    $('#launchTitle').textContent = sel ? 'Play' : 'Create profile'
    $('#launchSub').textContent = sel ? 'Minecraft ' + (game || sel.version) + ' · Xion Client' : 'Set up your first game'
  }
  $('#pickLabel').textContent = sel ? sel.name : 'None yet'

  // Profiles panel on the launchpad (only in layouts that have one)
  if ($('#quickProfiles')) $('#quickProfiles').innerHTML = state.profiles.map(p => `
    <button class="qp ${sel && p.id === sel.id ? 'active' : ''}" data-select="${esc(p.id)}">
      ${cube(p.icon)}
      <span class="meta"><b>${esc(p.name)}</b><small>${esc(versionLabel(p))}</small></span>
      <span class="dot"></span>
    </button>`).join('') + `<button class="qp add" data-new>${ICON.plus}New profile</button>`

  // Popover
  $('#profilePop').innerHTML = state.profiles.map(p => `
    <div class="pp-item ${sel && p.id === sel.id ? 'active' : ''}" data-select="${esc(p.id)}">
      ${cube(p.icon)}<div class="meta"><b>${esc(p.name)}</b><small>${esc(versionLabel(p))}</small></div>
    </div>`).join('') + `<div class="pp-item pp-new" data-new>${ICON.plus} New profile</div>`

  // Profiles page
  const glow = { vanilla: '#58d36b', fabric: '#e7c98d', quilt: '#b56cff' }
  $('#profileGrid').innerHTML = state.profiles.map(p => `
    <div class="pcard ${sel && p.id === sel.id ? 'selected' : ''}">
      <div class="glow" style="background:${glow[p.loader]}"></div>
      <div class="top">${cube(p.icon)}<div><h4>${esc(p.name)}</h4>
        <div class="badges"><span class="badge ${p.loader}">${LOADER_NAME[p.loader]}</span><span class="badge">${esc(p.version === 'latest-release' ? 'Latest release' : p.version)}</span>${isOptimized(p) ? `<span class="badge opt">${ICON.bolt}Optimized</span>` : ''}</div>
      </div></div>
      <div class="actions">
        <button class="btn primary" data-play="${esc(p.id)}">${ICON.play}Play</button>
        <button class="icon-btn" data-edit="${esc(p.id)}" title="Edit">${ICON.edit}</button>
        <button class="icon-btn" data-mods="${esc(p.id)}" title="Installed mods">${ICON.puzzle}</button>
        <button class="icon-btn" data-folder="${esc(p.id)}" title="Open folder (mods, saves)">${ICON.folder}</button>
        <button class="icon-btn bad" data-del="${esc(p.id)}" title="Delete">${ICON.trash}</button>
      </div>
    </div>`).join('') + `<div class="pcard new" data-new><div class="plus">${ICON.plus}</div>New profile</div>`
}

async function selectProfile (id) {
  state.selectedProfile = id
  await xion.call('profiles:select', id)
  renderProfiles()
}

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-select],[data-new],[data-play],[data-edit],[data-folder],[data-del],[data-mods]')
  if (!t) return
  if (t.dataset.mods) openModsManager(t.dataset.mods)
  else if (t.dataset.select) { await selectProfile(t.dataset.select); $('#profilePop').classList.remove('open') }
  else if (t.hasAttribute('data-new')) { $('#profilePop').classList.remove('open'); openProfileEditor({}) }
  else if (t.dataset.play) { await selectProfile(t.dataset.play); go('play'); launch() }
  else if (t.dataset.edit) openProfileEditor(state.profiles.find(p => p.id === t.dataset.edit))
  else if (t.dataset.folder) api('profiles:folder', t.dataset.folder)
  else if (t.dataset.del) {
    const p = state.profiles.find(x => x.id === t.dataset.del)
    openModal(`<h2>Delete profile?</h2><p class="sub">“${esc(p.name)}” will be removed from the launcher. Its worlds and mods stay on disk.</p>
      <div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn danger" id="confirmDel">Delete</button></div>`)
    $('#confirmDel').addEventListener('click', async () => {
      state.profiles = await api('profiles:delete', p.id)
      if (state.selectedProfile === p.id) state.selectedProfile = state.profiles[0] && state.profiles[0].id
      renderProfiles()
      closeModal()
    })
  }
})
$('#profilePickBtn').addEventListener('click', e => { e.stopPropagation(); $('#profilePop').classList.toggle('open') })
$('#newProfileBtn').addEventListener('click', () => openProfileEditor({}))

async function openModsManager (id) {
  const p = state.profiles.find(x => x.id === id)
  const render = list => {
    const mb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.ceil(n / 1024) + ' KB'
    $('#mmList').innerHTML = list.length ? list.map(m => `
      <div class="mm-row ${m.enabled ? '' : 'dis'}">
        <div class="mm-ico">${m.managed ? ICON.bolt : ICON.puzzle}</div>
        <div class="grow"><b>${esc(m.file.replace(/\.jar(\.disabled)?$/, ''))}</b><small>${m.managed ? 'Xion pack' : 'Added by you'} · ${mb(m.size)}</small></div>
        ${m.managed ? '<span class="badge opt">Managed</span>' : `<label class="toggle sm"><input type="checkbox" data-mt="${esc(m.file)}" ${m.enabled ? 'checked' : ''}><span></span></label>`}
      </div>`).join('') : '<div class="muted small" style="padding:24px;text-align:center">No mods installed yet. Launch once to install the Xion pack, or drop .jar files into the mods folder.</div>'
    $$('#mmList [data-mt]').forEach(c => c.addEventListener('change', async () => render(await api('mods:toggle', id, c.dataset.mt))))
  }
  openModal(`
    <h2>Mods · ${esc(p.name)}</h2>
    <p class="sub">Xion-managed mods update automatically. Your own mods can be toggled here.</p>
    <div class="mm-list" id="mmList"><div class="spinner" style="margin:20px auto"></div></div>
    <div class="foot"><button class="btn ghost" id="mmFolder">${ICON.folder}Open mods folder</button><button class="btn primary" data-close>Done</button></div>`)
  $('#mmFolder').addEventListener('click', () => xion.call('profiles:folder', id))
  render(await api('mods:list', id))
}

// Versions Xion Client supports (one bundled jar per version), newest first.
function supportedVersions () {
  const supported = new Set(state.catalog.clientVersions)
  const order = state.vanilla ? state.vanilla.versions.map(v => v.id) : []
  return order.filter(id => supported.has(id))
}

function resolveGame (version) {
  return version === 'latest-release' ? (state.vanilla && state.vanilla.latest.release) : version
}

function openProfileEditor (p) {
  const draft = {
    id: p.id,
    name: p.name || '',
    loader: p.loader === 'quilt' ? 'quilt' : 'fabric',
    version: p.version || 'latest-release',
    loaderVersion: p.loaderVersion || 'latest',
    icon: p.icon || 'xion',
    optimize: p.optimize !== false,
    mods: p.mods ? [...p.mods] : [...state.catalog.defaults],
    created: p.created
  }
  openModal(`
    <h2>${p.id ? 'Edit profile' : 'New profile'}</h2>
    <p class="sub">Every profile runs <b>Xion Client</b> — HUD mods, Xion menu, skins and the optimization pack.</p>
    <div class="field"><label>Name</label><input type="text" id="pName" maxlength="40" placeholder="My Profile" value="${esc(draft.name)}"></div>
    <div class="field-row">
      <div class="field"><label>Minecraft version</label><select id="pVersion"><option>Loading…</option></select></div>
      <div class="field"><label>Loader</label>
        <div class="seg" id="pLoader">
          <button data-l="fabric">${cube('fabric')}Fabric</button>
          <button data-l="quilt">${cube('quilt')}Quilt</button>
        </div>
      </div>
    </div>
    <div class="field"><label>Loader version</label><select id="pLoaderVersion"><option value="latest">Latest stable</option></select></div>
    <div class="field"><label>Icon</label><div class="icon-pick" id="pIcons">${ICONS.map(i => `<button data-i="${i}" title="${i}">${cube(i)}</button>`).join('')}</div></div>
    <div id="pPack"></div>
    <div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="pSave">${p.id ? 'Save changes' : 'Create profile'}</button></div>`)

  const renderPack = () => {
    const cats = {}
    state.catalog.catalog.forEach(m => { (cats[m.cat] = cats[m.cat] || []).push(m) })
    $('#pPack').innerHTML = `
      <div class="pack">
        <div class="pack-head locked">
          <div class="mod-ico x">${cube('xion')}</div>
          <div class="grow"><b>Xion Client</b><span>Main menu, 12 HUD mods, Right Shift menu, HUD editor, skins &amp; badge — built in.</span></div>
          <span class="badge opt">Always on</span>
        </div>
        <div class="pack-head">
          <div class="pack-ico">${ICON.bolt}</div>
          <div class="grow"><b>Optimization pack</b><span>Auto-installs the best performance mods for this version from Modrinth.</span></div>
          <label class="toggle sm"><input type="checkbox" id="pOpt" ${draft.optimize ? 'checked' : ''}><span></span></label>
        </div>
        <div class="pack-body ${draft.optimize ? '' : 'off'}">
          ${Object.entries(cats).map(([cat, list]) => `
            <div class="mod-cat">${esc(cat)}</div>
            <div class="mod-grid">${list.map(m => `
              <label class="mod-row">
                <div class="grow"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>
                <input type="checkbox" data-mod="${esc(m.slug)}" ${draft.mods.includes(m.slug) ? 'checked' : ''}><span class="ck"></span>
              </label>`).join('')}</div>`).join('')}
          <p class="muted small" style="margin:12px 2px 0">Mods without a build for the chosen version are skipped automatically.</p>
        </div>
      </div>`
    $('#pOpt').addEventListener('change', e => { draft.optimize = e.target.checked; $('.pack-body').classList.toggle('off', !draft.optimize) })
    $$('#pPack [data-mod]').forEach(c => c.addEventListener('change', () => {
      draft.mods = $$('#pPack [data-mod]').filter(x => x.checked).map(x => x.dataset.mod)
    }))
  }

  const syncSeg = () => {
    $$('#pLoader button').forEach(b => b.classList.toggle('on', b.dataset.l === draft.loader))
    $$('#pIcons button').forEach(b => b.classList.toggle('on', b.dataset.i === draft.icon))
  }

  const loadLoaders = async () => {
    const sel = $('#pLoaderVersion')
    sel.innerHTML = '<option value="latest">Latest stable</option>'
    const game = resolveGame(draft.version)
    if (!game) return
    try {
      const list = await xion.call('versions:loaders', draft.loader, game)
      if (!list.length) { sel.innerHTML = '<option value="latest">Not available for this version</option>'; return }
      sel.innerHTML = '<option value="latest">Latest stable</option>' + list.slice(0, 60).map(l => `<option value="${esc(l.id)}">${esc(l.id)}${l.stable ? '' : ' (beta)'}</option>`).join('')
      sel.value = list.some(l => l.id === draft.loaderVersion) ? draft.loaderVersion : 'latest'
    } catch { sel.innerHTML = '<option value="latest">Latest stable</option>' }
  }

  const loadVersions = async () => {
    const sel = $('#pVersion')
    if (!state.vanilla) {
      sel.innerHTML = '<option>Loading versions…</option>'
      try {
        state.vanilla = await xion.call('versions:vanilla')
      } catch (e) {
        sel.innerHTML = '<option>Could not load versions — click to retry</option>'
        sel.onfocus = () => { sel.onfocus = null; loadVersions().catch(() => {}) }
        toast(cleanErr(e), 'err')
        return
      }
    }
    const list = supportedVersions()
    const latest = state.vanilla.latest.release
    const groups = {}
    list.forEach(id => { const k = id.split('.').slice(0, 2).join('.'); (groups[k] = groups[k] || []).push(id) })
    sel.innerHTML = (list.includes(latest) ? `<option value="latest-release">Latest release (${esc(latest)})</option>` : '') +
      Object.entries(groups).map(([g, ids]) => `<optgroup label="${g}">${ids.map(id => `<option value="${esc(id)}">${esc(id)}</option>`).join('')}</optgroup>`).join('')
    if (![...sel.options].some(o => o.value === draft.version)) draft.version = sel.options[0] ? sel.options[0].value : 'latest-release'
    sel.value = draft.version
    loadLoaders()
  }

  $('#pLoader').addEventListener('click', e => {
    const b = e.target.closest('[data-l]')
    if (!b || b.dataset.l === draft.loader) return
    draft.loader = b.dataset.l
    syncSeg()
    loadLoaders()
  })
  $('#pIcons').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) { draft.icon = b.dataset.i; syncSeg() } })
  $('#pVersion').addEventListener('change', e => { draft.version = e.target.value; loadLoaders() })
  $('#pLoaderVersion').addEventListener('change', e => { draft.loaderVersion = e.target.value })
  $('#pSave').addEventListener('click', async () => {
    draft.name = $('#pName').value.trim() || (draft.version === 'latest-release' ? 'Latest Release' : 'Minecraft ' + draft.version)
    const before = new Set(state.profiles.map(x => x.id))
    state.profiles = await api('profiles:save', draft)
    const created = state.profiles.find(x => !before.has(x.id))
    if (created) await selectProfile(created.id)
    renderProfiles()
    closeModal()
    toast(p.id ? 'Profile saved' : 'Profile created', 'ok')
  })
  syncSeg()
  renderPack()
  loadVersions().catch(() => {})
  setTimeout(() => $('#pName').focus(), 50)
}

/* ---------------- Launch ---------------- */
const STEPS = [
  { id: 'auth', label: 'Account' },
  { id: 'meta', label: 'Version' },
  { id: 'loader', label: 'Loader' },
  { id: 'java', label: 'Java' },
  { id: 'mods', label: 'Mods' },
  { id: 'files', label: 'Game files' },
  { id: 'starting', label: 'Start' }
]
function renderSteps (phase) {
  const p = selectedProfile()
  const steps = STEPS
  const idx = steps.findIndex(s => s.id === phase)
  $('#launchSteps').innerHTML = steps.map((s, i) => `<div class="step ${i < idx ? 'done' : i === idx ? 'cur' : ''}"><i></i><span>${s.label}</span></div>`).join('<b></b>')
}

function renderChips () {
  const p = selectedProfile()
  if (!p) { $('#heroChips').innerHTML = ''; return }
  const n = isOptimized(p) ? (p.mods || state.catalog.defaults).length : 0
  const game = p.version === 'latest-release' ? (state.vanilla && state.vanilla.latest.release) : p.version
  const client = state.catalog.clientVersions.includes(game)
  $('#heroChips').innerHTML = [
    `<span class="chip">${cube(p.icon)}${esc(versionLabel(p))}</span>`,
    n ? `<span class="chip opt">${ICON.bolt}${n} performance mods</span>` : '',
    client ? '<span class="chip xc">Xion Client</span>' : '<span class="chip">Version not supported</span>'
  ].join('')
}

function setLaunchState (s, title, sub, progress) {
  state.launch = s
  $('#page-play').classList.toggle('busy', s === 'busy')
  const box = $('#launchBox')
  box.classList.toggle('busy', s === 'busy')
  box.classList.toggle('playing', s === 'playing')
  box.classList.toggle('idle', s === 'idle')
  box.style.setProperty('--p', progress != null ? progress : s === 'playing' ? 1 : 0)
  const badge = $('#heroBadge')
  badge.className = 'status ' + (s === 'busy' ? 'busy' : s === 'playing' ? 'playing' : '')
  $('#heroBadgeText').textContent = s === 'busy' ? 'Preparing game' : s === 'playing' ? 'In game' : 'Ready to play'
  $('#killGame').disabled = s !== 'playing'
  if (title) $('#launchTitle').textContent = title
  if (sub) $('#launchSub').textContent = sub
  $('#launchProgress').style.width = progress == null ? '0' : Math.round(progress * 100) + '%'
  const pb = $('#pvpPlay')
  pb.classList.toggle('busy', s === 'busy')
  pb.classList.toggle('playing', s === 'playing')
  $('#pvpPlayLabel').textContent = s === 'idle' ? 'Play PvP' : s === 'playing' ? 'In game' : ($('#launchSub').textContent || 'Preparing…')
  $('#pvpFill').style.width = progress == null ? '0' : Math.round(progress * 100) + '%'
  if (s === 'idle') {
    renderProfiles()
    if (pvp.data) xion.call('pvp:get').then(d => { pvp.data = d; renderPvp() }).catch(() => {})
  }
}

async function launch (opts) {
  if (state.launch === 'playing') return go('logs')
  if (state.launch !== 'idle') return
  if (!activeAccount()) {
    toast('Add an account to play — Microsoft or offline.', 'err')
    $('#accountMenu').classList.add('open')
    return
  }
  const p = opts && opts.pvp ? { ...PVP, version: pvp.data ? pvp.data.version : '1.21.11' } : selectedProfile()
  if (!p) return openProfileEditor({})
  renderSteps('auth')
  setLaunchState('busy', 'Launching', 'Preparing…', 0)
  logLine(`[Xion] Launching ${p.name} (${versionLabel(p)}) as ${activeAccount().name}`)
  xion.call('system:filterKeys').then(on => {
    if (!on) return
    logLine('[Xion] Windows Filter Keys is ON: keys will feel late and repeat in game. Turn it off: Settings → Accessibility → Keyboard → Filter keys.')
    toast('Windows Filter Keys is on, so keys will lag in game. Turn it off in Settings → Accessibility → Keyboard.', 'err')
  }).catch(() => {})
  try {
    await xion.call('game:launch', p.id, opts || {})
  } catch (e) {
    setLaunchState('idle')
    const msg = e.message.replace(/^Error invoking remote method '[^']+': /, '')
    logLine('[Xion] Launch failed: ' + msg)
    toast(msg, 'err')
  }
}
$('#launchBtn').addEventListener('click', () => launch())
$('#killGame').addEventListener('click', () => xion.call('game:kill'))

xion.on('launch:status', s => {
  if (s.phase === 'running') return setLaunchState('playing', 'Playing', s.text + ' · open console', 0)
  renderSteps(s.phase)
  setLaunchState('busy', s.phase === 'starting' ? 'Starting' : 'Launching', s.text, s.progress)
})
xion.on('launch:closed', ({ code }) => {
  setLaunchState('idle')
  logLine(`[Xion] Game exited with code ${code}`)
  if (code && code !== 0) toast(`Minecraft exited with code ${code}. See Console for details.`, 'err')
})

/* ---------------- Xion PvP mode ---------------- */
const PVP = { id: 'xion-pvp', name: 'Xion PvP', loader: 'fabric', icon: 'xion' }
const pvp = { data: null }

async function initPvp () {
  if (!pvp.data) {
    try { pvp.data = await xion.call('pvp:get') } catch (e) { toast('Could not load PvP mode: ' + e.message, 'err'); return }
    renderPvpServers()
  }
  renderPvp()
}

function renderPvp () {
  const d = pvp.data
  if (!d) return
  const sel = $('#pvpVersion')
  if (sel.dataset.ready !== String(d.versions.length)) {
    sel.innerHTML = [...d.versions].sort(cmpVersion).map(v => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('')
    sel.dataset.ready = String(d.versions.length)
  }
  sel.value = d.version
  $('#pvpStats').innerHTML = [
    ['Matches', d.launches || 0],
    ['Time in PvP', fmtTime(d.playtime)]
  ].map(([k, v]) => '<div><b>' + esc(String(v)) + '</b><span>' + esc(k) + '</span></div>').join('')
  $('#pvpModCount').textContent = d.mods.length + ' of ' + d.catalog.length + ' on'
  const cats = {}
  d.catalog.forEach(m => { (cats[m.cat] = cats[m.cat] || []).push(m) })
  $('#pvpMods').innerHTML = Object.entries(cats).map(([cat, list]) => `
    <div class="mod-cat">${esc(cat)}</div>
    <div class="mod-grid">${list.map(m => `
      <label class="mod-row">
        <div class="grow"><b>${esc(m.name)}</b><small>${esc(m.desc)}</small></div>
        <input type="checkbox" data-pvpmod="${esc(m.slug)}" ${d.mods.includes(m.slug) ? 'checked' : ''}><span class="ck"></span>
      </label>`).join('')}</div>`).join('')
  if (state.launch === 'idle') $('#pvpPlayLabel').textContent = 'Play PvP'
}

// Newest first: 26.x, then 1.x by minor and patch.
function cmpVersion (a, b) {
  const n = v => v.split('.').map(x => parseInt(x, 10) || 0)
  const x = n(a), y = n(b)
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (y[i] || 0) - (x[i] || 0)
  return 0
}

$('#pvpMods').addEventListener('change', async e => {
  const slug = e.target.dataset.pvpmod
  if (!slug || !pvp.data) return
  const set = new Set(pvp.data.mods)
  if (e.target.checked) set.add(slug); else set.delete(slug)
  pvp.data.mods = await xion.call('pvp:setMods', [...set])
  $('#pvpModCount').textContent = pvp.data.mods.length + ' of ' + pvp.data.catalog.length + ' on'
})

$('#pvpVersion').addEventListener('change', async e => {
  try { pvp.data.version = await xion.call('pvp:setVersion', e.target.value) } catch (err) { toast(err.message, 'err') }
})

function renderPvpServers () {
  const list = pvp.data.servers
  $('#pvpServers').innerHTML = list.map((s, i) => `
    <div class="srv" data-pvphost="${esc(s.host)}">
      <div class="srv-ph" id="pvpIco${i}">${esc(s.name[0])}</div>
      <div class="meta"><b>${esc(s.name)}</b><small>${esc(s.tag)}</small></div>
      <div class="count"><i id="pvpDot${i}"></i><span id="pvpCount${i}">—</span></div>
      <span class="join">JOIN</span>
    </div>`).join('')
  list.forEach(async (s, i) => {
    try {
      const st = await xion.call('server:status', s.host)
      $('#pvpCount' + i).textContent = st.online ? st.players.toLocaleString() : '—'
      $('#pvpDot' + i).classList.toggle('on', st.online)
      if (st.icon) {
        const img = document.createElement('img')
        img.src = st.icon
        $('#pvpIco' + i).replaceWith(img)
      }
    } catch { $('#pvpCount' + i).textContent = '?' }
  })
}
$('#pvpServers').addEventListener('click', e => {
  const b = e.target.closest('[data-pvphost]')
  if (!b) return
  toast('Joining ' + b.dataset.pvphost + '…')
  launch({ pvp: true, server: b.dataset.pvphost })
})
$('#pvpPlay').addEventListener('click', () => launch({ pvp: true }))

/* ---------------- Console ---------------- */
const consoleEl = $('#console')
let pending = []
function logLine (line) {
  pending.push(line)
  if (pending.length === 1) requestAnimationFrame(flushLogs)
}
function flushLogs () {
  const atBottom = consoleEl.scrollHeight - consoleEl.scrollTop - consoleEl.clientHeight < 40
  const frag = document.createDocumentFragment()
  pending.splice(0).forEach(l => {
    const d = document.createElement('div')
    d.textContent = l
    if (/\bERROR\b|Exception|FATAL/.test(l)) d.className = 'e'
    else if (/\bWARN/.test(l)) d.className = 'w'
    else if (/^\[(Xion|MCLC)\]/.test(l)) d.className = 'x'
    frag.appendChild(d)
  })
  consoleEl.appendChild(frag)
  while (consoleEl.childElementCount > 4000) consoleEl.firstChild.remove()
  if (atBottom) scrollConsole(true)
}
function scrollConsole () { consoleEl.scrollTop = consoleEl.scrollHeight }
xion.on('launch:log', l => String(l).split(/\r?\n/).filter(Boolean).forEach(logLine))
$('#clearLogs').addEventListener('click', () => { consoleEl.innerHTML = '' })
$('#copyLogs').addEventListener('click', () => { navigator.clipboard.writeText(consoleEl.innerText); toast('Copied to clipboard', 'ok') })

/* ---------------- News ---------------- */
async function loadNews () {
  try {
    const news = await xion.call('news:get')
    $('#news').innerHTML = news.map(n => `
      <div class="news-card" data-link="${esc(n.link)}" style="background-image:url('${esc(n.image)}')">
        <div class="nc-body">${n.tag ? `<span class="tag">${esc(n.tag)}</span>` : ''}<b>${esc(n.title)}</b></div>
      </div>`).join('')
  } catch {
    $('#news').innerHTML = '<div class="muted small" style="padding:20px">News unavailable — check your internet connection.</div>'
  }
}
$('#news').addEventListener('click', e => { const c = e.target.closest('[data-link]'); if (c && c.dataset.link) xion.call('open:external', c.dataset.link) })

/* ---------------- Featured servers ---------------- */
const FEATURED = [
  { name: 'Hypixel', host: 'mc.hypixel.net', tint: 'linear-gradient(90deg, rgba(255,170,0,.18), transparent 60%)' },
  { name: 'CubeCraft', host: 'play.cubecraft.net', tint: 'linear-gradient(90deg, rgba(60,160,255,.18), transparent 60%)' },
  { name: 'DonutSMP', host: 'donutsmp.net', tint: 'linear-gradient(90deg, rgba(47,150,255,.18), transparent 60%)' },
  { name: 'Wynncraft', host: 'play.wynncraft.com', tint: 'linear-gradient(90deg, rgba(120,220,90,.16), transparent 60%)' },
  { name: 'MCC Island', host: 'play.mccisland.net', tint: 'linear-gradient(90deg, rgba(255,90,200,.16), transparent 60%)' }
]
function renderFeatured () {
  $('#featured').innerHTML = FEATURED.map((s, i) => `
    <div class="srv" data-host="${esc(s.host)}" data-tip="${esc(s.name)} · ${esc(s.host)}">
      <div class="srv-ph" id="srvIcon${i}">${esc(s.name[0])}</div>
      <div class="meta"><b>${esc(s.name)}</b><small>${esc(s.host)}</small></div>
      <div class="count"><i id="srvDot${i}"></i><span id="srvCount${i}">—</span></div>
      <span class="join">JOIN</span>
    </div>`).join('')
  FEATURED.forEach(async (s, i) => {
    try {
      const st = await xion.call('server:status', s.host)
      $('#srvCount' + i).textContent = st.online ? st.players.toLocaleString() : '—'
      const tile = $('#featured').children[i]
      if (tile && st.online) tile.dataset.tip = s.name + ' · ' + st.players.toLocaleString() + ' online'
      $('#srvDot' + i).classList.toggle('on', st.online)
      if (st.icon) {
        const img = document.createElement('img')
        img.src = st.icon
        $('#srvIcon' + i).replaceWith(img)
      }
    } catch { $('#srvCount' + i).textContent = '?' }
  })
}
$('#featured').addEventListener('click', e => {
  const s = e.target.closest('[data-host]')
  if (!s) return
  toast(`Joining ${s.dataset.host}…`)
  launch({ server: s.dataset.host })
})

/* ---------------- Paper servers ---------------- */
async function loadServers () {
  state.servers = await xion.call('servers:list').catch(() => [])
  if (!state.selectedServer && state.servers[0]) state.selectedServer = state.servers[0].id
  renderServers()
}

function renderServers () {
  const list = $('#srvList')
  list.innerHTML = state.servers.length ? state.servers.map(s => `
    <div class="srv-item ${s.id === state.selectedServer ? 'active' : ''}" data-srv="${esc(s.id)}">
      <div class="paper">${ICON.paper}</div>
      <div class="meta"><b>${esc(s.name)}</b><small>Paper ${esc(s.version)} · ${Math.round(s.memory / 1024 * 10) / 10} GB</small></div>
      <span class="state-dot ${s.running ? 'on' : ''}"></span>
    </div>`).join('') : '<div class="muted small" style="padding:8px">No servers yet.</div>'

  const s = state.servers.find(x => x.id === state.selectedServer)
  const det = $('#srvDetail')
  if (!s) {
    det.innerHTML = '<div class="empty"><div class="empty-art"></div><h3>No server selected</h3><p class="muted">Create a Paper server to get started.</p></div>'
    return
  }
  det.innerHTML = `
    <div class="sd-head">
      <div class="paper" style="width:46px;height:46px;border-radius:12px;display:grid;place-items:center;background:linear-gradient(135deg,#f5f5f5,#c9c9d6);color:#222">${ICON.paper}</div>
      <div class="grow"><h2>${esc(s.name)}</h2><div class="addr">localhost:${s.port} · ${s.onlineMode ? 'online-mode' : 'offline-mode (cracked accounts allowed)'}</div></div>
      ${s.running
        ? `<button class="btn danger" id="srvStop">${ICON.stop}Stop</button>`
        : `<button class="btn success" id="srvStart">${ICON.play}Start</button>`}
      <button class="icon-btn" id="srvFolder" title="Open folder">${ICON.folder}</button>
      <button class="icon-btn bad" id="srvDel" title="Delete" ${s.running ? 'disabled' : ''}>${ICON.trash}</button>
    </div>
    <pre class="console" id="srvConsole"></pre>
    <div class="cmd"><input type="text" id="srvCmd" placeholder="${s.running ? 'Type a command, e.g. op ' + esc((activeAccount() || {}).name || 'Steve') : 'Start the server to send commands'}" ${s.running ? '' : 'disabled'}><button class="btn primary" id="srvSend" ${s.running ? '' : 'disabled'}>Send</button></div>`
  const c = $('#srvConsole')
  c.textContent = (state.serverLogs[s.id] || []).join('\n')
  c.scrollTop = c.scrollHeight

  const startBtn = $('#srvStart')
  if (startBtn) startBtn.addEventListener('click', async () => {
    startBtn.disabled = true
    startBtn.innerHTML = '<span class="spinner"></span>Starting…'
    try { await api('servers:start', s.id) } catch { startBtn.disabled = false; startBtn.innerHTML = ICON.play + 'Start' }
  })
  const stopBtn = $('#srvStop')
  if (stopBtn) stopBtn.addEventListener('click', () => { stopBtn.disabled = true; stopBtn.textContent = 'Stopping…'; xion.call('servers:stop', s.id) })
  $('#srvFolder').addEventListener('click', () => xion.call('servers:folder', s.id))
  $('#srvDel').addEventListener('click', async () => {
    await api('servers:remove', s.id)
    state.selectedServer = null
    loadServers()
  })
  const send = () => {
    const v = $('#srvCmd').value.trim()
    if (!v) return
    xion.call('servers:command', s.id, v.replace(/^\//, ''))
    $('#srvCmd').value = ''
  }
  $('#srvSend').addEventListener('click', send)
  $('#srvCmd').addEventListener('keydown', e => { if (e.key === 'Enter') send() })
}

$('#srvList').addEventListener('click', e => {
  const it = e.target.closest('[data-srv]')
  if (it) { state.selectedServer = it.dataset.srv; renderServers() }
})

xion.on('server:log', ({ id, line }) => {
  const arr = state.serverLogs[id] = state.serverLogs[id] || []
  arr.push(line)
  if (arr.length > 3000) arr.splice(0, arr.length - 3000)
  if (id === state.selectedServer) {
    const c = $('#srvConsole')
    if (c) {
      const atBottom = c.scrollHeight - c.scrollTop - c.clientHeight < 40
      c.textContent += (c.textContent ? '\n' : '') + line
      if (atBottom) c.scrollTop = c.scrollHeight
    }
  }
})
xion.on('server:state', () => loadServers())

$('#newServerBtn').addEventListener('click', async () => {
  openModal(`
    <h2>New Paper server</h2>
    <p class="sub">A high-performance server that runs on this PC. Friends on your network can join via your IP.</p>
    <div class="field"><label>Name</label><input type="text" id="sName" maxlength="32" placeholder="Survival with friends"></div>
    <div class="field-row">
      <div class="field"><label>Version</label><select id="sVersion"><option>Loading…</option></select></div>
      <div class="field"><label>Port</label><input type="number" id="sPort" value="25565" min="1024" max="65535"></div>
    </div>
    <div class="field"><label>Memory <b id="sMemL">2 GB</b></label><input type="range" id="sMem" min="1024" max="${Math.min(16384, state.info.totalMem || 8192)}" step="512" value="2048"></div>
    <label class="toggle"><input type="checkbox" id="sOnline"><span></span>Online mode (only Microsoft accounts can join)</label>
    <label class="check"><input type="checkbox" id="sEula"> I agree to the <a href="#" id="eulaLink">Minecraft End User License Agreement</a>.</label>
    <div class="foot"><button class="btn ghost" data-close>Cancel</button><button class="btn primary" id="sCreate" disabled>Create server</button></div>`)
  const mem = $('#sMem')
  const upd = () => { $('#sMemL').textContent = (mem.value / 1024).toFixed(1).replace('.0', '') + ' GB'; setRangeFill(mem) }
  mem.addEventListener('input', upd); upd()
  $('#eulaLink').addEventListener('click', e => { e.preventDefault(); xion.call('open:external', 'https://aka.ms/MinecraftEULA') })
  $('#sEula').addEventListener('change', e => { $('#sCreate').disabled = !e.target.checked })
  try {
    const vs = await xion.call('servers:versions')
    $('#sVersion').innerHTML = vs.map(v => `<option>${esc(v)}</option>`).join('')
  } catch { $('#sVersion').innerHTML = '<option>Unavailable</option>' }
  $('#sCreate').addEventListener('click', async () => {
    const srv = await api('servers:create', { name: $('#sName').value.trim() || 'My Server', version: $('#sVersion').value, memory: mem.value, port: $('#sPort').value, onlineMode: $('#sOnline').checked })
    state.selectedServer = srv.id
    closeModal()
    loadServers()
    toast('Server created — press Start!', 'ok')
  })
})

/* ---------------- Settings ---------------- */
function setRangeFill (el) {
  const p = (el.value - el.min) / (el.max - el.min) * 100
  el.style.setProperty('--p', p + '%')
}
const gb = mb => (mb / 1024).toFixed(1).replace('.0', '') + ' GB'

function renderSettings () {
  const s = state.settings
  const maxMem = Math.max(2048, Math.floor((state.info.totalMem || 16384) / 512) * 512)
  $('#memMax').max = maxMem
  $('#memMin').max = Math.min(8192, maxMem)
  $('#memTotal').textContent = gb(maxMem)
  $('#memMax').value = s.memoryMax
  $('#memMin').value = s.memoryMin
  $('#memMaxLabel').textContent = gb(s.memoryMax)
  $('#memMinLabel').textContent = gb(s.memoryMin)
  setRangeFill($('#memMax')); setRangeFill($('#memMin'))
  $('#resW').value = s.width
  $('#resH').value = s.height
  $('#fullscreen').checked = s.fullscreen
  $('#closeOnLaunch').checked = s.closeOnLaunch
  $('#xionPack').checked = s.xionPack !== false
  $('#xionPackPvp').checked = s.xionPackPvp !== false
  $('#javaPath').value = s.javaPath || ''
  $('#jvmArgs').value = s.jvmArgs || ''
  $('#showSnapshots').checked = s.showSnapshots
  $('#showOld').checked = s.showOld
  $('#gameRoot').value = s.gameRoot
}

let saveTmr
function saveSettings (patch) {
  Object.assign(state.settings, patch)
  clearTimeout(saveTmr)
  saveTmr = setTimeout(() => xion.call('settings:save', state.settings), 300)
}
$('#memMax').addEventListener('input', e => {
  const v = +e.target.value
  $('#memMaxLabel').textContent = gb(v); setRangeFill(e.target)
  const patch = { memoryMax: v }
  if (state.settings.memoryMin > v) { patch.memoryMin = v; $('#memMin').value = v; $('#memMinLabel').textContent = gb(v); setRangeFill($('#memMin')) }
  saveSettings(patch)
})
$('#memMin').addEventListener('input', e => {
  let v = +e.target.value
  if (v > state.settings.memoryMax) { v = state.settings.memoryMax; e.target.value = v }
  $('#memMinLabel').textContent = gb(v); setRangeFill(e.target)
  saveSettings({ memoryMin: v })
})
$('#resW').addEventListener('change', e => saveSettings({ width: Math.max(640, +e.target.value || 1280) }))
$('#resH').addEventListener('change', e => saveSettings({ height: Math.max(480, +e.target.value || 720) }))
;['fullscreen', 'closeOnLaunch', 'showSnapshots', 'showOld', 'xionPack', 'xionPackPvp'].forEach(k => $('#' + k).addEventListener('change', e => saveSettings({ [k]: e.target.checked })))
$('#javaPath').addEventListener('change', e => saveSettings({ javaPath: e.target.value.trim() }))
$('#jvmArgs').addEventListener('change', e => saveSettings({ jvmArgs: e.target.value.trim() }))
$('#pickJava').addEventListener('click', async () => { const p = await api('settings:pickJava'); if (p) { $('#javaPath').value = p; saveSettings({ javaPath: p }) } })
$('#pickRoot').addEventListener('click', async () => { const p = await api('settings:pickDir'); if (p) { $('#gameRoot').value = p; saveSettings({ gameRoot: p }) } })
$('#openRoot').addEventListener('click', () => xion.call('settings:openRoot'))

/* ---------------- Mods (Modrinth browser) ---------------- */
const modsState = { query: '', offset: 0, total: 0, hits: [], installed: new Set(), busy: new Set(), profile: null, loaded: false, cat: '' }
const MOD_CATS = [['', 'Popular'], ['optimization', 'Performance'], ['utility', 'Utility'], ['decoration', 'Decoration'], ['adventure', 'Adventure'], ['storage', 'Storage'], ['technology', 'Technology'], ['magic', 'Magic']]
const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'K' : String(n)

function renderModsProfiles () {
  const sel = $('#modsProfile')
  if (!modsState.profile || !state.profiles.some(p => p.id === modsState.profile)) modsState.profile = state.selectedProfile
  sel.innerHTML = state.profiles.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(versionLabel(p))}</option>`).join('')
  sel.value = modsState.profile
}

async function loadMods (append) {
  if (!append) { modsState.offset = 0; modsState.hits = [] }
  const grid = $('#modsGrid')
  if (!append) grid.innerHTML = Array.from({ length: 8 }, () => '<div class="mod-card skeleton"></div>').join('')
  try {
    const q = [modsState.query, modsState.cat].filter(Boolean).join(' ')
    const [res, installed] = await Promise.all([
      xion.call('modrinth:search', q, modsState.profile, modsState.offset),
      xion.call('modrinth:installed', modsState.profile)
    ])
    modsState.installed = new Set(installed)
    modsState.total = res.total
    modsState.hits.push(...res.hits)
    modsState.offset += res.hits.length
    renderModCards()
  } catch (e) {
    modsState.loaded = false
    grid.innerHTML = `<div class="load-error"><b>Couldn't load mods</b>${esc(cleanErr(e))}<div style="margin-top:14px"><button class="btn ghost" id="modsRetry">Try again</button> <button class="btn ghost" data-page-go="settings">Test connection</button></div></div>`
    $('#modsRetry').addEventListener('click', () => loadMods())
  }
}

function renderModCards () {
  $('#modsGrid').innerHTML = modsState.hits.length ? modsState.hits.map(m => {
    const inst = modsState.installed.has(m.id)
    const busy = modsState.busy.has(m.id)
    return `<div class="mod-card">
      <div class="mc-top">
        ${m.icon ? `<img src="${esc(m.icon)}" alt="">` : `<div class="mc-ph">${esc(m.title[0] || '?')}</div>`}
        <div class="grow"><b>${esc(m.title)}</b><small>by ${esc(m.author)} · ${fmtNum(m.downloads)} downloads</small></div>
      </div>
      <p>${esc(m.description)}</p>
      <div class="mc-foot">
        <div class="mc-tags">${m.categories.slice(0, 3).map(c => `<span>${esc(c)}</span>`).join('')}</div>
        <button class="btn ${inst ? 'ghost' : 'primary'} sm" data-modinstall="${esc(m.id)}" ${busy ? 'disabled' : ''}>${busy ? '<span class="spinner"></span>' : inst ? 'Installed ✓' : 'Install'}</button>
      </div>
    </div>`
  }).join('') : '<div class="muted" style="padding:30px">No mods found for this version.</div>'
  $('#modsMore').style.display = modsState.offset < modsState.total ? '' : 'none'
}

function initMods () {
  renderModsProfiles()
  if (!$('#modsChips').childElementCount) {
    $('#modsChips').innerHTML = MOD_CATS.map(([id, n]) => `<button data-mcat="${id}" class="${id === modsState.cat ? 'on' : ''}">${n}</button>`).join('')
  }
  if (!modsState.loaded) { modsState.loaded = true; loadMods() }
}

let modsTimer
$('#modsQuery').addEventListener('input', e => {
  clearTimeout(modsTimer)
  modsTimer = setTimeout(() => { modsState.query = e.target.value.trim(); loadMods() }, 350)
})
$('#modsChips').addEventListener('click', e => {
  const b = e.target.closest('[data-mcat]')
  if (!b) return
  modsState.cat = b.dataset.mcat
  $$('#modsChips button').forEach(x => x.classList.toggle('on', x === b))
  loadMods()
})
$('#modsProfile').addEventListener('change', e => { modsState.profile = e.target.value; loadMods() })
$('#modsMore').addEventListener('click', () => loadMods(true))
$('#modsGrid').addEventListener('click', async e => {
  const b = e.target.closest('[data-modinstall]')
  if (!b) return
  const id = b.dataset.modinstall
  const mod = modsState.hits.find(m => m.id === id)
  modsState.busy.add(id)
  renderModCards()
  try {
    if (modsState.installed.has(id)) {
      await api('modrinth:uninstall', modsState.profile, id)
      modsState.installed.delete(id)
      toast(`Removed ${mod.title}`)
    } else {
      await api('modrinth:install', modsState.profile, id)
      modsState.installed.add(id)
      toast(`${mod.title} installed`, 'ok')
    }
  } catch {} finally {
    modsState.busy.delete(id)
    renderModCards()
  }
})

/* ---------------- Player profile ---------------- */
const player = { viewer: null, skin: null, slim: false, anim: 'idle', loading: false }

function fmtTime (secs) {
  if (!secs) return '0m'
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return h ? `${h}h ${m}m` : `${m}m`
}

function ensureViewer () {
  if (player.viewer || typeof skinview3d === 'undefined') return player.viewer
  const canvas = $('#skinCanvas')
  const stage = $('.stage')
  player.viewer = new skinview3d.SkinViewer({ canvas, width: stage.clientWidth, height: stage.clientHeight })
  player.viewer.autoRotate = true
  player.viewer.autoRotateSpeed = 0.6
  player.viewer.zoom = 0.5
  player.viewer.fov = 40
  player.viewer.globalLight.intensity = 2.4
  player.viewer.cameraLight.intensity = 0.9
  new ResizeObserver(() => player.viewer && player.viewer.setSize(stage.clientWidth, stage.clientHeight)).observe(stage)
  // floating particles
  $('#stageParticles').innerHTML = Array.from({ length: 22 }, (_, i) =>
    `<i style="left:${(i * 47) % 100}%;animation-delay:${(i * 0.37) % 6}s;animation-duration:${5 + (i % 5)}s"></i>`).join('')
  setAnim(player.anim)
  return player.viewer
}

function setAnim (name) {
  player.anim = name
  const v = player.viewer
  if (!v) return
  const A = skinview3d
  const map = { idle: A.IdleAnimation, walk: A.WalkingAnimation, run: A.RunningAnimation, wave: A.WaveAnimation, fly: A.FlyingAnimation }
  const C = map[name] || A.IdleAnimation
  v.animation = C ? new C() : null
  $$('#animPick button').forEach(b => b.classList.toggle('on', b.dataset.anim === name))
  if (player.capesReady) previewCape()
}

// ---------- Launcher updates ----------
// Installed copies download new versions by themselves; the pill offers a restart once it's ready.
function showUpdate (u) {
  const pill = $('#updatePill')
  pill.hidden = !['downloading', 'ready', 'portable'].includes(u.state)
  pill.classList.toggle('busy', u.state === 'downloading')
  if (u.state === 'downloading') pill.innerHTML = `<i></i>Downloading update${u.percent ? ' ' + u.percent + '%' : ''}…`
  else if (u.state === 'ready') pill.innerHTML = '<i></i>Restart to update'
  else if (u.state === 'portable') pill.innerHTML = '<i></i>Update available'
  pill.title = u.latest ? `Xion Launcher ${u.latest}` + (u.state === 'portable' ? ' is out. Click to download it.' : ' is ready. Click to restart and install it.') : ''
  pill.dataset.state = u.state
  pill.dataset.url = u.url || ''
}
xion.on('update:state', showUpdate)
xion.call('update:get').then(showUpdate).catch(() => {})
$('#updatePill').addEventListener('click', async () => {
  const pill = $('#updatePill')
  if (pill.dataset.state === 'portable') window.open(pill.dataset.url)
  else if (pill.dataset.state === 'ready') await api('update:install')
})

// ---------- Capes (Skin page) ----------
const capes = { list: [], selected: '', premium: false, cat: 'All', timer: null }
const capeFile = (c, f = 0) => c.src || '../assets/capes/' + (c.frames > 1 ? `${c.id}_${f}` : c.id) + '.png'

async function loadCapes () {
  try {
    const r = await xion.call('cosmetics:list')
    Object.assign(capes, { list: r.capes, selected: r.selected, premium: r.premium })
  } catch { return }
  player.capesReady = true
  renderCapes()
  previewCape()
}

function renderCapes () {
  const cats = ['All', 'Free', ...new Set(capes.list.map(c => c.cat))]
  $('#capeCats').innerHTML = cats.map(c => `<button data-cat="${c}" class="${c === capes.cat ? 'on' : ''}">${c}</button>`).join('')
  const shown = capes.list.filter(c => capes.cat === 'All' || (capes.cat === 'Free' ? c.tier === 'free' : c.cat === capes.cat))
  $('#capeGrid').innerHTML = `<button class="cape none ${capes.selected ? '' : 'on'}" data-cape="" title="No cape">none</button>` + shown.map(c => {
    const locked = c.tier === 'pro' && !capes.premium
    return `<button class="cape ${c.tier} ${locked ? 'locked' : ''} ${c.id === capes.selected ? 'on' : ''}" data-cape="${c.id}" title="${esc(c.name)}${c.tier === 'pro' ? ' · Xion+' : ''}" style="background-image:url('${capeFile(c)}')">${c.frames > 1 ? '<i class="anim"></i>' : ''}</button>`
  }).join('')
  const cur = capes.list.find(c => c.id === capes.selected)
  $('#capeName').textContent = cur ? cur.name : 'No cape'
  $('#capeRemoveOwn').hidden = !capes.list.some(c => c.cat === 'Custom')
}

// Shows the picked cape on the 3D model; animated capes cycle their frames, Fly shows it as elytra.
function previewCape () {
  const v = player.viewer
  clearInterval(capes.timer)
  if (!v) return
  const c = capes.list.find(x => x.id === capes.selected)
  const opts = () => ({ backEquipment: player.anim === 'fly' ? 'elytra' : 'cape' })
  if (!c) { v.loadCape(null); return }
  let f = 0
  v.loadCape(capeFile(c), opts())
  if (c.frames > 1) capes.timer = setInterval(() => { if (document.body.dataset.page !== 'player') return; f = (f + 1) % c.frames; v.loadCape(capeFile(c, f), opts()) }, 140)
}

$('#capeCats').addEventListener('click', e => {
  const b = e.target.closest('[data-cat]')
  if (!b) return
  capes.cat = b.dataset.cat
  renderCapes()
})
$('#capeGrid').addEventListener('click', async e => {
  const b = e.target.closest('[data-cape]')
  if (!b) return
  const c = capes.list.find(x => x.id === b.dataset.cape)
  if (c && c.tier === 'pro' && !capes.premium) {
    toast(`${c.name} is a Xion+ cape. Add a license key to unlock all ${capes.list.length} capes.`)
    go('settings')
    setTimeout(() => $('#premiumCard').scrollIntoView({ behavior: 'smooth', block: 'center' }), 250)
    return
  }
  try {
    capes.selected = await xion.call('cosmetics:set', c ? c.id : '')
    renderCapes()
    previewCape()
    toast(c ? `${c.name} equipped. It shows next time you start the game.` : 'Cape removed', 'ok')
  } catch (err) { toast(cleanErr(err), 'err') }
})
// Your own cape (Xion+). A cape texture (2:1, e.g. 64x32) is scaled to the 256x128 HD layout with crisp pixels;
// any other picture is cropped onto the outside of the cape and the elytra wings.
function drawOwnCape (img) {
  const W = 256, H = 128
  const cv = document.createElement('canvas')
  cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const w = img.naturalWidth, h = img.naturalHeight
  if (Math.abs(w / h - 2) < 0.02) {
    g.imageSmoothingEnabled = w > W
    g.drawImage(img, 0, 0, W, H)
    return cv.toDataURL('image/png')
  }
  // Average colour for the cape's sides and inside.
  const s = document.createElement('canvas').getContext('2d')
  s.canvas.width = s.canvas.height = 1
  s.drawImage(img, 0, 0, 1, 1)
  const [r, gr, b] = s.getImageData(0, 0, 1, 1).data
  g.fillStyle = `rgb(${r * 0.6 | 0},${gr * 0.6 | 0},${b * 0.6 | 0})`
  g.fillRect(0, 0, W, H)
  const cover = (x, y, dw, dh) => {
    const k = Math.max(dw / w, dh / h)
    const sw = dw / k, sh = dh / k
    g.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh, x, y, dw, dh)
  }
  g.imageSmoothingEnabled = true
  cover(4, 4, 40, 64) // outside of the cape
  cover(96, 8, 40, 80) // elytra wing, outside (the other wing is mirrored from it)
  cover(144, 8, 40, 80) // elytra wing, inside
  return cv.toDataURL('image/png')
}

$('#capeUpload').addEventListener('click', () => {
  if (!capes.premium) { toast('Uploading your own cape is a Xion+ feature. Add a license key in Settings to unlock it.'); return }
  $('#capeFile').click()
})
$('#capeFile').addEventListener('change', async e => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  if (file.size > 8 * 1024 * 1024) { toast('That image is too big (8 MB max).', 'err'); return }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('That file is not an image.')); img.src = url })
    if (img.naturalWidth < 16 || img.naturalHeight < 8) throw new Error('That image is too small.')
    capes.selected = await xion.call('cosmetics:upload', drawOwnCape(img))
    await loadCapes()
    toast('Your cape is equipped. It shows next time you start the game.', 'ok')
  } catch (err) {
    toast(/PREMIUM/.test(err.message) ? 'Uploading your own cape needs Xion+.' : cleanErr(err), 'err')
  } finally { URL.revokeObjectURL(url) }
})
$('#capeRemoveOwn').addEventListener('click', async () => {
  capes.selected = await xion.call('cosmetics:removeCustom')
  await loadCapes()
  toast('Your own cape was removed', 'ok')
})

// Hovering an animated cape plays it.
$('#capeGrid').addEventListener('mouseover', e => {
  const b = e.target.closest('.cape[data-cape]')
  const c = b && capes.list.find(x => x.id === b.dataset.cape)
  if (!c || c.frames < 2 || b.dataset.playing) return
  b.dataset.playing = '1'
  let f = 0
  const iv = setInterval(() => { f = (f + 1) % c.frames; b.style.backgroundImage = `url('${capeFile(c, f)}')` }, 140)
  b.addEventListener('mouseleave', () => { clearInterval(iv); delete b.dataset.playing; b.style.backgroundImage = `url('${capeFile(c)}')` }, { once: true })
})

async function initPlayer () {
  const acc = activeAccount()
  const v = ensureViewer()
  if (v) v.renderPaused = false
  const name = acc ? acc.name : 'Guest'
  $('#ppName').textContent = name
  $('#tagName').textContent = name
  $('#ppType').textContent = acc ? (acc.type === 'microsoft' ? 'Microsoft account' : 'Offline account') : 'Not signed in'
  $('#ppType').className = 'pill ' + (acc && acc.type === 'microsoft' ? 'ms' : '')
  const total = state.profiles.reduce((t, p) => t + (p.playtime || 0), 0)
  const launches = state.profiles.reduce((t, p) => t + (p.launches || 0), 0)
  const last = state.profiles.filter(p => p.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed)[0]
  $('#ppStats').innerHTML = [
    ['Playtime', fmtTime(total)],
    ['Launches', launches],
    ['Profiles', state.profiles.length],
    ['Last played', last ? esc(last.name) : '—']
  ].map(([k, val]) => `<div class="stat"><small>${k}</small><b>${val}</b></div>`).join('')
  $('#skinNote').textContent = !acc ? 'Add an account to set a skin.'
    : acc.type === 'microsoft' ? 'Uploads go straight to your Minecraft account — everyone sees them on every server.'
      : 'Offline skin: applied by Xion Client so you see it in game (others see the default skin).'
  loadCapes()
  $('#skinUpload').disabled = !acc
  $('#skinReset').disabled = !acc
  if (!acc) { applySkin(null, false); return }
  if (player.loading) return
  player.loading = true
  try {
    const s = await xion.call('skin:get')
    applySkin(s.skin, s.slim)
  } catch (e) {
    applySkin(null, false)
    toast(e.message.replace(/^Error invoking remote method '[^']+': /, ''), 'err')
  } finally { player.loading = false }
}

function applySkin (dataUrl, slim) {
  player.skin = dataUrl
  player.slim = !!slim
  $$('#skinModel button').forEach(b => b.classList.toggle('on', (b.dataset.slim === '1') === player.slim))
  const v = ensureViewer()
  if (!v) return
  if (dataUrl) v.loadSkin(dataUrl, { model: slim ? 'slim' : 'default' })
  else v.loadSkin(stevePng(), { model: 'default' })
}

// Minimal Steve-coloured placeholder skin generated on a canvas (no bundled Mojang assets).
function stevePng () {
  const c = document.createElement('canvas')
  c.width = 64; c.height = 64
  const x = c.getContext('2d')
  const r = (col, ...rects) => { x.fillStyle = col; rects.forEach(([a, b, w, h]) => x.fillRect(a, b, w, h)) }
  r('#b5835a', [0, 8, 32, 8], [8, 0, 16, 8], [40, 16, 16, 16], [32, 48, 16, 16])     // skin: head, arms
  r('#4a3423', [8, 0, 8, 8], [0, 8, 32, 2])                                            // hair
  r('#2d8fb5', [16, 16, 24, 16], [40, 20, 16, 6], [32, 52, 16, 6])                     // shirt + sleeves
  r('#3b3a8f', [0, 16, 16, 16], [16, 48, 16, 16])                                      // legs
  r('#ffffff', [9, 12, 2, 1], [13, 12, 2, 1]); r('#5a3e9e', [10, 12, 1, 1], [13, 12, 1, 1])
  return c.toDataURL()
}

$('#animPick').addEventListener('click', e => { const b = e.target.closest('[data-anim]'); if (b) setAnim(b.dataset.anim) })
$('#skinModel').addEventListener('click', async e => {
  const b = e.target.closest('[data-slim]')
  if (!b) return
  const slim = b.dataset.slim === '1'
  if (slim === player.slim) return
  applySkin(player.skin, slim)
  if (activeAccount() && activeAccount().type === 'offline') {
    await api('skin:model', slim)
    toast(slim ? 'Slim model saved' : 'Classic model saved', 'ok')
  }
})
$('#skinUpload').addEventListener('click', async () => {
  const file = await api('skin:pick')
  if (!file) return
  const btn = $('#skinUpload')
  btn.disabled = true
  try {
    const r = await api('skin:set', file, player.slim)
    applySkin(r.skin, r.slim)
    heroSkin.refresh(activeAccount())
    toast('Skin updated!', 'ok')
  } catch {} finally { btn.disabled = false }
})
$('#skinReset').addEventListener('click', async () => {
  await api('skin:reset')
  applySkin(null, false)
  toast('Skin reset')
})

/* ---------------- Connection test ---------------- */
$('#netTest').addEventListener('click', async () => {
  const btn = $('#netTest')
  const box = $('#netResults')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span>Testing…'
  box.innerHTML = ''
  try {
    const rows = await xion.call('net:diagnose')
    const tag = r => !r ? '' : r.ok ? `<span class="net-tag ok">${r.ms} ms</span>` : `<span class="net-tag bad" title="${esc(r.error)}">failed</span>`
    box.innerHTML = '<div class="net-row"><small>Service</small><small>Chromium</small><small>Node</small></div>' + rows.map(r => `
      <div class="net-row"><div><b>${esc(r.name)}</b><small>${esc(r.host)}${!r.node.ok && r.node.error ? ' — ' + esc(r.node.error) : ''}</small></div>${tag(r.chromium)}${tag(r.node)}</div>`).join('')
    const bad = rows.filter(r => !(r.chromium && r.chromium.ok) && !r.node.ok)
    toast(bad.length ? `Can't reach: ${bad.map(r => r.name).join(', ')}. Check firewall/antivirus/VPN.` : 'All services reachable', bad.length ? 'err' : 'ok')
  } catch (e) {
    box.innerHTML = `<div class="net-row"><div><b>Test failed</b><small>${esc(cleanErr(e))}</small></div></div>`
  } finally {
    btn.disabled = false
    btn.textContent = 'Test connection'
  }
})
document.addEventListener('click', e => {
  const g = e.target.closest('[data-page-go]')
  if (g) go(g.dataset.pageGo)
})
$('#newsAll').addEventListener('click', () => xion.call('open:external', 'https://www.minecraft.net/en-us/articles'))

/* ---------------- Boot ---------------- */
/* ---------------- Themes + Xion Premium ---------------- */
const themeState = { themes: [], current: 'nightfall', premium: false, owner: null }
const PREMIUM_URL = 'https://anisbabu.github.io/xion-launcher/#premium'

// Applies a theme to the whole launcher: palette variables + backdrop layers, with a quick crossfade.
function applyTheme (id, animate) {
  const t = themeState.themes.find(x => x.id === id) || themeState.themes[0]
  if (!t) return
  const root = document.documentElement
  const set = () => {
    root.style.setProperty('--accent', t.accent)
    root.style.setProperty('--accent-2', t.accent2)
    root.style.setProperty('--bg', t.bg)
    for (const l of ['sky', 'far', 'mid', 'near', 'front', 'fog']) root.style.setProperty('--img-' + l, `url(bg/${t.id}/${l}.webp)`)
    root.style.setProperty('--img-full', `url(bg/${t.id}/full.jpg)`)
    root.dataset.theme = t.id
  }
  const scene = $('#scene')
  if (!animate || !scene) return set()
  scene.classList.add('swap')
  setTimeout(() => { set(); requestAnimationFrame(() => scene.classList.remove('swap')) }, 420)
}

function renderThemes () {
  $('#themeGrid').innerHTML = themeState.themes.map(t => {
    const locked = t.premium && !themeState.premium
    const tag = t.id === themeState.current ? '<span class="t-tag cur">IN USE</span>' : locked ? '<span class="t-tag lock">XION+</span>' : ''
    return `<button class="theme ${t.id === themeState.current ? 'on' : ''} ${locked ? 'locked' : ''}" data-theme="${t.id}" style="--t-accent:${t.accent};background-image:url(bg/${t.id}/full.jpg)">
      ${tag}<span class="t-meta"><span><b>${esc(t.name)}</b><small>${esc(t.blurb)}</small></span><span class="t-dots"><i style="background:${t.accent}"></i><i style="background:${t.accent2}"></i></span></span>
    </button>`
  }).join('')
}

function renderPremium () {
  $('#premiumCard').classList.toggle('active', themeState.premium)
  if (!themeState.premium) return
  $('#premiumTitle').textContent = 'Xion Premium is active'
  $('#premiumText').textContent = 'Thank you for supporting Xion! Everything below is unlocked in the launcher and in game.'
  $('#premiumActions').innerHTML = `<div class="premium-owner">Licensed to <b>${esc(themeState.owner || 'you')}</b></div><button class="btn ghost sm" id="removeKey">Remove key</button>`
}

function renderPerf () {
  const cur = state.settings.perfMode || 'boost'
  const shown = cur === 'turbo' && !themeState.premium ? 'boost' : cur
  document.querySelectorAll('#perfGrid [data-perf]').forEach(b => {
    b.classList.toggle('on', b.dataset.perf === shown)
    b.classList.toggle('locked', b.dataset.perf === 'turbo' && !themeState.premium)
  })
}
$('#perfGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-perf]')
  if (!b) return
  const m = b.dataset.perf
  if (m === 'turbo' && !themeState.premium) {
    toast('Turbo is part of Xion Premium. Add a license key below to unlock it.')
    $('#premiumCard').scrollIntoView({ behavior: 'smooth', block: 'center' })
    return
  }
  saveSettings({ perfMode: m })
  renderPerf()
  toast(m === 'off' ? 'Performance preset off.' : (m === 'turbo' ? 'Turbo' : 'Boost') + ' mode set. It applies on next launch.', 'ok')
})

async function loadThemes () {
  const lic = await xion.call('license:status')
  const list = await xion.call('themes:list')
  if ($('#deviceId')) $('#deviceId').textContent = lic.device || ''
  Object.assign(themeState, list, { owner: lic.premium ? lic.name : null })
  state.settings.theme = list.current
  applyTheme(list.current, false)
  renderThemes()
  renderPremium()
  renderPerf()
}

$('#themeGrid').addEventListener('click', async e => {
  const b = e.target.closest('[data-theme]')
  if (!b) return
  const t = themeState.themes.find(x => x.id === b.dataset.theme)
  if (t.premium && !themeState.premium) {
    toast(`${t.name} is a Xion Premium theme. Add a license key below to unlock it.`)
    $('#premiumCard').scrollIntoView({ behavior: 'smooth', block: 'center' })
    if ($('#licenseKey')) $('#licenseKey').focus()
    return
  }
  if (t.id === themeState.current) return
  await api('themes:set', t.id)
  themeState.current = t.id
  state.settings.theme = t.id
  applyTheme(t.id, true)
  renderThemes()
  toast(`${t.name} theme applied. The game picks it up on next launch.`, 'ok')
})
$('#premiumCard').addEventListener('click', async e => {
  if (e.target.id === 'buyPremium') return xion.call('open:external', PREMIUM_URL)
  if (e.target.id === 'copyDevice') { navigator.clipboard.writeText($('#deviceId').textContent).then(() => toast('Device ID copied', 'ok'), () => {}); return }
  if (e.target.id === 'removeKey') {
    await api('license:remove')
    state.settings.licenseKey = ''
    location.reload()
    return
  }
  if (e.target.id !== 'activateKey') return
  const key = $('#licenseKey').value.trim()
  if (!key) return toast('Paste your license key first.', 'err')
  try {
    const r = await xion.call('license:activate', key)
    state.settings.licenseKey = key
    await loadThemes()
    toast(`Xion Premium unlocked. Welcome, ${r.name || 'friend'}!`, 'ok')
  } catch (err) {
    toast(err.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err')
  }
})

async function boot () {
  const [st, info, catalog] = await Promise.all([xion.call('state:get'), xion.call('app:info'), xion.call('mods:catalog')])
  Object.assign(state, st)
  state.info = info
  state.catalog = catalog
  if ($('#appVersion')) $('#appVersion').textContent = 'v' + info.version
  renderAccounts()
  renderProfiles()
  renderSettings()
  renderFeatured()
  loadThemes().catch(e => console.error(e))
  loadNews()
  setTimeout(() => $('#splash').classList.add('gone'), 700)
  // First start: the welcome intro (intro.js) takes over.
  window.dispatchEvent(new CustomEvent('xion:booted'))
  setTimeout(moveInk, 50)
  if (document.fonts) document.fonts.ready.then(moveInk)
  document.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter' && !$('#modalBack').classList.contains('open')) launch()
  })
  xion.call('versions:vanilla').then(v => { state.vanilla = v; renderProfiles() }).catch(() => {
    $('#launchSub').textContent = 'Offline — version list unavailable'
  })
}
boot()
