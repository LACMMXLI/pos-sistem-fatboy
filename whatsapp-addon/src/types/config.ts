export interface RecipientRecord {
  id: number;
  name: string;
  phone: string;
  isActive: boolean;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleRecord {
  id: number;
  name: string;
  eventType: string;
  isActive: boolean;
  recipientMode: string;
  recipientConfig: {
    recipientIds?: number[];
  };
  templateText: string;
  schedule: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettingsRecord {
  backendUrl: string;
  backendToken: string;
  autoStartEnabled: boolean;
  autoReconnectEnabled: boolean;
  updatedAt: string | null;
}

export interface DispatchQueueRecord {
  id: number;
  dispatchId: string | null;
  eventType: string;
  source: string;
  status: string;
  payload: {
    id?: string;
    type?: string;
    title?: string;
    messageText?: string;
    priority?: string;
    entityId?: number | null;
  } | null;
  availableAt: string | null;
  lockedAt: string | null;
  sentAt: string | null;
  attemptCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageHistoryRecord {
  id: number;
  dispatchId: string | null;
  recipientPhone: string;
  recipientName: string | null;
  eventType: string;
  messageText: string;
  status: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface ErrorLogRecord {
  id: number;
  scope: string;
  message: string;
  details: unknown;
  createdAt: string;
}
