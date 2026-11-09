// First-run intro: a short animated welcome that sets up the account and the Xion Pack.
// Shown once (settings.onboarded); app.js fires 'xion:booted' when the launcher state is loaded.
// Built from the launcher's own pieces (.btn, .toggle, .eyebrow, .pill, #xlogo).
  // Uses app.js globals: state, api, xion, renderAccounts, saveSettings, toast, esc.
;(function () {
  const STEPS = ['welcome', 'account', 'pack', 'ready']
  let el, step = 0, busy = false

  const head = name => `https://mc-heads.net/avatar/${encodeURIComponent(name || 'MHF_Steve')}/96`
  const me = () => state.accounts.find(a => a.id === state.active)

  function html () {
    return `
    <div class="intro-shade"></div>
    <div class="intro-drag"></div>
    <button class="intro-skip" data-skip>Skip</button>

    <section class="intro-step" data-step="welcome">
      <svg class="i-logo"><use href="#xlogo"/></svg>
      <div class="i-sig">Welcome to</div>
      <h1 class="i-name">${'XION'.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</h1>
      <p class="i-sub">Let's get you set up. It takes a few seconds.</p>
      <button class="btn primary i-go" data-next>Get started</button>
    </section>

    <section class="intro-step" data-step="account">
      <span class="eyebrow">Step 1 of 2 · Account</span>
      <h2 class="i-title">How do you want to play?</h2>
      <p class="i-sub">You can add more accounts later from the top-right corner.</p>
      <div class="i-cards">
        <button class="i-card" data-ms>
          <svg viewBox="0 0 24 24"><rect x="3" y="3" width="8.5" height="8.5" fill="#f25022" stroke="none"/><rect x="12.5" y="3" width="8.5" height="8.5" fill="#7fba00" stroke="none"/><rect x="3" y="12.5" width="8.5" height="8.5" fill="#00a4ef" stroke="none"/><rect x="12.5" y="12.5" width="8.5" height="8.5" fill="#ffb900" stroke="none"/></svg>
          <div><b>Microsoft</b><small>Your bought Minecraft. Online servers and your own skin.</small></div>
        </button>
        <button class="i-card" data-off>
          <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>
          <div><b>Offline</b><small>Any name. Singleplayer and offline-mode servers.</small></div>
        </button>
      </div>
      <form class="i-offline" id="introOff" autocomplete="off">
        <img id="introOffHead" src="${head()}" alt="">
        <input type="text" name="name" maxlength="16" placeholder="Username" spellcheck="false">
        <button class="btn primary">Add</button>
      </form>
      <p class="i-msg" id="introMsg"></p>
      <div class="i-signed hidden" id="introSigned"><img alt=""><div><small>Signed in as</small><b></b></div><button class="btn primary sm" data-next>Continue</button></div>
    </section>

    <section class="intro-step" data-step="pack">
      <span class="eyebrow">Step 2 of 2 · Xion Pack</span>
      <h2 class="i-title">Use the Xion Pack?</h2>
      <p class="i-sub">Our resource pack: dark inventories and menus, smaller swords and tools in hand, a lower shield and a clear pumpkin view.</p>
      <div class="i-compare">
        <div class="i-inv vanilla"><small>Minecraft</small><div>${'<i></i>'.repeat(18)}</div></div>
        <svg class="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
        <div class="i-inv xion"><small>Xion Pack</small><div>${'<i></i>'.repeat(18)}</div></div>
      </div>
      <div class="i-toggles">
        <label class="toggle i-row-t"><div><b>Normal play</b><small>Survival, creative and other profiles</small></div><input type="checkbox" id="introPackNormal"><span></span></label>
        <label class="toggle i-row-t"><div><b>PvP mode</b><small>Cleaner view for fights</small></div><input type="checkbox" id="introPackPvp"><span></span></label>
      </div>
      <p class="i-note">You can change this any time in Settings.</p>
      <div class="i-actions"><button class="btn ghost" data-back>Back</button><button class="btn primary" data-next>Continue</button></div>
    </section>

    <section class="intro-step" data-step="ready">
      <div class="i-check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2 class="i-title" id="introReadyTitle">You're all set</h2>
      <div class="i-summary" id="introSummary"></div>
      <button class="btn primary i-go" data-done>Start playing</button>
    </section>

    <div class="intro-dots">${STEPS.map((_, i) => `<i data-dot="${i}"></i>`).join('')}</div>`
  }

  function go (n) {
    const from = el.querySelector('.intro-step.on')
    step = Math.max(0, Math.min(STEPS.length - 1, n))
    const to = el.querySelector(`[data-step="${STEPS[step]}"]`)
    if (from && from !== to) {
      from.classList.add('out')
      from.classList.remove('on')
      setTimeout(() => from.classList.remove('out'), 650)
    }
    setTimeout(() => to.classList.add('on'), from ? 260 : 0)
    el.querySelectorAll('[data-dot]').forEach(d => d.classList.toggle('on', +d.dataset.dot <= step))
    if (STEPS[step] === 'account') showSigned()
    if (STEPS[step] === 'ready') fillReady()
  }

  function showSigned () {
    const a = me()
    const box = el.querySelector('#introSigned')
    box.classList.toggle('hidden', !a)
    el.querySelector('.i-cards').classList.toggle('dim', !!a)
    if (!a) return
    box.querySelector('img').src = head(a.name)
    box.querySelector('b').textContent = a.name
  }

  function fillReady () {
    const a = me()
    el.querySelector('#introReadyTitle').textContent = a ? `You're all set, ${a.name}` : "You're all set"
    const chip = (ok, text) => `<span class="pill${ok ? ' on' : ''}">${esc(text)}${ok ? '' : ' · off'}</span>`
    el.querySelector('#introSummary').innerHTML =
      chip(!!a, a ? (a.type === 'microsoft' ? 'Microsoft account' : 'Offline account') : 'No account yet') +
      chip(state.settings.xionPack !== false, 'Xion Pack in normal play') +
      chip(state.settings.xionPackPvp !== false, 'Xion Pack in PvP')
  }

  function msg (text, bad) {
    const m = el.querySelector('#introMsg')
    m.textContent = text || ''
    m.classList.toggle('bad', !!bad)
  }

  async function addMicrosoft () {
    if (busy) return
    busy = true
    const card = el.querySelector('[data-ms]')
    card.classList.add('loading')
    msg('A Microsoft sign-in window is open. Finish signing in there.')
    try {
      const acc = await xion.call('accounts:microsoft')
      const r = await xion.call('accounts:select', acc.id)
      Object.assign(state, { accounts: r.accounts, active: r.active })
      renderAccounts()
      msg('')
      showSigned()
      setTimeout(() => go(step + 1), 1100)
    } catch (e) {
      msg(String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true)
    } finally { busy = false; card.classList.remove('loading') }
  }

  async function addOffline (name) {
    if (busy) return
    if (!/^\w{3,16}$/.test(name)) return msg('Use 3–16 letters, numbers or _.', true)
    busy = true
    try {
      const acc = await xion.call('accounts:offline', name)
      const r = await xion.call('accounts:select', acc.id)
      Object.assign(state, { accounts: r.accounts, active: r.active })
      renderAccounts()
      msg('')
      showSigned()
      setTimeout(() => go(step + 1), 900)
    } catch (e) {
      msg(String((e && e.message) || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), true)
    } finally { busy = false }
  }

  function finish () {
    saveSettings({ onboarded: true })
    el.classList.add('leaving')
    setTimeout(() => { el.remove(); document.body.classList.remove('intro-open') }, 900)
  }

  function start () {
    if (document.getElementById('intro')) return
    el = document.createElement('div')
    el.id = 'intro'
    el.innerHTML = html()
    document.body.appendChild(el)
    document.body.classList.add('intro-open')

    const pn = el.querySelector('#introPackNormal'), pp = el.querySelector('#introPackPvp')
    pn.checked = state.settings.xionPack !== false
    pp.checked = state.settings.xionPackPvp !== false
    pn.onchange = () => { saveSettings({ xionPack: pn.checked }); const t = $('#xionPack'); if (t) t.checked = pn.checked; el.querySelector('.i-compare').classList.toggle('off', !pn.checked && !pp.checked) }
    pp.onchange = () => { saveSettings({ xionPackPvp: pp.checked }); const t = $('#xionPackPvp'); if (t) t.checked = pp.checked; el.querySelector('.i-compare').classList.toggle('off', !pn.checked && !pp.checked) }

    const off = el.querySelector('#introOff')
    let tmr
    off.name.addEventListener('input', () => {
      clearTimeout(tmr)
      tmr = setTimeout(() => { if (/^\w{3,16}$/.test(off.name.value)) el.querySelector('#introOffHead').src = head(off.name.value) }, 350)
    })
    off.onsubmit = e => { e.preventDefault(); addOffline(off.name.value.trim()) }

    el.addEventListener('click', e => {
      const t = e.target.closest('[data-next],[data-back],[data-ms],[data-off],[data-done],[data-skip],[data-dot]')
      if (!t) return
      if (t.dataset.next !== undefined) go(step + 1)
      else if (t.dataset.back !== undefined) go(step - 1)
      else if (t.dataset.ms !== undefined) addMicrosoft()
      else if (t.dataset.off !== undefined) { off.classList.add('open'); el.querySelector('.i-cards').classList.add('picked'); setTimeout(() => off.name.focus(), 250) }
      else if (t.dataset.done !== undefined || t.dataset.skip !== undefined) finish()
      else if (t.dataset.dot !== undefined && +t.dataset.dot < step) go(+t.dataset.dot)
    })
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName !== 'INPUT' && STEPS[step] !== 'account') { e.preventDefault(); STEPS[step] === 'ready' ? finish() : go(step + 1) }
    })
    el.tabIndex = -1
    requestAnimationFrame(() => { el.classList.add('in'); el.focus(); go(0) })
  }

  window.xionIntro = { start }
  window.addEventListener('xion:booted', () => { if (!state.settings.onboarded) setTimeout(start, 500) })
})()
