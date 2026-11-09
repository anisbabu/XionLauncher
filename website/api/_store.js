// Shared helpers for the Xion shop API: storage, JSON bodies, ids and signed admin sessions.
// Files starting with "_" are not exposed as API routes by Vercel.
const crypto = require('crypto')
// Storage lives in Upstash Redis (lib/kv.js); keys keep the old Blob path names.
const { readJSON, writeJSON, readBytes, writeBytes, listAll, del } = require('../lib/kv')

// Prices per currency, and which payment methods each one offers.
const PRICES = { USD: 5, BDT: 150, INR: 350 }
const SYMBOL = { USD: '$', BDT: '৳', INR: '₹' }
const METHODS = { BDT: ['bkash', 'nagad'], INR: ['upi'], USD: ['card'] }

const DEFAULT_SETTINGS = {
  bkash: '', nagad: '', upi: '', cardLink: '',
  note: 'Send the exact amount, then fill in your transaction ID.'
}
const settings = async () => ({ ...DEFAULT_SETTINGS, ...(await readJSON('shop/settings.json', {})) })

const id = (n = 8) => crypto.randomBytes(n).toString('hex')
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y) }

// Admin sessions: HMAC-signed "user.expiry" tokens, 12 hours.
function sign (user) {
  const exp = Date.now() + 12 * 3600 * 1000
  const body = `${user}.${exp}`
  return body + '.' + crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('hex')
}
function verifySession (token) {
  const parts = String(token || '').split('.')
  if (parts.length !== 3) return false
  const body = parts[0] + '.' + parts[1]
  const want = crypto.createHmac('sha256', process.env.SESSION_SECRET).update(body).digest('hex')
  return safeEq(want, parts[2]) && +parts[1] > Date.now()
}
function checkPassword (pass) {
  const [salt, hash] = String(process.env.ADMIN_PASS_HASH || '').split(':')
  if (!salt || !hash) return false
  return safeEq(crypto.scryptSync(String(pass), salt, 32).toString('hex'), hash)
}

const clean = (v, max = 200) => String(v == null ? '' : v).trim().slice(0, max)
const send = (res, status, data) => { res.status(status).setHeader('Cache-Control', 'no-store'); res.json(data) }
const ip = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown'

module.exports = { readJSON, writeJSON, readBytes, writeBytes, listAll, del, PRICES, SYMBOL, METHODS, settings, id, safeEq, sign, verifySession, checkPassword, clean, send, ip }
