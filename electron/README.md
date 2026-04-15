Electron runtime files for the desktop build.

Desktop mode now expects the backend to live as an independent local service in Windows.

Recommended backend service flow:
- Build backend: `npm --prefix backend run build`
- Install service: `npm --prefix backend run service:install`
- Check status: `npm --prefix backend run service:status`
- Stop service: `npm --prefix backend run service:stop`
- Start service: `npm --prefix backend run service:start`
- Remove service: `npm --prefix backend run service:uninstall`

By default the service name is `FatboyPOSBackend` and it listens on port `3000`.
You can override the port with `FATBOY_BACKEND_PORT`.
The stable Windows deployment path is `C:\fatboypos`, and the service should be installed from an Administrator terminal.

The Electron shell now tries to connect to `127.0.0.1:3000` first and no longer depends on keeping the backend embedded in the desktop app.
