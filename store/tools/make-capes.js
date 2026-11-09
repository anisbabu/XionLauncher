// Generates the Xion Store cape textures into store/assets/capes:
//   <id>.png (static) or <id>_0..7.png (animated), 256x128 = 4x the vanilla 64x32 cape layout (elytra included).
// Run: node store/tools/make-capes.js
const fs = require('fs')
const path = require('path')
const { hex, mix, clamp, smooth, shade, grad, hsv, hash, fbm, inPoly, render, png } = require('./_helpers')
const { ITEMS } = require('../lib/catalog')

const OUT = path.join(__dirname, '..', 'assets', 'capes')
const P = cols => cols.map(hex)
const TAU = Math.PI * 2

// ── art helpers ──
// Xion crest: a hexagon ring around an X, with a small four-point star at the top right. 1 = ink, 0 = none.
function crest (u, v) {
  const x = (u - 0.5) / 0.62, y = (v - 0.4) / 0.42 * 1.0
  const hex = (px, py) => Math.max(Math.abs(px) * 0.866 + Math.abs(py) * 0.5, Math.abs(py))
  const h = hex(x, y)
  if (h < 0.78 && h > 0.6) return 1
  if (h < 0.5) { const d = Math.min(Math.abs(x - y), Math.abs(x + y)) / Math.SQRT2; if (d < 0.09) return 1 }
  const sx = x - 0.72, sy = y + 0.72
  if (Math.abs(sx) * Math.abs(sy) < 0.004 && Math.abs(sx) + Math.abs(sy) < 0.32) return 2
  return 0
}
const sky = (v, cols) => grad(P(cols), v)
// Ridge line height (0 top..1 bottom) for mountains.
const ridge = (u, seed, base, amp) => base - amp * (fbm(u * 3 + seed, seed, seed, 4) - 0.3) - amp * 0.6 * Math.abs(Math.sin(u * 5 + seed))
// Pine forest silhouette: true when (u,v) is inside a tree of this layer.
function pines (u, v, seed, base, height, n) {
  for (let k = -1; k <= n; k++) {
    const cx = (k + 0.5 + (hash(k, seed, 3) - 0.5) * 0.6) / n
    const h = height * (0.7 + hash(k, seed, 5) * 0.6), w = 0.55 / n
    const top = base - h, dy = v - top
    if (dy < 0) continue
    if (v > base) return true
    const tier = (dy / h * 4) % 1
    const half = w * (0.25 + dy / h * 0.75) * (0.55 + tier * 0.45)
    if (Math.abs(u - cx) < half) return true
  }
  return v > base + 0.02
}

// Face space: u 0..1 left→right, v 0..1 top→bottom, t = animation phase 0..1.
const PAINT = {
  xo_logo_pink: (u, v, t) => {
    const c = crest(u, v)
    const pulse = 0.65 + 0.35 * Math.sin(t * TAU)
    const base = shade(hex('#0b0b0f'), 0.9 + 0.2 * fbm(u * 8, v * 12, 5))
    if (c === 1) return mix(hex('#be185d'), hex('#ff4fbf'), pulse)
    if (c === 2) return hex('#4ade80')
    const glow = Math.exp(-Math.abs(Math.hypot((u - 0.5) * 1.3, v - 0.4) - 0.3) * 14) * 0.45 * pulse
    return mix(base, hex('#ec4899'), glow)
  },
  xo_logo_white: (u, v) => { const c = crest(u, v); return c === 1 ? hex('#111114') : c === 2 ? hex('#7c3aed') : shade(hex('#f4f4f5'), 0.94 + 0.08 * fbm(u * 8, v * 12, 6)) },
  xo_logo_purple: (u, v) => { const c = crest(u, v); return c === 1 ? mix(hex('#ca8a04'), hex('#fde68a'), 1 - v) : c === 2 ? hex('#fef9c3') : sky(v, ['#4c1d95', '#2e1065', '#120530']) },
  xs_moon_pines: (u, v, t) => {
    if (pines(u, v, 1, 0.92, 0.42, 6)) return hex('#03070c')
    if (pines(u, v, 7, 0.8, 0.32, 8)) return hex('#0c2230')
    let c = sky(v, ['#020617', '#0b1d3a', '#1b4b5a'])
    const mx = u - 0.66, my = (v - 0.2) * 1.6, md = Math.hypot(mx, my)
    if (md < 0.17) { c = mix(hex('#f1f5f9'), hex('#cbd5e1'), fbm(u * 14, v * 14, 2) > 0.55 ? 0.7 : 0); return c }
    c = mix(c, hex('#e2e8f0'), Math.exp(-(md - 0.17) * 10) * 0.35)
    const s = hash(Math.floor(u * 40), Math.floor(v * 64), 2)
    if (v < 0.55 && s > 0.975 && Math.sin((t + s * 10) * TAU) > 0) return hex('#ffffff')
    return mix(c, hex('#94a3b8'), Math.max(0, 0.18 - Math.abs(v - 0.72)) * 2 * (0.6 + 0.4 * Math.sin(u * 9 + t * TAU)))
  },
  xs_blood_moon: (u, v) => {
    const r1 = ridge(u, 3, 0.78, 0.14), r2 = ridge(u, 9, 0.9, 0.08)
    if (v > r2) return hex('#050102')
    if (v > r1) return mix(hex('#1a0306'), hex('#2c0509'), fbm(u * 6, v * 6, 4))
    let c = sky(v, ['#12020a', '#5b0a12', '#d9480f'])
    const md = Math.hypot(u - 0.5, (v - 0.38) * 1.6)
    if (md < 0.3) return mix(hex('#ef4444'), hex('#7f1d1d'), fbm(u * 10, v * 10, 7) * 0.8 + md)
    return mix(c, hex('#f97316'), Math.exp(-(md - 0.3) * 8) * 0.5)
  },
  xs_aurora_peaks: (u, v, t) => {
    const r = ridge(u, 5, 0.74, 0.18)
    if (v > r) { const snow = v - r < 0.05 + 0.03 * Math.sin(u * 30); return snow ? hex('#e2e8f0') : mix(hex('#334155'), hex('#0f172a'), (v - r) * 3) }
    let c = sky(v, ['#020412', '#071a2e', '#0b2a3f'])
    for (let k = 0; k < 2; k++) {
      const wave = 0.25 + k * 0.12 + 0.07 * Math.sin(u * 7 + t * TAU + k * 2) + 0.03 * Math.sin(u * 17 - t * TAU * 2)
      const d = v - wave
      if (d > -0.02 && d < 0.18) { const a = Math.exp(-d * 9) * (0.6 + 0.4 * Math.sin(u * 30 + t * TAU * 2)); c = mix(c, k ? hex('#a855f7') : hex('#34d399'), Math.min(1, a)) }
    }
    const s = hash(Math.floor(u * 40), Math.floor(v * 64), 8)
    return s > 0.985 ? hex('#ffffff') : c
  },
  xs_deep_sea: (u, v, t) => {
    let c = sky(v, ['#0ea5e9', '#075985', '#020617'])
    const ray = Math.sin((u - v * 0.3) * 18 + Math.sin(t * TAU) * 1.5)
    c = mix(c, hex('#bae6fd'), Math.max(0, ray - 0.6) * (1 - v) * 0.8)
    for (let k = 0; k < 9; k++) {
      const bx = hash(k, 1, 12), sp = 0.5 + hash(k, 2, 12)
      const by = 1 - ((t * sp + hash(k, 3, 12)) % 1)
      const d = Math.hypot(u - bx - 0.03 * Math.sin(by * 20), (v - by) * 1.6)
      if (d < 0.035 && d > 0.018) return hex('#e0f2fe')
    }
    if (v > 0.9 - 0.04 * Math.sin(u * 14)) return mix(hex('#78350f'), hex('#a16207'), fbm(u * 10, v * 10, 3))
    return c
  },
  hw_pumpkin_cape: (u, v, t) => {
    const bg = mix(hex('#1a0a00'), hex('#3b1600'), 1 - v)
    const x = (u - 0.5) * 1.2, y = (v - 0.5) * 1.6
    const r = Math.hypot(x * 0.9, y)
    const flick = 0.75 + 0.25 * Math.sin(t * TAU * 3 + Math.sin(t * TAU * 7))
    if (r > 0.42) return shade(bg, 0.9 + 0.2 * fbm(u * 8, v * 8, 2))
    const ribs = 0.8 + 0.2 * Math.cos(x * 22)
    let c = shade(mix(hex('#c2410c'), hex('#fb923c'), 1 - r * 2), ribs)
    const eye = (ex) => inPoly([[ex - 0.09, -0.06], [ex + 0.09, -0.06], [ex, -0.2]], x, y) < 0
    const mouth = y > 0.05 && y < 0.2 && Math.abs(x) < 0.26 && (y < 0.12 + 0.05 * Math.abs(Math.sin(x * 30)))
    if (eye(-0.14) || eye(0.14) || mouth) c = mix(hex('#ffe066'), hex('#fff7cc'), flick * 0.6)
    if (y < -0.36 && Math.abs(x) < 0.04) c = hex('#3f6212')
    return c
  },
  hw_web_cape: (u, v) => {
    const bg = grad(P(['#12001f', '#3b0764', '#6d28d9']), 1 - v * 0.9)
    const x = u - 0.5, y = v - 0.05
    const a = Math.atan2(y, x), r = Math.hypot(x, y)
    const spoke = Math.abs(Math.sin(a * 8)) < 0.04
    const ring = Math.abs(Math.sin(r * 40 + Math.sin(a * 8) * 0.6)) < 0.08
    return spoke || ring ? hex('#e9d5ff') : shade(bg, 0.85 + 0.25 * fbm(u * 5, v * 6, 4))
  },
  wn_snowfall_cape: (u, v, t) => {
    let c = grad(P(['#020617', '#1e3a8a', '#60a5fa']), 1 - v * 0.8)
    if (v > 0.86 - 0.04 * Math.sin(u * 12)) c = mix(hex('#e0f2fe'), hex('#ffffff'), v)
    for (let layer = 0; layer < 3; layer++) {
      const n = 6 + layer * 3, pv = (v - t * (layer + 1) / 1 + 4) % 1
      const cx = Math.floor(u * n), cy = Math.floor(pv * n * 1.6)
      const h = hash(cx, cy, 30 + layer)
      if (h > 0.55) {
        const fx = (u * n) % 1 - 0.5 - (h - 0.5) * 0.4, fy = (pv * n * 1.6) % 1 - 0.5
        if (Math.hypot(fx, fy) < 0.12 - layer * 0.025) return mix(c, [255, 255, 255], 0.95 - layer * 0.2)
      }
    }
    return c
  },
  wn_candy_cape: (u, v) => ((u * 3 + v * 4) % 1) < 0.5 ? mix(hex('#dc2626'), hex('#ef4444'), Math.sin(((u * 3 + v * 4) % 0.5) * 2 * Math.PI)) : hex('#fff1f2'),
  cl_nebula_cape: (u, v, t) => {
    const sw = fbm(u * 3 + Math.cos(t * TAU) * 0.3, v * 4 + Math.sin(t * TAU) * 0.3, 11, 5)
    let c = mix(hex('#05010f'), hex('#4c1d95'), smooth(0.35, 0.75, sw))
    c = mix(c, hex('#ec4899'), smooth(0.6, 0.9, fbm(u * 5 + 2, v * 6 - t * 0.5, 19)) * 0.7)
    c = mix(c, hex('#22d3ee'), smooth(0.65, 0.95, fbm(u * 4 - 3, v * 5 + t * 0.5, 27)) * 0.5)
    const s = hash(Math.floor(u * 40), Math.floor(v * 64), 7)
    if (s > 0.96 && Math.sin((t + s * 9) * TAU) > 0.2) return [255, 255, 240]
    return c
  },
  in_dragon_cape: (u, v, t) => {
    const sx = u * 8, sy = v * 12 + (Math.floor(u * 8) % 2) * 0.5
    const fx = sx % 1 - 0.5, fy = sy % 1 - 0.3
    const d = Math.hypot(fx, fy * 1.3)
    const pulse = 0.55 + 0.45 * Math.sin(t * TAU + v * 6)
    const scale = shade(mix(hex('#1c0303'), hex('#7f1d1d'), 1 - d * 1.6), 0.8 + 0.4 * (0.5 - fy))
    return d > 0.42 ? mix(hex('#ea580c'), hex('#fde047'), pulse * 0.6) : scale
  },
  nx_grid_cape: (u, v, t) => {
    let c = grad(P(['#1e0533', '#7e22ce', '#f472b6']), 1 - v * 1.4)
    const sx = u - 0.5, sy = v - 0.36
    if (v < 0.5 && Math.hypot(sx, sy) < 0.26) {
      c = grad(P(['#fde047', '#fb7185', '#c026d3']), (v - 0.1) / 0.4)
      if (v > 0.3 && Math.sin(v * 90) > 0.3) c = hex('#1e0533')
    }
    if (v >= 0.5) {
      const depth = (v - 0.5) / 0.5
      const gy = Math.abs(((1 / (depth + 0.06)) * 0.2 + t) % 0.25 - 0.125) < 0.012 + depth * 0.02
      const gx = Math.abs(((sx / (depth + 0.15)) * 2.2) % 0.25) < 0.02 + depth * 0.01
      c = gy || gx ? hex('#22d3ee') : mix(hex('#0f0220'), hex('#2e1065'), depth)
    }
    return c
  },
  sk_blossom_cape: (u, v, t) => {
    let c = grad(P(['#fdf2f8', '#fbcfe8', '#f9a8d4']), v)
    const bx = 0.15 + v * 0.5 + 0.05 * Math.sin(v * 9)
    if (Math.abs(u - bx) < 0.025 && v < 0.7) c = hex('#4a2c2a')
    const pv = (v - t + 1) % 1
    const cx = Math.floor(u * 5), cy = Math.floor(pv * 8)
    const h = hash(cx, cy, 13)
    const x = (u * 5) % 1 - 0.5, y = (pv * 8) % 1 - 0.5
    if (h > 0.5 && Math.hypot(x * 1.2, y) < 0.16) return mix(hex('#ec4899'), hex('#fff'), 0.3 * (y + 0.5))
    for (let k = 0; k < 4; k++) { const fx = bx + 0.08 * (k % 2 ? 1 : -1), fy = 0.1 + k * 0.14; if (Math.hypot(u - fx, (v - fy) * 0.7) < 0.05) return hex('#f472b6') }
    return c
  },
  xs_prism_cape: (u, v, t) => {
    const facet = Math.floor((u * 3 + v * 2) * 2) + Math.floor((u * 3 - v * 2) * 2)
    const hue = (u * 0.6 + v * 0.4 - t + facet * 0.07)
    const shine = Math.exp(-Math.pow(((u + v) - t * 2.4 + 0.2) * 4, 2))
    return mix(hsv(hue, 0.65, 0.95), [255, 255, 255], shine * 0.7)
  },
  xs_matrix_cape: (u, v, t) => {
    const col = Math.floor(u * 10), sp = 0.6 + hash(col, 0, 3) * 1.4, off = hash(col, 1, 4)
    const row = Math.floor(v * 24)
    const head = ((t * sp + off) % 1) * 1.4 - 0.2
    const d = head - v
    const glyph = hash(col, row, Math.floor(t * 8)) > 0.35 && ((u * 10) % 1) > 0.18 && ((u * 10) % 1) < 0.82 && ((v * 24) % 1) > 0.12
    if (d >= 0 && d < 0.04 && glyph) return hex('#d9ffe4')
    if (d >= 0 && d < 0.6 && glyph) return mix(hex('#001a07'), hex('#22c55e'), 1 - d / 0.6)
    return hex('#000a03')
  },
  xs_velvet_cape: (u, v) => {
    const trim = Math.min(u, 1 - u, 1 - v) < 0.06
    if (trim) return mix(hex('#a16207'), hex('#fde68a'), 0.5 + 0.5 * Math.sin((u + v) * 40))
    const x = (u - 0.5), y = (v - 0.36) * 1.6
    if (Math.abs(x) < 0.26 && y < 0.14 && y > -0.2) {
      const peak = -0.2 + 0.18 * Math.abs(Math.sin((x + 0.26) / 0.52 * Math.PI * 2.5))
      if (y > peak) return mix(hex('#ca8a04'), hex('#fef08a'), (0.14 - y) * 2)
    }
    return shade(mix(hex('#3b0010'), hex('#881337'), 1 - v), 0.85 + 0.3 * fbm(u * 10, v * 14, 8))
  },
  xs_storm_cape: (u, v, t) => {
    const cloud = fbm(u * 3 + t, v * 4, 41, 5)
    let c = mix(hex('#0b1120'), hex('#475569'), smooth(0.3, 0.8, cloud))
    const strike = Math.floor(t * 8) % 4 === 1
    const line = Math.abs(u - 0.5 - 0.22 * (fbm(v * 5, 3.3, 71) - 0.5) * 2)
    if (strike) { c = mix(c, hex('#cbd5e1'), 0.35); if (line < 0.02 && v < 0.9) return hex('#f8fafc'); c = mix(c, hex('#93c5fd'), Math.exp(-line * 18) * 0.6) }
    return c
  }
}

fs.mkdirSync(OUT, { recursive: true })
let bytes = 0, n = 0
for (const it of ITEMS.filter(i => i.type === 'cape')) {
  const paint = PAINT[it.id]
  if (!paint) throw new Error('No painter for ' + it.id)
  for (let f = 0; f < it.frames; f++) {
    const file = it.frames > 1 ? `${it.id}_${f}.png` : `${it.id}.png`
    const data = png(render(paint, f / it.frames))
    fs.writeFileSync(path.join(OUT, file), data); bytes += data.length; n++
  }
}
console.log(`${n} cape textures, ${(bytes / 1024 / 1024).toFixed(1)} MB`)
