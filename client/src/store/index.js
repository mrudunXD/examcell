import { create } from 'zustand';
import api from '../lib/api.js';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isLoading: false,

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      localStorage.setItem('user', JSON.stringify(data.user));
      set({ user: data.user, isLoading: false });
      return { success: true, mustChangePassword: data.mustChangePassword };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.response?.data?.error || 'Login failed' };
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch (err) {}
    localStorage.removeItem('user');
    set({ user: null });
  },
}));

export const useAppStore = create((set, get) => ({
  activeCycleId: localStorage.getItem('activeCycleId') || null,

  setActiveCycle: (id) => {
    if (id) localStorage.setItem('activeCycleId', id);
    else localStorage.removeItem('activeCycleId');
    set({ activeCycleId: id });
  },
}));
