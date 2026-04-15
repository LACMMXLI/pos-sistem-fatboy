export interface RuntimeState {
  appVersion: string;
  environment: string;
  backend: {
    configured: boolean;
    url: string;
    socketConnected: boolean;
    lastHeartbeatAt: string | null;
    lastError: string | null;
  };
  whatsapp: {
    sessionState: 'idle' | 'qr_pending' | 'connected' | 'reconnecting' | string;
    phoneNumber: string | null;
    qrAvailable: boolean;
    qrCodeDataUrl: string | null;
    reconnecting: boolean;
    lastSyncAt: string | null;
    lastError: string | null;
  };
  dispatch: {
    pending: number;
    sending: number;
    failedToday: number;
    lastDispatchAt: string | null;
  };
  storage: {
    ready: boolean;
    engine: string;
    databasePath: string;
    lastInitializedAt: string | null;
    lastError: string | null;
    stats: {
      recipients: number;
      rules: number;
      queuedDispatches: number;
      messageHistory: number;
      errorLogs: number;
    };
  };
  runtime: {
    startedAt: string | null;
    hostname: string;
    platform: string;
    trayEnabled: boolean;
  };
  settings: {
    backendUrl: string;
    backendTokenConfigured: boolean;
    autoStartEnabled: boolean;
    autoReconnectEnabled: boolean;
    updatedAt: string | null;
  };
}
