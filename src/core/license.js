// Xion Premium: offline Ed25519 license keys, each locked to one computer.
// The buyer sends their Device ID (Settings → Xion Premium); the Xion Key Tool signs a key containing it,
// so the key only unlocks on that computer. Only the public key ships here: keys can be checked, never made.
const crypto = require('crypto')
const fs = require('fs')
const { execFileSync } = require('child_process')

const PUBLIC_KEY_B64 = 'a5cn2efk6Jh2DpcxBDUHDQPOVIGFE5Xhdz+uMkp8wa4='
const SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')
const publicKey = crypto.createPublicKey({ key: Buffer.concat([SPKI_PREFIX, Buffer.from(PUBLIC_KEY_B64, 'base64')]), format: 'der', type: 'spki' })

let cachedDevice = null
/** 16 hex chars identifying this computer (hash of the Windows MachineGuid, or /etc/machine-id on Linux). The in-game client computes the same value. */
function deviceId () {
  if (cachedDevice) return cachedDevice
  let guid = ''
  if (process.platform === 'win32') {
    try {
      const out = execFileSync('reg', ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'], { encoding: 'utf8', windowsHide: true })
      guid = (/MachineGuid\s+REG_SZ\s+(\S+)/.exec(out) || [])[1] || ''
    } catch {}
  } else {
    for (const f of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
      try { guid = fs.readFileSync(f, 'utf8').trim() } catch {}
      if (guid) break
    }
  }
  cachedDevice = crypto.createHash('sha256').update('xion-device:' + guid.toLowerCase()).digest('hex').slice(0, 16)
  return cachedDevice
}

/** Device ID as shown to players: XXXX-XXXX-XXXX-XXXX */
const deviceIdDisplay = () => deviceId().toUpperCase().match(/.{4}/g).join('-')

/** @returns {{ valid: true, name: string, email: string, id: string, issued: number } | { valid: false, reason: string }} */
function verify (key) {
  const m = /^XION-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(key || '').trim())
  if (!m) return { valid: false, reason: 'That doesn\'t look like a Xion key. It starts with XION-.' }
  let ok = false
  try { ok = crypto.verify(null, Buffer.from(m[1], 'base64url'), publicKey, Buffer.from(m[2], 'base64url')) } catch {}
  if (!ok) return { valid: false, reason: 'This key isn\'t valid. Check it was copied completely.' }
  let p
  try { p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8')) } catch { return { valid: false, reason: 'This key is damaged.' } }
  // Keys made before device locking have no `d` and keep working.
  if (p.d && p.d !== deviceId()) return { valid: false, reason: 'This key was made for a different computer. Send the seller your Device ID to get a key for this one.' }
  return { valid: true, name: p.n || '', email: p.e || '', id: p.id || '', issued: p.t || 0 }
}

module.exports = { verify, deviceId, deviceIdDisplay, PUBLIC_KEY_B64 }
