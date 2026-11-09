const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const UA = 'XionLauncher/1.3 (github.com/xion-launcher)'
const CACHE_DIR = path.join(require('electron').app.getPath('appData'), '.xionlauncher', 'cache', 'http')

const sleep = ms => new Promise(r => setTimeout(r, ms))

function friendly (err, url) {
  const host = (() => { try { return new URL(url).host } catch { return url } })()
  const cause = err && (err.cause && (err.cause.code || err.cause.message)) || (err && err.message) || String(err)
  return new Error(`Can't reach ${host} (${cause}). Check your internet connection, VPN, firewall or antivirus.`)
}

// fetch with a hard timeout and retries; throws a readable error.
async function request (url, opts = {}, tries = 3) {
  let last
  const ms = opts.timeout || 15000
  for (let i = 0; i < tries; i++) {
    const ctrl = new AbortController()
    let timer
    try {
      const res = await Promise.race([
        fetch(url, { ...opts, signal: ctrl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } }),
        // A hung connection must never block the UI, even if the stack ignores the abort signal.
        new Promise((_, reject) => { timer = setTimeout(() => { ctrl.abort(); reject(new Error(`timed out after ${ms / 1000}s`)) }, ms) })
      ])
      clearTimeout(timer)
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`)
      return res
    } catch (e) {
      clearTimeout(timer)
      last = e
      if (i < tries - 1) await sleep(600 * (i + 1))
    }
  }
  throw friendly(last, url)
}

const cacheFile = url => path.join(CACHE_DIR, crypto.createHash('sha1').update(url).digest('hex') + '.json')

function readCache (url) {
  try { return JSON.parse(fs.readFileSync(cacheFile(url), 'utf8')) } catch { return undefined }
}

async function fetchJSON (url) {
  const res = await request(url)
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  const data = await res.json()
  try {
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(cacheFile(url), JSON.stringify(data))
  } catch {}
  return data
}

// Fetches JSON. With a cached copy on disk, answers from cache if the network is slow (>4s)
// and refreshes the cache in the background, so pages never sit on a loading screen.
async function getJSON (url) {
  const cached = readCache(url)
  const live = fetchJSON(url)
  if (cached === undefined) return live
  live.catch(() => {})
  return Promise.race([live.catch(() => cached), sleep(4000).then(() => cached)])
}

function sha1File (file) {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash('sha1')
    fs.createReadStream(file).on('data', d => h.update(d)).on('end', () => resolve(h.digest('hex'))).on('error', reject)
  })
}

async function downloadFile (url, dest, sha1, retries = 3) {
  if (fs.existsSync(dest)) {
    if (!sha1 || (await sha1File(dest)) === sha1) return false
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await request(url, { timeout: 60000 }, 1)
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
      const buf = Buffer.from(await res.arrayBuffer())
      if (sha1) {
        const got = crypto.createHash('sha1').update(buf).digest('hex')
        if (got !== sha1) throw new Error(`Checksum mismatch for ${path.basename(dest)}`)
      }
      fs.writeFileSync(dest, buf)
      return true
    } catch (e) {
      if (attempt >= retries) throw e
      await new Promise(r => setTimeout(r, 500 * attempt))
    }
  }
}

// Runs async jobs with a fixed concurrency, reporting progress as (done, total).
async function pool (jobs, concurrency, onProgress) {
  let i = 0
  let done = 0
  const workers = Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
    while (i < jobs.length) {
      const job = jobs[i++]
      await job()
      done++
      onProgress && onProgress(done, jobs.length)
    }
  })
  await Promise.all(workers)
}

module.exports = { UA, request, getJSON, downloadFile, pool, sha1File }
