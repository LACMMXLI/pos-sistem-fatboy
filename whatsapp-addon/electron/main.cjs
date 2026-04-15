const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, powerSaveBlocker } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { BackendConnector } = require('./backend-connector.cjs');
const { DispatchWorker } = require('./dispatch-worker.cjs');
const { LocalStore } = require('./local-store.cjs');
const { WhatsAppSessionManager } = require('./whatsapp-session-manager.cjs');

const APP_NAME = 'Fatboy WhatsApp Addon';
const DEV_RENDERER_URL = process.env.WHATSAPP_ADDON_RENDERER_URL || '';
const isDev = Boolean(DEV_RENDERER_URL);
const DEBUG_LOG_PATH = path.join(__dirname, '..', 'debug-electron.log');

let mainWindow = null;
let tray = null;
let allowQuit = false;
let backendConnector = null;
let dispatchWorker = null;
let localStore = null;
let whatsappSessionManager = null;
let suspensionBlockerId = null;
let windowReadyToShow = false;
let initialWindowVisibilityResolved = false;
let initialWindowVisibilityTimer = null;

function debugLog(message, payload) {
  const line = `[${new Date().toISOString()}] ${message}${
    payload === undefined ? '' : ` ${JSON.stringify(payload)}`
  }\n`;
  try {
    fs.appendFileSync(DEBUG_LOG_PATH, line, 'utf8');
  } catch {
    // noop
  }
}

// ... (runtimeState remains the same)

const runtimeState = {
  appVersion: app.getVersion(),
  environment: isDev ? 'development' : 'production',
  backend: {
    configured: Boolean(
      process.env.WHATSAPP_ADDON_BACKEND_URL && process.env.WHATSAPP_ADDON_SHARED_TOKEN,
    ),
    url: process.env.WHATSAPP_ADDON_BACKEND_URL || '',
    socketConnected: false,
    lastHeartbeatAt: null,
    lastError: null,
  },
  whatsapp: {
    sessionState: 'idle',
    phoneNumber: null,
    qrAvailable: false,
    qrCodeDataUrl: null,
    reconnecting: false,
    lastSyncAt: null,
    lastError: null,
  },
  dispatch: {
    pending: 0,
    sending: 0,
    failedToday: 0,
    lastDispatchAt: null,
  },
  storage: {
    ready: false,
    engine: 'unavailable',
    databasePath: '',
    lastInitializedAt: null,
    lastError: null,
    stats: {
      recipients: 0,
      rules: 0,
      queuedDispatches: 0,
      messageHistory: 0,
      errorLogs: 0,
    },
  },
  runtime: {
    startedAt: new Date().toISOString(),
    hostname: os.hostname(),
    platform: process.platform,
    trayEnabled: true,
  },
  settings: {
    backendUrl: '',
    backendTokenConfigured: false,
    autoStartEnabled: false,
    autoReconnectEnabled: true,
    updatedAt: null,
  },
};

app.setName(APP_NAME);

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function getRendererEntry() {
  if (DEV_RENDERER_URL) {
    return DEV_RENDERER_URL;
  }

  return path.join(__dirname, '..', 'dist', 'index.html');
}

function createTrayIcon() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setToolTip(APP_NAME);
  tray.on('click', () => {
    if (!mainWindow) {
      createWindow();
      return;
    }

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  renderTrayMenu();
}

function renderTrayMenu() {
  if (!tray) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir panel',
      click: () => {
        if (!mainWindow) {
          createWindow();
          return;
        }
        mainWindow.show();
        mainWindow.focus();
      },
    },
    {
      label: 'Ocultar ventana',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Salir',
      click: () => {
        allowQuit = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
}

function createWindow() {
  windowReadyToShow = false;
  initialWindowVisibilityResolved = false;
  if (initialWindowVisibilityTimer) {
    clearTimeout(initialWindowVisibilityTimer);
    initialWindowVisibilityTimer = null;
  }

  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1380,
    height: 920,
    minWidth: 1120,
    minHeight: 720,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#07131a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      additionalArguments: [`--wa-addon-environment=${runtimeState.environment}`],
    },
  });

  mainWindow.once('ready-to-show', () => {
    windowReadyToShow = true;
    resolveInitialWindowVisibility();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[whatsapp-addon] did-fail-load', {
      errorCode,
      errorDescription,
      validatedURL,
    });
    debugLog('did-fail-load', { errorCode, errorDescription, validatedURL });
  });

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log('[whatsapp-addon][renderer-console]', {
      level,
      message,
      line,
      sourceId,
    });
    debugLog('renderer-console', { level, message, line, sourceId });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[whatsapp-addon] render-process-gone', details);
    debugLog('render-process-gone', details);
  });

  mainWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[whatsapp-addon] preload-error', {
      preloadPath,
      error,
    });
    debugLog('preload-error', {
      preloadPath,
      error: error?.message || String(error),
    });
  });

  mainWindow.webContents.on('did-finish-load', async () => {
    try {
      const snapshot = await mainWindow.webContents.executeJavaScript(`
        (async () => ({
          location: window.location.href,
          title: document.title,
          bridgeExists: typeof window.fatboyWhatsappAddon !== 'undefined',
          bridgeMethods: window.fatboyWhatsappAddon ? Object.keys(window.fatboyWhatsappAddon) : [],
          electronState: window.fatboyWhatsappAddon
            ? await window.fatboyWhatsappAddon.getRuntimeState().catch((error) => ({ error: String(error?.message || error) }))
            : null,
          rootExists: !!document.getElementById('root'),
          rootHtml: document.getElementById('root')?.innerHTML || '',
          bodyText: document.body?.innerText || '',
          bodyHtmlLength: document.body?.innerHTML?.length || 0
        }))()
      `);
      console.log('[whatsapp-addon] did-finish-load snapshot', snapshot);
      debugLog('did-finish-load', snapshot);
    } catch (error) {
      console.error('[whatsapp-addon] snapshot-error', error);
      debugLog('snapshot-error', { error: error?.message || String(error) });
    }
  });

  mainWindow.on('close', (event) => {
    if (allowQuit || process.platform === 'darwin') {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    if (initialWindowVisibilityTimer) {
      clearTimeout(initialWindowVisibilityTimer);
      initialWindowVisibilityTimer = null;
    }
    windowReadyToShow = false;
    initialWindowVisibilityResolved = false;
    mainWindow = null;
  });

  if (DEV_RENDERER_URL) {
    debugLog('loadURL', { url: getRendererEntry() });
    mainWindow.loadURL(getRendererEntry());
  } else {
    debugLog('loadFile', { file: getRendererEntry() });
    mainWindow.loadFile(getRendererEntry());
  }

  if (isDev) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  initialWindowVisibilityTimer = setTimeout(() => {
    resolveInitialWindowVisibility({ force: true });
  }, 5000);
}

function shouldShowWindowForWhatsappState() {
  const { sessionState, qrAvailable } = runtimeState.whatsapp;

  if (qrAvailable || sessionState === 'qr_pending') {
    return true;
  }

  if (sessionState === 'connected' || sessionState === 'reconnecting') {
    return false;
  }

  return true;
}

function resolveInitialWindowVisibility({ force = false } = {}) {
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    initialWindowVisibilityResolved ||
    !windowReadyToShow
  ) {
    return;
  }

  const { sessionState, qrAvailable } = runtimeState.whatsapp;
  const hasDecisiveWhatsappState =
    qrAvailable ||
    ['qr_pending', 'connected', 'reconnecting', 'disconnected', 'dependency_error'].includes(
      sessionState,
    );

  if (!force && !hasDecisiveWhatsappState) {
    return;
  }

  initialWindowVisibilityResolved = true;

  if (initialWindowVisibilityTimer) {
    clearTimeout(initialWindowVisibilityTimer);
    initialWindowVisibilityTimer = null;
  }

  if (shouldShowWindowForWhatsappState()) {
    mainWindow.show();
    mainWindow.focus();
    return;
  }

  mainWindow.hide();
}

function emitRuntimeState() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }

  mainWindow.webContents.send('wa-addon:state-changed', runtimeState);
}

function updateWhatsappState(nextState) {
  runtimeState.whatsapp = {
    ...runtimeState.whatsapp,
    ...nextState,
  };
  resolveInitialWindowVisibility();
  if (runtimeState.whatsapp.sessionState === 'connected' && dispatchWorker) {
    void dispatchWorker.processQueue();
  }
  emitRuntimeState();
}

function updateBackendState(nextState) {
  runtimeState.backend = {
    ...runtimeState.backend,
    ...nextState,
  };
  emitRuntimeState();
}

function updateStorageState(nextState) {
  runtimeState.storage = {
    ...runtimeState.storage,
    ...nextState,
  };
  emitRuntimeState();
}

function syncRuntimeSettings(nextSettings) {
  runtimeState.settings = {
    backendUrl: nextSettings.backendUrl || '',
    backendTokenConfigured: Boolean(nextSettings.backendToken),
    autoStartEnabled: Boolean(nextSettings.autoStartEnabled),
    autoReconnectEnabled: Boolean(nextSettings.autoReconnectEnabled),
    updatedAt: nextSettings.updatedAt || null,
  };

  runtimeState.backend = {
    ...runtimeState.backend,
    configured: Boolean(nextSettings.backendUrl && nextSettings.backendToken),
    url: nextSettings.backendUrl || '',
  };
}

async function reconnectBackendConnector() {
  if (!backendConnector || !localStore) {
    return runtimeState.backend;
  }

  const localSettings = localStore.getAppSettings();
  const backendUrl = (process.env.WHATSAPP_ADDON_BACKEND_URL || localSettings.backendUrl || '').trim();
  const backendToken = (process.env.WHATSAPP_ADDON_SHARED_TOKEN || localSettings.backendToken || '').trim();

  syncRuntimeSettings({
    ...localSettings,
    backendUrl,
    backendToken,
  });

  backendConnector.configure({
    backendUrl,
    sharedToken: backendToken,
  });

  if (backendUrl && backendToken) {
    await backendConnector.connect();
  } else {
    backendConnector.disconnect();
  }

  emitRuntimeState();
  return runtimeState.backend;
}

function registerIpc() {
  ipcMain.handle('wa-addon:get-runtime-state', async () => runtimeState);
  ipcMain.handle('wa-addon:get-storage-state', async () => runtimeState.storage);
  ipcMain.handle('wa-addon:get-app-settings', async () => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.getAppSettings();
  });
  ipcMain.handle('wa-addon:update-app-settings', async (_event, payload = {}) => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    const updatedSettings = localStore.updateAppSettings(payload);
    await reconnectBackendConnector();
    return updatedSettings;
  });
  ipcMain.handle('wa-addon:reconnect-backend', async () => reconnectBackendConnector());
  ipcMain.handle('wa-addon:list-recipients', async () => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.listRecipients();
  });
  ipcMain.handle('wa-addon:create-recipient', async (_event, payload = {}) => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.createRecipient(payload);
  });
  ipcMain.handle('wa-addon:list-rules', async () => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.listRules();
  });
  ipcMain.handle('wa-addon:list-dispatch-history', async (_event, limit = 100) => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.listDispatchQueue(Number(limit));
  });
  ipcMain.handle('wa-addon:list-message-history', async (_event, limit = 100) => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.listMessageHistory(Number(limit));
  });
  ipcMain.handle('wa-addon:list-error-logs', async (_event, limit = 100) => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.listErrorLogs(Number(limit));
  });
  ipcMain.handle('wa-addon:create-rule', async (_event, payload = {}) => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    return localStore.createRule(payload);
  });
  ipcMain.handle('wa-addon:initialize-whatsapp', async () => {
    if (!whatsappSessionManager) {
      throw new Error('WhatsApp session manager no inicializado');
    }

    await whatsappSessionManager.initialize();
    return runtimeState.whatsapp;
  });
  ipcMain.handle('wa-addon:reset-whatsapp-session', async () => {
    if (!whatsappSessionManager) {
      throw new Error('WhatsApp session manager no inicializado');
    }

    await whatsappSessionManager.resetSession();
    return runtimeState.whatsapp;
  });
  ipcMain.handle('wa-addon:refresh-storage-state', async () => {
    if (!localStore) {
      throw new Error('Local store no inicializado');
    }

    localStore.refreshStats();
    return runtimeState.storage;
  });
  ipcMain.handle('wa-addon:process-dispatch-queue', async () => {
    if (!dispatchWorker) {
      throw new Error('Dispatch worker no inicializado');
    }

    await dispatchWorker.processQueue();
    return runtimeState.dispatch;
  });
}

app.on('before-quit', () => {
  allowQuit = true;
  if (suspensionBlockerId !== null) {
    powerSaveBlocker.stop(suspensionBlockerId);
  }
});

app.whenReady().then(() => {
  // Evitar que el sistema entre en suspension mientras el addon esta corriendo
  suspensionBlockerId = powerSaveBlocker.start('prevent-app-suspension');
  debugLog('powerSaveBlocker started', { id: suspensionBlockerId });

  localStore = new LocalStore({
    userDataPath: app.getPath('userData'),
    onStateChange: updateStorageState,
  });
  localStore.initialize();
  const persistedSettings = localStore.getAppSettings();
  const resolvedBackendUrl = (process.env.WHATSAPP_ADDON_BACKEND_URL || persistedSettings.backendUrl || '').trim();
  const resolvedBackendToken = (process.env.WHATSAPP_ADDON_SHARED_TOKEN || persistedSettings.backendToken || '').trim();
  syncRuntimeSettings({
    ...persistedSettings,
    backendUrl: resolvedBackendUrl,
    backendToken: resolvedBackendToken,
  });
  dispatchWorker = new DispatchWorker({
    localStore,
    whatsappSessionManager: {
      isReady: () => false,
    },
    backendConnector: {
      reportDispatchResult: async () => undefined,
    },
    onStateChange: ({ processing }) => {
      runtimeState.dispatch.sending = processing ? 1 : 0;
      runtimeState.dispatch.pending = localStore.getState().stats.queuedDispatches;
      runtimeState.dispatch.failedToday = localStore.getState().stats.errorLogs;
      emitRuntimeState();
    },
  });
  backendConnector = new BackendConnector({
    backendUrl: resolvedBackendUrl,
    sharedToken: resolvedBackendToken,
    onStateChange: updateBackendState,
    onDispatchReceived: async (detail) => {
      localStore.enqueueDispatch(detail);
      runtimeState.dispatch.pending = localStore.getState().stats.queuedDispatches;
      runtimeState.dispatch.lastDispatchAt = new Date().toISOString();
      emitRuntimeState();
      if (dispatchWorker) {
        void dispatchWorker.processQueue();
      }
    },
  });
  whatsappSessionManager = new WhatsAppSessionManager({
    userDataPath: app.getPath('userData'),
    onStateChange: updateWhatsappState,
    logger: debugLog, // Pasar logger para trazabilidad
  });
  dispatchWorker.whatsappSessionManager = whatsappSessionManager;
  dispatchWorker.backendConnector = backendConnector;
  registerIpc();
  createTrayIcon();
  createWindow();
  runtimeState.dispatch.pending = localStore.getState().stats.queuedDispatches;
  runtimeState.dispatch.failedToday = localStore.getState().stats.errorLogs;
  emitRuntimeState();
  void reconnectBackendConnector();
  void whatsappSessionManager.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    return;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
    return;
  }

  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
