import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { CashShiftReportPdfService } from './cash-shift-report-pdf.service';
import nodemailer, { type SendMailOptions } from 'nodemailer';

type SendShiftEmailOptions = {
  to?: string | null;
  cc?: string | null;
};

type ShiftEmailConfigOverrides = {
  enabled?: boolean;
  host?: string | null;
  port?: number | null;
  secure?: boolean;
  user?: string | null;
  password?: string | null;
  from?: string | null;
  to?: string | null;
  cc?: string | null;
};

@Injectable()
export class CashShiftEmailService {
  private readonly logger = new Logger(CashShiftEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
    private readonly reportPdfService: CashShiftReportPdfService,
  ) {}

  async sendShiftReportEmail(shiftId: number, report: any, options?: SendShiftEmailOptions) {
    const settings = await this.resolveEmailConfig();
    const to = this.normalizeRecipients(options?.to ?? settings.to);
    const cc = this.normalizeRecipients(options?.cc ?? settings.cc);
    const enabled = Boolean(settings.enabled);

    if (!enabled) {
      return {
        attempted: false,
        sent: false,
        message: 'El envio automatico de cortes por correo esta deshabilitado.',
      };
    }

    const missingConfig = this.getMissingMailConfig({
      host: settings.host,
      from: settings.from,
      to,
    });

    if (missingConfig.length > 0) {
      return {
        attempted: false,
        sent: false,
        message: `Falta configurar: ${missingConfig.join(', ')}.`,
      };
    }

    const shift = await this.prisma.cashShift.findUnique({
      where: { id: shiftId },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    if (!shift) {
      return {
        attempted: false,
        sent: false,
        message: 'No se encontro el turno para enviar.',
      };
    }

    const pdf = await this.reportPdfService.generatePdf({
      shift,
      report,
      settings,
    });

    const transport = this.createTransport(settings);

    const mailOptions: SendMailOptions = {
      from: settings.from || undefined,
      to,
      cc: cc.length > 0 ? cc : undefined,
      subject: `Corte de caja #${shift.id} - ${new Date(shift.closedAt ?? shift.openedAt).toLocaleDateString('es-MX')}`,
      text: this.buildPlainTextBody(shift, report),
      attachments: [
        {
          filename: `corte-${shift.id}.pdf`,
          content: pdf,
          contentType: 'application/pdf',
        },
      ],
    };

    const info = await transport.sendMail(mailOptions);
    this.logger.log(`Shift report email sent for shift ${shiftId}: ${info.messageId}`);

    return {
      attempted: true,
      sent: true,
      message: 'Corte enviado por correo correctamente.',
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      to,
      cc,
    };
  }

  async sendTestEmail(overrides?: ShiftEmailConfigOverrides) {
    const settings = await this.resolveEmailConfig(overrides);
    const to = this.normalizeRecipients(overrides?.to ?? settings.to);
    const cc = this.normalizeRecipients(overrides?.cc ?? settings.cc);
    const missingConfig = this.getMissingMailConfig({
      host: settings.host,
      from: settings.from,
      to,
    });

    if (missingConfig.length > 0) {
      return {
        attempted: false,
        sent: false,
        verified: false,
        message: `Falta configurar: ${missingConfig.join(', ')}.`,
      };
    }

    const transport = this.createTransport(settings);

    try {
      await transport.verify();
    } catch (error: any) {
      throw new Error(this.getMailErrorMessage(error, 'No se pudo validar la conexion SMTP.'));
    }

    try {
      const info = await transport.sendMail({
        from: settings.from || undefined,
        to,
        cc: cc.length > 0 ? cc : undefined,
        subject: `Prueba de correo Fatboy POS - ${new Date().toLocaleString('es-MX')}`,
        text: [
          'Esta es una prueba de correo del sistema Fatboy POS.',
          '',
          'Si recibiste este mensaje, la configuracion SMTP responde correctamente.',
        ].join('\n'),
      });

      return {
        attempted: true,
        sent: true,
        verified: true,
        message: 'Correo de prueba enviado correctamente.',
        messageId: info.messageId,
        accepted: info.accepted,
        rejected: info.rejected,
        to,
        cc,
      };
    } catch (error: any) {
      throw new Error(this.getMailErrorMessage(error, 'No se pudo enviar el correo de prueba.'));
    }
  }

  private async resolveEmailConfig(overrides?: ShiftEmailConfigOverrides) {
    const settings = await this.settingsService.getAdminSettings();

    return {
      restaurantName: settings.restaurantName,
      restaurantAddress: settings.restaurantAddress,
      enabled: overrides?.enabled ?? settings.shiftEmailEnabled,
      host: this.normalizeOptionalString(overrides?.host ?? settings.shiftEmailHost),
      port: Number(overrides?.port ?? settings.shiftEmailPort ?? 587),
      secure: Boolean(overrides?.secure ?? settings.shiftEmailSecure),
      user: this.normalizeOptionalString(overrides?.user ?? settings.shiftEmailUser),
      password: this.normalizeOptionalString(overrides?.password ?? settings.shiftEmailPassword),
      from: this.normalizeOptionalString(overrides?.from ?? settings.shiftEmailFrom),
      to: this.normalizeOptionalString(overrides?.to ?? settings.shiftEmailTo),
      cc: this.normalizeOptionalString(overrides?.cc ?? settings.shiftEmailCc),
    };
  }

  private createTransport(settings: Awaited<ReturnType<CashShiftEmailService['resolveEmailConfig']>>) {
    return nodemailer.createTransport({
      host: settings.host || undefined,
      port: Number(settings.port ?? 587),
      secure: Boolean(settings.secure),
      auth: settings.user
        ? {
            user: settings.user,
            pass: settings.password || '',
          }
        : undefined,
    });
  }

  private normalizeRecipients(value?: string | null) {
    return String(value ?? '')
      .split(/[,\n;]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private normalizeOptionalString(value?: string | null) {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : null;
  }

  private getMissingMailConfig(input: {
    host?: string | null;
    from?: string | null;
    to: string[];
  }) {
    const missing: string[] = [];

    if (!input.host) missing.push('SMTP host');
    if (!input.from) missing.push('remitente');
    if (input.to.length === 0) missing.push('destinatario principal');

    return missing;
  }

  private getMailErrorMessage(error: any, fallback: string) {
    const baseMessage =
      error?.response ||
      error?.responseCode ||
      error?.code ||
      error?.command ||
      error?.message ||
      fallback;

    return `${fallback} ${String(baseMessage).trim()}`.trim();
  }

  private buildPlainTextBody(shift: any, report: any) {
    return [
      `Corte de caja #${shift.id}`,
      `Cajero: ${shift.user?.name || 'Sin asignar'}`,
      `Apertura: ${new Date(shift.openedAt).toLocaleString('es-MX')}`,
      `Cierre: ${shift.closedAt ? new Date(shift.closedAt).toLocaleString('es-MX') : 'Pendiente'}`,
      `Total esperado: $${Number(report.totalExpectedSystem ?? 0).toFixed(2)}`,
      `Total reportado: $${Number(report.totalReported ?? 0).toFixed(2)}`,
      `Diferencia: $${Number(report.totalDifference ?? 0).toFixed(2)}`,
      '',
      'Se adjunta el PDF completo del corte.',
    ].join('\n');
  }
}
