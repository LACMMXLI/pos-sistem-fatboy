import { Injectable } from '@nestjs/common';
import PDFDocument = require('pdfkit');

type ShiftReportContext = {
  shift: {
    id: number;
    openedAt: Date | string;
    closedAt?: Date | string | null;
    openingAmount: unknown;
    closingAmount?: unknown;
    closingUsdAmount?: unknown;
    closingCardAmount?: unknown;
    status: string;
    user?: {
      name?: string | null;
      email?: string | null;
    } | null;
  };
  report: any;
  settings?: {
    restaurantName?: string | null;
    restaurantAddress?: string | null;
  } | null;
};

@Injectable()
export class CashShiftReportPdfService {
  private readonly colors = {
    navy: '#0f172a',
    slate: '#334155',
    ink: '#111827',
    muted: '#64748b',
    line: '#dbe4ee',
    panel: '#f8fafc',
    softBlue: '#e0f2fe',
    blue: '#0369a1',
    softGreen: '#dcfce7',
    green: '#15803d',
    softAmber: '#fef3c7',
    amber: '#b45309',
    softRose: '#ffe4e6',
    rose: '#be123c',
    white: '#ffffff',
  };

  async generatePdf(context: ShiftReportContext): Promise<Buffer> {
    const doc = new PDFDocument({
      size: 'LETTER',
      margin: 36,
      bufferPages: true,
      info: {
        Title: `Corte de caja #${context.shift.id}`,
        Author: 'Fatboy POS',
        Subject: 'Reporte de cierre de caja',
      },
    });

    const chunks: Buffer[] = [];

    return new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      this.buildDocument(doc, context);
      doc.end();
    });
  }

  private buildDocument(doc: PDFKit.PDFDocument, context: ShiftReportContext) {
    const { shift, report, settings } = context;
    const restaurantName = settings?.restaurantName?.trim() || 'Fatboy POS';
    const restaurantAddress = settings?.restaurantAddress?.trim();

    this.renderHeader(doc, restaurantName, restaurantAddress, shift);
    this.renderExecutiveSummary(doc, shift, report);

    this.renderSectionTitle(doc, 'Resumen general');
    this.renderKeyValueGrid(doc, [
      ['Cajero', shift.user?.name || 'Sin asignar'],
      ['Estado', shift.status],
      ['Apertura', this.formatDate(shift.openedAt)],
      ['Cierre', shift.closedAt ? this.formatDate(shift.closedAt) : 'Pendiente'],
      ['Fondo inicial', this.formatMoney(shift.openingAmount)],
      ['Ventas registradas', this.formatMoney(report.totalSalesRegistered)],
    ]);

    this.renderSectionTitle(doc, 'Conciliacion del corte');
    this.renderTable(doc, ['Concepto', 'Sistema', 'Declarado', 'Diferencia'], [
      [
        'Pesos en caja',
        this.formatMoney(report.expectedBalance),
        this.formatMoney(report.closingAmount ?? shift.closingAmount ?? 0),
        this.formatMoney(report.cashDifference ?? 0),
      ],
      [
        'Dolares en caja',
        this.formatUsd(report.expectedUsdBalance),
        this.formatUsd(report.closingUsdAmount ?? shift.closingUsdAmount ?? 0),
        this.formatUsd(report.usdDifference ?? 0),
      ],
      [
        'Terminal / tarjeta',
        this.formatMoney(report.expectedCardBalance),
        this.formatMoney(report.closingCardAmount ?? shift.closingCardAmount ?? 0),
        this.formatMoney(report.cardDifference ?? 0),
      ],
      [
        'Total conciliado',
        this.formatMoney(report.totalExpectedSystem),
        this.formatMoney(report.totalReported ?? 0),
        this.formatMoney(report.totalDifference ?? 0),
      ],
    ]);

    this.renderSectionTitle(doc, 'Metricas del turno');
    this.renderKeyValueGrid(doc, [
      ['Ventas efectivo', this.formatMoney(report.totalSalesCash)],
      ['Ventas tarjeta', this.formatMoney(report.totalSalesCard)],
      ['USD recibidos', this.formatUsd(report.totalCashUsdIn)],
      ['Cambio entregado MXN', this.formatMoney(report.totalChangeGivenMxn)],
      ['Entradas manuales', this.formatMoney(report.totalManualIn)],
      ['Salidas manuales', this.formatMoney(report.totalManualOut)],
      ['Ordenes canceladas', String(report.cancelledOrdersCount ?? 0)],
      ['Monto excluido', this.formatMoney(report.cancelledSalesExcluded ?? 0)],
      ['Ordenes con canje', String(report.redeemedOrdersCount ?? 0)],
      ['Piezas canjeadas', String(report.redeemedItemsCount ?? 0)],
    ]);

    this.renderSectionTitle(doc, 'Ventas por cajero');
    const cashierRows = (report.salesByCashier ?? []).map((entry: any) => [
      entry.cashierName,
      this.formatMoney(entry.totalSalesCash),
      this.formatMoney(entry.totalSalesCard),
      this.formatMoney(entry.totalSales),
    ]);
    this.renderTable(doc, ['Cajero', 'Efectivo', 'Tarjeta', 'Total'], cashierRows, 'Sin ventas por cajero.');

    this.renderSectionTitle(doc, 'Metricas por servicio');
    const serviceRows = (report.serviceTypeMetrics ?? []).map((entry: any) => [
      entry.label,
      String(entry.ordersCount),
      String(entry.itemsSold),
      this.formatMoney(entry.totalSales),
      this.formatMoney(entry.averageTicket),
    ]);
    this.renderTable(doc, ['Servicio', 'Ordenes', 'Piezas', 'Venta', 'Ticket'], serviceRows, 'Sin metricas de servicio.');

    this.renderSectionTitle(doc, 'Productos lideres');
    const productRows = (report.topProducts ?? []).map((entry: any) => [
      entry.productName,
      String(entry.quantitySold),
      this.formatMoney(entry.grossSales),
      (entry.orderTypes ?? [])
        .map((bucket: any) => `${bucket.label}: ${bucket.quantitySold}`)
        .join(' | ') || 'Sin datos',
    ]);
    this.renderTable(doc, ['Producto', 'Piezas', 'Venta', 'Servicios'], productRows, 'Sin productos vendidos.');

    this.renderSectionTitle(doc, 'Linea de tiempo del turno');
    const timelineRows = (report.timeline ?? []).map((entry: any) => [
      this.formatDate(entry.createdAt),
      entry.reason || 'Movimiento',
      entry.orderNumber || '-',
      entry.movementType === 'IN' ? 'Entrada' : 'Salida',
      this.formatMoney(entry.amount),
    ]);
    this.renderTable(doc, ['Fecha', 'Concepto', 'Orden', 'Tipo', 'Monto'], timelineRows, 'Sin movimientos registrados.');
  }

  private renderHeader(doc: PDFKit.PDFDocument, businessName: string, businessAddress: string | undefined, shift: ShiftReportContext['shift']) {
    const top = doc.y;
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const height = 96;

    doc
      .roundedRect(left, top, width, height, 14)
      .fillColor(this.colors.navy)
      .fill();

    doc
      .roundedRect(left + width - 130, top + 14, 108, 28, 10)
      .fillColor(this.colors.blue)
      .fill();

    doc
      .fillColor(this.colors.white)
      .font('Helvetica-Bold')
      .fontSize(10)
      .text(`CORTE #${shift.id}`, left + width - 130, top + 23, {
        width: 108,
        align: 'center',
      });

    doc
      .fillColor(this.colors.white)
      .font('Helvetica-Bold')
      .fontSize(22)
      .text(businessName, left + 18, top + 16, { width: width - 170 });

    doc
      .fillColor('#cbd5e1')
      .font('Helvetica')
      .fontSize(9)
      .text(businessAddress || 'Reporte financiero y operativo del cierre de caja.', left + 18, top + 44, {
        width: width - 170,
      });

    doc
      .fillColor(this.colors.white)
      .font('Helvetica-Bold')
      .fontSize(15)
      .text('Reporte de cierre de caja', left + 18, top + 66);

    doc
      .fillColor('#cbd5e1')
      .font('Helvetica')
      .fontSize(8)
      .text(`Generado: ${this.formatDate(new Date())}`, left + 18, top + 84);

    doc.y = top + height + 10;
  }

  private renderExecutiveSummary(doc: PDFKit.PDFDocument, shift: ShiftReportContext['shift'], report: any) {
    const cards = [
      {
        label: 'Venta total',
        value: this.formatMoney(report.totalSalesRegistered),
        toneBg: this.colors.softBlue,
        toneText: this.colors.blue,
      },
      {
        label: 'Sistema espera',
        value: this.formatMoney(report.totalExpectedSystem),
        toneBg: this.colors.softGreen,
        toneText: this.colors.green,
      },
      {
        label: 'Declarado',
        value: this.formatMoney(report.totalReported ?? 0),
        toneBg: this.colors.softAmber,
        toneText: this.colors.amber,
      },
      {
        label: 'Diferencia',
        value: this.formatMoney(report.totalDifference ?? 0),
        toneBg:
          Number(report.totalDifference ?? 0) === 0 ? this.colors.softGreen : this.colors.softRose,
        toneText:
          Number(report.totalDifference ?? 0) === 0 ? this.colors.green : this.colors.rose,
      },
    ];

    const left = doc.page.margins.left;
    const totalWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const gap = 10;
    const cardWidth = (totalWidth - (gap * 3)) / 4;
    const top = doc.y;

    cards.forEach((card, index) => {
      const x = left + (index * (cardWidth + gap));
      doc
        .roundedRect(x, top, cardWidth, 62, 12)
        .fillColor(card.toneBg)
        .fill();

      doc
        .fillColor(card.toneText)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(card.label.toUpperCase(), x + 12, top + 12, { width: cardWidth - 24 });

      doc
        .fillColor(this.colors.ink)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(card.value, x + 12, top + 29, { width: cardWidth - 24 });
    });

    doc.y = top + 76;
    this.renderMetaBand(doc, [
      ['Cajero', shift.user?.name || 'Sin asignar'],
      ['Estado', shift.status],
      ['Apertura', this.formatDate(shift.openedAt)],
      ['Cierre', shift.closedAt ? this.formatDate(shift.closedAt) : 'Pendiente'],
    ]);
  }

  private renderSectionTitle(doc: PDFKit.PDFDocument, title: string) {
    this.ensureSpace(doc, 50);
    doc.moveDown(0.6);

    const x = doc.page.margins.left;
    const y = doc.y;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    doc
      .roundedRect(x, y, width, 24, 8)
      .fillColor(this.colors.navy)
      .fill();

    doc
      .fillColor(this.colors.white)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(title.toUpperCase(), x + 12, y + 7, { width: width - 24 });

    doc.y = y + 30;
  }

  private renderKeyValueGrid(doc: PDFKit.PDFDocument, entries: Array<[string, string]>) {
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colGap = 12;
    const colWidth = (width - colGap) / 2;

    for (let index = 0; index < entries.length; index += 2) {
      this.ensureSpace(doc, 42);
      const top = doc.y;
      const chunk = entries.slice(index, index + 2);

      chunk.forEach(([label, value], chunkIndex) => {
        const x = left + (chunkIndex * (colWidth + colGap));
        doc
          .roundedRect(x, top, colWidth, 32, 8)
          .fillColor(this.colors.panel)
          .fill();

        doc
          .fillColor(this.colors.muted)
          .font('Helvetica-Bold')
          .fontSize(7)
          .text(label.toUpperCase(), x + 10, top + 7, { width: colWidth - 20 });

        doc
          .fillColor(this.colors.ink)
          .font('Helvetica-Bold')
          .fontSize(10)
          .text(value, x + 10, top + 17, { width: colWidth - 20, align: 'right' });
      });

      doc.y = top + 38;
    }
  }

  private renderTable(
    doc: PDFKit.PDFDocument,
    headers: string[],
    rows: string[][],
    emptyMessage?: string,
  ) {
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const columnWidth = usableWidth / headers.length;
    const tableLeft = doc.page.margins.left;

    const drawHeader = () => {
      this.ensureSpace(doc, 28);
      const y = doc.y;
      doc
        .roundedRect(tableLeft, y - 3, usableWidth, 20, 6)
        .fillColor(this.colors.softBlue)
        .fill();
      headers.forEach((header, index) => {
        doc
          .fillColor(this.colors.blue)
          .font('Helvetica-Bold')
          .fontSize(8)
          .text(header, tableLeft + 8 + (index * columnWidth), y + 3, {
          width: columnWidth - 8,
        });
      });
      doc.y = y + 24;
    };

    drawHeader();

    if (rows.length === 0) {
      this.ensureSpace(doc, 24);
      doc
        .roundedRect(tableLeft, doc.y, usableWidth, 26, 6)
        .fillColor(this.colors.panel)
        .fill();
      doc
        .fillColor(this.colors.muted)
        .font('Helvetica')
        .fontSize(9)
        .text(emptyMessage || 'Sin datos.', tableLeft + 10, doc.y + 8, { width: usableWidth - 20 });
      doc.moveDown(1.8);
      return;
    }

    rows.forEach((row, rowIndex) => {
      this.ensureSpace(doc, 30);
      const y = doc.y;
      doc
        .roundedRect(tableLeft, y - 2, usableWidth, 22, 5)
        .fillColor(rowIndex % 2 === 0 ? this.colors.white : this.colors.panel)
        .fill();

      row.forEach((cell, index) => {
        const align = index === row.length - 1 ? 'right' : 'left';
        doc
          .fillColor(this.colors.slate)
          .font('Helvetica')
          .fontSize(8)
          .text(String(cell ?? ''), tableLeft + 8 + (index * columnWidth), y + 4, {
            width: columnWidth - 10,
            align,
          });
      });
      doc.y = y + 24;
    });

    doc.moveDown(0.4);
  }

  private drawDivider(doc: PDFKit.PDFDocument, color = '#cbd5e1') {
    const y = doc.y + 2;
    doc
      .strokeColor(color)
      .lineWidth(1)
      .moveTo(doc.page.margins.left, y)
      .lineTo(doc.page.width - doc.page.margins.right, y)
      .stroke();
    doc.moveDown(0.5);
  }

  private renderMetaBand(doc: PDFKit.PDFDocument, entries: Array<[string, string]>) {
    this.ensureSpace(doc, 40);
    const x = doc.page.margins.left;
    const y = doc.y;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const itemWidth = width / entries.length;

    doc
      .roundedRect(x, y, width, 36, 10)
      .fillColor(this.colors.panel)
      .fill();

    entries.forEach(([label, value], index) => {
      const itemX = x + (index * itemWidth);
      doc
        .fillColor(this.colors.muted)
        .font('Helvetica-Bold')
        .fontSize(7)
        .text(label.toUpperCase(), itemX + 8, y + 8, {
          width: itemWidth - 16,
          align: 'center',
        });

      doc
        .fillColor(this.colors.ink)
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(value, itemX + 8, y + 18, {
          width: itemWidth - 16,
          align: 'center',
        });
    });

    doc.y = y + 44;
  }

  private ensureSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
    const bottomLimit = doc.page.height - doc.page.margins.bottom;
    if (doc.y + requiredHeight > bottomLimit) {
      doc.addPage();
    }
  }

  private formatMoney(value: unknown) {
    return `$${Number(value ?? 0).toFixed(2)}`;
  }

  private formatUsd(value: unknown) {
    return `USD ${Number(value ?? 0).toFixed(2)}`;
  }

  private formatDate(value: Date | string | null | undefined) {
    if (!value) return 'N/D';
    return new Date(value).toLocaleString('es-MX');
  }
}
