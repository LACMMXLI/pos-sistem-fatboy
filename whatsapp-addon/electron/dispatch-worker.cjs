class DispatchWorker {
  constructor({
    localStore,
    whatsappSessionManager,
    backendConnector,
    onStateChange,
  }) {
    this.localStore = localStore;
    this.whatsappSessionManager = whatsappSessionManager;
    this.backendConnector = backendConnector;
    this.onStateChange = onStateChange;
    this.processing = false;
  }

  getState() {
    return {
      processing: this.processing,
    };
  }

  emitState() {
    if (typeof this.onStateChange === 'function') {
      this.onStateChange(this.getState());
    }
  }

  async processQueue() {
    if (this.processing) {
      return;
    }

    if (!this.whatsappSessionManager?.isReady()) {
      return;
    }

    this.processing = true;
    this.emitState();

    try {
      while (true) {
        const nextItem = this.localStore.getNextPendingDispatch();
        if (!nextItem) {
          break;
        }

        await this.processSingleDispatch(nextItem);
      }
    } finally {
      this.processing = false;
      this.emitState();
    }
  }

  async processSingleDispatch(queueItem) {
    this.localStore.markDispatchProcessing(queueItem.id);

    const payload = queueItem.payload || {};
    const recipients = this.localStore.resolveDispatchRecipients(payload);
    const messageText = this.localStore.resolveDispatchMessageText(payload);

    try {
      if (recipients.length === 0) {
        throw new Error('No hay destinatarios resueltos para este dispatch.');
      }

      if (!String(messageText || '').trim()) {
        throw new Error('No hay mensaje disponible para este dispatch.');
      }

      for (const recipient of recipients) {
        const sendResult = await this.whatsappSessionManager.sendTextMessage({
          recipientPhone: recipient.phone,
          messageText,
        });

        this.localStore.appendMessageHistory({
          dispatchId: payload.id || queueItem.dispatch_id,
          recipientPhone: recipient.phone,
          recipientName: recipient.name || null,
          eventType: payload.type || queueItem.event_type,
          messageText,
          status: 'SENT',
          providerMessageId: sendResult.providerMessageId,
          errorMessage: null,
          sentAt: new Date().toISOString(),
        });
      }

      this.localStore.markDispatchSent(queueItem.id);

      if (payload.id) {
        await this.backendConnector.reportDispatchResult(payload.id, {
          status: 'sent',
          attempts: Number(queueItem.attempt_count || 0) + 1,
          error: null,
        });
      }
    } catch (error) {
      const message = error?.message || 'No se pudo enviar el dispatch.';

      this.localStore.markDispatchFailed(queueItem.id, message);
      this.localStore.appendErrorLog('dispatch-worker', message, {
        dispatchId: payload.id || queueItem.dispatch_id || null,
        queueId: queueItem.id,
      });

      this.localStore.appendMessageHistory({
        dispatchId: payload.id || queueItem.dispatch_id,
        recipientPhone: (recipients[0]?.phone || 'unknown'),
        recipientName: recipients[0]?.name || null,
        eventType: payload.type || queueItem.event_type,
        messageText,
        status: 'FAILED',
        providerMessageId: null,
        errorMessage: message,
        sentAt: null,
      });

      if (payload.id) {
        try {
          await this.backendConnector.reportDispatchResult(payload.id, {
            status: 'failed',
            attempts: Number(queueItem.attempt_count || 0) + 1,
            error: message,
          });
        } catch (reportError) {
          this.localStore.appendErrorLog(
            'dispatch-worker',
            reportError?.message || 'No se pudo reportar el fallo al backend.',
            { dispatchId: payload.id || null },
          );
        }
      }
    }
  }
}

module.exports = {
  DispatchWorker,
};
