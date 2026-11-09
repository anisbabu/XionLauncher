// Xion+ shop admin API. POST JSON { action, ... }; everything except "login" needs "Authorization: Bearer <token>".
//   login     {user, pass}                       5 wrong tries from one network locks it for 15 minutes
//   orders                                       every order, newest first
//   shot      {id}                               payment screenshot as a data URL
//   update    {id, status?, key?, reply?}        set status, send the license key, or reply
//   deleteOrder {id}                             removes an order and its screenshot
//   codes / saveCode {code,type,value,maxUses,active} / deleteCode {code}
//   settings / saveSettings {bkash,nagad,upi,cardLink,note}
const crypto = require('crypto')
const S = require('./_store')

const STATUSES = ['pending', 'approved', 'rejected', 'done']

async function login (req, b) {
  const key = 'shop/rl/login-' + crypto.createHash('sha256').update(S.ip(req)).digest('hex').slice(0, 24) + '.json'
  const r = await S.readJSON(key, { fails: 0, until: 0 })
  if (r.until > Date.now()) return { status: 429, body: { error: `Too many wrong tries. Wait ${Math.ceil((r.until - Date.now()) / 60000)} min.` } }
  const userOk = S.safeEq(S.clean(b.user, 40).toLowerCase(), String(process.env.ADMIN_USER || '').toLowerCase())
  const passOk = S.checkPassword(S.clean(b.pass, 100))
  if (!userOk || !passOk) {
    r.fails = (r.fails || 0) + 1
    if (r.fails >= 5) { r.fails = 0; r.until = Date.now() + 15 * 60 * 1000 }
    await S.writeJSON(key, r)
    await new Promise(res => setTimeout(res, 600))
    return { status: 401, body: { error: 'Wrong name or password.' } }
  }
  await S.writeJSON(key, { fails: 0, until: 0 })
  return { status: 200, body: { token: S.sign(process.env.ADMIN_USER) } }
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return S.send(res, 405, { error: 'Method not allowed' })
    const b = req.body || {}
    if (b.action === 'login') { const r = await login(req, b); return S.send(res, r.status, r.body) }

    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!S.verifySession(token)) return S.send(res, 401, { error: 'Please log in again.' })

    if (b.action === 'orders') {
      const blobs = await S.listAll('shop/orders/')
      const orders = (await Promise.all(blobs.map(x => S.readJSON(x.pathname)))).filter(Boolean)
      orders.sort((a, c) => c.created - a.created)
      return S.send(res, 200, { orders: orders.map(({ token: _t, ...o }) => o) })
    }

    if (b.action === 'shot') {
      const oid = S.clean(b.id, 40)
      if (!/^[0-9a-f]{16}$/.test(oid)) return S.send(res, 400, { error: 'Bad id' })
      const f = await S.readBytes(`shop/shots/${oid}`)
      if (!f) return S.send(res, 404, { error: 'No screenshot' })
      return S.send(res, 200, { image: `data:${f.type};base64,${f.data.toString('base64')}` })
    }

    if (b.action === 'update') {
      const oid = S.clean(b.id, 40)
      const o = /^[0-9a-f]{16}$/.test(oid) && await S.readJSON(`shop/orders/${oid}.json`)
      if (!o) return S.send(res, 404, { error: 'Order not found' })
      if (b.status && STATUSES.includes(b.status)) {
        o.status = b.status
        if (b.status === 'rejected') o.messages.push({ from: 'system', text: 'Your payment could not be confirmed. Reply here if you think this is a mistake.', at: Date.now() })
      }
      if (typeof b.key === 'string' && b.key.trim()) {
        const key = b.key.trim()
        if (!/^XION-[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return S.send(res, 400, { error: 'That is not a Xion license key (it starts with XION-).' })
        o.key = key
        o.status = 'done'
        o.messages.push({ from: 'admin', text: 'Your Xion+ license key is ready! Copy it from the box above, then open Xion Launcher → Settings → Xion Premium, paste it and click Activate.', at: Date.now() })
      }
      const reply = S.clean(b.reply, 1000)
      if (reply) o.messages.push({ from: 'admin', text: reply, at: Date.now() })
      if (b.read) o.unread = false
      await S.writeJSON(`shop/orders/${o.id}.json`, o)
      const { token: _t, ...out } = o
      return S.send(res, 200, { order: out })
    }

    if (b.action === 'deleteOrder') {
      const oid = S.clean(b.id, 40)
      if (!/^[0-9a-f]{16}$/.test(oid)) return S.send(res, 400, { error: 'Bad id' })
      await S.del([`shop/orders/${oid}.json`, `shop/shots/${oid}`]).catch(() => {})
      return S.send(res, 200, { ok: true })
    }

    if (b.action === 'codes') return S.send(res, 200, { codes: await S.readJSON('shop/codes.json', []) })

    if (b.action === 'saveCode') {
      const code = S.clean(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '')
      if (code.length < 3) return S.send(res, 400, { error: 'Code needs at least 3 letters or numbers.' })
      const type = b.type === 'free' ? 'free' : 'percent'
      const value = type === 'free' ? 100 : Math.max(1, Math.min(99, Math.round(Number(b.value) || 0)))
      const codes = await S.readJSON('shop/codes.json', [])
      const old = codes.find(c => c.code === code)
      const entry = { code, type, value, maxUses: Math.max(0, Math.round(Number(b.maxUses) || 0)), uses: old ? old.uses : 0, active: b.active !== false, created: old ? old.created : Date.now() }
      if (old) Object.assign(old, entry); else codes.unshift(entry)
      await S.writeJSON('shop/codes.json', codes)
      return S.send(res, 200, { codes })
    }

    if (b.action === 'deleteCode') {
      const code = S.clean(b.code, 40).toUpperCase()
      const codes = (await S.readJSON('shop/codes.json', [])).filter(c => c.code !== code)
      await S.writeJSON('shop/codes.json', codes)
      return S.send(res, 200, { codes })
    }

    if (b.action === 'settings') return S.send(res, 200, { settings: await S.settings() })

    if (b.action === 'saveSettings') {
      const st = { bkash: S.clean(b.bkash, 30), nagad: S.clean(b.nagad, 30), upi: S.clean(b.upi, 80), cardLink: S.clean(b.cardLink, 300), note: S.clean(b.note, 300) }
      if (st.cardLink && !/^https:\/\//.test(st.cardLink)) return S.send(res, 400, { error: 'Card payment link must start with https://' })
      await S.writeJSON('shop/settings.json', st)
      return S.send(res, 200, { settings: await S.settings() })
    }

    return S.send(res, 400, { error: 'Unknown action' })
  } catch (e) {
    console.error(e)
    return S.send(res, 500, { error: 'Server error' })
  }
}
