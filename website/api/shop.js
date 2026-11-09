// Public Xion+ shop API. POST JSON { action, ... }:
//   config                     prices, payment methods and where to send money
//   code    {code, currency}   checks a redeem code and returns the new price
//   order   {...}              places an order (with payment proof unless a code makes it free)
//   status  {id, token}        the buyer's order: status, license key, messages
//   message {id, token, text}  buyer writes to the seller
const crypto = require('crypto')
const S = require('./_store')

const DEVICE = /^[0-9a-f]{16}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const IGN = /^[A-Za-z0-9_]{3,16}$/
const MAX_SHOT = 2.5 * 1024 * 1024

async function findCode (raw) {
  const code = S.clean(raw, 40).toUpperCase()
  if (!code) return null
  const codes = await S.readJSON('shop/codes.json', [])
  const c = codes.find(x => x.code === code)
  if (!c || !c.active || (c.maxUses && c.uses >= c.maxUses)) return { code, invalid: true }
  return c
}

function priceWith (c, currency) {
  const base = S.PRICES[currency]
  if (!c || c.invalid) return base
  if (c.type === 'free') return 0
  const off = Math.max(0, Math.min(100, Number(c.value) || 0))
  const v = base * (100 - off) / 100
  return currency === 'USD' ? Math.round(v * 100) / 100 : Math.round(v)
}

// At most 5 orders per hour from one network, so the inbox can't be flooded.
async function rateLimit (req) {
  const key = 'shop/rl/order-' + crypto.createHash('sha256').update(S.ip(req)).digest('hex').slice(0, 24) + '.json'
  const now = Date.now()
  const r = await S.readJSON(key, { hits: [] })
  r.hits = r.hits.filter(t => now - t < 3600 * 1000)
  if (r.hits.length >= 5) return false
  r.hits.push(now)
  await S.writeJSON(key, r)
  return true
}

const publicOrder = o => ({
  id: o.id, created: o.created, status: o.status, name: o.name, ign: o.ign, currency: o.currency, amount: o.amount,
  method: o.method, key: o.key || '', messages: (o.messages || []).map(m => ({ from: m.from, text: m.text, at: m.at }))
})

async function loadOwn (body) {
  const oid = S.clean(body.id, 40)
  if (!/^[0-9a-f]{16}$/.test(oid)) return null
  const o = await S.readJSON(`shop/orders/${oid}.json`)
  return o && S.safeEq(o.token, S.clean(body.token, 80)) ? o : null
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') req.body = { action: 'config' }
    else if (req.method !== 'POST') return S.send(res, 405, { error: 'Method not allowed' })
    const b = req.body || {}

    if (b.action === 'config') {
      const st = await S.settings()
      return S.send(res, 200, { prices: S.PRICES, symbols: S.SYMBOL, methods: S.METHODS, pay: { bkash: st.bkash, nagad: st.nagad, upi: st.upi, cardLink: st.cardLink }, note: st.note })
    }

    if (b.action === 'code') {
      const currency = S.PRICES[b.currency] ? b.currency : 'USD'
      const c = await findCode(b.code)
      if (!c || c.invalid) return S.send(res, 200, { ok: false, error: 'That code is not valid or has been used up.' })
      return S.send(res, 200, { ok: true, type: c.type, value: c.value, price: priceWith(c, currency) })
    }

    if (b.action === 'order') {
      const currency = S.PRICES[b.currency] ? b.currency : null
      const name = S.clean(b.name, 80), ign = S.clean(b.ign, 16), email = S.clean(b.email, 120).toLowerCase()
      const device = S.clean(b.device, 40).toLowerCase().replace(/[^0-9a-f]/g, '')
      if (!currency) return S.send(res, 400, { error: 'Pick a currency.' })
      if (name.length < 2) return S.send(res, 400, { error: 'Enter your full name.' })
      if (!IGN.test(ign)) return S.send(res, 400, { error: 'In-game name must be 3–16 letters, numbers or _.' })
      if (!EMAIL.test(email)) return S.send(res, 400, { error: 'Enter a valid Gmail address.' })
      if (!DEVICE.test(device)) return S.send(res, 400, { error: 'Enter your Device ID (16 characters, from Xion Launcher → Settings → Xion Premium).' })

      const c = await findCode(b.code)
      if (c && c.invalid) return S.send(res, 400, { error: 'That redeem code is not valid or has been used up.' })
      const amount = priceWith(c, currency)
      let method = S.clean(b.method, 20), payer = '', trx = '', shot = null
      if (amount > 0) {
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

      if (!(await rateLimit(req))) return S.send(res, 429, { error: 'Too many orders from your network. Try again in an hour.' })

      const oid = S.id(8), token = S.id(16)
      if (shot) await S.writeBytes(`shop/shots/${oid}`, shot.data, shot.type)
      const order = {
        id: oid, token, created: Date.now(), status: 'pending', name, ign, email, device,
        currency, amount, method, payer, trx, code: c ? c.code : '', shot: !!shot, key: '',
        messages: [{ from: 'system', text: amount > 0 ? 'Order received. We will check your payment and send your license key here.' : 'Order received with a free code. Your license key will be sent here soon.', at: Date.now() }],
        unread: true
      }
      await S.writeJSON(`shop/orders/${oid}.json`, order)
      if (c) {
        const codes = await S.readJSON('shop/codes.json', [])
        const x = codes.find(k => k.code === c.code)
        if (x) { x.uses = (x.uses || 0) + 1; await S.writeJSON('shop/codes.json', codes) }
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
      await S.writeJSON(`shop/orders/${o.id}.json`, o)
      return S.send(res, 200, publicOrder(o))
    }

    return S.send(res, 400, { error: 'Unknown action' })
  } catch (e) {
    console.error(e)
    return S.send(res, 500, { error: 'Something went wrong. Please try again.' })
  }
}
