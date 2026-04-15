const fs = require('node:fs');
const path = require('node:path');

const RECONNECTABLE_CODES = new Set([
  408,
  428,
  440,
  500,
  502,
  503,
  504,
  515,
]);

class WhatsAppSessionManager {
  constructor({ userDataPath, onStateChange, logger }) {
    this.userDataPath = userDataPath;
    this.onStateChange = onStateChange;
    this.logger = typeof logger === 'function' ? logger : console.log;
    this.authDirectory = path.join(this.userDataPath, 'whatsapp-auth');
    this.socket = null;
    this.initializePromise = null;
    this.qrCodeDataUrl = null;
    this.presenceInterval = null;
    this.state = {
      sessionState: 'idle',
      phoneNumber: null,
      qrAvailable: false,
      qrCodeDataUrl: null,
      reconnecting: false,
      lastSyncAt: null,
      lastError: null,
    };
  }

  log(message, payload) {
    this.logger(`[whatsapp-session] ${message}`, payload);
  }

  getState() {
    return {
      ...this.state,
      qrCodeDataUrl: this.qrCodeDataUrl,
    };
  }

  updateState(patch) {
    this.state = {
      ...this.state,
      ...patch,
    };

    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  async initialize() {
    if (this.initializePromise) {
      return this.initializePromise;
    }

    this.initializePromise = this.startSocket().finally(() => {
      this.initializePromise = null;
    });

    return this.initializePromise;
  }

  isReady() {
    return this.state.sessionState === 'connected' && !!this.socket;
  }

  async resetSession() {
    this.log('Resetting session');
    this.updateState({
      sessionState: 'resetting',
      reconnecting: false,
      lastError: null,
    });

    this.stopPresenceHeartbeat();

    if (this.socket) {
      try {
        this.socket.end(undefined);
      } catch {
        // noop
      }
      this.socket = null;
    }

    try {
      if (fs.existsSync(this.authDirectory)) {
        fs.rmSync(this.authDirectory, { recursive: true, force: true });
      }
    } catch (error) {
      this.log('Error deleting auth directory', { error: error.message });
    }

    this.qrCodeDataUrl = null;
    this.updateState({
      sessionState: 'idle',
      phoneNumber: null,
      qrAvailable: false,
      qrCodeDataUrl: null,
      reconnecting: false,
      lastSyncAt: null,
      lastError: null,
    });

    return this.initialize();
  }

  async startSocket() {
    this.ensureAuthDirectory();
    this.log('Starting socket');

    let baileys;
    let QRCode;
    try {
      baileys = await import('@whiskeysockets/baileys');
      QRCode = await import('qrcode');
    } catch (error) {
      this.log('Dependency error', { error: error.message });
      this.updateState({
        sessionState: 'dependency_error',
        reconnecting: false,
        lastError:
          'No se pudieron cargar las dependencias de WhatsApp. Ejecuta npm install dentro de whatsapp-addon.',
      });
      return;
    }

    const {
      default: makeWASocket,
      DisconnectReason,
      fetchLatestBaileysVersion,
      useMultiFileAuthState,
    } = baileys;

    const { toDataURL } = QRCode;
    const { state, saveCreds } = await useMultiFileAuthState(this.authDirectory);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    this.log('Baileys version', { version, isLatest });

    this.updateState({
      sessionState: 'initializing',
      reconnecting: false,
      lastError: null,
    });

    const socket = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false,
      browser: ['Fatboy POS', 'Chrome', '121.0.6167.185'],
      markOnlineOnConnect: true,
      syncFullHistory: false,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: false,
    });

    this.socket = socket;

    socket.ev.on('creds.update', saveCreds);

    socket.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        this.log('QR Code received');
        this.qrCodeDataUrl = await toDataURL(qr, {
          errorCorrectionLevel: 'M',
          margin: 1,
          scale: 8,
        });
        this.updateState({
          sessionState: 'qr_pending',
          qrAvailable: true,
          qrCodeDataUrl: this.qrCodeDataUrl,
          reconnecting: false,
          lastError: null,
        });
      }

      if (connection === 'open') {
        this.log('Connection opened');
        this.qrCodeDataUrl = null;
        const activeUserId = socket.user?.id || null;
        this.updateState({
          sessionState: 'connected',
          phoneNumber: activeUserId ? String(activeUserId).split(':')[0] : this.state.phoneNumber,
          qrAvailable: false,
          qrCodeDataUrl: null,
          reconnecting: false,
          lastSyncAt: new Date().toISOString(),
          lastError: null,
        });

        try {
          await socket.sendPresenceUpdate('available');
          this.startPresenceHeartbeat();
        } catch (e) {
          this.log('Initial presence update failed', { error: e.message });
        }
      }

      if (connection === 'close') {
        this.stopPresenceHeartbeat();
        const statusCode =
          lastDisconnect?.error?.output?.statusCode ||
          lastDisconnect?.error?.data?.statusCode ||
          null;
        
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const shouldReconnect = !isLoggedOut && (statusCode === null || RECONNECTABLE_CODES.has(Number(statusCode)) || statusCode === 440);

        this.log('Connection closed', { statusCode, shouldReconnect });

        this.socket = null;
        this.updateState({
          sessionState: shouldReconnect ? 'reconnecting' : 'disconnected',
          reconnecting: shouldReconnect,
          qrAvailable: false,
          qrCodeDataUrl: null,
          lastError: shouldReconnect
            ? `Se perdio la conexion (${statusCode}). Intentando reconectar.`
            : 'La sesion de WhatsApp se cerro o caduco y requiere escaneo de nuevo.',
        });

        if (shouldReconnect) {
          setTimeout(() => {
            void this.initialize();
          }, 3000);
        }
      }
    });

    socket.ev.on('messages.upsert', (m) => {
      this.updateState({
        lastSyncAt: new Date().toISOString(),
      });
    });

  }

  startPresenceHeartbeat() {
    this.stopPresenceHeartbeat();
    this.log('Starting presence heartbeat');
    this.presenceInterval = setInterval(async () => {
      if (this.socket && this.state.sessionState === 'connected') {
        try {
          await this.socket.sendPresenceUpdate('available');
        } catch (e) {
          this.log('Presence update heartbeat failed', { error: e.message });
        }
      }
    }, 120000);
  }

  stopPresenceHeartbeat() {
    if (this.presenceInterval) {
      this.log('Stopping presence heartbeat');
      clearInterval(this.presenceInterval);
      this.presenceInterval = null;
    }
  }

  async sendTextMessage({ recipientPhone, messageText }) {
    if (!this.socket || this.state.sessionState !== 'connected') {
      throw new Error('WhatsApp no esta conectado.');
    }

    const normalizedPhone = String(recipientPhone || '').replace(/\D+/g, '');
    if (!normalizedPhone) {
      throw new Error('Numero destinatario invalido.');
    }

    const jid = `${normalizedPhone}@s.whatsapp.net`;
    this.log('Sending message to', { jid });
    
    try {
      await this.socket.sendPresenceUpdate('available');
    } catch (e) {
      // ignore
    }

    const result = await this.socket.sendMessage(jid, { text: String(messageText || '') });
    this.updateState({
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    });

    return {
      providerMessageId: result?.key?.id || null,
      jid,
    };
  }


  ensureAuthDirectory() {
    fs.mkdirSync(this.authDirectory, { recursive: true });
  }
}

module.exports = {
  WhatsAppSessionManager,
};

