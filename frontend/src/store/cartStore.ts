import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';

export interface CartItem {
  cartId: string; // Unique ID for the cart row
  id: string; // Product ID
  name: string;
  price: number;
  quantity: number;
  image?: string;
  selectedModifiers?: any[];
  notes?: string;
  isRedeemable?: boolean;
  redeemableProductId?: number;
  pointsCost?: number;
}

export interface AssignedCustomer {
  id: number;
  name: string;
  phone?: string | null;
  loyaltyPoints: number;
}

interface CartState {
  items: CartItem[];
  customer: AssignedCustomer | null;
  setItems: (items: CartItem[]) => void;
  setCustomer: (customer: AssignedCustomer | null) => void;
  clearCustomer: () => void;
  updateCustomerPoints: (points: number) => void;
  addItem: (product: any, modifiers?: any[], notes?: string) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  updateNotes: (cartId: string, notes: string) => void;
  clearCart: () => void;
  getSubtotal: () => number;
  getTax: () => number;
  getTotal: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  customer: null,
  setItems: (items) => set({ items }),
  setCustomer: (customer) => set({ customer }),
  clearCustomer: () => set({ customer: null }),
  updateCustomerPoints: (points) =>
    set((state) => ({
      customer: state.customer ? { ...state.customer, loyaltyPoints: points } : null,
    })),

  addItem: (product, modifiers = [], notes = '') => {
    set((state) => {
      // Create a unique key for grouping (Product ID + Modifiers IDs + Notes)
      const modifierKey = [...modifiers]
        .sort((a, b) => a.id - b.id)
        .map((m) => m.id)
        .join(',');
      const itemGroupKey = `${product.id}-${modifierKey}-${notes}`;

      const existingItem = state.items.find((item) => item.cartId === itemGroupKey);

      if (existingItem) {
        return {
          items: state.items.map((item) =>
            item.cartId === itemGroupKey
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        };
      }

      // Calculate base total price for item including modifiers
      const modifierPriceSum = modifiers.reduce((acc, m) => acc + Number(m.price), 0);
      const finalPrice = Number(product.price);

      return {
        items: [
          ...state.items,
          {
            ...product,
            cartId: itemGroupKey,
            id: product.id.toString(),
            price: finalPrice, 
            quantity: 1,
            selectedModifiers: modifiers,
            notes: notes,
            isRedeemable: product.isRedeemable ?? false,
            redeemableProductId: product.redeemableProductId,
            pointsCost: product.pointsCost,
          },
        ],
      };
    });
  },

  removeItem: (cartId) => {
    set((state) => ({
      items: state.items.filter((item) => item.cartId !== cartId),
    }));
  },

  updateQuantity: (cartId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.cartId === cartId ? { ...item, quantity: Math.max(1, quantity) } : item
      ),
    }));
  },

  updateNotes: (cartId, notes) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.cartId === cartId ? { ...item, notes } : item
      ),
    }));
  },

  clearCart: () => set({ items: [], customer: null }),

  getSubtotal: () => {
    const items = get().items;
    return items.reduce((acc, item) => {
      if (item.isRedeemable) {
        return acc;
      }
      const modifierTotal = (item.selectedModifiers ?? []).reduce((sum, m) => sum + Number(m.price), 0);
      return acc + (item.price + modifierTotal) * item.quantity;
    }, 0);
  },

  getTax: () => {
    const { taxEnabled, taxRate } = useSettingsStore.getState();
    if (!taxEnabled) return 0;
    return get().getSubtotal() * (taxRate / 100);
  },

  getTotal: () => {
    return get().getSubtotal() + get().getTax();
  },
}));
