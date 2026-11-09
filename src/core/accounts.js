const crypto = require('crypto')
const { Auth } = require('msmc')
const store = require('./store')

// Same algorithm vanilla uses for offline-mode UUIDs (name-based v3 UUID).
function offlineUUID (name) {
  const md5 = crypto.createHash('md5').update('OfflinePlayer:' + name).digest()
  md5[6] = (md5[6] & 0x0f) | 0x30
  md5[8] = (md5[8] & 0x3f) | 0x80
  const h = md5.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

function publicAccount (a) {
  return { id: a.id, type: a.type, name: a.name, uuid: a.uuid }
}

function list () {
  const d = store.get()
  return { accounts: d.accounts.map(publicAccount), active: d.activeAccount }
}

function addOffline (name) {
  name = String(name || '').trim()
  if (!/^[A-Za-z0-9_]{3,16}$/.test(name)) throw new Error('Username must be 3-16 characters: letters, numbers, underscore.')
  const d = store.get()
  const uuid = offlineUUID(name)
  let acc = d.accounts.find(a => a.type === 'offline' && a.name.toLowerCase() === name.toLowerCase())
  if (!acc) {
    acc = { id: 'off-' + uuid, type: 'offline', name, uuid }
    d.accounts.push(acc)
  }
  d.activeAccount = acc.id
  store.save()
  return publicAccount(acc)
}

async function addMicrosoft () {
  const auth = new Auth('select_account')
  const xbox = await auth.launch('electron', {
    width: 520,
    height: 680,
    resizable: false,
    title: 'Sign in with Microsoft',
    backgroundColor: '#0b0b12',
    autoHideMenuBar: true
  })
  const mc = await xbox.getMinecraft()
  if (!mc.profile || !mc.profile.id) throw new Error('This Microsoft account does not own Minecraft: Java Edition.')
  const d = store.get()
  const uuid = mc.profile.id
  const existing = d.accounts.find(a => a.type === 'microsoft' && a.uuid === uuid)
  const acc = existing || { id: 'ms-' + uuid, type: 'microsoft', uuid }
  acc.name = mc.profile.name
  acc.refresh = xbox.save()
  if (!existing) d.accounts.push(acc)
  d.activeAccount = acc.id
  store.save()
  return publicAccount(acc)
}

function remove (id) {
  const d = store.get()
  d.accounts = d.accounts.filter(a => a.id !== id)
  if (d.activeAccount === id) d.activeAccount = d.accounts[0] ? d.accounts[0].id : null
  store.save()
  return list()
}

function select (id) {
  const d = store.get()
  if (d.accounts.some(a => a.id === id)) d.activeAccount = id
  store.save()
  return list()
}

// Produces the MCLC authorization object, refreshing Microsoft tokens on demand.
async function authorization () {
  const d = store.get()
  const acc = d.accounts.find(a => a.id === d.activeAccount)
  if (!acc) throw new Error('No account selected. Add an account first.')
  if (acc.type === 'offline') {
    return {
      access_token: '0',
      client_token: acc.uuid,
      uuid: acc.uuid.replace(/-/g, ''),
      name: acc.name,
      user_properties: '{}',
      meta: { type: 'mojang', demo: false }
    }
  }
  if (!acc.refresh) throw new Error('Microsoft session expired. Please sign in again.')
  try {
    const auth = new Auth('select_account')
    const xbox = await auth.refresh(acc.refresh)
    const mc = await xbox.getMinecraft()
    acc.refresh = xbox.save()
    acc.name = mc.profile.name
    store.save()
    return mc.mclc()
  } catch (e) {
    throw new Error('Microsoft session expired or was revoked. Remove the account and sign in again. (' + (e && (e.message || e.name || e)) + ')')
  }
}

module.exports = { list, addOffline, addMicrosoft, remove, select, authorization, offlineUUID }
