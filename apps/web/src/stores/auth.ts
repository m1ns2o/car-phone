import { create } from 'zustand';
import { authApi, setToken, getToken } from '@carphone/api';

interface AuthState {
  user: { id: string; username: string } | null;
  ready: boolean;
  logout: () => Promise<void>;
  checkMe: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  ready: false,
  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      /* ignore */
    }
    setToken(null);
    set({ user: null });
  },
  checkMe: async () => {
    if (!getToken()) {
      set({ user: null, ready: true });
      return;
    }
    try {
      const res = await authApi.me();
      set({ user: res.data.user, ready: true });
    } catch {
      setToken(null);
      set({ user: null, ready: true });
    }
  },
}));
