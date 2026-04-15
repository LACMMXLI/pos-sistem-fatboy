import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
  activeDockItem: string;
  activeOverlay: string | null;
  isQuickActionOpen: boolean;
  changeModal: { show: boolean; amount: number } | null;
  setActiveDockItem: (item: string) => void;
  setActiveOverlay: (overlay: string | null) => void;
  setQuickActionOpen: (open: boolean) => void;
  setChangeModal: (modal: { show: boolean; amount: number } | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      activeDockItem: 'dashboard',
      activeOverlay: null,
      isQuickActionOpen: false,
      changeModal: null,
      setActiveDockItem: (item) => set({ activeDockItem: item }),
      setActiveOverlay: (overlay) => set({ activeOverlay: overlay }),
      setQuickActionOpen: (open) => set({ isQuickActionOpen: open }),
      setChangeModal: (modal) => set({ changeModal: modal }),
    }),
    {
      name: 'fatboy-ui-storage',
      partialize: (state) => ({ 
        activeDockItem: state.activeDockItem,
        activeOverlay: state.activeOverlay,
        isQuickActionOpen: state.isQuickActionOpen
        // Do not persist changeModal
      }),
    }
  )
);
