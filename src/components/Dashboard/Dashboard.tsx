import React, { useState } from 'react';
import { Plus, Users, Calendar, Settings, List, Grid3X3, TreePine } from 'lucide-react';
import { CreateFamilyTreeModal } from './CreateFamilyTreeModal';
import { useAuthStore } from '../../store/authStore';
import { useDashboardStore } from '../../store/dashboardStore';
import { navigate } from '../../utils/routing';
import { useTranslation } from 'react-i18next';
import { formatDate as formatDateWithLocale } from '../../lib/i18n';

export const Dashboard: React.FC = () => {
  const { user } = useAuthStore();
  const { familyTrees, viewMode, setViewMode } = useDashboardStore();
  const { t, i18n } = useTranslation();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const currentMemberCount = familyTrees.reduce((total, tree) => total + tree.memberCount, 0);

  const handleCreateTree = () => {
    setShowCreateModal(true);
  };

  const handleOpenTree = (treeId: string) => {
    // Navigate to family tree interface
    navigate(`/family-tree/${treeId}`);
  };

  const formatDate = (dateString: string) => {
    return formatDateWithLocale(dateString, i18n.language);
  };

  // Helper: Render the create new card button
  const renderCreateNewCard = () => (
    <button
      type="button"
      onClick={handleCreateTree}
      className="group relative bg-white rounded-xl border-2 border-dashed transition-all duration-200 h-48 flex flex-col items-center justify-center cursor-pointer border-gray-300 hover:border-green-500 hover:bg-green-50"
      aria-label={t('dashboard.createNew')}
    >
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-200 transition-colors">
        <Plus className="w-6 h-6 text-green-600" />
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{t('dashboard.createNew')}</h3>
      <p className="text-sm text-gray-500 text-center px-4">
        {t('dashboard.createNewDesc')}
      </p>
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50" data-testid="dashboard">
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
                title={t('dashboard.cardView')}
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
                title={t('dashboard.listView')}
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
      <div className="px-6 py-3 border-b bg-blue-50 border-blue-200">
        <div className="flex items-center space-x-4">
          <span className="font-medium text-blue-800">
            {t('dashboard.treeCount', { count: familyTrees.length })}
          </span>
          <span className="text-blue-700">•</span>
          <span className="text-blue-700">{t('dashboard.memberCount', { count: currentMemberCount })}</span>
        </div>
      </div>

      {/* Main Content */}
      <main className="p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900">{t('dashboard.familyTreesTitle')}</h2>
              <p className="text-gray-600 mt-1">
                {t('dashboard.familyTreesSubtitle')}
              </p>
            </div>
            
            {viewMode === 'list' && (
              <button
                onClick={handleCreateTree}
                className="flex items-center space-x-2 px-6 py-3 rounded-lg font-medium transition-colors bg-green-600 text-white hover:bg-green-700"
              >
                <Plus className="w-5 h-5" />
                <span>{t('dashboard.createNew')}</span>
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
                        <span>
                          {t('dashboard.members', { count: tree.memberCount })} • {t('dashboard.generations', { count: tree.generationCount })}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Calendar className="w-4 h-4" />
                        <span>{t('dashboard.updated', { date: formatDate(tree.lastUpdated) })}</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleOpenTree(tree.id)}
                        className="flex-1 bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
                      >
                        {t('dashboard.open')}
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
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">{t('dashboard.table.name')}</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">{t('dashboard.table.members')}</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">{t('dashboard.table.generations')}</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">{t('dashboard.table.lastUpdated')}</th>
                      <th className="text-center py-4 px-6 font-semibold text-gray-900">{t('dashboard.table.actions')}</th>
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
                              <p className="text-sm text-gray-500">{t('dashboard.created', { date: formatDate(tree.createdAt) })}</p>
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
                              {t('dashboard.open')}
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
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{t('dashboard.emptyTitle')}</h3>
                  <p className="text-gray-500 mb-6">{t('dashboard.emptyDesc')}</p>
                  <button
                    onClick={handleCreateTree}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    {t('dashboard.createFirst')}
                  </button>
                </div>
              )}
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