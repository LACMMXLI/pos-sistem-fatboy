import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isDesktopRuntime, setDesktopSessionToken, clearDesktopSessionToken } from '../lib/runtime';

interface User {
  id: string | number;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      setAuth: (user, token) => {
        if (isDesktopRuntime()) {
          setDesktopSessionToken(token);
        } else {
          localStorage.setItem('token', token);
        }
        set({ user, token });
      },
      logout: () => {
        if (isDesktopRuntime()) {
          clearDesktopSessionToken();
        } else {
          localStorage.removeItem('token');
        }
        set({ user: null, token: null });
      },
    }),
    {
      name: 'fatboy-auth-storage',
      partialize: (state) => {
        // En desktop no persistimos el token en localStorage/zustand
        if (isDesktopRuntime()) {
          const { token, ...rest } = state;
          return rest as AuthState;
        }
        return state;
      },
    }
  )
);
