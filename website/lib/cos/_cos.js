// Shared helpers for the Xion Store (cosmetics) API: Redis storage (lib/kv.js), players, the public "wear" index,
// signed admin sessions. Served by api/cosmetics.js on the Xion website, which owns the Blob store.
const crypto = require('crypto')
const kv = require('../kv')

// Everything for the store lives under "store/" in the shared Redis database.
const NS = 'store/'
const P = p => NS + p
const readJSON = (p, fallback = null) => kv.readJSON(P(p), fallback)
const writeJSON = (p, data) => kv.writeJSON(P(p), data)
const readBytes = p => kv.readBytes(P(p))
const writeBytes = (p, buf, type) => kv.writeBytes(P(p), buf, type)
const listAll = async prefix => (await kv.listAll(P(prefix))).map(x => ({ pathname: x.pathname.slice(NS.length) }))

const SYMBOL = { USD: '$', BDT: '৳', INR: '₹' }
const METHODS = { BDT: ['bkash', 'nagad'], INR: ['upi'], USD: ['card'] }
const DEFAULT_SETTINGS = { bkash: '', nagad: '', upi: '', cardLink: '', note: 'Send the exact amount, then fill in your transaction ID.' }
// Never let a storage hiccup hide the catalog: fall back to the defaults.
const settings = async () => ({ ...DEFAULT_SETTINGS, ...(await readJSON('settings.json', {}).catch(() => ({}))) })

const id = (n = 8) => crypto.randomBytes(n).toString('hex')
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex')
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y) }

// ── players ──
// players/<lowercase name>.json { name, display, keyHash, owned: [itemId], equipped: { cape, hat, wings, aura }, created }
const IGN = /^[A-Za-z0-9_]{3,16}$/
const SLOTS = ['cape', 'hat', 'wings', 'aura']
const playerPath = name => `players/${String(name).toLowerCase()}.json`
const getPlayer = name => IGN.test(String(name || '')) ? readJSON(playerPath(name)) : Promise.resolve(null)
const savePlayer = p => writeJSON(playerPath(p.name), p)

// Locker keys look like XS-ABCD-EFGH-JKLM; only their hash is stored.
const KEY_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newKey () {
  const b = crypto.randomBytes(12)
  let s = ''
  for (let i = 0; i < 12; i++) s += KEY_ABC[b[i] % KEY_ABC.length]
  return `XS-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`
}
const normKey = k => String(k || '').trim().toUpperCase()
const keyOk = (p, key) => !!(p && p.keyHash && safeEq(p.keyHash, sha(normKey(key))))

// The public wear index: one small JSON every client downloads. { players: { name: { cape, hat, wings, aura } } }
async function updateWear (p) {
  const w = await readJSON('wear.json', { players: {} })
  const eq = {}
  for (const s of SLOTS) if (p.equipped && p.equipped[s]) eq[s] = p.equipped[s]
  if (Object.keys(eq).length) w.players[p.name] = { d: p.display, ...eq }
  else delete w.players[p.name]
  w.updated = Date.now()
  await writeJSON('wear.json', w)
}

// ── admin sessions: HMAC-signed "user.expiry" tokens, 12 hours ──
const adminUser = () => String(process.env.COS_ADMIN_USER || '')
function sign (user) {
  const body = `cos-${user}.${Date.now() + 12 * 3600 * 1000}`
  return body + '.' + crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('hex')
}
function verifySession (token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return false
  const want = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(parts[0] + '.' + parts[1]).digest('hex')
  return parts[0].startsWith('cos-') && safeEq(want, parts[2]) && +parts[1] > Date.now()
}
function checkPassword (pass) {
  const [salt, hash] = String(process.env.COS_ADMIN_PASS_HASH || '').split(':')
  if (!salt || !hash) return false
  return safeEq(crypto.scryptSync(String(pass), salt, 32).toString('hex'), hash)
}

// Simple per-network limiter stored in blob: at most `max` hits per `windowMs`.
async function limit (req, name, max, windowMs) {
  const key = `rl/${name}-${sha(ip(req)).slice(0, 24)}.json`
  const now = Date.now()
  const r = await readJSON(key, { hits: [] })
  r.hits = r.hits.filter(t => now - t < windowMs)
  if (r.hits.length >= max) return false
  r.hits.push(now)
  await writeJSON(key, r)
  return true
}

// Same idea without a blob write per hit (per warm instance), for frequent calls like opening the locker.
const hits = new Map()
function memLimit (req, name, max, windowMs) {
  const k = name + ip(req), now = Date.now()
  const h = (hits.get(k) || []).filter(t => now - t < windowMs)
  if (h.length >= max) return false
  h.push(now)
  if (hits.size > 10000) hits.clear()
  hits.set(k, h)
  return true
}

const clean = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max)
const send = (res, status, data) => { res.status(status).setHeader('Cache-Control', 'no-store'); res.json(data) }
const ip = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'

module.exports = {
  readJSON, writeJSON, readBytes, writeBytes, listAll, del: paths => kv.del([].concat(paths).map(P)), SYMBOL, METHODS, settings, id, sha, safeEq,
  adminUser, IGN, SLOTS, getPlayer, savePlayer, newKey, normKey, keyOk, updateWear, sign, verifySession, checkPassword, limit, memLimit, clean, send, ip
}
