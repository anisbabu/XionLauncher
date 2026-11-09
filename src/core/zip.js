const fs = require('fs')
const zlib = require('zlib')

// Reads a single entry from a .zip/.jar without extracting the archive.
function readEntry (file, name) {
  const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file)
  // End of central directory record (search backwards, comment may follow it)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) return null
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const entry = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (entry === name) {
      const lNameLen = buf.readUInt16LE(local + 26)
      const lExtraLen = buf.readUInt16LE(local + 28)
      const start = local + 30 + lNameLen + lExtraLen
      const data = buf.subarray(start, start + csize)
      return method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data)
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

// Parses fabric.mod.json from a mod jar (tolerates the control characters some mods ship).
function modMeta (file) {
  try {
    const raw = readEntry(file, 'fabric.mod.json')
    if (!raw) return null
    return JSON.parse(raw.toString('utf8').replace(/[\u0000-\u001f]+/g, ' '))
  } catch {
    return null
  }
}

// Every mod id a jar provides: its own id, 'provides' aliases and nested (jar-in-jar) mods.
function providedIds (file, depth = 0) {
  const ids = new Set()
  const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file)
  const meta = modMeta(buf)
  if (!meta) return ids
  if (meta.id) ids.add(meta.id)
  for (const p of meta.provides || []) ids.add(typeof p === 'string' ? p : p.id)
  if (depth < 2) {
    for (const j of meta.jars || []) {
      try {
        const inner = readEntry(buf, j.file)
        if (inner) providedIds(inner, depth + 1).forEach(i => ids.add(i))
      } catch {}
    }
  }
  return ids
}

/** Every entry whose name passes test(name), as [{ name, data }]. */
function readEntries (file, test) {
  const buf = Buffer.isBuffer(file) ? file : fs.readFileSync(file)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return []
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const out = []
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) break
    const method = buf.readUInt16LE(p + 10)
    const csize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    if (test(name)) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + csize)
      out.push({ name, data: method === 8 ? zlib.inflateRawSync(data) : Buffer.from(data) })
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return out
}

module.exports = { readEntry, readEntries, modMeta, providedIds }
