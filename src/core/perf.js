// Xion performance modes (Settings → Performance).
//   off    nothing changed
//   boost  free: tuned G1 garbage collector, Sodium fast weather; in game, the Xion Client applies the Boost preset
//   turbo  Xion+: low-pause GC tuning, Sodium fast leaves/weather; in game, the Turbo preset
const fs = require('fs')
const os = require('os')
const path = require('path')

const MODES = ['off', 'boost', 'turbo']

const effective = (mode, premium) => {
  const m = MODES.includes(mode) ? mode : 'boost'
  return m === 'turbo' && !premium ? 'boost' : m
}

const BASE_JVM = [
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=40',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:G1NewSizePercent=20',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapRegionSize=8M'
]
const TURBO_JVM = [
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem'
]

// GC flags for the mode, unless the player picked their own collector in Java arguments.
function jvmArgs (mode, userArgs) {
  if (mode === 'off' || userArgs.some(a => /^-XX:\+Use\w+GC$/.test(a))) return []
  return mode === 'turbo' ? [...BASE_JVM, ...TURBO_JVM] : BASE_JVM
}

// Bump when the tweaks below change, so existing instances get them once more.
const PERF_REV = 2

// Merges Sodium's own speed options once per mode change (players can still edit them afterwards).
function prepareGame (gameDir, mode) {
  const marker = path.join(gameDir, 'config', '.xion-perf')
  let last = ''
  try { last = fs.readFileSync(marker, 'utf8').trim() } catch {}
  if (last === `${mode}:${PERF_REV}`) return
  if (mode !== 'off') {
    const file = path.join(gameDir, 'config', 'sodium-options.json')
    try {
      const cfg = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {}
      cfg.quality = { ...(cfg.quality || {}), weather_quality: 'FAST' }
      cfg.performance = { ...(cfg.performance || {}), animate_only_visible_textures: true, use_entity_culling: true, use_fog_occlusion: true, use_block_face_culling: true }
      // Deferred chunk updates make broken/placed blocks show up late; keep them immediate.
      cfg.performance.always_defer_chunk_updates_v2 = false
      // Sodium queues up to 3 frames by default; on integrated graphics that makes keys feel late. 1 = lowest input lag.
      cfg.advanced = { ...(cfg.advanced || {}), cpu_render_ahead_limit: 1 }
      if (mode === 'turbo') Object.assign(cfg.quality, { leaves_quality: 'FAST', enable_vignette: false })
      fs.writeFileSync(file, JSON.stringify(cfg, null, 2))
    } catch {}
  }
  try { fs.writeFileSync(marker, `${mode}:${PERF_REV}`) } catch {}
}

module.exports = { MODES, effective, jvmArgs, prepareGame }
