// Xion Store catalog: every cosmetic and bundle, with prices per currency.
// Shared by the API (prices are always taken from here, never from the browser) and the store page.
//   type   cape | hat | wings | aura
//   model  how the 3D preview / Xion Client draws it (capes: PNG texture in assets/capes, 8 frames when animated)
//   rarity common | rare | epic | legendary (sets the price)

const PRICE = {
  common: { USD: 0.99, BDT: 120, INR: 80 },
  rare: { USD: 1.99, BDT: 240, INR: 160 },
  epic: { USD: 2.99, BDT: 360, INR: 240 },
  legendary: { USD: 4.99, BDT: 600, INR: 400 }
}

const ITEMS = [
  // ── Halloween ──
  { id: 'hw_pumpkin_cape', name: 'Jack-o\'-Cape', type: 'cape', rarity: 'epic', frames: 8, set: 'halloween', desc: 'A grinning jack-o\'-lantern whose candle flickers as you move.' },
  { id: 'hw_witch_hat', name: 'Witch Hat', type: 'hat', model: 'witch', rarity: 'rare', set: 'halloween', desc: 'Crooked brim, purple band, a little spooky buckle.' },
  { id: 'hw_bat_wings', name: 'Bat Wings', type: 'wings', model: 'bat', rarity: 'legendary', set: 'halloween', animated: true, desc: 'Leathery wings that flap slowly behind you.' },
  { id: 'hw_soul_aura', name: 'Soul Flames', type: 'aura', model: 'souls', rarity: 'epic', set: 'halloween', animated: true, desc: 'Blue soul fire drifts up around your feet.' },
  { id: 'hw_web_cape', name: 'Spider Silk', type: 'cape', rarity: 'common', frames: 1, set: 'halloween', desc: 'A purple cape woven from moonlit cobwebs.' },

  // ── Winter Frost ──
  { id: 'wn_snowfall_cape', name: 'Snowfall', type: 'cape', rarity: 'epic', frames: 8, set: 'winter', desc: 'Snow keeps falling across a midnight-blue sky.' },
  { id: 'wn_santa_hat', name: 'Santa Hat', type: 'hat', model: 'santa', rarity: 'rare', set: 'winter', desc: 'Red velvet with a fluffy white pom-pom.' },
  { id: 'wn_frost_wings', name: 'Frost Wings', type: 'wings', model: 'frost', rarity: 'legendary', set: 'winter', animated: true, desc: 'Crystal ice wings that shimmer in the light.' },
  { id: 'wn_snow_aura', name: 'Blizzard', type: 'aura', model: 'snow', rarity: 'rare', set: 'winter', animated: true, desc: 'A small snow flurry follows you everywhere.' },
  { id: 'wn_candy_cape', name: 'Candy Cane', type: 'cape', rarity: 'common', frames: 1, set: 'winter', desc: 'Peppermint stripes, extra sweet.' },

  // ── Celestial ──
  { id: 'cl_nebula_cape', name: 'Nebula', type: 'cape', rarity: 'legendary', frames: 8, set: 'celestial', desc: 'A swirling galaxy with twinkling stars.' },
  { id: 'cl_halo', name: 'Halo', type: 'hat', model: 'halo', rarity: 'epic', set: 'celestial', animated: true, desc: 'A glowing golden ring that floats and spins.' },
  { id: 'cl_angel_wings', name: 'Angel Wings', type: 'wings', model: 'angel', rarity: 'legendary', set: 'celestial', animated: true, desc: 'Soft white feathered wings.' },
  { id: 'cl_star_aura', name: 'Stardust', type: 'aura', model: 'stars', rarity: 'epic', set: 'celestial', animated: true, desc: 'Golden sparkles orbit around you.' },

  // ── Inferno ──
  { id: 'in_dragon_cape', name: 'Dragonscale', type: 'cape', rarity: 'epic', frames: 8, set: 'inferno', desc: 'Dark scales with lava glowing between them.' },
  { id: 'in_horns', name: 'Demon Horns', type: 'hat', model: 'horns', rarity: 'rare', set: 'inferno', desc: 'Curved horns, ember tipped.' },
  { id: 'in_dragon_wings', name: 'Dragon Wings', type: 'wings', model: 'dragon', rarity: 'legendary', set: 'inferno', animated: true, desc: 'Huge crimson wings with bony spines.' },
  { id: 'in_ember_aura', name: 'Embers', type: 'aura', model: 'embers', rarity: 'epic', set: 'inferno', animated: true, desc: 'Hot sparks rise around you.' },

  // ── Neon ──
  { id: 'nx_grid_cape', name: 'Synthwave', type: 'cape', rarity: 'epic', frames: 8, set: 'neon', desc: 'A retro sun over a scrolling neon grid.' },
  { id: 'nx_visor', name: 'Cyber Visor', type: 'hat', model: 'visor', rarity: 'rare', set: 'neon', animated: true, desc: 'A pulsing neon visor across your eyes.' },
  { id: 'nx_mech_wings', name: 'Mech Wings', type: 'wings', model: 'mech', rarity: 'legendary', set: 'neon', animated: true, desc: 'Folding metal blades with neon edges.' },
  { id: 'nx_pixel_aura', name: 'Pixel Storm', type: 'aura', model: 'pixels', rarity: 'rare', set: 'neon', animated: true, desc: 'Glowing pixels in pink and cyan.' },

  // ── Sakura ──
  { id: 'sk_blossom_cape', name: 'Blossom Branch', type: 'cape', rarity: 'epic', frames: 8, set: 'sakura', desc: 'A cherry branch with petals drifting down.' },
  { id: 'sk_flower_crown', name: 'Flower Crown', type: 'hat', model: 'flowers', rarity: 'common', set: 'sakura', desc: 'Pink and white blossoms around your head.' },
  { id: 'sk_butterfly_wings', name: 'Butterfly Wings', type: 'wings', model: 'butterfly', rarity: 'epic', set: 'sakura', animated: true, desc: 'Pastel wings that flutter quickly.' },
  { id: 'sk_petal_aura', name: 'Petal Breeze', type: 'aura', model: 'petals', rarity: 'rare', set: 'sakura', animated: true, desc: 'Cherry petals swirl around you.' },

  // ── Xion Originals ──
  { id: 'xo_logo_pink', name: 'Xion Cloak · Black & Pink', type: 'cape', rarity: 'epic', frames: 8, set: 'xion', desc: 'Jet black with a glowing pink Xion crest that pulses.' },
  { id: 'xo_logo_white', name: 'Xion Cloak · Snow', type: 'cape', rarity: 'rare', frames: 1, set: 'xion', desc: 'Clean white cloak with the Xion crest in ink black.' },
  { id: 'xo_logo_purple', name: 'Xion Cloak · Royal', type: 'cape', rarity: 'rare', frames: 1, set: 'xion', desc: 'Deep purple gradient with a gold Xion crest.' },
  { id: 'xo_void_wings', name: 'Void Wings', type: 'wings', model: 'void', rarity: 'legendary', set: 'xion', animated: true, desc: 'Starry void membranes on dark bone, purple glowing joints.' },

  // ── Singles ──
  { id: 'xs_phoenix_wings', name: 'Phoenix Wings', type: 'wings', model: 'phoenix', rarity: 'legendary', animated: true, desc: 'Living fire flows across golden bone wings.' },
  { id: 'xs_moon_pines', name: 'Moonlit Pines', type: 'cape', rarity: 'epic', frames: 8, desc: 'A full moon over a misty pine forest, stars twinkling.' },
  { id: 'xs_blood_moon', name: 'Blood Moon', type: 'cape', rarity: 'epic', frames: 1, desc: 'A huge red moon behind black mountain peaks.' },
  { id: 'xs_aurora_peaks', name: 'Aurora Peaks', type: 'cape', rarity: 'legendary', frames: 8, desc: 'Northern lights ripple above snowy mountains.' },
  { id: 'xs_deep_sea', name: 'Deep Sea', type: 'cape', rarity: 'rare', frames: 8, desc: 'Light rays and bubbles drifting in the ocean deep.' },
  { id: 'xs_prism_cape', name: 'Prism', type: 'cape', rarity: 'legendary', frames: 8, desc: 'Rainbow light refracting through crystal.' },
  { id: 'xs_matrix_cape', name: 'Code Rain', type: 'cape', rarity: 'epic', frames: 8, desc: 'Green glyphs falling forever.' },
  { id: 'xs_velvet_cape', name: 'Royal Velvet', type: 'cape', rarity: 'rare', frames: 1, desc: 'Deep velvet with a golden crown and trim.' },
  { id: 'xs_storm_cape', name: 'Thunderstorm', type: 'cape', rarity: 'epic', frames: 8, desc: 'Lightning cracks across dark clouds.' },
  { id: 'xs_crown', name: 'Golden Crown', type: 'hat', model: 'crown', rarity: 'legendary', desc: 'Gold, rubies, and a lot of confidence.' },
  { id: 'xs_tophat', name: 'Top Hat', type: 'hat', model: 'tophat', rarity: 'common', desc: 'Very classy, slightly tall.' },
  { id: 'xs_cat_ears', name: 'Cat Ears', type: 'hat', model: 'cat', rarity: 'common', desc: 'Fluffy ears that twitch now and then.', animated: true },
  { id: 'xs_heart_aura', name: 'Lovestruck', type: 'aura', model: 'hearts', rarity: 'rare', animated: true, desc: 'Little hearts float up around you.' }
]

const SETS = [
  { id: 'halloween', name: 'Halloween Night', tag: 'Limited', color: '#ff7a18', accent: '#8b3dff', desc: 'Pumpkins, bats and soul fire. Spooky season all year.' },
  { id: 'winter', name: 'Winter Frost', tag: 'New', color: '#7dd3fc', accent: '#e11d48', desc: 'Snow, ice wings and a cozy Santa hat.' },
  { id: 'celestial', name: 'Celestial', tag: 'Legendary', color: '#fde68a', accent: '#a78bfa', desc: 'A halo, angel wings and a cape full of stars.' },
  { id: 'inferno', name: 'Inferno', tag: 'Hot', color: '#f97316', accent: '#dc2626', desc: 'Dragon wings, demon horns and rising embers.' },
  { id: 'neon', name: 'Neon City', tag: 'Animated', color: '#f0abfc', accent: '#22d3ee', desc: 'Synthwave grid, cyber visor and mech wings.' },
  { id: 'xion', name: 'Xion Originals', tag: 'Signature', color: '#f472b6', accent: '#7c3aed', desc: 'The Xion crest cloaks and void wings. Our signature look.' },
  { id: 'sakura', name: 'Sakura Spring', tag: 'Pastel', color: '#f9a8d4', accent: '#86efac', desc: 'Blossoms, butterflies and drifting petals.' }
]

// Bundles: all items of a set, about 40% off the separate prices.
const BUNDLE_OFF = 0.4
const round = (cur, v) => cur === 'USD' ? Math.floor(v) + 0.99 : Math.round(v / 10) * 10

const itemPrice = it => PRICE[it.rarity]
function bundlePrice (set) {
  const items = ITEMS.filter(i => i.set === set.id)
  const out = {}
  for (const cur of ['USD', 'BDT', 'INR']) {
    const sum = items.reduce((s, i) => s + itemPrice(i)[cur], 0)
    out[cur] = round(cur, sum * (1 - BUNDLE_OFF))
  }
  return out
}

const BUNDLES = SETS.map(s => ({ ...s, id: 'bundle_' + s.id, set: s.id, items: ITEMS.filter(i => i.set === s.id).map(i => i.id), price: bundlePrice(s) }))
const CATALOG_ITEMS = ITEMS.map(i => ({ ...i, price: itemPrice(i) }))

const byId = id => CATALOG_ITEMS.find(i => i.id === id) || BUNDLES.find(b => b.id === id) || null

module.exports = { ITEMS: CATALOG_ITEMS, BUNDLES, SETS, PRICE, byId }
