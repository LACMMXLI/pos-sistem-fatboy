import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createOrder, createPayment } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { useCartStore } from '../../store/cartStore';
import { toast } from 'sonner';
import { useShiftStore } from '../../store/shiftStore';
import { useUIStore } from '../../store/uiStore';

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onRequireShift?: () => void;
  orderId?: number;
  onSuccess?: () => void;
}

export function PaymentModal({
  total,
  onClose,
  onRequireShift,
  orderId,
  onSuccess,
}: PaymentModalProps) {
  const queryClient = useQueryClient();
  const { items: cart, customer, clearCart } = useCartStore();
  const { activeShift } = useShiftStore();
  const [inputStr, setInputStr] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [cashCurrency, setCashCurrency] = useState<'MXN' | 'USD'>('MXN');
  const [exchangeRate, setExchangeRate] = useState('');
  const isCashPayment = payMethod === 'CASH';
  const isUsdCashPayment = isCashPayment && cashCurrency === 'USD';
  const isExistingOrderPayment = typeof orderId === 'number';

  const receivedValue = isCashPayment
    ? inputStr === '' ? 0 : parseInt(inputStr) / 100
    : total;
  const exchangeRateValue = isUsdCashPayment ? Number(exchangeRate || 0) : 1;
  const receivedValueMxn = isUsdCashPayment ? receivedValue * exchangeRateValue : receivedValue;
  const change = Math.max(0, receivedValueMxn - total);

  const paymentMutation = useMutation({
    mutationFn: async () => {
      if (!activeShift) {
        throw new Error('Necesitas abrir un turno de caja antes de cobrar');
      }

      if (isExistingOrderPayment) {
        return createPayment({
          orderId,
          paymentMethod: payMethod,
          amount: total,
          receivedAmount: receivedValue,
          paymentCurrency: isCashPayment ? cashCurrency : 'MXN',
          exchangeRate: isUsdCashPayment ? exchangeRateValue : undefined,
        });
      }

      return createOrder({
        orderType: 'TAKE_AWAY',
        customerId: customer?.id,
        items: cart.map(item => ({
          productId: Number(item.id),
          quantity: item.quantity,
          selectedModifierIds: item.selectedModifiers?.map(m => Number(m.id)) || [],
          notes: item.notes || undefined,
          redeemableProductId: item.isRedeemable ? Number(item.redeemableProductId) : undefined,
        })),
        payment: {
          paymentMethod: payMethod,
          amount: total,
          receivedAmount: receivedValue,
          paymentCurrency: isCashPayment ? cashCurrency : 'MXN',
          exchangeRate: isUsdCashPayment ? exchangeRateValue : undefined,
        },
      });
    },
    onSuccess: (result) => {
      toast.success("Transacción completada con éxito");

      if (payMethod === 'CASH' && change > 0) {
        useUIStore.getState().setChangeModal({ show: true, amount: change });
      }

      if (!isExistingOrderPayment) {
        clearCart();
      }

      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShift });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeShiftSummary });
      if (!isExistingOrderPayment) {
        queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
        queryClient.invalidateQueries({ queryKey: queryKeys.customers });
      }
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      const message = error.response?.data?.message || error.message;
      toast.error("Error al procesar el pago: " + message);
      if (String(message).toLowerCase().includes('turno') && onRequireShift) {
        onClose();
        onRequireShift();
      }
    }
  });

  const handleKeypad = (val: string) => {
    if (inputStr.length < 8) setInputStr(prev => prev + val);
  };

  const handleClear = () => {
    setInputStr('');
  };

  const handleQuickBill = (amount: number) => {
    setInputStr((amount * 100).toString());
  };

  const handlePay = () => {
    if (!activeShift) {
      toast.error('Necesitas abrir un turno de caja antes de cobrar');
      if (onRequireShift) {
        onClose();
        onRequireShift();
      }
      return;
    }

    paymentMutation.mutate();
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();

        if (!paymentMutation.isPending && (!isCashPayment || (receivedValueMxn >= total && (!isUsdCashPayment || exchangeRateValue > 0)))) {
          handlePay();
        }
        return;
      }

      if (event.key === 'Escape' && !paymentMutation.isPending) {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [exchangeRateValue, handlePay, isCashPayment, isUsdCashPayment, onClose, paymentMutation.isPending, receivedValueMxn, total]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm px-4"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-3xl bg-surface-container-low shadow-[0_20px_40px_rgba(0,0,0,0.6)] overflow-hidden border border-outline-variant/10"
      >
        <div className="flex bg-surface-container-low border-b border-white/5">
          {[
            { id: 'CASH', label: 'EFECTIVO' },
            { id: 'CARD', label: 'TARJETA' },
            { id: 'TRANSFER', label: 'TRANSFERENCIA' }
          ].map(method => (
            <button 
              key={method.id}
              onClick={() => setPayMethod(method.id)}
              className={cn(
                "flex-1 py-4 px-4 text-center font-headline font-extrabold text-[10px] tracking-widest transition-colors",
                payMethod === method.id 
                  ? "bg-surface-container-low text-primary border-b-2 border-primary"
                  : "text-outline hover:bg-surface-container-high"
              )}
            >
              {method.label}
            </button>
          ))}
          <button onClick={onClose} className="px-4 flex items-center justify-center text-outline hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2">
          <div className="grid grid-cols-3 gap-2 mb-3">
            <AmountDisplay label="TOTAL" value={`$${total.toFixed(2)}`} color="text-error" />
            <AmountDisplay
              label={isCashPayment ? (isUsdCashPayment ? "RECIBIDO USD" : "RECIBIDO MXN") : "AUTORIZADO"}
              value={`${isUsdCashPayment ? 'USD ' : '$'}${receivedValue.toFixed(2)}`}
              color="text-on-surface"
              active
            />
            <AmountDisplay label="CAMBIO MXN" value={`$${change.toFixed(2)}`} color="text-primary" />
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-8">
              {isCashPayment ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setCashCurrency('MXN')}
                      className={cn(
                        'h-10 border text-[9px] font-headline font-black uppercase tracking-widest transition-colors',
                        cashCurrency === 'MXN'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/20 bg-surface-container-highest text-outline',
                      )}
                    >
                      Efectivo MXN
                    </button>
                    <button
                      onClick={() => setCashCurrency('USD')}
                      className={cn(
                        'h-10 border text-[9px] font-headline font-black uppercase tracking-widest transition-colors',
                        cashCurrency === 'USD'
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline-variant/20 bg-surface-container-highest text-outline',
                      )}
                    >
                      Efectivo USD
                    </button>
                  </div>

                  {isUsdCashPayment && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-surface-container-highest border border-outline-variant/10 px-3 py-2">
                        <span className="block text-[7px] font-bold uppercase tracking-widest text-outline">Tipo de cambio</span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={exchangeRate}
                          onChange={(e) => setExchangeRate(e.target.value)}
                          placeholder="20.00"
                          className="mt-1 w-full bg-transparent text-base font-headline font-black text-white outline-none"
                        />
                      </div>
                      <div className="bg-surface-container-highest border border-outline-variant/10 px-3 py-2">
                        <span className="block text-[7px] font-bold uppercase tracking-widest text-outline">Equivalente MXN</span>
                        <span className="mt-1 block text-base font-headline font-black text-primary">
                          ${receivedValueMxn.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                      <KeypadBtn key={n} label={n.toString()} onClick={() => handleKeypad(n.toString())} />
                    ))}
                    <button onClick={handleClear} className="h-10 bg-error-container/20 text-error flex items-center justify-center text-[8px] font-headline font-bold hover:bg-error-container/30 active:scale-95 transition-all uppercase tracking-widest">Borrar</button>
                    <KeypadBtn label="0" onClick={() => handleKeypad('0')} />
                    <button onClick={() => handleKeypad('00')} className="h-10 bg-primary-container/20 text-primary flex items-center justify-center text-[10px] font-headline font-bold hover:bg-primary-container/40 active:scale-95 transition-all uppercase tracking-widest">00</button>
                  </div>
                </div>
              ) : (
                <div className="h-full min-h-40 bg-surface-container-highest border border-outline-variant/10 flex flex-col items-center justify-center px-6 text-center">
                  <span className="text-[9px] font-black text-primary uppercase tracking-widest">
                    {payMethod === 'CARD' ? 'Cobro con tarjeta' : 'Cobro por transferencia'}
                  </span>
                  <p className="mt-2 text-[8px] text-outline font-bold uppercase tracking-widest">
                    El sistema registrará el total en {payMethod === 'CARD' ? 'terminal / tarjeta' : 'transferencia'} sin pedir efectivo recibido.
                  </p>
                </div>
              )}
            </div>

            <div className="col-span-4 flex flex-col gap-1">
              <div className="flex-1 flex flex-col gap-1">
                <span className="text-[7px] font-bold text-outline tracking-widest uppercase mb-0.5 px-1">Acceso Rápido</span>
                {isCashPayment ? (
                  <>
                    {isUsdCashPayment ? (
                      <>
                        <QuickBill value="USD 5" onClick={() => handleQuickBill(5)} />
                        <QuickBill value="USD 10" onClick={() => handleQuickBill(10)} />
                        <QuickBill value="USD 20" onClick={() => handleQuickBill(20)} />
                        <QuickBill value="USD 50" onClick={() => handleQuickBill(50)} />
                      </>
                    ) : (
                      <>
                        <QuickBill value="$50" onClick={() => handleQuickBill(50)} />
                        <QuickBill value="$100" onClick={() => handleQuickBill(100)} />
                        <QuickBill value="$200" onClick={() => handleQuickBill(200)} />
                        <QuickBill value="$500" onClick={() => handleQuickBill(500)} />
                      </>
                    )}
                  </>
                ) : (
                  <div className="flex-1 bg-surface-container border border-outline-variant/10 px-3 py-4">
                    <p className="text-[8px] font-black text-on-surface uppercase tracking-widest">
                      Registro automático
                    </p>
                    <p className="mt-2 text-[7px] text-outline font-bold uppercase tracking-widest">
                      Monto enviado al backend:
                    </p>
                    <p className="mt-1 text-lg font-headline font-black text-primary">
                      ${total.toFixed(2)}
                    </p>
                  </div>
                )}
              </div>
              <button 
                onClick={handlePay}
                disabled={paymentMutation.isPending || (isCashPayment && (receivedValueMxn < total || (isUsdCashPayment && exchangeRateValue <= 0)))}
                className="h-12 bg-primary text-on-primary flex items-center justify-center gap-1.5 shadow-[0_4px_12px_rgba(76,214,255,0.2)] hover:bg-primary-fixed-dim transition-all active:scale-95 mt-1 disabled:opacity-50"
              >
                {paymentMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 fill-current" />
                )}
                <span className="text-sm font-headline font-black uppercase tracking-tight">
                  {paymentMutation.isPending ? 'Procesando...' : 'Pagar Ahora · F2'}
                </span>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-2 bg-surface-container-lowest flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1 h-1 bg-primary animate-pulse"></div>
              <span className="text-[8px] font-bold text-outline uppercase tracking-widest">
                {isCashPayment ? (isUsdCashPayment ? 'Cobro USD con cambio en MXN' : 'Caja Lista para Transacción') : 'Pago Digital Listo para Registro'}
              </span>
            </div>
            {customer && !isExistingOrderPayment ? (
              <div className="flex items-center gap-3 border-l border-outline-variant/10 pl-3">
                <span className="text-[8px] font-black uppercase tracking-widest text-white">
                  {customer.name}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest text-outline">
                  {customer.loyaltyPoints} pts
                </span>
                <span className="text-[8px] font-black uppercase tracking-widest text-primary">
                  +{Math.floor(total / 10)} pts
                </span>
              </div>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button className="text-[8px] font-bold text-outline uppercase tracking-widest hover:text-white transition-colors">Imprimir Ticket</button>
            <button className="text-[8px] font-bold text-outline uppercase tracking-widest hover:text-white transition-colors">Ticket Digital</button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function AmountDisplay({ label, value, color, active }: { label: string, value: string, color: string, active?: boolean }) {
  return (
    <div className={cn("bg-surface-container p-1.5 flex flex-col rounded", active && "bg-surface-container-high ring-1 ring-primary/40 shadow-[0_0_15px_rgba(76,214,255,0.1)]")}>
      <span className={cn("text-[7px] font-bold tracking-widest mb-0.5", active ? "text-primary/90" : "text-outline")}>{label}</span>
      <span className={cn("text-lg font-headline font-black tracking-tighter truncate", color)}>{value}</span>
    </div>
  );
}

function KeypadBtn({ label, onClick }: { label: string, onClick: () => void, key?: React.Key }) {
  return (
    <button onClick={onClick} className="h-10 bg-surface-container-highest flex items-center justify-center text-base font-headline font-bold hover:bg-surface-bright active:scale-95 transition-all">
      {label}
    </button>
  );
}

function QuickBill({ value, onClick }: { value: string, onClick: () => void, key?: React.Key }) {
  return (
    <button onClick={onClick} className="h-9 bg-surface-container flex items-center justify-between px-2 hover:bg-surface-container-high transition-colors active:scale-95 border border-outline-variant/10">
      <span className="text-[8px] font-bold text-outline">Billete</span>
      <span className="text-base font-headline font-black text-on-surface">{value}</span>
    </button>
  );
}
