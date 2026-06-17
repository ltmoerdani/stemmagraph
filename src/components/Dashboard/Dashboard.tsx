import React, { useState, useEffect } from 'react';
import { Plus, Users, Calendar, Settings, List, Grid3X3, Crown, TreePine } from 'lucide-react';
import { CreateFamilyTreeModal } from './CreateFamilyTreeModal';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { navigate, replaceRoute } from '../../utils/routing';

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { familyTrees, viewMode, setViewMode, isPremium } = useDashboardStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false);

  const maxMembersPerTree = isPremium ? Infinity : 15;
  const currentMemberCount = familyTrees.reduce((total, tree) => total + tree.memberCount, 0);

  // Check for upgrade success
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('upgraded') === 'true') {
      setShowUpgradeSuccess(true);
      // Remove the parameter from URL
      replaceRoute('/dashboard');
      // Hide success message after 5 seconds
      setTimeout(() => setShowUpgradeSuccess(false), 5000);
    }
  }, []);

  const handleCreateTree = () => {
    setShowCreateModal(true);
  };

  const handleOpenTree = (treeId: string) => {
    // Navigate to family tree interface
    navigate(`/family-tree/${treeId}`);
  };

  const handleUpgrade = () => {
    navigate('/upgrade');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Helper: Render the create new card button
  const renderCreateNewCard = () => (
    <button
      type="button"
      onClick={handleCreateTree}
      className="group relative bg-white rounded-xl border-2 border-dashed transition-all duration-200 h-48 flex flex-col items-center justify-center cursor-pointer border-gray-300 hover:border-green-500 hover:bg-green-50"
      aria-label="Create New Family Tree"
    >
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
        <Plus className="w-6 h-6 text-green-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">Create New Family Tree</h3>
      <p className="text-sm text-gray-500 text-center px-4">
        Start building a new family tree
      </p>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard">
      {/* Upgrade Success Notification */}
      {showUpgradeSuccess && (
        <div className="fixed top-4 right-4 bg-green-500 text-white p-4 rounded-lg shadow-lg z-50 animate-in slide-in-from-right-4 duration-300">
          <div className="flex items-center space-x-3">
            <Crown className="w-6 h-6" />
            <div>
              <p className="font-semibold">Congratulations! Your Account Is Now Premium</p>
              <p className="text-sm opacity-90">Enjoy all unlimited features</p>
            </div>
            <button
              onClick={() => setShowUpgradeSuccess(false)}
              className="text-white hover:text-gray-200"
              aria-label="Close upgrade notification"
            >
              {/* Use lucide-react X icon safely */}
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <TreePine className="w-8 h-8 text-green-600" />
              <h1 className="text-2xl font-bold text-gray-900">FamilyTree</h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6 ml-8">
              <button className="text-blue-600 font-medium border-b-2 border-blue-600 pb-1">
                Dashboard
              </button>
            </nav>
          </div>

          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('card')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'card' 
                    ? 'bg-white text-gray-900 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="Card View"
              >
                <Grid3X3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white text-gray-900 shadow-xs' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* User Menu */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-blue-500 text-white text-sm font-medium">
                    {user?.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className={`px-6 py-3 border-b ${isPremium ? 'bg-linear-to-r from-yellow-50 to-orange-50 border-yellow-200' : 'bg-blue-50 border-blue-200'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {isPremium ? (
              <div className="flex items-center space-x-2">
                <Crown className="w-5 h-5 text-yellow-600" />
                <span className="font-medium text-yellow-800">Premium Plan</span>
                <span className="text-yellow-700">• Unlimited Family Trees & Members</span>
              </div>
            ) : (
              <div className="flex items-center space-x-4">
                <span className="font-medium text-blue-800">
                  Free Account: {familyTrees.length} Family Tree (Development Mode)
                </span>
                <span className="text-blue-700">•</span>
                <div className="flex items-center space-x-2">
                  <span className="text-blue-700">{currentMemberCount}/{maxMembersPerTree} Members</span>
                  <div className="w-24 h-2 bg-blue-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${Math.min(100, (currentMemberCount / maxMembersPerTree) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {!isPremium && (
            <button 
              onClick={handleUpgrade}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Upgrade Premium $9.99/year
            </button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">Family Trees</h2>
              <p className="text-gray-600 mt-1">
                Manage and explore your family trees
              </p>
            </div>
            
            {viewMode === 'list' && (
              <button
                onClick={handleCreateTree}
                className="flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
              >
                <Plus className="w-5 h-5" />
                <span>Create New Family Tree</span>
              </button>
            )}
          </div>

          {/* Content */}
          {viewMode === 'card' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Create New Card */}
              {renderCreateNewCard()}

              {/* Existing Family Trees */}
              {familyTrees.map((tree) => (
                <div
                  key={tree.id}
                  className="group bg-white rounded-xl shadow-xs border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden"
                >
                  {/* Thumbnail */}
                  <div className="h-24 bg-linear-to-br from-blue-500 to-green-500 relative">
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <TreePine className="w-8 h-8 text-white" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4">
                    <h3 className="font-bold text-gray-900 text-lg mb-2 truncate">
                      {tree.name}
                    </h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Users className="w-4 h-4" />
                        <span>{tree.memberCount} members • {tree.generationCount} generations</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>Updated: {formatDate(tree.lastUpdated)}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenTree(tree.id)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                      >
                        OPEN
                      </button>
                      <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* List View */
            <div className="bg-white rounded-xl shadow-xs border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">Family Tree Name</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">Members</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">Generations</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">Last Updated</th>
                      <th className="text-center py-4 px-6 font-semibold text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {familyTrees.map((tree) => (
                      <tr key={tree.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-linear-to-br from-blue-500 to-green-500 rounded-lg flex items-center justify-center">
                              <TreePine className="w-5 h-5 text-white" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">{tree.name}</h3>
                              <p className="text-sm text-gray-500">Created {formatDate(tree.createdAt)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-medium text-gray-900">{tree.memberCount}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-medium text-gray-900">{tree.generationCount}</span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-gray-600">{formatDate(tree.lastUpdated)}</span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => handleOpenTree(tree.id)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                            >
                              OPEN
                            </button>
                            <button className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                              <Settings className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {familyTrees.length === 0 && (
                <div className="text-center py-12">
                  <TreePine className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Family Tree Yet</h3>
                  <p className="text-gray-500 mb-6">Start by creating your first family tree</p>
                  <button
                    onClick={handleCreateTree}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    Create First Family Tree
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Usage Warning for Free Users */}
          {!isPremium && currentMemberCount >= maxMembersPerTree * 0.8 && (
            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Crown className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-yellow-800">
                    {currentMemberCount >= maxMembersPerTree ? 'Member limit reached!' : 'Almost full!'}
                  </h4>
                  <p className="text-yellow-700 text-sm">
                    {currentMemberCount >= maxMembersPerTree 
                      ? 'Upgrade to Premium to add unlimited members.'
                      : 'Upgrade to Premium for unlimited members and family trees.'}
                  </p>
                </div>
                <button 
                  onClick={handleUpgrade}
                  className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                >
                  Upgrade Sekarang
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create Family Tree Modal */}
      <CreateFamilyTreeModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />
    </div>
  );
};