import { useEffect, useState } from 'react';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Dashboard } from './components/Dashboard/Dashboard';
import { Header } from './components/Header/Header';
import { Toolbar } from './components/Toolbar/Toolbar';
import { StatsSidebar } from './components/Sidebar/StatsSidebar';
import { MemberDetailSidebar } from './components/Sidebar/MemberDetailSidebar';
import { FamilyTreeView } from './components/FamilyTree/FamilyTreeView';
import { BottomNavigation } from './components/BottomNavigation/BottomNavigation';

import { useFamilyStore } from './store/familyStore';
import { useDashboardStore } from './store/dashboardStore';
import { useAuthStore } from './store/authStore';
import { currentRoute, pushRoute } from './utils/routing';
import { subscribeAutoSave } from './lib/offline/autoSave';
import { subscribeReconnectRefresh } from './lib/offline/reconnect';
import { countOutbox, listOutbox, clearBatch, deleteEntriesByIds, setEntryStatus } from './lib/offline/outbox';
import { flushOutbox } from './lib/offline/flush';
import { createBatchSender } from './lib/offline/batchAdapter';
import { getTree, listTreeIds } from './lib/offline/idb';
import { getAdapter } from './lib/adapters';
import { OutboxConfirmDialog } from './components/FamilyTree/OutboxConfirmDialog';

function App() {
  const { selectedMember, fetchMembers } = useFamilyStore();
  const { familyTrees, fetchTrees } = useDashboardStore();
  const { isInitialized, initialize } = useAuthStore();
  const outboxConfirmOpen = useFamilyStore((s) => s.outboxConfirmOpen);
  const outboxPendingCount = useFamilyStore((s) => s.outboxPendingCount);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'family-tree'>('dashboard');
  const [currentFamilyTreeName, setCurrentFamilyTreeName] = useState<string>('');

  // Initialize auth + load trees on mount
  useEffect(() => {
    initialize();
    fetchTrees();
  }, [initialize, fetchTrees]);

  // v109: autosave offline, satu langganan untuk seluruh siklus aplikasi.
  useEffect(() => {
    const unsub = subscribeAutoSave();
    return () => unsub();
  }, []);

  // v111 slice 2: refresh reconnect, satu langganan untuk seluruh siklus
  // aplikasi, pola sama dengan autosave di atasnya. Sumber data disuntik
  // lewat deps supaya modul reconnect tetap bisa diuji terpisah.
  useEffect(() => {
    const getLocalTree = async (treeId: string) => {
      const raw = await getTree(treeId);
      if (raw === null) return null;
      const savedAt = Date.parse(String((raw as { savedAt?: unknown }).savedAt ?? ''));
      if (Number.isNaN(savedAt)) return null;
      return { savedAt };
    };

    const getServerTree = async (treeId: string) => {
      const record = await getAdapter().getTree(treeId);
      if (record === null) return null;
      const savedAt = Date.parse(record.lastUpdated);
      if (Number.isNaN(savedAt)) return null;
      return { savedAt };
    };

    const refreshMembers = async (treeId: string) => {
      const state = useFamilyStore.getState();
      // Hanya pohon aktif yang boleh memuat ulang; pohon lain dilempar
      // agar reconnect menandai 'kept', data lokal dipertahankan.
      if (state.currentFamilyTreeId !== treeId) {
        throw new Error('reconnect_refresh_inactive_tree');
      }
      await state.fetchMembers(treeId);
      // fetchMembers menelan error adapter ke fallback offline v109;
      // fallback itulah tanda server belum benar-benar terjangkau.
      if (useFamilyStore.getState().offlineLoaded) {
        throw new Error('reconnect_refresh_offline_fallback');
      }
    };

    const unsub = subscribeReconnectRefresh({
      getLocalTree,
      getServerTree,
      refreshMembers,
      listTreeNames: listTreeIds,
      onStatus: (status, treeId) => {
        const state = useFamilyStore.getState();
        if (state.currentFamilyTreeId === treeId) {
          state.setReconnectStatus(status);
        }
      },
      // v112 slice 3: saat server terkonfirmasi reachable, tawarkan kirim
      // outbox lewat dialog konfirmasi. Tanpa entry, alur berhenti diam.
      onServerReachable: async () => {
        const count = await countOutbox();
        if (count === 0) {
          return;
        }
        const s = useFamilyStore.getState();
        s.setOutboxPendingCount(count);
        s.setOutboxConfirmOpen(true);
      },
    });
    return () => unsub();
  }, []);

  // v112 slice 3: alur konfirmasi kirim outbox dari dialog.
  // Dialog hanya membuka jalan; pemanggilan flush terjadi di sini agar
  // modul dialog tetap presentational. Status dan sisa count diperbarui
  // lewat onStatus flushOutbox.
  const handleOutboxConfirm = async () => {
    const state = useFamilyStore.getState();
    state.setOutboxConfirmOpen(false);
    await flushOutbox({
      listEntries: listOutbox,
      sendBatch: createBatchSender(),
      clearBatch,
      deleteEntries: deleteEntriesByIds,
      persistEntry: async (entry) => {
        await setEntryStatus(entry.id, entry.status ?? 'pending', entry.lastError);
      },
      onStatus: (status, remaining) => {
        const s = useFamilyStore.getState();
        if (status === 'flushed') {
          s.setOutboxStatus('flushed');
          s.setOutboxPendingCount(0);
        } else if (status === 'failed') {
          s.setOutboxStatus('failed');
          s.setOutboxPendingCount(remaining);
        }
      },
    });
  };

  const handleOutboxCancel = () => {
    // Batal: dialog tutup, outbox tidak disentuh.
    useFamilyStore.getState().setOutboxConfirmOpen(false);
  };

  useEffect(() => {
    // Wait for trees to load before determining view
    if (!isInitialized) return;

    const route = currentRoute();

    if (route.startsWith('/family-tree/')) {
      const treeId = route.split('/family-tree/')[1];
      const familyTree = familyTrees.find(tree => tree.id === treeId);

      if (!familyTree) {
        pushRoute('/dashboard');
        setCurrentView('dashboard');
        return;
      }

      setCurrentFamilyTreeName(familyTree.name);
      setCurrentView('family-tree');

      // Load members from adapter
      fetchMembers(treeId);
    } else {
      setCurrentView('dashboard');
    }
  }, [isInitialized, fetchMembers, familyTrees]);

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const route = currentRoute();
      if (route.startsWith('/family-tree/')) {
        const treeId = route.split('/family-tree/')[1];
        const familyTree = familyTrees.find(tree => tree.id === treeId);

        if (!familyTree) {
          setCurrentView('dashboard');
          return;
        }

        setCurrentFamilyTreeName(familyTree.name);
        setCurrentView('family-tree');
        fetchMembers(treeId);
      } else {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchMembers, familyTrees]);

  return (
    <ProtectedRoute>
      <OutboxConfirmDialog
        open={outboxConfirmOpen}
        count={outboxPendingCount}
        onCancel={handleOutboxCancel}
        onConfirm={() => {
          void handleOutboxConfirm();
        }}
      />
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'family-tree' && (
        <div className="h-screen flex flex-col bg-gray-50">
          <Header onMenuToggle={handleMenuToggle} familyName={currentFamilyTreeName} />

          <Toolbar
            onBackToDashboard={() => {
              pushRoute('/dashboard');
              setCurrentView('dashboard');
            }}
          />

          <div className="flex flex-1 overflow-hidden">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} lg:block`}>
              <StatsSidebar />
            </div>

            <div className="flex-1 flex flex-col">
              <FamilyTreeView />
            </div>

            {selectedMember && <MemberDetailSidebar />}
          </div>

          <BottomNavigation />
        </div>
      )}
    </ProtectedRoute>
  );
}

export default App;