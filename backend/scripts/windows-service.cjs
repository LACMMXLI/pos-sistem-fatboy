const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');

const SERVICE_NAME = process.env.FATBOY_SERVICE_NAME || 'FatboyPOSBackend';
const SERVICE_DESCRIPTION =
  process.env.FATBOY_SERVICE_DESCRIPTION ||
  'Servicio local del backend Fatboy POS administrado por NSSM.';
const SERVICE_PORT = String(process.env.FATBOY_BACKEND_PORT || process.env.PORT || '3000');

const backendRoot = path.resolve(__dirname, '..');
const appRoot = path.resolve(backendRoot, '..');
const backendEntry = path.join(backendRoot, 'dist', 'src', 'main.js');
const serviceLauncher = path.join(backendRoot, 'scripts', 'service-launcher.cjs');
const runtimeDir = path.join(backendRoot, 'service-runtime');
const stdoutLog = path.join(runtimeDir, 'backend-service.stdout.log');
const stderrLog = path.join(runtimeDir, 'backend-service.stderr.log');
const envFile = path.join(backendRoot, '.env');

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function decodeOutput(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (!Buffer.isBuffer(value) || value.length === 0) return '';

  let zeroBytes = 0;
  for (const byte of value) {
    if (byte === 0) zeroBytes += 1;
  }

  return zeroBytes > value.length / 4 ? value.toString('utf16le') : value.toString('utf8');
}

function getEmbeddedNodePath() {
  const candidates = [
    process.env.FATBOY_NODE_PATH,
    path.join(appRoot, 'node', 'node.exe'),
    path.join(backendRoot, '..', 'node', 'node.exe'),
    process.execPath,
  ].filter(Boolean);

  const match = candidates.find(pathExists);
  if (!match) {
    throw new Error(`No se encontro node.exe. Rutas probadas: ${candidates.join(', ')}`);
  }

  return path.resolve(match);
}

function getNssmPath() {
  const candidates = [
    process.env.FATBOY_NSSM_PATH,
    path.join(appRoot, 'nssm-2.24', 'win64', 'nssm.exe'),
    path.join(appRoot, 'nssm-2.24', 'win32', 'nssm.exe'),
    path.join(backendRoot, '..', 'nssm-2.24', 'win64', 'nssm.exe'),
    'C:\\nssm\\win64\\nssm.exe',
    'C:\\nssm\\nssm.exe',
  ].filter(Boolean);

  const match = candidates.find(pathExists);
  if (!match) {
    throw new Error(`No se encontro nssm.exe. Rutas probadas: ${candidates.join(', ')}`);
  }

  return path.resolve(match);
}

function runProcess(exe, args, options = {}) {
  const result = spawnSync(exe, args.map(String), {
    cwd: options.cwd || backendRoot,
    stdio: 'pipe',
    windowsHide: true,
    ...options,
  });

  if (result.error) throw result.error;

  return {
    ...result,
    stdout: decodeOutput(result.stdout),
    stderr: decodeOutput(result.stderr),
  };
}

function runNssm(args, options = {}) {
  return runProcess(getNssmPath(), args, options);
}

function runSc(args, options = {}) {
  const scPath = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'sc.exe');
  if (!pathExists(scPath)) return null;
  return runProcess(scPath, args, options);
}

function logResult(result) {
  const stdout = result.stdout?.trim();
  const stderr = result.stderr?.trim();
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
}

function getServiceState(name = SERVICE_NAME) {
  const scResult = runSc(['query', name]);
  if (scResult && scResult.status === 0) {
    const match = `${scResult.stdout}\n${scResult.stderr}`.match(/STATE\s*:\s*\d+\s+([A-Z_]+)/i);
    if (match) return match[1].toUpperCase();
  }

  const combined = `${scResult?.stdout || ''}\n${scResult?.stderr || ''}`.toUpperCase();
  if (
    combined.includes('FAILED 1060') ||
    combined.includes('DOES NOT EXIST') ||
    combined.includes('OPENSERVICE FAILED 1060')
  ) {
    return 'NOT_FOUND';
  }

  try {
    const nssmStatus = runNssm(['status', name]);
    const normalized = `${nssmStatus.stdout}\n${nssmStatus.stderr}`.toUpperCase();
    if (normalized.includes('SERVICE_RUNNING')) return 'SERVICE_RUNNING';
    if (normalized.includes('SERVICE_STOPPED')) return 'SERVICE_STOPPED';
    if (normalized.includes('SERVICE_PAUSED')) return 'SERVICE_PAUSED';
    if (normalized.includes('SERVICE_START_PENDING')) return 'SERVICE_START_PENDING';
    if (normalized.includes('SERVICE_STOP_PENDING')) return 'SERVICE_STOP_PENDING';
    if (normalized.includes('DOES NOT EXIST') || normalized.includes("CAN'T OPEN SERVICE")) {
      return 'NOT_FOUND';
    }
    return normalized.trim() || `EXIT_${nssmStatus.status ?? 0}`;
  } catch (error) {
    return `STATUS_ERROR:${error.message || error}`;
  }
}

function serviceExists(name = SERVICE_NAME) {
  return getServiceState(name) !== 'NOT_FOUND';
}

function waitForServiceState(expectedStates, timeoutMs = 30000) {
  const expected = new Set(expectedStates);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const state = getServiceState();
    if (expected.has(state)) return state;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }

  return getServiceState();
}

function removeServiceIfExists() {
  if (!serviceExists()) {
    console.log(`SERVICE_NOT_FOUND:${SERVICE_NAME}`);
    return;
  }

  const state = getServiceState();
  if (state !== 'SERVICE_STOPPED') {
    const stopResult = runNssm(['stop', SERVICE_NAME]);
    logResult(stopResult);
    waitForServiceState(['SERVICE_STOPPED', 'NOT_FOUND'], 30000);
  }

  const removeResult = runNssm(['remove', SERVICE_NAME, 'confirm']);
  logResult(removeResult);
  if (removeResult.status !== 0) {
    throw new Error(`No se pudo eliminar el servicio ${SERVICE_NAME}. Codigo ${removeResult.status}`);
  }

  const finalState = waitForServiceState(['NOT_FOUND'], 30000);
  if (finalState !== 'NOT_FOUND') {
    const scDelete = runSc(['delete', SERVICE_NAME]);
    if (scDelete) logResult(scDelete);
  }

  console.log(`SERVICE_REMOVED:${SERVICE_NAME}`);
}

function ensureCriticalFiles() {
  const required = [backendEntry, serviceLauncher, envFile, getEmbeddedNodePath(), getNssmPath()];
  for (const filePath of required) {
    if (!pathExists(filePath)) {
      throw new Error(`Archivo critico no encontrado: ${filePath}`);
    }
  }
  fs.mkdirSync(runtimeDir, { recursive: true });
}

function loadEnvFile() {
  return pathExists(envFile) ? dotenv.parse(fs.readFileSync(envFile, 'utf8')) : {};
}

function buildServiceEnvironment() {
  const fileEnv = loadEnvFile();
  const mergedEnv = {
    ...fileEnv,
    FATBOY_APP_ROOT: appRoot,
    FATBOY_BACKEND_ROOT: backendRoot,
    FATBOY_SERVICE_NAME: SERVICE_NAME,
    FATBOY_NODE_PATH: getEmbeddedNodePath(),
    FATBOY_NSSM_PATH: getNssmPath(),
    NODE_ENV: fileEnv.NODE_ENV || 'production',
    PORT: String(fileEnv.PORT || SERVICE_PORT),
    ELECTRON_DESKTOP: 'false',
  };

  return Object.entries(mergedEnv)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${key}=${String(value)}`)
    .join('\n');
}

function installService() {
  ensureCriticalFiles();
  removeServiceIfExists();

  const nodePath = getEmbeddedNodePath();
  const installResult = runNssm(['install', SERVICE_NAME, nodePath, serviceLauncher]);
  logResult(installResult);
  if (installResult.status !== 0) {
    throw new Error(`NSSM install fallo con codigo ${installResult.status}`);
  }

  const settings = [
    ['Application', nodePath],
    ['AppParameters', serviceLauncher],
    ['AppDirectory', backendRoot],
    ['Description', SERVICE_DESCRIPTION],
    ['DisplayName', SERVICE_NAME],
    ['Start', 'SERVICE_AUTO_START'],
    ['AppStdout', stdoutLog],
    ['AppStderr', stderrLog],
    ['AppRotateFiles', '1'],
    ['AppRotateOnline', '1'],
    ['AppRotateBytes', '1048576'],
    ['AppStopMethodSkip', '0'],
    ['AppThrottle', '1500'],
    ['AppRestartDelay', '5000'],
    ['AppEnvironmentExtra', buildServiceEnvironment()],
  ];

  for (const [key, value] of settings) {
    const result = runNssm(['set', SERVICE_NAME, key, value]);
    logResult(result);
    if (result.status !== 0) {
      throw new Error(`NSSM set ${key} fallo con codigo ${result.status}`);
    }
  }

  console.log(`SERVICE_INSTALLED:${SERVICE_NAME}`);
  printSummary();
  startService();
}

function startService() {
  const result = runNssm(['start', SERVICE_NAME]);
  logResult(result);
  if (result.status !== 0) {
    throw new Error(`No se pudo iniciar ${SERVICE_NAME}. Codigo ${result.status}`);
  }

  const state = waitForServiceState(['SERVICE_RUNNING'], 30000);
  if (state !== 'SERVICE_RUNNING') {
    throw new Error(`El servicio no quedo en RUNNING. Estado actual: ${state}`);
  }

  console.log(`SERVICE_RUNNING:${SERVICE_NAME}`);
}

function stopService() {
  if (!serviceExists()) {
    console.log(`SERVICE_ALREADY_STOPPED_OR_REMOVED:${SERVICE_NAME}`);
    return;
  }

  const result = runNssm(['stop', SERVICE_NAME]);
  logResult(result);
  if (result.status !== 0) {
    throw new Error(`No se pudo detener ${SERVICE_NAME}. Codigo ${result.status}`);
  }

  console.log(`SERVICE_STOPPED:${SERVICE_NAME}`);
}

function uninstallService() {
  removeServiceIfExists();
}

function printStatus() {
  console.log(`SERVICE_NAME:${SERVICE_NAME}`);
  console.log(`SERVICE_STATE:${getServiceState()}`);
}

function printSummary() {
  const envKeys = Object.keys(loadEnvFile()).sort();
  console.log(`SERVICE_BACKEND_ROOT:${backendRoot}`);
  console.log(`SERVICE_APP_ROOT:${appRoot}`);
  console.log(`SERVICE_NODE:${getEmbeddedNodePath()}`);
  console.log(`SERVICE_NSSM:${getNssmPath()}`);
  console.log(`SERVICE_ENTRY:${backendEntry}`);
  console.log(`SERVICE_STDOUT:${stdoutLog}`);
  console.log(`SERVICE_STDERR:${stderrLog}`);
  console.log(`SERVICE_ENV_KEYS:${envKeys.join(',')}`);
}

const command = process.argv[2];

try {
  switch (command) {
    case 'install':
      installService();
      break;
    case 'uninstall':
      uninstallService();
      break;
    case 'start':
      startService();
      break;
    case 'stop':
      stopService();
      break;
    case 'status':
      printStatus();
      break;
    default:
      console.error('Uso: node scripts/windows-service.cjs <install|uninstall|start|stop|status>');
      process.exitCode = 64;
  }
} catch (error) {
  console.error(`SERVICE_ERROR:${error.message || error}`);
  process.exitCode = 1;
}
