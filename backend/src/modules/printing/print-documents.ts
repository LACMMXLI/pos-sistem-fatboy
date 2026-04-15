export const PRINT_DOCUMENT_TYPES = [
  'KITCHEN_TICKET',
  'FAST_FOOD_RECEIPT',
  'DINE_IN_PRECHECK',
  'DINE_IN_FINAL_RECEIPT',
  'DELIVERY_RECEIPT',
  'CASH_CLOSING',
  'CASH_MOVEMENT',
  'REPRINT_COPY',
  'CANCEL_OR_VOID_RECEIPT',
] as const;

export type PrintDocumentType = (typeof PRINT_DOCUMENT_TYPES)[number];

export const PRINT_PAPER_WIDTHS = ['58', '80'] as const;

export type PrintPaperWidth = (typeof PRINT_PAPER_WIDTHS)[number];

export const PRINT_BLOCK_KEYS = [
  'business_header',
  'logo',
  'branch_info',
  'order_info',
  'shift_info',
  'cashier_info',
  'waiter_info',
  'table_info',
  'pickup_info',
  'customer_info',
  'customer_address',
  'delivery_info',
  'items',
  'item_modifiers',
  'item_notes',
  'grouped_items_by_station',
  'subtotal',
  'discount',
  'tax',
  'tip_suggested',
  'tip_applied',
  'total',
  'payment_detail',
  'received_amount',
  'change_amount',
  'loyalty_info',
  'qr_code',
  'barcode',
  'legal_footer',
  'promotional_footer',
  'custom_text',
  'reprint_mark',
  'cancellation_mark',
] as const;

export type PrintBlockKey = (typeof PRINT_BLOCK_KEYS)[number];

export type PrintTemplateSection = {
  key: PrintBlockKey;
  enabled: boolean;
  visibleWhen?: string | null;
  order: number;
  alignment: 'left' | 'center' | 'right';
  fontSize: 'small' | 'normal' | 'large' | 'xlarge';
  bold: boolean;
  dividerBefore?: boolean;
  dividerAfter?: boolean;
  customLabel?: string | null;
  spacing?: number;
  maxWidth?: '58' | '80' | 'auto';
  format?: 'currency' | 'percentage' | 'text' | null;
  options?: Record<string, unknown>;
};

export type PrintTemplateConfig = {
  templateKey: string;
  name: string;
  documentType: PrintDocumentType;
  paperWidth: PrintPaperWidth;
  version: number;
  isActive: boolean;
  isDefault: boolean;
  sections: PrintTemplateSection[];
  printerRouting?: Record<string, unknown> | null;
  fixedTexts?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  warnings?: string[] | null;
};

export const LEGACY_PRINT_MAPPING: Record<'CLIENT' | 'KITCHEN', PrintDocumentType> = {
  CLIENT: 'FAST_FOOD_RECEIPT',
  KITCHEN: 'KITCHEN_TICKET',
};
