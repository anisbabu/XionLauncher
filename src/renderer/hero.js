// Home backdrop motion: mouse parallax on the mountain layers, twinkling stars and the
// occasional shooting star. The layers themselves are images (bg/*.webp) drifting via CSS.
(function () {
  const canvas = document.getElementById('heroCanvas')
  const layers = [...document.querySelectorAll('.scene .layer')]
  if (!canvas) { window.heroScene = { pause () {}, resume () {} }; return }
  const ctx = canvas.getContext('2d')
  let W = 0, H = 0, dpr = 1, stars = [], meteor = null, nextMeteor = 4, t = 0, last = 0, running = true

  function resize () {
    dpr = Math.min(2, window.devicePixelRatio || 1)
    W = canvas.clientWidth; H = canvas.clientHeight
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    stars = Array.from({ length: Math.round(W * H / 16000) }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.5, r: 0.5 + Math.random() * 1.1,
      p: Math.random() * 6.28, s: 0.4 + Math.random() * 1.4
    }))
  }

  // Parallax: CSS transitions on `translate` do the smoothing, so this only sets targets.
  window.addEventListener('mousemove', e => {
    const mx = e.clientX / window.innerWidth - 0.5, my = e.clientY / window.innerHeight - 0.5
    for (const l of layers) {
      const d = +l.dataset.depth || 0
      l.style.translate = `${(-mx * d).toFixed(1)}px ${(-my * d * 0.5).toFixed(1)}px`
    }
  })

  function frame (now) {
    if (!running) return
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016)
    last = now
    t += dt
    ctx.clearRect(0, 0, W, H)
    for (const s of stars) {
      const a = Math.pow(Math.abs(Math.sin(s.p + t * s.s)), 3) * (1 - s.y / (H * 0.55))
      if (a < 0.02) continue
      ctx.fillStyle = `rgba(225,233,255,${a.toFixed(3)})`
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill()
    }
    nextMeteor -= dt
    if (!meteor && nextMeteor <= 0) {
      meteor = { x: W * (0.2 + Math.random() * 0.6), y: H * (0.05 + Math.random() * 0.2), vx: -(320 + Math.random() * 200), vy: 120 + Math.random() * 80, life: 0 }
      nextMeteor = 7 + Math.random() * 10
    }
    if (meteor) {
      meteor.life += dt
      meteor.x += meteor.vx * dt; meteor.y += meteor.vy * dt
      const a = Math.sin(Math.min(1, meteor.life / 0.9) * Math.PI)
      const g = ctx.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * 0.18, meteor.y - meteor.vy * 0.18)
      g.addColorStop(0, `rgba(235,240,255,${(0.85 * a).toFixed(3)})`)
      g.addColorStop(1, 'rgba(235,240,255,0)')
      ctx.strokeStyle = g; ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.moveTo(meteor.x, meteor.y); ctx.lineTo(meteor.x - meteor.vx * 0.18, meteor.y - meteor.vy * 0.18); ctx.stroke()
      if (meteor.life > 0.9) meteor = null
    }
    requestAnimationFrame(frame)
  }

  window.heroScene = {
    pause () { running = false },
    resume () { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame) } }
  }
  new ResizeObserver(resize).observe(canvas)
  resize()
  requestAnimationFrame(frame)
})()
