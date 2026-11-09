const fs = require('fs')
const path = require('path')
const { getJSON, downloadFile, pool } = require('./download')
const zip = require('./zip')

const API = 'https://api.modrinth.com/v2'
const MANIFEST = '.xion-managed.json'

// The Xion optimization pack. `on` is the default state for new profiles.
const CATALOG = [
  { slug: 'sodium', name: 'Sodium', cat: 'Performance', on: true, desc: 'Modern rendering engine — huge FPS boost' },
  { slug: 'lithium', name: 'Lithium', cat: 'Performance', on: true, desc: 'Optimizes game logic, physics and AI' },
  { slug: 'ferrite-core', name: 'FerriteCore', cat: 'Performance', on: true, desc: 'Cuts memory usage dramatically' },
  { slug: 'entityculling', name: 'Entity Culling', cat: 'Performance', on: true, desc: 'Skips rendering hidden entities' },
  { slug: 'immediatelyfast', name: 'ImmediatelyFast', cat: 'Performance', on: true, desc: 'Faster HUD, text and entity rendering' },
  { slug: 'moreculling', name: 'More Culling', cat: 'Performance', on: true, desc: 'Culls more block faces and leaves' },
  { slug: 'modernfix', name: 'ModernFix', cat: 'Performance', on: true, desc: 'Faster startup, lower memory' },
  { slug: 'dynamic-fps', name: 'Dynamic FPS', cat: 'Performance', on: true, desc: 'Saves power when the game is in background' },
  { slug: 'krypton', name: 'Krypton', cat: 'Performance', on: true, desc: 'Optimized networking stack' },
  { slug: 'badoptimizations', name: 'BadOptimizations', cat: 'Performance', on: true, desc: 'Many small CPU optimizations' },
  { slug: 'starlight', name: 'Starlight', cat: 'Performance', on: true, desc: 'Rewritten light engine (up to 1.20.1)' },
  { slug: 'noisium', name: 'Noisium', cat: 'Performance', on: true, desc: 'Faster world generation' },
  { slug: 'lazydfu', name: 'LazyDFU', cat: 'Performance', on: true, desc: 'Faster startup on older versions' },
  { slug: 'ksyxis', name: 'Ksyxis', cat: 'Performance', on: true, desc: 'Loads worlds faster' },
  { slug: 'fastquit', name: 'FastQuit', cat: 'Performance', on: true, desc: 'Instantly leave worlds, save in background' },
  { slug: 'scalablelux', name: 'ScalableLux', cat: 'Performance', on: true, desc: 'Multithreaded light engine (1.21+)' },
  // Off: on the client VMP swaps the game clock and holds back packet flushes, which made keys feel late and repeated.
  { slug: 'vmp-fabric', name: 'Very Many Players', cat: 'Performance', on: false, desc: 'Server-side tuning for many players (can make input feel laggy)' },
  { slug: 'clumps', name: 'Clumps', cat: 'Performance', on: true, desc: 'Merges XP orbs to cut lag spikes' },
  { slug: 'fast-ip-ping', name: 'Fast IP Ping', cat: 'Performance', on: true, desc: 'Server list pings instantly' },
  { slug: 'lazy-language-loader', name: 'Lazy Language Loader', cat: 'Performance', on: true, desc: 'Faster startup and language switching' },
  { slug: 'memoryleakfix', name: 'Memory Leak Fix', cat: 'Performance', on: true, desc: 'Plugs memory leaks that cause stutter over time' },
  { slug: 'debugify', name: 'Debugify', cat: 'Performance', on: true, desc: 'Fixes hundreds of vanilla bugs and slowdowns' },
  { slug: 'particle-core', name: 'Particle Core', cat: 'Performance', on: true, desc: 'Culls and batches particles for big FPS gains' },
  { slug: 'entity-view-distance', name: 'Entity View Distance', cat: 'Performance', on: true, desc: 'Stops rendering far-away mobs and items' },
  { slug: 'exordium', name: 'Exordium', cat: 'Performance', on: false, desc: 'Renders the HUD at a lower frame rate (big iGPU boost)' },
  { slug: 'ixeris', name: 'Ixeris', cat: 'Performance', on: false, desc: 'Moves window event polling off the render thread' },
  { slug: 'threadtweak', name: 'ThreadTweak', cat: 'Performance', on: false, desc: 'Tunes thread priorities' },
  { slug: 'enhancedblockentities', name: 'Enhanced Block Entities', cat: 'Performance', on: false, desc: 'Faster chests, signs and beds' },
  { slug: 'c2me-fabric', name: 'C2ME', cat: 'Performance', on: false, desc: 'Multithreaded chunk generation (experimental)' },
  { slug: 'iris', name: 'Iris Shaders', cat: 'Visual', on: true, desc: 'Shader pack support' },
  { slug: 'sodium-extra', name: 'Sodium Extra', cat: 'Visual', on: true, desc: 'Extra video options: fog, particles, animations' },
  { slug: 'reeses-sodium-options', name: "Reese's Sodium Options", cat: 'Visual', on: true, desc: 'Beautiful video settings screen' },
  { slug: 'natural-motion-blur', name: 'Motion Blur', cat: 'Visual', on: true, desc: 'Smooth motion blur (strength in Mod Menu)' },
  { slug: 'lambdynamiclights', name: 'LambDynamicLights', cat: 'Visual', on: false, desc: 'Torches light up in your hand' },
  { slug: 'modmenu', name: 'Mod Menu', cat: 'Utility', on: true, desc: 'Browse and configure installed mods' },
  { slug: 'zoomify', name: 'Zoomify', cat: 'Utility', on: true, desc: 'Smooth zoom key (C)' },
  { slug: 'appleskin', name: 'AppleSkin', cat: 'Utility', on: true, desc: 'Shows food saturation and hunger' },
  { slug: 'freelook', name: 'Freelook', cat: 'Utility', on: true, desc: 'Hold a key to look around without turning (set it in Controls)' },
  { slug: 'simple-voice-chat', name: 'Voice Chat', cat: 'Social', on: true, desc: 'Talk in game: Caps Lock push-to-talk, V for settings. Works in your worlds, LAN and servers with voice chat' }
]
const ALWAYS = ['fabric-api']
// When a mod has no build for a game version, this one stands in (Freelook and Natural Motion Blur start at 1.19.4).
const FALLBACK = { freelook: 'perspective-mod-redux', 'natural-motion-blur': 'motionblur' }

const defaultSelection = () => CATALOG.filter(m => m.on).map(m => m.slug)

async function latestVersion (project, game, loader = 'fabric') {
  const loaders = `loaders=${encodeURIComponent(JSON.stringify([loader]))}`
  const qs = `${loaders}&game_versions=${encodeURIComponent(JSON.stringify([game]))}`
  const list = await getJSON(`${API}/project/${encodeURIComponent(project)}/version?${qs}`)
  return list.find(v => v.version_type === 'release') || list[0] || null
}

// Resolves the selected mods plus their required dependencies for a game version.
async function resolve (slugs, game, log, loader = 'fabric', always = ALWAYS) {
  const want = [...new Set([...always, ...slugs])]
  const resolved = new Map() // project_id -> { slug, file }
  const queue = [...want]
  const seen = new Set()
  const skipped = []
  while (queue.length) {
    const batch = queue.splice(0, 8).filter(p => !seen.has(p))
    batch.forEach(p => seen.add(p))
    await Promise.all(batch.map(async p => {
      let v
      try { v = await latestVersion(p, game, loader) } catch { v = null }
      if (!v && FALLBACK[p] && !seen.has(FALLBACK[p])) { queue.push(FALLBACK[p]); return }
      if (!v) { if (want.includes(p) || Object.values(FALLBACK).includes(p)) skipped.push(p); return }
      if (resolved.has(v.project_id)) return
      const file = v.files.find(f => f.primary) || v.files[0]
      resolved.set(v.project_id, { slug: p, projectId: v.project_id, version: v.version_number, file })
      seen.add(v.project_id)
      for (const d of v.dependencies || []) {
        if (d.dependency_type === 'required' && d.project_id && !seen.has(d.project_id)) queue.push(d.project_id)
      }
    }))
  }
  if (skipped.length && log) log(`[Xion] Not yet available for ${game}: ${skipped.join(', ')}`)
  return [...resolved.values()]
}

function readManifest (dir) {
  try { return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8')) } catch { return { files: [] } }
}

// Syncs Xion-managed jars in an instance's mods folder. User-added jars are never touched.
async function sync ({ modsDir, game, slugs, bundled, blocked = [], onProgress, log, loader = 'fabric', always = ALWAYS }) {
  fs.mkdirSync(modsDir, { recursive: true })
  const prev = readManifest(modsDir)
  const key = JSON.stringify({ game, loader, always, slugs: [...slugs].sort(), bundled: bundled.map(b => path.basename(b)), blocked })
  const copyBundled = () => bundled.forEach(b => fs.copyFileSync(b, path.join(modsDir, path.basename(b))))
  const cacheFresh = prev.key === key && prev.time && Date.now() - prev.time < 6 * 3600 * 1000 &&
    prev.files.every(f => fs.existsSync(path.join(modsDir, f)) || fs.existsSync(path.join(modsDir, f + '.disabled')))
  if (cacheFresh) {
    // Bundled jars are cheap to copy and may have changed with a launcher update.
    copyBundled()
    const n = prev.files.length
    await fixMissingDeps(modsDir, game, prev.files, log, loader)
    if (prev.files.length !== n) fs.writeFileSync(path.join(modsDir, MANIFEST), JSON.stringify(prev, null, 2))
    return prev.files
  }

  let mods = []
  try {
    mods = (await resolve(slugs, game, log, loader, always)).filter(m => !blocked.includes(m.file.filename))
  } catch (e) {
    // Offline: keep whatever was installed last time.
    log && log('[Xion] Could not reach Modrinth, using installed mods: ' + e.message)
    return prev.files
  }
  const files = []
  // Optional mods must never block a launch: a failed download is skipped (Fabric API is required).
  const jobs = mods.map(m => async () => {
    try {
      // Switched off by the player (in game or in the launcher): keep it off, don't download it again.
      if (fs.existsSync(path.join(modsDir, m.file.filename + '.disabled'))) { files.push(m.file.filename); return }
      await downloadFile(m.file.url, path.join(modsDir, m.file.filename), m.file.hashes.sha1)
      files.push(m.file.filename)
    } catch (e) {
      if (always.includes(m.slug)) throw new Error(`Could not download ${m.slug}: ` + e.message)
      log && log(`[Xion] Skipped ${m.slug} this launch (download failed: ${e.message})`)
    }
  })
  await pool(jobs, 6, onProgress)
  copyBundled()
  files.push(...bundled.map(b => path.basename(b)))
  for (const old of prev.files) {
    if (!files.includes(old)) {
      try { fs.unlinkSync(path.join(modsDir, old)) } catch {}
      try { fs.unlinkSync(path.join(modsDir, old + '.disabled')) } catch {}
    }
  }
  await fixMissingDeps(modsDir, game, files, log, loader)
  fs.writeFileSync(path.join(modsDir, MANIFEST), JSON.stringify({ key, time: Date.now(), files }, null, 2))
  log && log(`[Xion] Optimization pack ready: ${mods.map(m => m.slug).join(', ')}`)
  return files
}

// Mod ids whose Modrinth slug differs from the id in fabric.mod.json.
const ID_TO_SLUG = {
  'cloth-config2': 'cloth-config',
  yet_another_config_lib_v3: 'yacl',
  'fabric-language-kotlin': 'fabric-language-kotlin',
  'fabric-api': 'fabric-api',
  sodium: 'sodium',
  iris: 'iris',
  modmenu: 'modmenu',
  architectury: 'architectury-api',
  placeholder_api: 'placeholder-api',
  'placeholder-api': 'placeholder-api',
  owo: 'owo-lib'
}
const BUILTIN = new Set(['minecraft', 'java', 'fabricloader', 'fabric', 'quilt_loader'])

/**
 * Some mods require dependencies that Modrinth doesn't list. Reads every managed jar's
 * fabric.mod.json, installs missing dependencies, and drops managed mods that still can't load.
 */
async function fixMissingDeps (modsDir, game, files, log, loader = 'fabric') {
  for (let round = 0; round < 3; round++) {
    const provided = new Set(BUILTIN)
    const needs = new Map() // dep id -> [mod files needing it]
    const jars = fs.readdirSync(modsDir).filter(f => f.endsWith('.jar'))
    for (const f of jars) zip.providedIds(path.join(modsDir, f)).forEach(id => provided.add(id))
    for (const f of jars) {
      const meta = zip.modMeta(path.join(modsDir, f))
      for (const dep of Object.keys((meta && meta.depends) || {})) {
        if (!provided.has(dep)) needs.set(dep, [...(needs.get(dep) || []), f])
      }
    }
    if (!needs.size) return
    let fixed = 0
    for (const [dep, dependents] of needs) {
      let v = null
      try { v = await latestVersion(ID_TO_SLUG[dep] || dep, game, loader) } catch {}
      if (v) {
        const file = v.files.find(x => x.primary) || v.files[0]
        try {
          await downloadFile(file.url, path.join(modsDir, file.filename), file.hashes.sha1)
          if (!files.includes(file.filename)) files.push(file.filename)
          log && log(`[Xion] Added missing dependency ${dep}`)
          fixed++
        } catch (e) {
          log && log(`[Xion] Could not download dependency ${dep}: ${e.message}`)
        }
      } else {
        for (const f of dependents) {
          if (!files.includes(f) || f.startsWith('xion-client-')) continue
          try { fs.unlinkSync(path.join(modsDir, f)) } catch {}
          files.splice(files.indexOf(f), 1)
          log && log(`[Xion] Skipped ${f}: needs ${dep}, which isn't available for ${game}`)
        }
      }
    }
    if (!fixed) return
  }
}

// Lists jars in a mods folder, flagging which ones Xion manages.
function list (modsDir) {
  if (!fs.existsSync(modsDir)) return []
  const managed = new Set(readManifest(modsDir).files)
  return fs.readdirSync(modsDir)
    .filter(f => /\.jar(\.disabled)?$/i.test(f))
    .map(f => ({ file: f, enabled: !f.endsWith('.disabled'), managed: managed.has(f), size: fs.statSync(path.join(modsDir, f)).size }))
    .sort((a, b) => a.managed - b.managed || a.file.localeCompare(b.file))
}

// Mods switched on/off from the Xion Client menu (Right Shift → Mods). The game can't unload mods,
// so it writes config/xion-mod-toggles.json ({ mods: { <modId>: true|false } }) and we apply it here,
// before the game starts, then remove the file. Xion Client and Fabric API are never switched off.
const NEVER_OFF = new Set(['xionclient', 'fabric-api', 'fabric-language-kotlin'])
function applyToggles (modsDir, file, log) {
  let wanted
  try { wanted = JSON.parse(fs.readFileSync(file, 'utf8')).mods || {} } catch { return }
  const ids = Object.keys(wanted)
  if (!ids.length) { try { fs.unlinkSync(file) } catch {}; return }
  const done = []
  for (const f of fs.readdirSync(modsDir).filter(x => /\.jar(\.disabled)?$/i.test(x))) {
    const meta = zip.modMeta(path.join(modsDir, f))
    if (!meta || !meta.id || !(meta.id in wanted) || NEVER_OFF.has(meta.id)) continue
    const off = f.endsWith('.disabled')
    const on = wanted[meta.id] === true
    if (on === !off) continue
    const src = path.join(modsDir, f)
    const dst = on ? src.slice(0, -9) : src + '.disabled'
    try {
      try { fs.unlinkSync(dst) } catch {}
      fs.renameSync(src, dst)
      done.push(`${on ? '+' : '-'}${meta.name || meta.id}`)
    } catch (e) {
      log && log(`[Xion] Could not switch ${meta.id}: ${e.message}`)
    }
  }
  if (done.length && log) log('[Xion] Mods switched from the in-game menu: ' + done.join(', '))
  try { fs.unlinkSync(file) } catch {}
}

function toggle (modsDir, file) {
  const src = path.join(modsDir, file)
  const dst = file.endsWith('.disabled') ? src.slice(0, -9) : src + '.disabled'
  fs.renameSync(src, dst)
}

module.exports = { CATALOG, defaultSelection, sync, list, toggle, resolve, applyToggles }
