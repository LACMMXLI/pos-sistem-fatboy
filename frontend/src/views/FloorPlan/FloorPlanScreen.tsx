import React, { ReactNode, useMemo, useRef, useState } from 'react';
import {
  Printer,
  CreditCard,
  Split,
  PlusCircle,
  ShoppingBag,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Table2,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addItemsToOrder,
  createOrder,
  getAreas,
  getCategories,
  getProducts,
  getTableById,
  getTables,
  getWaiters,
  printOrderReceipt,
  printOrderAccount,
  updateOrderStatus,
  updateTableStatus,
} from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { getCategoryChipStyle } from '../../lib/categoryChip';
import { useSettingsStore } from '../../store/settingsStore';
import { toast } from 'sonner';
import { useAuthStore } from '../../store/authStore';
import { AdminPasswordModal } from '../../components/Modals/AdminPasswordModal';
import { PaymentModal } from '../../components/Modals/PaymentModal';
import { ProductVisual } from '../../components/ui/ProductVisual';
import { useMenu } from '../../hooks/useMenu';
import { useOrderDraft } from '../../hooks/useOrderDraft';
import { CategoryRail } from '../../components/pos/CategoryRail';
import { ProductCard } from '../../components/pos/ProductCard';

type PendingTableItem = {
  productId: number;
  name: string;
  price: number;
  quantity: number;
};

export function FloorPlanScreen() {
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const role = useAuthStore((state) => state.user?.role ?? '');
  const userId = Number(useAuthStore((state) => state.user?.id ?? 0));
  const isWaiterUser = role === 'MESERO';
  const queryClient = useQueryClient();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [isAddItemsOpen, setIsAddItemsOpen] = useState(false);
  const [isPayOpen, setIsPayOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedWaiterId, setSelectedWaiterId] = useState<string>('');
  const { taxRate, taxEnabled, restaurantName } = useSettingsStore();

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: getAreas,
  });

  const { data: tables = [], isLoading: isLoadingTables } = useQuery({
    queryKey: [...queryKeys.tables, selectedAreaId],
    queryFn: () => getTables(selectedAreaId || undefined),
    refetchInterval: 15000,
  });

  const { data: selectedTableDetail, isLoading: isLoadingTableDetail } = useQuery({
    queryKey: ['table', selectedTableId],
    queryFn: () => getTableById(selectedTableId as string),
    enabled: !!selectedTableId,
  });
  const { 
    categories, 
    products, 
    activeCategoryId, 
    isLoadingProducts, 
    handleCategorySelect 
  } = useMenu();

  const {
    items: pendingItems,
    total: pendingSubtotal,
    addItem: addProductToPendingItems,
    updateQuantity: updatePendingQuantity,
    clearDraft: clearPendingItems,
  } = useOrderDraft();

  const { data: waiters = [] } = useQuery({
    queryKey: ['waiters'],
    queryFn: getWaiters,
    enabled: isAddItemsOpen,
  });

  const selectedTable = tables.find((table: any) => table.id.toString() === selectedTableId);
  const currentOrder = selectedTableDetail?.orders?.[0] ?? null;
  const orderItems = currentOrder?.items || [];

  const subtotal = Number(currentOrder?.subtotal ?? 0);
  const tax = Number(currentOrder?.taxAmount ?? (taxEnabled ? subtotal * (taxRate / 100) : 0));
  const total = Number(currentOrder?.totalAmount ?? subtotal + tax);
  const remaining = Number(currentOrder?.remainingAmount ?? 0);

  const addItemsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTableId || pendingItems.length === 0) {
        throw new Error('No hay mesa o productos para registrar');
      }

      const items = pendingItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      }));

      if (currentOrder?.id) {
        return addItemsToOrder(currentOrder.id, { items });
      }

      return createOrder({
        tableId: Number(selectedTableId),
        waiterId: isWaiterUser ? userId : Number(selectedWaiterId),
        orderType: 'DINE_IN',
        items,
      });
    },
    onSuccess: () => {
      clearPendingItems();
      setIsAddItemsOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
      queryClient.invalidateQueries({ queryKey: ['table', selectedTableId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || 'No se pudo registrar la cuenta');
    },
  });

  const printMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrder?.id) {
        throw new Error('No hay una cuenta activa para imprimir');
      }
      await printOrderReceipt(currentOrder.id, { type: 'CLIENT' });
      return printOrderAccount(currentOrder.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
      queryClient.invalidateQueries({ queryKey: ['table', selectedTableId] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || 'No se pudo imprimir la cuenta');
    },
  });

  const cancelOrderMutation = useMutation({
    mutationFn: async (adminPassword: string) => {
      if (!currentOrder?.id) {
        throw new Error('No hay cuenta activa para cancelar');
      }
      return updateOrderStatus(currentOrder.id, {
        status: 'CANCELLED',
        adminPassword,
      });
    },
    onSuccess: () => {
      toast.success('Cuenta cancelada correctamente');
      setIsCancelModalOpen(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
      queryClient.invalidateQueries({ queryKey: ['table', selectedTableId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
      queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
      queryClient.invalidateQueries({ queryKey: queryKeys.activeOrders });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || 'No se pudo cancelar la cuenta');
    },
  });

  const releaseTableMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTableId) {
        throw new Error('No hay mesa seleccionada');
      }
      return updateTableStatus(selectedTableId, 'AVAILABLE');
    },
    onSuccess: () => {
      toast.success('Mesa liberada correctamente');
      queryClient.invalidateQueries({ queryKey: queryKeys.tables });
      queryClient.invalidateQueries({ queryKey: ['table', selectedTableId] });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error.message || 'No se pudo liberar la mesa');
    },
  });

  const canOpenAddItems = !!selectedTableId;
  const canPrint = !!currentOrder?.id;
  const canPay = !!currentOrder?.id && remaining > 0;
  const canCancelOrder = !!currentOrder?.id && Number(currentOrder.paidAmount ?? 0) <= 0;
  const canReleaseStuckTable = !!selectedTable && selectedTable.status !== 'AVAILABLE' && !currentOrder;
  const canCreateTableOrder = !!currentOrder || isWaiterUser || !!selectedWaiterId;
  const businessName = restaurantName?.trim() || 'Mi negocio';

  return (
    <div className="h-full flex overflow-hidden w-full">
      <section className="relative flex-1 overflow-y-auto bg-surface p-1.5 custom-scrollbar">
        <div className="mb-1.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="font-headline text-lg font-extrabold tracking-tight text-white uppercase">{businessName}</h1>
            <div className="mt-1 flex flex-wrap gap-1">
              <button
                onClick={() => setSelectedAreaId(null)}
                className={cn("w-fit text-[8px] uppercase font-bold px-1.5 py-0.5 transition-colors", !selectedAreaId ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline")}
              >
                Todos
              </button>
              {areas.map((area: any) => (
                <button
                  key={area.id}
                  onClick={() => setSelectedAreaId(area.id.toString())}
                  className={cn("w-fit text-[8px] uppercase font-bold px-1.5 py-0.5 transition-colors", selectedAreaId === area.id.toString() ? "bg-primary text-on-primary" : "bg-surface-container-high text-outline")}
                >
                  {area.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pb-0.5">
            <LegendItem color="border border-outline-variant/30" label="Disponible" />
            <LegendItem color="bg-surface-container-high" label="Ocupada" />
            <LegendItem color="bg-primary/20 border border-primary shadow-[0_0_8px_rgba(76,214,255,0.2)]" label="Seleccionada" />
          </div>
        </div>

        {isLoadingTables ? (
          <div className="h-40 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7">
            {tables.map((table: any) => (
              <TableCard
                key={table.id}
                table={table}
                isSelected={table.id.toString() === selectedTableId}
                onClick={() => setSelectedTableId(table.id.toString())}
              />
            ))}
          </div>
        )}
      </section>

      <aside className="z-10 flex w-[248px] flex-col border-l border-white/5 bg-surface-container-low shadow-2xl">
        <div className="flex-shrink-0 border-b border-white/5 bg-surface-container-high p-2">
          <div className="mb-1 flex items-start justify-between gap-2">
            <div>
              <h3 className="font-headline text-base font-black text-on-surface uppercase">
                {selectedTable ? `Mesa ${selectedTable.name || selectedTable.id}` : 'Seleccione Mesa'}
              </h3>
              <p className="text-[7px] text-outline font-bold uppercase tracking-widest mt-1">
                {!selectedTable
                  ? 'Esperando seleccion'
                  : currentOrder
                    ? `Cuenta ${currentOrder.orderNumber}`
                    : 'Sin cuenta activa'}
              </p>
              {currentOrder?.waiter?.name && (
                <p className="text-[7px] text-primary font-bold uppercase tracking-widest mt-1">
                  Mesero: {currentOrder.waiter.name}
                </p>
              )}
              {!currentOrder && isWaiterUser && (
                <p className="text-[7px] text-primary font-bold uppercase tracking-widest mt-1">
                  Mesero asignado: tú
                </p>
              )}
            </div>
            {selectedTable && (
              <div className="text-right">
                <span className="block text-primary font-headline font-black text-base leading-none">
                  ${total.toFixed(2)}
                </span>
                <span className="text-[7px] text-outline font-bold uppercase">
                  {orderItems.reduce((acc: number, item: any) => acc + item.quantity, 0)} Items
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 p-1 custom-scrollbar">
          {isLoadingTableDetail ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : orderItems.length > 0 ? (
            orderItems.map((item: any, idx: number) => (
              <OrderItem
                key={idx}
                quantity={item.quantity}
                name={item.product.name}
                modifiers={item.modifiers?.map((m: any) => m.name) || []}
                price={
                  (Number(item.price) +
                    (item.modifiers || []).reduce((sum: number, modifier: any) => sum + Number(modifier.price), 0)) *
                  item.quantity
                }
              />
            ))
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-outline-variant opacity-50 p-4 text-center">
              <ShoppingBag className="w-8 h-8 mb-2 opacity-20" />
              <p className="font-headline text-[9px] uppercase font-bold tracking-widest">Sin consumos activos</p>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 border-t border-white/5 bg-surface-container-lowest p-2">
          <div className="mb-2">
            <div className="flex justify-between items-end">
              <span className="font-headline font-black text-outline uppercase tracking-tighter text-[8px]">Total de Cuenta</span>
              <span className="font-headline text-xl font-black text-primary tracking-tighter">${total.toFixed(2)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <ActionBtn
              icon={<Printer className="w-2.5 h-2.5" />}
              label="Imprimir"
              variant="secondary"
              disabled={!canPrint || printMutation.isPending}
              onClick={() => printMutation.mutate()}
            />
            <ActionBtn
              icon={<CreditCard className="w-2.5 h-2.5" />}
              label="Pagar"
              variant="primary"
              disabled={!canPay}
              onClick={() => setIsPayOpen(true)}
            />
            <ActionBtn
              icon={<Split className="w-2.5 h-2.5" />}
              label={canCancelOrder ? 'Cancelar' : 'Dividir'}
              variant="outline"
              disabled={!canCancelOrder || cancelOrderMutation.isPending}
              onClick={() => setIsCancelModalOpen(true)}
            />
            <ActionBtn
              icon={<PlusCircle className="w-2.5 h-2.5" />}
              label={currentOrder ? 'Agregar' : 'Abrir Cuenta'}
              variant="bright"
              disabled={!canOpenAddItems || addItemsMutation.isPending}
              onClick={() => {
                clearPendingItems();
                handleCategorySelect(null);
                setSelectedWaiterId('');
                setIsAddItemsOpen(true);
              }}
            />
          </div>
          {canReleaseStuckTable && (
            <button
              onClick={() => releaseTableMutation.mutate()}
              disabled={releaseTableMutation.isPending}
              className="w-full mt-2 py-2 bg-red-500/10 text-red-400 border border-red-500/20 font-black text-[8px] uppercase tracking-widest disabled:opacity-40"
            >
              {releaseTableMutation.isPending ? 'Liberando...' : 'Liberar mesa atorada'}
            </button>
          )}
        </div>
      </aside>

      {isAddItemsOpen && selectedTable && (
        <Modal title={`Mesa ${selectedTable.name} · ${currentOrder ? 'Agregar productos' : 'Abrir cuenta'}`} onClose={() => setIsAddItemsOpen(false)}>
          <div className="flex h-[70vh] gap-2.5">
            <div className="min-h-0 flex-1 flex flex-col min-w-0">
              <div className="shrink-0 border-b border-outline-variant/10 pb-2">
                <CategoryRail 
                  categories={categories} 
                  activeCategoryId={activeCategoryId} 
                  onCategorySelect={handleCategorySelect} 
                />
              </div>

              <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto border border-outline-variant/10 custom-scrollbar">
                {isLoadingProducts ? (
                  <div className="flex h-full items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="grid grid-cols-3 gap-1 p-1 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7">
                    {products.map((product: any) => (
                      <ProductCard 
                        key={product.id} 
                        product={product} 
                        onClick={addProductToPendingItems} 
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex w-[228px] flex-col border border-outline-variant/10 bg-surface-container-low">
              <div className="border-b border-outline-variant/10 p-2.5">
                <p className="text-[8px] font-black text-outline uppercase tracking-widest">Cuenta en preparacion</p>
                <p className="text-sm font-black text-white mt-1">${pendingSubtotal.toFixed(2)}</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 p-1.5 custom-scrollbar">
                {!currentOrder && !isWaiterUser && (
                  <div className="border-b border-outline-variant/10 p-1.5">
                    <label className="block text-[8px] font-black uppercase tracking-widest text-outline mb-1">
                      Mesero asignado
                    </label>
                    <select
                      value={selectedWaiterId}
                      onChange={(event) => setSelectedWaiterId(event.target.value)}
                      className="w-full bg-surface-container-high border border-outline-variant/10 px-2 py-2 text-[9px] font-black text-white"
                    >
                      <option value="">Selecciona un mesero</option>
                      {waiters.map((waiter: any) => (
                        <option key={waiter.id} value={waiter.id}>
                          {waiter.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                {pendingItems.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-[8px] font-bold uppercase tracking-widest text-outline">
                    Sin platillos
                  </div>
                ) : (
                  pendingItems.map((item) => (
                    <div key={item.draftId} className="flex items-center justify-between gap-2 border border-outline-variant/10 bg-surface-container-high p-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[9px] font-black text-white uppercase truncate">{item.name}</div>
                        <div className="text-[8px] text-outline">{item.quantity} x ${item.price.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updatePendingQuantity(item.draftId, -1)}
                          className="w-6 h-6 flex items-center justify-center bg-surface text-white"
                        >
                          -
                        </button>
                        <span className="text-[9px] font-black text-white">{item.quantity}</span>
                        <button
                          onClick={() => updatePendingQuantity(item.draftId, 1)}
                          className="w-6 h-6 flex items-center justify-center bg-primary text-on-primary"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="border-t border-outline-variant/10 p-2.5">
                <button
                  onClick={() => addItemsMutation.mutate()}
                  disabled={pendingItems.length === 0 || addItemsMutation.isPending || !canCreateTableOrder}
                  className="w-full py-2.5 bg-primary text-on-primary font-black text-[10px] uppercase tracking-widest disabled:opacity-40"
                >
                  {addItemsMutation.isPending ? 'Guardando...' : currentOrder ? 'Agregar a la cuenta' : 'Crear cuenta'}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}


      {isPayOpen && currentOrder && remaining > 0 && (
        <PaymentModal
          total={remaining}
          orderId={Number(currentOrder.id)}
          onClose={() => setIsPayOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['table', selectedTableId] });
          }}
        />
      )}

      {isCancelModalOpen && currentOrder && (
        <AdminPasswordModal
          title="Cancelar cuenta"
          description={`Confirma con clave de administrador para cancelar la cuenta ${currentOrder.orderNumber}. La cuenta seguirá visible como cancelada en el historial.`}
          isSubmitting={cancelOrderMutation.isPending}
          onClose={() => setIsCancelModalOpen(false)}
          onConfirm={(password) => cancelOrderMutation.mutate(password)}
        />
      )}

    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <div className={cn("h-2 w-2 shrink-0", color)}></div>
      <span className="text-[7px] uppercase tracking-widest text-outline font-bold">{label}</span>
    </div>
  );
}

function TableCard({
  table,
  isSelected,
  onClick,
}: {
  table: any;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isOccupied = table.status === 'OCCUPIED' || table.status === 'ACCOUNT_PRINTED';
  const isPrinted = table.status === 'ACCOUNT_PRINTED';
  const isAvailable = table.status === 'AVAILABLE';
  const iconColorClass = isSelected
    ? 'text-primary'
    : isPrinted
      ? 'text-emerald-400'
      : isOccupied
        ? 'text-red-400'
        : 'text-white';
  const badgeClass = isSelected
    ? 'bg-primary text-on-primary'
    : isPrinted
      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
      : isOccupied
        ? 'bg-red-500/15 text-red-300 border border-red-500/30'
        : 'bg-white/10 text-white border border-white/20';
  const numberClass = isSelected
    ? 'text-primary'
    : isPrinted
      ? 'text-emerald-300'
      : isOccupied
        ? 'text-red-300'
        : 'text-white';

  return (
    <div
      onClick={onClick}
      className={cn(
        "group relative aspect-square cursor-pointer overflow-hidden p-1 transition-all flex flex-col items-center justify-center",
        isAvailable && !isSelected && "border border-white/15 bg-surface-container-lowest/40 hover:bg-surface-container-low",
        isOccupied && !isSelected && "bg-surface-container-highest shadow-xl border-t-2",
        isPrinted && !isSelected && "border-t-emerald-500/70",
        table.status === 'OCCUPIED' && !isSelected && "border-t-red-500/70",
        isSelected && "bg-primary/10 border-2 border-primary shadow-[0_0_15px_rgba(76,214,255,0.2)]"
      )}
    >
      {isSelected && <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none"></div>}

      <Table2 className={cn("mb-1 h-5 w-5", iconColorClass)} />
      <span className={cn("text-[7px] font-headline font-bold uppercase tracking-[0.16em]", iconColorClass)}>MESA</span>
      <span className={cn("font-headline text-[1.65rem] font-black leading-none", numberClass)}>
        {table.name || table.id}
      </span>

      <span className={cn("mt-1 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-tighter", badgeClass)}>
        {table.status === 'OCCUPIED'
          ? "OCUPADA"
          : table.status === 'ACCOUNT_PRINTED'
            ? "PRECUENTA"
            : "DISPONIBLE"}
      </span>
    </div>
  );
}

function OrderItem({
  quantity,
  name,
  modifiers,
  price,
}: {
  quantity: number;
  name: string;
  modifiers: string[];
  price: number;
}) {
  return (
    <div className="border-l-2 border-primary/20 bg-surface-container-low p-2">
      <div className="flex justify-between items-start">
        <div className="flex gap-2 min-w-0">
          <span className="font-headline font-extrabold text-primary text-[10px]">{quantity}x</span>
          <div className="min-w-0">
            <h4 className="font-headline text-[10px] font-bold uppercase tracking-wide leading-tight text-white truncate">{name}</h4>
            {modifiers.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                {modifiers.map((modifier, index) => (
                  <span key={index} className="text-[6.5px] text-outline px-1 bg-surface-container-highest border border-white/5">
                    {modifier}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <span className="font-headline font-bold text-[10px] text-white ml-2">${price.toFixed(2)}</span>
      </div>
    </div>
  );
}

function ActionBtn({
  icon,
  label,
  variant,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  variant: 'primary' | 'secondary' | 'outline' | 'bright';
  disabled?: boolean;
  onClick?: () => void;
}) {
  const styles = {
    primary: "bg-primary text-on-primary shadow-[0_2px_10px_rgba(76,214,255,0.3)] hover:bg-primary-fixed-dim",
    secondary: "bg-surface-container-highest text-outline hover:text-white border border-outline-variant/10",
    outline: "border border-outline-variant/30 text-outline hover:bg-surface-container-high hover:text-white",
    bright: "bg-surface-bright text-on-surface hover:brightness-125",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex min-h-[2.25rem] items-center justify-center gap-1 px-1.5 py-2 font-headline text-[8px] font-bold uppercase tracking-[0.12em] transition-all",
        styles[variant],
        disabled ? "opacity-20 cursor-not-allowed shadow-none hover:bg-inherit" : "active:scale-95"
      )}
    >
      {icon} {label}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-[92vw] overflow-hidden border border-outline-variant/10 bg-surface-container-low shadow-2xl">
        <div className="flex min-h-12 items-center justify-between border-b border-white/5 bg-surface-container-high px-3">
          <h2 className="text-sm font-black text-on-surface tracking-tighter font-headline uppercase">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-container-highest hover:bg-error-container/20 hover:text-error transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
