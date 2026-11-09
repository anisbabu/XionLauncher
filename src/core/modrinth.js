const fs = require('fs')
const path = require('path')
const { getJSON, downloadFile } = require('./download')
const mods = require('./mods')

const API = 'https://api.modrinth.com/v2'
const USER_MANIFEST = '.xion-user.json'
const LOADERS = new Set(['fabric', 'forge', 'neoforge', 'quilt', 'babric', 'liteloader', 'rift', 'modloader', 'bukkit', 'paper', 'spigot', 'velocity', 'bungeecord', 'folia', 'purpur', 'sponge', 'waterfall', 'datapack', 'iris', 'optifine', 'canvas', 'vanilla', 'minecraft'])

function readUser (dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, USER_MANIFEST), 'utf8')) } catch { return {} }
}

async function search ({ query, game, offset = 0, sort = 'downloads' }) {
  const facets = [['project_type:mod'], ['categories:fabric']]
  if (game) facets.push([`versions:${game}`])
  const qs = new URLSearchParams({ query: query || '', limit: '24', offset: String(offset), index: sort, facets: JSON.stringify(facets) })
  const r = await getJSON(`${API}/search?${qs}`)
  return {
    total: r.total_hits,
    hits: r.hits.map(h => ({
      id: h.project_id,
      slug: h.slug,
      title: h.title,
      description: h.description,
      icon: h.icon_url,
      downloads: h.downloads,
      author: h.author,
      categories: (h.display_categories || h.categories || []).filter(c => !LOADERS.has(c))
    }))
  }
}

// Installs a mod (and its required dependencies) into a profile's mods folder as a user mod.
async function install (modsDir, projectId, game, log) {
  fs.mkdirSync(modsDir, { recursive: true })
  const resolved = await mods.resolve([projectId], game, log)
  const main = resolved.find(m => m.projectId === projectId) || resolved.find(m => m.slug === projectId)
  if (!main) throw new Error('This mod has no version for Minecraft ' + game + '.')
  const present = new Set(fs.readdirSync(modsDir))
  const user = readUser(modsDir)
  for (const m of resolved) {
    if (present.has(m.file.filename)) continue
    await downloadFile(m.file.url, path.join(modsDir, m.file.filename), m.file.hashes.sha1)
    user[m.projectId] = m.file.filename
  }
  user[projectId] = main.file.filename
  fs.writeFileSync(path.join(modsDir, USER_MANIFEST), JSON.stringify(user, null, 2))
  return { file: main.file.filename, version: main.version }
}

function installedIds (modsDir) {
  const user = readUser(modsDir)
  return Object.keys(user).filter(id => fs.existsSync(path.join(modsDir, user[id])) || fs.existsSync(path.join(modsDir, user[id] + '.disabled')))
}

function uninstall (modsDir, projectId) {
  const user = readUser(modsDir)
  const f = user[projectId]
  if (f) {
    for (const p of [f, f + '.disabled']) { try { fs.unlinkSync(path.join(modsDir, p)) } catch {} }
    delete user[projectId]
    fs.writeFileSync(path.join(modsDir, USER_MANIFEST), JSON.stringify(user, null, 2))
  }
}

module.exports = { search, install, installedIds, uninstall }
