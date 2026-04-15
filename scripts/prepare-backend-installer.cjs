const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const backendRoot = path.join(root, 'backend');
const stagingRoot = path.join(root, 'installer-staging', 'backend-service');
const stagedBackend = path.join(stagingRoot, 'backend');
const stagedNode = path.join(stagingRoot, 'node');
const stagedNssm = path.join(stagingRoot, 'nssm-2.24', 'win64');
const stagedBootstrap = path.join(stagingRoot, 'bootstrap');
const stagedPostgresPayload = path.join(stagingRoot, 'payload', 'postgresql');
const cacheRoot = path.join(root, 'installer-cache');
const portableNodeVersion = process.env.FATBOY_PORTABLE_NODE_VERSION || '22.20.0';
const portableNodeZipName = `node-v${portableNodeVersion}-win-x64.zip`;
const portableNodeUrl =
  process.env.FATBOY_PORTABLE_NODE_URL ||
  `https://nodejs.org/dist/v${portableNodeVersion}/${portableNodeZipName}`;

function pathExists(targetPath) {
  try {
    fs.accessSync(targetPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function ensureInsideRoot(targetPath) {
  const resolved = path.resolve(targetPath);
  if (!resolved.startsWith(root + path.sep)) {
    throw new Error(`Ruta insegura fuera del proyecto: ${resolved}`);
  }
  return resolved;
}

function copyRequired(source, destination) {
  if (!pathExists(source)) {
    throw new Error(`No existe el archivo o carpeta requerida: ${source}`);
  }

  fs.cpSync(source, destination, {
    recursive: true,
    force: true,
    filter: (entry) => !entry.includes(`${path.sep}.cache${path.sep}`),
  });
}

function runChecked(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`${command} fallo con codigo ${result.status}`);
  }
}

function getNodeMajor(nodePath) {
  const result = spawnSync(nodePath, ['-p', 'process.versions.node.split(".")[0]'], {
    encoding: 'utf8',
    windowsHide: true,
  });

  if (result.status !== 0) {
    return null;
  }

  return Number(String(result.stdout || '').trim());
}

function isSupportedNode(nodePath) {
  const major = getNodeMajor(nodePath);
  return major === 20 || major === 22 || major === 24;
}

function downloadFile(url, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  runChecked('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '${url}' -OutFile '${destination}' -UseBasicParsing`,
  ]);
}

function expandZip(zipPath, destination) {
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  runChecked('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destination}' -Force`,
  ]);
}

function resolvePortableNodePath() {
  const explicitNode = process.env.FATBOY_NODE_PATH;
  if (explicitNode) {
    if (!pathExists(explicitNode)) {
      throw new Error(`FATBOY_NODE_PATH no existe: ${explicitNode}`);
    }
    if (!isSupportedNode(explicitNode)) {
      throw new Error(`FATBOY_NODE_PATH debe ser Node 20, 22 o 24: ${explicitNode}`);
    }
    return explicitNode;
  }

  if (isSupportedNode(process.execPath)) {
    return process.execPath;
  }

  const nodeCacheDir = path.join(cacheRoot, `node-v${portableNodeVersion}-win-x64`);
  const extractedNode = path.join(nodeCacheDir, `node-v${portableNodeVersion}-win-x64`, 'node.exe');
  if (!pathExists(extractedNode)) {
    const zipPath = path.join(cacheRoot, portableNodeZipName);
    if (!pathExists(zipPath)) {
      console.warn(`PORTABLE_NODE_DOWNLOAD:${portableNodeUrl}`);
      downloadFile(portableNodeUrl, zipPath);
    }
    expandZip(zipPath, nodeCacheDir);
  }

  if (!pathExists(extractedNode) || !isSupportedNode(extractedNode)) {
    throw new Error(`No se pudo preparar Node portable soportado: ${extractedNode}`);
  }

  return extractedNode;
}

function pruneStagedBackendDependencies() {
  if (process.platform === 'win32') {
    runChecked('cmd.exe', ['/d', '/s', '/c', 'npm prune --omit=dev'], { cwd: stagedBackend });
    return;
  }

  runChecked('npm', ['prune', '--omit=dev'], { cwd: stagedBackend });
}

function findNssmPath() {
  const candidates = [
    process.env.FATBOY_NSSM_PATH,
    path.join(root, 'nssm-2.24', 'win64', 'nssm.exe'),
    path.join(root, 'tools', 'nssm-2.24', 'win64', 'nssm.exe'),
    'C:\\nssm\\win64\\nssm.exe',
    'C:\\nssm\\nssm.exe',
  ].filter(Boolean);

  return candidates.find(pathExists);
}

function copyOptionalDirectory(source, destination) {
  if (!pathExists(source)) {
    return false;
  }

  fs.cpSync(source, destination, { recursive: true, force: true });
  return true;
}

function main() {
  const safeStagingRoot = ensureInsideRoot(stagingRoot);
  const backendEntry = path.join(backendRoot, 'dist', 'src', 'main.js');
  const nssmPath = findNssmPath();
  const portableNodePath = resolvePortableNodePath();

  if (!pathExists(backendEntry)) {
    throw new Error('El backend no esta compilado. Ejecuta: npm --prefix backend run build');
  }

  if (!nssmPath) {
    throw new Error(
      'No se encontro nssm.exe. Colocalo en nssm-2.24\\win64\\nssm.exe o define FATBOY_NSSM_PATH.',
    );
  }

  fs.rmSync(safeStagingRoot, { recursive: true, force: true });
  fs.mkdirSync(stagedBackend, { recursive: true });
  fs.mkdirSync(stagedNode, { recursive: true });
  fs.mkdirSync(stagedNssm, { recursive: true });
  fs.mkdirSync(stagedBootstrap, { recursive: true });

  copyRequired(path.join(backendRoot, 'dist'), path.join(stagedBackend, 'dist'));
  copyRequired(path.join(backendRoot, 'node_modules'), path.join(stagedBackend, 'node_modules'));
  copyRequired(path.join(backendRoot, 'package.json'), path.join(stagedBackend, 'package.json'));
  copyRequired(path.join(backendRoot, 'package-lock.json'), path.join(stagedBackend, 'package-lock.json'));
  copyRequired(path.join(backendRoot, 'scripts'), path.join(stagedBackend, 'scripts'));
  copyRequired(path.join(backendRoot, 'prisma'), path.join(stagedBackend, 'prisma'));
  copyRequired(path.join(root, 'installer', 'bootstrap'), stagedBootstrap);
  copyRequired(portableNodePath, path.join(stagedNode, 'node.exe'));
  copyRequired(nssmPath, path.join(stagedNssm, 'nssm.exe'));
  pruneStagedBackendDependencies();

  if (copyOptionalDirectory(path.join(root, 'installer', 'payload', 'postgresql'), stagedPostgresPayload)) {
    console.log(`POSTGRES_PAYLOAD_INCLUDED:${stagedPostgresPayload}`);
  } else {
    console.warn('POSTGRES_PAYLOAD_NOT_INCLUDED: el bootstrap descargara PostgreSQL si hace falta.');
  }

  const envPath = path.join(backendRoot, '.env');
  if (pathExists(envPath)) {
    copyRequired(envPath, path.join(stagedBackend, '.env'));
    console.warn('BACKEND_ENV_INCLUDED: backend\\.env fue incluido en el instalador.');
  } else {
    console.warn('BACKEND_ENV_MISSING: agrega backend\\.env antes de generar el instalador.');
  }

  console.log(`BACKEND_INSTALLER_STAGE_OK:${safeStagingRoot}`);
}

main();
