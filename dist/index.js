const core = require('@actions/core');
const exec = require('@actions/exec');

const DEFAULT_VERSION = '3.59.2';

async function resolveInstalledVersion() {
  try {
    const output = await exec.getExecOutput('osls', ['--version'], { silent: true });
    return output.stdout.trim();
  } catch (error) {
    core.info(`Unable to read osls version: ${error.message}`);
    return '';
  }
}

async function resolveBinaryPath() {
  try {
    const whichOutput = await exec.getExecOutput('which', ['osls'], { silent: true });
    return whichOutput.stdout.trim();
  } catch (error) {
    core.info(`Unable to locate osls binary: ${error.message}`);
    return '';
  }
}

async function run() {
  try {
    const inputVersion = core.getInput('osls-version').trim();
    const version = inputVersion || DEFAULT_VERSION;
    const specifier = `osls@${version}`;

    core.startGroup(`Installing ${specifier}`);
    await exec.exec('npm', ['install', '-g', specifier]);
    core.endGroup();

    const installedVersion = await resolveInstalledVersion();
    const binaryPath = await resolveBinaryPath();

    if (installedVersion) {
      core.info(`osls version ${installedVersion} is ready.`);
      core.setOutput('osls-version', installedVersion);
    }

    if (binaryPath) {
      core.info(`osls binary located at ${binaryPath}`);
      core.setOutput('osls-path', binaryPath);
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
