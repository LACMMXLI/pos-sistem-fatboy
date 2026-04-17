import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
}

const applyThemeClass = (mode: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (mode === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
};

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'dark',
      setMode: (mode) => {
        applyThemeClass(mode);
        set({ mode });
      },
      toggleMode: () => {
        const nextMode: ThemeMode = get().mode === 'light' ? 'dark' : 'light';
        applyThemeClass(nextMode);
        set({ mode: nextMode });
      },
    }),
    { name: 'fatboy-theme-storage' },
  ),
);

export const initTheme = () => {
  const mode = useThemeStore.getState().mode || 'dark';
  applyThemeClass(mode);
};
