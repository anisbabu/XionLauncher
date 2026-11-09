// Public, cached "who wears what". No secrets here: this is what everyone is allowed to see.
//   GET /api/wear                → { players: { "<lowercase name>": { d: "Display", cape, hat, wings, aura } }, updated, capes: { id: frames } }
//   GET /api/wear?name=<ign>     → { name, display, equipped, owned } for the profile page
const S = require('./_cos')
const C = require('./catalog')
// Animation frame count of every store cape, so game clients know which PNGs to fetch.
const CAPES = Object.fromEntries(C.ITEMS.filter(i => i.type === 'cape').map(i => [i.id, i.frames]))

module.exports = async (req, res) => {
  try {
    const name = S.clean((req.query || {}).name, 16)
    if (name) {
      if (!S.IGN.test(name)) return S.send(res, 400, { error: 'bad name' })
      const p = await S.getPlayer(name)
      res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=120')
      if (!p) return res.status(200).json({ name: name.toLowerCase(), display: name, equipped: {}, owned: [] })
      return res.status(200).json({ name: p.name, display: p.display, equipped: p.equipped || {}, owned: p.owned || [] })
    }
    const w = await S.readJSON('wear.json', { players: {} })
    // Every Xion Client polls this, so the CDN answers most of it (blob reads are metered).
    res.setHeader('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=600')
    res.setHeader('Access-Control-Allow-Origin', '*')
    return res.status(200).json({ ...w, capes: CAPES })
  } catch (e) {
    console.error(e)
    return S.send(res, 500, { error: 'wear unavailable' })
  }
}
