import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Delete,
  FilePenLine,
  Loader2,
  LogOut,
  Plus,
  PlusSquare,
  ReceiptText,
  Send,
  ShoppingBag,
  Table2,
  Trash2,
  UserRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, formatCurrency } from '../../lib/utils';
import { getCategoryChipStyle } from '../../lib/categoryChip';
import { queryKeys } from '../../lib/queryKeys';
import { ProductVisual } from '../../components/ui/ProductVisual';
import {
  addItemsToOrder,
  createOrder,
  createTabletTable,
  getAreas,
  getCategories,
  getProducts,
  getShiftAvailability,
  getTableById,
  getTables,
  submitOrder,
  waiterPinLogin,
} from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { useMenu } from '../../hooks/useMenu';
import { useOrderDraft } from '../../hooks/useOrderDraft';

type PendingDraftItem = {
  draftId: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes: string;
};

type TabletView = 'tables' | 'service';

const keypadKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'backspace'] as const;

export function TabletShell() {
  const user = useAuthStore((state) => state.user);

  const canAccessTablet = user && ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MESERO'].includes(user.role);

  if (!canAccessTablet) {
    return <TabletWaiterLogin />;
  }

  return <TabletServiceScreen />;
}

function TabletWaiterLogin() {
  const setAuth = useAuthStore((state) => state.setAuth);
  const [pin, setPin] = useState('');

  const loginMutation = useMutation({
    mutationFn: () => waiterPinLogin(pin),
    onSuccess: (response) => {
      setAuth(
        {
          ...response.user,
          id: String(response.user.id),
        } as any,
        response.access_token,
      );
      toast.success(`Turno tablet abierto para ${response.user.name}`);
      setPin('');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo iniciar sesión con el PIN');
    },
  });

  const handleKeyPress = (key: (typeof keypadKeys)[number]) => {
    if (key === 'clear') {
      setPin('');
      return;
    }

    if (key === 'backspace') {
      setPin((current) => current.slice(0, -1));
      return;
    }

    setPin((current) => (current.length >= 4 ? current : `${current}${key}`));
  };

  return (
    <div className="flex h-screen flex-col bg-surface px-6 py-5">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-between">
        <div className="text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">
            Surface Tablet
          </p>
          <h1 className="mt-2 font-headline text-4xl font-black uppercase tracking-[0.08em] text-on-surface">
            Meseros
          </h1>
          <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.16em] text-outline">
            Ingresa tu PIN operativo para abrir servicio
          </p>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1.2fr_1fr] gap-5 py-6">
          <section className="flex flex-col justify-between border border-outline-variant/10 bg-surface-container-low p-6 shadow-2xl">
            <div>
              <div className="inline-flex h-14 w-14 items-center justify-center border border-primary/20 bg-primary/10 text-primary">
                <UserRound className="h-7 w-7" />
              </div>
              <h2 className="mt-5 font-headline text-2xl font-black uppercase tracking-[0.08em] text-on-surface">
                Acceso rápido
              </h2>
              <p className="mt-2 max-w-md text-[11px] font-bold uppercase tracking-[0.12em] text-outline">
                Esta entrada está dedicada a meseros. El PIN reemplaza el login completo del sistema.
              </p>
            </div>

            <div className="border border-outline-variant/10 bg-surface-container-lowest px-5 py-6">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-primary">
                PIN de mesero
              </p>
              <div className="mt-4 text-center font-headline text-6xl font-black tracking-[0.35em] text-on-surface">
                {pin.padEnd(4, '•')}
              </div>
              <button
                onClick={() => loginMutation.mutate()}
                disabled={pin.length !== 4 || loginMutation.isPending}
                className="mt-6 flex w-full items-center justify-center gap-2 border border-primary bg-primary px-4 py-4 text-[11px] font-black uppercase tracking-[0.16em] text-on-primary transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {loginMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Ingresar a la tablet
              </button>
            </div>
          </section>

          <section className="grid grid-cols-3 gap-3 border border-outline-variant/10 bg-surface-container-low p-4 shadow-2xl">
            {keypadKeys.map((key) => {
              const isClear = key === 'clear';
              const isBackspace = key === 'backspace';

              return (
                <button
                  key={key}
                  onClick={() => handleKeyPress(key)}
                  className={cn(
                    'flex items-center justify-center border text-center transition-all active:scale-[0.98]',
                    isClear
                      ? 'border-red-500/20 bg-red-500/10 text-red-400'
                      : isBackspace
                        ? 'border-outline-variant/10 bg-surface-container-high text-outline'
                        : 'border-outline-variant/10 bg-surface-container-lowest text-on-surface hover:border-primary/30 hover:text-primary',
                  )}
                >
                  {isBackspace ? (
                    <Delete className="h-6 w-6" />
                  ) : (
                    <span className="font-headline text-4xl font-black leading-none">
                      {isClear ? 'C' : key}
                    </span>
                  )}
                </button>
              );
            })}
          </section>
        </div>
      </div>
    </div>
  );
}

function TabletServiceScreen() {
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const [tabletView, setTabletView] = useState<TabletView>('tables');
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const { 
    categories, 
    products, 
    activeCategoryId, 
    isLoadingProducts, 
    handleCategorySelect 
  } = useMenu();
  const {
    items: pendingSelection,
    total: pendingSubtotal,
    addItem: addProductToSelection,
    updateQuantity: updatePendingQuantity,
    updateNotes: updateItemNote,
    removeItem,
    clearDraft: clearPendingSelection,
  } = useOrderDraft();
  const [isCreateTableOpen, setIsCreateTableOpen] = useState(false);
  const [customTableName, setCustomTableName] = useState('');
  const [customTableAreaId, setCustomTableAreaId] = useState<string>('');
  const [noteEditorItemId, setNoteEditorItemId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const scrollCategoryRail = (direction: 'left' | 'right') => {
    categoryRailRef.current?.scrollBy({
      left: direction === 'left' ? -260 : 260,
      behavior: 'smooth',
    });
  };

  const handleCategoryRailWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const rail = categoryRailRef.current;
    if (!rail) return;

    if (Math.abs(event.deltaY) < Math.abs(event.deltaX) && event.deltaX === 0) {
      return;
    }

    rail.scrollLeft += event.deltaY !== 0 ? event.deltaY : event.deltaX;
  };

  const { data: areas = [] } = useQuery({
    queryKey: ['areas'],
    queryFn: getAreas,
  });

  useEffect(() => {
    if (customTableAreaId || areas.length === 0) {
      return;
    }

    setCustomTableAreaId(String(selectedAreaId ?? areas[0].id));
  }, [areas, customTableAreaId, selectedAreaId]);

  const { data: tables = [], isLoading: isLoadingTables } = useQuery({
    queryKey: [...queryKeys.tables, selectedAreaId],
    queryFn: () => getTables(selectedAreaId || undefined),
    refetchInterval: 10000,
  });

  const { data: tableDetail, isLoading: isLoadingTableDetail } = useQuery({
    queryKey: ['tablet-table', selectedTableId],
    queryFn: () => getTableById(selectedTableId as string),
    enabled: !!selectedTableId,
  });

  const { data: shiftAvailability } = useQuery({
    queryKey: ['tablet-shift-availability'],
    queryFn: getShiftAvailability,
    refetchInterval: 10000,
  });

  const hasOpenShift = shiftAvailability?.hasOpenShift ?? true;
  const selectedTableFromList = tables.find((table: any) => String(table.id) === selectedTableId) ?? null;
  const selectedTable = selectedTableFromList ?? tableDetail ?? null;
  const currentOrder = tableDetail?.orders?.[0] ?? null;
  const serverDraftItems = currentOrder?.draftItems ?? [];
  const submittedItems = currentOrder?.submittedItems ?? [];

  const groupedSubmittedItems = useMemo(() => {
    const groups = new Map<number, { batch: number; submittedAt: string; items: any[] }>();

    submittedItems.forEach((item: any) => {
      const batch = Number(item.submissionBatch ?? 0);
      const existing = groups.get(batch);

      if (existing) {
        existing.items.push(item);
        return;
      }

      groups.set(batch, {
        batch,
        submittedAt: item.submittedAt,
        items: [item],
      });
    });

    return Array.from(groups.values()).sort((a, b) => a.batch - b.batch);
  }, [submittedItems]);

  const invalidateTabletData = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.tables });
    queryClient.invalidateQueries({ queryKey: ['tablet-table'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.orders });
    queryClient.invalidateQueries({ queryKey: queryKeys.kitchenOrders });
  };

  const tableOpenMutation = useMutation({
    mutationFn: async (tableId: number) =>
      createOrder({
        tableId,
        waiterId: Number(user?.id),
        orderType: 'DINE_IN',
        manualSubmit: true,
        items: [],
      }),
    onSuccess: () => {
      invalidateTabletData();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo abrir la mesa');
    },
  });

  const createCustomTableMutation = useMutation({
    mutationFn: async () =>
      createTabletTable({
        name: customTableName.trim(),
        areaId: Number(customTableAreaId),
      }),
    onSuccess: (createdTable: any) => {
      setSelectedAreaId(String(createdTable.areaId));
      setSelectedTableId(String(createdTable.id));
      clearPendingSelection();
      setTabletView('service');
      setIsCreateTableOpen(false);
      setCustomTableName('');
      invalidateTabletData();

      if (hasOpenShift) {
        tableOpenMutation.mutate(createdTable.id);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'No se pudo crear la mesa personalizada');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentOrder?.id) {
        throw new Error('No hay una cuenta abierta para enviar');
      }

      if (pendingSelection.length > 0) {
        await addItemsToOrder(currentOrder.id, {
          items: pendingSelection.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            notes: item.notes || undefined,
          })),
          manualSubmit: true,
        });
      }

      return submitOrder(currentOrder.id);
    },
    onSuccess: () => {
      clearPendingSelection();
      toast.success('Comanda enviada a producción');
      invalidateTabletData();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'No se pudo enviar la comanda');
    },
  });

  const requireOperationalShift = () => {
    if (hasOpenShift) {
      return true;
    }

    toast.error('Por favor inicie turno en caja');
    return false;
  };

  const handleSelectTable = (table: any) => {
    if (!requireOperationalShift()) {
      return;
    }

    setSelectedTableId(String(table.id));
    clearPendingSelection();
    setTabletView('service');

    if (!table.orders?.length && table.status === 'AVAILABLE') {
      tableOpenMutation.mutate(table.id);
    }
  };

  const handleBackToTables = () => {
    setTabletView('tables');
    clearPendingSelection();
  };

  const openNoteEditor = (item: any) => {
    setNoteEditorItemId(item.draftId);
    setNoteDraft(item.notes);
  };

  const saveNoteEditor = () => {
    if (!noteEditorItemId) {
      return;
    }

    updateItemNote(noteEditorItemId, noteDraft.trim());
    setNoteEditorItemId(null);
    setNoteDraft('');
  };

  const closeNoteEditor = () => {
    setNoteEditorItemId(null);
    setNoteDraft('');
  };

  const handleAddProduct = (product: any) => {
    if (!requireOperationalShift()) {
      return;
    }
    handleAddProduct(product);
  };
  const currentOrderTotal = Number(currentOrder?.totalAmount ?? 0);
  const selectedTableLabel = selectedTable?.name || selectedTable?.id || '--';

  return (
    <div className="flex h-screen flex-col bg-surface">
      {!hasOpenShift ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl border border-amber-400/30 bg-amber-500/12 px-8 py-10 text-center shadow-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.24em] text-amber-300">
              Turno requerido
            </p>
            <h2 className="mt-4 font-headline text-4xl font-black uppercase tracking-[0.08em] text-white">
              Por favor inicie turno en caja
            </h2>
            <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.14em] text-amber-100/80">
              La tablet no puede abrir cuentas ni enviar comandas mientras no exista un turno abierto en el sistema.
            </p>
          </div>
        </div>
      ) : null}

      <header className="flex items-center justify-between gap-3 border-b border-outline-variant/10 bg-surface-container-low px-3 py-2 md:px-4">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.22em] text-primary">
            Tablet de servicio
          </p>
          <h1 className="mt-0.5 font-headline text-base font-black uppercase tracking-[0.08em] text-on-surface md:text-xl">
            {user?.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden border border-outline-variant/10 bg-surface-container-high px-2 py-1.5 lg:block">
            <p className="text-[8px] font-black uppercase tracking-[0.16em] text-outline">
              Vista activa
            </p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-[0.12em] text-on-surface">
              {tabletView === 'tables' ? 'Mesas disponibles' : `Mesa ${selectedTableLabel}`}
            </p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2 border border-outline-variant/10 bg-surface-container-highest px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-on-surface transition-colors hover:text-primary md:px-4 md:py-3 md:text-[10px]"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      {tabletView === 'tables' ? (
        <div className="flex min-h-0 flex-1 flex-col bg-surface">
          <section className="border-b border-outline-variant/10 bg-[radial-gradient(circle_at_top_left,_rgba(75,214,255,0.14),_transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)] px-3 py-3 md:px-5 md:py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-headline text-xl font-black uppercase tracking-[0.06em] text-on-surface md:text-2xl">
                  Mesas disponibles
                </h2>
                <p className="mt-1 max-w-3xl text-[9px] font-bold uppercase tracking-[0.14em] text-outline md:text-[10px]">
                  Elige una mesa registrada o agrega una nueva para empezar a tomar el pedido.
                </p>
              </div>

              <button
                onClick={() => setIsCreateTableOpen(true)}
                className="flex items-center justify-center gap-2 border border-primary bg-primary px-3 py-3 text-[9px] font-black uppercase tracking-[0.16em] text-on-primary transition-transform active:scale-[0.99] md:px-4 md:py-4 md:text-[10px]"
              >
                <PlusSquare className="h-4 w-4" />
                Agregar mesa personalizada
              </button>
            </div>
          </section>

          <section className="border-b border-outline-variant/10 px-3 py-2 md:px-5 md:py-3">
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button
                onClick={() => setSelectedAreaId(null)}
                className={cn(
                  'shrink-0 border px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] md:px-4 md:py-3 md:text-[9px]',
                  !selectedAreaId
                    ? 'border-primary bg-primary text-on-primary'
                    : 'border-outline-variant/10 bg-surface-container-high text-on-surface',
                )}
              >
                Todas
              </button>
              {areas.map((area: any) => (
                <button
                  key={area.id}
                  onClick={() => setSelectedAreaId(String(area.id))}
                  className={cn(
                    'shrink-0 border px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] md:px-4 md:py-3 md:text-[9px]',
                    selectedAreaId === String(area.id)
                      ? 'border-primary bg-primary text-on-primary'
                      : 'border-outline-variant/10 bg-surface-container-high text-on-surface',
                  )}
                >
                  {area.name}
                </button>
              ))}
            </div>
          </section>

          <section className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar md:px-5 md:py-5">
            {isLoadingTables ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : tables.length === 0 ? (
              <EmptyPanel message="No hay mesas en esta área. Puedes crear una personalizada para continuar." />
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
                {tables.map((table: any) => (
                  <TableSelectionCard
                    key={table.id}
                    table={table}
                    onClick={() => handleSelectTable(table)}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col xl:grid xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
          <section className="flex min-h-0 flex-1 flex-col bg-surface xl:border-r xl:border-outline-variant/10">
            <div className="border-b border-outline-variant/10 bg-surface-container-low px-3 py-3 md:px-5 md:py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <button
                    onClick={handleBackToTables}
                    className="flex h-10 w-10 items-center justify-center border border-outline-variant/10 bg-surface-container-high text-on-surface transition-colors hover:text-primary md:h-12 md:w-12"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div>
                    <h2 className="mt-0.5 font-headline text-xl font-black uppercase tracking-[0.06em] text-on-surface md:text-3xl">
                      Mesa {selectedTableLabel}
                    </h2>
                    <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-outline md:mt-2 md:text-[9px]">
                      {currentOrder?.orderNumber || (tableOpenMutation.isPending ? 'Abriendo cuenta...' : 'Cuenta lista para pedido')}
                    </p>
                  </div>
                </div>

                <div className="border border-outline-variant/10 bg-surface-container-high px-3 py-2 text-right md:px-4 md:py-3">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-outline">
                    Cuenta actual
                  </p>
                  <p className="mt-1 font-headline text-lg font-black text-primary md:text-2xl">
                    {formatCurrency(currentOrderTotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-b border-outline-variant/10 px-3 py-2 md:px-5 md:py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => scrollCategoryRail('left')}
                  className="category-rail-nav"
                  aria-label="Desplazar categorias a la izquierda"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                <div ref={categoryRailRef} className="category-rail flex-1" onWheel={handleCategoryRailWheel}>
                <button
                  onClick={() => handleCategorySelect(null)}
                  className={cn(
                    'category-chip active:scale-[0.98]',
                    activeCategoryId === 'all' && 'category-chip-active',
                  )}
                  style={getCategoryChipStyle('all', 'Todos')}
                >
                  <span className="category-chip-name">Todos</span>
                </button>
                {categories.map((category: any) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(String(category.id))}
                    className={cn(
                      'category-chip active:scale-[0.98]',
                      activeCategoryId === String(category.id) && 'category-chip-active',
                    )}
                    style={getCategoryChipStyle(String(category.id), category.name ?? '')}
                  >
                    <span className="category-chip-name line-clamp-2">{category.name}</span>
                  </button>
                ))}
                </div>

                <button
                  type="button"
                  onClick={() => scrollCategoryRail('right')}
                  className="category-rail-nav"
                  aria-label="Desplazar categorias a la derecha"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar md:px-5 md:py-5"
              onWheelCapture={(event) => event.stopPropagation()}
            >
              {!selectedTableId || isLoadingTableDetail ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-3">
                  {products.map((product: any) => (
                    <button
                      key={product.id}
                      onClick={() => handleAddProduct(product)}
                      className="group relative overflow-hidden border border-outline-variant/10 bg-surface-container-low text-left transition-all hover:border-primary/30 hover:bg-surface-container-high active:scale-[0.99]"
                    >
                      <ProductVisual
                        imageUrl={product.imageUrl}
                        icon={product.icon}
                        alt={product.name}
                        className="absolute inset-0"
                        imageClassName="opacity-65 transition-opacity group-hover:opacity-82"
                        emojiClassName="text-5xl md:text-6xl"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10" />
                      <div className="relative z-10 flex min-h-[116px] flex-col justify-between px-3 py-3 md:min-h-[124px] md:px-4 md:py-4">
                        <p className="line-clamp-4 text-[16px] font-black uppercase leading-[1.02] text-white md:text-[20px]">
                          {product.name}
                        </p>
                        <div className="mt-3 flex items-end justify-end md:mt-4">
                          <span className="text-[7px] font-black uppercase tracking-[0.16em] text-white/75 md:text-[8px]">
                            Tocar para agregar
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          <aside className="flex min-h-[36vh] max-h-[42vh] flex-col border-t border-outline-variant/10 bg-surface-container-low xl:min-h-0 xl:max-h-none xl:border-t-0">
            <div className="border-b border-outline-variant/10 px-3 py-3 md:px-5 md:py-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[8px] font-black uppercase tracking-[0.18em] text-outline">
                    Carrito por enviar
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.14em] text-outline md:text-[10px]">
                    Ajusta cantidades, elimina productos y agrega notas de producción.
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-outline">
                    Total
                  </p>
                  <p className="mt-1 font-headline text-2xl font-black text-primary">
                    {formatCurrency(pendingSubtotal)}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 custom-scrollbar md:px-5 md:py-4">
              <div className="space-y-3">
                {pendingSelection.length === 0 ? (
                  <EmptyInline message="Toca productos del menú para agregarlos al carrito antes de enviar la comanda." />
                ) : (
                  pendingSelection.map((item) => (
                    <SelectionRow
                      key={item.draftId}
                      item={item}
                      onDecrease={() =>
                        updatePendingQuantity(item.draftId, -1)
                      }
                      onIncrease={() =>
                        updatePendingQuantity(item.draftId, 1)
                      }
                      onRemove={() => removeItem(item.draftId)}
                      onEditNotes={() => openNoteEditor(item)}
                    />
                  ))
                )}
              </div>

              <div className="mt-6 border-t border-outline-variant/10 pt-6">
                <p className="text-[8px] font-black uppercase tracking-[0.18em] text-outline">
                  Comandas enviadas
                </p>
                <div className="mt-3 space-y-3">
                  {groupedSubmittedItems.length === 0 ? (
                    <EmptyInline message="Aún no se ha enviado ninguna comanda a producción." />
                  ) : (
                    groupedSubmittedItems.map((group, index) => (
                      <div key={group.batch} className="border border-outline-variant/10 bg-surface">
                        <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-high px-3 py-3">
                          <div className="flex items-center gap-2">
                            <ReceiptText className="h-4 w-4 text-primary" />
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-on-surface">
                              Comanda {index + 1}
                            </span>
                          </div>
                          <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-outline">
                            {new Date(group.submittedAt).toLocaleTimeString('es-MX', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <div className="space-y-2 p-3">
                          {group.items.map((item: any) => (
                            <div key={item.id} className="flex items-start justify-between border border-outline-variant/10 bg-surface-container-low px-3 py-2">
                              <div>
                                <p className="text-[9px] font-black uppercase text-on-surface">
                                  {item.quantity}x {item.product?.name || 'Producto'}
                                </p>
                                <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-outline">
                                  Estado {item.status}
                                </p>
                              </div>
                              <span className="text-[9px] font-black text-primary">
                                {formatCurrency(Number(item.price) * item.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-outline-variant/10 px-3 py-3 md:px-5 md:py-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => clearPendingSelection()}
                  disabled={pendingSelection.length === 0}
                  className="flex items-center justify-center gap-2 border border-outline-variant/10 bg-surface-container-highest px-4 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-on-surface disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                  Limpiar carrito
                </button>
                <button
                  onClick={() => submitMutation.mutate()}
                  disabled={
                    !currentOrder?.id ||
                    (pendingSelection.length === 0 && serverDraftItems.length === 0) ||
                    submitMutation.isPending
                  }
                  className="flex items-center justify-center gap-2 border border-primary bg-primary px-4 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-on-primary disabled:opacity-40"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  Enviar comanda
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {isCreateTableOpen ? (
        <TabletModal title="Agregar mesa personalizada" onClose={() => setIsCreateTableOpen(false)}>
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">
              Crea una mesa nueva y entra directo al menú para levantar el pedido.
            </p>

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.16em] text-outline">
                Nombre de la mesa
              </label>
              <input
                value={customTableName}
                onChange={(event) => setCustomTableName(event.target.value)}
                placeholder="Ej. Terraza 1 / Barra 2 / Evento"
                className="w-full border border-outline-variant/10 bg-surface-container-high px-4 py-4 text-[11px] font-black uppercase tracking-[0.08em] text-on-surface outline-none placeholder:text-outline"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.16em] text-outline">
                Área
              </label>
              <select
                value={customTableAreaId}
                onChange={(event) => setCustomTableAreaId(event.target.value)}
                className="w-full border border-outline-variant/10 bg-surface-container-high px-4 py-4 text-[11px] font-black uppercase tracking-[0.08em] text-on-surface outline-none"
              >
                {areas.map((area: any) => (
                  <option key={area.id} value={area.id}>
                    {area.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => createCustomTableMutation.mutate()}
              disabled={!customTableName.trim() || !customTableAreaId || createCustomTableMutation.isPending}
              className="flex w-full items-center justify-center gap-2 border border-primary bg-primary px-4 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-on-primary disabled:opacity-40"
            >
              {createCustomTableMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PlusSquare className="h-4 w-4" />
              )}
              Crear mesa y abrir pedido
            </button>
          </div>
        </TabletModal>
      ) : null}

      {noteEditorItemId ? (
        <TabletModal title="Comentario de producción" onClose={closeNoteEditor}>
          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-outline">
              Escribe instrucciones para cocina. Este comentario se enviará junto con la comanda.
            </p>

            <textarea
              value={noteDraft}
              onChange={(event) => setNoteDraft(event.target.value)}
              placeholder="Ej. sin cebolla, más cocido, aparte la salsa..."
              rows={6}
              className="w-full resize-none border border-outline-variant/10 bg-surface-container-high px-4 py-4 text-[11px] font-bold text-on-surface outline-none placeholder:text-outline"
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setNoteDraft('');
                }}
                className="flex items-center justify-center gap-2 border border-outline-variant/10 bg-surface-container-lowest px-4 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-on-surface"
              >
                <Delete className="h-4 w-4" />
                Limpiar nota
              </button>
              <button
                onClick={saveNoteEditor}
                className="flex items-center justify-center gap-2 border border-primary bg-primary px-4 py-4 text-[10px] font-black uppercase tracking-[0.16em] text-on-primary"
              >
                <FilePenLine className="h-4 w-4" />
                Guardar comentario
              </button>
            </div>
          </div>
        </TabletModal>
      ) : null}
    </div>
  );
}

function StatBlock({
  label,
  value,
  compact = false,
}: {
  label: string;
  value: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('border border-outline-variant/10 bg-surface-container-low px-4 py-3', compact && 'min-w-[150px]')}>
      <p className="text-[7px] font-black uppercase tracking-[0.16em] text-outline">
        {label}
      </p>
      <p className={cn('mt-2 font-headline font-black text-primary', compact ? 'text-xl' : 'text-3xl')}>
        {value}
      </p>
    </div>
  );
}

function MetricBlock({
  label,
  value,
  caption,
}: {
  label: string;
  value: string;
  caption: string;
}) {
  return (
    <div className="border border-outline-variant/10 bg-surface-container-low px-3 py-3">
      <p className="text-[7px] font-black uppercase tracking-[0.16em] text-outline">
        {label}
      </p>
      <p className="mt-2 font-headline text-2xl font-black text-primary">
        {value}
      </p>
      <p className="mt-1 text-[7px] font-bold uppercase tracking-[0.14em] text-outline">
        {caption}
      </p>
    </div>
  );
}

function TableSelectionCard({
  table,
  onClick,
}: {
  table: any;
  onClick: () => void;
}) {
  const isAvailable = table.status === 'AVAILABLE';

  return (
    <button
      onClick={onClick}
      className={cn(
        'border p-4 text-left transition-all active:scale-[0.99]',
        isAvailable
          ? 'border-outline-variant/10 bg-surface-container-low hover:border-primary/30'
          : 'border-primary/20 bg-surface-container-highest hover:border-primary/40',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[8px] font-black uppercase tracking-[0.16em] text-outline">
          Mesa
        </span>
        <Table2 className="h-4 w-4 text-primary" />
      </div>
      <div className="mt-4 font-headline text-4xl font-black text-on-surface">
        {table.name || table.id}
      </div>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className={cn(
          'text-[8px] font-black uppercase tracking-[0.16em]',
          isAvailable ? 'text-primary' : 'text-white',
        )}>
          {isAvailable ? 'Disponible' : 'Ocupada'}
        </span>
        <span className="text-[8px] font-bold uppercase tracking-[0.16em] text-outline">
          {table.orders?.[0]?.orderNumber ?? 'Entrar'}
        </span>
      </div>
    </button>
  );
}

function SelectionRow({
  item,
  onDecrease,
  onIncrease,
  onRemove,
  onEditNotes,
}: {
  item: PendingDraftItem;
  onDecrease: () => void;
  onIncrease: () => void;
  onRemove: () => void;
  onEditNotes: () => void;
}) {
  return (
    <div className="border border-outline-variant/10 bg-surface-container-high p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-black uppercase text-on-surface">
            {item.name}
          </p>
          <p className="mt-1 text-[8px] font-bold uppercase tracking-[0.14em] text-outline">
            {item.quantity} x {formatCurrency(item.price)}
          </p>
          <p className="mt-2 text-[10px] font-black text-primary">
            {formatCurrency(item.price * item.quantity)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onDecrease}
            className="flex h-8 w-8 items-center justify-center border border-outline-variant/10 bg-surface-container-lowest text-on-surface"
          >
            <Delete className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onIncrease}
            className="flex h-8 w-8 items-center justify-center border border-primary bg-primary text-on-primary"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            onClick={onRemove}
            className="flex h-8 w-8 items-center justify-center border border-red-500/20 bg-red-500/10 text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 border border-outline-variant/10 bg-surface-container-lowest px-3 py-3">
        <div className="min-w-0">
          <p className="text-[8px] font-black uppercase tracking-[0.16em] text-outline">
            Comentario de producción
          </p>
          <p className="mt-1 line-clamp-2 text-[9px] font-bold text-on-surface">
            {item.notes || 'Sin comentario'}
          </p>
        </div>
        <button
          onClick={onEditNotes}
          className="flex h-10 min-w-10 items-center justify-center border border-outline-variant/10 bg-surface-container-high px-3 text-on-surface hover:text-primary"
        >
          <FilePenLine className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EmptyPanel({ message }: { message: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 border border-dashed border-outline-variant/20 bg-surface-container-low px-6 py-8 text-center">
      <ShoppingBag className="h-10 w-10 text-outline" />
      <p className="max-w-sm text-[9px] font-bold uppercase tracking-[0.14em] text-outline">
        {message}
      </p>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return (
    <div className="border border-dashed border-outline-variant/20 bg-surface-container-high px-3 py-4 text-center">
      <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-outline">
        {message}
      </p>
    </div>
  );
}

function TabletModal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm">
      <div className="w-full max-w-xl border border-outline-variant/10 bg-surface-container-low shadow-2xl">
        <div className="flex items-center justify-between border-b border-outline-variant/10 bg-surface-container-high px-5 py-4">
          <h3 className="font-headline text-xl font-black uppercase tracking-[0.08em] text-on-surface">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center border border-outline-variant/10 bg-surface-container-low px-3 py-2 text-[9px] font-black uppercase tracking-[0.16em] text-on-surface"
          >
            Cerrar
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
