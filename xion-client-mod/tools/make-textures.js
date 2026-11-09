#!/usr/bin/env node
// Generates the Xion ("Nightfall") look for vanilla menus as a built-in resource pack (all art drawn here):
// widget sprites (1.20.2+) and menu backgrounds (all versions).
// Usage: node tools/make-textures.js
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const OUT = path.resolve(__dirname, '..', 'src', 'main', 'resources', 'assets', 'minecraft', 'textures', 'gui')

// ---------- tiny PNG encoder ----------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc32 = buf => { let c = -1; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
function chunk (type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}
function png (w, h, px) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const c = px[y * w + x] || [0, 0, 0, 0]
      raw.set(c.map(v => Math.max(0, Math.min(255, Math.round(v)))), y * (w * 4 + 1) + 1 + x * 4)
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

// ---------- drawing helpers ----------
const canvas = (w, h) => ({ w, h, px: new Array(w * h).fill(null).map(() => [0, 0, 0, 0]) })
const hex = (h, a = 255) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
function blend (c, x, y, col) {
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const d = c.px[y * c.w + x]
  const a = col[3] / 255
  const outA = a + (d[3] / 255) * (1 - a)
  if (outA <= 0) return
  c.px[y * c.w + x] = [0, 1, 2].map(i => (col[i] * a + d[i] * (d[3] / 255) * (1 - a)) / outA).concat(outA * 255)
}
function rect (c, x0, y0, w, h, col) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) blend(c, x, y, typeof col === 'function' ? col(x, y) : col) }
const noise = (x, y, s = 1) => { const n = Math.sin(x * 12.9898 + y * 78.233 + s * 37.719) * 43758.5453; return n - Math.floor(n) }

/** Rounded slab: fill + 1px border (corners cut) + soft inner highlight. */
function slab (w, h, { fill, border, highlight, shadow, sheen }) {
  const c = canvas(w, h)
  rect(c, 1, 1, w - 2, h - 2, (x, y) => typeof fill === 'function' ? fill(x, y) : fill)
  const edge = (x, y) => typeof border === 'function' ? border(x, y) : border
  for (let x = 1; x < w - 1; x++) { blend(c, x, 0, edge(x, 0)); blend(c, x, h - 1, edge(x, h - 1)) }
  for (let y = 1; y < h - 1; y++) { blend(c, 0, y, edge(0, y)); blend(c, w - 1, y, edge(w - 1, y)) }
  if (highlight) for (let x = 2; x < w - 2; x++) blend(c, x, 1, highlight)
  if (shadow) for (let x = 2; x < w - 2; x++) blend(c, x, h - 2, shadow)
  if (sheen) for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) blend(c, x, y, sheen(x, y))
  return c
}

const MOON = hex('#e9eef7'), ACCENT = hex('#c9d6ff')

const files = {}
const sprite = (name, c, mcmeta) => {
  files[`sprites/widget/${name}.png`] = png(c.w, c.h, c.px)
  if (mcmeta) files[`sprites/widget/${name}.png.mcmeta`] = Buffer.from(JSON.stringify({ gui: { scaling: mcmeta } }, null, 2))
}
const nine = (w, h, border) => ({ type: 'nine_slice', width: w, height: h, border })

// Buttons (200x20): dark glass, the edge lights up in moonlight on hover.
sprite('button', slab(200, 20, {
  fill: (x, y) => mix(hex('#10131a', 200), hex('#0a0c11', 200), y / 19),
  border: hex('#ffffff', 34),
  highlight: hex('#ffffff', 10)
}), nine(200, 20, 3))
sprite('button_highlighted', slab(200, 20, {
  fill: (x, y) => mix(hex('#1e2432', 228), hex('#161a24', 228), y / 19),
  border: hex('#e9eef7', 150),
  highlight: hex('#ffffff', 22)
}), nine(200, 20, 3))
sprite('button_disabled', slab(200, 20, {
  fill: hex('#0b0d12', 140),
  border: hex('#ffffff', 16)
}), nine(200, 20, 3))

// Slider track (200x20) and handle (8x20)
sprite('slider', slab(200, 20, {
  fill: (x, y) => mix(hex('#0d1016', 200), hex('#090b0f', 200), y / 19),
  border: hex('#ffffff', 30),
  sheen: (x, y) => (y === 9 || y === 10) && x > 3 && x < 196 ? hex('#c9d6ff', 26) : [0, 0, 0, 0]
}), nine(200, 20, 3))
sprite('slider_highlighted', slab(200, 20, {
  fill: (x, y) => mix(hex('#161b26', 220), hex('#0f121a', 220), y / 19),
  border: hex('#e9eef7', 120),
  sheen: (x, y) => (y === 9 || y === 10) && x > 3 && x < 196 ? hex('#c9d6ff', 60) : [0, 0, 0, 0]
}), nine(200, 20, 3))
const handle = hot => slab(8, 20, {
  fill: (x, y) => mix(hot ? hex('#ffffff') : MOON, hot ? hex('#c9d6ff') : hex('#aab6cc'), y / 19),
  border: hex('#ffffff', hot ? 255 : 210),
  highlight: hex('#ffffff', 140)
})
sprite('slider_handle', handle(false), nine(8, 20, 2))
sprite('slider_handle_highlighted', handle(true), nine(8, 20, 2))

// Text fields (200x20)
sprite('text_field', slab(200, 20, { fill: hex('#07090d', 225), border: hex('#ffffff', 40) }), nine(200, 20, 1))
sprite('text_field_highlighted', slab(200, 20, { fill: hex('#0a0d12', 235), border: hex('#c9d6ff', 170) }), nine(200, 20, 1))

// Scroller (6x32)
sprite('scroller', slab(6, 32, { fill: (x, y) => mix(MOON, hex('#aab6cc'), y / 31), border: hex('#ffffff', 200) }), nine(6, 32, 1))
sprite('scroller_background', slab(6, 32, { fill: hex('#000000', 90), border: hex('#ffffff', 16) }), nine(6, 32, 1))

// ---------- menu backgrounds ----------
function tile (size, base, alphaBase, seed) {
  const c = canvas(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) c.px[y * size + x] = mix(hex(base[0], alphaBase), hex(base[1], alphaBase), noise(x, y, seed) * 0.5)
  }
  return c
}
const putTile = (name, c) => { files[name] = png(c.w, c.h, c.px) }
// <= 1.20.4: list backgrounds (vanilla tints it darker); the screen itself shows the Xion scenery.
putTile('options_background.png', tile(16, ['#2b3140', '#262c3a'], 255, 1))
// 1.20.5+: translucent washes over the blurred scenery / world
putTile('menu_background.png', tile(32, ['#080a0f', '#0a0c12'], 120, 2))
putTile('inworld_menu_background.png', tile(32, ['#080a0f', '#0a0c12'], 110, 3))
putTile('menu_list_background.png', tile(32, ['#05060a', '#06080c'], 90, 4))
putTile('inworld_menu_list_background.png', tile(32, ['#05060a', '#06080c'], 80, 5))
const separator = (top) => {
  const c = canvas(32, 2)
  for (let x = 0; x < 32; x++) {
    c.px[(top ? 0 : 1) * 32 + x] = ACCENT.slice(0, 3).concat(46)
    c.px[(top ? 1 : 0) * 32 + x] = [0, 0, 0, 90]
  }
  return c
}
for (const pre of ['', 'inworld_']) {
  putTile(`${pre}header_separator.png`, separator(false))
  putTile(`${pre}footer_separator.png`, separator(true))
}

for (const [rel, buf] of Object.entries(files)) {
  const p = path.join(OUT, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, buf)
}
console.log(`${Object.keys(files).length} files written to ${OUT}`)
