const os = require('node:os');
const path = require('node:path');

const { BackendConnector } = require('../electron/backend-connector.cjs');
const { DispatchWorker } = require('../electron/dispatch-worker.cjs');
const { LocalStore } = require('../electron/local-store.cjs');
const { WhatsAppSessionManager } = require('../electron/whatsapp-session-manager.cjs');

const APP_NAME = 'Fatboy WhatsApp Addon';

function resolveUserDataPath() {
  const customPath = String(process.env.WHATSAPP_ADDON_USER_DATA_PATH || '').trim();
  if (customPath) {
    return path.resolve(customPath);
  }

  if (process.platform === 'win32') {
    const appData =
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
    return path.join(appData, APP_NAME);
  }

  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', APP_NAME);
  }

  const xdgConfigHome =
    process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(xdgConfigHome, APP_NAME);
}

const runtimeState = {
  startedAt: new Date().toISOString(),
  userDataPath: resolveUserDataPath(),
  backend: {
    configured: false,
    url: '',
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
};

let backendConnector = null;
let dispatchWorker = null;
let localStore = null;
let whatsappSessionManager = null;
let localStoreAvailable = false;

function log(event, payload) {
  const timestamp = new Date().toISOString();
  if (payload === undefined) {
    console.log(`[${timestamp}] ${event}`);
    return;
  }

  console.log(`[${timestamp}] ${event}`, payload);
}

function updateWhatsappState(nextState) {
  runtimeState.whatsapp = {
    ...runtimeState.whatsapp,
    ...nextState,
  };

  log('whatsapp.state', runtimeState.whatsapp);

  if (
    runtimeState.whatsapp.sessionState === 'connected' &&
    dispatchWorker &&
    localStoreAvailable
  ) {
    void dispatchWorker.processQueue();
  }
}

function updateBackendState(nextState) {
  runtimeState.backend = {
    ...runtimeState.backend,
    ...nextState,
  };

  log('backend.state', runtimeState.backend);
}

function updateStorageState(nextState) {
  runtimeState.storage = {
    ...runtimeState.storage,
    ...nextState,
  };

  runtimeState.dispatch.pending = runtimeState.storage.stats.queuedDispatches;
  runtimeState.dispatch.failedToday = runtimeState.storage.stats.errorLogs;

  log('storage.state', {
    ready: runtimeState.storage.ready,
    engine: runtimeState.storage.engine,
    databasePath: runtimeState.storage.databasePath,
    stats: runtimeState.storage.stats,
    lastError: runtimeState.storage.lastError,
  });
}

async function reconnectBackendConnector() {
  if (!backendConnector || !localStoreAvailable || !localStore) {
    return;
  }

  const localSettings = localStore.getAppSettings();
  const backendUrl = (
    process.env.WHATSAPP_ADDON_BACKEND_URL ||
    localSettings.backendUrl ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const sharedToken = (
    process.env.WHATSAPP_ADDON_SHARED_TOKEN ||
    localSettings.backendToken ||
    ''
  ).trim();

  backendConnector.configure({
    backendUrl,
    sharedToken,
  });

  if (backendUrl && sharedToken) {
    await backendConnector.connect();
  } else {
    log(
      'backend.config',
      'Sin backend configurado. El proceso probara solo la sesion local de WhatsApp.',
    );
    backendConnector.disconnect();
  }
}

function printSummary() {
  log('runtime.summary', {
    startedAt: runtimeState.startedAt,
    userDataPath: runtimeState.userDataPath,
    authDirectory: path.join(runtimeState.userDataPath, 'whatsapp-auth'),
    databasePath: runtimeState.storage.databasePath,
  });
}

async function main() {
  printSummary();

  localStore = new LocalStore({
    userDataPath: runtimeState.userDataPath,
    onStateChange: updateStorageState,
  });
  try {
    localStore.initialize();
    localStoreAvailable = true;
  } catch (error) {
    localStoreAvailable = false;
    runtimeState.storage = {
      ...runtimeState.storage,
      ready: false,
      engine: 'unavailable',
      databasePath: path.join(runtimeState.userDataPath, 'data', 'whatsapp-addon.sqlite'),
      lastInitializedAt: null,
      lastError: error?.message || String(error),
    };
    log(
      'storage.warning',
      'SQLite no pudo inicializarse en Node. La prueba seguira en modo solo-WhatsApp.',
    );
    log('storage.error', runtimeState.storage.lastError);
  }

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
      if (localStoreAvailable) {
        runtimeState.dispatch.pending = localStore.getState().stats.queuedDispatches;
        runtimeState.dispatch.failedToday = localStore.getState().stats.errorLogs;
      }
      log('dispatch.state', runtimeState.dispatch);
    },
  });

  backendConnector = new BackendConnector({
    backendUrl: '',
    sharedToken: '',
    onStateChange: updateBackendState,
    onDispatchReceived: async (detail) => {
      if (!localStoreAvailable) {
        log(
          'dispatch.skipped',
          'Se recibio un dispatch pero SQLite no esta disponible en este modo Node.',
        );
        return;
      }

      localStore.enqueueDispatch(detail);
      runtimeState.dispatch.pending = localStore.getState().stats.queuedDispatches;
      runtimeState.dispatch.lastDispatchAt = new Date().toISOString();
      log('dispatch.received', {
        dispatchId: detail?.id || null,
        type: detail?.type || null,
      });
      if (dispatchWorker) {
        void dispatchWorker.processQueue();
      }
    },
  });

  whatsappSessionManager = new WhatsAppSessionManager({
    userDataPath: runtimeState.userDataPath,
    onStateChange: updateWhatsappState,
  });

  dispatchWorker.whatsappSessionManager = whatsappSessionManager;
  dispatchWorker.backendConnector = backendConnector;

  await reconnectBackendConnector();
  await whatsappSessionManager.initialize();

  process.on('SIGINT', () => {
    log('shutdown', 'SIGINT recibido. Cerrando proceso headless.');
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('shutdown', 'SIGTERM recibido. Cerrando proceso headless.');
    process.exit(0);
  });
}

main().catch((error) => {
  log('fatal', error?.stack || error?.message || String(error));
  process.exit(1);
});
