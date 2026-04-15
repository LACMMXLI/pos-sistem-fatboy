type ReceiptType = 'CLIENT' | 'KITCHEN';

interface ReceiptOrder {
  orderNumber?: string;
  orderType?: string;
  table?: { name?: string | null } | null;
  customerName?: string | null;
  waiter?: { name?: string | null } | null;
  createdAt?: string | Date;
  items?: Array<{
    quantity?: number;
    price?: unknown;
    notes?: string | null;
    product?: { name?: string | null } | null;
    name?: string | null;
    modifiers?: Array<{ name?: string | null; price?: unknown }>;
  }>;
  subtotal?: number;
  taxAmount?: number;
  discountAmount?: number;
  totalAmount?: number;
}

interface BuildEscPosReceiptOptions {
  order: ReceiptOrder;
  type: ReceiptType;
  paperWidth: '58' | '80';
  restaurantName?: string | null;
  restaurantAddress?: string | null;
  openDrawer?: boolean;
  cutPaper?: boolean;
}

const ESC = 0x1b;
const GS = 0x1d;

function toAscii(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeText(text: string) {
  return Buffer.from(toAscii(text), 'ascii');
}

function divider(columns: number) {
  return '-'.repeat(columns);
}

function center(text: string, columns: number) {
  const clean = toAscii(text);
  if (clean.length >= columns) return clean.slice(0, columns);
  const left = Math.floor((columns - clean.length) / 2);
  return `${' '.repeat(left)}${clean}`;
}

function right(text: string, columns: number) {
  const clean = toAscii(text);
  if (clean.length >= columns) return clean.slice(0, columns);
  return `${' '.repeat(columns - clean.length)}${clean}`;
}

function money(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function wrapText(text: string, width: number) {
  const clean = toAscii(text);
  if (!clean) return [''];

  const words = clean.split(' ');
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) {
      line = next;
      continue;
    }
    if (line) {
      lines.push(line);
      line = word;
      continue;
    }
    lines.push(word.slice(0, width));
  }

  if (line) lines.push(line);
  return lines;
}

function appendLine(chunks: Buffer[], text = '') {
  chunks.push(encodeText(text));
  chunks.push(Buffer.from('\n', 'ascii'));
}

function appendFeed(chunks: Buffer[], lines = 1) {
  for (let index = 0; index < lines; index += 1) {
    appendLine(chunks);
  }
}

export function buildEscPosReceipt({
  order,
  type,
  paperWidth,
  restaurantName,
  restaurantAddress,
  openDrawer = false,
  cutPaper = true,
}: BuildEscPosReceiptOptions) {
  const columns = paperWidth === '58' ? 32 : 48;
  const detailWidth = paperWidth === '58' ? 20 : 34;
  const amountWidth = columns - 4 - detailWidth;
  const isKitchen = type === 'KITCHEN';
  const orderTypeLabel =
    order.orderType === 'DINE_IN'
      ? 'COMEDOR'
      : order.orderType === 'DELIVERY'
        ? 'DOMICILIO'
        : 'PARA LLEVAR';
  const timestamp = new Date(order.createdAt ?? Date.now()).toLocaleString('es-MX', {
    hour12: false,
  });
  const chunks: Buffer[] = [];

  chunks.push(Buffer.from([ESC, 0x40]));
  chunks.push(Buffer.from([ESC, 0x61, 0x01]));
  chunks.push(Buffer.from([ESC, 0x21, 0x20]));
  appendLine(chunks, center(restaurantName || 'MI NEGOCIO', columns));
  chunks.push(Buffer.from([ESC, 0x21, 0x00]));

  if (!isKitchen && restaurantAddress) {
    for (const line of wrapText(restaurantAddress, columns)) {
      appendLine(chunks, center(line, columns));
    }
  }

  appendLine(chunks, center(isKitchen ? 'COMANDA DE COCINA' : 'TICKET DE VENTA', columns));
  appendLine(chunks, center(timestamp, columns));
  appendLine(chunks, divider(columns));

  chunks.push(Buffer.from([ESC, 0x61, 0x00]));
  appendLine(chunks, `ORDEN: #${toAscii(order.orderNumber || '').split('-').pop() || order.orderNumber || 'S/N'}`);
  appendLine(chunks, `TIPO : ${orderTypeLabel}`);

  if (order.table?.name) appendLine(chunks, `MESA : ${toAscii(order.table.name)}`);
  if (order.customerName) appendLine(chunks, `CLIENTE: ${toAscii(order.customerName)}`);
  appendLine(chunks, `ATENDIO: ${toAscii(order.waiter?.name || 'CAJA')}`);
  appendLine(chunks, divider(columns));

  for (const item of order.items ?? []) {
    const quantity = String(item.quantity ?? 0).padStart(2, ' ');
    const name = toAscii(item.product?.name || item.name || 'PRODUCTO');
    const unitPrice = Number(item.price ?? 0);
    const modifiers = item.modifiers ?? [];
    const modifierTotal = modifiers.reduce((sum, modifier) => sum + Number(modifier.price ?? 0), 0);
    const lineTotal = (unitPrice + modifierTotal) * Number(item.quantity ?? 0);
    const nameLines = wrapText(name, detailWidth);

    appendLine(
      chunks,
      `${quantity}  ${nameLines[0].padEnd(detailWidth)}${isKitchen ? '' : right(money(lineTotal), amountWidth)}`,
    );

    for (const extraLine of nameLines.slice(1)) {
      appendLine(chunks, `    ${extraLine}`);
    }

    for (const modifier of modifiers) {
      for (const line of wrapText(`+ ${modifier.name ?? ''}`, columns - 4)) {
        appendLine(chunks, `    ${line}`);
      }
    }

    if (item.notes) {
      for (const line of wrapText(`* ${item.notes}`, columns - 4)) {
        appendLine(chunks, `    ${line}`);
      }
    }
  }

  if (!isKitchen) {
    appendLine(chunks, divider(columns));
    appendLine(chunks, `${'SUBTOTAL'.padEnd(columns - amountWidth)}${right(money(order.subtotal), amountWidth)}`);
    appendLine(chunks, `${'IMPUESTOS'.padEnd(columns - amountWidth)}${right(money(order.taxAmount), amountWidth)}`);

    if (Number(order.discountAmount ?? 0) > 0) {
      appendLine(
        chunks,
        `${'DESCUENTO'.padEnd(columns - amountWidth)}${right(`-${money(order.discountAmount)}`, amountWidth)}`,
      );
    }

    chunks.push(Buffer.from([ESC, 0x45, 0x01]));
    appendLine(chunks, `${'TOTAL'.padEnd(columns - amountWidth)}${right(money(order.totalAmount), amountWidth)}`);
    chunks.push(Buffer.from([ESC, 0x45, 0x00]));
    appendLine(chunks, divider(columns));
    chunks.push(Buffer.from([ESC, 0x61, 0x01]));
    appendLine(chunks, center('GRACIAS POR SU PREFERENCIA', columns));
    appendLine(chunks, center('FACTURA SIN VALIDEZ LEGAL', columns));
  } else {
    chunks.push(Buffer.from([ESC, 0x61, 0x01]));
    appendLine(chunks, divider(columns));
    chunks.push(Buffer.from([ESC, 0x45, 0x01]));
    appendLine(chunks, center('IMPRIMIR PARA DESPACHO', columns));
    chunks.push(Buffer.from([ESC, 0x45, 0x00]));
  }

  appendFeed(chunks, 4);

  if (openDrawer && !isKitchen) {
    chunks.push(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]));
  }

  if (cutPaper) {
    chunks.push(Buffer.from([GS, 0x56, 0x00]));
  }
  return Buffer.concat(chunks);
}
