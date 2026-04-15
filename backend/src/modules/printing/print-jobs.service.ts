import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreatePrintJobDto, UpdatePrintJobStatusDto } from './dto/print-job.dto';
import { PrintDataService } from './print-data.service';
import { LEGACY_PRINT_MAPPING } from './print-documents';
import { PrintRenderService } from './print-render.service';
import { PrintTemplatesService } from './print-templates.service';

@Injectable()
export class PrintJobsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templatesService: PrintTemplatesService,
    private readonly printDataService: PrintDataService,
    private readonly printRenderService: PrintRenderService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  private async createEvent(
    printJobId: string,
    payload: {
      eventType: string;
      statusFrom?: string | null;
      statusTo?: string | null;
      message?: string;
      metadata?: Record<string, unknown>;
      createdById?: number;
    },
  ) {
    await (this.prisma as any).printJobEvent.create({
      data: {
        printJobId,
        eventType: payload.eventType,
        statusFrom: payload.statusFrom,
        statusTo: payload.statusTo,
        message: payload.message,
        metadata: (payload.metadata ?? {}) as any,
        createdById: payload.createdById,
      },
    });
  }

  async createJob(dto: CreatePrintJobDto, actor?: { id: number; role: string }) {
    const paperWidth = dto.paperWidth ?? '80';
    const template = await this.templatesService.getActiveTemplate(dto.documentType, paperWidth);
    const data = await this.printDataService.getDocumentData(
      dto.documentType as any,
      dto.entityType,
      dto.entityId,
    );
    const rendered = this.printRenderService.render(template, data);

    const job = await (this.prisma as any).printJob.create({
      data: {
        documentType: dto.documentType,
        entityType: dto.entityType,
        entityId: dto.entityId,
        templateId: template.id,
        status: 'pending',
        source: dto.source ?? 'SYSTEM',
        printerName: dto.printerName ?? null,
        paperWidth,
        copies: dto.copies ?? 1,
        requestedById: actor?.id,
        payloadSnapshot: data as any,
        renderedDocument: rendered as any,
        metadata: {
          requestedRole: actor?.role ?? null,
          reprint: Boolean(dto.reprint),
        } as any,
      },
      include: {
        template: true,
      },
    });

    await this.createEvent(job.id, {
      eventType: dto.reprint ? 'REPRINT_REQUESTED' : 'JOB_CREATED',
      statusTo: 'pending',
      message: dto.reprint ? 'Trabajo generado para reimpresión' : 'Trabajo generado',
      createdById: actor?.id,
    });

    this.realtimeGateway.emitPrintJob({
      jobId: job.id,
      documentType: job.documentType,
      entityType: job.entityType,
      entityId: job.entityId,
      paperWidth: job.paperWidth,
      printerName: job.printerName,
      copies: job.copies,
      source: job.source,
    });

    return this.findOne(job.id);
  }

  async createLegacyOrderJob(
    orderId: number,
    type: 'CLIENT' | 'KITCHEN',
    options: {
      printerName?: string;
      paperWidth?: '58' | '80';
      copies?: number;
      source?: string;
    },
    actor?: { id: number; role: string },
  ) {
    return this.createJob(
      {
        documentType: LEGACY_PRINT_MAPPING[type],
        entityType: 'ORDER',
        entityId: String(orderId),
        printerName: options.printerName,
        paperWidth: options.paperWidth,
        copies: options.copies,
        source: options.source ?? 'LEGACY_API',
      },
      actor,
    );
  }

  async findAll(filters?: { status?: string; documentType?: string; take?: number }) {
    const jobs = await (this.prisma as any).printJob.findMany({
      where: {
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.documentType ? { documentType: filters.documentType } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.take ?? 100,
      include: {
        template: {
          select: {
            id: true,
            name: true,
            documentType: true,
            paperWidth: true,
            version: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return jobs;
  }

  async findOne(id: string) {
    const job = await (this.prisma as any).printJob.findUnique({
      where: { id },
      include: {
        template: true,
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          include: {
            createdBy: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!job) {
      throw new NotFoundException('Trabajo de impresión no encontrado');
    }

    return job;
  }

  async updateStatus(id: string, dto: UpdatePrintJobStatusDto, actor?: { id: number }) {
    const current = await this.findOne(id);
    const nextStatus = dto.status;
    const attempts = nextStatus === 'failed' || nextStatus === 'processing'
      ? current.attempts + 1
      : current.attempts;

    const updated = await (this.prisma as any).printJob.update({
      where: { id },
      data: {
        status: nextStatus,
        attempts,
        printerName: dto.printerName ?? current.printerName,
        lastError: nextStatus === 'failed' ? dto.message ?? 'Error de impresión' : null,
        printedAt: nextStatus === 'printed' ? new Date() : current.printedAt,
        failedAt: nextStatus === 'failed' ? new Date() : null,
        cancelledAt: nextStatus === 'cancelled' ? new Date() : null,
      },
    });

    await this.createEvent(id, {
      eventType: `JOB_${nextStatus.toUpperCase()}`,
      statusFrom: current.status,
      statusTo: nextStatus,
      message: dto.message,
      metadata: dto.metadata,
      createdById: actor?.id,
    });

    return updated;
  }

  async claimJob(id: string, actor?: { id: number }) {
    const current = await this.findOne(id);

    if (current.status !== 'pending') {
      return current;
    }

    const updated = await (this.prisma as any).printJob.updateMany({
      where: {
        id,
        status: 'pending',
      },
      data: {
        status: 'processing',
        attempts: current.attempts + 1,
      },
    });

    if (!updated.count) {
      return this.findOne(id);
    }

    await this.createEvent(id, {
      eventType: 'JOB_PROCESSING',
      statusFrom: 'pending',
      statusTo: 'processing',
      message: 'Trabajo reclamado por la cola de Electron',
      createdById: actor?.id,
    });

    return this.findOne(id);
  }

  async reprint(id: string, actor?: { id: number; role: string }) {
    const job = await this.findOne(id);

    return this.createJob(
      {
        documentType: job.documentType,
        entityType: job.entityType,
        entityId: job.entityId,
        paperWidth: (job.paperWidth as '58' | '80' | null) ?? '80',
        copies: job.copies,
        source: 'MANUAL_REPRINT',
        reprint: true,
      },
      actor,
    );
  }
}
