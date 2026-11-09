// Locker: a player's owned cosmetics. POST JSON { action, name, key, ... }
//   open   {name, key}               owned items + what is equipped
//   equip  {name, key, slot, item}   wear an owned item in a slot (item "" takes it off)
const C = require('./catalog')
const S = require('./_cos')

const view = p => ({ name: p.name, display: p.display, owned: p.owned || [], equipped: p.equipped || {} })

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return S.send(res, 405, { error: 'Method not allowed' })
    const b = req.body || {}
    const name = S.clean(b.name, 16)
    if (!S.IGN.test(name)) return S.send(res, 400, { error: 'Enter your Minecraft name.' })
    if (!(S.memLimit(req, 'locker', 60, 10 * 60 * 1000))) return S.send(res, 429, { error: 'Too many tries. Wait a few minutes.' })
    const p = await S.getPlayer(name)
    if (!S.keyOk(p, b.key)) {
      await new Promise(r => setTimeout(r, 400))
      return S.send(res, 401, { error: 'Name or locker key is wrong. Your key is shown on your approved order.' })
    }

    if (b.action === 'open') return S.send(res, 200, view(p))

    if (b.action === 'equip') {
      const slot = S.clean(b.slot, 10)
      if (!S.SLOTS.includes(slot)) return S.send(res, 400, { error: 'Unknown slot.' })
      const item = S.clean(b.item, 40)
      p.equipped = p.equipped || {}
      if (!item) delete p.equipped[slot]
      else {
        const it = C.byId(item)
        if (!it || it.type !== slot) return S.send(res, 400, { error: 'That item does not go there.' })
        if (!(p.owned || []).includes(item)) return S.send(res, 403, { error: 'You do not own that item yet.' })
        p.equipped[slot] = item
      }
      await S.savePlayer(p)
      await S.updateWear(p)
      return S.send(res, 200, view(p))
    }

    return S.send(res, 400, { error: 'Unknown action' })
  } catch (e) {
    console.error(e)
    return S.send(res, 500, { error: 'Something went wrong. Please try again.' })
  }
}
