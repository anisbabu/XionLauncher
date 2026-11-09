// Xion Store inside the launcher: shop with a live 3D try-on stage, item analysis, cart + checkout,
// orders with chat, the locker (equip what you own) and the store admin panel (approve purchases).
// Talks to the store API through the main process (window.xion.call('cos:api', ...)).
import { Dresser, ASSETS, DEFAULT_SKIN } from './cosmetics3d.js'

const $ = (s, r = document) => r.querySelector(s)
const $$ = (s, r = document) => [...r.querySelectorAll(s)]
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const SKIN_API = 'https://xion-launcher.vercel.app/api/cosmetics?r=skin&name='
const IGN = /^[A-Za-z0-9_]{3,16}$/
const SLOTS = ['cape', 'hat', 'wings', 'aura']
const SLOT_NAME = { cape: 'Capes', hat: 'Hats', wings: 'Wings', aura: 'Auras' }
const RARITY_RANK = { common: 1, rare: 2, epic: 3, legendary: 4 }
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='
const METHOD_INFO = { bkash: ['bKash', 'Send Money'], nagad: ['Nagad', 'Send Money'], upi: ['UPI', 'Any UPI app'], card: ['Card', 'Visa / Mastercard'] }

const keep = {
  get: (k, d) => { try { const v = localStorage.getItem('xstore.' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('xstore.' + k, JSON.stringify(v)) } catch {} }
}
const api = (route, body, token) => window.xion.call('cos:api', route, body || null, token || '')
const say = (msg, type) => (typeof window.toast === 'function' ? window.toast(msg, type) : console.log(msg))
const me = () => { try { const a = window.activeAccount && window.activeAccount(); return a && IGN.test(a.name) ? a.name : '' } catch { return '' } }

// ───────── state ─────────
const S = {
  cfg: null,
  wear: { players: {} },
  cur: keep.get('cur', 'USD'),
  cart: keep.get('cart', []),
  orders: keep.get('orders', []),
  keys: keep.get('keys', {}), // lowercase ign → locker key
  code: '',
  thumbs: {},
  tab: 'shop',
  filter: 'all',
  set: '',
  sort: 'featured',
  q: '',
  selected: null, // item or bundle being analysed
  look: {}, // what the stage wears
  locker: null,
  admin: sessionStorage.getItem('xstore.admin') || ''
}
const byId = id => S.cfg && (S.cfg.items.find(i => i.id === id) || S.cfg.bundles.find(b => b.id === id))
const itemsOf = b => b.items.map(byId).filter(Boolean)
const lookOf = items => { const l = {}; for (const it of items) if (it && it.type && !l[it.type]) l[it.type] = it; return l }
const animated = it => it.frames > 1 || !!it.animated
const fmt = (v, cur = S.cur) => (S.cfg ? S.cfg.symbols[cur] : '') + (cur === 'USD' ? Number(v).toFixed(2) : Math.round(v).toLocaleString())
const setName = id => (S.cfg.bundles.find(b => b.set === id) || {}).name || id
const bundleSum = (b, cur = S.cur) => itemsOf(b).reduce((s, it) => s + it.price[cur], 0)
const wearers = id => Object.values(S.wear.players || {}).filter(p => SLOTS.some(s => p[s] === id)).length
const thumb = id => `<img data-thumb="${id}" src="${S.thumbs[id] || BLANK}" alt="">${S.thumbs[id] ? '' : '<i class="xs-shimmer"></i>'}`
const capeSrc = it => `${ASSETS}capes/${it.frames > 1 ? it.id + '_0' : it.id}.png`

// ───────── 3D ─────────
let stage, thumbDresser
function makeStage () {
  const canvas = $('#xsCanvas')
  const box = canvas.parentElement.getBoundingClientRect()
  stage = new Dresser({ canvas, width: box.width || 380, height: box.height || 520, animation: 'walk', rotate: keep.get('spin', true), zoom: 0.72, skin: DEFAULT_SKIN })
  new ResizeObserver(() => { const r = canvas.parentElement.getBoundingClientRect(); if (r.width && r.height) stage.viewer.setSize(r.width, r.height) }).observe(canvas.parentElement)
  loadSkin()
}
// The skin the launcher already knows (Microsoft profile or the offline account's own skin) wins;
// otherwise the Mojang skin for that name, otherwise Steve.
async function loadSkin () {
  const n = me()
  if (stage) {
    let local = null
    try { local = n ? await window.xion.call('skin:get') : null } catch {}
    if (local && local.skin && local.name === n) stage.viewer.loadSkin(local.skin, { model: local.slim ? 'slim' : 'default' })
    else stage.setSkin(n ? SKIN_API + encodeURIComponent(n) : DEFAULT_SKIN)
  }
  const tag = $('#xsStageName')
  if (tag) tag.textContent = n || 'Guest'
}
function wearStage (look, turn) {
  S.look = look
  if (!stage) return
  stage.wear(look)
  if (turn !== undefined) { stage.viewer.autoRotate = false; stage.viewer.playerWrapper.rotation.y = turn; $('#xsSpin').classList.remove('on') }
  const parts = SLOTS.filter(s => look[s]).map(s => look[s].name)
  $('#xsWearing').innerHTML = parts.length ? parts.map(p => `<span>${esc(p)}</span>`).join('') : '<span class="none">Nothing equipped</span>'
}
const turnFor = it => (it && (it.type === 'cape' || it.type === 'wings')) ? Math.PI + 0.5 : 0.35

// Capes get a flat tilted "cloak card" of their back face; everything else is a real 3D render.
async function capeCard (it) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = capeSrc(it) })
  const c = document.createElement('canvas'); c.width = 300; c.height = 330
  const g = c.getContext('2d')
  g.imageSmoothingEnabled = false
  const w = 140, h = 224, x = 80, y = 52
  g.setTransform(1, -0.12, 0, 1, 0, 18)
  g.fillStyle = 'rgba(0,0,0,.45)'; g.filter = 'blur(10px)'; g.fillRect(x + 14, y + 16, w, h); g.filter = 'none'
  g.drawImage(img, 0, 4, 4, 64, x - 10, y, 10, h)
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(x - 10, y, 10, h)
  g.drawImage(img, 4, 4, 40, 64, x, y, w, h)
  const sheen = g.createLinearGradient(x, y, x + w, y + h)
  sheen.addColorStop(0, 'rgba(255,255,255,.18)'); sheen.addColorStop(0.45, 'rgba(255,255,255,0)'); sheen.addColorStop(1, 'rgba(0,0,0,.18)')
  g.fillStyle = sheen; g.fillRect(x, y, w, h)
  return c.toDataURL('image/png')
}
const ANGLE = { cape: Math.PI + 0.45, wings: Math.PI + 0.15, hat: 0.5, aura: 0.45 }
const FRAME = { cape: { zoom: 1.2, y: 0 }, wings: { zoom: 1.0, y: -3 }, hat: { zoom: 1.5, y: -16 }, aura: { zoom: 0.85, y: 0 } }
async function makeThumbs () {
  const canvas = document.createElement('canvas')
  thumbDresser = new Dresser({ canvas, width: 300, height: 330, thumbnail: true, animation: false, zoom: 0.9, skin: DEFAULT_SKIN })
  await new Promise(r => setTimeout(r, 300))
  for (const it of S.cfg.items) {
    try { S.thumbs[it.id] = it.type === 'cape' ? await capeCard(it) : await thumbDresser.snapshot(lookOf([it]), ANGLE[it.type], FRAME[it.type]) } catch { S.thumbs[it.id] = BLANK }
    $$(`img[data-thumb="${it.id}"]`).forEach(img => { img.src = S.thumbs[it.id]; const n = img.nextElementSibling; if (n && n.classList.contains('xs-shimmer')) n.remove() })
    await new Promise(r => setTimeout(r, 0))
  }
  thumbDresser.dispose()
}

// ───────── shop ─────────
function shopList () {
  const q = S.q.toLowerCase()
  let list = S.cfg.items.filter(it =>
    (S.filter === 'all' || it.type === S.filter || (S.filter === 'animated' && animated(it))) &&
    (!S.set || it.set === S.set) &&
    (!q || (it.name + ' ' + it.type + ' ' + (it.set ? setName(it.set) : '') + ' ' + it.rarity).toLowerCase().includes(q)))
  if (S.sort === 'price-asc') list = list.slice().sort((a, b) => a.price[S.cur] - b.price[S.cur])
  else if (S.sort === 'price-desc') list = list.slice().sort((a, b) => b.price[S.cur] - a.price[S.cur])
  else if (S.sort === 'rarity') list = list.slice().sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity])
  else if (S.sort === 'popular') list = list.slice().sort((a, b) => wearers(b.id) - wearers(a.id))
  return list
}
function renderShop () {
  const owned = new Set((S.locker && S.locker.owned) || [])
  const showBundles = S.filter === 'all' && !S.q
  $('#xsBundles').classList.toggle('hidden', !showBundles)
  if (showBundles) {
    $('#xsBundleRow').innerHTML = S.cfg.bundles.filter(b => !S.set || b.set === S.set).map(b => {
      const full = bundleSum(b), off = Math.round((1 - b.price[S.cur] / full) * 100)
      return `<article class="xs-bundle ${S.selected === b ? 'sel' : ''}" style="--c:${b.color};--a:${b.accent}" data-pick="${b.id}">
        <span class="xs-btag">${esc(b.tag)}</span><h3>${esc(b.name)}</h3>
        <div class="xs-bthumbs">${b.items.map(id => `<div>${thumb(id)}</div>`).join('')}</div>
        <div class="xs-bfoot"><span class="xs-price"><s>${fmt(full)}</s>${fmt(b.price[S.cur])}</span><span class="xs-save">-${off}%</span></div>
      </article>`
    }).join('')
  }
  const list = shopList()
  $('#xsCount').textContent = `${list.length} item${list.length === 1 ? '' : 's'}`
  $('#xsGrid').innerHTML = list.map((it, n) => `<article class="xs-card r-${it.rarity} ${S.selected === it ? 'sel' : ''}" data-pick="${it.id}" style="animation-delay:${Math.min(n, 24) * 22}ms">
      <div class="xs-thumb">${thumb(it.id)}<span class="xs-rar">${it.rarity}</span>${animated(it) ? '<span class="xs-anim">✦</span>' : ''}${owned.has(it.id) ? '<span class="xs-own">Owned</span>' : ''}</div>
      <b>${esc(it.name)}</b><small>${it.type}${it.set ? ' · ' + esc(setName(it.set)) : ''}</small>
      <div class="xs-row"><span class="xs-price">${fmt(it.price[S.cur])}</span><button class="xs-add ${S.cart.includes(it.id) ? 'in' : ''}" data-add="${it.id}" title="Add to cart">${S.cart.includes(it.id) ? '✓' : '+'}</button></div>
    </article>`).join('') || '<p class="xs-empty">Nothing matches that search.</p>'
}

// The analysis panel: everything about the selected item or bundle.
function renderAnalyze () {
  const box = $('#xsAnalyze')
  const e = S.selected
  if (!e) { box.innerHTML = '<div class="xs-hint"><b>Pick anything</b>Click an item to try it on and see its details. Click more items to mix a full outfit.</div>'; return }
  const owned = new Set((S.locker && S.locker.owned) || [])
  const inCart = S.cart.includes(e.id)
  if (e.items) {
    const items = itemsOf(e), full = bundleSum(e), off = Math.round((1 - e.price[S.cur] / full) * 100)
    box.innerHTML = `<div class="xs-an-head"><span class="xs-pill" style="--p:${e.color}">Bundle · ${items.length} items</span><span class="xs-pill">${esc(e.tag)}</span></div>
      <h2 style="color:${e.color}">${esc(e.name)}</h2><p class="xs-desc">${esc(e.desc)}</p>
      <div class="xs-stats">
        <div><small>Bundle price</small><b>${fmt(e.price[S.cur])}</b></div>
        <div><small>Bought one by one</small><b><s>${fmt(full)}</s></b></div>
        <div><small>You save</small><b class="ok">${fmt(full - e.price[S.cur])} · ${off}%</b></div>
        <div><small>Already owned</small><b>${items.filter(i => owned.has(i.id)).length} / ${items.length}</b></div>
      </div>
      <div class="xs-contents">${items.map(it => `<button class="${S.look[it.type] === it ? 'on' : ''}" data-piece="${it.id}"><img src="${S.thumbs[it.id] || BLANK}" alt=""><span>${esc(it.name)}<small>${it.type} · ${it.rarity}</small></span></button>`).join('')}</div>
      <div class="xs-buy"><button class="btn ${inCart ? 'ghost' : 'primary'}" data-add="${e.id}">${inCart ? 'In cart ✓' : 'Add bundle to cart'}</button><button class="btn ghost" data-buynow="${e.id}">Buy now</button></div>`
    return
  }
  const bundle = e.set && S.cfg.bundles.find(b => b.set === e.set)
  const w = wearers(e.id), total = Object.keys(S.wear.players || {}).length
  const sameSlot = S.cfg.items.filter(i => i.type === e.type)
  const priceRank = sameSlot.filter(i => i.price[S.cur] < e.price[S.cur]).length
  box.innerHTML = `<div class="xs-an-head"><span class="xs-pill r-${e.rarity}">${e.rarity}</span><span class="xs-pill">${e.type}</span>${animated(e) ? '<span class="xs-pill">✦ animated</span>' : ''}${owned.has(e.id) ? '<span class="xs-pill ok">Owned</span>' : ''}</div>
    <h2>${esc(e.name)}</h2><p class="xs-desc">${esc(e.desc)}</p>
    <div class="xs-rbar r-${e.rarity}"><i style="width:${RARITY_RANK[e.rarity] * 25}%"></i><span>Rarity ${RARITY_RANK[e.rarity]} / 4</span></div>
    <div class="xs-stats">
      <div><small>Price</small><b>${fmt(e.price[S.cur])}</b></div>
      <div><small>Other currencies</small><b class="sm">${Object.keys(e.price).filter(c => c !== S.cur).map(c => fmt(e.price[c], c)).join(' · ')}</b></div>
      <div><small>Slot</small><b>${e.type === 'wings' ? 'Back (wings)' : e.type === 'hat' ? 'Head' : e.type === 'aura' ? 'Around you' : 'Back (cape)'}</b></div>
      <div><small>Animation</small><b>${e.frames > 1 ? `${e.frames} frames · ${Math.round(1000 / 110)} fps` : e.animated ? 'Live motion' : 'Still'}</b></div>
      <div><small>Collection</small><b>${e.set ? esc(setName(e.set)) : 'Single'}</b></div>
      <div><small>Worn by</small><b>${w} player${w === 1 ? '' : 's'}${total ? ` · ${Math.round(w / total * 100)}%` : ''}</b></div>
      <div><small>Price among ${SLOT_NAME[e.type].toLowerCase()}</small><b>${priceRank === 0 ? 'Cheapest tier' : priceRank >= sameSlot.length - 1 ? 'Top tier' : `Higher than ${priceRank} of ${sameSlot.length}`}</b></div>
      <div><small>In game</small><b>${e.type === 'cape' ? 'Visible in Xion Client' : 'Store &amp; profile preview'}</b></div>
    </div>
    ${bundle ? `<button class="xs-deal" data-pick="${bundle.id}" style="--c:${bundle.color}">Part of <b>${esc(bundle.name)}</b>: get all ${bundle.items.length} for ${fmt(bundle.price[S.cur])} →</button>` : ''}
    <div class="xs-buy">${owned.has(e.id)
      ? `<button class="btn primary" data-equipnow="${e.type}|${e.id}">Equip now</button>`
      : `<button class="btn ${inCart ? 'ghost' : 'primary'}" data-add="${e.id}">${inCart ? 'In cart ✓' : 'Add to cart'}</button><button class="btn ghost" data-buynow="${e.id}">Buy now</button>`}</div>`
}

function pick (id) {
  const e = byId(id)
  if (!e) return
  S.selected = e
  if (e.items) wearStage(lookOf(itemsOf(e)), Math.PI + 0.5)
  else wearStage({ ...S.look, [e.type]: e }, turnFor(e))
  $$('[data-pick]').forEach(el => el.classList.toggle('sel', el.dataset.pick === id))
  renderAnalyze()
}

// ───────── cart + checkout ─────────
function saveCart () { keep.set('cart', S.cart); $('#xsCartCount').textContent = S.cart.length; $('#xsCartCount').classList.toggle('hidden', !S.cart.length); renderShop(); renderAnalyze(); if (!$('#xsCart').classList.contains('hidden')) renderCart() }
function addToCart (id) {
  if (S.cart.includes(id)) { openCart(); return }
  S.cart.push(id)
  saveCart()
  const b = $('#xsCartBtn'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump')
  say(`${byId(id).name} added to cart`, 'ok')
}
function openCart () { renderCart(); show('#xsCart') }
let quote = null, quoteSeq = 0
async function renderCart () {
  const box = $('#xsCartLines')
  if (!S.cart.length) { box.innerHTML = '<div class="xs-empty">Your cart is empty.</div>'; $('#xsCartTotal').textContent = '—'; $('#xsCheckout').disabled = true; quote = null; return }
  const inBundles = new Set(S.cart.map(byId).filter(e => e && e.items).flatMap(b => b.items))
  box.innerHTML = S.cart.map(id => {
    const e = byId(id)
    if (!e) return ''
    const dupe = !e.items && inBundles.has(id)
    return `<div class="xs-cline ${dupe ? 'dupe' : ''}"><img src="${S.thumbs[e.items ? e.items[0] : id] || BLANK}" alt=""><div><b>${esc(e.name)}</b><small>${e.items ? 'Bundle · ' + e.items.length + ' items' : e.type}${dupe ? ' · in a bundle' : ''}</small></div><span>${dupe ? '—' : fmt(e.price[S.cur])}</span><button data-rm="${id}" title="Remove">✕</button></div>`
  }).join('')
  $('#xsCheckout').disabled = true
  const seq = ++quoteSeq
  try {
    const q = await api('shop', { action: 'quote', cart: S.cart, currency: S.cur, code: S.code })
    if (seq !== quoteSeq) return
    quote = q
    $('#xsCartTotal').innerHTML = q.total !== q.subtotal ? `<s>${fmt(q.subtotal)}</s> ${fmt(q.total)}` : fmt(q.total)
    $('#xsCodeNote').textContent = S.code ? (q.code && q.code.invalid ? 'That code is not valid or has been used up.' : q.code ? `Code ${q.code.code} applied${q.code.type === 'free' ? ': free order!' : ` (−${q.code.value}%)`}` : '') : ''
    $('#xsCheckout').disabled = false
  } catch (e) { $('#xsCartTotal').textContent = '—'; $('#xsCodeNote').textContent = e.message }
}

let method = null, shotData = ''
function openCheckout () {
  if (!quote || !S.cart.length) return
  hideAll()
  const f = $('#xsCheckoutForm')
  f.ign.value = f.ign.value || me()
  f.email.value = f.email.value || keep.get('email', '')
  $('#xsSum').innerHTML = quote.lines.map(l => `<div><span>${esc(l.name)}</span><span>${fmt(l.price)}</span></div>`).join('') + `<div class="tot"><span>Total</span><span>${fmt(quote.total)}</span></div>`
  step(1)
  show('#xsCheckoutModal')
}
function step (n) {
  $$('#xsCheckoutModal .xs-step').forEach(s => s.classList.toggle('hidden', +s.dataset.step !== n))
  $$('#xsCheckoutModal .xs-steps span').forEach((s, i) => s.classList.toggle('on', i < n))
}
function renderPay () {
  const free = quote.total === 0
  const ms = S.cfg.methods[S.cur]
  if (!ms.includes(method)) method = ms[0]
  $('#xsMethods').innerHTML = free ? '' : ms.map(m => `<button type="button" class="xs-method ${m === method ? 'on' : ''}" data-method="${m}">${METHOD_INFO[m][0]}<small>${METHOD_INFO[m][1]}</small></button>`).join('')
  $('#xsPayFields').classList.toggle('hidden', free)
  const p = S.cfg.pay
  let box
  if (free) box = 'Your code makes this order <b>free</b>. Just place the order.'
  else if (method === 'card') box = p.cardLink ? `Pay <b class="amt">${fmt(quote.total)}</b> on the card page, then come back with the receipt.<br><button type="button" class="btn ghost" data-ext="${esc(p.cardLink)}">Open card payment ↗</button>` : 'Card payments are not set up yet. Switch currency to use bKash, Nagad or UPI.'
  else {
    const num = p[method]
    box = `Send <b class="amt">${fmt(quote.total)}</b> with ${METHOD_INFO[method][0]} (${METHOD_INFO[method][1]}) to<div class="xs-num">${num ? esc(num) + ` <button type="button" class="btn ghost" data-copy="${esc(num)}">Copy</button>` : 'not set up yet'}</div>${esc(S.cfg.note)}`
  }
  $('#xsPayBox').innerHTML = box
  $('#xsPayerLabel').textContent = method === 'card' ? 'Email or name on the card payment' : method === 'upi' ? 'UPI ID you paid from' : 'Number you paid from'
}
async function readShot (file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url })
    const k = Math.min(1, 1600 / Math.max(img.width, img.height))
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.85)
  } finally { URL.revokeObjectURL(url) }
}
async function placeOrder (ev) {
  ev.preventDefault()
  const f = $('#xsCheckoutForm'), err = $('#xsPayErr'), btn = $('#xsPlace')
  err.textContent = ''
  btn.disabled = true
  btn.textContent = 'Placing…'
  try {
    const r = await api('shop', { action: 'order', cart: S.cart, currency: S.cur, code: S.code, ign: f.ign.value.trim(), email: f.email.value.trim(), method, payer: f.payer.value, trx: f.trx.value, screenshot: shotData })
    S.orders.unshift({ id: r.id, token: r.token, ign: f.ign.value.trim(), at: Date.now() })
    keep.set('orders', S.orders)
    keep.set('email', f.email.value.trim())
    S.cart = []; S.code = ''; $('#xsCode').value = ''; shotData = ''; $('#xsShotName').textContent = 'Choose image…'; f.payer.value = ''; f.trx.value = ''
    saveCart()
    $('#xsViewOrder').onclick = () => { hideAll(); tab('orders'); showOrder(r.id, r.token) }
    step(3)
    renderOrders()
  } catch (x) { err.textContent = x.message } finally { btn.disabled = false; btn.textContent = 'Place order' }
}

// ───────── orders ─────────
const STATUS_TXT = { pending: 'Checking payment', approved: 'Approved', rejected: 'Rejected' }
// Approved orders carry the locker key: remember it so the locker opens by itself.
function learnKey (o) {
  if (o && o.lockerKey && o.ign) {
    const k = o.ign.toLowerCase()
    if (S.keys[k] !== o.lockerKey) { S.keys[k] = o.lockerKey; keep.set('keys', S.keys); if (k === me().toLowerCase()) openLocker(true) }
  }
}
async function renderOrders () {
  const box = $('#xsOrderList')
  if (!S.orders.length) { box.innerHTML = '<div class="xs-empty">No orders from this launcher yet. Everything you buy shows up here.</div>'; return }
  box.innerHTML = '<div class="xs-empty">Loading orders…</div>'
  const rows = await Promise.all(S.orders.slice(0, 30).map(o => api('shop', { action: 'status', id: o.id, token: o.token }).then(d => ({ ...d, token: o.token })).catch(() => null)))
  rows.forEach(learnKey)
  const pending = rows.filter(o => o && o.status === 'pending').length
  $('#xsOrdersBadge').textContent = pending || ''
  $('#xsOrdersBadge').classList.toggle('hidden', !pending)
  box.innerHTML = rows.filter(Boolean).map(o => `<button class="xs-orow" data-order="${o.id}.${o.token}">
      <div><b>${esc(o.lines.map(l => l.name).join(', '))}</b><small>${new Date(o.created).toLocaleString()} · for ${esc(o.ign)}</small></div>
      <b>${fmt(o.amount, o.currency)}</b><span class="xs-badge ${o.status}">${STATUS_TXT[o.status] || o.status}</span></button>`).join('') || '<div class="xs-empty">Your orders could not be loaded. Try again in a moment.</div>'
}
let orderPoll
async function showOrder (id, token) {
  clearInterval(orderPoll)
  const v = $('#xsOrderBody')
  show('#xsOrderModal')
  v.innerHTML = '<div class="xs-empty">Loading…</div>'
  const draw = o => {
    learnKey(o)
    const st = o.status
    v.innerHTML = `<h3>Order for ${esc(o.ign)}</h3><small class="muted">#${o.id} · ${new Date(o.created).toLocaleString()}</small>
      <div class="xs-timeline"><span class="on">Placed</span><span class="${st === 'pending' ? '' : st === 'rejected' ? 'bad' : 'on'}">${st === 'rejected' ? 'Rejected' : 'Payment checked'}</span><span class="${st === 'approved' ? 'on' : ''}">Unlocked</span></div>
      ${o.lockerKey ? `<div class="xs-key"><span>Locker key</span><code>${esc(o.lockerKey)}</code><button class="btn ghost" data-copy="${esc(o.lockerKey)}">Copy</button><button class="btn primary" data-golocker="1">Open locker</button></div>` : ''}
      <ul class="xs-lines">${o.lines.map(l => `<li><span>${esc(l.name)}</span><span>${fmt(l.price, o.currency)}</span></li>`).join('')}<li><b>Total</b><b>${fmt(o.amount, o.currency)}</b></li></ul>
      <div class="xs-chat" id="xsChat">${o.messages.map(m => `<div class="xs-msg ${m.from}">${esc(m.text)}<small>${m.from === 'admin' ? 'Xion Store · ' : m.from === 'buyer' ? 'You · ' : ''}${new Date(m.at).toLocaleString()}</small></div>`).join('')}</div>
      <form class="xs-chatform" id="xsChatForm"><input name="text" maxlength="1000" placeholder="Message the store…" autocomplete="off"><button class="btn primary">Send</button></form>`
    const c = $('#xsChat'); c.scrollTop = c.scrollHeight
    $('#xsChatForm').onsubmit = async ev => {
      ev.preventDefault()
      const t = ev.target.text.value.trim()
      if (!t) return
      try { draw(await api('shop', { action: 'message', id, token, text: t })) } catch (x) { say(x.message, 'err') }
    }
  }
  try {
    draw(await api('shop', { action: 'status', id, token }))
    orderPoll = setInterval(async () => {
      if ($('#xsOrderModal').classList.contains('hidden')) return clearInterval(orderPoll)
      if (document.activeElement && document.activeElement.name === 'text') return
      try { draw(await api('shop', { action: 'status', id, token })) } catch {}
    }, 20000)
  } catch (x) { v.innerHTML = `<p class="xs-err">${esc(x.message)}</p>` }
}

// ───────── locker ─────────
async function openLocker (quiet) {
  const name = me()
  const key = name && S.keys[name.toLowerCase()]
  if (!name) { S.locker = null; renderLocker(); return }
  if (!key) { S.locker = null; renderLocker(); return }
  try {
    S.locker = await api('locker', { action: 'open', name, key })
    renderLocker()
    if (S.tab === 'locker') wearEquipped()
    renderShop(); renderAnalyze()
  } catch (x) {
    S.locker = null
    renderLocker(x.message)
    if (!quiet) say(x.message, 'err')
  }
}
const wearEquipped = () => S.locker && wearStage(Object.fromEntries(SLOTS.filter(s => S.locker.equipped[s]).map(s => [s, byId(S.locker.equipped[s])])), 0.4)
function renderLocker (err) {
  const box = $('#xsLocker')
  const name = me()
  if (!name) { box.innerHTML = '<div class="xs-empty">Sign in to a Minecraft account in the launcher first. Your locker belongs to that name.</div>'; return }
  if (!S.locker) {
    box.innerHTML = `<form class="xs-unlock" id="xsUnlock"><h3>Unlock ${esc(name)}'s locker</h3>
      <p class="muted">Your locker key is on your approved order (it starts with <code>XS-</code>). Orders placed from this launcher fill it in by themselves.</p>
      <input name="key" placeholder="XS-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" value="${esc(S.keys[name.toLowerCase()] || '')}">
      ${err ? `<p class="xs-err">${esc(err)}</p>` : ''}
      <button class="btn primary">Open locker</button></form>`
    $('#xsUnlock').onsubmit = ev => { ev.preventDefault(); const k = ev.target.key.value.trim().toUpperCase(); if (!k) return; S.keys[name.toLowerCase()] = k; keep.set('keys', S.keys); openLocker() }
    return
  }
  const L = S.locker
  const owned = L.owned.map(byId).filter(Boolean)
  const live = !!(S.wear.players || {})[L.name]
  const value = owned.reduce((s, i) => s + i.price[S.cur], 0)
  box.innerHTML = `<div class="xs-lhead">
      <div><h3>${esc(L.display)}'s locker</h3><small class="muted">${owned.length} of ${S.cfg.items.length} cosmetics · collection worth ${fmt(value)}</small></div>
      <span class="xs-live ${live ? 'on' : ''}">${live ? 'Live in game' : 'Nothing worn yet'}</span>
      <button class="btn ghost" data-lockerout="1">Lock</button></div>
    <div class="xs-progress"><i style="width:${Math.round(owned.length / S.cfg.items.length * 100)}%"></i></div>
    ${SLOTS.map(slot => {
      const list = owned.filter(i => i.type === slot)
      const on = L.equipped[slot]
      return `<div class="xs-slot"><h4>${SLOT_NAME[slot]} <small>${list.length}</small></h4><div class="xs-slotlist">
        <button class="xs-sitem none ${on ? '' : 'on'}" data-equip="${slot}|">None</button>
        ${list.map(i => `<button class="xs-sitem r-${i.rarity} ${on === i.id ? 'on' : ''}" data-equip="${slot}|${i.id}" data-hover="${i.id}"><img src="${S.thumbs[i.id] || BLANK}" data-thumb="${i.id}" alt=""><span>${esc(i.name)}</span></button>`).join('')}
        ${list.length ? '' : `<button class="xs-sitem shop" data-shopslot="${slot}">Shop ${SLOT_NAME[slot].toLowerCase()} →</button>`}
      </div></div>`
    }).join('')}
    <p class="muted small">Capes show on your player in game for everyone running Xion Client. Hats, wings and auras show here and on your store profile.</p>`
}
async function equip (slot, item) {
  const name = me(), key = S.keys[name.toLowerCase()]
  try {
    S.locker = await api('locker', { action: 'equip', name, key, slot, item })
    const w = await api('wear', { query: {} }).catch(() => null)
    if (w) S.wear = w
    renderLocker()
    wearEquipped()
    say(item ? `${byId(item).name} equipped. It shows in game within a few minutes.` : `${slot} removed`, 'ok')
  } catch (x) { say(x.message, 'err') }
}

// ───────── admin ─────────
const A = { orders: [], filter: 'pending', tab: 'orders', players: [] }
const adminApi = (action, body) => api('admin', { action, ...(body || {}) }, S.admin).catch(e => { if (/log in again/i.test(e.message)) { S.admin = ''; sessionStorage.removeItem('xstore.admin'); showAdminLogin() } throw e })
function openAdmin () { if (S.admin) { show('#xsAdmin'); adminTab(A.tab) } else showAdminLogin() }
function showAdminLogin () { hide('#xsAdmin'); show('#xsAdminLogin'); setTimeout(() => $('#xsAdminLogin input[name=user]').focus(), 50) }
async function adminLogin (ev) {
  ev.preventDefault()
  const f = ev.target, err = $('#xsAdminErr'), btn = f.querySelector('button[type=submit]')
  err.textContent = ''; btn.disabled = true
  try {
    const r = await api('admin', { action: 'login', user: f.user.value.trim(), pass: f.pass.value })
    S.admin = r.token
    sessionStorage.setItem('xstore.admin', r.token)
    f.pass.value = ''
    hide('#xsAdminLogin')
    $('#xsAdminBtn').classList.add('on')
    openAdmin()
  } catch (x) { err.textContent = x.message } finally { btn.disabled = false }
}
function adminTab (t) {
  A.tab = t
  $$('#xsAdmin [data-atab]').forEach(b => b.classList.toggle('on', b.dataset.atab === t))
  if (t === 'orders') loadAdminOrders()
  else if (t === 'players') renderPlayers()
  else if (t === 'settings') loadAdminSettings()
}
async function loadAdminOrders () {
  const box = $('#xsAdminBody')
  box.innerHTML = '<div class="xs-empty">Loading orders…</div>'
  try { A.orders = (await adminApi('orders')).orders; renderAdminOrders() } catch (x) { box.innerHTML = `<p class="xs-err">${esc(x.message)}</p>` }
}
function renderAdminOrders () {
  const counts = { pending: 0, approved: 0, rejected: 0 }
  A.orders.forEach(o => { counts[o.status] = (counts[o.status] || 0) + 1 })
  const earned = {}
  A.orders.filter(o => o.status === 'approved').forEach(o => { earned[o.currency] = (earned[o.currency] || 0) + o.amount })
  const list = A.orders.filter(o => A.filter === 'all' || o.status === A.filter)
  $('#xsAdminBody').innerHTML = `<div class="xs-astats">
      <div><small>Waiting</small><b class="warn">${counts.pending}</b></div><div><small>Approved</small><b class="ok">${counts.approved}</b></div>
      <div><small>Rejected</small><b>${counts.rejected}</b></div><div><small>Earned</small><b class="sm">${Object.entries(earned).map(([c, v]) => fmt(v, c)).join(' · ') || '—'}</b></div></div>
    <div class="xs-chips">${['pending', 'approved', 'rejected', 'all'].map(f => `<button class="xs-chip ${A.filter === f ? 'on' : ''}" data-afilter="${f}">${f[0].toUpperCase() + f.slice(1)}${f !== 'all' ? ` <small>${counts[f] || 0}</small>` : ''}</button>`).join('')}<button class="xs-chip" data-arefresh="1">↻ Refresh</button></div>
    ${list.map(o => `<article class="xs-aorder ${o.status}" data-aid="${o.id}">
      <header><div><b>${esc(o.ign)}</b> <small class="muted">${esc(o.email)}</small><br><small class="muted">#${o.id} · ${new Date(o.created).toLocaleString()}</small></div>
        <span class="xs-badge ${o.status}">${STATUS_TXT[o.status] || o.status}</span>${o.unread ? '<span class="xs-badge new">New message</span>' : ''}</header>
      <div class="xs-agrid">
        <div><small>Items</small>${o.lines.map(l => `<div>${esc(l.name)} <span class="muted">${fmt(l.price, o.currency)}</span></div>`).join('')}</div>
        <div><small>Payment</small><div><b>${fmt(o.amount, o.currency)}</b> via ${esc(METHOD_INFO[o.method] ? METHOD_INFO[o.method][0] : o.method)}</div>${o.payer ? `<div>From <code>${esc(o.payer)}</code></div>` : ''}${o.trx ? `<div>Trx <code>${esc(o.trx)}</code> <button class="xs-mini" data-copy="${esc(o.trx)}">Copy</button></div>` : ''}${o.code ? `<div>Code <code>${esc(o.code)}</code></div>` : ''}</div>
        <div class="xs-shot">${o.shot ? `<button class="xs-mini" data-shot="${o.id}">Show payment screenshot</button>` : '<span class="muted">No screenshot</span>'}</div>
      </div>
      <details${o.unread ? ' open' : ''}><summary>Messages (${(o.messages || []).length})</summary><div class="xs-chat small">${(o.messages || []).map(m => `<div class="xs-msg ${m.from === 'buyer' ? 'admin' : m.from === 'admin' ? 'buyer' : 'system'}">${esc(m.text)}<small>${m.from} · ${new Date(m.at).toLocaleString()}</small></div>`).join('')}</div>
        <form class="xs-chatform" data-areply="${o.id}"><input name="text" maxlength="1000" placeholder="Reply to ${esc(o.ign)}…" autocomplete="off"><button class="btn ghost">Send</button></form></details>
      <footer>${o.status !== 'approved' ? `<button class="btn primary" data-astatus="${o.id}|approved">Approve &amp; unlock</button>` : ''}${o.status !== 'rejected' ? `<button class="btn ghost bad" data-astatus="${o.id}|rejected">${o.status === 'approved' ? 'Revoke' : 'Reject'}</button>` : ''}${o.status !== 'pending' ? `<button class="btn ghost" data-astatus="${o.id}|pending">Back to waiting</button>` : ''}<button class="xs-mini danger" data-adel="${o.id}">Delete</button></footer>
    </article>`).join('') || `<div class="xs-empty">No ${A.filter === 'all' ? '' : A.filter + ' '}orders.</div>`}`
}
async function adminSetStatus (id, status) {
  const o = A.orders.find(x => x.id === id)
  if (status === 'rejected' && o && o.status === 'approved' && !confirm(`Take the items back from ${o.ign}?`)) return
  try {
    const r = await adminApi('update', { id, status, read: true })
    A.orders = A.orders.map(x => x.id === id ? r.order : x)
    renderAdminOrders()
    say(status === 'approved' ? `Approved. ${r.order.ign} can wear it now.` : status === 'rejected' ? 'Order rejected.' : 'Moved back to waiting.', 'ok')
    loadWear()
  } catch (x) { say(x.message, 'err') }
}
function renderPlayers (p, newKey) {
  const box = $('#xsAdminBody')
  const opts = [...S.cfg.bundles.map(b => `<option value="${b.id}">Bundle · ${esc(b.name)}</option>`), ...S.cfg.items.map(i => `<option value="${i.id}">${esc(i.name)} (${i.type})</option>`)].join('')
  box.innerHTML = `<form class="xs-afind" id="xsFind"><input name="name" placeholder="Minecraft name" value="${p ? esc(p.display) : ''}" autocomplete="off"><button class="btn primary">Find player</button><button type="button" class="btn ghost" data-aplayers="1">All players</button></form>
    <div id="xsPlayerOut">${p ? `<div class="xs-pcard"><h3>${esc(p.display)}</h3><small class="muted">${p.owned.length} owned · since ${new Date(p.created || Date.now()).toLocaleDateString()}</small>
      ${newKey ? `<div class="xs-key"><span>New locker key</span><code>${esc(newKey)}</code><button class="btn ghost" data-copy="${esc(newKey)}">Copy</button></div><p class="muted small">Send this key to the player. It is shown only once.</p>` : ''}
      <div class="xs-owned">${p.owned.map(id => { const i = byId(id); return i ? `<span class="r-${i.rarity}">${esc(i.name)}${SLOTS.some(s => p.equipped[s] === id) ? ' · worn' : ''}</span>` : '' }).join('') || '<span class="muted">Owns nothing yet</span>'}</div>
      <div class="xs-afind"><select id="xsGrantItem">${opts}</select><button class="btn primary" data-agrant="${esc(p.display)}">Give</button><button class="btn ghost bad" data-arevoke="${esc(p.display)}">Take back</button></div>
      <button class="btn ghost" data-areset="${esc(p.display)}">Reset locker key</button></div>` : ''}</div>`
  $('#xsFind').onsubmit = async ev => { ev.preventDefault(); const name = ev.target.name.value.trim(); if (!IGN.test(name)) return say('Enter a Minecraft name', 'err'); try { const r = await adminApi('player', { name }); renderPlayers(r.player) } catch (x) { say(x.message, 'err') } }
}
async function listPlayers () {
  try {
    const r = await adminApi('players')
    $('#xsPlayerOut').innerHTML = `<div class="xs-plist">${r.players.map(p => `<button data-aplayer="${esc(p.display)}"><b>${esc(p.display)}</b><small>${p.owned.length} owned · ${SLOTS.filter(s => p.equipped && p.equipped[s]).length} worn</small></button>`).join('') || '<div class="xs-empty">No players yet.</div>'}</div>`
  } catch (x) { say(x.message, 'err') }
}
async function adminPlayer (action, name) {
  const item = $('#xsGrantItem') && $('#xsGrantItem').value
  if (action === 'resetKey' && !confirm(`Make a new locker key for ${name}? The old key stops working.`)) return
  try { const r = await adminApi(action, { name, item }); renderPlayers(r.player, r.newKey); loadWear(); say(action === 'grant' ? 'Given.' : action === 'revoke' ? 'Taken back.' : 'New key made.', 'ok') } catch (x) { say(x.message, 'err') }
}
async function loadAdminSettings () {
  const box = $('#xsAdminBody')
  box.innerHTML = '<div class="xs-empty">Loading…</div>'
  try {
    const [{ settings: st }, { codes }] = await Promise.all([adminApi('settings'), adminApi('codes')])
    box.innerHTML = `<form class="xs-aform" id="xsSettings"><h3>Where buyers send money</h3>
        <label>bKash number<input name="bkash" value="${esc(st.bkash)}"></label><label>Nagad number<input name="nagad" value="${esc(st.nagad)}"></label>
        <label>UPI ID<input name="upi" value="${esc(st.upi)}"></label><label>Card payment link (https://)<input name="cardLink" value="${esc(st.cardLink)}"></label>
        <label class="wide">Note under the payment details<input name="note" value="${esc(st.note)}"></label><button class="btn primary">Save payment details</button></form>
      <form class="xs-aform" id="xsCodeForm"><h3>Discount codes</h3>
        <label>Code<input name="code" placeholder="HALLOWEEN" autocomplete="off"></label><label>Type<select name="type"><option value="percent">% off</option><option value="free">Free order</option></select></label>
        <label>% off<input name="value" type="number" min="1" max="99" value="20"></label><label>Max uses (0 = no limit)<input name="maxUses" type="number" min="0" value="0"></label><button class="btn primary">Save code</button>
        <div class="xs-codes wide">${codes.map(c => `<span>${esc(c.code)} · ${c.type === 'free' ? 'free' : c.value + '%'} · used ${c.uses || 0}${c.maxUses ? '/' + c.maxUses : ''} <button type="button" class="xs-mini danger" data-adelcode="${esc(c.code)}">✕</button></span>`).join('') || '<span class="muted">No codes yet</span>'}</div></form>`
    $('#xsSettings').onsubmit = async ev => { ev.preventDefault(); try { await adminApi('saveSettings', Object.fromEntries(new FormData(ev.target))); S.cfg = await api('shop'); say('Payment details saved.', 'ok') } catch (x) { say(x.message, 'err') } }
    $('#xsCodeForm').onsubmit = async ev => { ev.preventDefault(); const d = Object.fromEntries(new FormData(ev.target)); try { await adminApi('saveCode', { ...d, active: true }); loadAdminSettings(); say('Code saved.', 'ok') } catch (x) { say(x.message, 'err') } }
  } catch (x) { box.innerHTML = `<p class="xs-err">${esc(x.message)}</p>` }
}

// ───────── layout ─────────
const show = s => $(s).classList.remove('hidden')
const hide = s => $(s).classList.add('hidden')
const hideAll = () => $$('#page-store .xs-layer').forEach(m => m.classList.add('hidden'))
function tab (t) {
  S.tab = t
  $$('#page-store [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === t))
  $$('#page-store .xs-view').forEach(v => v.classList.toggle('hidden', v.dataset.view !== t))
  if (t === 'locker') { if (S.locker) wearEquipped(); openLocker(true) } else if (t === 'orders') renderOrders()
}
async function loadWear () { try { S.wear = await api('wear', { query: {} }) } catch {} }

function wire () {
  const root = $('#page-store')
  root.addEventListener('click', e => {
    if (e.target.classList.contains('xs-layer')) { hideAll(); return }
    const t = e.target.closest('[data-tab],[data-pick],[data-add],[data-rm],[data-close],[data-buynow],[data-method],[data-copy],[data-order],[data-golocker],[data-equip],[data-equipnow],[data-piece],[data-ext],[data-lockerout],[data-shopslot],[data-atab],[data-afilter],[data-arefresh],[data-astatus],[data-adel],[data-shot],[data-aplayers],[data-aplayer],[data-agrant],[data-arevoke],[data-areset],[data-adelcode],[data-filter]')
    if (!t) return
    const d = t.dataset
    if (d.tab) tab(d.tab)
    else if (d.filter) { S.filter = d.filter; $$('[data-filter]').forEach(x => x.classList.toggle('on', x === t)); renderShop() }
    else if (d.add) { e.stopPropagation(); addToCart(d.add) }
    else if (d.pick) pick(d.pick)
    else if (d.buynow) { if (!S.cart.includes(d.buynow)) { S.cart.push(d.buynow); saveCart() } openCart() }
    else if (d.rm) { S.cart = S.cart.filter(x => x !== d.rm); saveCart() }
    else if (d.close !== undefined) hideAll()
    else if (d.method) { method = d.method; renderPay() }
    else if (d.copy) navigator.clipboard.writeText(d.copy).then(() => say('Copied', 'ok'))
    else if (d.ext) window.xion.call('open:external', d.ext)
    else if (d.order) { const [id, token] = d.order.split('.'); showOrder(id, token) }
    else if (d.golocker) { hideAll(); tab('locker') }
    else if (d.equip) { const [s, i] = d.equip.split('|'); equip(s, i) }
    else if (d.equipnow) { const [s, i] = d.equipnow.split('|'); tab('locker'); equip(s, i) }
    else if (d.lockerout) { delete S.keys[me().toLowerCase()]; keep.set('keys', S.keys); S.locker = null; renderLocker() }
    else if (d.shopslot) { tab('shop'); S.filter = d.shopslot; $$('[data-filter]').forEach(x => x.classList.toggle('on', x.dataset.filter === d.shopslot)); renderShop() }
    else if (d.piece) {
      const it = byId(d.piece)
      const look = { ...S.look }
      if (look[it.type] === it) delete look[it.type]; else look[it.type] = it
      wearStage(look)
      renderAnalyze()
    }
    else if (d.atab) adminTab(d.atab)
    else if (d.afilter) { A.filter = d.afilter; renderAdminOrders() }
    else if (d.arefresh) loadAdminOrders()
    else if (d.astatus) { const [id, st] = d.astatus.split('|'); adminSetStatus(id, st) }
    else if (d.adel) { if (confirm('Delete this order for good? The buyer keeps anything already unlocked.')) adminApi('deleteOrder', { id: d.adel }).then(() => { A.orders = A.orders.filter(o => o.id !== d.adel); renderAdminOrders() }).catch(x => say(x.message, 'err')) }
    else if (d.shot) { t.textContent = 'Loading…'; adminApi('shot', { id: d.shot }).then(r => { t.parentElement.innerHTML = `<img src="${r.image}" alt="Payment screenshot" data-zoom="1">` }).catch(x => { t.textContent = x.message }) }
    else if (d.aplayers) listPlayers()
    else if (d.aplayer) adminApi('player', { name: d.aplayer }).then(r => renderPlayers(r.player)).catch(x => say(x.message, 'err'))
    else if (d.agrant) adminPlayer('grant', d.agrant)
    else if (d.arevoke) adminPlayer('revoke', d.arevoke)
    else if (d.areset) adminPlayer('resetKey', d.areset)
    else if (d.adelcode) adminApi('deleteCode', { code: d.adelcode }).then(loadAdminSettings).catch(x => say(x.message, 'err'))
  })
  root.addEventListener('submit', e => {
    const f = e.target.closest('[data-areply]')
    if (!f) return
    e.preventDefault()
    const text = f.text.value.trim()
    if (!text) return
    adminApi('update', { id: f.dataset.areply, reply: text, read: true }).then(r => { A.orders = A.orders.map(x => x.id === r.order.id ? r.order : x); renderAdminOrders(); say('Reply sent.', 'ok') }).catch(x => say(x.message, 'err'))
  })
  root.addEventListener('mouseover', e => {
    const h = e.target.closest('[data-hover]')
    if (h && S.tab === 'locker' && S.locker) { const it = byId(h.dataset.hover); wearStage({ ...S.look, [it.type]: it }) }
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.body.dataset.page === 'store') hideAll() })
  $('#xsCartBtn').onclick = openCart
  $('#xsCheckout').onclick = openCheckout
  $('#xsApplyCode').onclick = () => { S.code = $('#xsCode').value.trim(); renderCart() }
  $('#xsCurrency').value = S.cur
  $('#xsCurrency').onchange = e => { S.cur = e.target.value; keep.set('cur', S.cur); renderShop(); renderAnalyze(); if (S.locker) renderLocker() }
  $('#xsSet').onchange = e => { S.set = e.target.value; renderShop() }
  $('#xsSort').onchange = e => { S.sort = e.target.value; renderShop() }
  $('#xsSearch').oninput = e => { S.q = e.target.value; renderShop() }
  $('#xsSpin').onclick = () => { const on = !stage.viewer.autoRotate; stage.viewer.autoRotate = on; $('#xsSpin').classList.toggle('on', on); keep.set('spin', on) }
  $('#xsReset').onclick = () => { S.selected = null; wearStage(S.locker ? Object.fromEntries(SLOTS.filter(s => S.locker.equipped[s]).map(s => [s, byId(S.locker.equipped[s])])) : {}, 0.4); $$('[data-pick]').forEach(el => el.classList.remove('sel')); renderAnalyze() }
  $('#xsFront').onclick = () => { stage.viewer.autoRotate = false; $('#xsSpin').classList.remove('on'); stage.viewer.playerWrapper.rotation.y = 0.35 }
  $('#xsBack').onclick = () => { stage.viewer.autoRotate = false; $('#xsSpin').classList.remove('on'); stage.viewer.playerWrapper.rotation.y = Math.PI + 0.35 }
  $('#xsToPay').onclick = () => {
    const f = $('#xsCheckoutForm')
    if (!IGN.test(f.ign.value.trim())) return say('Minecraft name must be 3–16 letters, numbers or _', 'err')
    if (!f.email.checkValidity() || !f.email.value) return say('Enter a valid email', 'err')
    renderPay(); step(2)
  }
  $('#xsBackTo1').onclick = () => step(1)
  $('#xsCheckoutForm').onsubmit = placeOrder
  $('#xsCheckoutForm').shot.onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#xsShotName').textContent = f.name; try { shotData = await readShot(f) } catch { say('Could not read that image', 'err') } }
  $('#xsAdminBtn').onclick = openAdmin
  $('#xsAdminForm').onsubmit = adminLogin
  $('#xsAdminOut').onclick = () => { S.admin = ''; sessionStorage.removeItem('xstore.admin'); $('#xsAdminBtn').classList.remove('on'); hideAll(); say('Logged out of store admin.') }
  if (S.admin) $('#xsAdminBtn').classList.add('on')
}

// ───────── boot (first time the Store page opens) ─────────
let booted = false
async function boot () {
  booted = true
  wire()
  $('#xsCartCount').textContent = S.cart.length
  $('#xsCartCount').classList.toggle('hidden', !S.cart.length)
  makeStage()
  renderAnalyze()
  try { S.cfg = await api('shop') } catch (e) {
    $('#xsGrid').innerHTML = `<div class="xs-empty">The store is offline right now.<br><small>${esc(e.message)}</small><br><button class="btn ghost" id="xsRetry">Try again</button></div>`
    $('#xsRetry').onclick = () => { booted = false; location.reload() }
    return
  }
  S.cart = S.cart.filter(byId)
  $('#xsSet').innerHTML = '<option value="">All collections</option>' + S.cfg.bundles.map(b => `<option value="${b.set}">${esc(b.name)}</option>`).join('')
  $('#xsStats').innerHTML = `<span><b>${S.cfg.items.length}</b> cosmetics</span><span><b>${S.cfg.bundles.length}</b> bundles</span><span><b>${S.cfg.items.filter(animated).length}</b> animated</span>`
  renderShop()
  // Start on a random bundle so the stage is never empty.
  const b = S.cfg.bundles[Math.floor(Math.random() * S.cfg.bundles.length)]
  wearStage(lookOf(itemsOf(b)))
  loadWear().then(() => { renderShop(); if (S.locker) renderLocker() })
  renderOrders()
  openLocker(true)
  makeThumbs().then(() => { if (S.locker) renderLocker(); renderAnalyze() })
}

window.addEventListener('xion:page', e => {
  const on = e.detail === 'store'
  if (on && !booted) boot()
  if (stage) stage.viewer.renderPaused = !on
  if (on && booted) { loadSkin(); if (S.cfg) openLocker(true) }
})
window.addEventListener('xion:account', () => { if (booted) { loadSkin(); S.locker = null; openLocker(true); renderLocker() } })
