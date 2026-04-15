import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowDownCircle,
  Lock,
  ArrowUpCircle,
  ArrowRightLeft,
  BarChart3,
  X,
  Banknote,
  Terminal,
  CheckCircle2,
  Loader2,
  Play,
  HandCoins,
  UserRound
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { queryKeys } from '../../lib/queryKeys';
import { useAuthStore } from '../../store/authStore';
import {
  type CloseShiftResponse,
  type ActiveShiftResponse,
  type ShiftSummaryResponse,
  getActiveShift,
  getCurrentShiftSummary,
  openShift,
  addCashMovement,
  closeShift,
  getEmployeesBasicList,
  createEmployeeAdvance,
} from '../../services/api';
import { formatMoney, printShiftReport } from './shiftReport';
import { useShiftStore } from '../../store/shiftStore';

function getMovementVisual(move: any) {
  const reason = String(move.reason ?? '').toLowerCase();
  const paymentMethod = String(move.paymentMethod ?? '').toUpperCase();
  const paymentCurrency = String(move.paymentCurrency ?? 'MXN').toUpperCase();
  const isSalaryAdvance = reason.includes('adelanto de sueldo');

  if (isSalaryAdvance) {
    return {
      icon: <HandCoins className="w-2.5 h-2.5" />,
      tone: 'salary',
      badge: 'Adelanto',
    };
  }

  if (move.sourceType === 'PAYMENT') {
    if (['CARD', 'TARJETA'].includes(paymentMethod)) {
      return {
        icon: <Terminal className="w-2.5 h-2.5" />,
        tone: 'card',
        badge: 'Tarjeta',
      };
    }

    if (['TRANSFER', 'TRANSFERENCIA'].includes(paymentMethod)) {
      return {
        icon: <ArrowRightLeft className="w-2.5 h-2.5" />,
        tone: 'transfer',
        badge: 'Transferencia',
      };
    }

    if (['CASH', 'EFECTIVO'].includes(paymentMethod)) {
      return {
        icon: <Banknote className="w-2.5 h-2.5" />,
        tone: 'cash',
        badge: paymentCurrency === 'USD' ? 'USD' : 'Efectivo',
      };
    }

    return {
      icon: <CheckCircle2 className="w-2.5 h-2.5" />,
      tone: 'payment',
      badge: 'Pago',
    };
  }

  return move.movementType === 'IN'
    ? {
        icon: <ArrowUpCircle className="w-2.5 h-2.5" />,
        tone: 'in',
        badge: 'Entrada',
      }
    : {
        icon: <ArrowDownCircle className="w-2.5 h-2.5" />,
        tone: 'out',
        badge: 'Salida',
      };
}

function getMovementToneClasses(tone: string) {
  switch (tone) {
    case 'salary':
      return 'bg-amber-500/10 border-amber-500/30 text-amber-400';
    case 'card':
      return 'bg-sky-500/10 border-sky-500/30 text-sky-300';
    case 'transfer':
      return 'bg-violet-500/10 border-violet-500/30 text-violet-300';
    case 'cash':
      return 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300';
    case 'payment':
      return 'bg-primary/10 border-primary/30 text-primary';
    case 'in':
      return 'bg-green-500/10 border-green-500/20 text-green-500';
    default:
      return 'bg-red-500/10 border-red-500/20 text-red-500';
  }
}

type EmployeeOption = {
  id: number;
  fullName: string;
  isActive: boolean;
};

export function CashierScreen() {
  const role = useAuthStore((state) => state.user?.role ?? '');
  const canCloseShift = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(role ?? '');
  const queryClient = useQueryClient();
  const setActiveShift = useShiftStore((state) => state.setActiveShift);
  const clearShift = useShiftStore((state) => state.clearShift);
  const [isCloseShiftOpen, setIsCloseShiftOpen] = useState(false);
  const [isCashOutOpen, setIsCashOutOpen] = useState(false);
  const [isSalaryAdvanceOpen, setIsSalaryAdvanceOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('100.00');

  const { data: currentShift, isLoading, error } = useQuery({
    queryKey: queryKeys.activeShift,
    queryFn: getActiveShift,
    retry: false,
  });

  useEffect(() => {
    if (currentShift && currentShift.status !== 'CLOSED') {
      setActiveShift(currentShift);
      return;
    }

    clearShift();
  }, [currentShift, setActiveShift, clearShift]);

  const { data: shiftSummary } = useQuery({
    queryKey: queryKeys.activeShiftSummary,
    queryFn: getCurrentShiftSummary,
    enabled: !!currentShift && currentShift.status !== 'CLOSED',
    retry: false,
  });

  const openShiftMutation = useMutation({
    mutationFn: () => openShift(parseFloat(openingAmount)),
    onSuccess: (shift) => {
      setActiveShift(shift);
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
    },
  });

  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Sincronizando Turno...</span>
      </div>
    );
  }

  // If no shift is active (not found or explicitly closed)
  if (!currentShift || currentShift.status === 'CLOSED') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-surface relative overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-10 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none"></div>
        <div className="relative z-10 w-full max-w-sm bg-surface-container-low p-8 border border-outline-variant/10 shadow-2xl">
          <div className="w-16 h-16 bg-primary/10 flex items-center justify-center text-primary border border-primary/20 mx-auto mb-6">
            <Wallet className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-black text-white text-center font-headline uppercase tracking-tighter mb-2">Apertura de Caja</h2>
          <p className="text-outline text-center text-[10px] font-bold uppercase tracking-widest mb-8">El turno actual está cerrado. Ingrese el fondo inicial para comenzar.</p>

          <div className="space-y-4">
            <div>
              <label className="text-[8px] font-bold text-outline uppercase tracking-widest mb-1.5 block">Monto Inicial (Efectivo)</label>
              <div className="relative">
                <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                <input
                  type="number"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="w-full bg-surface-container-highest border border-outline-variant/20 py-3 pl-10 pr-4 text-xl font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-bold uppercase"
                />
              </div>
            </div>
            <button
              onClick={() => openShiftMutation.mutate()}
              disabled={openShiftMutation.isPending}
              className="w-full h-14 bg-primary text-on-primary font-headline font-black uppercase text-xs tracking-[0.2em] shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              {openShiftMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              Abrir Turno Ahora
            </button>
          </div>
        </div>
      </div>
    );
  }

  const expectedCash = Number(shiftSummary?.expectedBalance ?? currentShift.openingAmount);
  const expectedTerminal = Number(shiftSummary?.expectedCardBalance ?? 0);
  const totalSalesCash = Number(shiftSummary?.totalSalesCash ?? 0);
  const totalSalesCard = Number(shiftSummary?.totalSalesCard ?? 0);
  const totalSales = Number(shiftSummary?.totalSalesRegistered ?? 0);
  const cancelledOrdersCount = Number(shiftSummary?.cancelledOrdersCount ?? 0);
  const cancelledSalesExcluded = Number(shiftSummary?.cancelledSalesExcluded ?? 0);
  const redeemedOrdersCount = Number(shiftSummary?.redeemedOrdersCount ?? 0);
  const redeemedItemsCount = Number(shiftSummary?.redeemedItemsCount ?? 0);

  return (
    <div className="h-full flex flex-col bg-surface overflow-hidden relative">
      <div className="flex-1 flex overflow-hidden">
        {/* Left Pane: Shift Summary & Actions */}
        <div className="w-56 border-r border-outline-variant/10 flex flex-col bg-surface-container-low px-2 py-1.5 overflow-y-auto custom-scrollbar">
          <div className="mb-2">
            <h2 className="font-headline text-sm font-black text-white tracking-tighter uppercase mb-0.5">Control de Caja</h2>
            <p className="text-outline font-label tracking-widest uppercase text-[6px]">Gestión de turno y efectivo</p>
          </div>

          <div className="space-y-1.5">
            <div className="bg-surface-container-lowest p-2 border border-outline-variant/10 shadow-xl font-bold">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="block text-[7px] font-bold text-outline uppercase tracking-widest">Turno Activo</span>
                  <span className="text-xs font-black text-white uppercase tracking-tight">#{currentShift.id}</span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center py-0.5 border-b border-outline-variant/5">
                  <span className="text-[7px] font-bold text-outline uppercase">Apertura</span>
                  <span className="text-[8px] font-black text-on-surface">{new Date(currentShift.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between items-center py-0.5 border-b border-outline-variant/5 gap-2">
                  <span className="text-[7px] font-bold text-outline uppercase">Cajero</span>
                  <span className="text-[8px] font-black text-on-surface truncate text-right">{currentShift.user?.name || 'Administrador'}</span>
                </div>
                <div className="flex justify-between items-center py-0.5">
                  <span className="text-[7px] font-bold text-outline uppercase">Fondo Inicial</span>
                  <span className="text-[8px] font-black text-primary">${Number(currentShift.openingAmount).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button
                onClick={() => setIsCashOutOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 bg-amber-500/15 text-amber-300 font-headline font-black uppercase tracking-widest hover:bg-amber-500/25 hover:text-amber-200 transition-all active:scale-95 border border-amber-500/30 text-[8px] shadow-lg shadow-amber-500/10"
              >
                <ArrowDownCircle className="w-3.5 h-3.5" /> Salida Efectivo
              </button>
              <button
                onClick={() => setIsSalaryAdvanceOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-3 bg-sky-500/15 text-sky-300 font-headline font-black uppercase tracking-widest hover:bg-sky-500/25 hover:text-sky-200 transition-all active:scale-95 border border-sky-500/30 text-[8px] shadow-lg shadow-sky-500/10"
              >
                <HandCoins className="w-3.5 h-3.5" /> Adelanto Sueldo
              </button>
              <button
                onClick={() => setIsCloseShiftOpen(true)}
                disabled={!canCloseShift}
                className="w-full mt-8 flex items-center justify-center gap-1.5 py-3 bg-primary text-on-primary font-headline font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-[8px]"
              >
                <Lock className="w-3.5 h-3.5" /> Cerrar Turno
              </button>
              {!canCloseShift && (
                <p className="text-[7px] font-bold uppercase tracking-widest text-outline text-center">
                  No tienes permisos para cerrar turno
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Right Pane: Detailed Report & Movements */}
        <div className="flex-1 flex flex-col bg-surface p-1.5 overflow-hidden">
          <div className="grid grid-cols-3 gap-1.5 mb-2 shrink-0">
            <div className="bg-surface-container-low p-1.5 border-l-4 border-primary shadow-sm min-w-0">
              <span className="block text-[6px] font-bold text-outline uppercase tracking-widest mb-0.5">Efectivo sistema</span>
              <span className="text-base font-headline font-black text-green-500">${totalSalesCash.toFixed(2)}</span>
            </div>
            <div className="bg-surface-container-low p-1.5 border-l-4 border-green-500 shadow-sm min-w-0">
              <span className="block text-[6px] font-bold text-outline uppercase tracking-widest mb-0.5">Tarjeta sistema</span>
              <span className="text-base font-headline font-black text-secondary">${totalSalesCard.toFixed(2)}</span>
            </div>
            <div className="bg-surface-container-low p-1.5 border-l-4 border-secondary shadow-sm min-w-0">
              <span className="block text-[6px] font-bold text-outline uppercase tracking-widest mb-0.5">Total sistema</span>
              <span className="text-base font-headline font-black text-white">${totalSales.toFixed(2)}</span>
            </div>
          </div>

          {(cancelledOrdersCount > 0 || cancelledSalesExcluded > 0) && (
            <div className="mb-2 rounded-none border border-red-500/20 bg-red-500/10 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-red-400">
                  Cancelaciones Aplicadas
                </span>
                <span className="text-[10px] font-black text-red-300">
                  {cancelledOrdersCount} orden{cancelledOrdersCount === 1 ? '' : 'es'}
                </span>
              </div>
              <p className="mt-1 text-[9px] font-bold text-red-200">
                {cancelledSalesExcluded > 0
                  ? `${formatMoney(cancelledSalesExcluded)} excluidos del corte.`
                  : 'Las órdenes canceladas se muestran en historial pero no afectan este corte.'}
              </p>
            </div>
          )}

          {(redeemedOrdersCount > 0 || redeemedItemsCount > 0) && (
            <div className="mb-2 rounded-none border border-amber-400/20 bg-amber-400/10 px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[8px] font-black uppercase tracking-[0.18em] text-amber-200">
                  Canjes por puntos
                </span>
                <span className="text-[10px] font-black text-amber-100">
                  {redeemedOrdersCount} orden{redeemedOrdersCount === 1 ? '' : 'es'} | {redeemedItemsCount} pza{redeemedItemsCount === 1 ? '' : 's'}
                </span>
              </div>
              <p className="mt-1 text-[9px] font-bold text-amber-100">
                Se enviaron a cocina dentro de la orden, pero no generan cobro ni se contabilizan en efectivo o tarjeta del corte.
              </p>
            </div>
          )}

          <div className="flex flex-1 min-h-0">
            <section className="min-h-0 flex-1 flex flex-col">
              <h3 className="text-[8px] font-bold text-outline uppercase tracking-[0.18em] mb-1.5 flex items-center gap-1.5 shrink-0">
                <ArrowRightLeft className="w-2.5 h-2.5" /> Movimientos
              </h3>
              <div className="bg-surface-container-low overflow-y-auto border border-outline-variant/5 min-h-0 custom-scrollbar">
                {currentShift.movements?.map((m: any) => (
                  (() => {
                    const visual = getMovementVisual(m);
                    const amount = Number(m.amount);

                    return (
                      <div
                        key={m.id}
                        className={cn(
                          'px-1.5 py-1 flex items-center justify-between border-b border-outline-variant/5 transition-colors',
                          visual.tone === 'salary' ? 'bg-amber-500/5 hover:bg-amber-500/10' : 'hover:bg-surface-container-high',
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn(
                            'w-5 h-5 flex items-center justify-center border shrink-0',
                            getMovementToneClasses(visual.tone),
                          )}>
                            {visual.icon}
                          </div>
                          <div className="min-w-0">
                            <span className="block text-[8px] font-bold text-on-surface uppercase truncate">{m.reason}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[7px] text-outline uppercase font-bold tracking-widest">
                                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={cn(
                                'px-1 py-0.5 text-[6px] font-black uppercase tracking-[0.14em] border',
                                getMovementToneClasses(visual.tone),
                              )}>
                                {visual.badge}
                              </span>
                              {m.orderNumber && (
                                <span className="text-[6px] text-outline uppercase font-bold tracking-[0.14em]">
                                  {m.orderNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={cn(
                            'block text-[9px] font-black',
                            visual.tone === 'salary'
                              ? 'text-amber-300'
                              : m.movementType === 'IN'
                                ? 'text-green-500'
                                : 'text-red-500',
                          )}>
                            {m.movementType === 'IN' ? '+' : '-'}${amount.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    );
                  })()
                ))}
                {(!currentShift.movements || currentShift.movements.length === 0) && (
                  <div className="p-4 text-center text-outline opacity-30 uppercase font-bold tracking-widest text-[7px]">
                    Sin movimientos
                  </div>
                )}
              </div>
            </section>

            <section className="col-span-4 min-h-0" />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {isCloseShiftOpen && (
          <CloseShiftModal
            shift={{
              ...currentShift,
              ...shiftSummary,
            }}
            onClose={() => setIsCloseShiftOpen(false)}
          />
        )}
        {isCashOutOpen && (
          <CashOutModal
            shiftId={currentShift.id}
            onClose={() => setIsCashOutOpen(false)}
          />
        )}
        {isSalaryAdvanceOpen && (
          <SalaryAdvanceModal
            onClose={() => setIsSalaryAdvanceOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CloseShiftModal({
  shift,
  onClose,
}: {
  shift: ActiveShiftResponse & Partial<ShiftSummaryResponse>;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [actualCash, setActualCash] = useState('0');
  const [actualUsd, setActualUsd] = useState('0');
  const [actualTerminal, setActualTerminal] = useState('0');
  const [step, setStep] = useState<'input' | 'preview' | 'result'>('input');
  const [closedResult, setClosedResult] = useState<CloseShiftResponse | null>(null);

  const effectiveReport = (closedResult?.report ?? shift) as ShiftSummaryResponse;
  const effectiveShift = closedResult?.shift ?? shift;
  const actualCashNumber = parseFloat(actualCash || '0');
  const actualUsdNumber = parseFloat(actualUsd || '0');
  const actualTerminalNumber = parseFloat(actualTerminal || '0');

  const closeMutation = useMutation({
    mutationFn: () => closeShift(shift.id, {
      closingAmount: actualCashNumber,
      closingUsdAmount: actualUsdNumber,
      closingCardAmount: actualTerminalNumber,
    }),
    onSuccess: (data) => {
      useShiftStore.getState().clearShift();
      setClosedResult(data);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
    },
  });

  const cashDiff = actualCashNumber - Number(effectiveReport.expectedBalance ?? 0);
  const usdDiff = actualUsdNumber - Number(effectiveReport.expectedUsdBalance ?? 0);
  const terminalDiff = actualTerminalNumber - Number(effectiveReport.expectedCardBalance ?? 0);
  const usdRateForClose = Number(effectiveReport.usdRateForClose ?? 0);
  const totalDiff = cashDiff + (usdDiff * usdRateForClose) + terminalDiff;

  const handlePrint = async () => {
    try {
      await printShiftReport({
        shift: {
          ...effectiveShift,
          closingAmount: String(actualCashNumber),
          closingUsdAmount: String(actualUsdNumber),
          closingCardAmount: String(actualTerminalNumber),
        },
        report: {
          ...effectiveReport,
          closingAmount: actualCashNumber,
          closingUsdAmount: actualUsdNumber,
          closingCardAmount: actualTerminalNumber,
        },
      });
      toast.success('Corte enviado a impresion');
    } catch (error: any) {
      toast.error(error?.message || 'No se pudo imprimir el corte');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-5xl bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
      >
        <div className="p-4 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest">
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter font-headline uppercase leading-none mb-1">Cierre de Turno</h2>
            <p className="text-outline font-label tracking-widest uppercase text-[8px]">Conciliación y arqueo de caja</p>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container-highest text-outline hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto custom-scrollbar">
          {step === 'input' ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Efectivo Real en Caja</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      type="number"
                      value={actualCash}
                      onChange={(e) => setActualCash(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 py-3 pl-10 pr-4 text-lg font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all uppercase"
                    />
                  </div>
                  <div className="flex justify-between px-1">
                    <span className="text-[8px] text-outline uppercase font-bold">Captura física</span>
                    <span className="text-[8px] text-on-surface font-black">Sin pista del sistema</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Dolares Reales en Caja</label>
                  <div className="relative">
                    <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={actualUsd}
                      onChange={(e) => setActualUsd(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 py-3 pl-10 pr-4 text-lg font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all uppercase"
                    />
                  </div>
                  <div className="flex justify-between px-1">
                    <span className="text-[8px] text-outline uppercase font-bold">Billetes guardados</span>
                    <span className="text-[8px] text-on-surface font-black">Se concilia aparte</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Ventas Real Terminal</label>
                  <div className="relative">
                    <Terminal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
                    <input
                      type="number"
                      value={actualTerminal}
                      onChange={(e) => setActualTerminal(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 py-3 pl-10 pr-4 text-lg font-black text-white focus:outline-none focus:ring-2 focus:ring-secondary/30 transition-all uppercase"
                    />
                  </div>
                  <div className="flex justify-between px-1">
                    <span className="text-[8px] text-outline uppercase font-bold">Captura física</span>
                    <span className="text-[8px] text-on-surface font-black">Sin pista del sistema</span>
                  </div>
                </div>
              </div>
              <div className="p-3 border bg-surface-container-highest border-outline-variant/10">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 flex items-center justify-center bg-primary/10 text-primary">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="block text-[9px] font-black uppercase tracking-widest text-on-surface">
                      Conciliación protegida
                    </span>
                    <span className="text-[8px] text-outline uppercase font-bold">
                      Puedes cerrar incluso declarando cero. La diferencia contra sistema sólo se muestra después del cierre.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-white p-4 text-black font-mono shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-black/10"></div>
                <div className="text-center mb-3 border-b border-dashed border-black/20 pb-2">
                  <h3 className="text-lg font-black uppercase tracking-tighter">FATBOY POS</h3>
                  <p className="text-[9px] font-bold">
                    {step === 'result' ? 'REPORTE FINAL DE CIERRE' : 'VISTA PREVIA DEL CIERRE'}
                  </p>
                  <p className="text-[8px] font-bold">
                    {step === 'result' ? 'DOCUMENTO FINAL CONFIRMADO' : 'DOCUMENTO PREVIO NO CONFIRMADO'}
                  </p>
                  <p className="text-[8px]">{new Date().toLocaleString()}</p>
                </div>

                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <div className="space-y-1.5">
                    <CompactLine label="Turno" value={`#${effectiveShift.id}`} />
                    <CompactLine label="Cajero" value={effectiveShift.user?.name || 'Admin'} />
                    <CompactLine label="Apertura" value={new Date(effectiveShift.openedAt).toLocaleString()} />
                    <CompactLine label="Cierre" value={effectiveShift.closedAt ? new Date(effectiveShift.closedAt).toLocaleString() : 'AUN NO CONFIRMADO'} />
                  </div>
                  <div className="space-y-1.5">
                    <CompactLine label="Fondo inicial" value={formatMoney(effectiveReport.openingAmount)} />
                    <CompactLine label="Ventas efectivo" value={formatMoney(effectiveReport.totalSalesCash)} />
                    <CompactLine label="USD recibidos" value={`USD ${Number(effectiveReport.totalCashUsdIn ?? 0).toFixed(2)}`} />
                    <CompactLine label="Cambio entregado MXN" value={formatMoney(effectiveReport.totalChangeGivenMxn ?? 0)} />
                    <CompactLine label="Ventas tarjeta" value={formatMoney(effectiveReport.totalSalesCard)} />
                    <CompactLine label="Entradas manuales" value={formatMoney(effectiveReport.totalManualIn)} />
                    <CompactLine label="Salidas manuales" value={formatMoney(effectiveReport.totalManualOut)} />
                    <CompactLine label="Ord. canceladas" value={String(effectiveReport.cancelledOrdersCount ?? 0)} />
                    <CompactLine label="Monto excluido" value={formatMoney(effectiveReport.cancelledSalesExcluded ?? 0)} />
                    <CompactLine label="Ord. canjeadas" value={String(effectiveReport.redeemedOrdersCount ?? 0)} />
                    <CompactLine label="Pzas canjeadas" value={String(effectiveReport.redeemedItemsCount ?? 0)} />
                  </div>
                </div>

                <div className="h-px bg-black/10 my-3"></div>

                {step === 'result' ? (
                  <div className="grid grid-cols-3 gap-2">
                    <CompactCard label="Pesos esperados" value={formatMoney(effectiveReport.expectedBalance)} />
                    <CompactCard label="Pesos declarados" value={formatMoney(actualCashNumber)} />
                    <CompactCard label="Dif. pesos" value={formatMoney(cashDiff)} highlight />
                    <CompactCard label="USD esperados" value={`USD ${Number(effectiveReport.expectedUsdBalance ?? 0).toFixed(2)}`} />
                    <CompactCard label="USD declarados" value={`USD ${actualUsdNumber.toFixed(2)}`} />
                    <CompactCard label="Dif. USD" value={`USD ${usdDiff.toFixed(2)}`} highlight />
                    <CompactCard label="Tarjeta esperada" value={formatMoney(effectiveReport.expectedCardBalance)} />
                    <CompactCard label="Tarjeta declarada" value={formatMoney(actualTerminalNumber)} />
                    <CompactCard label="Dif. tarjeta" value={formatMoney(terminalDiff)} highlight />
                    <CompactCard label="Total esperado" value={formatMoney(effectiveReport.totalExpectedSystem)} />
                    <CompactCard label="Total declarado" value={formatMoney(actualCashNumber + (actualUsdNumber * usdRateForClose) + actualTerminalNumber)} />
                    <CompactCard label="Diferencia" value={`$${totalDiff.toFixed(2)}`} strong />
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <CompactCard label="Pesos declarados" value={formatMoney(actualCashNumber)} />
                    <CompactCard label="USD declarados" value={`USD ${actualUsdNumber.toFixed(2)}`} />
                    <CompactCard label="Tarjeta declarada" value={formatMoney(actualTerminalNumber)} />
                    <CompactCard label="Total declarado" value={formatMoney(actualCashNumber + (actualUsdNumber * usdRateForClose) + actualTerminalNumber)} strong />
                  </div>
                )}

                <div className="mt-3 text-center border-t border-dashed border-black/20 pt-2">
                  <p className="text-[7px] font-bold uppercase">
                    {step === 'result' ? '*** FIN DEL REPORTE FINAL ***' : '*** FIN DE LA VISTA PREVIA ***'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-surface-container-lowest border-t border-outline-variant/10 flex gap-3">
          {step === 'input' ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest hover:text-white transition-all text-[10px]"
              >
                Cancelar
              </button>
              <button
                onClick={() => setStep('preview')}
                className="flex-1 py-3 bg-primary text-on-primary font-headline font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all text-[10px]"
              >
                Vista Previa
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setStep(step === 'result' ? 'result' : 'input')}
                className="flex-1 py-3 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest hover:text-white transition-all text-[10px]"
              >
                {step === 'result' ? 'Reporte Final' : 'Atrás'}
              </button>
              {step === 'preview' ? (
                <>
                  <button
                    onClick={() => closeMutation.mutate()}
                    disabled={closeMutation.isPending}
                    className="flex-[2] py-3 bg-green-500 text-white font-headline font-black uppercase tracking-widest shadow-lg shadow-green-500/20 hover:brightness-110 transition-all text-[10px] flex items-center justify-center gap-2"
                  >
                    {closeMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Cierre'}
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={handlePrint}
                    className="flex-1 py-3 bg-primary text-on-primary font-headline font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all text-[10px]"
                  >
                    Imprimir Ticket 80mm
                  </button>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 bg-green-500 text-white font-headline font-black uppercase tracking-widest shadow-lg shadow-green-500/20 hover:brightness-110 transition-all text-[10px]"
                  >
                    Cerrar
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function CompactLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[9px]">
      <span className="font-bold uppercase">{label}:</span>
      <span className="font-black text-right">{value}</span>
    </div>
  );
}

function CompactCard({
  label,
  value,
  highlight = false,
  strong = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  strong?: boolean;
}) {
  return (
    <div className={cn('border border-black/10 px-2 py-1.5', highlight && 'bg-black/[0.03]', strong && 'border-black/20 bg-black/[0.04]')}>
      <span className="block text-[7px] font-bold uppercase">{label}</span>
      <span className={cn('mt-0.5 block text-[11px] font-black uppercase', strong && 'text-[12px]')}>{value}</span>
    </div>
  );
}

function CashOutModal({ shiftId, onClose }: { shiftId: number, onClose: () => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  const movementMutation = useMutation({
    mutationFn: () => addCashMovement(shiftId, {
      movementType: 'OUT',
      amount: parseFloat(amount),
      reason
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
      onClose();
    },
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest">
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter font-headline uppercase leading-none mb-1">Salida de Efectivo</h2>
            <p className="text-outline font-label tracking-widest uppercase text-[8px]">Retiro de dinero de la caja</p>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container-highest text-outline hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Monto a Retirar</label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                      className="w-full bg-surface-container-lowest border border-outline-variant/20 py-3 pl-10 pr-4 text-lg font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-bold uppercase"
                    />
                  </div>
                </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Concepto / Motivo</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Pago a proveedor de pan..."
              rows={3}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 p-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none uppercase"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest hover:text-white transition-all text-[10px]"
            >
              Cancelar
            </button>
            <button
              onClick={() => movementMutation.mutate()}
              disabled={movementMutation.isPending || !amount || !reason}
              className="flex-1 py-3 bg-primary text-on-primary font-headline font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-[10px] flex items-center justify-center gap-2"
            >
              {movementMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Registrar Salida'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SalaryAdvanceModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const { data: employees = [], isLoading: isLoadingEmployees } = useQuery<EmployeeOption[]>({
    queryKey: ['employees-cashier-advance'],
    queryFn: getEmployeesBasicList,
  });

  useEffect(() => {
    if (!employeeId && employees.length > 0) {
      const firstActiveEmployee = employees.find((employee) => employee.isActive) ?? employees[0];
      if (firstActiveEmployee) {
        setEmployeeId(String(firstActiveEmployee.id));
      }
    }
  }, [employees, employeeId]);

  const advanceMutation = useMutation({
    mutationFn: () => {
      const numericAmount = Number(amount);

      if (!employeeId) {
        throw new Error('Selecciona un empleado');
      }

      if (!numericAmount || numericAmount <= 0) {
        throw new Error('Captura un monto válido');
      }

      return createEmployeeAdvance(employeeId, {
        amount: numericAmount,
        description: description.trim() || undefined,
      });
    },
    onSuccess: () => {
      toast.success('Adelanto registrado en caja');
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
      queryClient.invalidateQueries({ queryKey: ['employees-admin'] });
      queryClient.invalidateQueries({ queryKey: ['employees-payroll'] });
      queryClient.invalidateQueries({ queryKey: ['employees-cashier-advance'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo registrar el adelanto');
    },
  });

  const activeEmployees = employees.filter((employee) => employee.isActive);
  const employeeList = activeEmployees.length > 0 ? activeEmployees : employees;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md bg-surface-container-low border border-outline-variant/20 shadow-2xl overflow-hidden"
      >
        <div className="p-5 border-b border-outline-variant/10 flex justify-between items-center bg-surface-container-lowest">
          <div>
            <h2 className="text-xl font-black text-white tracking-tighter font-headline uppercase leading-none mb-1">Adelanto de Sueldo</h2>
            <p className="text-outline font-label tracking-widest uppercase text-[8px]">Salida de caja ligada al expediente del empleado</p>
          </div>
          <button onClick={onClose} className="p-2 bg-surface-container-highest text-outline hover:text-white transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Empleado</label>
            <div className="relative">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline pointer-events-none" />
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={isLoadingEmployees || employeeList.length === 0}
                className="w-full appearance-none bg-surface-container-lowest border border-outline-variant/20 py-3 pl-10 pr-4 text-sm font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all uppercase"
              >
                <option value="">
                  {isLoadingEmployees ? 'Cargando empleados...' : 'Selecciona un empleado'}
                </option>
                {employeeList.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.fullName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Cantidad de Adelanto</label>
            <div className="relative">
              <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-outline" />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-surface-container-lowest border border-outline-variant/20 py-3 pl-10 pr-4 text-lg font-black text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all font-bold uppercase"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[9px] font-bold text-outline uppercase tracking-widest ml-1">Concepto Opcional</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Adelanto por gastos personales..."
              rows={3}
              className="w-full bg-surface-container-lowest border border-outline-variant/20 p-3 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none uppercase"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 py-3 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest hover:text-white transition-all text-[10px]"
            >
              Cancelar
            </button>
            <button
              onClick={() => advanceMutation.mutate()}
              disabled={
                advanceMutation.isPending ||
                isLoadingEmployees ||
                employeeList.length === 0 ||
                !employeeId ||
                !amount ||
                Number(amount) <= 0
              }
              className="flex-1 py-3 bg-primary text-on-primary font-headline font-black uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-95 transition-all text-[10px] flex items-center justify-center gap-2"
            >
              {advanceMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar Adelanto'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
