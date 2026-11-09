// Xion Client presence: lets players who run Xion Client see each other's badge.
//   POST { id, key }  heartbeat: id is the player's UUID (32 hex), key an optional Xion+ license (only checked, never stored)
//   GET               { o: ["<uuid>p" | "<uuid>f", ...] } players seen in the last few minutes (p = Xion+, f = free)
// Players live in one Redis sorted set "presence": member "<uuid><p|f>", score = last heartbeat time.
// Redis commands are metered on the free plan, so a heartbeat only becomes a write every REFRESH per player
// on a warm instance, and the online list is cached instead of read every time.
const crypto = require('crypto')
const S = require('./_store')
const kv = require('../lib/kv')

const ID = /^[0-9a-f]{32}$/
const TTL = 20 * 60 * 1000
const REFRESH = 12 * 60 * 1000
const LIST_CACHE = 2 * 60 * 1000
const PUBLIC_KEY = 'a5cn2efk6Jh2DpcxBDUHDQPOVIGFE5Xhdz+uMkp8wa4='
const KEY = /^XION-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/

const seen = new Map() // "<id><p|f>" -> time of the last stored heartbeat (this instance)
let cache = null // { at, online }

function isPro (key) {
  const m = KEY.exec(String(key || '').trim())
  if (!m) return false
  try {
    const spki = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), Buffer.from(PUBLIC_KEY, 'base64')])
    const pub = crypto.createPublicKey({ key: spki, format: 'der', type: 'spki' })
    return crypto.verify(null, Buffer.from(m[1], 'base64url'), pub, Buffer.from(m[2], 'base64url'))
  } catch {
    return false
  }
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'POST') {
      const b = req.body && typeof req.body === 'object' ? req.body : {}
      const id = String(b.id || '').replace(/-/g, '').toLowerCase()
      if (!ID.test(id)) return S.send(res, 400, { error: 'bad id' })
      const pro = isPro(b.key)
      const k = id + (pro ? 'p' : 'f')
      if (Date.now() - (seen.get(k) || 0) > REFRESH) {
        await kv.cmd('ZADD', 'presence', Date.now(), k)
        // A player who switched tier shouldn't linger under the old one.
        if (seen.has(id + (pro ? 'f' : 'p'))) await kv.cmd('ZREM', 'presence', id + (pro ? 'f' : 'p'))
        if (seen.size > 5000) seen.clear()
        seen.set(k, Date.now())
      }
      return S.send(res, 200, { ok: true, pro })
    }
    const now = Date.now()
    res.setHeader('Cache-Control', 'public, s-maxage=180, stale-while-revalidate=600')
    if (cache && now - cache.at < LIST_CACHE) return res.status(200).json({ o: cache.online })
    await kv.cmd('ZREMRANGEBYSCORE', 'presence', '-inf', now - TTL)
    const members = await kv.cmd('ZRANGE', 'presence', 0, -1)
    // A player who switched tier shows once.
    const ids = new Set()
    const online = members.slice().reverse().filter(m => { const i = m.slice(0, 32); if (ids.has(i)) return false; ids.add(i); return true })
    cache = { at: now, online }
    return res.status(200).json({ o: online })
  } catch (e) {
    return S.send(res, 500, { error: 'presence unavailable' })
  }
}
