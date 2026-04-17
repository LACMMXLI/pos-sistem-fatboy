import React, { useMemo, useRef, useState, useEffect } from 'react';
import { Search, Edit3, X, Save, Trash2, Loader2, Star, UserRound, BadgeMinus, Gift, ChevronLeft, ChevronRight, Package, ShoppingCart, UserPlus, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useCartStore } from '../../store/cartStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import { getProducts, getCategories, getRedeemableProducts } from '../../services/api';
import { toast } from 'sonner';
import { useShiftStore } from '../../store/shiftStore';
import { AnimatePresence, motion } from 'framer-motion';
import { AssignCustomerModal } from '../../components/Modals/AssignCustomerModal';
import { getCategoryChipStyle } from '../../lib/categoryChip';
import { ProductVisual } from '../../components/ui/ProductVisual';

import { useMenu } from '../../hooks/useMenu';
import { CategoryRail } from '../../components/pos/CategoryRail';
import { ProductCard } from '../../components/pos/ProductCard';

interface SalesScreenProps {
  onPay: () => void;
  onRequireShift: () => void;
  isParentModalOpen?: boolean;
}

export function SalesScreen({ onPay, onRequireShift, isParentModalOpen = false }: SalesScreenProps) {
  const [isAssignCustomerModalOpen, setIsAssignCustomerModalOpen] = useState(false);
  const [isRedeemModalOpen, setIsRedeemModalOpen] = useState(false);
  const productListRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
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

  const { 
    categories, 
    products, 
    searchTerm,
    setSearchTerm,
    activeCategoryId, 
    isLoadingProducts, 
    handleCategorySelect 
  } = useMenu();

  const { data: redeemableProducts = [], isLoading: isLoadingRedeemables } = useQuery({ queryKey: ['redeemable-products'], queryFn: getRedeemableProducts });

  // Focus management: Don't steal focus if any modal is open
  const isAnyModalOpen = isAssignCustomerModalOpen || isRedeemModalOpen || isParentModalOpen;
  const shouldFocusSearch = !isAnyModalOpen && !!activeShift;

  useEffect(() => {
    if (shouldFocusSearch) {
      // Small delay to ensure any closing modal has finished its transition
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [shouldFocusSearch, products.length, cart.length]); // Refocus on modal close, search list change, or cart change

  const handleAddToCart = (product: any) => {
    if (!activeShift) { toast.error('Turno cerrado'); onRequireShift(); return; }
    addItem(product);
    toast.success(`${product.name} +1`);
    setSearchTerm(''); // Clear search after adding
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (products.length === 1) {
        handleAddToCart(products[0]);
      }
    }
  };

  const handleRemove = (cartId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    removeItem(cartId);
    // Focus will return via cart.length dependency in useEffect
  };

  const handleClearCart = () => {
    clearCart();
    setSearchTerm('');
    // Focus will return via cart.length dependency in useEffect
  };

  const handlePay = () => {
    if (!activeShift) { onRequireShift(); return; }
    onPay();
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden bg-[#050505]">{/* COLOR: Fondo principal de la vista de ventas */}
      {/* Product Section */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 overflow-hidden bg-[#0a0a0a] p-1.5 relative">{/* COLOR: Fondo de la sección de productos (centro) */}
        {!activeShift && (
          <div className="relative z-10 flex items-center justify-between gap-3 bg-red-600/20 border border-red-600/40 px-3 py-1.5 mb-1">
            <span className="text-[9px] font-black text-white uppercase tracking-widest">⚠️ TURNO CERRADO</span>
            <button onClick={onRequireShift} className="bg-red-600 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest hover:bg-red-500 transition-all">ABRIR</button>{/* COLOR: Botón de alerta "Abrir Turno" (Rojo) */}
          </div>
        )}

        {/* Smart Search Input */}
        <div className="relative z-10 px-1 py-1">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className={cn("h-4 w-4 transition-colors", searchTerm ? "text-primary" : "text-white/20")} />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Buscar producto... (ENTER para agregar)"
              autoComplete="off"
              className="block w-full pl-10 pr-3 py-2.5 bg-white/5 border border-white/10 text-white text-[11px] font-bold uppercase tracking-wider placeholder:text-white/10 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 focus:bg-white/[0.08] transition-all rounded-[2px]"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/20 hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Compact Category Rail */}
        <div className="relative z-10 border-b border-white/5 pb-1.5">
          <CategoryRail 
            categories={categories} 
            activeCategoryId={activeCategoryId} 
            onCategorySelect={handleCategorySelect} 
          />
        </div>

        {/* Product Grid */}
        <div ref={productListRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto custom-scrollbar p-1">
          {isLoadingProducts ? (<div className="h-full flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
              {products.length === 0 ? (
                <div className="col-span-full h-40 flex flex-col items-center justify-center opacity-20">
                  <Search className="w-8 h-8 mb-2" />
                  <p className="text-[10px] font-black uppercase tracking-widest">Sin resultados</p>
                </div>
              ) : (
                products.map((product: any) => (
                  <ProductCard 
                    key={product.id} 
                    product={product} 
                    onClick={handleAddToCart} 
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>


      {/* RADICAL CART: Red with Orange Vivid Contrast */}
      <aside className="flex h-full min-h-0 w-[230px] shrink-0 flex-col overflow-hidden border-l border-white/10 bg-[#1a0000] z-20 shadow-[0_0_60px_rgba(0,0,0,0.9)]">{/* COLOR: Fondo del panel lateral del carrito (Rojo Oscuro) */}
        {/* Cart Header: Vivid Orange/Red */}
        <div className="p-2.5 bg-gradient-to-r from-red-600 to-orange-500 border-b border-white/10 flex justify-between items-center shadow-lg">{/* COLOR: Encabezado del carrito (Degradado Rojo a Naranja) */}
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-3.5 h-3.5 text-white" />
            <h2 className="font-headline font-black text-[10px] tracking-[0.05em] text-white uppercase">Venta Directa</h2>
          </div>
          <div className="flex items-center gap-1.5">
             <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
             <span className="text-[8px] font-black text-white/90 uppercase tracking-widest">LIVE</span>
          </div>
        </div>

        {/* ULTRA-COMPACT Identification: Red/Amber Integration */}
        <div className="px-2 py-2 border-b border-red-500/10">
          {customer ? (
            <div className="flex items-center gap-2 p-1.5 bg-red-950/40 border border-orange-500/30 group relative">
              <div className="w-6 h-6 bg-orange-500 text-black flex items-center justify-center rounded-[1px]"><UserRound className="w-3.5 h-3.5" /></div>
              <div className="flex-1 min-w-0">
                <p className="truncate text-[9px] font-black uppercase text-white leading-none">{customer.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[7px] font-black text-orange-400 uppercase tracking-widest">{customer.loyaltyPoints} PTS</span>
                  <button onClick={() => setIsRedeemModalOpen(true)} className="text-[6px] font-black text-white bg-red-600 px-1 py-0.5 rounded-[1px] uppercase hover:bg-orange-500 transition-colors">Canje</button>
                </div>
              </div>
              <button onClick={clearCustomer} className="text-white/20 hover:text-white transition-colors"><X className="h-3 w-3" /></button>
            </div>
          ) : (
            <button onClick={() => setIsAssignCustomerModalOpen(true)} className="flex w-full items-center gap-2 bg-red-500/10 border border-dashed border-red-500/30 p-2 hover:bg-red-500/20 group transition-all">
              <UserPlus className="h-3.5 w-3.5 text-orange-400 group-hover:scale-110 transition-transform" />
              <div className="text-left">
                <p className="text-[9px] font-black uppercase tracking-tight text-white group-hover:text-orange-400">Identificar Cliente</p>
                <p className="text-[6px] font-bold uppercase text-red-400/50 leading-none">Fidelización Activa</p>
              </div>
            </button>
          )}
        </div>

        {/* ULTRA-COMPACT Cart List */}
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5 space-y-1 custom-scrollbar">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-10">
              <Package className="w-6 h-6 mb-1 text-red-500" />
              <p className="text-[7px] uppercase font-black tracking-widest text-red-500">SIN PRODUCTOS</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartId} className="flex flex-col gap-0.5 p-1.5 bg-red-950/20 border border-red-500/5 hover:border-orange-500/20 transition-all">
                <div className="flex justify-between items-start gap-1.5">
                  <span className="font-black text-[9px] text-white/90 uppercase leading-none flex-1 truncate">
                    <span className="text-orange-400 mr-1">{item.quantity}</span> {item.name}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black text-[9px] text-white">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                    <button onClick={(e) => handleRemove(item.cartId, e)} className="text-red-500/40 hover:text-white transition-all"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>
                {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {item.selectedModifiers.map((mod, idx) => (
                      <span key={idx} className="text-[6px] font-bold text-red-400/60 uppercase">+ {mod.name}</span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* RADICAL SUMMARY: Red/Orange Glow */}
        <div className="p-3 bg-gradient-to-b from-[#1a0000] to-black border-t border-red-500/20 shadow-[0_-10px_20px_rgba(255,0,0,0.1)]">{/* COLOR: Fondo de la sección de totales/resumen */}
          <div className="flex justify-between items-center opacity-50 mb-1 px-1">
             <span className="text-[7px] font-black uppercase tracking-widest text-white">SUBTOTAL</span>
             <span className="text-[9px] font-black text-white">${total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center border-t border-red-500/10 pt-1 px-1">
            <span className="font-black text-white uppercase text-[10px] tracking-widest">TOTAL</span>
            <span className="font-headline font-black text-orange-400 text-2xl tracking-tighter drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]">{/* COLOR: Texto del precio total (Naranja Brillante) */}
              ${total.toFixed(2)}
            </span>
          </div>
        </div>

        {/* RADICAL ACTION BUTTONS: Vivid Green/Red */}
        <div className="p-2 gap-1.5 bg-black border-t border-red-500/20 grid grid-cols-2">
           <button onClick={handleClearCart} className="flex h-10 items-center justify-center gap-1.5 bg-red-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-red-500 transition-all rounded-[1px] shadow-[0_0_20px_rgba(220,38,38,0.2)]">{/* COLOR: Botón de Limpiar Carrito (Rojo) */}
             <X className="w-4 h-4" /> LIMPIAR
           </button>
           <button onClick={handlePay} disabled={cart.length === 0} className="flex h-10 items-center justify-center gap-1.5 bg-green-600 text-white font-black uppercase text-[10px] tracking-widest hover:bg-green-500 disabled:opacity-20 transition-all rounded-[1px] shadow-[0_0_20px_rgba(34,197,94,0.2)]">{/* COLOR: Botón de Pagar (Verde) */}
             <CreditCard className="w-4 h-4" /> PAGAR
           </button>
        </div>
      </aside>

      <AnimatePresence>
        {isAssignCustomerModalOpen && (
          <AssignCustomerModal onClose={() => setIsAssignCustomerModalOpen(false)} onAssigned={(assignedCustomer) => setCustomer(assignedCustomer)} />
        )}
        {isRedeemModalOpen && customer && (
          <RedeemLoyaltyProductModal
            customer={customer}
            hasOrderItems={cart.some((item) => !item.isRedeemable)}
            redeemableProducts={redeemableProducts}
            isLoading={isLoadingRedeemables}
            onAddToOrder={(redeemable, quantity, notes) => {
              addItem({ id: redeemable.product.id, name: redeemable.product.name, price: 0, imageUrl: redeemable.product.imageUrl, isRedeemable: true, redeemableProductId: redeemable.id, pointsCost: redeemable.pointsCost }, [], notes);
              if (quantity > 1) { for (let i = 1; i < quantity; i++) addItem({ id: redeemable.product.id, name: redeemable.product.name, price: 0, imageUrl: redeemable.product.imageUrl, isRedeemable: true, redeemableProductId: redeemable.id, pointsCost: redeemable.pointsCost }, [], notes); }
              toast.success(`${redeemable.product.name} +`);
              setIsRedeemModalOpen(false);
            }}
            onClose={() => setIsRedeemModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function RedeemLoyaltyProductModal({ customer, hasOrderItems, redeemableProducts, isLoading, onAddToOrder, onClose }: { customer: any, hasOrderItems: boolean, redeemableProducts: any[], isLoading: boolean, onAddToOrder: any, onClose: any }) {
  const [selectedRedeemableId, setSelectedRedeemableId] = useState<string>('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');
  const selectedRedeemable = useMemo(() => redeemableProducts.find((entry) => String(entry.id) === selectedRedeemableId) ?? null, [redeemableProducts, selectedRedeemableId]);
  const totalPoints = (selectedRedeemable?.pointsCost ?? 0) * Number(quantity || 0);
  const hasEnoughPoints = totalPoints > 0 && customer.loyaltyPoints >= totalPoints;
  const canSubmit = !!selectedRedeemableId && Number(quantity) > 0 && hasEnoughPoints && hasOrderItems;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-sm px-4">
      <div className="w-full max-w-lg border border-red-500/20 bg-[#1a0000] shadow-2xl rounded-[2px] overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3 bg-red-600">
          <h2 className="font-headline text-lg font-black uppercase text-white tracking-tight">Canjear Producto</h2>
          <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between bg-red-900/30 border border-orange-500/20 px-4 py-3">
             <p className="text-[10px] font-black uppercase text-white">{customer.name}</p>
             <p className="text-[12px] font-black text-orange-400">{customer.loyaltyPoints} PTS</p>
          </div>
          <div className="space-y-4">
            <select value={selectedRedeemableId} onChange={(e) => setSelectedRedeemableId(e.target.value)} className="w-full bg-black text-white text-sm font-black p-3 outline-none border border-red-500/20 [color-scheme:dark]">
              <option value="">-- Elige producto --</option>
              {redeemableProducts.filter(e => e.isActive).map(e => (
                <option key={e.id} value={e.id}>{e.product.name} ({e.pointsCost} pts)</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-4">
               <div className="bg-black/40 p-3 border border-red-500/10"><label className="block text-[7px] font-black uppercase text-red-400 mb-1">Cantidad</label><input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full bg-transparent text-xl font-black text-white outline-none" /></div>
               <div className="bg-black/40 p-3 border border-red-500/10 flex flex-col justify-center"><label className="block text-[7px] font-black uppercase text-red-400 mb-1">Costo</label><div className={cn('text-xl font-black', hasEnoughPoints ? 'text-orange-400' : 'text-red-600')}>{totalPoints || 0} pts</div></div>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-outline text-[9px] font-black uppercase tracking-widest hover:bg-white/10">Cancelar</button>
            <button onClick={() => onAddToOrder(selectedRedeemable, Number(quantity), notes.trim())} disabled={!canSubmit} className="flex-1 py-3 bg-orange-500 text-black text-[9px] font-black uppercase tracking-widest hover:bg-orange-400 disabled:opacity-20 transition-all">Canjear Ahora</button>
          </div>
        </div>
      </div>
    </div>
  );
}
