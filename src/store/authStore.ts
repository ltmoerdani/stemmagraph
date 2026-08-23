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
  /**
   * P2-1: email of the most recent registration that the server accepted as
   * pending (202, no token). Null after a normal login/register/logout.
   */
  pendingRegistrationEmail: string | null;

  // Actions
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
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
      pendingRegistrationEmail: null,

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
            pendingRegistrationEmail: null,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ isLoading: false, error: message });
          throw error;
        }
      },

      register: async (email: string, password: string, name: string) => {
        set({ isLoading: true, error: null, pendingRegistrationEmail: null });
        try {
          const adapter = getAdapter();
          const session = await adapter.register({ email, password, name });
          set({
            user: session.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
            pendingRegistrationEmail: null,
          });
        } catch (error) {
          // P2-1: a 202 pending registration is a success as far as the
          // account goes. Keep it out of the red error slot and remember the
          // email so the UI can show the honest "waiting for activation" note.
          if (error instanceof AuthError && error.code === 'ACCOUNT_PENDING') {
            set({ isLoading: false, error: null, pendingRegistrationEmail: email });
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
          pendingRegistrationEmail: null,
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