import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAdapter, AuthError } from '@/lib/adapters';
import type { AuthUser } from '@/lib/adapters';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string, invitationToken?: string) => Promise<void>;
  clearError: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      isInitialized: false,

      /**
       * Initialize auth state on app start.
       * Tries to restore session from the configured adapter.
       * Call this once in App.tsx on mount.
       */
      initialize: async () => {
        if (get().isInitialized) return;
        set({ isLoading: true });
        try {
          const adapter = getAdapter();
          const session = await adapter.getSession();
          if (session) {
            set({
              user: session.user,
              isAuthenticated: true,
              isLoading: false,
              isInitialized: true,
            });
          } else {
            set({ isLoading: false, isInitialized: true });
          }
        } catch {
          // Session restore failed — user stays logged out
          set({ isLoading: false, isInitialized: true });
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const adapter = getAdapter();
          const session = await adapter.login({ email, password });
          set({
            user: session.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      register: async (email: string, password: string, name: string, invitationToken?: string) => {
        set({ isLoading: true, error: null });
        try {
          const adapter = getAdapter();
          const session = await adapter.register({ email, password, name, invitationToken });
          set({
            user: session.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          if (error instanceof AuthError && error.code === 'ACCOUNT_PENDING') {
            // A 202 pending registration is a success as far as the account
            // goes: keep it out of the red error slot and let the login page
            // hold the waiting-for-activation panel from its own form state.
            set({ isLoading: false, error: null });
            throw error;
          }
          const message = error instanceof Error ? error.message : 'Registration failed';
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      logout: async () => {
        try {
          const adapter = getAdapter();
          await adapter.logout();
        } catch {
          // Logout locally even if adapter call fails
        }
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      updateUser: (updates: Partial<AuthUser>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
);