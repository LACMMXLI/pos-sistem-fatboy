import React from 'react';
import {
  Loader2,
  RefreshCw,
  ShoppingBag,
  Store,
  Timer,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';
import { queryKeys } from '../../lib/queryKeys';
import {
  getKitchenOrders,
  type KitchenOrderResponse,
  type KitchenStatus,
  updateKitchenOrderStatus,
} from '../../services/api';

type KitchenScreenProps = {
  surfaceMode?: boolean;
};

type ServiceVisual = {
  label: string;
  detail?: string;
  icon: React.ReactNode;
  className: string;
};

const statusLabels: Record<Exclude<KitchenStatus, 'COMPLETED'>, string> = {
  PENDING: 'Pendiente',
  PREPARING: 'En preparación',
  READY: 'Lista',
};

const nextActionByStatus: Record<
  Exclude<KitchenStatus, 'COMPLETED'>,
  { label: string; status: KitchenStatus; tone: string }
> = {
  PENDING: {
    label: 'Iniciar preparación',
    status: 'PREPARING',
    tone: 'bg-primary text-on-primary shadow-lg shadow-primary/20',
  },
  PREPARING: {
    label: 'Marcar lista',
    status: 'READY',
    tone: 'bg-amber-500 text-surface shadow-lg shadow-amber-500/20',
  },
  READY: {
    label: 'Finalizar comanda',
    status: 'COMPLETED',
    tone: 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20',
  },
};

export function KitchenScreen({ surfaceMode = false }: KitchenScreenProps) {
  const queryClient = useQueryClient();
  const { data: orders = [], isLoading, isRefetching, isError, error } = useQuery({
    queryKey: queryKeys.kitchenOrders,
    queryFn: getKitchenOrders,
    refetchInterval: surfaceMode ? 5000 : 10000,
  });
  const sortedOrders = [...orders].sort(
    (left, right) =>
      new Date(left.order.createdAt).getTime() - new Date(right.order.createdAt).getTime(),
  );

  return (
    <div className={cn('h-full flex flex-col overflow-hidden bg-surface', surfaceMode && 'bg-[#111315]')}>
      <div
        className={cn(
          'flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-low px-2.5 py-1.5',
          surfaceMode && 'px-3 py-2 md:px-4 md:py-2.5',
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
            <UtensilsCrossed className={cn(surfaceMode ? 'h-4 w-4' : 'h-4 w-4')} />
          </div>
          <div>
            <h2
              className={cn(
                'font-black uppercase tracking-[0.18em] text-on-surface',
                surfaceMode ? 'text-[10px] md:text-[11px]' : 'text-[9px]',
              )}
            >
              Cocina
            </h2>
            <p className={cn('font-bold uppercase tracking-[0.16em] text-outline', surfaceMode ? 'text-[8px] md:text-[9px]' : 'text-[7px]')}>
              {sortedOrders.length} comanda{sortedOrders.length === 1 ? '' : 's'} activas
            </p>
          </div>
          {isRefetching && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
        </div>

        <button
          onClick={() => queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders })}
          className={cn(
            'flex items-center gap-2 border border-outline-variant/10 bg-surface-container-highest text-on-surface transition-colors hover:text-primary',
            surfaceMode
              ? 'px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em]'
              : 'px-2.5 py-1.5 text-[7px] font-bold uppercase tracking-[0.14em]',
          )}
        >
          <RefreshCw className={cn(surfaceMode ? 'h-4 w-4' : 'h-3 w-3', isRefetching && 'animate-spin')} />
          Refrescar
        </button>
      </div>

      <main className={cn('flex-1 custom-scrollbar', surfaceMode ? 'overflow-hidden p-2.5 md:p-3' : 'overflow-y-auto p-2')}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 opacity-70">
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-on-surface">
              Error de cocina
            </h2>
            <p className="max-w-md text-center text-[10px] font-bold uppercase tracking-widest text-outline">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'No se pudo sincronizar el monitor de cocina'}
            </p>
          </div>
        ) : sortedOrders.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center opacity-30">
            <h2 className="text-xl font-black uppercase tracking-[0.2em] text-on-surface">
              No hay comandas activas
            </h2>
          </div>
        ) : (
          <div
            className={cn(
              surfaceMode
                ? 'grid h-full auto-cols-[calc((100%-2.25rem)/4)] grid-flow-col gap-3 overflow-x-auto overflow-y-hidden pb-2 pr-2'
                : 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
            )}
            style={
              surfaceMode
                ? {
                    gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                  }
                : undefined
            }
          >
            {sortedOrders.map((order) => (
              <KitchenCard key={order.id} order={order} surfaceMode={surfaceMode} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function KitchenCard({
  order,
  surfaceMode,
}: {
  order: KitchenOrderResponse;
  surfaceMode: boolean;
}) {
  const queryClient = useQueryClient();
  const orderDate = new Date(order.order.createdAt);
  const diffMinutes = Math.floor((Date.now() - orderDate.getTime()) / 60000);
  const isLate = diffMinutes > 15;
  const isUrgent = diffMinutes > 25;
  const cardAccent = isUrgent ? 'border-red-500' : isLate ? 'border-amber-400' : 'border-emerald-500';
  const timerTone = isUrgent
    ? 'bg-red-500/10 text-red-400 border-red-500/20'
    : isLate
      ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';

  const currentStatus = order.status === 'COMPLETED' ? 'READY' : order.status;
  const action = nextActionByStatus[currentStatus];
  const service = getServiceVisual(order);

  const statusMutation = useMutation({
    mutationFn: ({ status }: { status: KitchenStatus }) => updateKitchenOrderStatus(order.id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
      toast.success(`Comanda #${order.order.orderNumber || order.id} actualizada`);
    },
    onError: (error: { response?: { data?: { message?: string } }; message?: string }) => {
      toast.error(error.response?.data?.message || error.message || 'Error al actualizar la comanda');
    },
  });

  return (
    <article
      className={cn(
        'flex h-full flex-col overflow-hidden border-t-4 bg-surface-container shadow-xl',
        cardAccent,
        surfaceMode && 'rounded-lg border border-outline-variant/10 border-t-4 bg-[#171a1d] shadow-[0_12px_30px_rgba(0,0,0,0.28)]',
      )}
    >
      <div
        className={cn(
          'border-b border-outline-variant/10 bg-surface-container-high',
          surfaceMode ? 'space-y-1.5 p-2.5 md:p-3' : 'space-y-3 p-3',
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn('font-headline font-black leading-none text-on-surface', surfaceMode ? 'text-base' : 'text-lg')}>
                {formatKitchenOrderLabel(order)}
              </h3>
              <span
                className={cn(
                  'border border-outline-variant/10 bg-surface-container-highest font-black uppercase tracking-[0.16em] text-outline',
                  surfaceMode ? 'px-1.5 py-0.5 text-[7px]' : 'px-2 py-1 text-[7px]',
                )}
              >
                {statusLabels[currentStatus]}
              </span>
            </div>

            <div className={cn('mt-1 flex flex-wrap items-center gap-1.5', surfaceMode ? 'text-[8px]' : 'text-[8px]')}>
              <span className={cn('inline-flex items-center gap-1 border font-black uppercase tracking-[0.16em]', service.className, surfaceMode ? 'px-1.5 py-0.5 text-[7px]' : 'px-2 py-1')}>
                {service.icon}
                {service.label}
              </span>
              {service.detail ? (
                <span className={cn('font-bold uppercase tracking-[0.14em] text-on-surface', surfaceMode ? 'text-[7px]' : '')}>{service.detail}</span>
              ) : null}
            </div>
          </div>

          <div className={cn('flex items-center gap-1 border', timerTone, surfaceMode ? 'px-1.5 py-0.5' : 'px-2 py-1')}>
            <Timer className={cn(surfaceMode ? 'h-3 w-3' : 'h-3 w-3')} />
            <span className={cn('font-black uppercase tracking-[0.14em]', surfaceMode ? 'text-[7px]' : 'text-[8px]')}>
              {diffMinutes} min
            </span>
          </div>
        </div>

      </div>

      <div className={cn('flex-grow space-y-1', surfaceMode ? 'p-2.5 md:p-3' : 'p-3')}>
        <div className="mb-1 flex items-center justify-between">
          <p className={cn('font-black uppercase tracking-[0.14em] text-primary', surfaceMode ? 'text-[7px]' : 'text-[8px]')}>
            {countSubmittedItems(order)} piezas
          </p>
          <p className={cn('font-black uppercase tracking-[0.14em] text-outline', surfaceMode ? 'text-[7px]' : 'text-[8px]')}>
            {new Date(order.order.createdAt).toLocaleTimeString('es-MX', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>

        <div className={cn('space-y-1', surfaceMode && 'overflow-hidden')}>
          {(order.order.items || []).map((item) => (
            <div
              key={item.id}
              className={cn(
                'border border-outline-variant/10 bg-surface-container-low',
                surfaceMode ? 'rounded-md px-2 py-1.5' : 'px-2.5 py-2',
              )}
            >
              <p className={cn('font-bold leading-tight text-on-surface', surfaceMode ? 'text-[10px]' : 'text-[10px]')}>
                <span className="mr-1.5 text-primary">{item.quantity}x</span>
                {item.product?.name || 'Producto desconocido'}
              </p>
              {item.redeemableProductId ? (
                <div className="mt-0.5">
                  <span
                    className={cn(
                      'inline-flex border border-amber-400/20 bg-amber-400/10 px-1 py-0.5 font-black uppercase tracking-[0.16em] text-amber-200',
                      surfaceMode ? 'text-[5.5px]' : 'text-[6.5px]',
                    )}
                  >
                    Canje por puntos
                  </span>
                </div>
              ) : null}
              {item.modifiers && item.modifiers.length > 0 ? (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {item.modifiers.map((modifier, index) => (
                    <span
                      key={`${item.id}-${modifier.name}-${index}`}
                      className={cn(
                        'border border-white/5 bg-surface-container-highest px-1 py-0.5 font-bold uppercase text-on-surface-variant',
                        surfaceMode ? 'text-[5.5px]' : 'text-[6.5px]',
                      )}
                    >
                      {modifier.name}
                    </span>
                  ))}
                </div>
              ) : null}
              {item.notes ? (
                <p className={cn('mt-0.5 font-bold uppercase tracking-[0.14em] text-outline', surfaceMode ? 'text-[6px]' : 'text-[7px]')}>
                  Nota: {item.notes}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className={cn('mt-auto border-t border-outline-variant/10 bg-surface-container-low', surfaceMode ? 'p-2.5 md:p-3' : 'p-2')}>
        <button
          onClick={() => statusMutation.mutate({ status: action.status })}
          disabled={statusMutation.isPending}
          className={cn(
            'flex w-full items-center justify-center gap-2 font-black uppercase tracking-[0.16em] transition-all active:scale-[0.99] disabled:opacity-60',
            action.tone,
            surfaceMode ? 'min-h-11 px-3 py-2 text-[9px]' : 'py-3 text-[9px]',
          )}
        >
          {statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {action.label}
        </button>
      </div>
    </article>
  );
}

function countSubmittedItems(order: KitchenOrderResponse) {
  return (order.order.items || []).reduce((total, item) => total + Number(item.quantity || 0), 0);
}

function getServiceVisual(order: KitchenOrderResponse): ServiceVisual {
  if (order.order.orderType === 'DINE_IN') {
    return {
      label: 'Comedor',
      detail: order.order.table?.name ? `Mesa ${order.order.table.name}` : 'Sin mesa',
      icon: <Store className="h-4 w-4" />,
      className: 'border-sky-400/20 bg-sky-400/10 text-sky-300',
    };
  }

  if (order.order.orderType === 'DELIVERY') {
    return {
      label: 'Aplicación',
      detail: 'Entrega',
      icon: <Truck className="h-4 w-4" />,
      className: 'border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-300',
    };
  }

  return {
    label: 'Para llevar',
    detail: 'Mostrador',
    icon: <ShoppingBag className="h-4 w-4" />,
    className: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  };
}

function formatKitchenOrderLabel(order: KitchenOrderResponse) {
  const baseLabel = `#${order.order.orderNumber || order.id}`;
  const customerName = order.order.customerName?.trim();

  if (!customerName) {
    return baseLabel;
  }

  return `${baseLabel} (${customerName})`;
}
