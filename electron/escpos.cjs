const ESC = 0x1b;
const GS = 0x1d;

function toAscii(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function encodeText(text) {
  return Buffer.from(toAscii(text), 'ascii');
}

function divider(columns) {
  return '-'.repeat(columns);
}

function center(text, columns) {
  const clean = toAscii(text);
  if (clean.length >= columns) return clean.slice(0, columns);
  const left = Math.floor((columns - clean.length) / 2);
  return `${' '.repeat(left)}${clean}`;
}

function right(text, columns) {
  const clean = toAscii(text);
  if (clean.length >= columns) return clean.slice(0, columns);
  return `${' '.repeat(columns - clean.length)}${clean}`;
}

function money(value) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function wrapText(text, width) {
  const clean = toAscii(text);
  if (!clean) return [''];

  const words = clean.split(' ');
  const lines = [];
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

  if (line) {
    lines.push(line);
  }

  return lines;
}

function appendLine(chunks, text = '') {
  chunks.push(encodeText(text));
  chunks.push(Buffer.from('\n', 'ascii'));
}

function appendFeed(chunks, lines = 1) {
  for (let index = 0; index < lines; index += 1) {
    appendLine(chunks);
  }
}

function labelValue(label, value, columns) {
  const cleanLabel = toAscii(label);
  const cleanValue = toAscii(value);
  const spacer = Math.max(1, columns - cleanLabel.length - cleanValue.length);
  return `${cleanLabel}${' '.repeat(spacer)}${cleanValue}`.slice(0, columns);
}

function buildEscPosReceipt({
  order,
  type,
  paperWidth,
  restaurantName,
  restaurantAddress,
  openDrawer = false,
  cutPaper = true,
}) {
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
  const chunks = [];

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
  appendLine(chunks, `ATENDIO: ${toAscii(order.waiter?.name || order.user?.name || 'CAJA')}`);
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

function buildEscPosDrawerPulse() {
  return Buffer.concat([
    Buffer.from([ESC, 0x40]),
    Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]),
  ]);
}

function buildEscPosShiftReport({
  shift,
  report,
  paperWidth,
  restaurantName,
  restaurantAddress,
  cutPaper = true,
}) {
  const columns = paperWidth === '58' ? 32 : 48;
  const chunks = [];
  const openedAt = new Date(shift?.openedAt ?? Date.now()).toLocaleString('es-MX', { hour12: false });
  const closedAt = shift?.closedAt
    ? new Date(shift.closedAt).toLocaleString('es-MX', { hour12: false })
    : 'PENDIENTE';
  const usdRate = Number(report?.usdRateForClose ?? 0);
  const closingUsd = Number(report?.closingUsdAmount ?? 0);
  const closingCash = Number(report?.closingAmount ?? 0);
  const closingCard = Number(report?.closingCardAmount ?? 0);
  const totalDeclared = closingCash + (closingUsd * usdRate) + closingCard;
  const totalDifference = Number(report?.totalDifference ?? 0);

  chunks.push(Buffer.from([ESC, 0x40]));
  chunks.push(Buffer.from([ESC, 0x61, 0x01]));
  chunks.push(Buffer.from([ESC, 0x21, 0x20]));
  appendLine(chunks, center(restaurantName || 'MI NEGOCIO', columns));
  chunks.push(Buffer.from([ESC, 0x21, 0x00]));

  if (restaurantAddress) {
    for (const line of wrapText(restaurantAddress, columns)) {
      appendLine(chunks, center(line, columns));
    }
  }

  appendLine(chunks, center('CORTE DE CAJA', columns));
  appendLine(chunks, center(`TURNO #${shift?.id ?? 'S/N'}`, columns));
  appendLine(chunks, divider(columns));
  chunks.push(Buffer.from([ESC, 0x61, 0x00]));

  appendLine(chunks, labelValue('CAJERO', shift?.user?.name || 'ADMIN', columns));
  appendLine(chunks, labelValue('APERTURA', openedAt, columns));
  appendLine(chunks, labelValue('CIERRE', closedAt, columns));
  appendLine(chunks, divider(columns));

  appendLine(chunks, labelValue('FONDO INICIAL', money(shift?.openingAmount), columns));
  appendLine(chunks, labelValue('VENTAS EFEC', money(report?.totalSalesCash), columns));
  appendLine(chunks, labelValue('USD RECIBIDOS', `USD ${Number(report?.totalCashUsdIn ?? 0).toFixed(2)}`, columns));
  appendLine(chunks, labelValue('CAMBIO MXN', money(report?.totalChangeGivenMxn), columns));
  appendLine(chunks, labelValue('VENTAS TDD', money(report?.totalSalesCard), columns));
  appendLine(chunks, labelValue('ENTRADAS', money(report?.totalManualIn), columns));
  appendLine(chunks, labelValue('SALIDAS', money(report?.totalManualOut), columns));
  appendLine(chunks, divider(columns));

  appendLine(chunks, labelValue('PESOS ESP', money(report?.expectedBalance), columns));
  appendLine(chunks, labelValue('PESOS DEC', money(closingCash), columns));
  appendLine(chunks, labelValue('DIF PESOS', money(report?.cashDifference), columns));
  appendLine(chunks, labelValue('USD ESP', `USD ${Number(report?.expectedUsdBalance ?? 0).toFixed(2)}`, columns));
  appendLine(chunks, labelValue('USD DEC', `USD ${closingUsd.toFixed(2)}`, columns));
  appendLine(chunks, labelValue('DIF USD', `USD ${Number(report?.usdDifference ?? 0).toFixed(2)}`, columns));
  appendLine(chunks, labelValue('TARJETA ESP', money(report?.expectedCardBalance), columns));
  appendLine(chunks, labelValue('TARJETA DEC', money(closingCard), columns));
  appendLine(chunks, labelValue('DIF TDD', money(report?.cardDifference), columns));
  appendLine(chunks, divider(columns));

  chunks.push(Buffer.from([ESC, 0x45, 0x01]));
  appendLine(chunks, labelValue('TOTAL ESP', money(report?.totalExpectedSystem), columns));
  appendLine(chunks, labelValue('TOTAL DEC', money(totalDeclared), columns));
  appendLine(chunks, labelValue('DIF TOTAL', money(report?.totalDifference), columns));
  chunks.push(Buffer.from([ESC, 0x45, 0x00]));
  appendLine(chunks, divider(columns));

  chunks.push(Buffer.from([ESC, 0x61, 0x01]));
  if (Math.abs(totalDifference) <= 0.01) {
    appendLine(chunks, center('CAJA CONCILIADA', columns));
  } else if (totalDifference > 0) {
    appendLine(chunks, center(`SOBRANTE ${money(totalDifference)}`, columns));
  } else {
    appendLine(chunks, center(`FALTANTE ${money(Math.abs(totalDifference))}`, columns));
  }

  appendFeed(chunks, 4);
  if (cutPaper) {
    chunks.push(Buffer.from([GS, 0x56, 0x00]));
  }
  return Buffer.concat(chunks);
}

function formatAlignedText(text, alignment, columns) {
  if (alignment === 'center') {
    return center(text, columns);
  }

  if (alignment === 'right') {
    return right(text, columns);
  }

  return toAscii(text).slice(0, columns);
}

function fontMode(fontSize) {
  if (fontSize === 'xlarge') return 0x30;
  if (fontSize === 'large') return 0x20;
  if (fontSize === 'small') return 0x01;
  return 0x00;
}

function buildEscPosRenderedDocument({
  renderedDocument,
  paperWidth,
  cutPaper = true,
  openDrawer = false,
}) {
  const columns = paperWidth === '58' ? 32 : 48;
  const chunks = [];

  chunks.push(Buffer.from([ESC, 0x40]));

  for (const line of renderedDocument?.lines ?? []) {
    chunks.push(Buffer.from([ESC, 0x61, line.alignment === 'center' ? 0x01 : line.alignment === 'right' ? 0x02 : 0x00]));
    chunks.push(Buffer.from([ESC, 0x45, line.bold ? 0x01 : 0x00]));
    chunks.push(Buffer.from([ESC, 0x21, fontMode(line.fontSize)]));

    const wrapped = wrapText(line.text, columns);
    for (const part of wrapped) {
      appendLine(chunks, formatAlignedText(part, line.alignment || 'left', columns));
    }
  }

  chunks.push(Buffer.from([ESC, 0x45, 0x00]));
  chunks.push(Buffer.from([ESC, 0x21, 0x00]));
  chunks.push(Buffer.from([ESC, 0x61, 0x00]));
  appendFeed(chunks, 4);

  if (openDrawer) {
    chunks.push(Buffer.from([ESC, 0x70, 0x00, 0x19, 0xfa]));
  }

  if (cutPaper) {
    chunks.push(Buffer.from([GS, 0x56, 0x00]));
  }

  return Buffer.concat(chunks);
}

module.exports = {
  buildEscPosReceipt,
  buildEscPosDrawerPulse,
  buildEscPosShiftReport,
  buildEscPosRenderedDocument,
};
