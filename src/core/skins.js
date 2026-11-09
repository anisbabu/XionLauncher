const fs = require('fs')
const path = require('path')
const store = require('./store')
const accounts = require('./accounts')
const { request } = require('./download')

const API = 'https://api.minecraftservices.com/minecraft/profile'
const skinDir = () => path.join(store.ROOT, 'skins')

function activeAccount () {
  const d = store.get()
  const acc = d.accounts.find(a => a.id === d.activeAccount)
  if (!acc) throw new Error('Add an account first.')
  return acc
}

function localSkinPath (acc) {
  return path.join(skinDir(), `${acc.id.replace(/[^\w-]/g, '_')}.png`)
}

// Reads width/height from a PNG header and checks it is a Minecraft skin.
function validateSkin (buf) {
  if (buf.length < 24 || buf.toString('ascii', 1, 4) !== 'PNG') throw new Error('Skin must be a PNG image.')
  const w = buf.readUInt32BE(16)
  const h = buf.readUInt32BE(20)
  if (w !== 64 || (h !== 64 && h !== 32)) throw new Error(`Skin must be 64×64 (or legacy 64×32). This image is ${w}×${h}.`)
}

const toDataUrl = buf => 'data:image/png;base64,' + buf.toString('base64')

async function msToken () {
  const auth = await accounts.authorization()
  return auth.access_token
}

async function get () {
  const acc = activeAccount()
  if (acc.type === 'microsoft') {
    const token = await msToken()
    const res = await request(API, { headers: { Authorization: 'Bearer ' + token } })
    if (!res.ok) throw new Error('Could not load your Minecraft profile (HTTP ' + res.status + ').')
    const profile = await res.json()
    const active = (profile.skins || []).find(s => s.state === 'ACTIVE')
    if (!active) return { account: acc.type, name: acc.name, skin: null, slim: false }
    const img = await request(active.url.replace(/^http:/, 'https:'), {})
    return { account: acc.type, name: acc.name, skin: toDataUrl(Buffer.from(await img.arrayBuffer())), slim: active.variant === 'SLIM' }
  }
  const file = localSkinPath(acc)
  const skin = fs.existsSync(file) ? toDataUrl(fs.readFileSync(file)) : null
  return { account: acc.type, name: acc.name, skin, slim: !!acc.skinSlim }
}

async function set (filePath, slim) {
  const acc = activeAccount()
  const buf = fs.readFileSync(filePath)
  validateSkin(buf)
  if (acc.type === 'microsoft') {
    const token = await msToken()
    const form = new FormData()
    form.append('variant', slim ? 'slim' : 'classic')
    form.append('file', new Blob([buf], { type: 'image/png' }), 'skin.png')
    const res = await request(API + '/skins', { method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: form })
    if (!res.ok) throw new Error('Mojang rejected the skin (HTTP ' + res.status + '). Try again in a minute.')
  } else {
    fs.mkdirSync(skinDir(), { recursive: true })
    fs.writeFileSync(localSkinPath(acc), buf)
    acc.skinSlim = !!slim
    store.save()
  }
  return { skin: toDataUrl(buf), slim: !!slim }
}

async function reset () {
  const acc = activeAccount()
  if (acc.type === 'microsoft') {
    const token = await msToken()
    const res = await request(API + '/skins/active', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } })
    if (!res.ok) throw new Error('Could not reset skin (HTTP ' + res.status + ').')
  } else {
    try { fs.unlinkSync(localSkinPath(acc)) } catch {}
  }
}

// What the in-game Xion Client should know about the account (written to the instance config).
function launchInfo () {
  const d = store.get()
  const acc = d.accounts.find(a => a.id === d.activeAccount)
  if (!acc) return { account: 'offline' }
  const file = localSkinPath(acc)
  return {
    account: acc.type,
    skin: acc.type === 'offline' && fs.existsSync(file) ? file : null,
    slim: !!acc.skinSlim
  }
}

function setModel (slim) {
  const acc = activeAccount()
  acc.skinSlim = !!slim
  store.save()
}

module.exports = { get, set, reset, setModel, launchInfo }
