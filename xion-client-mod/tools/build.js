#!/usr/bin/env node
// Builds Xion Client for every supported Minecraft version from one source tree.
//
// Sources under ../src may contain line directives:
//   //#if MC >= 12002        (MC is the version as an int: 1.20.2 -> 12002, 26.3 -> 260300)
//   //#elif MC >= 11904
//   //#else
//   //#endif
// Inactive lines are blanked so compiler line numbers still match the source.
//
// Usage: node tools/build.js [version ...]   (default: all versions in targets.json)
const fs = require('fs')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const WORK = path.join(ROOT, '.work')
const OUT = path.resolve(ROOT, '..', 'src', 'assets', 'mods')
const TARGETS = JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.json'), 'utf8'))
const JAVA_HOME = process.env.JAVA_HOME

const mcInt = v => {
  const [a, b = 0, c = 0] = v.split('.').map(Number)
  return a * 10000 + b * 100 + c
}

function preprocess (text, mc, file) {
  const out = []
  const stack = [] // { active, taken, parentActive }
  const isActive = () => stack.every(s => s.active)
  const evalCond = cond => {
    const expr = cond.replace(/\bMC\b/g, String(mc))
    if (!/^[\d\s<>=!&|()]+$/.test(expr)) throw new Error(`${file}: bad condition "${cond}"`)
    return Function(`return (${expr})`)()
  }
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*\/\/#(if|elif|else|endif)\b\s*(.*)$/)
    if (!m) {
      out.push(isActive() ? line : '')
      continue
    }
    const [, kw, cond] = m
    if (kw === 'if') {
      const v = evalCond(cond)
      stack.push({ active: v, taken: v })
    } else if (kw === 'elif') {
      const top = stack[stack.length - 1]
      if (!top) throw new Error(`${file}: #elif without #if`)
      const v = !top.taken && evalCond(cond)
      top.active = v
      top.taken = top.taken || v
    } else if (kw === 'else') {
      const top = stack[stack.length - 1]
      if (!top) throw new Error(`${file}: #else without #if`)
      top.active = !top.taken
      top.taken = true
    } else {
      if (!stack.pop()) throw new Error(`${file}: #endif without #if`)
    }
    out.push('')
  }
  if (stack.length) throw new Error(`${file}: unclosed #if`)
  return out.join('\n')
}

function copyTree (src, dst, mc) {
  fs.mkdirSync(dst, { recursive: true })
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name)
    const d = path.join(dst, e.name)
    if (e.isDirectory()) copyTree(s, d, mc)
    else if (/\.(java|json)$/.test(e.name)) fs.writeFileSync(d, preprocess(fs.readFileSync(s, 'utf8'), mc, s))
    else fs.copyFileSync(s, d)
  }
}

function gradleFiles (ver, t) {
  const unobf = t.mappings === 'none'
  const impl = unobf ? 'implementation' : 'modImplementation'
  return {
    'settings.gradle': `pluginManagement {
	repositories {
		maven { name = 'Fabric'; url = 'https://maven.fabricmc.net/' }
		mavenCentral()
		gradlePluginPortal()
	}
}
rootProject.name = 'xion-client'
`,
    'gradle.properties': `org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true
minecraft_version=${ver}
loader_version=0.20.1
loom_version=${t.loom}
fabric_api_version=${t.fabricApi}
version=${require('../package.json').version}
`,
    'build.gradle': `plugins {
	id '${t.plugin}' version "\${loom_version}"
}
group = 'net.xion'
base { archivesName = 'xion-client' }
dependencies {
	minecraft "com.mojang:minecraft:\${project.minecraft_version}"
	${unobf ? '' : 'mappings loom.officialMojangMappings()'}
	${impl} "net.fabricmc:fabric-loader:\${project.loader_version}"
	${impl} "net.fabricmc.fabric-api:fabric-api:\${project.fabric_api_version}"
}
processResources {
	def props = [version: project.version, mc: project.minecraft_version, java: '${t.java}']
	inputs.properties props
	filesMatching('fabric.mod.json') { expand props }
}
tasks.withType(JavaCompile).configureEach { it.options.release = ${t.java}; it.options.encoding = 'UTF-8' }
java {
	sourceCompatibility = JavaVersion.VERSION_${t.java}
	targetCompatibility = JavaVersion.VERSION_${t.java}
}
`
  }
}

function build (ver) {
  const t = TARGETS[ver]
  if (!t) throw new Error('Unknown target ' + ver)
  const mc = mcInt(ver)
  const dir = path.join(WORK, ver)
  fs.rmSync(path.join(dir, 'src'), { recursive: true, force: true })
  fs.rmSync(path.join(dir, 'build', 'libs'), { recursive: true, force: true })
  copyTree(path.join(ROOT, 'src'), path.join(dir, 'src'), mc)
  for (const [f, c] of Object.entries(gradleFiles(ver, t))) fs.writeFileSync(path.join(dir, f), c)
  for (const f of ['gradlew', 'gradlew.bat']) fs.copyFileSync(path.join(ROOT, f), path.join(dir, f))
  fs.cpSync(path.join(ROOT, 'gradle'), path.join(dir, 'gradle'), { recursive: true })

  const started = Date.now()
  const win = process.platform === 'win32'
  const r = spawnSync(win ? 'cmd.exe' : './gradlew', win ? ['/c', path.join(dir, 'gradlew.bat'), 'build', '-x', 'test', '-q', '--console=plain'] : ['build', '-x', 'test', '-q', '--console=plain'], {
    cwd: dir, encoding: 'utf8', env: { ...process.env, JAVA_HOME }, maxBuffer: 64 * 1024 * 1024, timeout: 25 * 60 * 1000
  })
  if (r.error) console.log(r.error)
  const secs = ((Date.now() - started) / 1000).toFixed(0)
  if (r.status !== 0) {
    const lines = (r.stdout + r.stderr).split('\n')
    const errs = lines.filter((l, i) => /error:|\.java:\d+|FAILED|Exception|What went wrong/.test(l) || /What went wrong/.test(lines[i - 1] || '')).slice(0, 40).join('\n')
    console.log(`✗ ${ver} (${secs}s)\n${errs}`)
    return false
  }
  const libs = path.join(dir, 'build', 'libs')
  // Pick the jar for the current version; stale jars from older versions may still be in libs.
  const jar = `xion-client-${require('../package.json').version}.jar`
  if (!fs.existsSync(path.join(libs, jar))) {
    console.log(`✗ ${ver}: ${jar} was not produced`)
    return false
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.copyFileSync(path.join(libs, jar), path.join(OUT, `xion-client-${ver}.jar`))
  console.log(`✓ ${ver} (${secs}s)`)
  return true
}

const list = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(TARGETS)
let ok = 0
for (const v of list) if (build(v)) ok++
console.log(`\n${ok}/${list.length} built`)
process.exit(ok === list.length ? 0 : 1)
