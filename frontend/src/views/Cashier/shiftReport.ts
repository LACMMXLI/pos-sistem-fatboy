import { getSystemSettings, type ActiveShiftResponse, type ShiftSummaryResponse } from '../../services/api';
import { isDesktopRuntime, printDesktopShiftReport } from '../../lib/runtime';

export const formatMoney = (value: number) => `$${Number(value ?? 0).toFixed(2)}`;

const renderAnalyticsTables = (report: ShiftSummaryResponse) => {
  const serviceRows = (report.serviceTypeMetrics ?? [])
    .map(
      (metric) => `
        <tr>
          <td>${metric.label}</td>
          <td class="right">${metric.ordersCount}</td>
          <td class="right">${metric.itemsSold}</td>
          <td class="right">${formatMoney(metric.totalSales)}</td>
          <td class="right">${formatMoney(metric.averageTicket)}</td>
        </tr>
      `,
    )
    .join('');

  const productRows = (report.topProducts ?? [])
    .slice(0, 10)
    .map(
      (product, index) => `
        <tr>
          <td>${index + 1}. ${product.productName}</td>
          <td class="right">${product.quantitySold}</td>
          <td class="right">${formatMoney(product.grossSales)}</td>
          <td class="right">${product.orderTypes.map((bucket) => `${bucket.label}: ${bucket.quantitySold}`).join(' | ') || 'Sin datos'}</td>
        </tr>
      `,
    )
    .join('');

  return `
    <table class="grid">
      <thead>
        <tr>
          <th>Servicio</th>
          <th class="right">Ordenes</th>
          <th class="right">Pzas</th>
          <th class="right">Venta</th>
          <th class="right">Ticket</th>
        </tr>
      </thead>
      <tbody>
        ${serviceRows || '<tr><td colspan="5">Sin metricas por servicio.</td></tr>'}
      </tbody>
    </table>

    <table class="grid">
      <thead>
        <tr>
          <th>Producto</th>
          <th class="right">Pzas</th>
          <th class="right">Venta</th>
          <th class="right">Servicios</th>
        </tr>
      </thead>
      <tbody>
        ${productRows || '<tr><td colspan="4">Sin productos vendidos.</td></tr>'}
      </tbody>
    </table>
  `;
};

export const buildPrintableShiftReport = ({
  shift,
  report,
  actualCash,
  actualUsd,
  actualTerminal,
}: {
  shift: ActiveShiftResponse;
  report: ShiftSummaryResponse;
  actualCash: number;
  actualUsd: number;
  actualTerminal: number;
}) => `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>Reporte final de cierre de caja</title>
    <style>
      @page { size: 80mm auto; margin: 0; }
      body { font-family: Arial, sans-serif; color: #111; margin: 0; width: 80mm; }
      .page { width: 72mm; padding: 4mm; }
      h1, h2, p { margin: 0; }
      .header { border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 10px; text-align: center; }
      .meta, .grid, .totals { width: 100%; border-collapse: collapse; margin-top: 12px; }
      .meta td, .grid td, .grid th, .totals td { border-bottom: 1px solid #ddd; padding: 4px 2px; text-align: left; font-size: 10px; }
      .grid th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
      .right { text-align: right; }
      .summary { margin-top: 12px; padding: 8px; border: 2px solid #111; }
      .signature { margin-top: 18px; display: flex; gap: 8px; }
      .signature div { flex: 1; border-top: 1px solid #111; padding-top: 6px; text-align: center; font-size: 9px; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>
    <div class="page">
    <div class="header">
      <h1>Reporte Final de Cierre de Caja</h1>
      <p>Turno #${shift.id}</p>
      <p>Documento: REPORTE FINAL</p>
      <p>Fecha de impresión: ${new Date().toLocaleString()}</p>
    </div>

    <table class="meta">
      <tr><td><strong>Cajero</strong></td><td>${shift.user?.name || 'Administrador'}</td></tr>
      <tr><td><strong>Apertura</strong></td><td>${new Date(shift.openedAt).toLocaleString()}</td></tr>
      <tr><td><strong>Cierre</strong></td><td>${shift.closedAt ? new Date(shift.closedAt).toLocaleString() : 'Pendiente'}</td></tr>
    </table>

    <table class="grid">
      <thead>
        <tr>
          <th>Concepto</th>
          <th class="right">Sistema espera</th>
          <th class="right">Cajero declara</th>
          <th class="right">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Pesos en caja</td>
          <td class="right">${formatMoney(report.expectedBalance)}</td>
          <td class="right">${formatMoney(actualCash)}</td>
          <td class="right">${formatMoney(actualCash - Number(report.expectedBalance ?? 0))}</td>
        </tr>
        <tr>
          <td>Dolares en caja</td>
          <td class="right">USD ${Number(report.expectedUsdBalance ?? 0).toFixed(2)}</td>
          <td class="right">USD ${Number(actualUsd ?? 0).toFixed(2)}</td>
          <td class="right">USD ${(Number(actualUsd ?? 0) - Number(report.expectedUsdBalance ?? 0)).toFixed(2)}</td>
        </tr>
        <tr>
          <td>Terminal / tarjeta</td>
          <td class="right">${formatMoney(report.expectedCardBalance)}</td>
          <td class="right">${formatMoney(actualTerminal)}</td>
          <td class="right">${formatMoney(actualTerminal - Number(report.expectedCardBalance ?? 0))}</td>
        </tr>
        <tr>
          <td><strong>Total conciliado</strong></td>
          <td class="right"><strong>${formatMoney(report.totalExpectedSystem)}</strong></td>
          <td class="right"><strong>${formatMoney(actualCash + (actualUsd * Number(report.usdRateForClose ?? 0)) + actualTerminal)}</strong></td>
          <td class="right"><strong>${formatMoney((actualCash + (actualUsd * Number(report.usdRateForClose ?? 0)) + actualTerminal) - Number(report.totalExpectedSystem ?? 0))}</strong></td>
        </tr>
      </tbody>
    </table>

    <table class="totals">
      <tr><td>Fondo inicial</td><td class="right">${formatMoney(Number(shift.openingAmount))}</td></tr>
      <tr><td>Ventas efectivo</td><td class="right">${formatMoney(report.totalSalesCash)}</td></tr>
      <tr><td>USD recibidos</td><td class="right">USD ${Number(report.totalCashUsdIn ?? 0).toFixed(2)}</td></tr>
      <tr><td>Cambio entregado MXN</td><td class="right">${formatMoney(report.totalChangeGivenMxn ?? 0)}</td></tr>
      <tr><td>Ventas tarjeta</td><td class="right">${formatMoney(report.totalSalesCard)}</td></tr>
      <tr><td>Ordenes canceladas</td><td class="right">${Number(report.cancelledOrdersCount ?? 0)}</td></tr>
      <tr><td>Monto excluido por cancelacion</td><td class="right">${formatMoney(report.cancelledSalesExcluded ?? 0)}</td></tr>
      <tr><td>Ordenes con canje</td><td class="right">${Number(report.redeemedOrdersCount ?? 0)}</td></tr>
      <tr><td>Piezas canjeadas</td><td class="right">${Number(report.redeemedItemsCount ?? 0)}</td></tr>
      <tr><td>Entradas manuales</td><td class="right">${formatMoney(report.totalManualIn)}</td></tr>
      <tr><td>Salidas manuales</td><td class="right">${formatMoney(report.totalManualOut)}</td></tr>
    </table>

    <div class="summary">
      <h2>Conciliacion Final</h2>
      <p>
        ${Number(report.totalDifference ?? 0) === 0
          ? 'Caja conciliada sin diferencia.'
          : Number(report.totalDifference ?? 0) > 0
            ? `Se detecta sobrante por ${formatMoney(report.totalDifference)}.`
            : `Se detecta faltante por ${formatMoney(Math.abs(Number(report.totalDifference ?? 0)))}.`}
      </p>
      ${
        Number(report.redeemedOrdersCount ?? 0) > 0
          ? `<p style="margin-top:6px;">Los canjes por puntos se excluyen del corte y no cuentan como efectivo ni tarjeta.</p>`
          : ''
      }
    </div>

    ${renderAnalyticsTables(report)}

    <div class="signature">
      <div>Firma Cajero</div>
      <div>Firma Supervisor</div>
    </div>
    </div>
  </body>
</html>
`;

export const printShiftReport = async ({
  shift,
  report,
}: {
  shift: ActiveShiftResponse;
  report: ShiftSummaryResponse;
}) => {
  const settings = await getSystemSettings();

  if (isDesktopRuntime()) {
    await printDesktopShiftReport({
      shift,
      report,
      restaurantName: settings.restaurantName,
      restaurantAddress: settings.restaurantAddress,
      printerName: settings.receiptPrinterName ?? undefined,
      paperWidth: '80',
      copies: 1,
      cutPaper: settings.receiptCutEnabled ?? true,
    });
    return;
  }

  const printableWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printableWindow) return;

  printableWindow.document.open();
  printableWindow.document.write(
    buildPrintableShiftReport({
      shift,
      report,
      actualCash: Number(report.closingAmount ?? 0),
      actualUsd: Number(report.closingUsdAmount ?? 0),
      actualTerminal: Number(report.closingCardAmount ?? 0),
    }),
  );
  printableWindow.document.close();
  printableWindow.focus();
  printableWindow.print();
};
