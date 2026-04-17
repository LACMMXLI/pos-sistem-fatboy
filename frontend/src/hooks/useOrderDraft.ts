import { useState, useMemo } from 'react';
import { toast } from 'sonner';

export interface DraftItem {
  draftId: string;
  productId: number;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  selectedModifierIds?: number[];
}

export function useOrderDraft() {
  const [items, setItems] = useState<DraftItem[]>([]);

  const total = useMemo(() => 
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  , [items]);

  const addItem = (product: any) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id && !i.notes && (!i.selectedModifierIds || i.selectedModifierIds.length === 0));
      
      if (existing) {
        return prev.map((i) => 
          i.draftId === existing.draftId 
            ? { ...i, quantity: i.quantity + 1 } 
            : i
        );
      }

      const newItem: DraftItem = {
        draftId: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        productId: product.id,
        name: product.name,
        price: Number(product.price),
        quantity: 1,
        notes: '',
      };

      return [...prev, newItem];
    });
  };

  const removeItem = (draftId: string) => {
    setItems((prev) => prev.filter((i) => i.draftId !== draftId));
  };

  const updateQuantity = (draftId: string, delta: number) => {
    setItems((prev) => 
      prev.map((i) => 
        i.draftId === draftId 
          ? { ...i, quantity: Math.max(0, i.quantity + delta) } 
          : i
      ).filter((i) => i.quantity > 0)
    );
  };

  const updateNotes = (draftId: string, notes: string) => {
    setItems((prev) => 
      prev.map((i) => 
        i.draftId === draftId ? { ...i, notes } : i
      )
    );
  };

  const clearDraft = () => setItems([]);

  return {
    items,
    total,
    addItem,
    removeItem,
    updateQuantity,
    updateNotes,
    clearDraft,
  };
}
