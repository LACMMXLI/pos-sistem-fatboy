import React, { useMemo, useRef, useState } from 'react';
import { Edit3, X, Save, Trash2, Loader2, Star, UserRound, BadgeMinus, Gift, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCartStore } from '../../store/cartStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getProducts, getCategories, getRedeemableProducts } from '../../services/api';
import { toast } from 'sonner';
import { useShiftStore } from '../../store/shiftStore';
import { AnimatePresence } from 'framer-motion';
import { AssignCustomerModal } from '../../components/Modals/AssignCustomerModal';
import { getCategoryChipStyle } from '../../lib/categoryChip';
import { ProductVisual } from '../../components/ui/ProductVisual';

interface SalesScreenProps {
  onPay: () => void;
  onRequireShift: () => void;
}

export function SalesScreen({ onPay, onRequireShift }: SalesScreenProps) {
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [isAssignCustomerModalOpen, setIsAssignCustomerModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const categoryRailRef = useRef<HTMLDivElement | null>(null);
  const productListRef = useRef<HTMLDivElement | null>(null);
  const { activeShift } = useShiftStore();
  
  const { 
    items: cart, 
    customer,
    setCustomer,
    clearCustomer,
    addItem, 
    removeItem, 
    clearCart, 
    getTotal 
  } = useCartStore();

  const total = getTotal();
  const loyaltyPreview = Math.floor(total / 10);

  const { data: categories = [], isLoading: isLoadingCats } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories
  });

  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products', activeCategoryId],
    queryFn: () => getProducts(activeCategoryId || undefined)
  });

  const { data: redeemableProducts = [], isLoading: isLoadingRedeemables } = useQuery({
    queryKey: ['redeemable-products'],
    queryFn: getRedeemableProducts,
  });

  const handleAddToCart = (product: any) => {
    if (!activeShift) {
      toast.error('Necesitas abrir un turno antes de registrar una venta');
      onRequireShift();
      return;
    }
    addItem(product);
    toast.success(`${product.name} añadido`);
  };

  const handleRemove = (cartId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeItem(cartId);
  };

  const handlePay = () => {
    if (!activeShift) {
      toast.error('Primero abre un turno de caja para cobrar esta venta');
      onRequireShift();
      return;
    }

    onPay();
  };

  const scrollCategoryRail = (direction: 'left' | 'right') => {
    categoryRailRef.current?.scrollBy({
      left: direction === 'left' ? -240 : 240,
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


  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5 overflow-hidden bg-surface-container-low p-1.5">
        {!activeShift && (
          <div className="flex items-center justify-between gap-3 bg-error-container/10 border border-error/20 px-3 py-2">
            <div>
              <p className="text-[9px] font-black text-error uppercase tracking-widest">
                No hay turno abierto
              </p>
              <p className="text-[8px] text-outline font-bold uppercase tracking-widest">
                Abre caja antes de capturar productos o cobrar
              </p>
            </div>
            <button
              onClick={onRequireShift}
              className="bg-primary text-on-primary px-3 py-2 text-[8px] font-headline font-black uppercase tracking-widest"
            >
              Abrir Turno
            </button>
          </div>
        )}

        {/* Category Bar */}
        <div className="border-b border-outline-variant/10 pb-2">
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
              onClick={() => setActiveCategoryId(null)}
              className={cn("category-chip active:scale-[0.98]", activeCategoryId === null && "category-chip-active")}
              style={getCategoryChipStyle('all', 'Todos')}
            >
              <span className="category-chip-name">Todos</span>
            </button>
            {isLoadingCats ? (
              <div className="flex min-h-[62px] items-center px-4">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-outline" />
              </div>
            ) : (
              categories.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategoryId(cat.id.toString())}
                  className={cn(
                    "category-chip active:scale-[0.98]",
                    activeCategoryId === cat.id.toString() && "category-chip-active",
                  )}
                  style={getCategoryChipStyle(String(cat.id), cat.name ?? '')}
                >
                  <span className="category-chip-name line-clamp-2">{cat.name}</span>
                </button>
              ))
            )}
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

        {/* Product Grid */}
        <div
          ref={productListRef}
          className="min-h-0 flex-1 overflow-y-auto custom-scrollbar"
        >
          {isLoadingProducts ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-1">
              {products.map((product: any) => (
                <button
                  key={product.id}
                  onClick={() => handleAddToCart(product)}
                  className="relative group h-20 sm:h-24 bg-surface-container-highest overflow-hidden active:scale-95 transition-transform border border-outline-variant/10 hover:border-primary/50 flex flex-col"
                >
                  <ProductVisual
                    imageUrl={product.imageUrl || product.image}
                    icon={product.icon}
                    alt={product.name}
                    className="absolute inset-0 z-0 bg-black"
                    imageClassName="opacity-60 transition-opacity group-hover:opacity-82"
                    fallbackClassName="opacity-95"
                    emojiClassName="text-5xl"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/12"></div>
                  <div className="relative z-10 flex-1 p-1 flex flex-col justify-between items-center text-center w-full">
                    <span 
                      className="mt-0.5 flex min-h-[2.7rem] w-full items-center justify-center text-center font-headline text-[13px] font-black uppercase leading-[1.02] tracking-normal text-white line-clamp-3 drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)] sm:min-h-[3.15rem] sm:text-[15px]"
                      style={{ WebkitTextStroke: '0.4px rgba(0,0,0,0.5)', textShadow: '0px 1px 3px rgba(0,0,0,1)' }}
                    >
                      {product.name}
                    </span>
                    <span 
                      className="text-primary font-black text-[11px] sm:text-[12px] mt-auto drop-shadow-[0_2px_2px_rgba(0,0,0,0.9)]"
                      style={{ WebkitTextStroke: '0.4px rgba(0,0,0,0.8)', textShadow: '0px 1px 3px rgba(0,0,0,1)' }}
                    >
                      ${Number(product.price).toFixed(2)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <aside className="flex h-full min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-l border-outline-variant/10 bg-surface shadow-2xl">
        <div className="p-2.5 bg-surface-container-highest/30">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="font-headline font-black text-sm tracking-tight text-on-surface leading-none uppercase">
                Orden Para Llevar
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <p className="text-[7px] text-outline font-bold uppercase tracking-widest">Venta Directa • Caja 01</p>
                {customer ? (
                  <span className="inline-flex items-center gap-1 border border-primary/15 bg-primary/8 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-widest text-primary">
                    <UserRound className="h-2.5 w-2.5" />
                    {customer.name}
                  </span>
                ) : null}
              </div>
            </div>
            <button className="p-1 text-outline hover:text-white transition-colors">
              <Edit3 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="border-b border-outline-variant/10 px-2.5 py-2">
          {customer ? (
            <div className="flex items-center justify-between gap-2 border border-primary/15 bg-primary/5 px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-[7px] font-black uppercase tracking-widest text-primary">Cliente fidelizado</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                  <p className="truncate text-[9px] font-black uppercase tracking-tight text-white">{customer.name}</p>
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase tracking-widest text-primary">
                    <Star className="h-3 w-3 fill-current" />
                    {customer.loyaltyPoints} pts
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setIsAssignCustomerModalOpen(true)}
                  className="border border-outline-variant/10 bg-surface-container-high px-2 py-1 text-[7px] font-black uppercase tracking-widest text-outline transition-colors hover:text-white"
                >
                  Cambiar
                </button>
                <button
                  onClick={() => setIsRedeemModalOpen(true)}
                  className="border border-primary/15 bg-primary/8 px-2 py-1 text-[7px] font-black uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-on-primary"
                >
                  Canjear
                </button>
                <button
                  onClick={clearCustomer}
                  className="text-error/80 transition-colors hover:text-error"
                >
                  <BadgeMinus className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setIsAssignCustomerModalOpen(true)}
              className="flex w-full items-center justify-between border border-dashed border-outline-variant/20 bg-surface-container-high px-2.5 py-2 text-left transition-colors hover:border-primary/30 hover:bg-surface-container-highest"
            >
              <div>
                <p className="text-[7px] font-black uppercase tracking-widest text-primary">Fidelizacion</p>
                <p className="mt-1 text-[9px] font-headline font-black uppercase tracking-tight text-white">
                  Asignar cliente
                </p>
              </div>
              <UserRound className="h-4 w-4 text-primary" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-outline-variant opacity-50">
              <p className="font-headline text-[9px] uppercase font-bold tracking-widest">Carrito Vacío</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartId} className="flex items-start gap-1 p-1.5 bg-surface-container-high border border-outline-variant/5 group">
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-[9px] text-on-surface leading-tight pr-2">
                      {item.quantity}x {item.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[9px] text-on-surface whitespace-nowrap">
                        ${(Number(item.price) * item.quantity).toFixed(2)}
                      </span>
                      <button 
                        onClick={(e) => handleRemove(item.cartId, e)} 
                        className="text-error/50 hover:text-error transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                    <ul className="mt-0.5 space-y-0.5">
                      {item.selectedModifiers.map((mod, midx) => (
                        <li key={midx} className="flex items-center gap-1">
                          <span className="w-0.5 h-0.5 bg-tertiary-container"></span>
                          <span className="text-[7px] text-outline font-medium truncate">{mod.name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 bg-surface-container-low/50 border-t border-outline-variant/10">
          {customer && cart.length > 0 && (
            <div className="mb-2 flex items-center justify-between border border-primary/10 bg-primary/5 px-2 py-1.5">
              <span className="text-[7px] font-bold uppercase tracking-widest text-outline">Puntos por ganar</span>
              <span className="flex items-center gap-1 text-[10px] font-black text-primary">
                <Star className="h-3.5 w-3.5 fill-current" />
                {loyaltyPreview}
              </span>
            </div>
          )}
          <div className="flex justify-between items-baseline">
            <span className="font-headline font-black text-neutral-300 uppercase text-[8px] tracking-widest">Total</span>
            <span className="font-headline font-black text-primary text-xl tracking-tighter">${total.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Bar */}
        <div className="h-12 bg-surface-container-lowest flex items-center px-2.5 gap-1.5 border-t border-white/5">
          <button onClick={clearCart} className="flex items-center gap-1 text-error/80 font-headline font-extrabold uppercase text-[7px] tracking-widest px-2 py-1.5 hover:bg-error-container/10 hover:text-error transition-colors">
            <X className="w-3 h-3" /> Limpiar
          </button>
          <button className="flex items-center gap-1 text-outline font-headline font-extrabold uppercase text-[7px] tracking-widest px-2 py-1.5 hover:bg-surface-container-high hover:text-white transition-colors">
            <Save className="w-3 h-3" /> Guardar
          </button>
          <button 
            onClick={handlePay}
            disabled={cart.length === 0}
            className="ml-auto bg-primary text-on-primary px-3 py-1.5 font-headline font-black uppercase text-[9px] tracking-tighter shadow-[0_0_15px_rgba(76,214,255,0.2)] active:scale-95 transition-all disabled:opacity-50 disabled:shadow-none disabled:active:scale-100"
          >
            Pagar Ahora
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {isAssignCustomerModalOpen && (
          <AssignCustomerModal
            onClose={() => setIsAssignCustomerModalOpen(false)}
            onAssigned={(assignedCustomer) => setCustomer(assignedCustomer)}
          />
        )}
        {isRedeemModalOpen && customer && (
          <RedeemLoyaltyProductModal
            customer={customer}
            hasOrderItems={cart.some((item) => !item.isRedeemable)}
            redeemableProducts={redeemableProducts}
            isLoading={isLoadingRedeemables}
            onAddToOrder={(redeemable, quantity, notes) => {
              addItem(
                {
                  id: redeemable.product.id,
                  name: redeemable.product.name,
                  price: 0,
                  imageUrl: redeemable.product.imageUrl,
                  isRedeemable: true,
                  redeemableProductId: redeemable.id,
                  pointsCost: redeemable.pointsCost,
                },
                [],
                notes,
              );
              if (quantity > 1) {
                for (let index = 1; index < quantity; index += 1) {
                  addItem(
                    {
                      id: redeemable.product.id,
                      name: redeemable.product.name,
                      price: 0,
                      imageUrl: redeemable.product.imageUrl,
                      isRedeemable: true,
                      redeemableProductId: redeemable.id,
                      pointsCost: redeemable.pointsCost,
                    },
                    [],
                    notes,
                  );
                }
              }
              toast.success(`${redeemable.product.name} agregado al pedido para canje`);
              setIsRedeemModalOpen(false);
            }}
            onClose={() => setIsRedeemModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RedeemLoyaltyProductModal({
  customer,
  hasOrderItems,
  redeemableProducts,
  isLoading,
  onAddToOrder,
  onClose,
}: {
  customer: { id: number; name: string; loyaltyPoints: number };
  hasOrderItems: boolean;
  redeemableProducts: any[];
  isLoading: boolean;
  onAddToOrder: (redeemable: any, quantity: number, notes: string) => void;
  onClose: () => void;
}) {
  const [selectedRedeemableId, setSelectedRedeemableId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const selectedRedeemable = useMemo(
    () => redeemableProducts.find((entry) => String(entry.id) === selectedRedeemableId) ?? null,
    [redeemableProducts, selectedRedeemableId],
  );

  const totalPoints = (selectedRedeemable?.pointsCost ?? 0) * Number(quantity || 0);
  const hasEnoughPoints = totalPoints > 0 && customer.loyaltyPoints >= totalPoints;

  const canSubmit =
    !!selectedRedeemableId &&
    Number(quantity) > 0 &&
    hasEnoughPoints &&
    hasOrderItems;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/80 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg border border-outline-variant/10 bg-surface-container-low shadow-[0_20px_40px_rgba(0,0,0,0.55)]">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.28em] text-primary">Fidelizacion</p>
            <h2 className="mt-1 font-headline text-lg font-black uppercase tracking-tight text-white">
              Canjear producto
            </h2>
          </div>
          <button onClick={onClose} className="text-outline transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          <div className="flex items-center justify-between border border-primary/10 bg-primary/5 px-3 py-3">
            <div>
              <p className="text-[8px] font-black uppercase tracking-widest text-primary">{customer.name}</p>
              <p className="mt-1 text-[8px] font-bold uppercase tracking-widest text-outline">Saldo disponible</p>
            </div>
            <div className="flex items-center gap-1 text-[12px] font-black text-primary">
              <Star className="h-4 w-4 fill-current" />
              {customer.loyaltyPoints}
            </div>
          </div>

          <div className="border border-outline-variant/10 bg-surface-container-highest px-3 py-3">
            <label className="block text-[8px] font-bold uppercase tracking-widest text-outline">
              Producto canjeable
            </label>
            <select
              value={selectedRedeemableId}
              onChange={(event) => setSelectedRedeemableId(event.target.value)}
              className="mt-2 w-full bg-surface-container-highest text-base font-bold text-white outline-none [color-scheme:dark]"
            >
              <option className="bg-surface-container-highest text-white" value="">
                Selecciona un producto
              </option>
              {redeemableProducts
                .filter((entry) => entry.isActive)
                .map((entry) => (
                  <option className="bg-surface-container-highest text-white" key={entry.id} value={entry.id}>
                    {entry.product.name} · {entry.pointsCost} pts
                  </option>
                ))}
            </select>
            {isLoading ? (
              <div className="mt-2 flex items-center gap-2 text-[8px] font-bold uppercase tracking-widest text-outline">
                <Loader2 className="h-3 w-3 animate-spin" />
                Cargando productos canjeables
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="border border-outline-variant/10 bg-surface-container-highest px-3 py-3">
              <label className="block text-[8px] font-bold uppercase tracking-widest text-outline">
                Cantidad
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                className="mt-2 w-full bg-transparent text-base font-bold text-white outline-none"
              />
            </div>
            <div className="border border-outline-variant/10 bg-surface-container-highest px-3 py-3">
              <label className="block text-[8px] font-bold uppercase tracking-widest text-outline">
                Total puntos
              </label>
              <div className={cn('mt-2 text-base font-black', hasEnoughPoints ? 'text-primary' : 'text-red-400')}>
                {totalPoints || 0} pts
              </div>
            </div>
          </div>

          <div className="border border-outline-variant/10 bg-surface-container-highest px-3 py-3">
            <label className="block text-[8px] font-bold uppercase tracking-widest text-outline">
              Nota para producción
            </label>
            <input
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Opcional"
              className="mt-2 w-full bg-transparent text-sm font-bold text-white outline-none"
            />
          </div>

          {!hasOrderItems ? (
            <div className="border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-[8px] font-bold uppercase tracking-widest text-amber-200">
              Primero agrega al menos un producto normal al pedido. Los canjes solo se permiten dentro de una orden.
            </div>
          ) : selectedRedeemable && !hasEnoughPoints ? (
            <div className="border border-red-500/20 bg-red-500/10 px-3 py-3 text-[8px] font-bold uppercase tracking-widest text-red-300">
              El cliente no tiene puntos suficientes para este canje.
            </div>
          ) : null}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 border border-outline-variant/10 bg-surface-container-high px-3 py-3 text-[9px] font-headline font-black uppercase tracking-widest text-outline transition-colors hover:text-white"
            >
              Cancelar
            </button>
            <button
              onClick={() => onAddToOrder(selectedRedeemable, Number(quantity), notes.trim())}
              disabled={!canSubmit}
              className="flex flex-1 items-center justify-center gap-2 bg-primary px-3 py-3 text-[9px] font-headline font-black uppercase tracking-widest text-on-primary transition-all disabled:opacity-50"
            >
              <Gift className="h-4 w-4" />
              Agregar Al Pedido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
