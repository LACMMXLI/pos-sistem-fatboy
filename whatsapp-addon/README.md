# WhatsApp Addon

Esqueleto inicial del addon externo de WhatsApp para Fatboy POS.

## Base incluida

- `Electron` como contenedor principal.
- `React + Vite` para la interfaz.
- `preload` seguro con `contextBridge`.
- control de instancia unica;
- ventana ocultable a bandeja;
- estado runtime inicial para backend, WhatsApp y despachos.
- base de sesion `Baileys` con QR, restauracion y reconexion;
- controles iniciales para iniciar o regenerar sesion desde la UI.
- store local SQLite con esquema inicial para configuracion, destinatarios, reglas, cola e historial.
- worker inicial de despachos para procesar la cola local y reportar resultado al backend.
- CRUD local basico de destinatarios y reglas desde la UI.

## Estructura

- `electron/main.cjs`: proceso principal, bandeja, instancia unica, IPC.
- `electron/preload.cjs`: puente seguro al renderer.
- `src/`: interfaz React.

## Comandos

```bash
npm install
npm run dev
```

Desde la raiz del repo tambien puedes abrirlo con:

```bash
npm run whatsapp-addon
```

## Variables de entorno

El addon espera estas variables para enlazarse al backend:

```bash
WHATSAPP_ADDON_BACKEND_URL=http://127.0.0.1:3000
WHATSAPP_ADDON_SHARED_TOKEN=fatboy_whatsapp_addon_local_token
```

El backend debe tener el mismo valor en `backend/.env` para `WHATSAPP_ADDON_SHARED_TOKEN`.

## Nota sobre Electron en este equipo

Este entorno tiene `ELECTRON_RUN_AS_NODE=1` definido globalmente. Los scripts del addon ya lo limpian automaticamente al arrancar, asi que usa siempre los comandos de `package.json` en lugar de lanzar `electron .` manualmente.

Si `Baileys` aun no carga, instala dependencias primero dentro de este proyecto:

```bash
cd whatsapp-addon
npm install
```

## Siguientes pasos

1. Conectar con `Socket.IO + REST`.
2. Resolver destinatarios por reglas en vez de usar solo payload directo.
3. Agregar edicion/eliminacion para destinatarios y reglas.
4. Agregar envio de adjuntos y plantillas.
