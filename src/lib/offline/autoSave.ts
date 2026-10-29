import { useDashboardStore } from '../../store/dashboardStore';
import { useFamilyStore } from '../../store/familyStore';
import { serializeAndStore } from './familyStoreAdapter';

const AUTOSAVE_DEBOUNCE_MS = 1500;

/**
 * v109: langganan autosave offline untuk pohon keluarga.
 *
 * Setiap perubahan state yang lolos guard (tidak sedang loading dan
 * currentFamilyTreeId terisi) dijadwalkan tersimpan ke IndexedDB lewat
 * debounce 1500ms dengan satu timer tunggal; perubahan baru mereset
 * jendela debounce. Nama pohon diambil dari dashboardStore berdasarkan
 * treeId.
 *
 * Mengembalikan fungsi unsubscribe yang membersihkan timer pending dan
 * melepas listener.
 */
export function subscribeAutoSave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const unsubscribe = useFamilyStore.subscribe((state) => {
    clearTimer();

    if (state.isLoading || !state.currentFamilyTreeId) {
      return;
    }

    const treeId = state.currentFamilyTreeId;
    const members = state.members;
    const relationships = state.relationships;

    timer = setTimeout(() => {
      timer = null;
      const treeName =
        useDashboardStore.getState().familyTrees.find((t) => t.id === treeId)?.name ?? '';
      void serializeAndStore(treeId, treeName, members, relationships);
    }, AUTOSAVE_DEBOUNCE_MS);
  });

  return () => {
    clearTimer();
    unsubscribe();
  };
}
