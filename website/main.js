// Xion website interactions: hero parallax, reveals, and the little working demos in each card.
(() => {
  const $ = (s, r = document) => r.querySelector(s)
  const $$ = (s, r = document) => [...r.querySelectorAll(s)]
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const toast = msg => {
    const t = $('#toast')
    t.textContent = msg
    t.classList.add('show')
    clearTimeout(toast.t)
    toast.t = setTimeout(() => t.classList.remove('show'), 1800)
  }

  /* ---------- scroll-driven effects (one rAF loop) ---------- */
  const nav = $('#nav')
  const layers = $$('.scene .layer')
  const win = $('#tiltWindow')
  const gallery = $('.gallery')
  const track = $('#galleryTrack')
  const bar = $('#galleryBar')
  let mx = 0, my = 0, cmx = 0, cmy = 0

  addEventListener('pointermove', e => {
    mx = e.clientX / innerWidth - 0.5
    my = e.clientY / innerHeight - 0.5
  }, { passive: true })

  function frame () {
    const y = scrollY
    cmx += (mx - cmx) * 0.06
    cmy += (my - cmy) * 0.06
    nav.classList.toggle('solid', y > 40)

    if (y < innerHeight * 1.2) {
      for (const l of layers) {
        const d = +l.dataset.depth, m = +l.dataset.mouse
        l.style.transform = `translate3d(${(-cmx * m).toFixed(2)}px, ${(y * d - cmy * m * 0.5).toFixed(2)}px, 0)`
      }
    }

    // Launcher window: tilted back, straightens as it scrolls into view.
    if (win) {
      const r = win.getBoundingClientRect()
      const p = Math.min(1, Math.max(0, 1 - (r.top - innerHeight * 0.15) / (innerHeight * 0.7)))
      win.style.transform = `rotateX(${(1 - p) * 22}deg) scale(${0.9 + p * 0.1})`
      win.classList.toggle('pins-on', p > 0.92)
    }

    // Gallery: vertical scroll drives the horizontal track while the section is pinned.
    if (gallery && innerWidth > 640) {
      const r = gallery.getBoundingClientRect()
      const total = gallery.offsetHeight - innerHeight
      const p = Math.min(1, Math.max(0, -r.top / total))
      const max = track.scrollWidth - track.parentElement.clientWidth + 2 * parseFloat(getComputedStyle(track.parentElement).paddingLeft)
      track.style.transform = `translate3d(${-p * Math.max(0, max)}px, 0, 0)`
      bar.style.width = (p * 100).toFixed(1) + '%'
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)

  /* ---------- stars in the hero sky ---------- */
  const sc = $('#stars'), sx = sc.getContext('2d')
  let stars = [], meteor = null, nextMeteor = 3
  function sizeStars () {
    const dpr = Math.min(2, devicePixelRatio || 1)
    sc.width = sc.clientWidth * dpr; sc.height = sc.clientHeight * dpr
    sx.setTransform(dpr, 0, 0, dpr, 0, 0)
    stars = Array.from({ length: Math.round(sc.clientWidth * sc.clientHeight / 9000) }, () => ({
      x: Math.random() * sc.clientWidth, y: Math.random() * sc.clientHeight * 0.55, r: 0.4 + Math.random() * 1.1, p: Math.random() * 6.28, s: 0.5 + Math.random() * 1.5
    }))
  }
  sizeStars()
  addEventListener('resize', sizeStars)
  let last = performance.now()
  ;(function twinkle (now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now
    const t = now / 1000, W = sc.clientWidth, H = sc.clientHeight
    sx.clearRect(0, 0, W, H)
    if (scrollY < innerHeight) {
      for (const s of stars) {
        const a = Math.pow(Math.abs(Math.sin(s.p + t * s.s)), 3) * (1 - s.y / (H * 0.6))
        if (a < 0.03) continue
        sx.fillStyle = `rgba(226,233,255,${a.toFixed(3)})`
        sx.beginPath(); sx.arc(s.x, s.y, s.r, 0, 6.283); sx.fill()
      }
      nextMeteor -= dt
      if (!meteor && nextMeteor <= 0 && !reduce) {
        meteor = { x: W * (0.3 + Math.random() * 0.6), y: H * (0.05 + Math.random() * 0.2), life: 0 }
        nextMeteor = 6 + Math.random() * 8
      }
      if (meteor) {
        meteor.life += dt
        const k = meteor.life / 0.9, hx = meteor.x - k * 420, hy = meteor.y + k * 160
        const g = sx.createLinearGradient(hx, hy, hx + 90, hy - 34)
        const a = Math.sin(Math.min(1, k) * Math.PI)
        g.addColorStop(0, `rgba(240,244,255,${a})`); g.addColorStop(1, 'rgba(240,244,255,0)')
        sx.strokeStyle = g; sx.lineWidth = 1.4
        sx.beginPath(); sx.moveTo(hx, hy); sx.lineTo(hx + 90, hy - 34); sx.stroke()
        if (k >= 1) meteor = null
      }
    }
    requestAnimationFrame(twinkle)
  })(last)

  /* ---------- reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (!e.isIntersecting) continue
      e.target.classList.add('in')
      e.target.dispatchEvent(new CustomEvent('reveal'))
      io.unobserve(e.target)
    }
  }, { threshold: 0.2 })
  $$('.reveal').forEach((el, i) => { el.style.transitionDelay = (i % 3) * 70 + 'ms'; io.observe(el) })

  /* ---------- card spotlight + gentle tilt ---------- */
  $$('.card').forEach(card => {
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect()
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
      card.style.setProperty('--mx', x * 100 + '%')
      card.style.setProperty('--my', y * 100 + '%')
      if (!reduce && !card.classList.contains('c-hud')) card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * 3}deg) rotateY(${(x - 0.5) * 4}deg)`
    })
    card.addEventListener('pointerleave', () => { card.style.transform = '' })
  })

  /* ---------- A: version ruler ---------- */
  const VERSIONS = ['1.18', '1.18.1', '1.18.2', '1.19', '1.19.1', '1.19.2', '1.19.3', '1.19.4', '1.20', '1.20.1', '1.20.2', '1.20.3', '1.20.4', '1.20.5', '1.20.6', '1.21', '1.21.1', '1.21.2', '1.21.3', '1.21.4', '1.21.5', '1.21.6', '1.21.7', '1.21.8', '1.21.9', '1.21.10', '1.21.11', '26.1', '26.1.1', '26.1.2', '26.2', '26.3']
  const rt = $('#rulerTrack')
  const ticks = VERSIONS.map((v, i) => `<div class="tickv ${v.split('.').length === 2 ? 'major' : ''} ${i === VERSIONS.length - 1 ? 'latest' : ''}">${v}</div>`).join('')
  rt.innerHTML = ticks + ticks
  let rx = 0, dragging = false, dragX = 0, vel = 0.35
  const ruler = $('#ruler')
  ruler.addEventListener('pointerdown', e => { dragging = true; dragX = e.clientX; ruler.setPointerCapture(e.pointerId) })
  ruler.addEventListener('pointermove', e => { if (!dragging) return; rx += e.clientX - dragX; vel = (e.clientX - dragX) * 0.5; dragX = e.clientX })
  ruler.addEventListener('pointerup', () => { dragging = false })
  ;(function rulerLoop () {
    if (!dragging) { vel += (-0.35 - vel) * 0.03; rx += reduce ? 0 : vel }
    const half = rt.scrollWidth / 2
    if (rx < -half) rx += half
    if (rx > 0) rx -= half
    rt.style.transform = `translateX(${rx}px)`
    requestAnimationFrame(rulerLoop)
  })()

  /* ---------- B: accounts flip ---------- */
  $('#flipBtn').addEventListener('click', () => $('#flip').classList.toggle('flipped'))

  /* ---------- C: performance ---------- */
  const PERF = ['More FPS', 'Less stutter', 'Lower RAM', 'Faster startup', 'Smooth chunks', 'Quick world joins', 'Smarter culling', 'Fewer lag spikes', 'Cooler laptop', 'Longer battery', 'Faster menus', 'Quick quit']
  const blocks = $('#blocks')
  blocks.innerHTML = PERF.map((m, i) => {
    return `<span class="blk ${i < 4 ? 'hot' : ''}" style="--r:${(Math.random() * 10 - 5).toFixed(1)}deg;transition-delay:${(PERF.length - i) * 60}ms">${m}</span>`
  }).join('')
  const perf = $('.c-perf')
  perf.addEventListener('reveal', () => {
    const el = $('#fpsNum'), from = 60, to = 240, t0 = performance.now()
    ;(function up (now) {
      const k = Math.min(1, (now - t0) / 2200)
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))
      if (k < 1) requestAnimationFrame(up)
      else setInterval(() => { el.textContent = 232 + Math.round(Math.random() * 14) }, 900)
    })(t0)
  })

  /* ---------- D: draggable HUD + live keystrokes ---------- */
  const view = $('#hudView')
  $$('.hud-w', view).forEach(w => {
    let ox = 0, oy = 0
    w.addEventListener('pointerdown', e => {
      const r = w.getBoundingClientRect()
      ox = e.clientX - r.left; oy = e.clientY - r.top
      w.setPointerCapture(e.pointerId)
      w.classList.add('drag'); view.classList.add('dragging')
    })
    w.addEventListener('pointermove', e => {
      if (!w.classList.contains('drag')) return
      const v = view.getBoundingClientRect()
      const snap = n => Math.round(n / 12) * 12
      const x = Math.min(v.width - w.offsetWidth, Math.max(0, snap(e.clientX - v.left - ox)))
      const y = Math.min(v.height - w.offsetHeight, Math.max(0, snap(e.clientY - v.top - oy)))
      Object.assign(w.style, { left: x + 'px', top: y + 'px', right: 'auto', bottom: 'auto' })
    })
    w.addEventListener('pointerup', () => { w.classList.remove('drag'); view.classList.remove('dragging') })
  })
  const keyEls = Object.fromEntries($$('.k', view).map(k => [k.dataset.k, k]))
  const typing = e => /input|textarea/i.test(e.target.tagName)
  addEventListener('keydown', e => { const k = keyEls[e.key.toLowerCase()]; if (k && !typing(e)) { k.classList.add('down'); if (e.key === ' ' && view.getBoundingClientRect().top < innerHeight && view.getBoundingClientRect().bottom > 0) e.preventDefault() } })
  addEventListener('keyup', e => { const k = keyEls[e.key.toLowerCase()]; if (k) k.classList.remove('down') })
  // CPS counter from real clicks on the page
  const clicks = { l: [], r: [] }
  addEventListener('mousedown', e => { (e.button === 2 ? clicks.r : clicks.l).push(performance.now()) })
  setInterval(() => {
    const now = performance.now()
    clicks.l = clicks.l.filter(t => now - t < 1000); clicks.r = clicks.r.filter(t => now - t < 1000)
    $('#cps').textContent = clicks.l.length + ' | ' + clicks.r.length
  }, 120)

  /* ---------- E: Right Shift menu ---------- */
  $$('.sw').forEach(s => s.addEventListener('click', () => { s.classList.toggle('on'); s.setAttribute('aria-pressed', s.classList.contains('on')) }))
  addEventListener('keydown', e => {
    if (e.code !== 'ShiftRight' || e.repeat) return
    $('#rshift').classList.add('down')
    const card = $('#menuCard')
    card.classList.remove('flash'); void card.offsetWidth; card.classList.add('flash')
    card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' })
    toast('Xion menu — toggles below are live')
  })
  addEventListener('keyup', e => { if (e.code === 'ShiftRight') $('#rshift').classList.remove('down') })

  /* ---------- F: pixel head ---------- */
  const head = $('#skinHead').getContext('2d')
  const H = ['3b2a20', '3b2a20', '3b2a20', '3b2a20', '3b2a20', '3b2a20', '3b2a20', '3b2a20',
    '3b2a20', '3b2a20', '4a3426', '3b2a20', '3b2a20', '4a3426', '3b2a20', '3b2a20',
    '3b2a20', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', '3b2a20',
    'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a', 'c79a7a',
    'c79a7a', 'ffffff', '3d5a9e', 'c79a7a', 'c79a7a', '3d5a9e', 'ffffff', 'c79a7a',
    'c79a7a', 'c79a7a', 'c79a7a', 'a87a5c', 'a87a5c', 'c79a7a', 'c79a7a', 'c79a7a',
    'c79a7a', 'c79a7a', '8a5a44', 'c79a7a', 'c79a7a', '8a5a44', 'c79a7a', 'c79a7a',
    'c79a7a', 'c79a7a', '8a5a44', '8a5a44', '8a5a44', '8a5a44', 'c79a7a', 'c79a7a']
  H.forEach((c, i) => { head.fillStyle = '#' + c; head.fillRect(i % 8, Math.floor(i / 8), 1, 1) })

  /* ---------- G: mod search demo ---------- */
  const QUERIES = [
    { q: 'minimap', r: [['Xaero\'s Minimap', 'xaero96', '#7ab0ff'], ['JourneyMap', 'techbrew', '#9be38f'], ['VoxelMap', 'MamiyaOtaru', '#ffcf6b']] },
    { q: 'shaders', r: [['Iris Shaders', 'coderbot', '#c9a2ff'], ['Complementary', 'EminGT', '#ffb86b'], ['BSL Shaders', 'capttatsu', '#7fd6ff']] },
    { q: 'recipes', r: [['EMI', 'emilyploszaj', '#ff9ab8'], ['REI', 'shedaniel', '#9be38f'], ['JEI', 'mezz', '#ffd36b']] }
  ]
  const typed = $('#typed'), results = $('#results')
  let qi = 0
  async function demo () {
    const { q, r } = QUERIES[qi++ % QUERIES.length]
    for (let i = 0; i <= q.length; i++) { typed.textContent = q.slice(0, i); await sleep(90) }
    await sleep(250)
    results.innerHTML = r.map(([n, a, c], i) => `<li style="animation-delay:${i * 90}ms"><span class="ico" style="background:${c}">${n[0]}</span><span class="meta"><b>${n}</b><small>by ${a}</small></span><button class="inst">Install</button></li>`).join('')
    await sleep(2400)
    const b = $('.inst', results)
    if (b && !b.classList.contains('done')) { b.textContent = 'Installing…'; await sleep(700); b.textContent = 'Installed ✓'; b.classList.add('done') }
    await sleep(2200)
    for (let i = q.length; i >= 0; i--) { typed.textContent = q.slice(0, i); await sleep(35) }
    demo()
  }
  results.addEventListener('click', e => {
    const b = e.target.closest('.inst')
    if (!b || b.classList.contains('done')) return
    b.textContent = 'Installed ✓'; b.classList.add('done')
  })
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  $('.c-mods').addEventListener('reveal', demo, { once: true })

  /* ---------- H & I: terminals ---------- */
  async function type (el, lines, loop) {
    while (true) {
      el.innerHTML = ''
      for (const [cls, text, wait] of lines) {
        el.innerHTML += `<span class="${cls}">${text}</span>\n`
        await sleep(wait)
      }
      if (!loop) return
      await sleep(3000)
    }
  }
  $('.c-server').addEventListener('reveal', () => type($('#termServer'), [
    ['w', '$ xion server start "friends-smp"', 600],
    ['', '[paper] Loading 26.3 (build 112)…', 500],
    ['', '[paper] Preparing level "world"', 700],
    ['', '[paper] Preparing spawn area: 84%', 500],
    ['g', '[paper] Done (3.42s)! For help, type "help"', 900],
    ['y', '[xion] Friends can join: 192.168.0.24:25565', 600],
    ['', '[paper] Taseen joined the game', 0]
  ], true), { once: true })
  $('.c-heal').addEventListener('reveal', () => type($('#termHeal'), [
    ['', '[xion] Launching 1.21.11 (Fabric)…', 600],
    ['r', '[game] Mixin apply failed: oldmod.mixins.json', 700],
    ['y', '[xion] Crash traced to "oldmod" — disabling', 600],
    ['y', '[xion] Missing dependency "cloth-config" — installing', 700],
    ['', '[xion] Relaunching (heal 1/4)…', 800],
    ['g', '[xion] Game running ✓', 0]
  ], true), { once: true })


  /* ---------- checksum copy ---------- */
  $$('[data-copy]').forEach(c => c.addEventListener('click', () => {
    navigator.clipboard?.writeText(c.textContent.trim()).then(() => toast('Checksum copied'), () => {})
  }))
  $$('a[download]').forEach(a => a.addEventListener('click', () => toast('Download starting…')))

  /* ---------- Cosmetics: 3D cape viewer (skinview3d loads only when the section comes near) ---------- */
  const stage = $('#cosStage')
  if (stage) {
    const CAPES = 'assets/capes/'
    const cos = { list: [], cat: 'All', i: 0, anim: 'idle', viewer: null, frames: [], frame: 0, timer: null, auto: null, touched: false }
    const file = (c, f = 0) => CAPES + (c.frames > 1 ? `${c.id}_${f}` : c.id) + '.png'
    const shown = () => cos.list.filter(c => cos.cat === 'All' || (cos.cat === 'Free' ? c.tier === 'free' : c.cat === cos.cat))

    // A plain dark outfit so every cape stands out (drawn here, no Mojang assets).
    const skin = () => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64
      const x = c.getContext('2d')
      const r = (col, ...rects) => { x.fillStyle = col; rects.forEach(([a, b, w, h]) => x.fillRect(a, b, w, h)) }
      r('#c99b74', [0, 8, 32, 8], [8, 0, 16, 8], [44, 16, 8, 4], [40, 20, 16, 12], [36, 48, 8, 4], [32, 52, 16, 12])
      r('#1c1f27', [8, 0, 8, 8], [0, 8, 32, 2], [0, 10, 2, 6], [24, 10, 8, 6])
      r('#16181f', [16, 16, 24, 16], [40, 20, 16, 7], [32, 52, 16, 7], [16, 20, 4, 12], [36, 20, 4, 12])
      r('#c9d6ff', [20, 20, 8, 1], [27, 21, 1, 6])
      r('#262a35', [0, 16, 16, 16], [16, 48, 16, 16])
      r('#0e1016', [0, 28, 16, 4], [16, 60, 16, 4])
      r('#ffffff', [9, 12, 2, 1], [13, 12, 2, 1]); r('#3a5a9e', [10, 12, 1, 1], [13, 12, 1, 1])
      return c
    }

    // Average colour of a cape's face, used to tint the stage glow.
    const tint = img => {
      try {
        const c = document.createElement('canvas'); c.width = 8; c.height = 8
        const x = c.getContext('2d'); x.drawImage(img, 4, 4, 40, 64, 0, 0, 8, 8)
        const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
        const n = d.length / 4, k = 255 / Math.max(60, Math.max(r, g, b) / n)
        stage.closest('.cosmetics').style.setProperty('--cos-c', [r, g, b].map(v => Math.min(255, Math.round(v / n * k * 0.9))).join(', '))
      } catch {}
    }
    const loadImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src })

    const setAnim = name => {
      cos.anim = name
      $$('#cosAnim button').forEach(b => b.classList.toggle('on', b.dataset.a === name))
      const v = cos.viewer, A = window.skinview3d
      if (!v) return
      const C = { idle: A.IdleAnimation, walk: A.WalkingAnimation, run: A.RunningAnimation, fly: A.FlyingAnimation }[name]
      v.animation = C ? new C() : null
      if (v.animation && name === 'run') v.animation.speed = 0.9
      v.zoom = name === 'fly' ? 0.45 : 0.6 // the flying pose is wider
      if (cos.frames[0]) v.loadCape(cos.frames[cos.frame] || cos.frames[0], { backEquipment: name === 'fly' ? 'elytra' : 'cape' })
    }

    // Switching capes: a quick eased spin, then the new cape (animated capes stream their frames).
    let spinT = 0
    const spin = () => {
      const p = cos.viewer && cos.viewer.playerObject
      if (!p || reduce) return
      const from = p.rotation.y, t0 = performance.now(), id = ++spinT
      const step = now => {
        if (id !== spinT) return
        const k = Math.min(1, (now - t0) / 750), e = 1 - Math.pow(1 - k, 3)
        p.rotation.y = from + e * Math.PI * 2
        if (k < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }
    async function pick (i, fromUser) {
      const list = shown()
      if (!list.length) return
      cos.i = (i + list.length) % list.length
      const c = list[cos.i]
      if (fromUser) stopAuto()
      const info = $('#cosInfo')
      info.classList.remove('swap'); void info.offsetWidth; info.classList.add('swap')
      $('#cosName').textContent = c.name
      $('#cosCat').textContent = c.cat + (c.frames > 1 && c.cat !== 'Animated' ? ' · animated' : '')
      const tier = $('#cosTier'); tier.textContent = c.tier === 'pro' ? 'XION+' : 'FREE'; tier.classList.toggle('pro', c.tier === 'pro')
      $$('.cos-item', $('#cosGrid')).forEach(el => el.classList.toggle('on', el.dataset.id === c.id))
      const on = $(`.cos-item[data-id="${c.id}"]`)
      if (on && fromUser !== 'grid') on.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' })
      clearInterval(cos.timer)
      const want = c.id
      const imgs = await Promise.all(Array.from({ length: c.frames }, (_, f) => loadImg(file(c, f))))
      if (shown()[cos.i] !== c || want !== c.id) return
      cos.frames = imgs.filter(Boolean); cos.frame = 0
      if (!cos.frames.length) return
      tint(cos.frames[0])
      spin()
      setAnim(cos.anim)
      if (cos.frames.length > 1) cos.timer = setInterval(() => {
        cos.frame = (cos.frame + 1) % cos.frames.length
        cos.viewer && cos.viewer.loadCape(cos.frames[cos.frame], { backEquipment: cos.anim === 'fly' ? 'elytra' : 'cape' })
      }, 120)
    }

    function renderGrid () {
      const cats = ['All', 'Free', ...new Set(cos.list.map(c => c.cat))]
      $('#cosCats').innerHTML = cats.map(c => `<button data-cat="${c}" class="${c === cos.cat ? 'on' : ''}">${c}</button>`).join('')
      $('#cosGrid').innerHTML = shown().map((c, i) => `<button class="cos-item ${c.tier}${c.frames > 1 ? ' anim' : ''}" data-id="${c.id}" data-i="${i}" title="${c.name}" aria-label="${c.name}" style="background-image:url('${file(c)}');animation-delay:${Math.min(i, 40) * 18}ms"></button>`).join('')
    }

    // Auto showcase until the visitor interacts.
    const startAuto = () => { if (!cos.touched && !reduce) cos.auto = setInterval(() => pick(cos.i + 1), 3800) }
    const stopAuto = () => { cos.touched = true; clearInterval(cos.auto) }

    async function init () {
      try { cos.list = await (await fetch(CAPES + 'capes.json')).json() } catch { $('#cosName').textContent = 'Capes unavailable'; return }
      // Lead with crowd-pleasers: animated first, then the rest in catalog order.
      cos.list.sort((a, b) => (b.frames > 1) - (a.frames > 1))
      renderGrid()
      await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'assets/vendor/skinview3d.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s) }).catch(() => {})
      const A = window.skinview3d
      if (A) {
        const canvas = $('#cosCanvas')
        const v = cos.viewer = new A.SkinViewer({ canvas, width: stage.clientWidth, height: stage.clientHeight, skin: skin() })
        v.fov = 38; v.zoom = 0.6
        v.globalLight.intensity = 2.6; v.cameraLight.intensity = 0.8
        v.controls.enableZoom = false; v.controls.enablePan = false
        v.autoRotate = !reduce; v.autoRotateSpeed = 0.7
        v.playerObject.rotation.y = Math.PI * 0.85 // start showing the back
        new ResizeObserver(() => v.setSize(stage.clientWidth, stage.clientHeight)).observe(stage)
        canvas.addEventListener('pointerdown', stopAuto)
        // Pause rendering while the section is off screen.
        new IntersectionObserver(([e]) => { v.renderPaused = !e.isIntersecting }).observe(stage)
      }
      pick(0)
      startAuto()
    }

    $('#cosCats').addEventListener('click', e => {
      const b = e.target.closest('[data-cat]'); if (!b) return
      stopAuto(); cos.cat = b.dataset.cat; renderGrid(); pick(0, true)
    })
    $('#cosGrid').addEventListener('click', e => { const b = e.target.closest('.cos-item'); if (b) pick(+b.dataset.i, 'grid') })
    // Hovering an animated thumbnail plays it.
    $('#cosGrid').addEventListener('pointerover', e => {
      const b = e.target.closest('.cos-item.anim'); if (!b || b.dataset.play) return
      const c = cos.list.find(x => x.id === b.dataset.id); let f = 0
      b.dataset.play = '1'
      const iv = setInterval(() => { f = (f + 1) % c.frames; b.style.backgroundImage = `url('${file(c, f)}')` }, 120)
      b.addEventListener('pointerleave', () => { clearInterval(iv); delete b.dataset.play; b.style.backgroundImage = `url('${file(c)}')` }, { once: true })
    })
    $('#cosPrev').addEventListener('click', () => pick(cos.i - 1, true))
    $('#cosNext').addEventListener('click', () => pick(cos.i + 1, true))
    $('#cosAnim').addEventListener('click', e => { const b = e.target.closest('[data-a]'); if (b) { stopAuto(); setAnim(b.dataset.a) } })

    const near = new IntersectionObserver(([e]) => { if (e.isIntersecting) { near.disconnect(); init() } }, { rootMargin: '400px' })
    near.observe(stage)
  }
})()
