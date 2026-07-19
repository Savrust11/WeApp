import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl } from '../api/client';
import { syncSharedData, clearSharedData } from '../utils/sharedData';

export interface User {
  id: number;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  familyId: string;
  role: 'papa' | 'mama' | 'other';
  invitationVerified?: boolean;
}

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: !!user }),

  setLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    try {
      const token = await AsyncStorage.getItem('sessionToken');
      if (token) {
        // Invalidate the mobile token on the backend.
        await fetch(`${getBaseUrl()}/api/auth/mobile/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore network errors on logout — clear local state regardless.
    }
    await AsyncStorage.multiRemove([
      'sessionToken',
      'familyId',
      'userRole',
      'displayName',
      'pictureUrl',
    ]);
    clearSharedData();
    set({ user: null, isAuthenticated: false });
  },

  loadFromStorage: async () => {
    try {
      const [token, familyId, displayName, role, pictureUrl] = await AsyncStorage.multiGet([
        'sessionToken',
        'familyId',
        'displayName',
        'userRole',
        'pictureUrl',
      ]).then((pairs) => pairs.map(([, v]) => v));

      if (token && familyId && displayName) {
        set({
          user: {
            id: 0,
            lineUserId: '',
            displayName,
            pictureUrl: pictureUrl ?? undefined,
            familyId,
            role: (role as 'papa' | 'mama' | 'other') ?? 'papa',
          },
          isAuthenticated: true,
        });
        syncSharedData();
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
