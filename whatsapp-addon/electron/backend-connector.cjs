class BackendConnector {
  constructor({ backendUrl, sharedToken, onStateChange, onDispatchReceived }) {
    this.backendUrl = (backendUrl || '').replace(/\/+$/, '');
    this.sharedToken = sharedToken || '';
    this.onStateChange = onStateChange;
    this.onDispatchReceived = onDispatchReceived;
    this.socket = null;
    this.state = {
      configured: Boolean(this.backendUrl && this.sharedToken),
      url: this.backendUrl,
      socketConnected: false,
      lastHeartbeatAt: null,
      lastError: null,
    };
  }

  configure({ backendUrl, sharedToken }) {
    this.backendUrl = String(backendUrl || '').trim().replace(/\/+$/, '');
    this.sharedToken = String(sharedToken || '').trim();
    this.updateState({
      configured: Boolean(this.backendUrl && this.sharedToken),
      url: this.backendUrl,
      socketConnected: false,
      lastError: null,
    });
  }

  getState() {
    return { ...this.state };
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

  async connect() {
    if (this.socket) {
      this.disconnect();
    }

    if (!this.backendUrl || !this.sharedToken) {
      this.updateState({
        configured: false,
        socketConnected: false,
        lastError: 'Falta configurar WHATSAPP_ADDON_BACKEND_URL o WHATSAPP_ADDON_SHARED_TOKEN.',
      });
      return;
    }

    let io;
    try {
      ({ io } = await import('socket.io-client'));
    } catch {
      this.updateState({
        configured: true,
        socketConnected: false,
        lastError: 'No se pudo cargar socket.io-client. Ejecuta npm install dentro de whatsapp-addon.',
      });
      return;
    }

    this.socket = io(this.backendUrl, {
      path: '/socket.io',
      transports: ['websocket'],
      auth: {
        clientType: 'whatsapp-addon',
        sharedToken: this.sharedToken,
      },
      extraHeaders: {
        'x-addon-shared-token': this.sharedToken,
      },
    });

    this.socket.on('connect', () => {
      this.updateState({
        configured: true,
        socketConnected: true,
        lastHeartbeatAt: new Date().toISOString(),
        lastError: null,
      });
      void this.syncPendingDispatches();
    });

    this.socket.on('disconnect', () => {
      this.updateState({
        configured: true,
        socketConnected: false,
        lastError: 'Se perdio la conexion con el backend.',
      });
    });

    this.socket.on('connect_error', (error) => {
      this.updateState({
        configured: true,
        socketConnected: false,
        lastError: error?.message || 'No se pudo conectar al backend.',
      });
    });

    this.socket.on('notification.dispatch', async (payload) => {
      try {
        const dispatchId = String(payload?.dispatchId || '').trim();
        if (!dispatchId) {
          return;
        }

        const detail = await this.fetchDispatchDetail(dispatchId);
        await this.acknowledgeDispatch(dispatchId);
        this.updateState({
          lastHeartbeatAt: new Date().toISOString(),
          lastError: null,
        });

        if (typeof this.onDispatchReceived === 'function') {
          await this.onDispatchReceived(detail);
        }
      } catch (error) {
        this.updateState({
          lastError: error?.message || 'No se pudo sincronizar un dispatch del backend.',
        });
      }
    });
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.removeAllListeners();
        this.socket.disconnect();
      } catch {
        // noop
      }
      this.socket = null;
    }

    this.updateState({
      configured: Boolean(this.backendUrl && this.sharedToken),
      url: this.backendUrl,
      socketConnected: false,
    });
  }

  async fetchDispatchDetail(dispatchId) {
    const response = await fetch(`${this.backendUrl}/api/notification-dispatch/${dispatchId}`, {
      headers: {
        'x-addon-shared-token': this.sharedToken,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`No se pudo consultar el dispatch ${dispatchId}.`);
    }

    return response.json();
  }

  async acknowledgeDispatch(dispatchId) {
    const response = await fetch(`${this.backendUrl}/api/notification-dispatch/${dispatchId}/ack`, {
      method: 'POST',
      headers: {
        'x-addon-shared-token': this.sharedToken,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`No se pudo confirmar recepcion del dispatch ${dispatchId}.`);
    }

    return response.json();
  }

  async reportDispatchResult(dispatchId, result) {
    const response = await fetch(`${this.backendUrl}/api/notification-dispatch/${dispatchId}/result`, {
      method: 'POST',
      headers: {
        'x-addon-shared-token': this.sharedToken,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      throw new Error(`No se pudo reportar el resultado del dispatch ${dispatchId}.`);
    }

    return response.json();
  }

  async syncPendingDispatches() {
    const response = await fetch(`${this.backendUrl}/api/notification-dispatch/pending`, {
      headers: {
        'x-addon-shared-token': this.sharedToken,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('No se pudieron sincronizar los dispatches pendientes del backend.');
    }

    const pending = await response.json();
    for (const item of pending) {
      if (typeof this.onDispatchReceived === 'function') {
        await this.onDispatchReceived(item);
      }
    }
  }
}

module.exports = {
  BackendConnector,
};
