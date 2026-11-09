// Xion Store admin API. POST JSON { action, ... }; everything except "login" needs "Authorization: Bearer <token>".
//   login        {user, pass}                         5 wrong tries from one network locks it for 15 minutes
//   orders                                            every order, newest first
//   shot         {id}                                 payment screenshot as a data URL
//   update       {id, status?, reply?, read?}         approve (unlocks the items), reject (takes them back), reply
//   deleteOrder  {id}
//   players / player {name} / grant {name, item} / revoke {name, item} / resetKey {name}
//   codes / saveCode {code,type,value,maxUses,active} / deleteCode {code}
//   settings / saveSettings {bkash,nagad,upi,cardLink,note}
const C = require('./catalog')
const S = require('./_cos')

const STATUSES = ['pending', 'approved', 'rejected']
const OID = /^[0-9a-f]{16}$/
const strip = ({ token: _t, ...o }) => o

async function login (req, b) {
  const key = 'rl/login-' + S.sha(S.ip(req)).slice(0, 24) + '.json'
  // The lockout record is best effort: if storage is down, logging in still works.
  const r = await S.readJSON(key, { fails: 0, until: 0 }).catch(() => ({ fails: 0, until: 0 }))
  const save = v => S.writeJSON(key, v).catch(() => {})
  // Second guard that needs no storage: 8 tries per 15 minutes per network on a warm instance.
  if (!S.memLimit(req, 'login', 8, 15 * 60 * 1000)) return { status: 429, body: { error: 'Too many tries. Wait 15 minutes.' } }
  if (r.until > Date.now()) return { status: 429, body: { error: `Too many wrong tries. Wait ${Math.ceil((r.until - Date.now()) / 60000)} min.` } }
  const userOk = !!S.adminUser() && S.safeEq(S.clean(b.user, 40).toLowerCase(), S.adminUser().toLowerCase())
  const passOk = S.checkPassword(S.clean(b.pass, 100))
  if (!userOk || !passOk) {
    r.fails = (r.fails || 0) + 1
    if (r.fails >= 5) { r.fails = 0; r.until = Date.now() + 15 * 60 * 1000 }
    await save(r)
    await new Promise(res => setTimeout(res, 600))
    return { status: 401, body: { error: 'Wrong name or password.' } }
  }
  if (r.fails) await save({ fails: 0, until: 0 })
  return { status: 200, body: { token: S.sign(S.adminUser()) } }
}

// Creates the player on first purchase; returns { player, key } where key is set only when a new one was made.
async function ensurePlayer (ign) {
  let p = await S.getPlayer(ign)
  let key = ''
  if (!p) {
    key = S.newKey()
    p = { name: ign.toLowerCase(), display: ign, keyHash: S.sha(key), owned: [], equipped: {}, created: Date.now() }
  }
  return { p, key }
}

async function grantOrder (o) {
  const { p, key } = await ensurePlayer(o.ign)
  for (const it of o.grants || []) if (!p.owned.includes(it)) p.owned.push(it)
  // Wear the first new item of each slot that is still empty, so it shows up right away.
  p.equipped = p.equipped || {}
  for (const it of o.grants || []) { const x = C.byId(it); if (x && x.type && !p.equipped[x.type]) p.equipped[x.type] = it }
  await S.savePlayer(p)
  await S.updateWear(p)
  o.granted = true
  if (key) {
    o.lockerKey = key
    o.messages.push({ from: 'admin', text: `Payment approved! Your cosmetics are unlocked and already equipped on ${o.ign}. Your locker key is shown above: keep it safe, you need it to change what you wear.`, at: Date.now() })
  } else {
    o.messages.push({ from: 'admin', text: `Payment approved! The new cosmetics are in ${o.ign}'s locker. Use your existing locker key to equip them.`, at: Date.now() })
  }
}

async function revokeOrder (o) {
  const p = await S.getPlayer(o.ign)
  if (p) {
    // Only take back what no other granted order also gave.
    const others = (await Promise.all((await S.listAll('orders/')).map(x => S.readJSON(x.pathname))))
      .filter(x => x && x.id !== o.id && x.granted && x.ign.toLowerCase() === p.name).flatMap(x => x.grants || [])
    const keep = new Set([...others, ...(p.gifts || [])])
    p.owned = (p.owned || []).filter(i => keep.has(i) || !(o.grants || []).includes(i))
    for (const s of S.SLOTS) if (p.equipped && p.equipped[s] && !p.owned.includes(p.equipped[s])) delete p.equipped[s]
    await S.savePlayer(p)
    await S.updateWear(p)
  }
  o.granted = false
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return S.send(res, 405, { error: 'Method not allowed' })
    const b = req.body || {}
    if (b.action === 'login') { const r = await login(req, b); return S.send(res, r.status, r.body) }
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '')
    if (!S.verifySession(token)) return S.send(res, 401, { error: 'Please log in again.' })

    if (b.action === 'orders') {
      const orders = (await Promise.all((await S.listAll('orders/')).map(x => S.readJSON(x.pathname)))).filter(Boolean)
      orders.sort((a, c) => c.created - a.created)
      return S.send(res, 200, { orders: orders.map(strip) })
    }

    if (b.action === 'shot') {
      const oid = S.clean(b.id, 40)
      if (!OID.test(oid)) return S.send(res, 400, { error: 'Bad id' })
      const f = await S.readBytes(`shots/${oid}`)
      if (!f) return S.send(res, 404, { error: 'No screenshot' })
      return S.send(res, 200, { image: `data:${f.type};base64,${f.data.toString('base64')}` })
    }

    if (b.action === 'update') {
      const oid = S.clean(b.id, 40)
      const o = OID.test(oid) && await S.readJSON(`orders/${oid}.json`)
      if (!o) return S.send(res, 404, { error: 'Order not found' })
      if (b.status && STATUSES.includes(b.status) && b.status !== o.status) {
        o.status = b.status
        if (b.status === 'approved' && !o.granted) await grantOrder(o)
        if (b.status !== 'approved' && o.granted) await revokeOrder(o)
        if (b.status === 'rejected') o.messages.push({ from: 'system', text: 'Your payment could not be confirmed. Reply here if you think this is a mistake.', at: Date.now() })
      }
      const reply = S.clean(b.reply, 1000)
      if (reply) o.messages.push({ from: 'admin', text: reply, at: Date.now() })
      if (b.read) o.unread = false
      await S.writeJSON(`orders/${o.id}.json`, o)
      return S.send(res, 200, { order: strip(o) })
    }

    if (b.action === 'deleteOrder') {
      const oid = S.clean(b.id, 40)
      if (!OID.test(oid)) return S.send(res, 400, { error: 'Bad id' })
      await S.del([`orders/${oid}.json`, `shots/${oid}`]).catch(() => {})
      return S.send(res, 200, { ok: true })
    }

    if (b.action === 'players') {
      const players = (await Promise.all((await S.listAll('players/')).map(x => S.readJSON(x.pathname)))).filter(Boolean)
      players.sort((a, c) => (c.created || 0) - (a.created || 0))
      return S.send(res, 200, { players: players.map(({ keyHash: _k, ...p }) => p) })
    }

    if (['player', 'grant', 'revoke', 'resetKey'].includes(b.action)) {
      const name = S.clean(b.name, 16)
      if (!S.IGN.test(name)) return S.send(res, 400, { error: 'Enter a Minecraft name (3–16 letters, numbers or _).' })
      const made = await ensurePlayer(name)
      const p = made.p
      let key = made.key
      if (b.action === 'player' && key) return S.send(res, 404, { error: 'No player with that name yet.' })
      if (b.action === 'grant' || b.action === 'revoke') {
        const it = C.byId(S.clean(b.item, 40))
        if (!it) return S.send(res, 400, { error: 'Unknown item.' })
        const ids = it.items || [it.id]
        p.gifts = p.gifts || []
        if (b.action === 'grant') for (const i of ids) { if (!p.owned.includes(i)) p.owned.push(i); if (!p.gifts.includes(i)) p.gifts.push(i) }
        else {
          p.owned = p.owned.filter(i => !ids.includes(i))
          p.gifts = p.gifts.filter(i => !ids.includes(i))
          for (const s of S.SLOTS) if (p.equipped[s] && !p.owned.includes(p.equipped[s])) delete p.equipped[s]
        }
      }
      if (b.action === 'resetKey') { key = S.newKey(); p.keyHash = S.sha(key) }
      if (b.action !== 'player') { await S.savePlayer(p); await S.updateWear(p) }
      const { keyHash: _k, ...out } = p
      return S.send(res, 200, { player: out, newKey: key || '' })
    }

    if (b.action === 'codes') return S.send(res, 200, { codes: await S.readJSON('codes.json', []) })

    if (b.action === 'saveCode') {
      const code = S.clean(b.code, 40).toUpperCase().replace(/[^A-Z0-9_-]/g, '')
      if (code.length < 3) return S.send(res, 400, { error: 'Code needs at least 3 letters or numbers.' })
      const type = b.type === 'free' ? 'free' : 'percent'
      const value = type === 'free' ? 100 : Math.max(1, Math.min(99, Math.round(Number(b.value) || 0)))
      const codes = await S.readJSON('codes.json', [])
      const old = codes.find(c => c.code === code)
      const entry = { code, type, value, maxUses: Math.max(0, Math.round(Number(b.maxUses) || 0)), uses: old ? old.uses : 0, active: b.active !== false, created: old ? old.created : Date.now() }
      if (old) Object.assign(old, entry); else codes.unshift(entry)
      await S.writeJSON('codes.json', codes)
      return S.send(res, 200, { codes })
    }

    if (b.action === 'deleteCode') {
      const code = S.clean(b.code, 40).toUpperCase()
      const codes = (await S.readJSON('codes.json', [])).filter(c => c.code !== code)
      await S.writeJSON('codes.json', codes)
      return S.send(res, 200, { codes })
    }

    if (b.action === 'settings') return S.send(res, 200, { settings: await S.settings() })

    if (b.action === 'saveSettings') {
      const st = { bkash: S.clean(b.bkash, 30), nagad: S.clean(b.nagad, 30), upi: S.clean(b.upi, 80), cardLink: S.clean(b.cardLink, 300), note: S.clean(b.note, 300) }
      if (st.cardLink && !/^https:\/\//.test(st.cardLink)) return S.send(res, 400, { error: 'Card payment link must start with https://' })
      await S.writeJSON('settings.json', st)
      return S.send(res, 200, { settings: await S.settings() })
    }

    return S.send(res, 400, { error: 'Unknown action' })
  } catch (e) {
    console.error(e)
    return S.send(res, 500, { error: 'Server error' })
  }
}
