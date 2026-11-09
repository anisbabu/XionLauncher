// Xion Store page: catalog, 3D previews, cart, checkout, orders and locker.
import { Dresser } from './cosmetics3d.js'

const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const store = {
  get: (k, d) => { try { const v = localStorage.getItem('xs.' + k); return v == null ? d : JSON.parse(v) } catch { return d } },
  set: (k, v) => { try { localStorage.setItem('xs.' + k, JSON.stringify(v)) } catch {} }
}

async function api (path, body) {
  const r = await fetch('/api/' + path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {})
  let data = {}
  try { data = await r.json() } catch {}
  if (!r.ok) throw new Error(data.error || 'Something went wrong. Please try again.')
  return data
}

let toastT
function toast (msg) {
  const t = $('#toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toastT)
  toastT = setTimeout(() => t.classList.remove('show'), 2400)
}

// ───────── state ─────────
const S = {
  cfg: null,
  cur: store.get('cur', 'USD'),
  cart: store.get('cart', []),
  code: '',
  thumbs: {},
  orders: store.get('orders', []),
  locker: store.get('locker', null),
  filter: 'all',
  q: ''
}
const sym = () => S.cfg.symbols[S.cur]
const fmt = (v, cur = S.cur) => (S.cfg ? S.cfg.symbols[cur] : '') + (cur === 'USD' ? Number(v).toFixed(2) : Math.round(v).toLocaleString())
const byId = id => S.cfg.items.find(i => i.id === id) || S.cfg.bundles.find(b => b.id === id)
const itemsOf = b => b.items.map(byId)
const lookOf = items => { const l = {}; for (const it of items) if (it && it.type && !l[it.type]) l[it.type] = it; return l }
const animated = it => it.frames > 1 || it.animated
const THUMB_BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='

// ───────── background ─────────
function sky () {
  const hill = (seed, h, col, top) => {
    let x = 0, y = h * 0.5, d = ''
    const rnd = n => { const s = Math.sin(n * 91.7 + seed * 13.1) * 43758.5; return s - Math.floor(s) }
    d += `M0 ${h} L0 ${y} `
    let i = 0
    while (x < 1600) { const w = 32 + Math.floor(rnd(i++) * 4) * 32; x += w; y = Math.max(16, Math.min(h - 32, y + (Math.floor(rnd(i++) * 5) - 2) * 16)); d += `H${x} V${y} ` }
    d += `V${h} Z`
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1600' height='${h}' shape-rendering='crispEdges'><path d='${d}' fill='${col}'/><path d='${d}' fill='none' stroke='${top}' stroke-width='8'/></svg>`
    return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
  }
  $('.hills-far').style.backgroundImage = hill(2, 300, '#1b1033', '#2b1a4d')
  $('.hills-mid').style.backgroundImage = hill(7, 260, '#120a22', '#3f8a1f')
  const kinds = [
    { c: '#6b4a2f', t: '#5cb531' }, { c: '#7c7c7c', t: '#8a8a8a' }, { c: 'linear-gradient(135deg,#7c7c7c 30%,#5eead4 30% 45%,#7c7c7c 45% 70%,#5eead4 70% 80%,#7c7c7c 80%)' },
    { c: '#a16207', t: '#ca8a04' }, { c: 'linear-gradient(135deg,#2e1065,#7c3aed)' }, { c: '#ea580c', t: '#c2410c' }
  ]
  const box = $('.cubes')
  for (let i = 0; i < 11; i++) {
    const k = kinds[i % kinds.length], s = 18 + Math.random() * 30
    const el = document.createElement('div')
    el.className = 'cube'
    el.style.cssText = `--s:${s}px;--c:${k.c};--t:${k.t || k.c};--d:${6 + Math.random() * 6}s;--r:${18 + Math.random() * 20}s;left:${Math.random() * 96}%;top:${8 + Math.random() * 70}%;animation-delay:-${Math.random() * 10}s`
    el.innerHTML = '<i></i>'.repeat(6)
    box.appendChild(el)
  }
}

// ───────── 3D viewers ─────────
function fitViewer (d, canvas) {
  const ro = new ResizeObserver(() => { const r = canvas.parentElement.getBoundingClientRect(); if (r.width && r.height) d.viewer.setSize(r.width, r.height) })
  ro.observe(canvas.parentElement)
}
function makeViewer (sel, opts = {}) {
  const canvas = $(sel)
  const r = canvas.parentElement.getBoundingClientRect()
  const d = new Dresser({ canvas, width: r.width || 400, height: r.height || 500, animation: 'walk', ...opts })
  fitViewer(d, canvas)
  return d
}

// Capes get a flat, slightly tilted "cloak card" of their back face, like a cosmetics locker.
async function capeCard (it) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `/assets/capes/${it.frames > 1 ? it.id + '_0' : it.id}.png` })
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

let thumbDresser
const ANGLE = { cape: Math.PI + 0.45, wings: Math.PI + 0.15, hat: 0.5, aura: 0.45 }
const FRAME = { cape: { zoom: 1.2, y: 0 }, wings: { zoom: 1.0, y: -3 }, hat: { zoom: 1.5, y: -16 }, aura: { zoom: 0.85, y: 0 } }
async function makeThumbs () {
  const canvas = document.createElement('canvas')
  thumbDresser = new Dresser({ canvas, width: 300, height: 330, thumbnail: true, animation: false, zoom: 0.9 })
  for (const it of S.cfg.items) {
    try { S.thumbs[it.id] = it.type === 'cape' ? await capeCard(it) : await thumbDresser.snapshot(lookOf([it]), ANGLE[it.type], FRAME[it.type]) } catch { S.thumbs[it.id] = THUMB_BLANK }
    $$(`img[data-thumb="${it.id}"]`).forEach(img => { img.src = S.thumbs[it.id]; img.nextElementSibling?.classList.contains('shimmer') && img.nextElementSibling.remove() })
    await new Promise(r => setTimeout(r, 0))
  }
}
const thumb = id => `<img data-thumb="${id}" src="${S.thumbs[id] || THUMB_BLANK}" alt="">${S.thumbs[id] ? '' : '<div class="shimmer"></div>'}`

// ───────── hero ─────────
let hero
function startHero () {
  hero = makeViewer('#heroCanvas', { rotate: true, zoom: 0.7 })
  const me = store.get('ign', '')
  if (me) hero.setSkin('/api/skin?name=' + encodeURIComponent(me))
  let i = 0
  const show = () => {
    const b = S.cfg.bundles[i++ % S.cfg.bundles.length]
    hero.wear(lookOf(itemsOf(b)))
    const l = $('#heroLabel')
    l.textContent = b.name
    l.style.color = b.color
    l.style.animation = 'none'; void l.offsetWidth; l.style.animation = ''
  }
  show()
  setInterval(show, 5200)
}

// ───────── bundles + grid ─────────
function bundleSum (b) { return itemsOf(b).reduce((s, it) => s + it.price[S.cur], 0) }
function renderBundles () {
  $('#bundleRow').innerHTML = S.cfg.bundles.map(b => {
    const full = bundleSum(b), off = Math.round((1 - b.price[S.cur] / full) * 100)
    return `<article class="bundle" style="--c:${b.color};--a:${b.accent}" data-open="${b.id}">
      <span class="b-tag">${esc(b.tag)}</span>
      <h3>${esc(b.name)}</h3><p>${esc(b.desc)}</p>
      <div class="b-thumbs">${b.items.map(id => `<div class="thumb">${thumb(id)}</div>`).join('')}</div>
      <div class="b-foot"><div class="price"><s>${fmt(full)}</s>${fmt(b.price[S.cur])}<span class="save">-${off}%</span></div>
      <button class="mc-btn primary small" data-add="${b.id}">${S.cart.includes(b.id) ? 'In cart ✓' : 'Add bundle'}</button></div>
    </article>`
  }).join('')
  observeReveal()
}
function renderGrid () {
  const q = S.q.toLowerCase()
  const list = S.cfg.items.filter(it => (S.filter === 'all' || it.type === S.filter || (S.filter === 'animated' && animated(it))) && (!q || (it.name + ' ' + it.type + ' ' + (it.set || '')).toLowerCase().includes(q)))
  $('#grid').innerHTML = list.map((it, n) => `<article class="item card r-${it.rarity}" data-open="${it.id}" style="animation-delay:${Math.min(n, 20) * 30}ms">
      <div class="thumb">${thumb(it.id)}<span class="rar">${it.rarity}</span>${animated(it) ? '<span class="anim-b">✦ animated</span>' : ''}</div>
      <h4>${esc(it.name)}</h4><div class="meta">${it.type}${it.set ? ' · ' + esc(setName(it.set)) : ''}</div>
      <div class="row"><span class="price">${fmt(it.price[S.cur])}</span><button class="mc-btn small ${S.cart.includes(it.id) ? 'owned' : ''}" data-add="${it.id}">${S.cart.includes(it.id) ? '✓' : '+ Cart'}</button></div>
    </article>`).join('') || '<p class="empty">Nothing matches that search.</p>'
  tilt()
}
const setName = id => (S.cfg.bundles.find(b => b.set === id) || {}).name || id

function tilt () {
  $$('.item').forEach(el => {
    el.onmousemove = e => { const r = el.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5; el.style.transform = `perspective(700px) rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateY(-4px)` }
    el.onmouseleave = () => { el.style.transform = '' }
  })
}
let io
function observeReveal () {
  io = io || new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }), { threshold: 0.12 })
  $$('.reveal:not(.in)').forEach(el => io.observe(el))
}

// ───────── item modal ─────────
let itemDresser, current, worn = {}
function openItem (id) {
  const e = byId(id)
  if (!e) return
  current = e
  $('#itemModal').classList.remove('hidden')
  const stage = $('.item-stage')
  stage.style.setProperty('--r', e.items ? e.color : `var(--${e.rarity})`)
  if (!itemDresser) { itemDresser = makeViewer('#itemCanvas', { rotate: false, zoom: 0.66 }); const n = store.get('tryName', ''); if (n) { $('#tryName').value = n; itemDresser.setSkin('/api/skin?name=' + encodeURIComponent(n)) } }
  const items = e.items ? itemsOf(e) : [e]
  worn = lookOf(items)
  itemDresser.wear(worn)
  itemDresser.viewer.playerWrapper.rotation.y = e.type === 'cape' || e.type === 'wings' ? Math.PI + 0.5 : 0.4
  const inCart = S.cart.includes(e.id)
  const priceHtml = e.items ? `<s>${fmt(bundleSum(e))}</s>${fmt(e.price[S.cur])}` : fmt(e.price[S.cur])
  $('#itemInfo').innerHTML = `
    <div class="pills">${e.items ? `<span class="pill r" style="--r:${e.color}">Bundle · ${e.items.length} items</span>` : `<span class="pill r" style="--r:var(--${e.rarity})">${e.rarity}</span><span class="pill">${e.type}</span>`}${!e.items && animated(e) ? '<span class="pill">✦ animated</span>' : ''}${e.set && !e.items ? `<span class="pill">${esc(setName(e.set))}</span>` : ''}</div>
    <h3 style="${e.items ? 'color:' + e.color : ''}">${esc(e.name)}</h3>
    <p class="desc">${esc(e.desc)}</p>
    ${e.items ? `<div class="contents">${items.map(it => `<button class="on" data-piece="${it.id}"><img src="${S.thumbs[it.id] || THUMB_BLANK}" alt="">${esc(it.name)}</button>`).join('')}</div><p class="note">Tap a piece to hide or show it on the preview.</p>` : ''}
    <div class="buy"><span class="price">${priceHtml}</span>
      <button class="mc-btn ${inCart ? 'owned' : 'primary'} big" data-add="${e.id}">${inCart ? 'In cart ✓' : 'Add to cart'}</button>
      <button class="mc-btn big" data-buynow="${e.id}">Buy now</button></div>`
}
function closeModals () { $$('.modal, .drawer').forEach(m => m.classList.add('hidden')) }

// ───────── cart ─────────
function saveCart () { store.set('cart', S.cart); $('#cartCount').textContent = S.cart.length; renderCart(); renderBundles(); renderGrid() }
function addToCart (id) {
  if (S.cart.includes(id)) { openCart(); return }
  S.cart.push(id)
  saveCart()
  const b = $('#openCart'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump')
  toast(`${byId(id).name} added to cart`)
  if (current && current.id === id) openItem(id)
}
function openCart () { renderCart(); $('#cart').classList.remove('hidden') }
let quote = null, quoteSeq = 0
async function renderCart () {
  const box = $('#cartLines')
  if (!S.cart.length) { box.innerHTML = '<div class="empty"><b>🛒</b>Your cart is empty.<br>Go find something shiny.</div>'; $('#cartTotal').textContent = '—'; $('#checkoutBtn').disabled = true; quote = null; return }
  const inBundles = new Set(S.cart.map(byId).filter(e => e && e.items).flatMap(b => b.items))
  box.innerHTML = S.cart.map(id => {
    const e = byId(id)
    if (!e) return ''
    const dupe = !e.items && inBundles.has(id)
    const img = e.items ? S.thumbs[e.items[0]] : S.thumbs[id]
    return `<div class="cline ${dupe ? 'dupe' : ''}"><img src="${img || THUMB_BLANK}" alt=""><div class="grow"><b>${esc(e.name)}</b><small>${e.items ? 'Bundle · ' + e.items.length + ' items' : e.type}${dupe ? ' · included in a bundle' : ''}</small></div><span>${dupe ? '—' : fmt(e.price[S.cur])}</span><button class="rm" data-rm="${id}" aria-label="Remove">✕</button></div>`
  }).join('')
  $('#checkoutBtn').disabled = true
  const seq = ++quoteSeq
  try {
    const q = await api('shop', { action: 'quote', cart: S.cart, currency: S.cur, code: S.code })
    if (seq !== quoteSeq) return
    quote = q
    $('#cartTotal').innerHTML = q.total !== q.subtotal ? `<s style="font-size:16px;color:var(--muted)">${fmt(q.subtotal)}</s> ${fmt(q.total)}` : fmt(q.total)
    if (S.code) $('#codeNote').textContent = q.code && q.code.invalid ? 'That code is not valid or has been used up.' : q.code ? `Code ${q.code.code} applied${q.code.type === 'free' ? ': free order!' : ` (−${q.code.value}%)`}` : ''
    $('#checkoutBtn').disabled = false
  } catch (e) { $('#cartTotal').textContent = '—'; $('#codeNote').textContent = e.message }
}

// ───────── checkout ─────────
let method = null, shotData = ''
function openCheckout () {
  if (!quote || !S.cart.length) return
  closeModals()
  const f = $('#checkoutForm')
  f.ign.value = f.ign.value || store.get('ign', '') || (S.locker && S.locker.name) || ''
  f.email.value = f.email.value || store.get('email', '')
  $('#sumBox').innerHTML = quote.lines.map(l => `<div style="display:flex;justify-content:space-between"><span>${esc(l.name)}</span><span>${fmt(l.price)}</span></div>`).join('') + `<div class="tot"><span>Total</span><span>${fmt(quote.total)}</span></div>`
  step(1)
  $('#checkout').classList.remove('hidden')
}
function step (n) {
  $$('#checkout .step').forEach(s => s.classList.toggle('hidden', +s.dataset.step !== n))
  $$('#checkout .steps span').forEach((s, i) => s.classList.toggle('on', i < n))
}
const METHOD_INFO = { bkash: ['bKash', 'Send Money'], nagad: ['Nagad', 'Send Money'], upi: ['UPI', 'Any UPI app'], card: ['Card', 'Visa / Mastercard'] }
function renderPay () {
  const free = quote.total === 0
  const ms = S.cfg.methods[S.cur]
  if (!ms.includes(method)) method = ms[0]
  $('#methods').innerHTML = free ? '' : ms.map(m => `<button type="button" class="method ${m === method ? 'on' : ''}" data-method="${m}">${METHOD_INFO[m][0]}<small>${METHOD_INFO[m][1]}</small></button>`).join('')
  $('#payFields').classList.toggle('hidden', free)
  const p = S.cfg.pay
  let box
  if (free) box = 'Your code makes this order <b>free</b>. Just place the order.'
  else if (method === 'card') box = p.cardLink ? `Pay <span class="amt">${fmt(quote.total)}</span> on our secure card page, then come back with the receipt.<br><br><a class="mc-btn small" href="${esc(p.cardLink)}" target="_blank" rel="noopener">Open card payment ↗</a>` : 'Card payments are not set up yet. Switch currency to use bKash, Nagad or UPI, or message us after ordering.'
  else {
    const num = p[method] || 'not set yet'
    box = `Send <span class="amt">${fmt(quote.total)}</span> with ${METHOD_INFO[method][0]} (${METHOD_INFO[method][1]}) to<div class="num">${esc(num)} ${p[method] ? `<button type="button" class="mc-btn small" data-copy="${esc(num)}">Copy</button>` : ''}</div>${esc(S.cfg.note)}`
  }
  $('#payBox').innerHTML = box
  $('#payerLabel').textContent = method === 'card' ? 'Email or name on the card payment' : method === 'upi' ? 'UPI ID you paid from' : 'Number you paid from'
}
async function readShot (file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file) })
  const k = Math.min(1, 1600 / Math.max(img.width, img.height))
  const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.85)
}
async function placeOrder (e) {
  e.preventDefault()
  const f = $('#checkoutForm'), err = $('#payErr'), btn = $('#placeBtn')
  err.textContent = ''
  btn.disabled = true
  btn.textContent = 'Placing…'
  try {
    const r = await api('shop', { action: 'order', cart: S.cart, currency: S.cur, code: S.code, ign: f.ign.value.trim(), email: f.email.value.trim(), method, payer: f.payer.value, trx: f.trx.value, screenshot: shotData })
    S.orders.unshift({ id: r.id, token: r.token, at: Date.now() })
    store.set('orders', S.orders)
    store.set('ign', f.ign.value.trim()); store.set('email', f.email.value.trim())
    S.cart = []; S.code = ''; $('#code').value = ''; shotData = ''; $('#shotName').textContent = 'Choose image…'; f.payer.value = ''; f.trx.value = ''
    saveCart()
    $('#viewOrder').onclick = () => { closeModals(); location.hash = `order=${r.id}.${r.token}` }
    step(3)
    renderOrders()
  } catch (x) { err.textContent = x.message } finally { btn.disabled = false; btn.textContent = 'Place order' }
}

// ───────── orders ─────────
const STATUS_TXT = { pending: 'Checking payment', approved: 'Approved', rejected: 'Rejected' }
async function renderOrders () {
  const box = $('#orderList')
  if (!S.orders.length) { box.innerHTML = '<div class="card empty">No orders from this browser yet.</div>'; return }
  const rows = await Promise.all(S.orders.slice(0, 20).map(o => api('shop', { action: 'status', id: o.id, token: o.token }).then(d => ({ ...d, token: o.token })).catch(() => null)))
  box.innerHTML = rows.filter(Boolean).map(o => `<div class="order-row card" data-order="${o.id}.${o.token}"><div class="grow"><b>${esc(o.lines.map(l => l.name).join(', '))}</b><br><small style="color:var(--muted)">${new Date(o.created).toLocaleString()} · for ${esc(o.ign)}</small></div><b>${fmt(o.amount, o.currency)}</b><span class="badge ${o.status}">${STATUS_TXT[o.status] || o.status}</span></div>`).join('') || '<div class="card empty">No orders found.</div>'
}
let orderPoll
async function showOrder (id, token) {
  clearInterval(orderPoll)
  const v = $('#orderView')
  v.classList.remove('hidden')
  v.classList.add('card')
  const draw = o => {
    const st = o.status
    v.innerHTML = `<h3>Order for ${esc(o.ign)}</h3><small style="color:var(--muted)">#${o.id} · ${new Date(o.created).toLocaleString()}</small>
      <div class="timeline"><span class="on">Placed</span><span class="${st === 'pending' ? '' : st === 'rejected' ? 'bad' : 'on'}">${st === 'rejected' ? 'Rejected' : 'Payment checked'}</span><span class="${st === 'approved' ? 'on' : ''}">Unlocked</span></div>
      ${o.lockerKey ? `<div class="keybox"><span>🔑</span><code>${esc(o.lockerKey)}</code><button class="mc-btn small" data-copy="${esc(o.lockerKey)}">Copy</button><button class="mc-btn small green" data-unlock="${esc(o.ign)}|${esc(o.lockerKey)}">Open locker</button></div>` : ''}
      ${st === 'approved' ? `<p class="note">Your look is live: <a href="/u/${encodeURIComponent(o.ign)}" target="_blank">/u/${esc(o.ign)}</a></p>` : ''}
      <ul class="lines">${o.lines.map(l => `<li><span>${esc(l.name)}</span><span>${fmt(l.price, o.currency)}</span></li>`).join('')}<li><b>Total</b><b>${fmt(o.amount, o.currency)}</b></li></ul>
      <div class="chat" id="chat">${o.messages.map(m => `<div class="msg ${m.from}">${esc(m.text)}<small>${m.from === 'admin' ? 'Xion Store · ' : m.from === 'buyer' ? 'You · ' : ''}${new Date(m.at).toLocaleString()}</small></div>`).join('')}</div>
      <form class="chat-form" id="chatForm"><input name="text" maxlength="1000" placeholder="Message the store…" autocomplete="off"><button class="mc-btn primary">Send</button></form>`
    const c = $('#chat'); c.scrollTop = c.scrollHeight
    $('#chatForm').onsubmit = async ev => {
      ev.preventDefault()
      const t = ev.target.text.value.trim()
      if (!t) return
      try { draw(await api('shop', { action: 'message', id, token, text: t })) } catch (x) { toast(x.message) }
    }
  }
  try {
    draw(await api('shop', { action: 'status', id, token }))
    if (!S.orders.find(o => o.id === id)) { S.orders.unshift({ id, token, at: Date.now() }); store.set('orders', S.orders); renderOrders() }
    v.scrollIntoView({ behavior: 'smooth', block: 'start' })
    orderPoll = setInterval(async () => { if (document.activeElement && document.activeElement.name === 'text') return; try { draw(await api('shop', { action: 'status', id, token })) } catch {} }, 20000)
  } catch (x) { v.innerHTML = `<p class="err">${esc(x.message)}</p>` }
}

// ───────── locker ─────────
let lockerDresser, lockerData
async function openLocker (name, key) {
  $('#lockerErr').textContent = ''
  try {
    lockerData = await api('locker', { action: 'open', name, key })
    S.locker = { name, key }
    store.set('locker', S.locker)
    drawLocker()
  } catch (x) { $('#lockerErr').textContent = x.message; S.locker = null; store.set('locker', null) }
}
function drawLocker () {
  $('#lockerLogin').classList.add('hidden')
  $('#lockerMain').classList.remove('hidden')
  $('#lockerName').textContent = lockerData.display
  $('#lockerProfile').href = '/u/' + encodeURIComponent(lockerData.display)
  if (!lockerDresser) lockerDresser = makeViewer('#lockerCanvas', { rotate: true, zoom: 0.66 })
  lockerDresser.setSkin('/api/skin?name=' + encodeURIComponent(lockerData.display))
  lockerDresser.wear(Object.fromEntries(Object.entries(lockerData.equipped).map(([s, id]) => [s, byId(id)])))
  const owned = lockerData.owned.map(byId).filter(Boolean)
  $('#lockerItems').innerHTML = ['cape', 'hat', 'wings', 'aura'].map(slot => {
    const list = owned.filter(i => i.type === slot)
    const on = lockerData.equipped[slot]
    return `<div class="slot-row"><h4>${slot === 'wings' ? 'Wings' : slot + 's'}</h4><div class="slot-list">
      <button class="slot-item none ${on ? '' : 'on'}" data-equip="${slot}|">None</button>
      ${list.map(i => `<button class="slot-item r-${i.rarity} ${on === i.id ? 'on' : ''}" data-equip="${slot}|${i.id}"><img src="${S.thumbs[i.id] || THUMB_BLANK}" alt="">${esc(i.name)}</button>`).join('')}
      ${list.length ? '' : '<span class="note" style="align-self:center">Nothing here yet. <a href="#shop">Shop ' + slot + 's</a></span>'}
    </div></div>`
  }).join('')
}
async function equip (slot, item) {
  try {
    lockerData = await api('locker', { action: 'equip', name: S.locker.name, key: S.locker.key, slot, item })
    drawLocker()
    toast(item ? `${byId(item).name} equipped` : `${slot} removed`)
  } catch (x) { toast(x.message) }
}

// ───────── events ─────────
function wire () {
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-add],[data-open],[data-rm],[data-close],[data-buynow],[data-method],[data-copy],[data-order],[data-unlock],[data-equip],[data-piece]')
    if (!t) { if (e.target.classList.contains('modal') || e.target.classList.contains('drawer')) closeModals(); return }
    const d = t.dataset
    if (d.add) { e.stopPropagation(); addToCart(d.add) } else if (d.buynow) { if (!S.cart.includes(d.buynow)) { S.cart.push(d.buynow); saveCart() } closeModals(); openCart() } else if (d.open) openItem(d.open)
    else if (d.rm) { S.cart = S.cart.filter(x => x !== d.rm); saveCart() } else if (d.close !== undefined) closeModals()
    else if (d.method) { method = d.method; renderPay() } else if (d.copy) { navigator.clipboard.writeText(d.copy).then(() => toast('Copied')) }
    else if (d.order) location.hash = 'order=' + d.order
    else if (d.unlock) { const [n, k] = d.unlock.split('|'); location.hash = 'locker'; openLocker(n, k) }
    else if (d.equip) { const [s, i] = d.equip.split('|'); equip(s, i) }
    else if (d.piece) {
      const it = byId(d.piece)
      t.classList.toggle('on')
      if (t.classList.contains('on')) worn[it.type] = it; else delete worn[it.type]
      itemDresser.wear(worn)
    }
  })
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModals() })
  $('#openCart').onclick = openCart
  $('#checkoutBtn').onclick = openCheckout
  $('#applyCode').onclick = () => { S.code = $('#code').value.trim(); renderCart() }
  $('#currency').value = S.cur
  $('#currency').onchange = e => { S.cur = e.target.value; store.set('cur', S.cur); renderBundles(); renderGrid(); renderCart(); if (current && !$('#itemModal').classList.contains('hidden')) openItem(current.id) }
  $('#filters').onclick = e => { const c = e.target.closest('.chip'); if (!c) return; $$('.chip').forEach(x => x.classList.toggle('on', x === c)); S.filter = c.dataset.f; renderGrid() }
  $('#search').oninput = e => { S.q = e.target.value; renderGrid() }
  $('#tryBtn').onclick = () => { const n = $('#tryName').value.trim(); if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) return toast('Enter a Minecraft name'); store.set('tryName', n); itemDresser.setSkin('/api/skin?name=' + encodeURIComponent(n)) }
  $('#toPay').onclick = () => {
    const f = $('#checkoutForm')
    if (!/^[A-Za-z0-9_]{3,16}$/.test(f.ign.value.trim())) return toast('Minecraft name must be 3–16 letters, numbers or _')
    if (!f.email.checkValidity()) return toast('Enter a valid email')
    renderPay(); step(2)
  }
  $('#backTo1').onclick = () => step(1)
  $('#checkoutForm').onsubmit = placeOrder
  $('#checkoutForm').shot.onchange = async e => { const f = e.target.files[0]; if (!f) return; $('#shotName').textContent = f.name; try { shotData = await readShot(f) } catch { toast('Could not read that image') } }
  $('#lockerLogin').onsubmit = e => { e.preventDefault(); openLocker(e.target.name.value.trim(), e.target.key.value.trim()) }
  $('#lockerOut').onclick = () => { S.locker = null; store.set('locker', null); $('#lockerMain').classList.add('hidden'); $('#lockerLogin').classList.remove('hidden') }
  window.addEventListener('hashchange', route)
}
function route () {
  const m = /^#order=([0-9a-f]{16})\.([0-9a-f]{32})$/.exec(location.hash)
  if (m) showOrder(m[1], m[2])
}

// ───────── boot ─────────
async function boot () {
  // Opened inside Xion Launcher: ?embed=1&ign=<account name> fills in the player's name.
  const qs = new URLSearchParams(location.search)
  if (qs.get('embed')) document.body.classList.add('embed')
  const ign = qs.get('ign')
  if (ign && /^[A-Za-z0-9_]{3,16}$/.test(ign)) { store.set('ign', ign); store.set('tryName', ign); $('#tryName').value = ign; const ln = $('#lockerLogin'); if (ln && !ln.name.value) ln.name.value = ign }
  sky()
  wire()
  $('#cartCount').textContent = S.cart.length
  try { S.cfg = await api('shop') } catch (e) { toast('Store is offline, try again soon.'); return }
  S.cart = S.cart.filter(byId)
  $('#statItems').textContent = S.cfg.items.length
  $('#statBundles').textContent = S.cfg.bundles.length
  $('#statAnim').textContent = S.cfg.items.filter(animated).length
  $$('.block-head, .how-card, .locker').forEach(el => el.classList.add('reveal'))
  renderBundles()
  renderGrid()
  observeReveal()
  startHero()
  renderOrders()
  route()
  if (S.locker) openLocker(S.locker.name, S.locker.key)
  makeThumbs().then(() => { if (lockerData) drawLocker() })
}
boot()
