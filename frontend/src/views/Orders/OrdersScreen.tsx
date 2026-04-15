import React, { useEffect, useState } from 'react';
import { 
  Filter, 
  Calendar, 
  UtensilsCrossed, 
  Truck, 
  CreditCard, 
  ChevronRight, 
  ReceiptText, 
  Printer, 
  Trash2, 
  ShoppingCart, 
  Info, 
  CheckCircle2,
  Loader2,
  RefreshCw 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryKeys';
import { getOpenOrders, getOrders, printOrderReceipt, updateOrderStatus } from '../../services/api';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { AdminPasswordModal } from '../../components/Modals/AdminPasswordModal';

export function OrdersScreen() {
  const role = useAuthStore((state) => state.user?.role ?? '');
  const canSeeHistory = ['ADMIN', 'SUPERVISOR', 'CAJERO'].includes(role);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [filterShift, setFilterShift] = useState('all');
  const [filterDate, setFilterDate] = useState('today');
  const [viewMode, setViewMode] = useState<'active' | 'history'>('active');
  const [cancelTarget, setCancelTarget] = useState<any | null>(null);
  const queryClient = useQueryClient();

  const { data: activeOrders = [], isLoading: isLoadingActive } = useQuery({
    queryKey: queryKeys.activeOrders,
    queryFn: () => getOpenOrders(),
    enabled: viewMode === 'active',
  });

  const { data: rawHistoryOrders = [], isLoading: isLoadingHistory } = useQuery({
    queryKey: ['orders', 'history', filterDate, filterShift],
    queryFn: () => getOrders(),
    enabled: viewMode === 'history' && canSeeHistory,
  });

  const historyOrders = rawHistoryOrders.filter((order: any) => {
    const createdAt = new Date(order.createdAt);
    const today = new Date();
    const orderDate = new Date(createdAt.getFullYear(), createdAt.getMonth(), createdAt.getDate());
    const currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffDays = Math.round((currentDate.getTime() - orderDate.getTime()) / 86400000);

    const matchesDate =
      filterDate === 'today'
        ? diffDays === 0
        : filterDate === 'yesterday'
          ? diffDays === 1
          : true;

    const matchesShift = filterShift === 'all' ? true : Number(order.shiftId) === Number(filterShift);

    return matchesDate && matchesShift;
  });

  const orders = viewMode === 'active' ? activeOrders : historyOrders;
  const isLoading = viewMode === 'active' ? isLoadingActive : isLoadingHistory;
  const selectedOrder = orders.find((o: any) => o.id.toString() === selectedOrderId);

  useEffect(() => {
    if (orders.length === 0) {
      setSelectedOrderId(null);
      return;
    }

    if (!selectedOrderId || !orders.some((order: any) => order.id.toString() === selectedOrderId)) {
      setSelectedOrderId(orders[0].id.toString());
    }
  }, [orders, selectedOrderId]);

  const cancelMutation = useMutation({
    mutationFn: ({ orderId, password }: { orderId: number; password: string }) =>
      updateOrderStatus(orderId, { status: 'CANCELLED', adminPassword: password }),
    onSuccess: () => {
      toast.success('Cuenta cancelada correctamente');
      setCancelTarget(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeOrders });
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
      queryClient.invalidateQueries({ queryKey: ['orders', 'history'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo cancelar la cuenta');
    },
  });

  return (
    <div className="h-full flex bg-surface overflow-hidden relative">
      {/* Left Sidebar: Order History */}
      <div className="w-72 border-r border-outline-variant/10 flex flex-col bg-surface-container-low">
        <div className="p-2 border-b border-outline-variant/10 bg-surface-container-lowest">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <h2 className="font-headline text-base font-black text-white tracking-tighter uppercase">
                {viewMode === 'active' ? 'Órdenes Activas' : 'Historial'}
              </h2>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-outline">
                {orders.length} registro{orders.length === 1 ? '' : 's'}
              </p>
            </div>
            <div className="flex gap-1">
              {canSeeHistory && (
                <button 
                  onClick={() => setViewMode(viewMode === 'active' ? 'history' : 'active')}
                  className={cn(
                    "px-2.5 py-1 text-[8px] font-black uppercase tracking-widest border transition-all",
                    "bg-surface-container-highest text-outline hover:text-white border-outline-variant/10"
                  )}
                >
                  {viewMode === 'active' ? 'Ver Historial' : 'Ver Activas'}
                </button>
              )}
            </div>
          </div>
          
          {viewMode === 'history' && (
            <div className="grid grid-cols-2 gap-1.5">
              <select 
                value={filterShift}
                onChange={(e) => setFilterShift(e.target.value)}
                className="bg-surface-container-highest border border-outline-variant/20 py-1.5 px-2 text-[10px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all appearance-none uppercase font-bold tracking-[0.12em]"
              >
                <option value="all">Turnos</option>
                <option value="1">Mañana</option>
                <option value="2">Tarde</option>
              </select>
              <select 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-surface-container-highest border border-outline-variant/20 py-1.5 px-2 text-[10px] text-on-surface focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all appearance-none uppercase font-bold tracking-[0.12em]"
              >
                <option value="today">Hoy</option>
                <option value="yesterday">Ayer</option>
                <option value="range">Rango...</option>
              </select>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-[10px] text-outline font-bold uppercase tracking-widest">
              No hay órdenes {viewMode === 'active' ? 'activas' : 'en el historial'}
            </div>
          ) : (
            orders.map((order: any) => (
              <button
                key={order.id}
                onClick={() => setSelectedOrderId(order.id.toString())}
                className={cn(
                  "w-full p-2 flex flex-col gap-1 border-b border-outline-variant/5 transition-all text-left relative group",
                  selectedOrderId === order.id.toString() 
                    ? "bg-primary/10 border-l-4 border-l-primary" 
                    : "hover:bg-surface-container-high"
                )}
              >
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <span className="font-headline font-black text-on-surface text-[10px] uppercase tracking-tight">#{order.id}</span>
                    <span className="text-[8px] text-outline font-bold uppercase tracking-widest">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {order.employee?.name || order.user?.name || 'Personal'}
                    </span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[11px] font-black text-on-surface">${Number(order.totalAmount ?? order.total ?? 0).toFixed(2)}</span>
                    <span className={cn(
                      "text-[7px] font-black uppercase px-1.5 py-0.5 border",
                      order.status === 'CLOSED' ? "bg-green-500/10 text-green-500 border-green-500/20" :
                      order.status === 'CANCELLED' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                      "bg-primary/10 text-primary border-primary/20"
                    )}>
                      {order.status}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="text-[8px] text-outline-variant font-bold uppercase tracking-widest flex items-center gap-1">
                    {order.orderType === 'DINE_IN' ? <UtensilsCrossed className="w-2 h-2" /> : <Truck className="w-2 h-2" />}
                    {order.orderType === 'DINE_IN' ? `Mesa ${order.table?.name || order.tableId || '?'}` : 'Llevar'}
                  </span>
                  <span className="text-[8px] text-outline-variant font-bold uppercase tracking-widest flex items-center gap-1">
                    <CreditCard className="w-2 h-2" />
                    {order.paymentStatus || 'PENDING'}
                  </span>
                </div>
                <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-outline opacity-0 group-hover:opacity-100 transition-all" />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right Content: Order Details */}
      <div className="flex-1 flex flex-col bg-surface overflow-hidden">
        {selectedOrder ? (
          <OrderDetailsView order={selectedOrder} onRequestCancel={(order) => setCancelTarget(order)} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-outline gap-3">
            <ReceiptText className="w-12 h-12 opacity-10" />
            <p className="font-headline font-bold uppercase tracking-widest text-[10px] opacity-30">Selecciona una orden para ver detalles</p>
          </div>
        )}
      </div>

      {cancelTarget && (
        <AdminPasswordModal
          title="Cancelar cuenta"
          description={`Confirma con clave de administrador para cancelar la cuenta ${cancelTarget.orderNumber || `#${cancelTarget.id}`}. Permanecerá visible en historial como cancelada.`}
          isSubmitting={cancelMutation.isPending}
          onClose={() => setCancelTarget(null)}
          onConfirm={(password) => cancelMutation.mutate({ orderId: Number(cancelTarget.id), password })}
        />
      )}
    </div>
  );
}

function OrderDetailsView({ order, onRequestCancel }: { order: any; onRequestCancel: (order: any) => void }) {
  const reprintMutation = useMutation({
    mutationFn: async () => {
      await printOrderReceipt(order.id, { type: 'CLIENT' });
    },
    onSuccess: () => {
      toast.success('Ticket reenviado a impresion');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo reimprimir el ticket');
    },
  });

  return (
    <div className="h-full flex flex-col overflow-hidden bg-surface">
      {/* Header */}
      <div className="p-2.5 border-b border-outline-variant/10 bg-surface-container-low flex justify-between items-start gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={cn(
            "w-9 h-9 flex items-center justify-center border shadow-lg shrink-0",
            order.status === 'CLOSED' ? "bg-green-500/10 border-green-500/20 text-green-500" :
            order.status === 'CANCELLED' ? "bg-red-500/10 border-red-500/20 text-red-500" :
            "bg-primary/10 border-primary/20 text-primary"
          )}>
            <ReceiptText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base font-black text-white tracking-tighter font-headline uppercase leading-none mb-1">#{order.id}</h1>
            <div className="flex flex-wrap gap-1.5">
              <span className="px-1.5 py-0.5 bg-surface-container-highest text-outline text-[8px] font-bold uppercase tracking-widest border border-outline-variant/10">
                {new Date(order.createdAt).toLocaleString()}
              </span>
              <span className="px-1.5 py-0.5 bg-surface-container-highest text-outline text-[8px] font-bold uppercase tracking-widest border border-outline-variant/10">
                {order.employee?.name || order.user?.name || 'Personal'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button
            onClick={() => reprintMutation.mutate()}
            disabled={reprintMutation.isPending}
            className="flex items-center gap-1.5 px-2 py-1 bg-surface-container-highest text-outline font-headline font-black uppercase tracking-widest hover:text-white transition-all active:scale-95 border border-outline-variant/10 text-[9px] disabled:opacity-40"
          >
            <Printer className="w-3 h-3" /> Re-imprimir
          </button>
          {order.status !== 'CANCELLED' && (
            <button
              onClick={() => onRequestCancel(order)}
              className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 text-red-500 font-headline font-black uppercase tracking-widest hover:bg-red-500/20 transition-all active:scale-95 border border-red-500/20 text-[9px]"
            >
              <Trash2 className="w-3 h-3" /> Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-[minmax(0,1fr)_18rem] overflow-hidden">
        {/* Left: Items List */}
        <div className="flex-1 flex flex-col p-2.5 overflow-y-auto custom-scrollbar border-r border-outline-variant/10">
          <h3 className="text-[10px] font-bold text-outline uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
            <ShoppingCart className="w-2.5 h-2.5" /> Productos
          </h3>
          <div className="space-y-2">
            {order.items?.map((item: any, idx: number) => (
              <div key={idx} className="bg-surface-container-low p-2 border border-outline-variant/5 flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-surface-container-highest flex items-center justify-center text-[10px] font-black text-primary border border-outline-variant/10">
                    {item.quantity}
                  </div>
                  <div>
                    <span className="block text-[11px] font-bold text-on-surface uppercase">{item.name || item.product?.name}</span>
                    {item.redeemableProductId ? (
                      <span className="inline-flex mt-0.5 border border-amber-400/20 bg-amber-400/10 px-1 py-0.5 text-[6px] font-black uppercase tracking-widest text-amber-200">
                        Canje por puntos
                      </span>
                    ) : null}
                    {item.modifiers && item.modifiers.length > 0 && (
                      <span className="text-[8px] text-outline-variant font-medium italic">
                        {item.modifiers.map((m: any) => m.name || m).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[11px] font-black text-on-surface">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                  <span className="text-[8px] text-outline">${Number(item.price).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Summary & Info */}
        <aside className="flex flex-col p-2.5 bg-surface-container-lowest overflow-y-auto custom-scrollbar">
          <section className="mb-4">
            <h3 className="text-[10px] font-bold text-outline uppercase tracking-[0.18em] mb-2 flex items-center gap-1.5">
              <Info className="w-2.5 h-2.5" /> Pago & Info
            </h3>
            <div className="bg-surface-container-low p-2.5 space-y-2.5 border border-outline-variant/5">
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-bold text-outline uppercase">Método</span>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                  <CreditCard className="w-2.5 h-2.5" />
                  {order.paymentStatus || 'PENDING'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-bold text-outline uppercase">Canjeado</span>
                <span className="text-[10px] font-black text-amber-200 uppercase tracking-widest">
                  {order.items?.some((item: any) => item.redeemableProductId) ? 'SI' : 'NO'}
                </span>
              </div>
              {order.items?.some((item: any) => item.redeemableProductId) ? (
                <div className="border border-amber-400/20 bg-amber-400/10 px-2 py-1.5">
                  <span className="block text-[7px] font-black uppercase tracking-[0.18em] text-amber-200">
                    Canje excluido de caja
                  </span>
                  <p className="mt-0.5 text-[8px] font-bold text-amber-100">
                    Estos productos van en la orden y cocina, pero no suman efectivo ni tarjeta en el corte.
                  </p>
                </div>
              ) : null}
              <div className="flex justify-between items-center">
                <span className="text-[8px] font-bold text-outline uppercase">Tipo</span>
                <span className="text-[10px] font-black text-on-surface uppercase tracking-widest flex items-center gap-1">
                  {order.orderType === 'DINE_IN' ? <UtensilsCrossed className="w-2.5 h-2.5" /> : <Truck className="w-2.5 h-2.5" />}
                  {order.orderType === 'DINE_IN' ? 'Comedor' : 'Llevar'}
                </span>
              </div>
              {order.table && (
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold text-outline uppercase">Mesa</span>
                  <span className="text-[10px] font-black text-on-surface uppercase tracking-widest">{order.table?.name || order.tableId}</span>
                </div>
              )}
            </div>
          </section>

          <section className="mt-auto">
            <div className="bg-surface-container-low p-4 border border-outline-variant/10 shadow-xl">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-[9px] font-bold text-outline uppercase tracking-widest">
                  <span>Subtotal</span>
                  <span>${Number(order.subtotal ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[9px] font-bold text-outline uppercase tracking-widest">
                  <span>Impuestos</span>
                  <span>${Number(order.taxAmount ?? 0).toFixed(2)}</span>
                </div>
                <div className="h-px bg-outline-variant/10 my-2" />
                <div className="flex justify-between items-center">
                  <span className="text-xs font-black text-white uppercase tracking-widest">Total Pagado</span>
                  <span className="text-2xl font-headline font-black text-primary">${Number(order.paidAmount ?? order.totalAmount ?? 0).toFixed(2)}</span>
                </div>
              </div>
              {order.status === 'CLOSED' && (
                <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span className="text-[9px] font-black text-green-500 uppercase tracking-widest">Transacción Exitosa</span>
                </div>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
