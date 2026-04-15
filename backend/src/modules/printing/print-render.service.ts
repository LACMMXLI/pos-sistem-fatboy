import { Injectable } from '@nestjs/common';
import { PrintTemplateSection } from './print-documents';

type RenderLine = {
  text: string;
  alignment: 'left' | 'center' | 'right';
  bold?: boolean;
  fontSize?: 'small' | 'normal' | 'large' | 'xlarge';
};

@Injectable()
export class PrintRenderService {
  private money(value: unknown) {
    return `$${Number(value ?? 0).toFixed(2)}`;
  }

  private normalizeText(value: unknown) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  private pushSectionLines(
    bucket: RenderLine[],
    section: PrintTemplateSection,
    lines: Array<string | null | undefined>,
  ) {
    if (!section.enabled) {
      return;
    }

    if (section.dividerBefore) {
      bucket.push({ text: '--------------------------------', alignment: 'left' });
    }

    for (const line of lines) {
      const normalized = this.normalizeText(line);
      if (!normalized) {
        continue;
      }

      bucket.push({
        text: normalized,
        alignment: section.alignment,
        bold: section.bold,
        fontSize: section.fontSize,
      });
    }

    if (section.dividerAfter) {
      bucket.push({ text: '--------------------------------', alignment: 'left' });
    }
  }

  render(template: any, data: any) {
    const lines: RenderLine[] = [];
    const order = data.order;
    const shift = data.shift;
    const report = data.report;
    const movement = data.movement;
    const fixedTexts = template.fixedTexts ?? {};
    const sections = [...(template.sections ?? [])].sort(
      (a: PrintTemplateSection, b: PrintTemplateSection) => a.order - b.order,
    );

    for (const section of sections) {
      switch (section.key) {
        case 'business_header':
          this.pushSectionLines(lines, section, [
            data.config?.restaurantName,
            fixedTexts.header,
          ]);
          break;
        case 'branch_info':
          this.pushSectionLines(lines, section, [data.config?.restaurantAddress]);
          break;
        case 'order_info':
          this.pushSectionLines(lines, section, [
            order ? `Orden: ${order.orderNumber}` : null,
            order ? `Folio: ${order.id}` : null,
            order ? `Fecha: ${new Date(order.createdAt).toLocaleString('es-MX', { hour12: false })}` : null,
            order ? `Servicio: ${order.orderType}` : null,
          ]);
          break;
        case 'shift_info':
          this.pushSectionLines(lines, section, [
            shift ? `Turno: #${shift.id}` : null,
            shift ? `Abierto: ${new Date(shift.openedAt).toLocaleString('es-MX', { hour12: false })}` : null,
            shift?.closedAt
              ? `Cerrado: ${new Date(shift.closedAt).toLocaleString('es-MX', { hour12: false })}`
              : null,
          ]);
          break;
        case 'cashier_info':
          this.pushSectionLines(lines, section, [
            order?.user?.name ? `Cajero: ${order.user.name}` : null,
            shift?.user?.name ? `Usuario: ${shift.user.name}` : null,
            movement?.creator?.name ? `Usuario: ${movement.creator.name}` : null,
          ]);
          break;
        case 'waiter_info':
          this.pushSectionLines(lines, section, [
            order?.waiter?.name ? `Mesero: ${order.waiter.name}` : null,
          ]);
          break;
        case 'table_info':
          this.pushSectionLines(lines, section, [
            order?.table?.name ? `Mesa: ${order.table.name}` : null,
            order?.table?.area?.name ? `Area: ${order.table.area.name}` : null,
          ]);
          break;
        case 'pickup_info':
          this.pushSectionLines(lines, section, [
            order?.orderType === 'TAKE_AWAY' ? `Pickup: ${order.orderNumber}` : null,
          ]);
          break;
        case 'customer_info':
          this.pushSectionLines(lines, section, [
            order?.customerName ? `Cliente: ${order.customerName}` : null,
            order?.customerPhoneSnapshot ? `Telefono: ${order.customerPhoneSnapshot}` : null,
          ]);
          break;
        case 'customer_address': {
          const address = order?.customerAddress || order?.deliveryAddressSnapshot;
          this.pushSectionLines(lines, section, [
            address?.street ? `Direccion: ${address.street} ${address.exteriorNumber ?? ''}` : null,
            address?.neighborhood ? `Colonia: ${address.neighborhood}` : null,
            address?.references ? `Ref: ${address.references}` : null,
          ]);
          break;
        }
        case 'delivery_info':
          this.pushSectionLines(lines, section, [
            order?.orderType === 'DELIVERY' ? 'Servicio a domicilio' : null,
          ]);
          break;
        case 'items':
          if (order?.items?.length) {
            for (const item of order.items) {
              const baseName = item.product?.name || 'Producto';
              this.pushSectionLines(lines, section, [
                `${item.quantity} x ${baseName}`,
              ]);
            }
          }
          break;
        case 'item_modifiers':
          if (order?.items?.length) {
            for (const item of order.items) {
              for (const modifier of item.modifiers ?? []) {
                this.pushSectionLines(lines, section, [`+ ${modifier.name}`]);
              }
            }
          }
          break;
        case 'item_notes':
          if (order?.items?.length) {
            for (const item of order.items) {
              if (item.notes) {
                this.pushSectionLines(lines, section, [`Nota: ${item.notes}`]);
              }
            }
          }
          if (movement?.reason) {
            this.pushSectionLines(lines, section, [
              `${section.customLabel || 'Motivo'}: ${movement.reason}`,
            ]);
          }
          break;
        case 'grouped_items_by_station':
          this.pushSectionLines(lines, section, [
            order?.table?.area?.name ? `Estacion: ${order.table.area.name}` : null,
          ]);
          break;
        case 'subtotal':
          this.pushSectionLines(lines, section, [
            order ? `${section.customLabel || 'Subtotal'}: ${this.money(order.subtotal)}` : null,
            report
              ? `${section.customLabel || 'Fondo inicial'}: ${this.money(report.openingAmount)}`
              : null,
          ]);
          break;
        case 'discount':
          this.pushSectionLines(lines, section, [
            order && Number(order.discountAmount) > 0
              ? `Descuento: ${this.money(order.discountAmount)}`
              : null,
          ]);
          break;
        case 'tax':
          this.pushSectionLines(lines, section, [
            order ? `Impuestos: ${this.money(order.taxAmount)}` : null,
          ]);
          break;
        case 'tip_suggested': {
          const tips = template.metadata?.suggestedTips ?? [10, 15, 20];
          if (order) {
            for (const tip of tips) {
              const amount = (Number(order.totalAmount ?? 0) * Number(tip)) / 100;
              this.pushSectionLines(lines, section, [
                `Propina sugerida ${tip}%: ${this.money(amount)}`,
              ]);
            }
          }
          break;
        }
        case 'tip_applied':
          this.pushSectionLines(lines, section, [
            order?.tipAmount ? `Propina: ${this.money(order.tipAmount)}` : null,
          ]);
          break;
        case 'total':
          this.pushSectionLines(lines, section, [
            order ? `Total: ${this.money(order.totalAmount)}` : null,
            movement ? `${movement.movementType === 'OUT' ? 'Salida' : 'Entrada'}: ${this.money(movement.amount)}` : null,
            report ? `${section.customLabel || 'Diferencia'}: ${this.money(report.totalDifference ?? report.difference)}` : null,
          ]);
          break;
        case 'payment_detail':
          if (data.paymentDetail?.length) {
            for (const payment of data.paymentDetail) {
              this.pushSectionLines(lines, section, [
                `${payment.method}: ${this.money(payment.amount)} ${payment.currency}`,
              ]);
            }
          }
          if (report) {
            this.pushSectionLines(lines, section, [
              `Ventas efectivo: ${this.money(report.totalSalesCash)}`,
              `Ventas tarjeta: ${this.money(report.totalSalesCard)}`,
            ]);
          }
          if (movement) {
            this.pushSectionLines(lines, section, [
              `Tipo: ${movement.movementType}`,
            ]);
          }
          break;
        case 'received_amount':
          this.pushSectionLines(lines, section, [
            data.paymentDetail?.[0]
              ? `Recibido: ${this.money(data.paymentDetail[0].receivedAmount)}`
              : null,
            report ? `${section.customLabel || 'Esperado'}: ${this.money(report.expectedBalance)}` : null,
          ]);
          break;
        case 'change_amount':
          this.pushSectionLines(lines, section, [
            data.paymentDetail?.[0]
              ? `Cambio: ${this.money(data.paymentDetail[0].changeAmount)}`
              : null,
            report && report.closingAmount !== null && report.closingAmount !== undefined
              ? `${section.customLabel || 'Declarado'}: ${this.money(report.closingAmount)}`
              : null,
          ]);
          break;
        case 'loyalty_info':
          if (data.loyaltyInfo) {
            this.pushSectionLines(lines, section, [
              `Puntos previos: ${data.loyaltyInfo.previousPoints}`,
              `Generados: ${data.loyaltyInfo.pointsGenerated}`,
              `Redimidos: ${data.loyaltyInfo.pointsRedeemed}`,
              `Saldo final: ${data.loyaltyInfo.finalPoints}`,
            ]);
          }
          break;
        case 'legal_footer':
          this.pushSectionLines(lines, section, [fixedTexts.legalFooter]);
          break;
        case 'promotional_footer':
          this.pushSectionLines(lines, section, [fixedTexts.promotionalFooter]);
          break;
        case 'custom_text':
          this.pushSectionLines(lines, section, [fixedTexts.customText]);
          break;
        case 'reprint_mark':
          this.pushSectionLines(lines, section, ['*** REIMPRESION ***']);
          break;
        case 'cancellation_mark':
          this.pushSectionLines(lines, section, ['*** CANCELADO ***']);
          break;
        default:
          break;
      }
    }

    return {
      documentType: template.documentType,
      paperWidth: template.paperWidth,
      templateId: template.id,
      templateName: template.name,
      lines,
      previewText: lines.map((line) => line.text).join('\n'),
    };
  }
}
