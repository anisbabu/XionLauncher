// Xion+ checkout: currency → details (+ redeem code) → payment proof → success, plus the buyer's order page
// (status, license key and a chat with the seller). Talks to /api/shop.
(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  const api = async body => {
    const r = await fetch('/api/shop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({ error: 'Network error' }))
    if (!r.ok || j.error) throw new Error(j.error || 'Something went wrong')
    return j
  }
  const METHOD = {
    bkash: { name: 'bKash', color: '#e2136e', payer: 'Your bKash number', payerPh: '01XXXXXXXXX', how: n => `Open bKash → <b>Send Money</b> → send to <b>${esc(n)}</b>` },
    nagad: { name: 'Nagad', color: '#f6921e', payer: 'Your Nagad number', payerPh: '01XXXXXXXXX', how: n => `Open Nagad → <b>Send Money</b> → send to <b>${esc(n)}</b>` },
    upi: { name: 'UPI', color: '#5f259f', sub: 'PhonePe · Google Pay · Paytm', payer: 'UPI ID you paid from', payerPh: 'name@okaxis', how: n => `Pay with any UPI app to <b>${esc(n)}</b>` },
    card: { name: 'Card', color: '#2b6cff', sub: 'Debit or credit', payer: 'Email or name used for the payment', payerPh: 'you@gmail.com', how: () => 'Pay securely on the card payment page, then come back here' }
  }
  const STORE = 'xion-orders'
  const saved = () => { try { return JSON.parse(localStorage.getItem(STORE)) || [] } catch { return [] } }
  const remember = o => { try { localStorage.setItem(STORE, JSON.stringify([o, ...saved().filter(x => x.id !== o.id)].slice(0, 10))) } catch {} }

  let cfg = null
  const st = { step: 0, currency: 'USD', method: '', code: '', price: 0, shot: '' }
  const money = (cur, v) => (cfg ? cfg.symbols[cur] : '') + (cur === 'USD' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v)

  // ---------- markup ----------
  const modal = document.createElement('div')
  modal.className = 'shop'
  modal.innerHTML = `
    <div class="shop-back" data-close></div>
    <div class="shop-card" role="dialog" aria-modal="true" aria-labelledby="shopTitle">
      <button class="shop-x" data-close aria-label="Close">&times;</button>
      <div class="shop-head"><span class="shop-badge">XION+</span><h3 id="shopTitle">Get Xion+</h3><div class="shop-dots"><i></i><i></i><i></i></div></div>
      <div class="shop-steps">
        <section class="shop-step" data-step="0">
          <p class="shop-lead">One-time payment. Pick your currency.</p>
          <div class="cur-grid" id="curGrid"></div>
          <ul class="shop-perks"><li>110 capes + matching elytra</li><li>Premium themes &amp; animated gold badge</li><li>Turbo FPS, chroma HUD, custom crosshair</li></ul>
          <button class="shop-btn" data-next>Continue</button>
        </section>
        <section class="shop-step" data-step="1">
          <div class="shop-fields">
            <label>Full name<input id="fName" autocomplete="name" maxlength="80" placeholder="Taseen Rahman"></label>
            <label>In-game name<input id="fIgn" maxlength="16" placeholder="Steve" spellcheck="false"></label>
            <label class="wide">Gmail<input id="fEmail" type="email" autocomplete="email" maxlength="120" placeholder="you@gmail.com"></label>
            <label class="wide">Device ID <small>Xion Launcher → Settings → Xion Premium → Copy</small><input id="fDevice" maxlength="24" placeholder="1A2B-3C4D-5E6F-7A8B" spellcheck="false"></label>
          </div>
          <div class="code-row"><input id="fCode" maxlength="40" placeholder="Redeem code (optional)" spellcheck="false"><button class="shop-ghost" id="codeApply">Apply</button></div>
          <div class="code-msg" id="codeMsg"></div>
          <div class="shop-total">Total <b id="total"></b></div>
          <div class="shop-row"><button class="shop-ghost" data-prev>Back</button><button class="shop-btn" data-next>Continue</button></div>
        </section>
        <section class="shop-step" data-step="2">
          <div class="pay-methods" id="payMethods"></div>
          <div class="pay-how" id="payHow"></div>
          <div class="shop-fields">
            <label class="wide"><span id="payerLabel">Your number</span><input id="fPayer" maxlength="60"></label>
            <label class="wide">Transaction ID<input id="fTrx" maxlength="60" placeholder="e.g. 9JK4L2M8QX" spellcheck="false"></label>
          </div>
          <label class="drop" id="drop"><input type="file" id="fShot" accept="image/*" hidden><span class="drop-txt"><b>Add payment screenshot</b><small>Tap to choose or drop an image</small></span><img id="shotPrev" alt=""></label>
          <div class="shop-row"><button class="shop-ghost" data-prev>Back</button><button class="shop-btn" id="send">Send</button></div>
        </section>
        <section class="shop-step" data-step="3">
          <div class="done-anim"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M15 27l7 7 15-16"/></svg></div>
          <h4>Everything is done!</h4>
          <p class="shop-lead">You will get your Xion+ key soon. We'll check your payment and send the key on your order page, where you can also message us.</p>
          <button class="shop-btn" id="trackBtn">Open my order</button>
        </section>
      </div>
      <div class="shop-err" id="shopErr" role="alert"></div>
    </div>`
  document.body.appendChild(modal)

  const order = document.createElement('div')
  order.className = 'shop order'
  order.innerHTML = `
    <div class="shop-back" data-close></div>
    <div class="shop-card" role="dialog" aria-modal="true" aria-labelledby="ordTitle">
      <button class="shop-x" data-close aria-label="Close">&times;</button>
      <div class="shop-head"><span class="shop-badge">XION+</span><h3 id="ordTitle">My order</h3></div>
      <div id="ordBody"><p class="shop-lead">Loading&hellip;</p></div>
    </div>`
  document.body.appendChild(order)

  const err = msg => { const e = $('#shopErr'); e.textContent = msg || ''; e.classList.toggle('show', !!msg) }
  const open = el => { el.classList.add('open'); document.documentElement.classList.add('shop-lock') }
  const close = el => { el.classList.remove('open'); if (!$('.shop.open')) document.documentElement.classList.remove('shop-lock') }
  ;[modal, order].forEach(m => m.addEventListener('click', e => { if (e.target.closest('[data-close]')) { close(m); if (m === order) stopPoll() } }))
  addEventListener('keydown', e => { if (e.key === 'Escape') { $$('.shop.open').forEach(close); stopPoll() } })

  function go (n) {
    st.step = n
    err('')
    $$('.shop-step', modal).forEach(s => s.classList.toggle('on', +s.dataset.step === n))
    $$('.shop-dots i', modal).forEach((d, i) => d.classList.toggle('on', i <= Math.min(n, 2)))
    $('.shop-dots', modal).style.visibility = n === 3 ? 'hidden' : ''
    if (n === 1) renderTotal()
    if (n === 2) renderPay()
    const f = $(`.shop-step[data-step="${n}"] input`, modal); if (f && matchMedia('(pointer: fine)').matches) setTimeout(() => f.focus(), 350)
  }

  function renderCur () {
    $('#curGrid').innerHTML = ['USD', 'BDT', 'INR'].map(c => `
      <button class="cur ${c === st.currency ? 'on' : ''}" data-cur="${c}">
        <span class="cur-flag ${c}">${cfg.symbols[c]}</span>
        <b>${money(c, cfg.prices[c])}</b><small>${{ USD: 'US dollar · card', BDT: 'Taka · bKash, Nagad', INR: 'Rupee · UPI' }[c]}</small>
      </button>`).join('')
  }
  $('#curGrid').addEventListener('click', e => {
    const b = e.target.closest('[data-cur]'); if (!b) return
    st.currency = b.dataset.cur; st.method = ''; renderCur()
    if (st.code) checkCode(true); else st.price = cfg.prices[st.currency]
  })

  function renderTotal () {
    const base = cfg.prices[st.currency]
    $('#total').innerHTML = st.price < base ? `<s>${money(st.currency, base)}</s> ${st.price === 0 ? 'FREE' : money(st.currency, st.price)}` : money(st.currency, base)
  }
  async function checkCode (quiet) {
    const code = $('#fCode').value.trim()
    const msg = $('#codeMsg')
    if (!code) { st.code = ''; st.price = cfg.prices[st.currency]; msg.textContent = ''; renderTotal(); return }
    try {
      const r = await api({ action: 'code', code, currency: st.currency })
      if (!r.ok) throw new Error(r.error)
      st.code = code; st.price = r.price
      msg.className = 'code-msg ok'; msg.textContent = r.type === 'free' ? 'Code applied: Xion+ is free for you!' : `Code applied: ${r.value}% off`
    } catch (e) {
      st.code = ''; st.price = cfg.prices[st.currency]
      if (!quiet) { msg.className = 'code-msg bad'; msg.textContent = e.message }
    }
    renderTotal()
  }
  $('#codeApply').addEventListener('click', () => checkCode())
  $('#fCode').addEventListener('keydown', e => { if (e.key === 'Enter') checkCode() })

  function renderPay () {
    const list = cfg.methods[st.currency]
    if (!list.includes(st.method)) st.method = list[0]
    $('#payMethods').innerHTML = list.map(m => `<button class="pm ${m === st.method ? 'on' : ''}" data-m="${m}" style="--pm:${METHOD[m].color}"><b>${METHOD[m].name}</b>${METHOD[m].sub ? `<small>${METHOD[m].sub}</small>` : ''}</button>`).join('')
    const M = METHOD[st.method], target = st.method === 'card' ? cfg.pay.cardLink : cfg.pay[st.method]
    $('#payHow').innerHTML = !target
      ? `<p class="pay-off">${M.name} payments aren't set up yet. Please pick another way or check back soon.</p>`
      : `<div class="pay-amount">${money(st.currency, st.price)}</div><p>${M.how(target)}</p>
         ${st.method === 'card' ? `<a class="shop-btn pay-link" href="${esc(target)}" target="_blank" rel="noopener">Pay ${money(st.currency, st.price)} by card &#8599;</a>` : `<button class="shop-ghost copy" data-copy="${esc(target)}">Copy ${st.method === 'upi' ? 'UPI ID' : 'number'}</button>`}
         ${cfg.note ? `<small class="pay-note">${esc(cfg.note)}</small>` : ''}`
    $('#payerLabel').textContent = M.payer
    $('#fPayer').placeholder = M.payerPh
    $('#send').disabled = !target
  }
  $('#payMethods').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { st.method = b.dataset.m; renderPay() } })
  $('#payHow').addEventListener('click', e => {
    const b = e.target.closest('[data-copy]'); if (!b) return
    navigator.clipboard?.writeText(b.dataset.copy).then(() => { b.textContent = 'Copied ✓'; setTimeout(() => renderPay(), 1400) })
  })

  // Screenshots are shrunk in the browser (max 1400px JPEG) so uploads stay small.
  function readShot (file) {
    if (!file || !file.type.startsWith('image/')) return err('That file is not an image.')
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, 1400 / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      st.shot = c.toDataURL('image/jpeg', 0.82)
      $('#shotPrev').src = st.shot
      $('#drop').classList.add('has')
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => err('Could not read that image.')
    img.src = URL.createObjectURL(file)
  }
  $('#fShot').addEventListener('change', e => readShot(e.target.files[0]))
  const drop = $('#drop')
  ;['dragover', 'dragenter'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over') }))
  ;['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')))
  drop.addEventListener('drop', e => { e.preventDefault(); readShot(e.dataTransfer.files[0]) })

  const details = () => ({ name: $('#fName').value, ign: $('#fIgn').value, email: $('#fEmail').value, device: $('#fDevice').value })
  function validDetails () {
    const d = details()
    if (d.name.trim().length < 2) return 'Enter your full name.'
    if (!/^[A-Za-z0-9_]{3,16}$/.test(d.ign.trim())) return 'In-game name must be 3–16 letters, numbers or _.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email.trim())) return 'Enter a valid Gmail address.'
    if (d.device.toLowerCase().replace(/[^0-9a-f]/g, '').length !== 16) return 'Enter your Device ID (16 characters).'
    return ''
  }

  async function submit (btn) {
    err('')
    btn.disabled = true; btn.classList.add('busy')
    try {
      const body = { action: 'order', ...details(), currency: st.currency, code: st.code }
      if (st.price > 0) Object.assign(body, { method: st.method, payer: $('#fPayer').value, trx: $('#fTrx').value, screenshot: st.shot })
      const r = await api(body)
      remember({ id: r.id, token: r.token, at: Date.now() })
      st.last = r
      go(3)
      chip()
    } catch (e) { err(e.message) } finally { btn.disabled = false; btn.classList.remove('busy') }
  }

  modal.addEventListener('click', e => {
    if (e.target.closest('[data-prev]')) return go(st.step - 1)
    const n = e.target.closest('[data-next]'); if (!n) return
    if (st.step === 1) {
      const bad = validDetails(); if (bad) return err(bad)
      if (st.price === 0) return submit(n) // free code: no payment needed
    }
    go(st.step + 1)
  })
  $('#send').addEventListener('click', e => {
    if ($('#fPayer').value.trim().length < 3) return err($('#payerLabel').textContent + ' is needed.')
    if ($('#fTrx').value.trim().length < 4) return err('Enter the transaction ID.')
    if (!st.shot) return err('Add a screenshot of your payment.')
    submit(e.currentTarget)
  })
  $('#trackBtn').addEventListener('click', () => { close(modal); showOrder(st.last.id, st.last.token) })

  async function openShop () {
    open(modal)
    if (!cfg) {
      try { cfg = await api({ action: 'config' }) } catch (e) { err(e.message); return }
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      st.currency = /Dhaka/.test(tz) ? 'BDT' : /Kolkata|Calcutta/.test(tz) ? 'INR' : 'USD'
    }
    st.price = cfg.prices[st.currency]
    if (st.code) checkCode(true)
    renderCur()
    go(0)
  }

  // ---------- buyer's order page ----------
  let poll = null, cur = null
  const stopPoll = () => { clearInterval(poll); poll = null }
  const STATUS = { pending: ['Checking payment', 1], approved: ['Payment confirmed', 2], done: ['Key sent', 3], rejected: ['Payment not confirmed', -1] }
  async function showOrder (id, token) {
    cur = { id, token }
    open(order)
    await refreshOrder(true)
    stopPoll(); poll = setInterval(() => refreshOrder(false), 15000)
  }
  async function refreshOrder (scroll) {
    let o
    try { o = await api({ action: 'status', ...cur }) } catch (e) { $('#ordBody').innerHTML = `<p class="shop-lead">${esc(e.message)}</p>`; return }
    const [label, lvl] = STATUS[o.status] || STATUS.pending
    const draft = $('#ordMsg') ? $('#ordMsg').value : ''
    $('#ordBody').innerHTML = `
      <div class="ord-meta"><span>Order <b>#${o.id.slice(0, 6).toUpperCase()}</b></span><span>${esc(o.ign)}</span><span>${o.amount === 0 ? 'Free code' : money(o.currency, o.amount)}</span></div>
      <ol class="ord-steps ${lvl < 0 ? 'bad' : ''}">${['Order sent', 'Payment confirmed', 'Key sent'].map((s, i) => `<li class="${lvl < 0 ? (i === 0 ? 'on' : '') : i < lvl || (i === 0) ? 'on' : ''}">${lvl < 0 && i === 1 ? 'Payment not confirmed' : s}</li>`).join('')}</ol>
      ${o.key ? `<div class="ord-key"><small>Your license key</small><code>${esc(o.key)}</code><button class="shop-btn" id="copyKey">Copy key</button></div>` : `<p class="ord-wait">${esc(label)}&hellip; you'll see your key here.</p>`}
      <div class="chat" id="chat">${o.messages.map(m => `<div class="msg ${m.from}"><p>${esc(m.text)}</p><small>${m.from === 'buyer' ? 'You' : m.from === 'admin' ? 'Xion' : 'Xion'} · ${new Date(m.at).toLocaleString()}</small></div>`).join('')}</div>
      <div class="chat-in"><input id="ordMsg" maxlength="1000" placeholder="Message the seller&hellip;"><button class="shop-btn" id="ordSend">Send</button></div>`
    $('#ordMsg').value = draft
    const chat = $('#chat'); if (scroll) chat.scrollTop = chat.scrollHeight; else chat.scrollTop = chat.scrollHeight
    $('#copyKey')?.addEventListener('click', e => navigator.clipboard?.writeText(o.key).then(() => { e.target.textContent = 'Copied ✓' }))
    const sendMsg = async () => {
      const t = $('#ordMsg').value.trim(); if (!t) return
      $('#ordSend').disabled = true
      try { await api({ action: 'message', ...cur, text: t }); $('#ordMsg').value = ''; await refreshOrder(true) } catch (e) { alert(e.message) } finally { const b = $('#ordSend'); if (b) b.disabled = false }
    }
    $('#ordSend').addEventListener('click', sendMsg)
    $('#ordMsg').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg() })
  }

  // Floating "My order" chip once someone has ordered on this browser.
  function chip () {
    let c = $('#orderChip')
    const list = saved()
    if (!list.length) { if (c) c.remove(); return }
    if (!c) { c = document.createElement('button'); c.id = 'orderChip'; c.className = 'order-chip'; document.body.appendChild(c) }
    c.innerHTML = '<span class="dot"></span>My Xion+ order'
    c.onclick = () => showOrder(list[0].id, list[0].token)
  }

  // ---------- wire up ----------
  $$('[data-buy], #buyPremium').forEach(b => b.addEventListener('click', e => { e.preventDefault(); openShop() }))
  const m = /#order=([0-9a-f]{16})\.([0-9a-f]{32})/.exec(location.hash)
  if (m) { remember({ id: m[1], token: m[2], at: Date.now() }); showOrder(m[1], m[2]) }
  chip()
})()
