// Storage for the Xion website APIs: Upstash Redis over its REST API (added from the Vercel Marketplace).
// Keys keep the old Blob path names ("shop/orders/<id>.json", "store/players/<name>.json", ...).
// Binary files (payment screenshots) are stored as "<content-type>;<base64>".
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || ''
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

async function cmd (...args) {
  if (!URL_ || !TOKEN) throw new Error('Storage is not connected (Upstash Redis env vars missing).')
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(args)
  })
  let j = {}
  try { j = await r.json() } catch {}
  if (!r.ok || j.error) throw new Error('Redis: ' + (j.error || 'HTTP ' + r.status))
  return j.result
}

async function readJSON (key, fallback = null) {
  const v = await cmd('GET', key)
  if (v == null) return fallback
  try { return JSON.parse(v) } catch { return fallback }
}
const writeJSON = (key, data) => cmd('SET', key, JSON.stringify(data))

async function readBytes (key) {
  const v = await cmd('GET', key)
  if (v == null) return null
  const i = v.indexOf(';')
  return { type: v.slice(0, i), data: Buffer.from(v.slice(i + 1), 'base64') }
}
const writeBytes = (key, buf, contentType) => cmd('SET', key, contentType + ';' + Buffer.from(buf).toString('base64'))

// Every key under a prefix, as [{ pathname }] like the Blob list it replaces.
async function listAll (prefix) {
  const out = []
  let cursor = '0'
  const pattern = prefix.replace(/[*?[\]\\]/g, '\\$&') + '*'
  do {
    const [next, keys] = await cmd('SCAN', cursor, 'MATCH', pattern, 'COUNT', 1000)
    cursor = String(next)
    for (const k of keys) out.push({ pathname: k })
  } while (cursor !== '0')
  return out
}

const del = keys => { const ks = [].concat(keys); return ks.length ? cmd('DEL', ...ks) : Promise.resolve(0) }

module.exports = { cmd, readJSON, writeJSON, readBytes, writeBytes, listAll, del }
