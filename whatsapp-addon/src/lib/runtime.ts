import type { RuntimeState } from '../types/runtime';
import type {
  AppSettingsRecord,
  DispatchQueueRecord,
  ErrorLogRecord,
  MessageHistoryRecord,
  RecipientRecord,
  RuleRecord,
} from '../types/config';

declare global {
  interface Window {
    fatboyWhatsappAddon?: {
      getRuntimeConfig: () => {
        environment: string;
        backendUrl: string;
      };
      getRuntimeState: () => Promise<RuntimeState>;
      getStorageState: () => Promise<RuntimeState['storage']>;
      getAppSettings: () => Promise<AppSettingsRecord>;
      updateAppSettings: (payload: Partial<AppSettingsRecord>) => Promise<AppSettingsRecord>;
      reconnectBackend: () => Promise<RuntimeState['backend']>;
      listRecipients: () => Promise<RecipientRecord[]>;
      createRecipient: (payload: {
        name: string;
        phone: string;
        tags?: string[];
      }) => Promise<RecipientRecord[]>;
      listRules: () => Promise<RuleRecord[]>;
      listDispatchHistory: (limit?: number) => Promise<DispatchQueueRecord[]>;
      listMessageHistory: (limit?: number) => Promise<MessageHistoryRecord[]>;
      listErrorLogs: (limit?: number) => Promise<ErrorLogRecord[]>;
      createRule: (payload: {
        name: string;
        eventType: string;
        templateText?: string;
        recipientIds?: number[];
      }) => Promise<RuleRecord[]>;
      refreshStorageState: () => Promise<RuntimeState['storage']>;
      processDispatchQueue: () => Promise<RuntimeState['dispatch']>;
      initializeWhatsApp: () => Promise<RuntimeState['whatsapp']>;
      resetWhatsAppSession: () => Promise<RuntimeState['whatsapp']>;
      onRuntimeStateChanged: (callback: (state: RuntimeState) => void) => () => void;
    };
  }
}

export const runtimeConfig = window.fatboyWhatsappAddon?.getRuntimeConfig() ?? {
  environment: 'browser',
  backendUrl: '',
};

export async function readInitialRuntimeState(): Promise<RuntimeState> {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.getRuntimeState();
}

export async function initializeWhatsAppSession() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.initializeWhatsApp();
}

export async function refreshStorageState() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.refreshStorageState();
}

export async function listRecipients() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.listRecipients();
}

export async function getAppSettings() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.getAppSettings();
}

export async function updateAppSettings(payload: Partial<AppSettingsRecord>) {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.updateAppSettings(payload);
}

export async function reconnectBackend() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.reconnectBackend();
}

export async function createRecipient(payload: {
  name: string;
  phone: string;
  tags?: string[];
}) {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.createRecipient(payload);
}

export async function listRules() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.listRules();
}

export async function listDispatchHistory(limit = 100) {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.listDispatchHistory(limit);
}

export async function listMessageHistory(limit = 100) {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.listMessageHistory(limit);
}

export async function listErrorLogs(limit = 100) {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.listErrorLogs(limit);
}

export async function createRule(payload: {
  name: string;
  eventType: string;
  templateText?: string;
  recipientIds?: number[];
}) {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.createRule(payload);
}

export async function processDispatchQueue() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.processDispatchQueue();
}

export async function resetWhatsAppSession() {
  if (!window.fatboyWhatsappAddon) {
    throw new Error('Runtime desktop no disponible');
  }

  return window.fatboyWhatsappAddon.resetWhatsAppSession();
}

export function subscribeRuntimeState(callback: (state: RuntimeState) => void) {
  if (!window.fatboyWhatsappAddon) {
    return () => undefined;
  }

  return window.fatboyWhatsappAddon.onRuntimeStateChanged(callback);
}
