// The Xion Pack: Xion's own client-side resource pack, on by default (Settings → Xion Pack turns it off).
// It is generated for each game version from that version's client jar, so it always matches the game's textures:
//   - dark GUI: the grey parts of container, button and menu textures are recoloured to Xion's dark slate
//     (Xion Client draws the container titles light while the pack is selected)
//   - small held tools: swords, axes, pickaxes, shovels, hoes and rods sit lower and smaller in first person
//   - lower shield and a clear pumpkin overlay, so more of the screen stays visible
// The pack only replaces a few hundred small textures, so it adds no rendering cost.
const fs = require('fs')
const path = require('path')
const { nativeImage } = require('electron')
const zip = require('./zip')
const { downloadFile } = require('./download')

const NAME = 'Xion'
const ID = 'file/' + NAME
const REV = 2
const GUI = 'assets/minecraft/textures/gui/'

// Textures that must keep their colours: logo, HUD (crosshair, hearts), icons, toasts and screens whose text
// the game draws in dark colours on a light background.
const KEEP = [
  'title/', 'icons.png', 'sprites/hud/', 'sprites/icon/', 'presets/', 'hanging_signs/', 'advancements/backgrounds/',
  'realms/', 'sprites/realm_status/', 'sprites/player_list/', 'sprites/server_list/', 'sprites/notification/',
  'sprites/toast/', 'toasts.png', 'container/enchanting_table', 'sprites/container/enchanting_table/', 'book.png',
  'sprites/statistics/', 'sprites/spectator/', 'spectator_widgets.png', 'sprites/popup/', 'sprites/social_interactions/'
]

/** Grey 0..255 to Xion slate: monotonic, so highlights stay brighter than shadows. Black outlines stay black. */
function slate (v) {
  if (v === 0) return [0, 0, 0]
  const l = 14 + Math.pow(v / 255, 1.3) * 62
  return [l, l + 2, l + 7] // R, G, B with a cool tint
}

/** Recolours the near-grey pixels of a PNG; coloured pixels (items, icons, arrows) keep their colour. */
function darken (png) {
  const img = nativeImage.createFromBuffer(png)
  if (img.isEmpty()) return null
  const { width, height } = img.getSize()
  const px = img.toBitmap() // BGRA, premultiplied
  let changed = false
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]
    if (!a) continue
    const k = 255 / a
    const b = px[i] * k, g = px[i + 1] * k, r = px[i + 2] * k
    if (Math.max(r, g, b) - Math.min(r, g, b) > 14) continue
    const [nr, ng, nb] = slate(Math.round((r + g + b) / 3))
    const m = a / 255
    px[i] = Math.min(255, Math.round(nb * m))
    px[i + 1] = Math.min(255, Math.round(ng * m))
    px[i + 2] = Math.min(255, Math.round(nr * m))
    changed = true
  }
  return changed ? nativeImage.createFromBitmap(px, { width, height }).toPNG() : null
}

/** Fades a PNG's alpha (pumpkin overlay). */
function fade (png, keep) {
  const img = nativeImage.createFromBuffer(png)
  if (img.isEmpty()) return null
  const { width, height } = img.getSize()
  const px = img.toBitmap()
  for (let i = 0; i < px.length; i++) px[i] = Math.round(px[i] * keep) // premultiplied: scale every channel
  return nativeImage.createFromBitmap(px, { width, height }).toPNG()
}

const SMALL = {
  firstperson_righthand: { rotation: [0, -90, 25], translation: [2.4, 1.6, 1.3], scale: [0.5, 0.5, 0.5] },
  firstperson_lefthand: { rotation: [0, 90, -25], translation: [2.4, 1.6, 1.3], scale: [0.5, 0.5, 0.5] }
}

function write (dir, name, data) {
  const f = path.join(dir, name)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, data)
}

// 1.8.9 (Xion PvP) item models carry their own display; these get the small first-person pose.
const LEGACY_TOOL = /^assets\/minecraft\/models\/item\/(\w+_(sword|axe|pickaxe|shovel|hoe)|fishing_rod|carrot_on_a_stick|stick|blaze_rod|bone)\.json$/

/** Resource pack format of a client jar (version.json), or null. Versions before 1.14 have no version.json. */
function packFormat (jar, game) {
  if (/^1\.8(\.|$)/.test(game)) return 1
  try {
    const v = JSON.parse(zip.readEntry(jar, 'version.json').toString('utf8'))
    const p = v.pack_version
    if (typeof p === 'number') return p
    if (p && typeof p.resource === 'number') return p.resource
    if (p && typeof p.resource_major === 'number') return p.resource_major
  } catch {}
  return null
}

/**
 * 1.8.9 pack: small tools and a clear pumpkin. The GUI stays vanilla there, because without Xion Client
 * nothing would draw the container titles light on a dark background.
 */
function buildLegacy (jar, dir) {
  const entries = zip.readEntries(jar, n => LEGACY_TOOL.test(n) || n === 'assets/minecraft/textures/misc/pumpkinblur.png')
  let n = 0
  for (const e of entries) {
    if (e.name.endsWith('.png')) {
      const out = fade(e.data, 0.15)
      if (out) write(dir, e.name, out)
      continue
    }
    const model = JSON.parse(e.data.toString('utf8'))
    const fp = model.display && model.display.firstperson
    if (!fp) continue
    fp.scale = (fp.scale || [1.7, 1.7, 1.7]).map(v => +(v * 0.62).toFixed(3))
    const t = fp.translation || [0, 4, 2]
    fp.translation = [t[0] + 1, t[1] - 1.5, t[2] + 1]
    write(dir, e.name, JSON.stringify(model, null, 2))
    n++
  }
  return n
}

function build (jar, dir, game) {
  const format = packFormat(jar, game)
  if (!format) throw new Error('could not read the pack format of ' + game)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  let textures = 0
  const legacy = format < 4
  const entries = legacy ? [] : zip.readEntries(jar, n =>
    (n.startsWith(GUI) && n.endsWith('.png') && !KEEP.some(k => n.slice(GUI.length).startsWith(k))) ||
    n === 'assets/minecraft/textures/misc/pumpkinblur.png' ||
    /^assets\/minecraft\/models\/item\/(handheld|handheld_rod|shield)\.json$/.test(n))
  for (const e of entries) {
    if (e.name.endsWith('pumpkinblur.png')) {
      const out = fade(e.data, 0.15)
      if (out) write(dir, e.name, out)
    } else if (e.name.endsWith('.png')) {
      const out = darken(e.data)
      if (out) { write(dir, e.name, out); textures++ }
      const meta = zip.readEntry(jar, e.name + '.mcmeta') // keep nine-slice / animation info next to the texture
      if (out && meta) write(dir, e.name + '.mcmeta', meta)
    } else {
      const model = JSON.parse(e.data.toString('utf8'))
      if (/shield\.json$/.test(e.name)) {
        // Lower and further out, so it covers less of the screen.
        for (const k of ['firstperson_righthand', 'firstperson_lefthand']) {
          const d = model.display && model.display[k]
          if (d && Array.isArray(d.translation)) d.translation = [d.translation[0], d.translation[1] - 3, d.translation[2]]
        }
      } else {
        model.display = { ...(model.display || {}), ...SMALL }
      }
      write(dir, e.name, JSON.stringify(model, null, 2))
    }
  }

  if (legacy) textures = buildLegacy(jar, dir)
  const mcmeta = legacy
    ? { pack: { pack_format: format, description: '§bXion Pack§r\n§7Small tools · clear view' } }
    : { pack: { pack_format: format, min_format: format, max_format: format, description: '§bXion Pack§r\n§7Dark UI · small tools · clear view' } }
  write(dir, 'pack.mcmeta', JSON.stringify(mcmeta, null, 2))
  try {
    const icon = nativeImage.createFromPath(path.join(__dirname, '..', '..', 'build', 'icon.png'))
    if (!icon.isEmpty()) write(dir, 'pack.png', icon.resize({ width: 128, height: 128, quality: 'best' }).toPNG())
  } catch {}
  write(dir, '.xion-pack', `${REV}:${game}`)
  return textures
}

/** Adds or removes the pack from options.txt's resourcePacks (just above vanilla and mod packs, under the player's own). */
function select (gameDir, on) {
  const file = path.join(gameDir, 'options.txt')
  let text = ''
  try { text = fs.readFileSync(file, 'utf8') } catch {}
  const lines = text.split(/\r?\n/).filter((l, i, a) => l || i < a.length - 1)
  const i = lines.findIndex(l => l.startsWith('resourcePacks:'))
  let packs = ['vanilla']
  if (i >= 0) { try { packs = JSON.parse(lines[i].slice('resourcePacks:'.length)) } catch {} }
  const had = packs.includes(ID)
  packs = packs.filter(p => p !== ID)
  if (on) {
    let at = 0
    packs.forEach((p, n) => { if (!String(p).startsWith('file/')) at = n + 1 })
    packs.splice(at, 0, ID)
  }
  if (had === on && i >= 0) return
  const line = 'resourcePacks:' + JSON.stringify(packs)
  if (i >= 0) lines[i] = line; else lines.push(line)
  // A pack the game once flagged as incompatible stays hidden unless it leaves that list.
  const j = lines.findIndex(l => l.startsWith('incompatibleResourcePacks:'))
  if (j >= 0) {
    try { lines[j] = 'incompatibleResourcePacks:' + JSON.stringify(JSON.parse(lines[j].slice(26)).filter(p => p !== ID)) } catch {}
  }
  fs.writeFileSync(file, lines.join('\n') + '\n')
}

/**
 * Before a launch: builds the pack for this game version if needed and selects it (or deselects it when off).
 * Never stops a launch; on failure the game simply starts without the pack.
 */
async function prepare ({ root, gameDir, game, versionId, vj, enabled, log }) {
  const dir = path.join(gameDir, 'resourcepacks', NAME)
  try {
    if (enabled) {
      let have = ''
      try { have = fs.readFileSync(path.join(dir, '.xion-pack'), 'utf8') } catch {}
      if (have !== `${REV}:${game}`) {
        // Same place minecraft-launcher-core keeps the client jar, so it is downloaded only once.
        const jar = path.join(root, 'versions', versionId, versionId + '.jar')
        const dl = vj.downloads && vj.downloads.client
        if (!fs.existsSync(jar) && dl) {
          fs.mkdirSync(path.dirname(jar), { recursive: true })
          await downloadFile(dl.url, jar, dl.sha1)
        }
        const n = build(jar, dir, game)
        log && log(`[Xion] Xion Pack ready for ${game} (${n} ${/^1\.8/.test(game) ? 'small tools' : 'dark textures'})`)
      }
    }
    select(gameDir, enabled)
  } catch (e) {
    log && log('[Xion] Xion Pack skipped this launch: ' + e.message)
    try { select(gameDir, false) } catch {}
  }
}

module.exports = { prepare, build, select, ID }
