import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  BarChart3,
  CalendarDays,
  Clock3,
  Download,
  FileSearch,
  HandCoins,
  LayoutList,
  Loader2,
  Mail,
  Printer,
  ReceiptText,
  Terminal,
  Wallet,
} from 'lucide-react';
import {
  getShiftSummary,
  getShifts,
  resendShiftEmail,
  type ActiveShiftResponse,
  type ShiftSummaryResponse,
} from '../../services/api';
import { formatMoney, printShiftReport } from './shiftReport';
import { toast } from 'sonner';

type ShiftHistoryTab = 'history' | 'metrics';

function getTimelineVisual(entry: any) {
  const reason = String(entry.reason ?? '').toLowerCase();
  const paymentMethod = String(entry.paymentMethod ?? '').toUpperCase();
  const paymentCurrency = String(entry.paymentCurrency ?? 'MXN').toUpperCase();
  const isSalaryAdvance = reason.includes('adelanto de sueldo');

  if (isSalaryAdvance) {
    return { icon: <HandCoins className="h-3 w-3" />, badge: 'Adelanto', tone: 'text-amber-600 border-amber-300 bg-amber-100/70' };
  }

  if (entry.sourceType === 'PAYMENT') {
    if (['CARD', 'TARJETA'].includes(paymentMethod)) {
      return { icon: <Terminal className="h-3 w-3" />, badge: 'Tarjeta', tone: 'text-sky-700 border-sky-300 bg-sky-100/70' };
    }
    if (['TRANSFER', 'TRANSFERENCIA'].includes(paymentMethod)) {
      return { icon: <ArrowRightLeft className="h-3 w-3" />, badge: 'Transferencia', tone: 'text-violet-700 border-violet-300 bg-violet-100/70' };
    }
    return { icon: <ArrowUpCircle className="h-3 w-3" />, badge: paymentCurrency === 'USD' ? 'USD' : 'Efectivo', tone: 'text-emerald-700 border-emerald-300 bg-emerald-100/70' };
  }

  return entry.movementType === 'IN'
    ? { icon: <ArrowUpCircle className="h-3 w-3" />, badge: 'Entrada', tone: 'text-green-700 border-green-300 bg-green-100/70' }
    : { icon: <ArrowDownCircle className="h-3 w-3" />, badge: 'Salida', tone: 'text-red-700 border-red-300 bg-red-100/70' };
}

function exportMetricsCsv(shift: ActiveShiftResponse, summary: ShiftSummaryResponse) {
  const serviceRows = (summary.serviceTypeMetrics ?? []).map((metric) =>
    [
      'SERVICIO',
      shift.id,
      metric.orderType,
      metric.label,
      metric.ordersCount,
      metric.itemsSold,
      metric.totalSales.toFixed(2),
      metric.averageTicket.toFixed(2),
    ].join(','),
  );

  const productRows = (summary.topProducts ?? []).map((product) =>
    [
      'PRODUCTO',
      shift.id,
      product.productId,
      `"${product.productName.replaceAll('"', '""')}"`,
      product.quantitySold,
      product.grossSales.toFixed(2),
      `"${product.orderTypes.map((bucket) => `${bucket.label}:${bucket.quantitySold}`).join(' | ').replaceAll('"', '""')}"`,
    ].join(','),
  );

  const csv = [
    'seccion,turno,id_o_tipo,etiqueta,ordenes_o_producto,piezas,venta,ticket_o_desglose',
    ...serviceRows,
    ...productRows,
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const stamp = new Date(shift.openedAt).toISOString().slice(0, 10);
  link.href = url;
  link.download = `corte-${shift.id}-metricas-${stamp}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ShiftHistoryScreen() {
  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ['cash-shifts-history'],
    queryFn: getShifts,
  });

  const [selectedShiftId, setSelectedShiftId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ShiftHistoryTab>('history');

  const closedShifts = useMemo(
    () => shifts.filter((shift: ActiveShiftResponse) => shift.status === 'CLOSED'),
    [shifts],
  );

  const selectedShift = useMemo<ActiveShiftResponse | null>(() => {
    if (!closedShifts.length) return null;
    const fallbackId = selectedShiftId ?? closedShifts[0]?.id ?? null;
    return closedShifts.find((shift: ActiveShiftResponse) => shift.id === fallbackId) ?? closedShifts[0] ?? null;
  }, [closedShifts, selectedShiftId]);

  useEffect(() => {
    setActiveTab('history');
  }, [selectedShift?.id]);

  useEffect(() => {
    if (!selectedShiftId) return;
    const selectedExists = closedShifts.some((shift: ActiveShiftResponse) => shift.id === selectedShiftId);
    if (!selectedExists) {
      setSelectedShiftId(closedShifts[0]?.id ?? null);
    }
  }, [closedShifts, selectedShiftId]);

  const { data: selectedSummary, isLoading: summaryLoading } = useQuery<ShiftSummaryResponse>({
    queryKey: ['cash-shift-summary', selectedShift?.id],
    queryFn: () => getShiftSummary(selectedShift!.id),
    enabled: !!selectedShift?.id,
  });

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-surface">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Cargando cortes...</span>
      </div>
    );
  }

  if (!closedShifts.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-surface">
        <div className="flex h-16 w-16 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
          <ReceiptText className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-headline font-black uppercase tracking-tight text-white">Sin Cortes Registrados</h2>
          <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-outline">
            Aún no existe historial de cierres para mostrar.
          </p>
        </div>
      </div>
    );
  }

  const serviceMetrics = selectedSummary?.serviceTypeMetrics ?? [];
  const topProducts = selectedSummary?.topProducts ?? [];

  return (
    <div className="flex h-full bg-surface overflow-hidden">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-outline-variant/10 bg-surface-container-low p-2 custom-scrollbar">
        <div className="mb-3">
          <h2 className="text-sm font-headline font-black uppercase tracking-tight text-white">Historial de Cortes</h2>
          <p className="text-[7px] font-bold uppercase tracking-[0.24em] text-outline">
            Consulta, impresión y análisis
          </p>
        </div>

        <div className="space-y-1.5">
          {closedShifts.map((shift: ActiveShiftResponse) => {
            const isSelected = shift.id === selectedShift?.id;
            return (
              <button
                key={shift.id}
                onClick={() => setSelectedShiftId(shift.id)}
                className={`w-full border p-2 text-left transition-all ${
                  isSelected
                    ? 'border-white/20 bg-surface-container-high'
                    : 'border-outline-variant/10 bg-surface-container-lowest hover:bg-surface-container-high'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Turno #{shift.id}</span>
                  <div className="flex items-center gap-1">
                    {isSelected ? (
                      <span className="border border-white/15 bg-white/5 px-1.5 py-0.5 text-[6px] font-black uppercase tracking-[0.18em] text-outline">
                        Seleccionado
                      </span>
                    ) : null}
                    <span className="text-[7px] font-black uppercase tracking-[0.2em] text-green-500">
                      Cerrado
                    </span>
                  </div>
                </div>
                <div className="space-y-1 text-[7px] font-bold uppercase tracking-[0.2em] text-outline">
                  <div className="flex items-center gap-1.5">
                    <Wallet className="h-3 w-3" />
                    <span className="truncate">{shift.user?.name || 'Administrador'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CalendarDays className="h-3 w-3" />
                    <span>{new Date(shift.openedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock3 className="h-3 w-3" />
                    <span>
                      {new Date(shift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {' - '}
                      {shift.closedAt
                        ? new Date(shift.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : 'En curso'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden bg-surface">
        {!selectedShift || !selectedSummary || summaryLoading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline">Cargando reporte...</span>
          </div>
        ) : (
          <div className="flex h-full flex-col gap-2 p-2">
            <div className="border border-outline-variant/10 bg-surface-container-low shadow-xl">
              <div className="border-b border-outline-variant/10 bg-surface-container-lowest px-3 py-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[8px] font-black uppercase tracking-[0.12em] text-on-surface">
                      Historial de cortes
                    </h3>
                    <p className="text-[7px] font-bold uppercase tracking-[0.12em] text-outline">
                      Turno #{selectedShift.id} | {selectedShift.user?.name || 'Administrador'} | {new Date(selectedShift.openedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {activeTab === 'metrics' ? (
                      <button
                        onClick={() => {
                          exportMetricsCsv(selectedShift, selectedSummary);
                          toast.success('Métricas exportadas a CSV');
                        }}
                        className="flex h-8 items-center gap-1.5 border border-outline-variant/15 bg-surface-container px-2.5 text-[8px] font-black uppercase tracking-[0.12em] text-white transition-all hover:border-primary/30 hover:text-primary"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Exportar
                      </button>
                    ) : null}
                    <button
                      onClick={async () => {
                        try {
                          const result = await resendShiftEmail(selectedShift.id);
                          if (result?.sent) {
                            toast.success(result?.message || 'Corte reenviado por correo');
                            return;
                          }

                          toast.error(result?.message || 'No se pudo reenviar el corte');
                        } catch (error: any) {
                          toast.error(error?.response?.data?.message || error?.message || 'No se pudo reenviar el corte');
                        }
                      }}
                      className="flex h-8 items-center gap-1.5 border border-outline-variant/15 bg-surface-container px-2.5 text-[8px] font-black uppercase tracking-[0.12em] text-white transition-all hover:border-primary/30 hover:text-primary"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      Reenviar correo
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await printShiftReport({ shift: selectedShift, report: selectedSummary });
                          toast.success('Corte enviado a impresión');
                        } catch (error: any) {
                          toast.error(error?.message || 'No se pudo imprimir el corte');
                        }
                      }}
                      className="flex h-8 items-center gap-1.5 bg-primary px-2.5 text-[8px] font-headline font-black uppercase tracking-[0.12em] text-on-primary shadow-lg shadow-primary/20 transition-all hover:brightness-110"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Imprimir
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-0.5 px-2 pt-1">
              {[
                { key: 'history', label: 'Historial', icon: <LayoutList className="h-4 w-4" /> },
                { key: 'metrics', label: 'Métricas', icon: <BarChart3 className="h-4 w-4" /> },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as ShiftHistoryTab)}
                    className={`flex items-center justify-center gap-1 rounded-t-sm border border-b-0 px-2 py-1 text-[7px] font-black uppercase tracking-[0.1em] transition-all ${
                      isActive
                        ? 'border-primary/30 bg-surface text-on-surface'
                        : 'border-outline-variant/10 bg-surface-container-high text-outline hover:text-on-surface'
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                );
              })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar border border-outline-variant/10 bg-surface-container-low shadow-xl">
              {activeTab === 'history' ? (
                <div className="grid h-full gap-3 p-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                  <div className="border border-black/10 bg-white p-8 font-mono text-black shadow-inner">
                    <div className="mb-6 border-b-2 border-dashed border-black/20 pb-4 text-center">
                      <h4 className="text-xl font-black uppercase tracking-tighter">FATBOY POS</h4>
                      <p className="text-[10px] font-bold">REPORTE FINAL DE CIERRE</p>
                      <p className="text-[8px] font-bold">DOCUMENTO FINAL CONFIRMADO</p>
                    </div>

                    <div className="space-y-2 text-[10px]">
                      <div className="flex justify-between"><span>TURNO:</span><span>#{selectedShift.id}</span></div>
                      <div className="flex justify-between"><span>CAJERO:</span><span>{selectedShift.user?.name || 'Admin'}</span></div>
                      <div className="flex justify-between"><span>APERTURA:</span><span>{new Date(selectedShift.openedAt).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span>CIERRE:</span><span>{selectedShift.closedAt ? new Date(selectedShift.closedAt).toLocaleString() : 'PENDIENTE'}</span></div>
                      <div className="my-2 h-px bg-black/10"></div>
                      <div className="flex justify-between"><span>FONDO INICIAL:</span><span>{formatMoney(Number(selectedShift.openingAmount))}</span></div>
                      <div className="flex justify-between"><span>VENTAS EFECTIVO:</span><span>{formatMoney(selectedSummary.totalSalesCash)}</span></div>
                      <div className="flex justify-between"><span>USD RECIBIDOS:</span><span>{`USD ${Number(selectedSummary.totalCashUsdIn ?? 0).toFixed(2)}`}</span></div>
                      <div className="flex justify-between"><span>CAMBIO ENTREGADO MXN:</span><span>{formatMoney(selectedSummary.totalChangeGivenMxn ?? 0)}</span></div>
                      <div className="flex justify-between"><span>VENTAS TARJETA:</span><span>{formatMoney(selectedSummary.totalSalesCard)}</span></div>
                      <div className="flex justify-between"><span>ORD. CANCELADAS:</span><span>{selectedSummary.cancelledOrdersCount ?? 0}</span></div>
                      <div className="flex justify-between"><span>MONTO EXCLUIDO:</span><span>{formatMoney(selectedSummary.cancelledSalesExcluded ?? 0)}</span></div>
                      <div className="flex justify-between"><span>ORD. CANJEADAS:</span><span>{selectedSummary.redeemedOrdersCount ?? 0}</span></div>
                      <div className="flex justify-between"><span>PZAS CANJEADAS:</span><span>{selectedSummary.redeemedItemsCount ?? 0}</span></div>
                      <div className="flex justify-between"><span>ENTRADAS MANUALES:</span><span>{formatMoney(selectedSummary.totalManualIn)}</span></div>
                      <div className="flex justify-between"><span>SALIDAS MANUALES:</span><span>{formatMoney(selectedSummary.totalManualOut)}</span></div>
                      <div className="my-2 h-px bg-black/10"></div>
                      <div className="flex justify-between font-bold"><span>PESOS ESPERADOS:</span><span>{formatMoney(selectedSummary.expectedBalance)}</span></div>
                      <div className="flex justify-between"><span>PESOS DECLARADOS:</span><span>{formatMoney(Number(selectedSummary.closingAmount ?? 0))}</span></div>
                      <div className="flex justify-between"><span>DIF. PESOS:</span><span>{formatMoney(Number(selectedSummary.cashDifference ?? 0))}</span></div>
                      <div className="flex justify-between font-bold"><span>USD ESPERADOS:</span><span>{`USD ${Number(selectedSummary.expectedUsdBalance ?? 0).toFixed(2)}`}</span></div>
                      <div className="flex justify-between"><span>USD DECLARADOS:</span><span>{`USD ${Number(selectedSummary.closingUsdAmount ?? 0).toFixed(2)}`}</span></div>
                      <div className="flex justify-between"><span>DIF. USD:</span><span>{`USD ${Number(selectedSummary.usdDifference ?? 0).toFixed(2)}`}</span></div>
                      <div className="my-2 h-px bg-black/10"></div>
                      <div className="flex justify-between font-bold"><span>TARJETA ESPERADA:</span><span>{formatMoney(selectedSummary.expectedCardBalance)}</span></div>
                      <div className="flex justify-between"><span>TARJETA DECLARADA:</span><span>{formatMoney(Number(selectedSummary.closingCardAmount ?? 0))}</span></div>
                      <div className="flex justify-between"><span>DIF. TARJETA:</span><span>{formatMoney(Number(selectedSummary.cardDifference ?? 0))}</span></div>
                      <div className="my-2 h-px bg-black/10"></div>
                      <div className="flex justify-between font-bold"><span>TOTAL ESPERADO:</span><span>{formatMoney(selectedSummary.totalExpectedSystem)}</span></div>
                      <div className="flex justify-between font-bold"><span>TOTAL DECLARADO:</span><span>{formatMoney(Number(selectedSummary.totalReported ?? 0))}</span></div>
                      <div className="flex justify-between text-lg font-black">
                        <span>DIFERENCIA:</span>
                        <span>{formatMoney(Number(selectedSummary.totalDifference ?? 0))}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex min-h-0 flex-col gap-3">
                    <div className="border border-outline-variant/10 bg-surface-container-low p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <FileSearch className="h-4 w-4 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Resultado</span>
                      </div>
                      <p className="text-[11px] font-semibold text-on-surface">
                        {Number(selectedSummary.totalDifference ?? 0) === 0
                          ? 'Caja conciliada sin diferencia.'
                          : Number(selectedSummary.totalDifference ?? 0) > 0
                            ? `Se detecta sobrante por ${formatMoney(selectedSummary.totalDifference)}.`
                            : `Se detecta faltante por ${formatMoney(Math.abs(Number(selectedSummary.totalDifference ?? 0)))}.`}
                      </p>
                      {(selectedSummary.redeemedOrdersCount ?? 0) > 0 ? (
                        <p className="mt-2 text-[9px] font-bold text-amber-200">
                          Los canjes por puntos se excluyeron del corte y no cuentan como efectivo ni tarjeta.
                        </p>
                      ) : null}
                    </div>

                    <div className="min-h-0 flex-1 border border-outline-variant/10 bg-surface-container-low p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <FileSearch className="h-4 w-4 text-primary" />
                        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-white">Historial de movimientos</span>
                      </div>
                      <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar">
                        {(selectedSummary.timeline ?? []).length === 0 ? (
                          <p className="text-[9px] uppercase text-outline">Sin movimientos registrados.</p>
                        ) : (
                          (selectedSummary.timeline ?? []).map((entry) => {
                            const visual = getTimelineVisual(entry);

                            return (
                              <div key={entry.id} className="flex items-center justify-between gap-3 border-b border-dashed border-outline-variant/10 pb-2 text-[9px]">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    {visual.icon}
                                    <span className="truncate font-bold uppercase text-white">{entry.reason}</span>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center gap-2 text-outline">
                                    <span>{new Date(entry.createdAt).toLocaleString()}</span>
                                    <span className={`border px-1 py-0.5 text-[7px] font-black uppercase ${visual.tone}`}>
                                      {visual.badge}
                                    </span>
                                    {entry.orderNumber && <span className="font-bold uppercase text-white">{entry.orderNumber}</span>}
                                  </div>
                                </div>
                                <span className="shrink-0 font-black text-white">
                                  {entry.movementType === 'IN' ? '+' : '-'}
                                  {formatMoney(Number(entry.amount))}
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full flex-col gap-2 p-2">
                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-5">
                    <div className="border border-outline-variant/10 bg-surface-container-high px-2.5 py-2">
                      <span className="block text-[6px] font-black uppercase tracking-[0.1em] text-outline">Ventas del turno</span>
                      <span className="mt-0.5 block text-[11px] font-headline font-black uppercase text-on-surface truncate">
                        {formatMoney(selectedSummary.totalSalesRegistered)}
                      </span>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high px-2.5 py-2">
                      <span className="block text-[6px] font-black uppercase tracking-[0.1em] text-outline">Canjes excluidos</span>
                      <span className="mt-0.5 block text-[11px] font-headline font-black uppercase text-amber-200 truncate">
                        {selectedSummary.redeemedItemsCount ?? 0} pzs
                      </span>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high px-2.5 py-2">
                      <span className="block text-[6px] font-black uppercase tracking-[0.1em] text-outline">Servicios analizados</span>
                      <span className="mt-0.5 block text-[11px] font-headline font-black uppercase text-on-surface truncate">
                        {String(serviceMetrics.length).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high px-2.5 py-2">
                      <span className="block text-[6px] font-black uppercase tracking-[0.1em] text-outline">Producto líder</span>
                      <span className="mt-0.5 block text-[11px] font-headline font-black uppercase text-on-surface truncate">
                        {topProducts[0]?.productName || 'Sin ventas'}
                      </span>
                    </div>
                    <div className="border border-outline-variant/10 bg-surface-container-high px-2.5 py-2">
                      <span className="block text-[6px] font-black uppercase tracking-[0.1em] text-outline">Servicio líder</span>
                      <span className="mt-0.5 block text-[11px] font-headline font-black uppercase text-on-surface truncate">
                        {serviceMetrics[0]?.label || 'Sin datos'}
                      </span>
                    </div>
                  </div>

                  <div className="grid min-h-0 flex-1 gap-2 xl:grid-cols-[minmax(360px,0.95fr)_minmax(0,1.05fr)]">
                    <div className="space-y-2">
                      <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-[10px] font-headline font-black uppercase tracking-[0.16em] text-white">Métricas por Servicio</h4>
                            <p className="text-[7px] font-bold uppercase tracking-[0.16em] text-outline">
                            Ventas reales por tipo de pedido registradas en base de datos
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {serviceMetrics.length === 0 ? (
                            <p className="text-[10px] text-outline">No hay métricas de servicio disponibles en este corte.</p>
                          ) : (
                            serviceMetrics.map((metric) => (
                              <div key={metric.orderType} className="border border-outline-variant/10 bg-surface-container-lowest p-2">
                                <div className="mb-1.5 flex items-center justify-between gap-2">
                                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-white">{metric.label}</span>
                                  <span className="text-[10px] font-black text-primary">{formatMoney(metric.totalSales)}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[7px] font-bold uppercase tracking-[0.14em] text-outline">
                                  <div>
                                    <p>Órdenes</p>
                                    <p className="mt-0.5 text-[10px] font-black text-white">{metric.ordersCount}</p>
                                  </div>
                                  <div>
                                    <p>Piezas</p>
                                    <p className="mt-0.5 text-[10px] font-black text-white">{metric.itemsSold}</p>
                                  </div>
                                  <div>
                                    <p>Ticket</p>
                                    <p className="mt-0.5 text-[10px] font-black text-white">{formatMoney(metric.averageTicket)}</p>
                                  </div>
                                </div>
                                <div className="mt-1.5 border-t border-outline-variant/10 pt-1.5">
                                  <p className="mb-1 text-[6px] font-black uppercase tracking-[0.16em] text-outline">Top productos del servicio</p>
                                  <div className="space-y-1 text-[8px]">
                                    {metric.topProducts.length === 0 ? (
                                      <p className="text-outline">Sin productos en este servicio.</p>
                                    ) : (
                                      metric.topProducts.slice(0, 3).map((product) => (
                                        <div key={`${metric.orderType}-${product.productId}`} className="flex items-center justify-between gap-2">
                                          <span className="truncate font-semibold text-white">{product.productName}</span>
                                          <span className="shrink-0 font-black text-outline">
                                            {product.quantitySold} pzs | {formatMoney(product.grossSales)}
                                          </span>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="border border-outline-variant/10 bg-surface-container-high p-2.5">
                      <h4 className="text-[10px] font-headline font-black uppercase tracking-[0.16em] text-white">Productos Más Vendidos</h4>
                      <p className="mb-2 text-[7px] font-bold uppercase tracking-[0.16em] text-outline">
                        Ranking validado por productos capturados dentro del turno
                      </p>

                      <div className="space-y-1.5">
                        {topProducts.length === 0 ? (
                          <p className="text-[10px] text-outline">Este corte no tiene productos vendidos para analizar.</p>
                        ) : (
                          topProducts.map((product, index) => (
                            <div key={product.productId} className="grid grid-cols-[30px_minmax(0,1fr)_auto] items-start gap-2 border border-outline-variant/10 bg-surface-container-lowest px-2 py-1.5">
                              <div className="flex h-7 w-7 items-center justify-center border border-primary/20 bg-primary/10 text-[9px] font-black text-primary">
                                {String(index + 1).padStart(2, '0')}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-white">{product.productName}</p>
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {product.orderTypes.map((bucket) => (
                                    <span
                                      key={`${product.productId}-${bucket.orderType}`}
                                      className="border border-outline-variant/10 bg-surface-container px-1 py-0.5 text-[6px] font-black uppercase tracking-[0.12em] text-outline"
                                    >
                                      {bucket.label}: {bucket.quantitySold}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-[10px] font-black text-white">{product.quantitySold} pzs</p>
                                <p className="text-[8px] font-black text-primary">{formatMoney(product.grossSales)}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
