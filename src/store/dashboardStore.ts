import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getAdapter, FamilyTreeRecord } from '@/lib/adapters';

interface DashboardState {
  familyTrees: FamilyTreeRecord[];
  viewMode: 'card' | 'list';
  isPremium: boolean;
  isLoading: boolean;

  // Actions
  fetchTrees: () => Promise<void>;
  setViewMode: (mode: 'card' | 'list') => void;
  createFamilyTree: (name: string) => Promise<FamilyTreeRecord>;
  updateFamilyTree: (id: string, updates: Partial<FamilyTreeRecord>) => Promise<void>;
  deleteFamilyTree: (id: string) => Promise<void>;
  setPremium: (premium: boolean) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      familyTrees: [],
      viewMode: 'card',
      isPremium: false,
      isLoading: false,

      fetchTrees: async () => {
        set({ isLoading: true });
        try {
          const adapter = getAdapter();
          const trees = await adapter.listTrees();
          set({ familyTrees: trees, isLoading: false });
        } catch {
          set({ isLoading: false });
          // Silently fail — keep cached data if available
        }
      },

      setViewMode: (mode) => set({ viewMode: mode }),

      createFamilyTree: async (name) => {
        const adapter = getAdapter();
        const newTree = await adapter.createTree({ name });
        set((state) => ({
          familyTrees: [...state.familyTrees, newTree],
        }));
        return newTree;
      },

      updateFamilyTree: async (id, updates) => {
        const adapter = getAdapter();
        const updated = await adapter.updateTree(id, updates);
        set((state) => ({
          familyTrees: state.familyTrees.map((tree) =>
            tree.id === id ? { ...tree, ...updated } : tree,
          ),
        }));
      },

      deleteFamilyTree: async (id) => {
        const adapter = getAdapter();
        await adapter.deleteTree(id);
        set((state) => ({
          familyTrees: state.familyTrees.filter((tree) => tree.id !== id),
        }));
      },

      setPremium: (premium) => set({ isPremium: premium }),
    }),
    {
      name: 'dashboard-storage',
      partialize: (state) => ({
        familyTrees: state.familyTrees,
        viewMode: state.viewMode,
        isPremium: state.isPremium,
      }),
    },
  ),
);