const tls = require('tls')

/**
 * Makes Node-side networking behave like the browser:
 *  - trusts the Windows certificate store (antivirus/firewall HTTPS scanning, corporate proxies
 *    re-sign traffic with their own root, which Node's bundled CA list rejects as "fetch failed");
 *  - routes global fetch through BOTH Chromium's network stack and Node's, hedged: Chromium goes
 *    first, Node joins after a short delay (or immediately if Chromium errors), first success wins.
 *    On some PCs one of the two stacks hangs forever instead of failing; hedging avoids that.
 */
function trustSystemCertificates () {
  try {
    const merged = new Set([...tls.getCACertificates('default'), ...tls.getCACertificates('system')])
    tls.setDefaultCACertificates([...merged])
    return true
  } catch {
    return false
  }
}

/**
 * DNS that survives a broken router: tries Windows' resolver first (2.5s), then asks public
 * resolvers directly (Cloudflare, Google, Quad9), and remembers the last good answer per host.
 */
const dns = require('dns')
const resolver = new dns.Resolver({ timeout: 2500, tries: 2 })
resolver.setServers(['1.1.1.1', '8.8.8.8', '9.9.9.9', '1.0.0.1'])
const lastGood = new Map()
const systemLookup = dns.lookup

function robustLookup (hostname, options, callback) {
  if (typeof options === 'function') { callback = options; options = {} }
  if (typeof options === 'number') options = { family: options }
  options = options || {}
  let finished = false
  const finish = (err, addrs) => {
    if (finished) return
    finished = true
    if (err || !addrs || !addrs.length) {
      const cached = lastGood.get(hostname)
      if (cached) addrs = cached
      else return callback(err || Object.assign(new Error('getaddrinfo ENOTFOUND ' + hostname), { code: 'ENOTFOUND', hostname }))
    } else {
      lastGood.set(hostname, addrs)
    }
    if (options.all) callback(null, addrs)
    else callback(null, addrs[0].address, addrs[0].family)
  }
  const fallback = () => {
    resolver.resolve4(hostname, (err, ips) => {
      if (!err && ips && ips.length) return finish(null, ips.map(address => ({ address, family: 4 })))
      resolver.resolve6(hostname, (err6, ips6) => finish(err6 || err, (ips6 || []).map(address => ({ address, family: 6 }))))
    })
  }
  const timer = setTimeout(fallback, 2500)
  systemLookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (finished) return
    clearTimeout(timer)
    if (!err && addrs && addrs.length) finish(null, addrs)
    else fallback()
  })
}

function installDnsFallback () {
  // Every Node library (Minecraft downloads, Microsoft login, fetch) resolves through dns.lookup.
  dns.lookup = robustLookup
  const http = require('http')
  const https = require('https')
  http.globalAgent = new http.Agent({ keepAlive: true, lookup: robustLookup })
  https.globalAgent = new https.Agent({ keepAlive: true, lookup: robustLookup })
  try {
    // Node's built-in fetch reads undici's global dispatcher.
    const { setGlobalDispatcher, Agent } = require('undici')
    setGlobalDispatcher(new Agent({ connect: { lookup: robustLookup, timeout: 15000 } }))
  } catch {}
}

// Chromium side (net.fetch and the Microsoft sign-in window): secure DNS with system fallback.
function configureChromiumDns (app) {
  try {
    app.configureHostResolver({
      secureDnsMode: 'automatic',
      secureDnsServers: ['https://1.1.1.1/dns-query', 'https://8.8.8.8/dns-query', 'https://9.9.9.9/dns-query']
    })
  } catch {}
}

function hedged (primary, secondary, delayMs) {
  return new Promise((resolve, reject) => {
    let secondStarted = false
    let failures = 0
    let settled = false
    const ok = r => { if (!settled) { settled = true; resolve(r) } }
    const fail = e => {
      failures++
      if (!secondStarted) startSecond()
      else if (failures >= 2 && !settled) { settled = true; reject(e) }
    }
    const startSecond = () => {
      if (secondStarted) return
      secondStarted = true
      secondary().then(ok, fail)
    }
    primary().then(ok, fail)
    setTimeout(startSecond, delayMs)
  })
}

function useChromiumFetch () {
  const { net } = require('electron')
  const nodeFetch = globalThis.fetch
  if (!net || !net.fetch || globalThis.fetch.__xion) return
  const wrapped = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input
    // Request bodies (FormData streams) can only be sent once, so don't hedge uploads.
    if (init && init.body) return net.fetch(url, init).catch(() => nodeFetch(input, init))
    return hedged(() => net.fetch(url, init), () => nodeFetch(input, init), 2500)
  }
  wrapped.__xion = true
  wrapped.node = nodeFetch
  wrapped.chromium = (u, i) => net.fetch(u, i)
  globalThis.fetch = wrapped
}

// Checks each service the launcher depends on with both network stacks.
async function diagnose () {
  const hosts = [
    ['Minecraft versions', 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'],
    ['Game downloads', 'https://resources.download.minecraft.net/'],
    ['Fabric', 'https://meta.fabricmc.net/v2/versions/loader'],
    ['Modrinth (mods)', 'https://api.modrinth.com/v2/tag/loader'],
    ['Microsoft login', 'https://login.live.com/'],
    ['Minecraft services', 'https://api.minecraftservices.com/']
  ]
  const f = globalThis.fetch
  const probe = async (fn, url) => {
    const t0 = Date.now()
    try {
      const res = await Promise.race([fn(url, { method: 'GET' }), new Promise((_, r) => setTimeout(() => r(new Error('timed out after 12s')), 12000))])
      return { ok: true, ms: Date.now() - t0, status: res.status }
    } catch (e) {
      const cause = e && e.cause ? (e.cause.code || e.cause.message) : ''
      return { ok: false, ms: Date.now() - t0, error: (e && e.message || String(e)) + (cause ? ` (${cause})` : '') }
    }
  }
  return Promise.all(hosts.map(async ([name, url]) => ({
    name,
    host: new URL(url).host,
    chromium: f.chromium ? await probe(f.chromium, url) : null,
    node: await probe(f.node || f, url)
  })))
}

module.exports = { trustSystemCertificates, installDnsFallback, configureChromiumDns, useChromiumFetch, diagnose }
