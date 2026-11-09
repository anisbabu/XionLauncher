// Public Xion Store API. POST JSON { action, ... } (GET = config):
//   config                          catalog, prices, payment methods and where to send money
//   quote   {cart, currency, code}  priced cart (server prices) with the code applied
//   order   {...}                   places an order with payment proof (or a code that makes it free)
//   status  {id, token}             the buyer's order: status, messages, locker key once approved
//   message {id, token, text}       buyer writes to the seller
const C = require('./catalog')
const S = require('./_cos')

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_SHOT = 2.5 * 1024 * 1024
const CURRENCIES = ['USD', 'BDT', 'INR']

async function findCode (raw) {
  const code = S.clean(raw, 40).toUpperCase()
  if (!code) return null
  const codes = await S.readJSON('codes.json', [])
  const c = codes.find(x => x.code === code)
  if (!c || !c.active || (c.maxUses && c.uses >= c.maxUses)) return { code, invalid: true }
  return c
}

// Turns a list of ids into priced lines. A bundle swallows any of its items that are also in the cart.
function priceCart (ids, currency, code) {
  const uniq = [...new Set((Array.isArray(ids) ? ids : []).map(x => S.clean(x, 40)))].slice(0, 60)
  const entries = uniq.map(C.byId).filter(Boolean)
  const inBundles = new Set(entries.filter(e => e.items).flatMap(b => b.items))
  const lines = entries.filter(e => e.items || !inBundles.has(e.id)).map(e => ({ id: e.id, name: e.name, kind: e.items ? 'bundle' : e.type, price: e.price[currency] }))
  const subtotal = round(currency, lines.reduce((s, l) => s + l.price, 0))
  let total = subtotal
  if (code && !code.invalid) {
    if (code.type === 'free') total = 0
    else total = round(currency, subtotal * (100 - Math.max(0, Math.min(100, Number(code.value) || 0))) / 100)
  }
  const grants = [...new Set(lines.flatMap(l => { const e = C.byId(l.id); return e.items || [e.id] }))]
  return { lines, subtotal, total, grants }
}
const round = (cur, v) => cur === 'USD' ? Math.round(v * 100) / 100 : Math.round(v)

const publicOrder = o => ({
  id: o.id, created: o.created, status: o.status, ign: o.ign, currency: o.currency, amount: o.amount, lines: o.lines,
  method: o.method, lockerKey: o.lockerKey || '', messages: (o.messages || []).map(m => ({ from: m.from, text: m.text, at: m.at }))
})

async function loadOwn (b) {
  const oid = S.clean(b.id, 40)
  if (!/^[0-9a-f]{16}$/.test(oid)) return null
  const o = await S.readJSON(`orders/${oid}.json`)
  return o && S.safeEq(o.token, S.clean(b.token, 80)) ? o : null
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') req.body = { action: 'config' }
    else if (req.method !== 'POST') return S.send(res, 405, { error: 'Method not allowed' })
    const b = req.body || {}

    if (b.action === 'config') {
      const st = await S.settings()
      return S.send(res, 200, {
        items: C.ITEMS, bundles: C.BUNDLES, symbols: S.SYMBOL, methods: S.METHODS,
        pay: { bkash: st.bkash, nagad: st.nagad, upi: st.upi, cardLink: st.cardLink }, note: st.note
      })
    }

    const currency = CURRENCIES.includes(b.currency) ? b.currency : 'USD'

    if (b.action === 'quote') {
      const c = await findCode(b.code)
      const q = priceCart(b.cart, currency, c)
      return S.send(res, 200, { ...q, code: c ? (c.invalid ? { invalid: true } : { code: c.code, type: c.type, value: c.value }) : null })
    }

    if (b.action === 'order') {
      if (!CURRENCIES.includes(b.currency)) return S.send(res, 400, { error: 'Pick a currency.' })
      const ign = S.clean(b.ign, 16), email = S.clean(b.email, 120).toLowerCase()
      if (!S.IGN.test(ign)) return S.send(res, 400, { error: 'Minecraft name must be 3–16 letters, numbers or _.' })
      if (!EMAIL.test(email)) return S.send(res, 400, { error: 'Enter a valid email so we can reach you.' })
      const c = await findCode(b.code)
      if (c && c.invalid) return S.send(res, 400, { error: 'That code is not valid or has been used up.' })
      const q = priceCart(b.cart, currency, c)
      if (!q.lines.length) return S.send(res, 400, { error: 'Your cart is empty.' })

      let method = S.clean(b.method, 20), payer = '', trx = '', shot = null
      if (q.total > 0) {
        if (!S.METHODS[currency].includes(method)) return S.send(res, 400, { error: 'Pick a payment method.' })
        payer = S.clean(b.payer, 60)
        trx = S.clean(b.trx, 60)
        if (payer.length < 3) return S.send(res, 400, { error: method === 'card' ? 'Enter the email or name on your card payment.' : method === 'upi' ? 'Enter the UPI ID you paid from.' : 'Enter the number you paid from.' })
        if (trx.length < 4) return S.send(res, 400, { error: 'Enter the transaction ID.' })
        const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(b.screenshot || ''))
        if (!m) return S.send(res, 400, { error: 'Add a screenshot of your payment.' })
        shot = { type: m[1], data: Buffer.from(m[2], 'base64') }
        if (shot.data.length > MAX_SHOT) return S.send(res, 400, { error: 'Screenshot is too large (max 2.5 MB).' })
      } else method = 'free'

      if (!(await S.limit(req, 'order', 6, 3600 * 1000))) return S.send(res, 429, { error: 'Too many orders from your network. Try again in an hour.' })

      const oid = S.id(8), token = S.id(16)
      if (shot) await S.writeBytes(`shots/${oid}`, shot.data, shot.type)
      const order = {
        id: oid, token, created: Date.now(), status: 'pending', ign, email, currency, amount: q.total, subtotal: q.subtotal,
        lines: q.lines, grants: q.grants, method, payer, trx, code: c ? c.code : '', shot: !!shot, granted: false, lockerKey: '',
        messages: [{ from: 'system', text: q.total > 0 ? 'Order received! We are checking your payment. Your cosmetics unlock here as soon as it is approved.' : 'Order received with a free code. Your cosmetics unlock as soon as it is approved.', at: Date.now() }],
        unread: true
      }
      await S.writeJSON(`orders/${oid}.json`, order)
      if (c) {
        const codes = await S.readJSON('codes.json', [])
        const x = codes.find(k => k.code === c.code)
        if (x) { x.uses = (x.uses || 0) + 1; await S.writeJSON('codes.json', codes) }
      }
      return S.send(res, 200, { ok: true, id: oid, token })
    }

    if (b.action === 'status') {
      const o = await loadOwn(b)
      if (!o) return S.send(res, 404, { error: 'Order not found.' })
      return S.send(res, 200, publicOrder(o))
    }

    if (b.action === 'message') {
      const o = await loadOwn(b)
      if (!o) return S.send(res, 404, { error: 'Order not found.' })
      const text = S.clean(b.text, 1000)
      if (!text) return S.send(res, 400, { error: 'Write a message.' })
      if ((o.messages || []).filter(m => m.from === 'buyer' && Date.now() - m.at < 600000).length >= 10) return S.send(res, 429, { error: 'Slow down a little, then try again.' })
      o.messages.push({ from: 'buyer', text, at: Date.now() })
      o.unread = true
      await S.writeJSON(`orders/${o.id}.json`, o)
      return S.send(res, 200, publicOrder(o))
    }

    return S.send(res, 400, { error: 'Unknown action' })
  } catch (e) {
    console.error(e)
    return S.send(res, 500, { error: 'Something went wrong. Please try again.' })
  }
}
