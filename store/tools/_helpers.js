// Colour, noise, cape-layout rasteriser and PNG encoder, copied from build/make-capes.js.
const zlib = require("zlib")
const K = 4, W = 64 * K, H = 32 * K
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t)
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const shade = (c, k) => c.map(v => v * k)
const grad = (cols, t) => {
  t = clamp(t) * (cols.length - 1)
  const i = Math.min(cols.length - 2, Math.floor(t))
  return mix(cols[i], cols[i + 1], t - i)
}
const hsv = (h, s, v) => {
  h = ((h % 1) + 1) % 1
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s)
  return [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6].map(x => x * 255)
}
// Deterministic value noise + fbm.
const hash = (x, y, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n) }
function noise (x, y, s = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
  const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const fbm = (x, y, s = 0, o = 4) => { let t = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { t += a * noise(x * f, y * f, s + i); a *= 0.5; f *= 2 } return t }

// Even-odd point-in-polygon: -1 inside, 1 outside.
function inPoly (pts, x, y) { let inside = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside } return inside ? -1 : 1 }
function render (paint, t) {
  const buf = Buffer.alloc(W * H * 4)
  const put = (x, y, c, a = 255) => { const i = (y * W + x) * 4; buf[i] = clamp(c[0], 0, 255); buf[i + 1] = clamp(c[1], 0, 255); buf[i + 2] = clamp(c[2], 0, 255); buf[i + 3] = a }
  const sample = (u, v) => { // 2x2 supersample in face space
    let r = 0, g = 0, b = 0
    for (const [du, dv] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) { const c = paint(u + du * su, v + dv * sv, t); r += c[0]; g += c[1]; b += c[2] }
    return [r / 4, g / 4, b / 4]
  }
  let su = 0, sv = 0
  const face = (x0, y0, w, h, mirror, edgeTrim = true) => {
    su = 1 / (w * K); sv = 1 / (h * K)
    for (let y = 0; y < h * K; y++) for (let x = 0; x < w * K; x++) {
      let u = x / (w * K), v = y / (h * K)
      if (mirror) u = 1 - u - su
      let c = sample(u, v)
      if (edgeTrim) { const e = Math.min(u, 1 - u - su, v, 1 - v - sv); if (e < 0.03) c = shade(c, 0.7) }
      put(x0 * K + x, y0 * K + y, c)
    }
  }
  face(1, 1, 10, 16, false)
  face(12, 1, 10, 16, true)
  // sides, top, bottom: darker edge colour from the face border
  const edge = (x0, y0, w, h, u0, v0) => { for (let y = 0; y < h * K; y++) for (let x = 0; x < w * K; x++) put(x0 * K + x, y0 * K + y, shade(paint(u0 === null ? x / (w * K) : u0, v0 === null ? y / (h * K) : v0, t), 0.6)) }
  edge(0, 1, 1, 16, 0, null); edge(11, 1, 1, 16, 1, null); edge(1, 0, 10, 1, null, 0); edge(11, 0, 10, 1, null, 1)
  face(22, 0, 24, 22, false, false)
  return buf
}

// ---------- PNG encoder ----------
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]) }
function png (rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H)
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4) }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}
module.exports = { hex, mix, clamp, smooth, shade, grad, hsv, hash, noise, fbm, inPoly, render, png, K, W, H }
