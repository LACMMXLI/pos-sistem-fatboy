const fs = require('node:fs');
const path = require('node:path');

function loadSqliteModule() {
  try {
    const BetterSqlite3 = require('better-sqlite3');
    return {
      engine: 'better-sqlite3',
      createDatabase(databasePath) {
        return new BetterSqlite3(databasePath);
      },
      initializeDatabase(database) {
        database.pragma('journal_mode = WAL');
        database.pragma('foreign_keys = ON');
      },
    };
  } catch {
    try {
      const nodeSqlite = require('node:sqlite');
      return {
        engine: 'node:sqlite',
        createDatabase(databasePath) {
          const { DatabaseSync } = nodeSqlite;
          return new DatabaseSync(databasePath);
        },
        initializeDatabase(database) {
          database.exec('PRAGMA journal_mode = WAL;');
          database.exec('PRAGMA foreign_keys = ON;');
        },
      };
    } catch {
      return null;
    }
  }
}

class LocalStore {
  constructor({ userDataPath, onStateChange }) {
    this.userDataPath = userDataPath;
    this.onStateChange = onStateChange;
    this.dbDirectory = path.join(this.userDataPath, 'data');
    this.dbPath = path.join(this.dbDirectory, 'whatsapp-addon.sqlite');
    this.sqlite = loadSqliteModule();
    this.db = null;
    this.state = {
      ready: false,
      engine: this.sqlite?.engine || 'unavailable',
      databasePath: this.dbPath,
      lastInitializedAt: null,
      lastError: null,
      stats: {
        recipients: 0,
        rules: 0,
        queuedDispatches: 0,
        messageHistory: 0,
        errorLogs: 0,
      },
    };
  }

  getState() {
    return {
      ...this.state,
      stats: {
        ...this.state.stats,
      },
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

  initialize() {
    if (!this.sqlite) {
      this.updateState({
        ready: false,
        lastError:
          'SQLite no esta disponible en este runtime. Instala o reconstruye la dependencia compatible con Electron.',
      });
      return;
    }

    fs.mkdirSync(this.dbDirectory, { recursive: true });

    this.db = this.sqlite.createDatabase(this.dbPath);
    this.sqlite.initializeDatabase(this.db);

    this.createSchema();
    this.ensureDefaultSettings();
    this.refreshStats();

    this.updateState({
      ready: true,
      lastInitializedAt: new Date().toISOString(),
      lastError: null,
    });
  }

  createSchema() {
    if (!this.db) {
      throw new Error('Base de datos no inicializada');
    }

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        backend_url TEXT,
        backend_token TEXT,
        auto_start_enabled INTEGER NOT NULL DEFAULT 0,
        auto_reconnect_enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS recipients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT NOT NULL UNIQUE,
        is_active INTEGER NOT NULL DEFAULT 1,
        tags_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS recipient_groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS recipient_group_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipient_id INTEGER NOT NULL,
        group_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(recipient_id, group_id),
        FOREIGN KEY(recipient_id) REFERENCES recipients(id) ON DELETE CASCADE,
        FOREIGN KEY(group_id) REFERENCES recipient_groups(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notification_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        recipient_mode TEXT NOT NULL DEFAULT 'direct',
        recipient_config_json TEXT,
        template_text TEXT,
        schedule_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS dispatch_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispatch_id TEXT,
        event_type TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'backend',
        status TEXT NOT NULL DEFAULT 'PENDING',
        payload_json TEXT,
        available_at TEXT,
        locked_at TEXT,
        sent_at TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS message_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dispatch_id TEXT,
        recipient_phone TEXT NOT NULL,
        recipient_name TEXT,
        event_type TEXT NOT NULL,
        message_text TEXT,
        status TEXT NOT NULL,
        provider_message_id TEXT,
        error_message TEXT,
        sent_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS error_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        scope TEXT NOT NULL,
        message TEXT NOT NULL,
        details_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  ensureDefaultSettings() {
    if (!this.db) {
      return;
    }

    this.db.prepare(`
      INSERT INTO app_settings (id, backend_url, backend_token, auto_start_enabled, auto_reconnect_enabled)
      VALUES (1, NULL, NULL, 0, 1)
      ON CONFLICT(id) DO NOTHING
    `).run();
  }

  getStats() {
    if (!this.db) {
      return {
        recipients: 0,
        rules: 0,
        queuedDispatches: 0,
        messageHistory: 0,
        errorLogs: 0,
      };
    }

    const countTable = (tableName) => {
      const row = this.db.prepare(`SELECT COUNT(*) AS total FROM ${tableName}`).get();
      return Number(row?.total || 0);
    };

    const queueRow = this.db.prepare(`
      SELECT COUNT(*) AS total
      FROM dispatch_queue
      WHERE status IN ('PENDING', 'PROCESSING', 'FAILED')
    `).get();

    return {
      recipients: countTable('recipients'),
      rules: countTable('notification_rules'),
      queuedDispatches: Number(queueRow?.total || 0),
      messageHistory: countTable('message_history'),
      errorLogs: countTable('error_logs'),
    };
  }

  refreshStats() {
    this.updateState({
      stats: this.getStats(),
    });
  }

  getAppSettings() {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const row = this.db.prepare(`
      SELECT backend_url, backend_token, auto_start_enabled, auto_reconnect_enabled, updated_at
      FROM app_settings
      WHERE id = 1
      LIMIT 1
    `).get();

    return {
      backendUrl: row?.backend_url || '',
      backendToken: row?.backend_token || '',
      autoStartEnabled: Boolean(row?.auto_start_enabled),
      autoReconnectEnabled: row ? Boolean(row.auto_reconnect_enabled) : true,
      updatedAt: row?.updated_at || null,
    };
  }

  updateAppSettings(input) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const current = this.getAppSettings();
    const backendUrl = Object.prototype.hasOwnProperty.call(input || {}, 'backendUrl')
      ? String(input?.backendUrl || '').trim().replace(/\/+$/, '')
      : current.backendUrl;
    const backendToken = Object.prototype.hasOwnProperty.call(input || {}, 'backendToken')
      ? String(input?.backendToken || '').trim()
      : current.backendToken;
    const autoStartEnabled = Object.prototype.hasOwnProperty.call(input || {}, 'autoStartEnabled')
      ? Boolean(input?.autoStartEnabled)
      : current.autoStartEnabled;
    const autoReconnectEnabled = Object.prototype.hasOwnProperty.call(input || {}, 'autoReconnectEnabled')
      ? Boolean(input?.autoReconnectEnabled)
      : current.autoReconnectEnabled;

    this.db.prepare(`
      UPDATE app_settings
      SET backend_url = ?,
          backend_token = ?,
          auto_start_enabled = ?,
          auto_reconnect_enabled = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      backendUrl || null,
      backendToken || null,
      autoStartEnabled ? 1 : 0,
      autoReconnectEnabled ? 1 : 0,
    );

    return this.getAppSettings();
  }

  enqueueDispatch(detail) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const dispatchId = String(detail?.id || '').trim();
    if (!dispatchId) {
      throw new Error('El dispatch recibido no contiene id.');
    }

    const existing = this.db
      .prepare('SELECT id FROM dispatch_queue WHERE dispatch_id = ? LIMIT 1')
      .get(dispatchId);

    if (!existing) {
      this.db.prepare(`
        INSERT INTO dispatch_queue (
          dispatch_id,
          event_type,
          source,
          status,
          payload_json,
          available_at,
          created_at,
          updated_at
        ) VALUES (?, ?, 'backend', 'PENDING', ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        dispatchId,
        String(detail.type || 'UNKNOWN'),
        JSON.stringify(detail),
        new Date().toISOString(),
      );
    }

    this.refreshStats();
  }

  listRulesByEventType(eventType) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const normalizedEventType = String(eventType || '').trim().toUpperCase();
    if (!normalizedEventType) {
      return [];
    }

    const rows = this.db.prepare(`
      SELECT id, event_type, name, is_active, recipient_mode, recipient_config_json,
             template_text, schedule_json, created_at, updated_at
      FROM notification_rules
      WHERE is_active = 1 AND event_type = ?
      ORDER BY id ASC
    `).all(normalizedEventType);

    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      name: row.name,
      isActive: Boolean(row.is_active),
      recipientMode: row.recipient_mode,
      recipientConfig: row.recipient_config_json ? JSON.parse(row.recipient_config_json) : {},
      templateText: row.template_text || '',
      schedule: row.schedule_json ? JSON.parse(row.schedule_json) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  getRecipientsByIds(recipientIds) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const normalizedIds = Array.isArray(recipientIds)
      ? recipientIds.map((item) => Number(item)).filter((item) => Number.isInteger(item) && item > 0)
      : [];

    if (normalizedIds.length === 0) {
      return [];
    }

    const placeholders = normalizedIds.map(() => '?').join(', ');
    const rows = this.db.prepare(`
      SELECT id, name, phone, is_active, tags_json, created_at, updated_at
      FROM recipients
      WHERE is_active = 1 AND id IN (${placeholders})
      ORDER BY name ASC, id ASC
    `).all(...normalizedIds);

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      isActive: Boolean(row.is_active),
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  resolveDispatchRecipients(payload) {
    const directRecipients = Array.isArray(payload?.recipients)
      ? payload.recipients
          .map((item) => ({
            name: String(item?.name || '').trim(),
            phone: String(item?.phone || '').replace(/\D+/g, ''),
          }))
          .filter((item) => item.phone)
      : [];

    if (directRecipients.length > 0) {
      return directRecipients;
    }

    const rules = this.listRulesByEventType(payload?.type);
    if (rules.length === 0) {
      return [];
    }

    const seenPhones = new Set();
    const resolvedRecipients = [];

    for (const rule of rules) {
      const ruleRecipientIds = Array.isArray(rule.recipientConfig?.recipientIds)
        ? rule.recipientConfig.recipientIds
        : [];
      const recipients = this.getRecipientsByIds(ruleRecipientIds);
      for (const recipient of recipients) {
        if (!seenPhones.has(recipient.phone)) {
          seenPhones.add(recipient.phone);
          resolvedRecipients.push({
            name: recipient.name,
            phone: recipient.phone,
          });
        }
      }
    }

    return resolvedRecipients;
  }

  renderTemplateText(templateText, payload) {
    const normalizedTemplate = String(templateText || '').trim();
    if (!normalizedTemplate) {
      return '';
    }

    const context = {
      id: payload?.id ?? '',
      type: payload?.type ?? '',
      title: payload?.title ?? '',
      messageText: payload?.messageText ?? '',
      priority: payload?.priority ?? '',
      entityId: payload?.entityId ?? '',
    };

    return normalizedTemplate.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        return String(context[key] ?? '');
      }

      return '';
    });
  }

  resolveDispatchMessageText(payload) {
    const rules = this.listRulesByEventType(payload?.type);
    const ruleWithTemplate = rules.find((rule) => String(rule.templateText || '').trim());
    if (ruleWithTemplate) {
      return this.renderTemplateText(ruleWithTemplate.templateText, payload);
    }

    const directMessageText = String(payload?.messageText || '').trim();
    if (directMessageText) {
      return directMessageText;
    }

    return '';
  }

  getNextPendingDispatch() {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const row = this.db.prepare(`
      SELECT *
      FROM dispatch_queue
      WHERE status IN ('PENDING', 'FAILED')
      ORDER BY created_at ASC
      LIMIT 1
    `).get();

    if (!row) {
      return null;
    }

    return {
      ...row,
      payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    };
  }

  markDispatchProcessing(queueId) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    this.db.prepare(`
      UPDATE dispatch_queue
      SET status = 'PROCESSING',
          locked_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new Date().toISOString(), queueId);

    this.refreshStats();
  }

  markDispatchSent(queueId) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    this.db.prepare(`
      UPDATE dispatch_queue
      SET status = 'SENT',
          attempt_count = attempt_count + 1,
          sent_at = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(new Date().toISOString(), queueId);

    this.refreshStats();
  }

  markDispatchFailed(queueId, errorMessage) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    this.db.prepare(`
      UPDATE dispatch_queue
      SET status = 'FAILED',
          attempt_count = attempt_count + 1,
          last_error = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(String(errorMessage || 'Error desconocido'), queueId);

    this.refreshStats();
  }

  appendMessageHistory(entry) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    this.db.prepare(`
      INSERT INTO message_history (
        dispatch_id,
        recipient_phone,
        recipient_name,
        event_type,
        message_text,
        status,
        provider_message_id,
        error_message,
        sent_at,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      entry.dispatchId || null,
      entry.recipientPhone,
      entry.recipientName || null,
      entry.eventType,
      entry.messageText || null,
      entry.status,
      entry.providerMessageId || null,
      entry.errorMessage || null,
      entry.sentAt || null,
    );

    this.refreshStats();
  }

  appendErrorLog(scope, message, details) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    this.db.prepare(`
      INSERT INTO error_logs (scope, message, details_json, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      String(scope || 'general'),
      String(message || 'Error desconocido'),
      details ? JSON.stringify(details) : null,
    );

    this.refreshStats();
  }

  listDispatchQueue(limit = 100) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;
    const rows = this.db.prepare(`
      SELECT id, dispatch_id, event_type, source, status, payload_json, available_at, locked_at,
             sent_at, attempt_count, last_error, created_at, updated_at
      FROM dispatch_queue
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(normalizedLimit);

    return rows.map((row) => ({
      id: row.id,
      dispatchId: row.dispatch_id || null,
      eventType: row.event_type,
      source: row.source,
      status: row.status,
      payload: row.payload_json ? JSON.parse(row.payload_json) : null,
      availableAt: row.available_at || null,
      lockedAt: row.locked_at || null,
      sentAt: row.sent_at || null,
      attemptCount: Number(row.attempt_count || 0),
      lastError: row.last_error || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  listMessageHistory(limit = 100) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;
    const rows = this.db.prepare(`
      SELECT id, dispatch_id, recipient_phone, recipient_name, event_type, message_text,
             status, provider_message_id, error_message, sent_at, created_at
      FROM message_history
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(normalizedLimit);

    return rows.map((row) => ({
      id: row.id,
      dispatchId: row.dispatch_id || null,
      recipientPhone: row.recipient_phone,
      recipientName: row.recipient_name || null,
      eventType: row.event_type,
      messageText: row.message_text || '',
      status: row.status,
      providerMessageId: row.provider_message_id || null,
      errorMessage: row.error_message || null,
      sentAt: row.sent_at || null,
      createdAt: row.created_at,
    }));
  }

  listErrorLogs(limit = 100) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const normalizedLimit = Number.isInteger(limit) && limit > 0 ? limit : 100;
    const rows = this.db.prepare(`
      SELECT id, scope, message, details_json, created_at
      FROM error_logs
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `).all(normalizedLimit);

    return rows.map((row) => ({
      id: row.id,
      scope: row.scope,
      message: row.message,
      details: row.details_json ? JSON.parse(row.details_json) : null,
      createdAt: row.created_at,
    }));
  }

  listRecipients() {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const rows = this.db.prepare(`
      SELECT id, name, phone, is_active, tags_json, created_at, updated_at
      FROM recipients
      ORDER BY created_at DESC, id DESC
    `).all();

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      isActive: Boolean(row.is_active),
      tags: row.tags_json ? JSON.parse(row.tags_json) : [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  createRecipient(input) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const name = String(input?.name || '').trim();
    const phone = String(input?.phone || '').replace(/\D+/g, '');
    const tags = Array.isArray(input?.tags) ? input.tags.map((tag) => String(tag).trim()).filter(Boolean) : [];

    if (!name) {
      throw new Error('El nombre del destinatario es obligatorio.');
    }

    if (!phone) {
      throw new Error('El numero del destinatario es obligatorio.');
    }

    this.db.prepare(`
      INSERT INTO recipients (
        name,
        phone,
        is_active,
        tags_json,
        created_at,
        updated_at
      ) VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(name, phone, JSON.stringify(tags));

    this.refreshStats();
    return this.listRecipients();
  }

  listRules() {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const rows = this.db.prepare(`
      SELECT id, event_type, name, is_active, recipient_mode, recipient_config_json,
             template_text, schedule_json, created_at, updated_at
      FROM notification_rules
      ORDER BY created_at DESC, id DESC
    `).all();

    return rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      name: row.name,
      isActive: Boolean(row.is_active),
      recipientMode: row.recipient_mode,
      recipientConfig: row.recipient_config_json ? JSON.parse(row.recipient_config_json) : {},
      templateText: row.template_text || '',
      schedule: row.schedule_json ? JSON.parse(row.schedule_json) : null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  createRule(input) {
    if (!this.db) {
      throw new Error('SQLite no inicializado');
    }

    const name = String(input?.name || '').trim();
    const eventType = String(input?.eventType || '').trim().toUpperCase();
    const templateText = String(input?.templateText || '').trim();
    const recipientIds = Array.isArray(input?.recipientIds)
      ? input.recipientIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0)
      : [];

    if (!name) {
      throw new Error('El nombre de la regla es obligatorio.');
    }

    if (!eventType) {
      throw new Error('El tipo de evento es obligatorio.');
    }

    this.db.prepare(`
      INSERT INTO notification_rules (
        event_type,
        name,
        is_active,
        recipient_mode,
        recipient_config_json,
        template_text,
        schedule_json,
        created_at,
        updated_at
      ) VALUES (?, ?, 1, 'direct', ?, ?, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      eventType,
      name,
      JSON.stringify({ recipientIds }),
      templateText || null,
    );

    this.refreshStats();
    return this.listRules();
  }
}

module.exports = {
  LocalStore,
};
