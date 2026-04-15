import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { PrintOrderReceiptDto } from './dto/print-order-receipt.dto';
import { PrintJobsService } from './print-jobs.service';

@Injectable()
export class PrintingService {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly settingsService: SettingsService,
    private readonly printJobsService: PrintJobsService,
  ) {}

  private resolvePrintRouting(
    settings: Awaited<ReturnType<SettingsService['getSettings']>>,
    options: PrintOrderReceiptDto,
  ) {
    const type = options.type ?? 'CLIENT';
    const printerName =
      options.printerName ||
      (type === 'KITCHEN'
        ? settings.kitchenPrinterName || settings.receiptPrinterName || undefined
        : settings.receiptPrinterName || settings.kitchenPrinterName || undefined);
    const paperWidth =
      options.paperWidth ||
      (type === 'KITCHEN'
        ? settings.kitchenPaperWidth || settings.receiptPaperWidth || '80'
        : settings.receiptPaperWidth || settings.kitchenPaperWidth || '80');

    return { type, printerName, paperWidth };
  }

  async printOrderReceipt(
    orderId: number,
    options: PrintOrderReceiptDto = {},
    actor?: { id: number; role: string },
  ) {
    const settings = await this.settingsService.getSettings();
    await this.ordersService.findOne(orderId);
    const { type, printerName, paperWidth } = this.resolvePrintRouting(settings, options);

    if (!printerName) {
      throw new BadRequestException(
        type === 'KITCHEN'
          ? 'No hay impresora configurada para produccion. Configura la impresora HM/produccion en Ajustes.'
          : 'No hay impresora configurada. Configura la impresora de tickets en Ajustes.',
      );
    }

    const job = await this.printJobsService.createLegacyOrderJob(
      orderId,
      type,
      {
        printerName,
        paperWidth,
        copies: options.copies ?? 1,
        source: 'MANUAL',
      },
      actor,
    );

    return {
      success: true,
      queued: true,
      jobId: job.id,
      printerName,
      type,
      copies: options.copies ?? 1,
      paperWidth,
      status: job.status,
    };
  }
}
