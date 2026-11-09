// Xion themes: one palette + mountain backdrop per theme, used by the launcher UI and handed to the
// in-game client at launch (palette in xion-launcher.json, backdrop PNGs copied into the game folder).
const fs = require('fs')
const path = require('path')

const THEMES = [
  { id: 'nightfall', name: 'Nightfall', premium: false, accent: '#c9d6ff', accent2: '#8fb3ff', bg: '#06080c', blurb: 'Moonlight on dark peaks' },
  { id: 'aurora', name: 'Aurora', premium: false, accent: '#7cf2c4', accent2: '#5ec8ff', bg: '#03090b', blurb: 'Northern lights over the ridge' },
  { id: 'glacier', name: 'Glacier', premium: false, accent: '#9cc8ff', accent2: '#e9f2ff', bg: '#0b1220', blurb: 'Bright alpine morning' },
  { id: 'sakura', name: 'Sakura', premium: true, accent: '#ffb3c7', accent2: '#ff7aa8', bg: '#120812', blurb: 'Pink dusk and cherry snow' },
  { id: 'ember', name: 'Ember', premium: true, accent: '#ffb86b', accent2: '#ff7a3c', bg: '#0e0605', blurb: 'Sunset fire on the summits' },
  { id: 'void', name: 'Void', premium: true, accent: '#c9a2ff', accent2: '#ff7ad9', bg: '#030208', blurb: 'Deep space nebula' }
]

const byId = id => THEMES.find(t => t.id === id) || THEMES[0]

/** Theme actually in effect: premium themes fall back to Nightfall without a valid license. */
function effective (id, premium) {
  const t = byId(id)
  return t.premium && !premium ? THEMES[0] : t
}

/** Copies the theme's in-game backdrop into <game>/config/xion-theme and returns the hand-off info. */
function prepareForGame (theme, gameDir, assetsDir) {
  const src = path.join(assetsDir, 'themes', theme.id)
  const dst = path.join(gameDir, 'config', 'xion-theme')
  fs.mkdirSync(dst, { recursive: true })
  for (const f of ['sky', 'far', 'mid', 'near', 'front', 'fog']) {
    const from = path.join(src, f + '.png')
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(dst, f + '.png'))
  }
  fs.writeFileSync(path.join(dst, 'theme.txt'), theme.id)
  return { id: theme.id, accent: theme.accent, accent2: theme.accent2 }
}

module.exports = { THEMES, byId, effective, prepareForGame }
