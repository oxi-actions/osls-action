import { mkdtemp, writeFile, chmod, cp, rm, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'

function run (cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, ...(opts.env || {}) },
      cwd: opts.cwd || process.cwd()
    })

    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })

    child.on('error', reject)
    child.on('close', (code) => resolve({ code, stdout, stderr }))
  })
}

async function canRun (cmd, args = ['--version']) {
  try {
    const result = await run(cmd, args)
    return result.code === 0
  } catch {
    return false
  }
}

function assertIncludes (haystack, needle, label) {
  if (!haystack.includes(needle)) {
    throw new Error(`Expected ${label} to include ${JSON.stringify(needle)}\n---\n${haystack}`)
  }
}

function parseUnzipList (stdout) {
  const files = []
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (!/^\d/.test(trimmed)) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length < 4) continue
    const name = parts[parts.length - 1]
    if (name && name !== '----' && name !== 'Name') files.push(name)
  }
  return files
}

async function main () {
  const distIndex = existsSync(path.resolve('dist/index.mjs'))
    ? path.resolve('dist/index.mjs')
    : path.resolve('dist/index.js')

  const distBundle = existsSync(path.resolve('dist/osls_bundle.mjs'))
    ? path.resolve('dist/osls_bundle.mjs')
    : path.resolve('dist/osls_bundle.js')
  const distModules = path.resolve('dist/osls_node_modules.tgz')

  if (!existsSync(distIndex)) throw new Error(`Missing ${distIndex}. Run a build first.`)
  if (!existsSync(distBundle)) throw new Error(`Missing ${distBundle}. Run a build first.`)
  if (!existsSync(distModules)) throw new Error(`Missing ${distModules}. Run a build first.`)

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'osls-action-smoke-'))

  // Create a minimal "@actions/*" runtime environment inside a temp dir.
  // dist/index.* expects __dirname/osls_bundle.* and creates __dirname/bin/osls
  const tmpBundleName = distBundle.endsWith('.mjs') ? 'osls_bundle.mjs' : 'osls_bundle.js'
  await writeFile(path.join(tmp, tmpBundleName), "console.log('3.61.0')\n")

  const nodeModulesRoot = path.join(tmp, 'node_modules')
  const actionsCoreDir = path.join(nodeModulesRoot, '@actions', 'core')
  const actionsExecDir = path.join(nodeModulesRoot, '@actions', 'exec')

  await writeFile(path.join(tmp, 'package.json'), '{"name":"smoke","private":true}\n')

  // Simple @actions/core stub
  await (await import('node:fs/promises')).mkdir(path.join(actionsCoreDir), { recursive: true })
  await writeFile(path.join(actionsCoreDir, 'index.js'), `
let failed = null
module.exports = {
  addPath: () => {},
  info: () => {},
  setOutput: () => {},
  setFailed: (msg) => { failed = msg },
  __getFailed: () => failed
}
`) 

  // Simple @actions/exec stub that runs the given command in a shell.
  await (await import('node:fs/promises')).mkdir(path.join(actionsExecDir), { recursive: true })
  await writeFile(path.join(actionsExecDir, 'index.js'), `
const { spawn } = require('node:child_process')
module.exports = {
  getExecOutput: (cmd, args) => new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => { stdout += d.toString() })
    child.stderr.on('data', (d) => { stderr += d.toString() })
    child.on('error', reject)
    child.on('close', (code) => resolve({ exitCode: code, stdout, stderr }))
  })
}
`) 

  // Copy dist/index.* into temp and run it.
  const tmpIndex = distIndex.endsWith('.mjs') ? path.join(tmp, 'index.mjs') : path.join(tmp, 'index.js')
  const distContents = await (await import('node:fs/promises')).readFile(distIndex, 'utf8')
  await writeFile(tmpIndex, distContents)

  const result = await run(process.execPath, [tmpIndex], {
    cwd: tmp,
    env: { PATH: process.env.PATH }
  })

  if (result.code !== 0) {
    throw new Error(`dist/index.js exited ${result.code}\nSTDOUT:\n${result.stdout}\nSTDERR:\n${result.stderr}`)
  }

  const wrapper = path.join(tmp, 'bin', 'osls')
  if (!existsSync(wrapper)) throw new Error('Wrapper was not created at tmp/bin/osls')

  // Ensure wrapper is executable and returns a version-ish string.
  await chmod(wrapper, 0o755)
  const ver = await run(wrapper, ['--version'], { cwd: tmp })
  if (ver.code !== 0) throw new Error(`osls wrapper failed: ${ver.stderr || ver.stdout}`)

  const version = (ver.stdout || '').trim()
  if (!/^\d+\./.test(version)) throw new Error(`Unexpected version output: ${JSON.stringify(version)}`)

  process.stdout.write(`OK: wrapper works, version=${version}\n`)

  // Real-bundle phase: run the bundled osls CLI against the integration fixture.
  const tmpReal = await mkdtemp(path.join(os.tmpdir(), 'osls-action-smoke-real-'))
  const binDir = path.join(tmpReal, 'bin')
  await mkdir(binDir, { recursive: true })

  const realBundleName = distBundle.endsWith('.mjs') ? 'osls_bundle.mjs' : 'osls_bundle.js'
  const realBundlePath = path.join(binDir, realBundleName)
  await cp(distBundle, realBundlePath)

  // Match the composite action layout: extract node_modules beside the bundle.
  const untar = await run('tar', ['-C', binDir, '-xzf', distModules])
  if (untar.code !== 0) {
    throw new Error(`Failed to extract ${distModules}\nSTDOUT:\n${untar.stdout}\nSTDERR:\n${untar.stderr}`)
  }

  const fixtureDir = path.resolve('scripts/sls-integration-tests')

  const printResult = await run(process.execPath, [realBundlePath, 'print'], { cwd: fixtureDir })
  if (printResult.code !== 0) {
    throw new Error(`osls print failed (${printResult.code})\nSTDOUT:\n${printResult.stdout}\nSTDERR:\n${printResult.stderr}`)
  }
  assertIncludes(printResult.stdout, 'service:', 'print output')
  assertIncludes(printResult.stdout, 'provider:', 'print output')
  assertIncludes(printResult.stdout, 'functions:', 'print output')

  // Ensure deterministic packaging output.
  await rm(path.join(fixtureDir, '.serverless'), { recursive: true, force: true })

  const packageResult = await run(process.execPath, [realBundlePath, 'package'], { cwd: fixtureDir })
  if (packageResult.code !== 0) {
    throw new Error(`osls package failed (${packageResult.code})\nSTDOUT:\n${packageResult.stdout}\nSTDERR:\n${packageResult.stderr}`)
  }

  const serverlessDir = path.join(fixtureDir, '.serverless')
  if (!existsSync(serverlessDir)) throw new Error('Expected fixture .serverless directory to be created')

  const expectedFiles = [
    'cloudformation-template-create-stack.json',
    'cloudformation-template-update-stack.json',
    'goodbye.zip',
    'hello.zip',
    'serverless-state.json'
  ]

  for (const filename of expectedFiles) {
    const fullPath = path.join(serverlessDir, filename)
    if (!existsSync(fullPath)) throw new Error(`Missing expected package output: ${fullPath}`)
  }

  // Conditional zip inspection (skip if unzip isn't available).
  const hasUnzip = await canRun('unzip', ['-v'])
  if (hasUnzip) {
    for (const zipName of ['hello.zip', 'goodbye.zip']) {
      const zipPath = path.join(serverlessDir, zipName)
      const unzipList = await run('unzip', ['-l', zipPath], { cwd: fixtureDir })
      if (unzipList.code !== 0) {
        throw new Error(`unzip -l failed for ${zipName}\nSTDOUT:\n${unzipList.stdout}\nSTDERR:\n${unzipList.stderr}`)
      }
      const files = parseUnzipList(unzipList.stdout)
      if (files.length !== 1 || files[0] !== 'handler.js') {
        throw new Error(`Unexpected zip contents for ${zipName}: ${JSON.stringify(files)}`)
      }
    }
  } else {
    // Provide a hint in CI logs without failing.
    process.stdout.write('SKIP: unzip not available; skipping zip-content validation\n')
  }

  // Extra sanity: ensure .serverless directory isn't empty.
  const produced = await readdir(serverlessDir)
  if (produced.length === 0) throw new Error('Expected fixture .serverless directory to contain outputs')

  process.stdout.write('OK: real bundle print + package succeeded\n')
}

main().catch((e) => {
  console.error(e && e.stack ? e.stack : String(e))
  process.exit(1)
})
