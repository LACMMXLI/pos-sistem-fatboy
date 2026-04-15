import {
  PrintDocumentType,
  PrintPaperWidth,
  PrintTemplateConfig,
  PrintTemplateSection,
} from './print-documents';

function section(
  key: PrintTemplateSection['key'],
  order: number,
  overrides: Partial<PrintTemplateSection> = {},
): PrintTemplateSection {
  return {
    key,
    enabled: true,
    order,
    alignment: 'left',
    fontSize: 'normal',
    bold: false,
    dividerBefore: false,
    dividerAfter: false,
    customLabel: null,
    spacing: 0,
    maxWidth: 'auto',
    format: null,
    options: {},
    ...overrides,
  };
}

function baseTemplate(
  documentType: PrintDocumentType,
  paperWidth: PrintPaperWidth,
  name: string,
  sections: PrintTemplateSection[],
  fixedTexts?: Record<string, unknown>,
  warnings?: string[],
): PrintTemplateConfig {
  return {
    templateKey: `${documentType}_${paperWidth}_DEFAULT`,
    name,
    documentType,
    paperWidth,
    version: 1,
    isActive: true,
    isDefault: true,
    sections,
    printerRouting: null,
    fixedTexts: fixedTexts ?? {},
    metadata: {
      suggestedTips: [10, 15, 20],
    },
    warnings: warnings ?? [],
  };
}

export function getDefaultTemplateConfigs(): PrintTemplateConfig[] {
  const widths: PrintPaperWidth[] = ['58', '80'];
  const templates: PrintTemplateConfig[] = [];

  for (const paperWidth of widths) {
    templates.push(
      baseTemplate(
        'KITCHEN_TICKET',
        paperWidth,
        `Comanda cocina ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true, fontSize: 'large' }),
          section('order_info', 2, { bold: true, fontSize: 'large' }),
          section('table_info', 3, { bold: true }),
          section('pickup_info', 4),
          section('customer_info', 5),
          section('items', 6, { fontSize: 'large', bold: true }),
          section('item_modifiers', 7),
          section('item_notes', 8, { bold: true }),
          section('grouped_items_by_station', 9),
          section('custom_text', 10, { alignment: 'center', bold: true }),
        ],
        {
          header: 'COMANDA DE COCINA',
          customText: 'IMPRIMIR PARA DESPACHO',
        },
      ),
      baseTemplate(
        'FAST_FOOD_RECEIPT',
        paperWidth,
        `Ticket servicio rapido ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true, fontSize: 'large' }),
          section('branch_info', 2, { alignment: 'center' }),
          section('order_info', 3, { dividerAfter: true }),
          section('cashier_info', 4),
          section('customer_info', 5),
          section('items', 6),
          section('item_modifiers', 7),
          section('subtotal', 8, { dividerBefore: true }),
          section('discount', 9),
          section('tax', 10),
          section('total', 11, { bold: true, fontSize: 'large' }),
          section('payment_detail', 12),
          section('received_amount', 13),
          section('change_amount', 14),
          section('loyalty_info', 15),
          section('legal_footer', 16, { alignment: 'center' }),
          section('promotional_footer', 17, { alignment: 'center' }),
        ],
        {
          legalFooter: 'FACTURA SIN VALIDEZ LEGAL',
          promotionalFooter: 'GRACIAS POR SU PREFERENCIA',
        },
      ),
      baseTemplate(
        'DINE_IN_PRECHECK',
        paperWidth,
        `Precuenta comedor ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true, fontSize: 'large' }),
          section('order_info', 2),
          section('table_info', 3, { bold: true }),
          section('waiter_info', 4),
          section('customer_info', 5),
          section('items', 6),
          section('subtotal', 7, { dividerBefore: true }),
          section('discount', 8),
          section('tax', 9),
          section('total', 10, { bold: true, fontSize: 'large' }),
          section('tip_suggested', 11),
          section('custom_text', 12, { alignment: 'center' }),
        ],
        {
          customText: 'Precuenta informativa. No valida como pago.',
        },
      ),
      baseTemplate(
        'DINE_IN_FINAL_RECEIPT',
        paperWidth,
        `Ticket final comedor ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true, fontSize: 'large' }),
          section('order_info', 2),
          section('table_info', 3),
          section('waiter_info', 4),
          section('items', 5),
          section('subtotal', 6, { dividerBefore: true }),
          section('discount', 7),
          section('tax', 8),
          section('total', 9, { bold: true, fontSize: 'large' }),
          section('payment_detail', 10),
          section('received_amount', 11),
          section('change_amount', 12),
          section('tip_applied', 13),
          section('loyalty_info', 14),
          section('legal_footer', 15, { alignment: 'center' }),
        ],
      ),
      baseTemplate(
        'DELIVERY_RECEIPT',
        paperWidth,
        `Ticket domicilio ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true, fontSize: 'large' }),
          section('order_info', 2),
          section('customer_info', 3),
          section('customer_address', 4),
          section('delivery_info', 5),
          section('items', 6),
          section('item_notes', 7),
          section('total', 8, { dividerBefore: true, bold: true, fontSize: 'large' }),
          section('payment_detail', 9),
          section('received_amount', 10),
          section('change_amount', 11),
          section('loyalty_info', 12),
          section('promotional_footer', 13, { alignment: 'center' }),
        ],
      ),
      baseTemplate(
        'CASH_CLOSING',
        paperWidth,
        `Corte caja ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true, fontSize: 'large' }),
          section('shift_info', 2),
          section('cashier_info', 3),
          section('subtotal', 4, { customLabel: 'Fondo inicial' }),
          section('payment_detail', 5, { customLabel: 'Ventas por metodo' }),
          section('received_amount', 6, { customLabel: 'Efectivo esperado' }),
          section('change_amount', 7, { customLabel: 'Efectivo declarado' }),
          section('total', 8, { customLabel: 'Diferencia', bold: true }),
          section('item_notes', 9, { customLabel: 'Observaciones' }),
        ],
      ),
      baseTemplate(
        'CASH_MOVEMENT',
        paperWidth,
        `Movimiento caja ${paperWidth}mm`,
        [
          section('business_header', 1, { alignment: 'center', bold: true }),
          section('cashier_info', 2),
          section('shift_info', 3),
          section('payment_detail', 4),
          section('total', 5, { bold: true, fontSize: 'large' }),
          section('item_notes', 6),
        ],
      ),
      baseTemplate(
        'REPRINT_COPY',
        paperWidth,
        `Reimpresion ${paperWidth}mm`,
        [
          section('reprint_mark', 1, { alignment: 'center', bold: true, fontSize: 'xlarge' }),
          section('order_info', 2),
          section('items', 3),
          section('total', 4, { bold: true }),
          section('payment_detail', 5),
        ],
      ),
      baseTemplate(
        'CANCEL_OR_VOID_RECEIPT',
        paperWidth,
        `Cancelacion ${paperWidth}mm`,
        [
          section('cancellation_mark', 1, { alignment: 'center', bold: true, fontSize: 'xlarge' }),
          section('order_info', 2),
          section('customer_info', 3),
          section('items', 4),
          section('total', 5, { bold: true }),
          section('item_notes', 6),
        ],
      ),
    );
  }

  return templates;
}
