// Xion Store (cosmetics) API, one function for all of it: /api/cosmetics?r=shop|locker|wear|skin|admin
// The store site (xion-store.vercel.app) proxies its /api/<r> here, and the launcher calls it directly.
const routes = {
  shop: require('../lib/cos/shop'),
  locker: require('../lib/cos/locker'),
  wear: require('../lib/cos/wear'),
  skin: require('../lib/cos/skin'),
  admin: require('../lib/cos/admin')
}

module.exports = (req, res) => {
  const q = req.query || {}
  const r = routes[String(q.r || '')]
  if (!r) return res.status(404).json({ error: 'Unknown route' })
  return r(req, res)
}
