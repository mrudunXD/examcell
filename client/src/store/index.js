import { create } from 'zustand';
import api from '../lib/api.js';

export const useAuthStore = create((set) => ({
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isLoading: false,

  login: async (email, password, totpToken = null) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { email, password, totpToken });
      if (data.mfaRequired) {
        set({ isLoading: false });
        return { success: true, mfaRequired: true, userId: data.userId };
      }
      if (data.mfaEnrollmentRequired) {
        set({ isLoading: false });
        return { success: true, mfaEnrollmentRequired: true, userId: data.userId, secret: data.secret, otpauthUrl: data.otpauthUrl };
      }
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

  setUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  checkAuth: async () => {
    try {
      const { data } = await api.get('/auth/me');
      if (data.user) {
        localStorage.setItem('user', JSON.stringify(data.user));
        set({ user: data.user });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        localStorage.removeItem('user');
        set({ user: null });
      }
    }
  },
}));

export const useAppStore = create((set, get) => ({
  activeCycleId: localStorage.getItem('activeCycleId') || null,
  theme: localStorage.getItem('theme') || 'dark',

  setActiveCycle: (id) => {
    if (id) localStorage.setItem('activeCycleId', id);
    else localStorage.removeItem('activeCycleId');
    set({ activeCycleId: id });
  },

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },

  toggleTheme: () => {
    const nextTheme = get().theme === 'dark' ? 'light' : 'dark';
    get().setTheme(nextTheme);
  },
}));

export const useSettingsStore = create((set, get) => ({
  settings: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/settings');
      set({ settings: data, isLoading: false });
    } catch (err) {
      set({ isLoading: false, error: err.response?.data?.error || 'Failed to load settings' });
    }
  },

  updateSettings: async (settingsMap) => {
    set({ isSaving: true });
    try {
      await api.post('/settings', settingsMap);
      set({ isSaving: false });
      await get().fetchSettings();
      return { success: true };
    } catch (err) {
      set({ isSaving: false });
      return { success: false, error: err.response?.data?.error || 'Failed to save settings' };
    }
  },

  resetToDefaults: async () => {
    set({ isSaving: true });
    try {
      await api.post('/settings/reset');
      set({ isSaving: false });
      await get().fetchSettings();
      return { success: true };
    } catch (err) {
      set({ isSaving: false });
      return { success: false, error: err.response?.data?.error || 'Failed to reset settings' };
    }
  }
}));
