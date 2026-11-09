const fs = require('fs')
const path = require('path')
const { getJSON } = require('./download')

const MANIFEST = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const META = {
  fabric: 'https://meta.fabricmc.net/v2',
  quilt: 'https://meta.quiltmc.org/v3'
}

const cache = {}
async function cached (key, fn, ttl = 10 * 60 * 1000) {
  const c = cache[key]
  if (c && Date.now() - c.t < ttl) return c.v
  const v = await fn()
  cache[key] = { v, t: Date.now() }
  return v
}

const manifest = () => cached('manifest', () => getJSON(MANIFEST))

async function vanillaVersions () {
  const m = await manifest()
  return { latest: m.latest, versions: m.versions.map(v => ({ id: v.id, type: v.type, time: v.releaseTime })) }
}

async function resolveVersion (id) {
  const m = await manifest()
  if (id === 'latest-release') return m.latest.release
  if (id === 'latest-snapshot') return m.latest.snapshot
  return id
}

async function versionJSON (id) {
  const m = await manifest()
  const entry = m.versions.find(v => v.id === id)
  if (!entry) throw new Error(`Unknown Minecraft version: ${id}`)
  return cached('vj:' + id, () => getJSON(entry.url), 24 * 3600 * 1000)
}

async function loaderGameVersions (loader) {
  return cached(loader + ':games', async () => {
    const list = await getJSON(`${META[loader]}/versions/game`)
    return list.map(v => ({ id: v.version, stable: v.stable }))
  })
}

async function loaderVersions (loader, game) {
  return cached(`${loader}:loaders:${game}`, async () => {
    if (loader === 'fabric') {
      const list = await getJSON(`${META.fabric}/versions/loader/${encodeURIComponent(game)}`)
      return list.map(x => ({ id: x.loader.version, stable: x.loader.stable }))
    }
    const list = await getJSON(`${META.quilt}/versions/loader/${encodeURIComponent(game)}`)
    return list.map(x => ({ id: x.loader.version, stable: !/beta|alpha|pre|rc/i.test(x.loader.version) }))
  })
}

// Writes the loader's version profile into <root>/versions and returns its id.
async function installLoader (root, loader, game, loaderVersion) {
  const list = await loaderVersions(loader, game)
  if (!list.length) throw new Error(`${loader} does not support Minecraft ${game} yet.`)
  let lv = loaderVersion
  if (!lv || lv === 'latest') lv = (list.find(l => l.stable) || list[0]).id
  const profile = await getJSON(`${META[loader]}/versions/loader/${encodeURIComponent(game)}/${encodeURIComponent(lv)}/profile/json`)
  const id = profile.id
  const dir = path.join(root, 'versions', id)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(profile, null, 2))
  return { id, loaderVersion: lv }
}

module.exports = { vanillaVersions, resolveVersion, versionJSON, loaderGameVersions, loaderVersions, installLoader }
