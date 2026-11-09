// Xion Store admin panel.
(() => {
  const $ = s => document.querySelector(s)
  const $$ = s => [...document.querySelectorAll(s)]
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const SYM = { USD: '$', BDT: '৳', INR: '₹' }
  const money = (v, c) => SYM[c] + (c === 'USD' ? Number(v).toFixed(2) : v)
  let token = sessionStorage.getItem('xs.admin') || ''
  let orders = [], sel = null, ofilter = 'pending', catalog = null

  function toast (m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2200) }
  async function call (action, body = {}) {
    const r = await fetch('/api/admin', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ action, ...body }) })
    const d = await r.json().catch(() => ({}))
    if (r.status === 401 && action !== 'login') { logout(); throw new Error(d.error || 'Log in again') }
    if (!r.ok) throw new Error(d.error || 'Error')
    return d
  }
  function logout () { token = ''; sessionStorage.removeItem('xs.admin'); $('#app').classList.add('hidden'); $('#logout').classList.add('hidden'); $('#login').classList.remove('hidden') }

  $('#login').onsubmit = async e => {
    e.preventDefault()
    $('#loginErr').textContent = ''
    try { token = (await call('login', { user: e.target.user.value, pass: e.target.pass.value })).token; sessionStorage.setItem('xs.admin', token); start() } catch (x) { $('#loginErr').textContent = x.message }
  }
  $('#logout').onclick = logout

  // ── orders ──
  async function loadOrders () {
    orders = (await call('orders')).orders
    $('#pendingN').textContent = orders.filter(o => o.status === 'pending').length ? `(${orders.filter(o => o.status === 'pending').length})` : ''
    drawList()
    if (sel) { const o = orders.find(x => x.id === sel); if (o) drawOrder(o) }
  }
  function drawList () {
    const list = orders.filter(o => ofilter === 'all' || o.status === ofilter)
    $('#olist').innerHTML = list.map(o => `<div class="card orow ${o.id === sel ? 'sel' : ''}" data-id="${o.id}">
      <div class="top"><b>${esc(o.ign)}</b><span class="badge ${o.status}">${o.status}</span></div>
      <small>${esc(o.lines.map(l => l.name).join(', '))}</small>
      <div class="top"><small>${new Date(o.created).toLocaleString()}</small><span>${o.unread ? '<i class="dot"></i> ' : ''}<b>${money(o.amount, o.currency)}</b> <small>${o.method}</small></span></div></div>`).join('') || '<p class="note">No orders here.</p>'
  }
  $('#olist').onclick = e => { const r = e.target.closest('.orow'); if (!r) return; sel = r.dataset.id; drawList(); const o = orders.find(x => x.id === sel); drawOrder(o); if (o.unread) call('update', { id: o.id, read: true }).then(d => { Object.assign(o, d.order); drawList() }) }
  function drawOrder (o) {
    $('#opane').innerHTML = `
      <div class="top" style="display:flex;justify-content:space-between;align-items:center"><h3 style="margin:0;font:700 24px var(--pix)">${esc(o.ign)} <span class="badge ${o.status}">${o.status}</span></h3><button class="mc-btn small" data-del>Delete</button></div>
      <div class="kv">
        <span>Order</span><span>#${o.id} · ${new Date(o.created).toLocaleString()}</span>
        <span>Email</span><span>${esc(o.email)}</span>
        <span>Amount</span><span><b>${money(o.amount, o.currency)}</b>${o.subtotal !== o.amount ? ` <s style="color:var(--muted)">${money(o.subtotal, o.currency)}</s>` : ''} ${o.code ? `· code ${esc(o.code)}` : ''}</span>
        <span>Method</span><span>${esc(o.method)}</span>
        <span>Paid from</span><span>${esc(o.payer) || '—'}</span>
        <span>Transaction ID</span><span><b>${esc(o.trx) || '—'}</b></span>
        <span>Items</span><span>${o.lines.map(l => `${esc(l.name)} (${money(l.price, o.currency)})`).join('<br>')}</span>
        <span>Unlocks</span><span>${o.grants.length} item(s) ${o.granted ? '· <b style="color:#4ade80">granted</b>' : ''}</span>
      </div>
      <div class="row" style="flex-wrap:wrap">
        ${o.status !== 'approved' ? '<button class="mc-btn green" data-st="approved">✔ Approve & unlock</button>' : ''}
        ${o.status !== 'rejected' ? '<button class="mc-btn" data-st="rejected">✕ Reject</button>' : ''}
        ${o.status !== 'pending' ? '<button class="mc-btn" data-st="pending">Back to pending</button>' : ''}
        ${o.shot ? '<button class="mc-btn" data-shot>Show payment screenshot</button>' : ''}
      </div>
      <div id="shotBox"></div>
      <div class="chat">${o.messages.map(m => `<div class="msg ${m.from === 'admin' ? 'buyer' : m.from === 'buyer' ? 'admin' : 'system'}">${esc(m.text)}<small>${m.from} · ${new Date(m.at).toLocaleString()}</small></div>`).join('')}</div>
      <form class="chat-form" id="reply"><input name="t" maxlength="1000" placeholder="Reply to buyer…"><button class="mc-btn primary">Send</button></form>`
    $('#reply').onsubmit = async e => { e.preventDefault(); const t = e.target.t.value.trim(); if (!t) return; const d = await call('update', { id: o.id, reply: t }); Object.assign(o, d.order); drawOrder(o) }
  }
  $('#opane').onclick = async e => {
    const o = orders.find(x => x.id === sel)
    if (!o) return
    const b = e.target.closest('button')
    if (!b) return
    try {
      if (b.dataset.st) {
        if (b.dataset.st === 'rejected' && o.granted && !confirm('This takes the unlocked items back from the player. Continue?')) return
        b.disabled = true
        const d = await call('update', { id: o.id, status: b.dataset.st })
        Object.assign(o, d.order)
        toast(b.dataset.st === 'approved' ? 'Approved: items unlocked' : 'Updated')
        drawList(); drawOrder(o); loadOrders()
      } else if (b.dataset.shot !== undefined) {
        $('#shotBox').innerHTML = '<p class="note">Loading…</p>'
        const d = await call('shot', { id: o.id })
        $('#shotBox').innerHTML = `<img class="shot" src="${d.image}" alt="payment screenshot">`
      } else if (b.dataset.del !== undefined) {
        if (!confirm('Delete this order and its screenshot? This cannot be undone. Items already unlocked stay unlocked.')) return
        await call('deleteOrder', { id: o.id }); sel = null; $('#opane').innerHTML = '<p class="note">Deleted.</p>'; loadOrders()
      }
    } catch (x) { toast(x.message) } finally { b.disabled = false }
  }
  $$('[data-of]').forEach(c => { c.onclick = () => { ofilter = c.dataset.of; $$('[data-of]').forEach(x => x.classList.toggle('on', x === c)); drawList() } })

  // ── players ──
  const nameOf = id => { const x = catalog.items.find(i => i.id === id) || catalog.bundles.find(b => b.id === id); return x ? x.name : id }
  async function loadPlayers () {
    const { players } = await call('players')
    $('#ptable').innerHTML = players.map(p => `<tr><td><a href="/u/${encodeURIComponent(p.display)}" target="_blank">${esc(p.display)}</a></td><td>${p.owned.length}</td><td>${Object.values(p.equipped || {}).map(nameOf).map(esc).join(', ') || '—'}</td><td>${new Date(p.created).toLocaleDateString()}</td></tr>`).join('') || '<tr><td colspan="4" class="note">No players yet.</td></tr>'
  }
  async function playerAction (action) {
    const name = $('#pName').value.trim()
    try {
      const d = await call(action, { name, item: $('#pItem').value })
      $('#pNote').innerHTML = (action === 'resetKey' || d.newKey ? `New locker key for <b>${esc(d.player.display)}</b>: <code>${esc(d.newKey)}</code> (send it to them in their order chat). ` : '') + `${esc(d.player.display)} owns ${d.player.owned.length} item(s).`
      loadPlayers()
    } catch (x) { $('#pNote').textContent = x.message }
  }
  $('#pGrant').onclick = () => playerAction('grant')
  $('#pRevoke').onclick = () => playerAction('revoke')
  $('#pReset').onclick = () => { if (confirm('Make a new locker key? The old one stops working.')) playerAction('resetKey') }

  // ── codes ──
  function drawCodes (codes) {
    $('#ctable').innerHTML = codes.map(c => `<tr><td><b>${esc(c.code)}</b></td><td>${c.type === 'free' ? 'Free' : c.value + '%'}</td><td>${c.uses}${c.maxUses ? ' / ' + c.maxUses : ''}</td><td>${c.active ? 'yes' : 'no'}</td><td><button class="link" data-del-code="${esc(c.code)}">delete</button></td></tr>`).join('') || '<tr><td colspan="5" class="note">No codes.</td></tr>'
  }
  $('#codeForm').onsubmit = async e => { e.preventDefault(); const f = e.target; try { drawCodes((await call('saveCode', { code: f.code.value, type: f.type.value, value: f.value.value, maxUses: f.maxUses.value })).codes); f.code.value = ''; toast('Saved') } catch (x) { toast(x.message) } }
  $('#ctable').onclick = async e => { const c = e.target.dataset.delCode; if (c && confirm('Delete code ' + c + '?')) drawCodes((await call('deleteCode', { code: c })).codes) }

  // ── settings ──
  async function loadSettings () { const { settings } = await call('settings'); for (const k of ['bkash', 'nagad', 'upi', 'cardLink', 'note']) $('#setForm')[k].value = settings[k] || '' }
  $('#setForm').onsubmit = async e => { e.preventDefault(); const f = e.target; try { await call('saveSettings', { bkash: f.bkash.value, nagad: f.nagad.value, upi: f.upi.value, cardLink: f.cardLink.value, note: f.note.value }); $('#setNote').textContent = 'Saved.' } catch (x) { $('#setNote').textContent = x.message } }

  // ── tabs ──
  $$('[data-tab]').forEach(t => { t.onclick = () => { $$('[data-tab]').forEach(x => x.classList.toggle('on', x === t)); $$('[data-view]').forEach(v => v.classList.toggle('hidden', v.dataset.view !== t.dataset.tab)); refresh() } })
  function refresh () {
    const tab = $('[data-tab].on').dataset.tab
    const p = tab === 'orders' ? loadOrders() : tab === 'players' ? loadPlayers() : tab === 'codes' ? call('codes').then(d => drawCodes(d.codes)) : loadSettings()
    p.catch(x => toast(x.message))
  }
  $('#refresh').onclick = refresh

  async function start () {
    $('#login').classList.add('hidden'); $('#app').classList.remove('hidden'); $('#logout').classList.remove('hidden')
    catalog = await fetch('/api/shop').then(r => r.json())
    $('#pItem').innerHTML = '<optgroup label="Bundles">' + catalog.bundles.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('') + '</optgroup><optgroup label="Items">' + catalog.items.map(i => `<option value="${i.id}">${esc(i.name)} (${i.type})</option>`).join('') + '</optgroup>'
    refresh()
    setInterval(() => { if ($('[data-tab].on').dataset.tab === 'orders' && !document.hidden) loadOrders().catch(() => {}) }, 30000)
  }
  if (token) start()
})()
