import { useEffect, useState } from 'react';
import type {
  AppSettingsRecord,
  DispatchQueueRecord,
  ErrorLogRecord,
  MessageHistoryRecord,
  RecipientRecord,
  RuleRecord,
} from './types/config';
import type { RuntimeState } from './types/runtime';
import {
  createRecipient,
  createRule,
  getAppSettings,
  initializeWhatsAppSession,
  listDispatchHistory,
  listErrorLogs,
  listMessageHistory,
  listRecipients,
  listRules,
  processDispatchQueue,
  readInitialRuntimeState,
  reconnectBackend,
  refreshStorageState,
  resetWhatsAppSession,
  runtimeConfig,
  subscribeRuntimeState,
  updateAppSettings,
} from './lib/runtime';

type PanelSection = 'overview' | 'whatsapp' | 'contacts' | 'rules' | 'history' | 'settings';

const sectionMeta: Record<
  PanelSection,
  {
    label: string;
    title: string;
  }
> = {
  overview: {
    label: 'Resumen general',
    title: 'Estado operativo',
  },
  whatsapp: {
    label: 'Sesion WhatsApp',
    title: 'Vinculacion y sesion',
  },
  contacts: {
    label: 'Destinatarios',
    title: 'Catalogo de destinatarios',
  },
  rules: {
    label: 'Reglas de envio',
    title: 'Asignacion por evento',
  },
  history: {
    label: 'Historial',
    title: 'Trazabilidad operativa',
  },
  settings: {
    label: 'Configuracion',
    title: 'Parametros del addon',
  },
};

const emptyState: RuntimeState = {
  appVersion: '0.0.0',
  environment: runtimeConfig.environment,
  backend: {
    configured: false,
    url: runtimeConfig.backendUrl,
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
    startedAt: null,
    hostname: 'desconocido',
    platform: 'unknown',
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

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: 'ok' | 'warn' | 'idle';
}) {
  return (
    <span className={`status-pill status-pill--${tone}`}>
      {label}
    </span>
  );
}

function QuickLink({
  label,
  detail,
  onClick,
}: {
  label: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="quick-link" onClick={onClick}>
      <strong>{label}</strong>
      <span>{detail}</span>
    </button>
  );
}

function formatTimestamp(value: string | null) {
  if (!value) {
    return 'Sin registro';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Sin registro';
  }

  return new Intl.DateTimeFormat('es-MX', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function App() {
  const [state, setState] = useState<RuntimeState>(emptyState);
  const [activeSection, setActiveSection] = useState<PanelSection>('overview');
  const [recipients, setRecipients] = useState<RecipientRecord[]>([]);
  const [rules, setRules] = useState<RuleRecord[]>([]);
  const [dispatchHistory, setDispatchHistory] = useState<DispatchQueueRecord[]>([]);
  const [messageHistory, setMessageHistory] = useState<MessageHistoryRecord[]>([]);
  const [errorLogs, setErrorLogs] = useState<ErrorLogRecord[]>([]);
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientTags, setRecipientTags] = useState('');
  const [ruleName, setRuleName] = useState('');
  const [ruleEventType, setRuleEventType] = useState('MANUAL_MESSAGE');
  const [ruleTemplateText, setRuleTemplateText] = useState('');
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettingsRecord>({
    backendUrl: '',
    backendToken: '',
    autoStartEnabled: false,
    autoReconnectEnabled: true,
    updatedAt: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    readInitialRuntimeState()
      .then((nextState) => {
        if (mounted) {
          setState(nextState);
        }
      })
      .catch(() => undefined);

    void loadConfigurationData();
    void loadAppSettings();
    void loadHistoryData();

    const unsubscribe = subscribeRuntimeState(setState);
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const backendReady = state.backend.configured && state.backend.socketConnected;
  const whatsappReady = state.whatsapp.sessionState === 'connected';
  const qrTone = state.whatsapp.qrAvailable ? 'warn' : 'idle';
  const currentSection = sectionMeta[activeSection];

  async function loadConfigurationData() {
    try {
      const [nextRecipients, nextRules] = await Promise.all([listRecipients(), listRules()]);
      setRecipients(nextRecipients);
      setRules(nextRules);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo cargar la configuracion local.');
    }
  }

  async function loadAppSettings() {
    try {
      const nextSettings = await getAppSettings();
      setAppSettings(nextSettings);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo cargar la configuracion del addon.');
    }
  }

  async function loadHistoryData() {
    try {
      const [nextDispatchHistory, nextMessageHistory, nextErrorLogs] = await Promise.all([
        listDispatchHistory(),
        listMessageHistory(),
        listErrorLogs(),
      ]);
      setDispatchHistory(nextDispatchHistory);
      setMessageHistory(nextMessageHistory);
      setErrorLogs(nextErrorLogs);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo cargar el historial local.');
    }
  }

  async function handleInitializeSession() {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await initializeWhatsAppSession();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo iniciar la sesion de WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResetSession() {
    setIsSubmitting(true);
    setActionError(null);
    try {
      await resetWhatsAppSession();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo reiniciar la sesion de WhatsApp.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRefreshStorage() {
    setActionError(null);
    try {
      await refreshStorageState();
      await loadHistoryData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo refrescar el estado de SQLite.');
    }
  }

  async function handleProcessQueue() {
    setActionError(null);
    try {
      await processDispatchQueue();
      await loadHistoryData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo procesar la cola local.');
    }
  }

  async function handleSaveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setActionError(null);
    try {
      const savedSettings = await updateAppSettings(appSettings);
      setAppSettings(savedSettings);
      await reconnectBackend();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo guardar la configuracion.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateRecipient(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    try {
      const updatedRecipients = await createRecipient({
        name: recipientName,
        phone: recipientPhone,
        tags: recipientTags
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setRecipients(updatedRecipients);
      setRecipientName('');
      setRecipientPhone('');
      setRecipientTags('');
      await refreshStorageState();
      await loadHistoryData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo guardar el destinatario.');
    }
  }

  async function handleCreateRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActionError(null);
    try {
      const updatedRules = await createRule({
        name: ruleName,
        eventType: ruleEventType,
        templateText: ruleTemplateText,
        recipientIds: selectedRecipientIds,
      });
      setRules(updatedRules);
      setRuleName('');
      setRuleTemplateText('');
      setSelectedRecipientIds([]);
      await refreshStorageState();
      await loadHistoryData();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'No se pudo guardar la regla.');
    }
  }

  function toggleRecipientSelection(recipientId: number) {
    setSelectedRecipientIds((current) =>
      current.includes(recipientId)
        ? current.filter((item) => item !== recipientId)
        : [...current, recipientId],
    );
  }

  function SectionButton({
    id,
    label,
  }: {
    id: PanelSection;
    label: string;
  }) {
    const active = activeSection === id;
    return (
      <button
        type="button"
        className={`nav-chip${active ? ' nav-chip--active' : ''}`}
        onClick={() => setActiveSection(id)}
      >
        {label}
      </button>
    );
  }

  return (
    <main className="shell">
      <section className="console-header">
        <div className="console-header__title">
          <p className="hero__eyebrow">Fatboy POS / Modulo externo</p>
          <h1>Panel de Configuracion WhatsApp</h1>
        </div>
        <div className="console-header__meta">
          <StatusPill label={whatsappReady ? 'WhatsApp listo' : 'WhatsApp pendiente'} tone={whatsappReady ? 'ok' : 'warn'} />
          <StatusPill label={backendReady ? 'Backend listo' : 'Backend pendiente'} tone={backendReady ? 'ok' : 'warn'} />
          <StatusPill label={state.storage.ready ? 'SQLite listo' : 'SQLite pendiente'} tone={state.storage.ready ? 'ok' : 'warn'} />
          <span>{state.runtime.hostname}</span>
          <span>v{state.appVersion}</span>
        </div>
      </section>

      <section className="workspace">
        <aside className="sidebar">
          <div className="sidebar__header">
            <p className="card__eyebrow">Navegacion</p>
            <strong>Modulos</strong>
          </div>
          <SectionButton id="overview" label="Resumen general" />
          <SectionButton id="whatsapp" label="Sesion WhatsApp" />
          <SectionButton id="contacts" label="Destinatarios" />
          <SectionButton id="rules" label="Reglas de envio" />
          <SectionButton id="history" label="Historial" />
          <SectionButton id="settings" label="Configuracion" />
        </aside>

        <div className="workspace__content">
          {activeSection === 'overview' ? (
            <section className="section-toolbar section-toolbar--home">
              <p className="section-toolbar__title">Inicio</p>
              <p className="section-toolbar__copy">Sesion, QR y accesos rapidos.</p>
            </section>
          ) : (
            <section className="section-toolbar">
              <p className="section-toolbar__title">{currentSection.title}</p>
              <div className="section-toolbar__meta">
                <span>{currentSection.label}</span>
                <span>{state.runtime.hostname}</span>
              </div>
            </section>
          )}

          <section className="panel-page">
          {activeSection === 'overview' ? (
            <section className="grid grid--home">
              <article className="card home-focus-card">
                <header className="card__header">
                  <div>
                    <p className="card__eyebrow">Sesion principal</p>
                    <h2>{whatsappReady ? 'WhatsApp operativo' : 'Vincular WhatsApp'}</h2>
                  </div>
                  <StatusPill
                    label={whatsappReady ? 'Listo' : state.whatsapp.qrAvailable ? 'QR activo' : 'Pendiente'}
                    tone={whatsappReady ? 'ok' : 'warn'}
                  />
                </header>
                <div className="session-panel">
                  <div className="session-panel__controls">
                    <button
                      className="action-button"
                      type="button"
                      onClick={handleInitializeSession}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Procesando...' : 'Iniciar o reconectar'}
                    </button>
                    <button
                      className="action-button action-button--secondary"
                      type="button"
                      onClick={() => setActiveSection('whatsapp')}
                    >
                      Abrir vista WhatsApp
                    </button>
                  </div>

                  {actionError ? <p className="inline-error">{actionError}</p> : null}

                  {state.whatsapp.qrCodeDataUrl ? (
                    <div className="qr-block qr-block--home">
                      <div className="qr-block__image">
                        <img src={state.whatsapp.qrCodeDataUrl} alt="QR para conectar WhatsApp" />
                      </div>
                      <div className="qr-block__copy">
                        <p className="card__eyebrow">Escaneo requerido</p>
                        <p>Escanea este QR desde la cuenta que usara el modulo.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="home-summary-list">
                      <div className="home-summary-item">
                        <span>Numero</span>
                        <strong>{state.whatsapp.phoneNumber || 'Sin vincular'}</strong>
                      </div>
                    </div>
                  )}
                </div>
              </article>

              <article className="card home-actions-card">
                <header className="card__header">
                  <div>
                    <p className="card__eyebrow">Accesos directos</p>
                    <h2>Vistas principales</h2>
                  </div>
                </header>
                <div className="quick-links">
                  <QuickLink
                    label="Sesion WhatsApp"
                    detail="QR y reconexion"
                    onClick={() => setActiveSection('whatsapp')}
                  />
                  <QuickLink
                    label="Destinatarios"
                    detail="Telefonos"
                    onClick={() => setActiveSection('contacts')}
                  />
                  <QuickLink
                    label="Reglas de envio"
                    detail="Eventos"
                    onClick={() => setActiveSection('rules')}
                  />
                  <QuickLink
                    label="Historial"
                    detail="Cola y mensajes"
                    onClick={() => setActiveSection('history')}
                  />
                  <QuickLink
                    label="Configuracion"
                    detail="Backend"
                    onClick={() => setActiveSection('settings')}
                  />
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'whatsapp' ? (
            <section className="grid grid--single">
              <article className="card card--wide">
                <header className="card__header">
                  <div>
              <p className="card__eyebrow">Sesion WhatsApp</p>
                    <h2>Estado, vinculacion y control</h2>
                  </div>
                  <StatusPill
                    label={state.whatsapp.qrAvailable ? 'QR disponible' : 'QR no generado'}
                    tone={qrTone}
                  />
                </header>
                <dl className="definition-list definition-list--dense">
                  <div>
                    <dt>Estado</dt>
                    <dd>{state.whatsapp.sessionState}</dd>
                  </div>
                  <div>
                    <dt>Numero vinculado</dt>
                    <dd>{state.whatsapp.phoneNumber || 'Pendiente de vincular'}</dd>
                  </div>
                  <div>
                    <dt>Reconectando</dt>
                    <dd>{state.whatsapp.reconnecting ? 'Si' : 'No'}</dd>
                  </div>
                  <div>
                    <dt>Ultima sincronizacion</dt>
                    <dd>{formatTimestamp(state.whatsapp.lastSyncAt)}</dd>
                  </div>
                  <div>
                    <dt>Ultimo error</dt>
                    <dd>{state.whatsapp.lastError || 'Sin error reciente'}</dd>
                  </div>
                </dl>
                <div className="session-panel">
                  <div className="session-panel__controls">
                    <button
                      className="action-button"
                      type="button"
                      onClick={handleInitializeSession}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? 'Procesando...' : 'Iniciar o reconectar'}
                    </button>
                    <button
                      className="action-button action-button--secondary"
                      type="button"
                      onClick={handleResetSession}
                      disabled={isSubmitting}
                    >
                      Regenerar sesion
                    </button>
                  </div>

                  {actionError ? <p className="inline-error">{actionError}</p> : null}

                  {state.whatsapp.qrCodeDataUrl ? (
                    <div className="qr-block qr-block--compact">
                      <div className="qr-block__image">
                        <img src={state.whatsapp.qrCodeDataUrl} alt="QR para conectar WhatsApp" />
                      </div>
                      <div className="qr-block__copy">
                        <p className="card__eyebrow">Escaneo requerido</p>
                        <p>
                          Abre WhatsApp en el telefono, entra a dispositivos vinculados y escanea este codigo QR.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="empty-panel">
                      <p className="card__eyebrow">QR</p>
                      <p>El QR aparecera aqui cuando Baileys lo genere.</p>
                    </div>
                  )}
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'contacts' ? (
            <section className="grid grid--single">
              <article className="card">
          <header className="card__header">
            <div>
              <p className="card__eyebrow">Destinatarios</p>
              <h2>Registro y libreta operativa</h2>
            </div>
          </header>
          <div className="config-layout">
            <form className="config-form" onSubmit={handleCreateRecipient}>
              <label className="field">
                <span>Nombre</span>
                <input value={recipientName} onChange={(event) => setRecipientName(event.target.value)} />
              </label>
              <label className="field">
                <span>Telefono</span>
                <input value={recipientPhone} onChange={(event) => setRecipientPhone(event.target.value)} />
              </label>
              <label className="field">
                <span>Etiquetas internas</span>
                <input
                  value={recipientTags}
                  onChange={(event) => setRecipientTags(event.target.value)}
                  placeholder="gerencia,fraude,cortes"
                />
              </label>
              <button className="action-button" type="submit">
                Registrar destinatario
              </button>
            </form>
          <div className="config-list">
            {recipients.length === 0 ? (
              <p className="empty-copy">Todavia no hay destinatarios registrados.</p>
            ) : (
              recipients.map((recipient) => (
                <article key={recipient.id} className="config-item">
                  <strong>{recipient.name}</strong>
                  <span>{recipient.phone}</span>
                  <small>{recipient.tags.join(', ') || 'Sin etiquetas'}</small>
                </article>
              ))
            )}
          </div>
          </div>
        </article>
            </section>
          ) : null}

          {activeSection === 'rules' ? (
            <section className="grid grid--single">
              <article className="card">
          <header className="card__header">
            <div>
              <p className="card__eyebrow">Reglas</p>
              <h2>Asignacion de mensajes por evento</h2>
            </div>
          </header>
          <div className="config-layout">
            <form className="config-form" onSubmit={handleCreateRule}>
              <label className="field">
                <span>Nombre de la regla</span>
                <input value={ruleName} onChange={(event) => setRuleName(event.target.value)} />
              </label>
              <label className="field">
                <span>Tipo de evento</span>
                <select value={ruleEventType} onChange={(event) => setRuleEventType(event.target.value)}>
                  <option value="MANUAL_MESSAGE">MANUAL_MESSAGE</option>
                  <option value="SHIFT_CLOSED">SHIFT_CLOSED</option>
                  <option value="DAILY_SUMMARY">DAILY_SUMMARY</option>
                  <option value="FRAUD_ALERT">FRAUD_ALERT</option>
                  <option value="SYSTEM_ALERT">SYSTEM_ALERT</option>
                </select>
              </label>
              <label className="field">
                <span>Mensaje base</span>
                <textarea
                  value={ruleTemplateText}
                  onChange={(event) => setRuleTemplateText(event.target.value)}
                  rows={4}
                />
              </label>
              <div className="field">
                <span>Destinatarios asignados</span>
                <div className="checkbox-grid">
                  {recipients.length === 0 ? (
                    <p className="empty-copy">Primero agrega destinatarios.</p>
                  ) : (
                    recipients.map((recipient) => (
                      <label key={recipient.id} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={selectedRecipientIds.includes(recipient.id)}
                          onChange={() => toggleRecipientSelection(recipient.id)}
                        />
                        <span>{recipient.name}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>
              <button className="action-button" type="submit">
                Registrar regla
              </button>
            </form>
          <div className="config-list">
            {rules.length === 0 ? (
              <p className="empty-copy">Todavia no hay reglas registradas.</p>
            ) : (
              rules.map((rule) => (
                <article key={rule.id} className="config-item">
                  <strong>{rule.name}</strong>
                  <span>{rule.eventType}</span>
                  <small>{rule.templateText || 'Sin plantilla base'}</small>
                </article>
              ))
            )}
          </div>
          </div>
        </article>
            </section>
          ) : null}

          {activeSection === 'history' ? (
            <section className="grid grid--single">
              <article className="card">
                <header className="card__header">
                  <div>
                    <p className="card__eyebrow">Historial</p>
                    <h2>Recepcion desde backend y envios por WhatsApp</h2>
                  </div>
                  <div className="session-panel__controls">
                    <button
                      className="action-button action-button--secondary"
                      type="button"
                      onClick={() => void loadHistoryData()}
                    >
                      Refrescar historial
                    </button>
                  </div>
                </header>

                <div className="history-stack">
                  <section className="history-card">
                    <div className="history-card__header">
                      <div>
                        <p className="card__eyebrow">Dispatches recibidos</p>
                        <h3>Cola local del addon</h3>
                      </div>
                      <span>{dispatchHistory.length} registros</span>
                    </div>
                    {dispatchHistory.length === 0 ? (
                      <p className="empty-copy">Todavia no han llegado dispatches desde backend.</p>
                    ) : (
                      <div className="history-list">
                        {dispatchHistory.map((item) => (
                          <article key={item.id} className="history-item">
                            <div className="history-item__top">
                              <strong>{item.payload?.title || item.eventType}</strong>
                              <StatusPill
                                label={item.status}
                                tone={item.status === 'SENT' ? 'ok' : item.status === 'FAILED' ? 'warn' : 'idle'}
                              />
                            </div>
                            <p>{item.payload?.messageText || 'Sin mensaje directo en payload.'}</p>
                            <div className="history-item__meta">
                              <span>Evento: {item.eventType}</span>
                              <span>Intentos: {item.attemptCount}</span>
                              <span>Creado: {formatTimestamp(item.createdAt)}</span>
                              <span>Enviado: {formatTimestamp(item.sentAt)}</span>
                            </div>
                            {item.lastError ? <small>Error: {item.lastError}</small> : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="history-card">
                    <div className="history-card__header">
                      <div>
                        <p className="card__eyebrow">Mensajes enviados</p>
                        <h3>Historial de WhatsApp</h3>
                      </div>
                      <span>{messageHistory.length} registros</span>
                    </div>
                    {messageHistory.length === 0 ? (
                      <p className="empty-copy">Todavia no hay mensajes enviados o fallidos registrados.</p>
                    ) : (
                      <div className="history-list">
                        {messageHistory.map((item) => (
                          <article key={item.id} className="history-item">
                            <div className="history-item__top">
                              <strong>{item.recipientName || item.recipientPhone}</strong>
                              <StatusPill
                                label={item.status}
                                tone={item.status === 'SENT' ? 'ok' : item.status === 'FAILED' ? 'warn' : 'idle'}
                              />
                            </div>
                            <p>{item.messageText || 'Sin texto almacenado.'}</p>
                            <div className="history-item__meta">
                              <span>Telefono: {item.recipientPhone}</span>
                              <span>Evento: {item.eventType}</span>
                              <span>Fecha: {formatTimestamp(item.sentAt || item.createdAt)}</span>
                            </div>
                            {item.errorMessage ? <small>Error: {item.errorMessage}</small> : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="history-card">
                    <div className="history-card__header">
                      <div>
                        <p className="card__eyebrow">Errores internos</p>
                        <h3>Bitacora del addon</h3>
                      </div>
                      <span>{errorLogs.length} registros</span>
                    </div>
                    {errorLogs.length === 0 ? (
                      <p className="empty-copy">Sin errores registrados recientemente.</p>
                    ) : (
                      <div className="history-list">
                        {errorLogs.map((item) => (
                          <article key={item.id} className="history-item">
                            <div className="history-item__top">
                              <strong>{item.scope}</strong>
                              <span>{formatTimestamp(item.createdAt)}</span>
                            </div>
                            <p>{item.message}</p>
                            {item.details ? <small>{JSON.stringify(item.details)}</small> : null}
                          </article>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              </article>
            </section>
          ) : null}

          {activeSection === 'settings' ? (
            <section className="grid grid--single">
              <article className="card">
                <header className="card__header">
                  <div>
                    <p className="card__eyebrow">Configuracion</p>
                    <h2>Parametros generales del modulo</h2>
                  </div>
                </header>
                <div className="settings-grid">
                  <article className="settings-card">
                    <p className="card__eyebrow">Conexion base</p>
                    <form className="config-form" onSubmit={handleSaveSettings}>
                      <label className="field">
                        <span>Backend URL</span>
                        <input
                          value={appSettings.backendUrl}
                          onChange={(event) =>
                            setAppSettings((current) => ({
                              ...current,
                              backendUrl: event.target.value,
                            }))
                          }
                          placeholder="http://127.0.0.1:3000"
                        />
                      </label>
                      <label className="field">
                        <span>Token compartido</span>
                        <input
                          type="password"
                          value={appSettings.backendToken}
                          onChange={(event) =>
                            setAppSettings((current) => ({
                              ...current,
                              backendToken: event.target.value,
                            }))
                          }
                          placeholder="fatboy_whatsapp_addon_local_token"
                        />
                      </label>
                      <div className="session-panel__controls">
                        <button className="action-button" type="submit" disabled={isSubmitting}>
                          {isSubmitting ? 'Guardando...' : 'Guardar conexion'}
                        </button>
                        <button
                          className="action-button action-button--secondary"
                          type="button"
                          onClick={() => void reconnectBackend()}
                        >
                          Reconectar
                        </button>
                      </div>
                    </form>
                  </article>

                  <article className="settings-card">
                    <p className="card__eyebrow">Operacion local</p>
                    <dl className="definition-list">
                      <div>
                        <dt>Bandeja del sistema</dt>
                        <dd>{state.runtime.trayEnabled ? 'Activa' : 'Inactiva'}</dd>
                      </div>
                      <div>
                        <dt>Base local</dt>
                        <dd>{state.storage.databasePath || 'Sin archivo'}</dd>
                      </div>
                      <div>
                        <dt>Inicializacion</dt>
                        <dd>{formatTimestamp(state.storage.lastInitializedAt)}</dd>
                      </div>
                    </dl>
                  </article>

                  <article className="settings-card">
                    <p className="card__eyebrow">Estado de cola</p>
                    <dl className="definition-list">
                      <div>
                        <dt>Pendientes</dt>
                        <dd>{state.dispatch.pending}</dd>
                      </div>
                      <div>
                        <dt>Enviando</dt>
                        <dd>{state.dispatch.sending}</dd>
                      </div>
                      <div>
                        <dt>Fallidos hoy</dt>
                        <dd>{state.dispatch.failedToday}</dd>
                      </div>
                    </dl>
                  </article>

                  <article className="settings-card">
                    <p className="card__eyebrow">Acciones</p>
                    <div className="session-panel__controls">
                      <button
                        className="action-button action-button--secondary"
                        type="button"
                        onClick={handleRefreshStorage}
                      >
                        Refrescar estado local
                      </button>
                      <button
                        className="action-button action-button--secondary"
                        type="button"
                        onClick={handleProcessQueue}
                      >
                        Procesar cola
                      </button>
                    </div>
                    {actionError ? <p className="inline-error">{actionError}</p> : null}
                  </article>
                </div>
              </article>
            </section>
          ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
