const fs = require('fs')
const path = require('path')
const { Client } = require('minecraft-launcher-core')
const store = require('./store')
const accounts = require('./accounts')
const versions = require('./versions')
const java = require('./java')
const mods = require('./mods')
const cosmetics = require('./cosmetics')
const respack = require('./respack')
const skins = require('./skins')
const zip = require('./zip')

const BUNDLED_DIR = path.join(__dirname, '..', 'assets', 'mods')
const ASSETS_DIR = path.join(__dirname, '..', 'assets')
const themes = require('./themes')
const perf = require('./perf')
const license = require('./license')
const pvp = require('./pvp')

// Xion Client jars ship with the launcher, named xion-client-<mcversion>.jar.
function bundledClientMods (game) {
  const jar = path.join(BUNDLED_DIR, `xion-client-${game}.jar`)
  return fs.existsSync(jar) ? [jar] : []
}

function supportedClientVersions () {
  try { return fs.readdirSync(BUNDLED_DIR).map(f => (f.match(/^xion-client-(.+)\.jar$/) || [])[1]).filter(Boolean) } catch { return [] }
}

let running = null

function isRunning () { return !!running }

function kill () {
  if (running && running.proc) running.proc.kill()
}

async function launch (profileId, opts, emit) {
  if (running) throw new Error('Minecraft is already running.')
  const d = store.get()
  const s = d.settings
  const profile = profileId === pvp.ID ? pvp.profile(d) : d.profiles.find(p => p.id === profileId)
  const isPvp = !!profile && profile.pvp === true
  if (!profile) throw new Error('Profile not found.')
  const root = s.gameRoot || store.ROOT
  const status = (phase, text, progress) => emit('launch:status', { phase, text, progress })

  running = { proc: null }
  try {
    status('auth', 'Signing in…')
    const authorization = await accounts.authorization()

    status('meta', 'Resolving version…')
    const game = await versions.resolveVersion(profile.version)
    const vj = await versions.versionJSON(game)

    // Every profile runs Xion Client, so it always needs a mod loader (Fabric unless Quilt is chosen).
    const loader = profile.loader === 'quilt' ? 'quilt' : 'fabric'
    const bundled = bundledClientMods(game)
    if (!bundled.length) throw new Error(`Xion Client isn't available for Minecraft ${game}. Pick 1.18 or newer.`)
    status('loader', `Installing ${loader === 'quilt' ? 'Quilt' : 'Fabric'} loader…`)
    const custom = (await versions.installLoader(root, loader, game, profile.loaderVersion)).id

    let javaPath = s.javaPath && fs.existsSync(s.javaPath) ? s.javaPath : null
    if (!javaPath) {
      const component = (vj.javaVersion && vj.javaVersion.component) || 'jre-legacy'
      status('java', `Preparing Java ${(vj.javaVersion && vj.javaVersion.majorVersion) || 8}…`, 0)
      javaPath = await java.ensureRuntime(root, component, (done, total) => status('java', `Downloading Java runtime… ${done}/${total}`, done / total))
    }

    const gameDir = path.join(root, 'instances', profile.id)
    fs.mkdirSync(path.join(gameDir, 'mods'), { recursive: true })
    // Fresh instances skip vanilla's first-run accessibility prompt so players land on the Xion menu.
    const optionsFile = path.join(gameDir, 'options.txt')
    if (!fs.existsSync(optionsFile)) fs.writeFileSync(optionsFile, 'onboardAccessibility:false\n')
    if (isPvp) pvp.prepareOptions(gameDir)

    status('mods', 'Preparing the Xion Pack…', 0)
    await respack.prepare({ root, gameDir, game, versionId: custom, vj, enabled: isPvp ? s.xionPackPvp !== false : s.xionPack !== false, log: l => emit('launch:log', l) })

    const modsLabel = isPvp ? 'Installing the PvP pack' : 'Installing Xion Client & mods'
    status('mods', modsLabel + '…', 0)
    await mods.sync({
      modsDir: path.join(gameDir, 'mods'),
      game,
      slugs: profile.optimize === false ? [] : (profile.mods || mods.defaultSelection()),
      bundled,
      blocked: (profile.blocked && profile.blocked[game]) || [],
      onProgress: (d, t) => status('mods', `${modsLabel}… ${d}/${t}`, d / t),
      log: l => emit('launch:log', l)
    })
    // Mods switched on/off in game (Right Shift → Mods) take effect now.
    mods.applyToggles(path.join(gameDir, 'mods'), path.join(gameDir, 'config', 'xion-mod-toggles.json'), l => emit('launch:log', l))

    // Hand-off for the in-game Xion Client: account type and custom skin.
    fs.mkdirSync(path.join(gameDir, 'config'), { recursive: true })
    // Theme + Premium: the client re-verifies the license key itself, so editing this file unlocks nothing.
    const premium = license.verify(s.licenseKey).valid
    const theme = themes.prepareForGame(themes.effective(s.theme, premium), gameDir, ASSETS_DIR)
    const perfMode = perf.effective(s.perfMode, premium)
    perf.prepareGame(gameDir, perfMode)
    const userJvm = (s.jvmArgs || '').split(/\s+/).filter(Boolean)
    fs.writeFileSync(path.join(gameDir, 'config', 'xion-launcher.json'), JSON.stringify({ ...skins.launchInfo(), launcherVersion: require('../../package.json').version, theme, perfMode, licenseKey: premium ? s.licenseKey : '', pvp: isPvp, ...cosmetics.handoff(root, s, premium) }, null, 2))

    const client = new Client()
    const options = {
      root,
      authorization,
      javaPath,
      version: { number: game, type: vj.type === 'release' ? 'release' : vj.type, custom },
      memory: { max: `${s.memoryMax}M`, min: `${Math.min(s.memoryMin, s.memoryMax)}M` },
      window: s.fullscreen ? { fullscreen: true } : { width: s.width, height: s.height },
      customArgs: [...perf.jvmArgs(perfMode, userJvm), ...userJvm],
      overrides: { gameDirectory: gameDir, cwd: gameDir, detached: false, maxSockets: 32 }
    }
    // Quick Play starts at 1.20; older versions join a server with --server/--port.
    const minor = Number((game.match(/^1.(d+)/) || [])[1])
    if (opts && opts.server && minor < 20) {
      const [host, port] = String(opts.server).split(':')
      options.server = { host, port: port || '25565' }
    } else if (opts && opts.server) options.quickPlay = { type: 'multiplayer', identifier: opts.server }
    if (opts && opts.world) options.quickPlay = { type: 'singleplayer', identifier: opts.world }

    const phases = {}
    client.on('progress', e => {
      phases[e.type] = e
      status('files', `Downloading ${String(e.type).replace(/-/g, ' ')}… ${e.task}/${e.total}`, e.total ? e.task / e.total : null)
    })
    client.on('debug', l => emit('launch:log', String(l)))
    // Watch for mods that stop the game from starting (Fabric refusing them, or their mixins
    // crashing during startup) so we can disable them and relaunch automatically.
    let incompatible = false
    let ready = false
    const badIds = new Set()
    const mixinIds = new Set()
    client.on('data', l => {
      const line = String(l)
      emit('launch:log', line)
      if (/Incompatible mods found|Mod resolution failed/.test(line)) incompatible = true
      if (incompatible) for (const m of line.matchAll(/Mod '[^']+' \(([^)]+)\)/g)) badIds.add(m[1])
      if (/Sound engine started|OpenAL initialized/.test(line)) ready = true
      if (!ready && /ERROR|Exception|Error:/.test(line)) {
        for (const m of line.matchAll(/(?:from mod|Mixin apply for mod) ([\w.-]+)/g)) mixinIds.add(m[1])
      }
    })
    const startedAt = Date.now()
    client.on('close', code => {
      running = null
      const crashedEarly = code !== 0 && !ready
      if (crashedEarly && !incompatible) mixinIds.forEach(id => badIds.add(id))
      badIds.delete('xionclient')
      const heals = (opts && opts.heals) || 0
      if (crashedEarly && badIds.size && heals < 4) {
        const blocked = disableMods(path.join(gameDir, 'mods'), badIds)
        if (blocked.length) {
          profile.blocked = profile.blocked || {}
          profile.blocked[game] = [...new Set([...(profile.blocked[game] || []), ...blocked])]
          store.save()
          emit('launch:log', '[Xion] Disabled incompatible mods and retrying: ' + blocked.join(', '))
          launch(profileId, { ...(opts || {}), heals: heals + 1 }, emit).catch(e => {
            emit('launch:log', '[Xion] Retry failed: ' + e.message)
            emit('launch:closed', { code })
          })
          return
        }
      }
      profile.playtime = (profile.playtime || 0) + Math.round((Date.now() - startedAt) / 1000)
      profile.launches = (profile.launches || 0) + 1
      profile.lastPlayed = Date.now()
      store.save()
      emit('launch:closed', { code })
    })
    client.on('arguments', () => status('starting', 'Starting Minecraft…', 1))

    status('files', 'Checking game files…', null)
    const proc = await client.launch(options)
    if (!proc) throw new Error('Minecraft failed to start. Check the logs for details.')
    running.proc = proc
    status('running', `Playing ${profile.name}`, 1)
    proc.on('error', e => emit('launch:log', '[Xion] ' + e.message))
    return { ok: true }
  } catch (e) {
    running = null
    throw e
  }
}

// Finds the jars that provide the given mod ids (never Xion Client or Fabric API) and removes them.
function disableMods (modsDir, ids) {
  const out = []
  for (const f of fs.readdirSync(modsDir).filter(x => x.endsWith('.jar'))) {
    if (f.startsWith('xion-client-')) continue
    const meta = zip.modMeta(path.join(modsDir, f))
    if (!meta || meta.id === 'fabric-api' || !ids.has(meta.id)) continue
    try { fs.unlinkSync(path.join(modsDir, f)) } catch {}
    out.push(f)
  }
  return out
}

module.exports = { launch, kill, isRunning, supportedClientVersions }
