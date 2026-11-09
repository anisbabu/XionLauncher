// Xion Store 3D: a skinview3d player wearing store cosmetics (animated capes, voxel hats, flapping wings, particle auras).
// Every hat / wing / aura is built from boxes so it looks like it belongs in Minecraft.
import * as THREE from '../vendor/esm/three/three.module.js'
import * as skinview3d from '../vendor/esm/skinview3d/skinview3d.js'
import { loadCapeToCanvas } from '../vendor/esm/skinview-utils/index.js'

const CAPE_FRAME_MS = 110
// Launcher build: capes come from the store website, the fallback skin ships with the launcher.
export const ASSETS = 'https://xion-store.vercel.app/assets/'
export const DEFAULT_SKIN = new URL('./default-skin.png', import.meta.url).href
const frameCache = new Map()

function loadImg (src) {
  if (!frameCache.has(src)) {
    frameCache.set(src, new Promise((resolve, reject) => {
      const i = new Image()
      i.crossOrigin = 'anonymous'
      i.onload = () => resolve(i)
      i.onerror = reject
      i.src = src
    }))
  }
  return frameCache.get(src)
}

export const capeFrames = it => it.frames > 1 ? Array.from({ length: it.frames }, (_, f) => `${ASSETS}capes/${it.id}_${f}.png`) : [`${ASSETS}capes/${it.id}.png`]

// ───────── voxel helpers ─────────
const mats = new Map()
function mat (color, glow = 0, opts = {}) {
  const k = color + '|' + glow + '|' + JSON.stringify(opts)
  if (!mats.has(k)) {
    mats.set(k, glow
      ? new THREE.MeshBasicMaterial({ color, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, blending: opts.add ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !opts.add, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ color, roughness: opts.rough ?? 0.75, metalness: opts.metal ?? 0, transparent: !!opts.opacity, opacity: opts.opacity ?? 1, side: THREE.DoubleSide }))
  }
  return mats.get(k)
}
const BOX = new THREE.BoxGeometry(1, 1, 1)
function vox (parent, x, y, z, w, h, d, color, glow = 0, opts) {
  const m = new THREE.Mesh(BOX, mat(color, glow, opts))
  m.scale.set(w, h, d)
  m.position.set(x, y, z)
  parent.add(m)
  return m
}
const group = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent && parent.add(g); return g }

// ───────── hats (head space: head cube spans x/z −4..4, y 0..8) ─────────
const HATS = {
  witch (g) {
    vox(g, 0, 8.6, 0, 14, 0.8, 14, '#2e1065')
    vox(g, 0, 9.4, 0, 9, 1.2, 9, '#7c3aed')
    vox(g, 0, 9.4, 4.55, 2, 1.4, 0.3, '#facc15')
    const tip = group(g, 0, 10, 0)
    vox(tip, 0, 1.2, 0, 8, 2.4, 8, '#3b0764')
    vox(tip, 0.3, 3.4, -0.2, 6, 2.2, 6, '#3b0764')
    vox(tip, 0.8, 5.4, -0.6, 4, 2, 4, '#2e1065')
    vox(tip, 1.6, 7, -1.2, 2.4, 1.8, 2.4, '#2e1065')
    vox(tip, 2.6, 8.2, -1.8, 1.4, 1.4, 1.4, '#2e1065')
    return t => { tip.rotation.z = Math.sin(t * 1.4) * 0.05 }
  },
  santa (g) {
    vox(g, 0, 8.8, 0, 9.4, 2, 9.4, '#f8fafc', 0, { rough: 1 })
    const top = group(g, 0, 9.8, 0)
    vox(top, 0, 1.4, 0, 8, 2.8, 8, '#dc2626')
    vox(top, -0.5, 3.6, 0.4, 6, 2, 6, '#b91c1c')
    vox(top, -1.8, 5, 1.2, 4, 1.6, 4, '#b91c1c')
    vox(top, -3.6, 5.2, 2.4, 2.4, 1.6, 2.4, '#991b1b')
    const pom = vox(top, -5.2, 4.6, 3.4, 2.4, 2.4, 2.4, '#ffffff', 0, { rough: 1 })
    return t => { pom.position.y = 4.6 + Math.sin(t * 3) * 0.25 }
  },
  halo (g) {
    const ring = group(g, 0, 12, 0)
    const n = 20
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const b = vox(ring, Math.cos(a) * 4.6, 0, Math.sin(a) * 4.6, 1.6, 0.7, 1.6, '#fde047', 1)
      b.rotation.y = -a
    }
    const glow = new THREE.Mesh(new THREE.RingGeometry(3.4, 6, 32), mat('#fde68a', 1, { opacity: 0.35, add: true }))
    glow.rotation.x = -Math.PI / 2
    ring.add(glow)
    return t => { ring.position.y = 12 + Math.sin(t * 2) * 0.5; ring.rotation.y = t * 0.8 }
  },
  horns (g) {
    for (const s of [-1, 1]) {
      const h = group(g, s * 3, 8, 0.5)
      const cols = ['#450a0a', '#7f1d1d', '#991b1b', '#c2410c', '#f97316', '#fdba74']
      for (let i = 0; i < 6; i++) {
        const sz = 2.2 - i * 0.3
        vox(h, s * (i * 0.7), i * 1.05, -i * i * 0.12, sz, 1.2, sz, cols[i], i === 5 ? 1 : 0)
      }
    }
    return null
  },
  visor (g) {
    vox(g, 0, 4.6, 0, 8.8, 2.4, 8.8, '#111827', 0, { metal: 0.4, rough: 0.4 })
    const lens = vox(g, 0, 4.6, 4.5, 8.2, 1.4, 0.3, '#22d3ee', 1)
    const strip = vox(g, 0, 5.6, 4.5, 8.2, 0.3, 0.32, '#f0abfc', 1)
    return t => {
      const p = 0.5 + 0.5 * Math.sin(t * 4)
      lens.material = mat(p > 0.5 ? '#22d3ee' : '#67e8f9', 1)
      strip.scale.x = 2 + 6.2 * p
    }
  },
  flowers (g) {
    const cols = ['#f9a8d4', '#ffffff', '#f472b6', '#fbcfe8']
    const n = 12
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = Math.cos(a) * 4.4, z = Math.sin(a) * 4.4
      vox(g, x, 8.3, z, 1.2, 0.8, 1.2, '#4ade80')
      const f = group(g, x, 9, z)
      const c = cols[i % cols.length]
      vox(f, 0, 0, 0, 1.6, 0.8, 0.6, c); vox(f, 0, 0, 0, 0.6, 0.8, 1.6, c)
      vox(f, 0, 0.3, 0, 0.6, 0.6, 0.6, '#fde047')
    }
    return null
  },
  crown (g) {
    const c = group(g, 0, 8, 0)
    for (let i = 0; i < 4; i++) {
      const s = group(c); s.rotation.y = i * Math.PI / 2
      vox(s, 0, 0.9, 4.3, 8.8, 1.8, 0.6, '#eab308', 0, { metal: 0.35, rough: 0.35 })
      for (const x of [-3.6, 0, 3.6]) vox(s, x, 2.6, 4.3, 1.4, x === 0 ? 2.2 : 1.6, 0.6, '#facc15', 0, { metal: 0.35, rough: 0.35 })
      vox(s, 0, 1, 4.65, 1.4, 1, 0.3, i % 2 ? '#2563eb' : '#e11d48', 1)
    }
    return t => { c.position.y = 8 + Math.sin(t * 1.5) * 0.1 }
  },
  tophat (g) {
    vox(g, 0, 8.4, 0, 12, 0.8, 12, '#0a0a0a', 0, { rough: 0.5 })
    vox(g, 0, 12.6, 0, 8, 7.6, 8, '#111111', 0, { rough: 0.5 })
    vox(g, 0, 9.6, 0, 8.3, 1.4, 8.3, '#b91c1c')
    return null
  },
  cat (g) {
    const ears = []
    for (const s of [-1, 1]) {
      const e = group(g, s * 2.6, 8, 0.4)
      vox(e, 0, 0.8, 0, 3, 1.6, 1.2, '#1f2937')
      vox(e, s * 0.2, 2.2, 0, 2, 1.4, 1.2, '#1f2937')
      vox(e, s * 0.4, 3.3, 0, 1, 1, 1.2, '#1f2937')
      vox(e, 0, 1.2, 0.5, 1.6, 1.6, 0.4, '#f9a8d4')
      ears.push(e)
    }
    return t => {
      const tw = Math.max(0, Math.sin(t * 1.3) - 0.92) * 6
      ears[0].rotation.z = tw * 0.35; ears[1].rotation.z = -tw * 0.2
    }
  }
}

// ───────── wings (body space: body spans x −4..4, y −6..6, z −2..2; wings attach at the back) ─────────
function wingPair (body, build, flap) {
  const root = group(body, 0, 2, -2.6)
  const L = group(root, -0.8, 0, 0), R = group(root, 0.8, 0, 0)
  build(L, -1); build(R, 1)
  return t => { const a = flap(t); L.rotation.y = a; R.rotation.y = -a; L.rotation.z = a * 0.15; R.rotation.z = -a * 0.15 }
}
function membrane (parent, s, pts, color, opts = {}) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * s, y)))
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), mat(color, opts.glow || 0, { opacity: opts.opacity, add: opts.add }))
  m.position.z = -0.1
  parent.add(m)
  return m
}
// Bony wings: an arm from the shoulder to the wrist, a tall spike up from the wrist, finger bones fanning down,
// and a pixel-textured membrane stretched between them with a scalloped trailing edge.
const BONE_WING = { S: [0, 0], W: [7, 4], T: [9.5, 14.5], F: [[13.5, -2.5], [9.5, -7], [4.5, -7.5]], B: [0.6, -4] }
function bone (parent, s, a, b, th, color, glow = 0) {
  const dx = (b[0] - a[0]) * s, dy = b[1] - a[1], len = Math.hypot(dx, dy)
  const m = vox(parent, a[0] * s + dx / 2, a[1] + dy / 2, 0.05, len + th * 0.6, th, th, color, glow)
  m.rotation.z = Math.atan2(dy, dx)
  return m
}
function scallop (out, a, b, depth, n = 6) {
  for (let k = 1; k <= n; k++) {
    const t = k / n
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t + Math.sin(Math.PI * t) * depth])
  }
}
// Pixel texture for the membrane: paint(u, v, x, y) -> css colour, u/v 0..1 over the wing's bounding box.
function wingTexture (paint, size = 48) {
  const c = document.createElement('canvas'); c.width = c.height = size
  const g = c.getContext('2d')
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { g.fillStyle = paint(x / size, 1 - y / size, x, y); g.fillRect(x, y, 1, 1) }
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}
const nz = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n) }
const rgb = (r, g, b) => `rgb(${r | 0},${g | 0},${b | 0})`
const lerp3 = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
function boneWings (body, o) {
  const { S, W, T, F, B } = BONE_WING
  const tex = wingTexture(o.paint)
  const mtl = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85, transparent: true, alphaTest: 0.05, emissive: o.glow ? 0xffffff : 0x000000, emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow || 0 })
  const fn = wingPair(body, (w, s) => {
    const pts = [S, W, T, F[0]]
    scallop(pts, F[0], F[1], 2.2); scallop(pts, F[1], F[2], 2.2); scallop(pts, F[2], B, 1.8)
    const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x * s, y)))
    const geo = new THREE.ShapeGeometry(shape)
    const pos = geo.attributes.position, uv = []
    for (let i = 0; i < pos.count; i++) uv.push((pos.getX(i) * s + 0.5) / 15, (pos.getY(i) + 8) / 23)
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
    const m = new THREE.Mesh(geo, mtl); m.position.z = -0.02; w.add(m)
    bone(w, s, S, W, 1.1, o.bone)
    bone(w, s, W, T, 0.9, o.bone)
    for (const f of F) bone(w, s, W, f, 0.55, o.finger || o.bone)
    vox(w, W[0] * s, W[1], 0.05, 1.5, 1.5, 1.5, o.joint || o.bone, o.jointGlow ? 1 : 0)
    vox(w, T[0] * s, T[1] + 0.6, 0.05, 0.7, 1.4, 0.7, o.tip || o.bone, o.jointGlow ? 1 : 0)
  }, o.flap)
  return (t, dt) => { fn(t); if (o.flow) tex.offset.y -= (dt || 0.016) * o.flow }
}
const WING_PAINT = {
  bat: (u, v, x, y) => {
    const edge = Math.min(u, v, 1 - u, 1 - v)
    const k = 18 + nz(x, y) * 14 + (v > 0.55 ? 6 : 0)
    return edge < 0.03 ? rgb(70, 70, 76) : rgb(k, k * 0.92, k * 1.15)
  },
  fire: (u, v, x, y) => {
    const d = Math.hypot(u - 0.48, v - 0.5) * 1.6
    const f = Math.min(1, Math.max(0, d + (nz(x, Math.floor(y / 2)) - 0.5) * 0.35))
    const c = f < 0.3 ? lerp3([20, 4, 2], [120, 12, 6], f / 0.3) : f < 0.6 ? lerp3([120, 12, 6], [235, 80, 10], (f - 0.3) / 0.3) : lerp3([235, 80, 10], [255, 225, 60], (f - 0.6) / 0.4)
    return rgb(...c)
  },
  phoenix: (u, v, x, y) => {
    const n = nz(x, y >> 1, 3)
    const t = (v + n * 0.35) % 1
    const c = t < 0.33 ? lerp3([255, 240, 140], [255, 160, 30], t / 0.33) : t < 0.66 ? lerp3([255, 160, 30], [230, 50, 20], (t - 0.33) / 0.33) : lerp3([230, 50, 20], [255, 240, 140], (t - 0.66) / 0.34)
    return rgb(...c)
  },
  void: (u, v, x, y) => {
    const s = nz(x, y, 9)
    if (s > 0.965) return rgb(255, 255, 255)
    const c = lerp3([8, 4, 24], [88, 28, 135], Math.max(0, v - 0.2) * (0.7 + nz(x >> 2, y >> 2, 4) * 0.5))
    return rgb(...c)
  }
}
const WINGS = {
  bat: body => boneWings(body, { paint: WING_PAINT.bat, bone: '#9ca3af', finger: '#a1a1aa', joint: '#6b7280', flap: t => 0.3 + Math.sin(t * 2.2) * 0.32 }),
  phoenix: body => boneWings(body, { paint: WING_PAINT.phoenix, bone: '#b45309', joint: '#fde047', tip: '#fde047', jointGlow: true, glow: 0.9, flow: 0.25, flap: t => 0.35 + Math.sin(t * 1.8) * 0.35 }),
  void: body => boneWings(body, { paint: WING_PAINT.void, bone: '#1e1b4b', finger: '#312e81', joint: '#a855f7', tip: '#c084fc', jointGlow: true, glow: 0.35, flow: 0.05, flap: t => 0.3 + Math.sin(t * 1.5) * 0.3 }),
  angel: body => wingPair(body, (w, s) => {
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 7 - row; i++) {
        const len = 7 - row * 1.6 + (i < 2 ? 0 : 1.5)
        const f = vox(w, s * (2 + i * 1.8), 4 - row * 2.2 - i * 0.6 - len / 2, -row * 0.2, 1.7, len, 0.5, row === 0 ? '#ffffff' : row === 1 ? '#f1f5f9' : '#e2e8f0', 0, { rough: 1 })
        f.rotation.z = s * (0.15 + i * 0.07)
      }
    }
    vox(w, s * 6, 4.6, 0.1, 12, 1.4, 0.8, '#ffffff', 0, { rough: 1 }).rotation.z = s * 0.18
  }, t => 0.3 + Math.sin(t * 1.6) * 0.25),
  frost: body => {
    const shards = []
    const fn = wingPair(body, (w, s) => {
      const spec = [[3, 3, 9, 0.55], [5, 0, 11, 0.25], [6, -3, 9, -0.1], [5, -5, 6, -0.45], [9, 4, 6, 0.8]]
      for (const [x, y, l, a] of spec) {
        const sh = vox(w, s * (x + l / 2 * Math.cos(a)), y + l / 2 * Math.sin(a), 0, l, 1.3, 0.5, '#7dd3fc', 1, { opacity: 0.75, add: true })
        sh.rotation.z = s * a
        shards.push(sh)
        vox(w, s * (x + l / 2 * Math.cos(a)), y + l / 2 * Math.sin(a), 0.05, l * 0.9, 0.4, 0.55, '#e0f2fe', 1).rotation.z = s * a
      }
    }, t => 0.4 + Math.sin(t * 1.2) * 0.12)
    return t => { fn(t); shards.forEach((m, i) => { m.scale.y = 1.3 + Math.sin(t * 3 + i) * 0.25 }) }
  },
  dragon: body => boneWings(body, { paint: WING_PAINT.fire, bone: '#991b1b', finger: '#7f1d1d', joint: '#450a0a', tip: '#1c0303', glow: 0.25, flap: t => 0.4 + Math.sin(t * 1.4) * 0.4 }),
  mech: body => {
    const blades = []
    const fn = wingPair(body, (w, s) => {
      for (let i = 0; i < 4; i++) {
        const b = group(w, 0, 3 - i * 0.6, 0)
        const l = 13 - i * 2
        vox(b, s * l / 2, 0, 0, l, 1.2, 0.8, '#475569', 0, { metal: 0.4, rough: 0.4 })
        vox(b, s * l / 2, -0.75, 0, l, 0.3, 0.85, i % 2 ? '#22d3ee' : '#f0abfc', 1)
        b.userData.base = s * (0.5 - i * 0.32)
        blades.push(b)
      }
      vox(w, 0, 2, 0, 2, 4, 1.4, '#334155', 0, { metal: 0.4, rough: 0.4 })
    }, () => 0.25)
    return t => { fn(t); const o = 0.6 + 0.4 * Math.sin(t * 0.9); blades.forEach(b => { b.rotation.z = b.userData.base * o }) }
  },
  butterfly: body => wingPair(body, (w, s) => {
    membrane(w, s, [[0, 1], [3, 7], [8, 9], [11, 6], [9, 2], [0, 0]], '#f9a8d4', { opacity: 0.92 })
    membrane(w, s, [[0, 0], [7, -1], [8, -5], [5, -8], [1, -4]], '#c4b5fd', { opacity: 0.92 })
    for (const [x, y, c] of [[6, 6, '#fdf2f8'], [8.5, 6.5, '#ffffff'], [4.6, -4, '#fef3c7']]) vox(w, s * x, y, 0.1, 1.2, 1.2, 0.2, c, 1)
  }, t => 0.3 + Math.abs(Math.sin(t * 6)) * 0.9)
}

// ───────── auras (player space: feet at y −16, head top at +16) ─────────
function particles (root, n, spawn, step) {
  const ps = []
  for (let i = 0; i < n; i++) { const m = spawn(i); m.userData.life = Math.random(); root.add(m); ps.push(m) }
  return (t, dt) => ps.forEach((m, i) => step(m, i, t, dt))
}
const rnd = (a, b) => a + Math.random() * (b - a)
function heartTex () {
  const c = document.createElement('canvas'); c.width = c.height = 7
  const g = c.getContext('2d'); g.fillStyle = '#ff3b6b'
  ;['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'].forEach((r, y) => [...r].forEach((ch, x) => ch === 'X' && g.fillRect(x, y, 1, 1)))
  const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; return t
}
const AURAS = {
  souls: root => particles(root, 26, () => vox(root, 0, 0, 0, 1, 1, 1, '#38bdf8', 1, { opacity: 0.85, add: true }), (m, i, t, dt) => {
    let L = m.userData.life += dt * 0.45
    if (L > 1) { L = m.userData.life = 0; const a = rnd(0, 6.28), r = rnd(5, 9); m.userData.x = Math.cos(a) * r; m.userData.z = Math.sin(a) * r }
    m.position.set((m.userData.x || 0) + Math.sin(t * 3 + i) * 0.4, -16 + L * 22, m.userData.z || 0)
    const s = (1 - L) * 1.4 * (0.8 + 0.4 * Math.sin(t * 12 + i)); m.scale.set(s, s * 1.4, s)
  }),
  snow: root => particles(root, 40, () => vox(root, 0, 0, 0, 0.7, 0.7, 0.7, '#ffffff', 1, { opacity: 0.9 }), (m, i, t, dt) => {
    let L = m.userData.life += dt * 0.22
    if (L > 1) { L = m.userData.life = 0; m.userData.x = rnd(-12, 12); m.userData.z = rnd(-12, 12) }
    m.position.set((m.userData.x || 0) + Math.sin(t + i) * 1.2, 22 - L * 40, m.userData.z || 0)
    m.rotation.set(t + i, t * 0.7, 0)
  }),
  stars: root => particles(root, 22, i => vox(root, 0, 0, 0, 0.8, 0.8, 0.8, i % 3 ? '#fde047' : '#ffffff', 1, { add: true }), (m, i, t) => {
    const a = t * (0.5 + (i % 5) * 0.12) + i * 2.4, r = 9 + (i % 4) * 1.5
    m.position.set(Math.cos(a) * r, -14 + ((i * 7) % 30) + Math.sin(t * 2 + i) * 1.5, Math.sin(a) * r)
    const s = 0.5 + Math.abs(Math.sin(t * 4 + i)) * 0.9; m.scale.setScalar(s); m.rotation.set(t * 2, t * 3, 0)
  }),
  embers: root => particles(root, 34, i => vox(root, 0, 0, 0, 0.6, 0.6, 0.6, i % 2 ? '#fb923c' : '#facc15', 1, { add: true }), (m, i, t, dt) => {
    let L = m.userData.life += dt * (0.5 + (i % 3) * 0.2)
    if (L > 1) { L = m.userData.life = 0; m.userData.x = rnd(-8, 8); m.userData.z = rnd(-6, 6) }
    m.position.set((m.userData.x || 0) + Math.sin(t * 5 + i) * 0.8, -16 + L * 34, m.userData.z || 0)
    m.scale.setScalar((1 - L) * 1.2)
  }),
  pixels: root => particles(root, 30, i => vox(root, 0, 0, 0, 1, 1, 1, i % 2 ? '#f0abfc' : '#22d3ee', 1, { add: true }), (m, i, t) => {
    const a = -t * 0.9 + i * 0.21, r = 10 + Math.sin(i) * 1.5
    m.position.set(Math.cos(a) * r, -15 + (i / 30) * 30, Math.sin(a) * r)
    m.visible = Math.sin(t * 6 + i * 1.7) > -0.3
  }),
  petals: root => particles(root, 30, i => vox(root, 0, 0, 0, 1.2, 0.15, 0.8, i % 3 ? '#f9a8d4' : '#fbcfe8', 1), (m, i, t, dt) => {
    let L = m.userData.life += dt * 0.18
    if (L > 1) L = m.userData.life = 0
    const a = t * 0.8 + i * 0.7, r = 8 + (i % 4) * 1.4
    m.position.set(Math.cos(a) * r, 18 - L * 36, Math.sin(a) * r)
    m.rotation.set(t * 2 + i, t + i, t * 1.5)
  }),
  hearts: root => {
    const tex = heartTex()
    return particles(root, 14, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true })); s.scale.setScalar(2.4); return s }, (m, i, t, dt) => {
      let L = m.userData.life += dt * 0.35
      if (L > 1) { L = m.userData.life = 0; m.userData.x = rnd(-9, 9); m.userData.z = rnd(-5, 5) }
      m.position.set((m.userData.x || 0) + Math.sin(t * 2 + i) * 0.8, -6 + L * 26, m.userData.z || 0)
      m.material.opacity = L < 0.8 ? 1 : (1 - L) * 5
    })
  }
}

// ───────── viewer ─────────
export class Dresser {
  /** opts: { canvas, width, height, skin, zoom, animation: 'idle'|'walk'|false, rotate, thumbnail } */
  constructor (opts) {
    this.viewer = new skinview3d.SkinViewer({
      canvas: opts.canvas, width: opts.width || 300, height: opts.height || 400,
      skin: opts.skin || DEFAULT_SKIN, preserveDrawingBuffer: !!opts.thumbnail, renderPaused: !!opts.thumbnail
    })
    const v = this.viewer
    v.fov = 40
    v.zoom = opts.zoom || 0.82
    v.globalLight.intensity = 3
    v.cameraLight.intensity = 0.6
    if (opts.animation === 'walk') v.animation = new skinview3d.WalkingAnimation(), v.animation.speed = 0.55
    else if (opts.animation !== false) v.animation = new skinview3d.IdleAnimation()
    v.autoRotate = !!opts.rotate
    v.autoRotateSpeed = 0.9
    if (v.controls) { v.controls.enableZoom = !opts.thumbnail; v.controls.enablePan = false }
    this.slots = { hat: null, wings: null, aura: null }
    this.updaters = {}
    this.cape = null
    this.capeImgs = []
    this.t0 = performance.now()
    this.last = this.t0
    if (!opts.thumbnail) this.loop()
  }

  setSkin (url) { return this.viewer.loadSkin(url).catch(() => this.viewer.loadSkin(DEFAULT_SKIN)) }

  loop () {
    if (this.viewer.disposed) return
    this.tick(performance.now())
    requestAnimationFrame(() => this.loop())
  }

  tick (now) {
    const t = (now - this.t0) / 1000, dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    for (const f of Object.values(this.updaters)) f && f(t, dt)
    if (this.capeImgs.length > 1 && this.viewer.capeTexture) {
      const f = Math.floor(now / CAPE_FRAME_MS) % this.capeImgs.length
      if (f !== this.capeFrame) { this.capeFrame = f; loadCapeToCanvas(this.viewer.capeCanvas, this.capeImgs[f]); this.viewer.capeTexture.needsUpdate = true }
    }
  }

  async setCape (it) {
    this.cape = it
    if (!it) { this.capeImgs = []; this.viewer.resetCape(); return }
    const imgs = await Promise.all(capeFrames(it).map(loadImg))
    if (this.cape !== it) return
    this.capeImgs = imgs
    this.capeFrame = 0
    this.viewer.loadCape(imgs[0])
  }

  setPiece (slot, it) {
    const old = this.slots[slot]
    if (old) old.parent.remove(old)
    this.slots[slot] = null
    this.updaters[slot] = null
    if (!it) return
    const p = this.viewer.playerObject
    const parent = slot === 'hat' ? p.skin.head : slot === 'wings' ? p.skin.body : p
    const g = group(parent)
    const build = (slot === 'hat' ? HATS : slot === 'wings' ? WINGS : AURAS)[it.model]
    if (!build) return
    this.updaters[slot] = build(g) || null
    this.slots[slot] = g
  }

  /** look: { cape, hat, wings, aura } → catalog items (or null) */
  async wear (look) {
    this.setPiece('hat', look.hat)
    this.setPiece('wings', look.wings)
    this.setPiece('aura', look.aura)
    await this.setCape(look.cape)
  }

  /** Renders one still frame (for thumbnails) and returns a data URL. */
  async snapshot (look, angle = 0, frame = { zoom: 0.9, y: 0 }, t = 1.2) {
    await this.wear(look)
    const v = this.viewer
    v.playerWrapper.rotation.y = angle
    v.zoom = frame.zoom
    v.playerWrapper.position.y = frame.y
    for (const f of Object.values(this.updaters)) f && f(t, 0.016)
    for (let i = 0; i < 40; i++) for (const f of Object.values(this.updaters)) f && f(t + i * 0.05, 0.05)
    v.render()
    return v.canvas.toDataURL('image/png')
  }

  dispose () { this.viewer.dispose() }
}
