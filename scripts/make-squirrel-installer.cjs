const path = require('node:path');
const fs = require('node:fs');
const { createWindowsInstaller } = require('electron-winstaller');

async function main() {
  const root = path.resolve(__dirname, '..');
  const outputDirectory = path.join(root, 'installer-out');
  const preferredDesktopOut = process.env.FATBOY_DESKTOP_OUT
    ? path.resolve(root, process.env.FATBOY_DESKTOP_OUT)
    : null;
  const candidateDirectories = [
    preferredDesktopOut ? path.join(preferredDesktopOut, 'FatboyPOS-win32-x64') : null,
    path.join(root, 'desktop-out-next', 'FatboyPOS-win32-x64'),
    path.join(root, 'desktop-out-fixed', 'FatboyPOS-win32-x64'),
    path.join(root, 'desktop-out', 'FatboyPOS-win32-x64'),
    path.join(root, 'out', 'Fatboy POS-win32-x64'),
    path.join(root, 'release', 'win-unpacked'),
  ].filter(Boolean);

  const match = candidateDirectories
    .filter((candidate) => fs.existsSync(candidate))
    .map((candidate) => ({
      appDirectory: candidate,
      exeName: fs
        .readdirSync(candidate)
        .find((entry) => entry.toLowerCase().endsWith('.exe') && !entry.startsWith('Squirrel')),
    }))
    .find((candidate) => candidate.exeName);

  if (!match) {
    throw new Error(`No se encontro una app empaquetada valida en: ${candidateDirectories.join(', ')}`);
  }

  const { appDirectory, exeName } = match;

  if (!exeName) {
    throw new Error(`No se encontro ningun ejecutable dentro de: ${appDirectory}`);
  }

  await fs.promises.mkdir(outputDirectory, { recursive: true });

  await createWindowsInstaller({
    appDirectory,
    outputDirectory,
    authors: 'Fatboy POS',
    exe: exeName,
    setupExe: 'FatboyPOSSetup.exe',
    noMsi: true,
    setupIcon: undefined,
  });

  console.log(`INSTALLER_OK:${path.join(outputDirectory, 'FatboyPOSSetup.exe')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
