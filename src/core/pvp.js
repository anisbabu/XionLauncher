// Xion PvP: a mode of Xion Client, not a separate game. It runs on any version Xion Client supports and swaps in
// a PvP mod pack, its own HUD layout and a PvP look inside the game (the client reads `pvp` from the hand-off file).
const fs = require('fs')
const path = require('path')

const ID = 'xion-pvp'
const DEFAULT_VERSION = '1.21.11'

// Picks per category. `on` is the default; mods without a build for the chosen version are skipped at launch.
const CATALOG = [
  { slug: 'sodium', name: 'Sodium', cat: 'Performance', on: true, desc: 'Modern renderer, big FPS gain' },
  { slug: 'lithium', name: 'Lithium', cat: 'Performance', on: true, desc: 'Game logic and physics' },
  { slug: 'ferrite-core', name: 'FerriteCore', cat: 'Performance', on: true, desc: 'Lower memory use' },
  { slug: 'entityculling', name: 'Entity Culling', cat: 'Performance', on: true, desc: 'Skips hidden entities' },
  { slug: 'immediatelyfast', name: 'ImmediatelyFast', cat: 'Performance', on: true, desc: 'Faster HUD and text' },
  { slug: 'moreculling', name: 'More Culling', cat: 'Performance', on: true, desc: 'Culls more block faces' },
  { slug: 'badoptimizations', name: 'BadOptimizations', cat: 'Performance', on: true, desc: 'Small CPU savings' },
  { slug: 'krypton', name: 'Krypton', cat: 'Performance', on: true, desc: 'Faster networking' },
  { slug: 'particle-core', name: 'Particle Core', cat: 'Performance', on: true, desc: 'Cheaper particles' },
  { slug: 'memoryleakfix', name: 'Memory Leak Fix', cat: 'Performance', on: true, desc: 'No stutter over time' },
  { slug: 'modernfix', name: 'ModernFix', cat: 'Performance', on: true, desc: 'Faster start, less memory' },
  { slug: 'fast-ip-ping', name: 'Fast IP Ping', cat: 'Performance', on: true, desc: 'Instant server list pings' },
  { slug: 'fastquit', name: 'FastQuit', cat: 'Performance', on: true, desc: 'Leave worlds instantly' },
  { slug: 'sodium-extra', name: 'Sodium Extra', cat: 'Video', on: true, desc: 'Fog, particle and animation toggles' },
  { slug: 'reeses-sodium-options', name: "Reese's Sodium Options", cat: 'Video', on: true, desc: 'Cleaner video settings' },
  { slug: 'low-fire-reborn', name: 'Low Fire', cat: 'Combat', on: true, desc: 'Fire no longer blocks your view' },
  { slug: 'damagetint', name: 'Hit Color', cat: 'Combat', on: true, desc: 'Change the red hit flash' },
  { slug: 'zoomify', name: 'Zoomify', cat: 'Combat', on: true, desc: 'Smooth zoom key (C)' },
  { slug: 'freelook', name: 'Freelook', cat: 'Combat', on: true, desc: 'Look around without turning' },
  { slug: 'no_hurt_cam', name: 'No Hurt Cam', cat: 'Combat', on: false, desc: 'No screen shake when hit' },
  { slug: 'marlow-crystal-optimizer', name: 'Crystal Optimizer', cat: 'Combat', on: false, desc: 'Instant end crystals' },
  { slug: 'old-combat-mod', name: 'Old Combat', cat: 'Combat', on: false, desc: '1.8 style combat and animations' },
  { slug: 'natural-motion-blur', name: 'Motion Blur', cat: 'Video', on: false, desc: 'Off by default in PvP' },
  { slug: 'modmenu', name: 'Mod Menu', cat: 'Utility', on: true, desc: 'Browse and configure mods' }
]

const SERVERS = [
  { name: 'Hypixel', host: 'mc.hypixel.net', tag: 'Bedwars, Duels' },
  { name: 'Minemen Club', host: 'minemen.club', tag: 'Practice' },
  { name: 'PvP Legacy', host: 'play.pvplegacy.net', tag: 'Practice' },
  { name: 'Bedwars Practice', host: 'bedwarspractice.club', tag: 'Bridging' }
]

const defaultSelection = () => CATALOG.filter(m => m.on).map(m => m.slug)

/** The stored PvP profile (created on first use). It launches like a normal profile but is never listed with them. */
function profile (data) {
  if (!data.pvp) data.pvp = {}
  const p = data.pvp
  Object.assign(p, { id: ID, name: 'Xion PvP', loader: 'fabric', pvp: true })
  if (!p.version) p.version = DEFAULT_VERSION
  if (!Array.isArray(p.mods)) p.mods = defaultSelection()
  // The old 1.8.9 mode stored an Ornithe selection; start over from the new catalog.
  if (p.oldMode !== 2) { p.mods = defaultSelection(); p.oldMode = 2; if (p.version === '1.8.9') p.version = DEFAULT_VERSION }
  return p
}

// Competitive defaults, written once to a new PvP game folder. Only keys whose format is the same on every version.
const OPTIONS = {
  enableVsync: 'false',
  maxFps: '260',
  entityShadows: 'false',
  bobView: 'false',
  mipmapLevels: '2',
  renderDistance: '10'
}

function prepareOptions (gameDir) {
  const file = path.join(gameDir, 'options.txt')
  const marker = path.join(gameDir, '.xion-pvp-tuned')
  if (fs.existsSync(marker)) return
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(Boolean) : []
  const map = new Map(lines.map(l => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1)]))
  for (const [k, v] of Object.entries(OPTIONS)) map.set(k, v)
  fs.writeFileSync(file, [...map].map(([k, v]) => `${k}:${v}`).join('\n') + '\n')
  fs.writeFileSync(marker, '1')
}

module.exports = { ID, DEFAULT_VERSION, CATALOG, SERVERS, defaultSelection, profile, prepareOptions }
