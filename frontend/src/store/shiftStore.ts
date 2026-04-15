import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface CashMovement {
  id: number;
  movementType: 'IN' | 'OUT';
  amount: string;
  reason?: string;
  createdAt: string;
}

interface ShiftUser {
  id: number;
  name: string;
}

interface ActiveShift {
  id: number;
  userId: number;
  openingAmount: string;
  closingAmount?: string;
  closingUsdAmount?: string;
  closingCardAmount?: string;
  status: 'OPEN' | 'CLOSED';
  openedAt: string;
  closedAt?: string;
  user: ShiftUser;
  movements: CashMovement[];
}

interface ShiftState {
  activeShift: ActiveShift | null;
  setActiveShift: (shift: ActiveShift | null) => void;
  clearShift: () => void;
  checkActiveShift: () => Promise<boolean>;
}

export const useShiftStore = create<ShiftState>()(
  persist(
    (set, get) => ({
      activeShift: null,
      setActiveShift: (shift) => set({ activeShift: shift }),
      clearShift: () => set({ activeShift: null }),
      checkActiveShift: async () => {
        try {
          const { data } = await api.get('/cash-shifts/current');
          set({ activeShift: data || null });
          return !!data;
        } catch {
          set({ activeShift: null });
          return false;
        }
      },
    }),
    {
      name: 'fatboy-shift-storage',
    }
  )
);
