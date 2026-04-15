import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateNotificationDispatchDto } from './dto/create-notification-dispatch.dto';
import { DispatchResultDto } from './dto/dispatch-result.dto';

type DispatchStatus =
  | 'PENDING'
  | 'ACKNOWLEDGED'
  | 'PROCESSING'
  | 'SENT'
  | 'FAILED'
  | 'CANCELLED';

export interface NotificationDispatchRecord {
  id: string;
  type: string;
  title: string;
  messageText: string;
  recipients: Array<{ name: string; phone: string }>;
  priority: string;
  entityId: number | null;
  requiresAttachment: boolean;
  status: DispatchStatus;
  source: 'manual';
  attemptCount: number;
  providerMessageId: string | null;
  lastError: string | null;
  ackAt: string | null;
  sentAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class NotificationDispatchService {
  private readonly dispatches = new Map<string, NotificationDispatchRecord>();

  constructor(private readonly realtimeGateway: RealtimeGateway) {}

  createManualDispatch(dto: CreateNotificationDispatchDto) {
    const now = new Date().toISOString();
    const dispatch: NotificationDispatchRecord = {
      id: randomUUID(),
      type: dto.type,
      title: dto.title,
      messageText: dto.messageText || '',
      recipients: dto.recipients || [],
      priority: dto.priority || 'normal',
      entityId: dto.entityId ?? null,
      requiresAttachment: dto.requiresAttachment ?? false,
      status: 'PENDING',
      source: 'manual',
      attemptCount: 0,
      providerMessageId: null,
      lastError: null,
      ackAt: null,
      sentAt: null,
      createdAt: now,
      updatedAt: now,
    };

    this.dispatches.set(dispatch.id, dispatch);
    this.realtimeGateway.emitNotificationDispatch({
      dispatchId: dispatch.id,
      type: dispatch.type,
      entityId: dispatch.entityId,
      priority: dispatch.priority,
      createdAt: dispatch.createdAt,
      requiresAttachment: dispatch.requiresAttachment,
    });

    return dispatch;
  }

  findPending() {
    return Array.from(this.dispatches.values()).filter((item) =>
      ['PENDING', 'ACKNOWLEDGED', 'PROCESSING'].includes(item.status),
    );
  }

  findOne(id: string) {
    const dispatch = this.dispatches.get(id);
    if (!dispatch) {
      throw new NotFoundException(`No se encontró el dispatch ${id}`);
    }

    return dispatch;
  }

  acknowledge(id: string) {
    const dispatch = this.findOne(id);
    const next = {
      ...dispatch,
      status: dispatch.status === 'PENDING' ? 'ACKNOWLEDGED' : dispatch.status,
      ackAt: dispatch.ackAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.dispatches.set(id, next);
    return next;
  }

  registerResult(id: string, dto: DispatchResultDto) {
    const dispatch = this.findOne(id);
    const normalizedStatus = String(dto.status || '').toLowerCase();
    const status: DispatchStatus = normalizedStatus === 'sent' ? 'SENT' : 'FAILED';
    const next = {
      ...dispatch,
      status,
      providerMessageId: dto.providerMessageId || dispatch.providerMessageId,
      attemptCount: dto.attempts ?? Math.max(dispatch.attemptCount, 1),
      lastError: dto.error || null,
      sentAt: status === 'SENT' ? new Date().toISOString() : dispatch.sentAt,
      updatedAt: new Date().toISOString(),
    };

    this.dispatches.set(id, next);
    return next;
  }
}
