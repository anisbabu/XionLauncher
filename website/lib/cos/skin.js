// GET /api/skin?name=<ign> → the player's Minecraft skin PNG (via Mojang), so the 3D preview can show it
// without cross-origin trouble. Unknown names get 404 and the page falls back to the default skin.
const S = require('./_cos')

async function json (url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'XionStore' } })
  return r.ok ? r.json() : null
}

module.exports = async (req, res) => {
  try {
    const name = S.clean((req.query || {}).name, 16)
    if (!S.IGN.test(name)) return res.status(400).end()
    const prof = await json(`https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(name)}`)
    if (!prof || !prof.id) { res.setHeader('Cache-Control', 'public, s-maxage=3600'); return res.status(404).end() }
    const sess = await json(`https://sessionserver.mojang.com/session/minecraft/profile/${prof.id}`)
    const tex = sess && sess.properties && sess.properties.find(p => p.name === 'textures')
    const data = tex && JSON.parse(Buffer.from(tex.value, 'base64').toString('utf8'))
    const skin = data && data.textures && data.textures.SKIN
    if (!skin) return res.status(404).end()
    const img = await fetch(skin.url.replace(/^http:/, 'https:'))
    if (!img.ok) return res.status(404).end()
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('X-Skin-Model', skin.metadata && skin.metadata.model === 'slim' ? 'slim' : 'default')
    res.setHeader('Cache-Control', 'public, s-maxage=21600, stale-while-revalidate=86400')
    return res.status(200).send(Buffer.from(await img.arrayBuffer()))
  } catch (e) {
    return res.status(502).end()
  }
}
