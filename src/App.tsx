import { useEffect, useState } from 'react';
import { ProtectedRoute } from './components/Auth/ProtectedRoute';
import { Dashboard } from './components/Dashboard/Dashboard';
import { UpgradePage } from './components/Upgrade/UpgradePage';
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

function App() {
  const { selectedMember, fetchMembers } = useFamilyStore();
  const { familyTrees, fetchTrees } = useDashboardStore();
  const { isInitialized, initialize } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [currentView, setCurrentView] = useState<'dashboard' | 'family-tree' | 'upgrade'>('dashboard');
  const [currentFamilyTreeName, setCurrentFamilyTreeName] = useState<string>('');

  // Initialize auth + load trees on mount
  useEffect(() => {
    initialize();
    fetchTrees();
  }, [initialize, fetchTrees]);

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
    } else if (route === '/upgrade') {
      setCurrentView('upgrade');
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
      } else if (route === '/upgrade') {
        setCurrentView('upgrade');
      } else {
        setCurrentView('dashboard');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [fetchMembers, familyTrees]);

  return (
    <ProtectedRoute>
      {currentView === 'dashboard' && <Dashboard />}
      {currentView === 'upgrade' && <UpgradePage />}
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