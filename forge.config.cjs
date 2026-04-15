const path = require('node:path');

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

module.exports = {
  packagerConfig: {
    asar: true,
    prune: true,
    executableName: 'FatboyPOS',
    out: 'desktop-out',
    ignore: sharedIgnore,
    name: 'FatboyPOS',
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'fatboy_pos',
        setupExe: 'FatboyPOSSetup.exe',
      },
    },
  ],
};
