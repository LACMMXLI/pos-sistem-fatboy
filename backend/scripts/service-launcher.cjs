const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');

function resolveBackendRoot() {
  const envRoot = process.env.FATBOY_BACKEND_ROOT;
  const candidates = [
    envRoot,
    path.resolve(__dirname, '..'),
    process.cwd(),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (
      fs.existsSync(path.join(candidate, 'package.json')) &&
      fs.existsSync(path.join(candidate, 'dist', 'src', 'main.js'))
    ) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '..');
}

function loadEnvFile(backendRoot) {
  const envPath = path.join(backendRoot, '.env');
  if (!fs.existsSync(envPath)) {
    console.warn(`[service-launcher] No se encontró ${envPath}`);
    return;
  }

  const parsed = dotenv.parse(fs.readFileSync(envPath, 'utf8'));
  const injectedKeys = [];
  const skippedKeys = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
      injectedKeys.push(key);
      continue;
    }

    skippedKeys.push(key);
  }

  if (injectedKeys.length > 0) {
    console.log(
      `[service-launcher] Variables agregadas desde .env: ${injectedKeys.sort().join(', ')}`,
    );
  }

  if (skippedKeys.length > 0) {
    console.log(
      `[service-launcher] Variables preservadas desde NSSM/entorno actual: ${skippedKeys.sort().join(', ')}`,
    );
  }
}

function bootstrap() {
  const backendRoot = resolveBackendRoot();
  const projectRoot = path.resolve(backendRoot, '..');
  process.env.FATBOY_PROJECT_ROOT = process.env.FATBOY_PROJECT_ROOT || projectRoot;
  process.env.FATBOY_BACKEND_ROOT = backendRoot;
  process.env.ELECTRON_DESKTOP = 'false';

  try {
    process.chdir(backendRoot);
  } catch (error) {
    console.warn(
      `[service-launcher] No se pudo cambiar al directorio ${backendRoot}: ${error.message}`,
    );
  }

  loadEnvFile(backendRoot);

  const entry = path.join(backendRoot, 'dist', 'src', 'main.js');
  if (!fs.existsSync(entry)) {
    throw new Error(`No existe el entrypoint del backend: ${entry}`);
  }

  require(entry);
}

bootstrap();
