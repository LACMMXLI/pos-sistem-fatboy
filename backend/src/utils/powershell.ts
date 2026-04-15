import { existsSync } from 'node:fs';
import path from 'node:path';

export function resolvePowerShellExecutable() {
  const systemRoot = process.env.SystemRoot || process.env.WINDIR || 'C:\\Windows';

  const candidates = [
    path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    path.join(systemRoot, 'Sysnative', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    'powershell.exe',
    'pwsh.exe',
  ];

  return candidates.find((candidate) => candidate.includes('\\') ? existsSync(candidate) : true)
    || 'powershell.exe';
}
