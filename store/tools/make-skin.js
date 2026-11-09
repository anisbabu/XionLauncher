// Draws the store's own default preview skin ("Xion Explorer": dark hoodie, purple trim) into assets/default-skin.png.
// Run: node store/tools/make-skin.js
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const W = 64, H = 64
const buf = Buffer.alloc(W * H * 4)
const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const n = (x, y) => { const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453; return s - Math.floor(s) }
function rect (x0, y0, w, h, col, jitter = 0.08) {
  const c = hex(col)
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) {
    const k = 1 - jitter + n(x, y) * jitter * 2, i = (y * W + x) * 4
    buf[i] = Math.min(255, c[0] * k); buf[i + 1] = Math.min(255, c[1] * k); buf[i + 2] = Math.min(255, c[2] * k); buf[i + 3] = 255
  }
}
const px = (x, y, col) => rect(x, y, 1, 1, col, 0)

const SKIN = '#d9a27c', HAIR = '#2b1d16', HOOD = '#1f1b2e', TRIM = '#8b5cf6', PANTS = '#2a2f45', SHOE = '#111318'
// head (all six faces), then hair on top/back/sides
rect(0, 0, 32, 16, SKIN)
rect(8, 0, 8, 8, HAIR); rect(24, 8, 8, 8, HAIR)
rect(0, 8, 8, 3, HAIR); rect(16, 8, 8, 3, HAIR); rect(8, 8, 8, 2, HAIR)
px(8, 10, HAIR); px(15, 10, HAIR)
// face
rect(9, 12, 2, 1, '#ffffff', 0); rect(13, 12, 2, 1, '#ffffff', 0)
px(10, 12, '#5b21b6'); px(13, 12, '#5b21b6')
rect(11, 14, 2, 1, '#9a5b45', 0)
// body + arms (hoodie) and legs
rect(16, 16, 24, 16, HOOD); rect(40, 16, 16, 16, HOOD); rect(32, 48, 16, 16, HOOD)
rect(20, 20, 8, 1, TRIM, 0); rect(23, 21, 2, 6, TRIM, 0); rect(20, 27, 8, 1, '#3b2f63', 0)
rect(44, 29, 4, 3, SKIN); rect(36, 61, 4, 3, SKIN); rect(40, 30, 16, 1, TRIM, 0); rect(32, 62, 16, 1, TRIM, 0)
rect(0, 16, 16, 16, PANTS); rect(16, 48, 16, 16, PANTS)
rect(0, 29, 16, 3, SHOE); rect(16, 61, 16, 3, SHOE)

const CRC = new Int32Array(256).map((_, k) => { let c = k; for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]) }
const raw = Buffer.alloc((W * 4 + 1) * H)
for (let y = 0; y < H; y++) buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4)
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6
fs.writeFileSync(path.join(__dirname, '..', 'assets', 'default-skin.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
console.log('default-skin.png written')
