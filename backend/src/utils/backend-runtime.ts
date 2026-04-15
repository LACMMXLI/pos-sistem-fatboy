import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

let runtimePrepared = false;

function existingPath(candidate: string) {
  return fs.existsSync(candidate) ? candidate : null;
}

export function resolveBackendRoot() {
  const envRoot = process.env.FATBOY_BACKEND_ROOT;

  const candidates = [
    envRoot,
    path.resolve(__dirname, '..', '..', '..'),
    path.resolve(process.execPath, '..'),
    process.cwd(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const hasDist = existingPath(path.join(candidate, 'dist'));
    const hasPackage = existingPath(path.join(candidate, 'package.json'));

    if (hasDist && hasPackage) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '..', '..', '..');
}

export function ensureBackendRuntime() {
  if (runtimePrepared) {
    return resolveBackendRoot();
  }

  const backendRoot = resolveBackendRoot();
  const envPath = path.join(backendRoot, '.env');

  process.env.FATBOY_BACKEND_ROOT = backendRoot;

  try {
    process.chdir(backendRoot);
  } catch {
    // noop
  }

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
  }

  runtimePrepared = true;
  return backendRoot;
}
