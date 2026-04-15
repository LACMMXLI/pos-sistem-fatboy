const path = require('node:path');
const packager = require('electron-packager');

const sharedIgnore = [
  /^\/\.agents($|\/)/,
  /^\/\.git($|\/)/,
  /^\/backups($|\/)/,
  /^\/desktop($|\/)/,
  /^\/desktop-out($|\/)/,
  /^\/desktop-out-fixed($|\/)/,
  /^\/desktop-out-next($|\/)/,
  /^\/electron-test-app($|\/)/,
  /^\/installer($|\/)/,
  /^\/installer-cache($|\/)/,
  /^\/installer-out($|\/)/,
  /^\/installer-staging($|\/)/,
  /^\/out($|\/)/,
  /^\/productos($|\/)/,
  /^\/release($|\/)/,
  /^\/whatsapp-addon($|\/)/,
  /^\/backend\/src($|\/)/,
  /^\/backend\/dist($|\/)/,
  /^\/backend\/test($|\/)/,
  /^\/backend\/coverage($|\/)/,
  /^\/backend\/node_modules($|\/)/,
  /^\/backend\/prisma($|\/)/,
  /^\/backend\/scripts($|\/)/,
  /^\/backend\/\.env$/,
  /^\/backend\/package\.json$/,
  /^\/backend\/package-lock\.json$/,
  /^\/frontend\/src($|\/)/,
  /^\/frontend\/public($|\/)/,
  /^\/frontend\/node_modules($|\/)/,
  /^\/node_modules($|\/)/,
  /^\/.*\.log$/,
];

async function main() {
  const root = path.resolve(__dirname, '..');
  const outputDirectory = path.resolve(
    root,
    process.env.FATBOY_DESKTOP_OUT || 'desktop-out-fixed',
  );

  await packager({
    dir: root,
    name: 'FatboyPOS',
    platform: 'win32',
    arch: 'x64',
    overwrite: true,
    out: outputDirectory,
    asar: true,
    prune: true,
    executableName: 'FatboyPOS',
    ignore: sharedIgnore,
  });

  console.log(`PACKAGE_OK:${path.join(outputDirectory, 'FatboyPOS-win32-x64')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
