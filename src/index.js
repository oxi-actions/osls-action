const core = require('@actions/core')
const exec = require('@actions/exec')
const path = require('path')
const fs = require('fs')

async function run () {
  try {
    const bundledPath = path.join(__dirname, 'osls_bundle.js')

    if (!fs.existsSync(bundledPath)) {
      throw new Error(`Bundled osls not found at ${bundledPath}`)
    }

    const binDir = path.join(__dirname, 'bin')
    if (!fs.existsSync(binDir)) {
      fs.mkdirSync(binDir, { recursive: true })
    }

    const wrapperPath = path.join(binDir, 'osls')
    const wrapperContent = `#!/bin/sh
exec node "${bundledPath}" "$@"
`
    fs.writeFileSync(wrapperPath, wrapperContent, { mode: 0o755 })

    if (process.platform === 'win32') {
      const wrapperContentCmd = `@echo off
node "${bundledPath}" %*
`
      fs.writeFileSync(path.join(binDir, 'osls.cmd'), wrapperContentCmd)
    }

    core.addPath(binDir)
    core.info(`Added ${binDir} to PATH`)

    // Verify installation
    const output = await exec.getExecOutput('osls', ['--version'], { silent: true })
    const version = output.stdout.trim()

    core.info(`osls version ${version} is ready.`)
    core.setOutput('osls-version', version)
    core.setOutput('osls-path', wrapperPath)
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
