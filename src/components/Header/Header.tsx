import React from 'react';
import { Search, Menu, TreePine } from 'lucide-react';
import { useFamilyStore } from '../../store/familyStore';
import { UserMenu } from './UserMenu';
import { NotificationMenu } from './NotificationMenu';
import { useTranslation } from 'react-i18next';
import { changeAppLanguage, SUPPORTED_LANGUAGES, type AppLanguage } from '../../lib/i18n';

interface HeaderProps {
  onMenuToggle: () => void;
  familyName: string;
}

const LanguageSwitcher: React.FC = () => {
  const { t, i18n } = useTranslation();

  const handleSwitch = (language: AppLanguage) => {
    if (language !== i18n.language) {
      void changeAppLanguage(language);
    }
  };

  return (
    <div
      className="flex rounded-lg border border-gray-300 overflow-hidden"
      role="group"
      aria-label={t('header.language')}
    >
      {SUPPORTED_LANGUAGES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => handleSwitch(code)}
          aria-pressed={i18n.language === code}
          className={`px-2 py-1.5 text-xs font-semibold uppercase transition-colors ${
            i18n.language === code
              ? 'bg-blue-600 text-white'
              : 'bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          {code}
        </button>
      ))}
    </div>
  );
};

export const Header: React.FC<HeaderProps> = ({ onMenuToggle, familyName }) => {
  const { searchQuery, setSearchQuery } = useFamilyStore();
  const { t } = useTranslation();

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-2 rounded-md hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        
        <div className="flex items-center space-x-2">
          <TreePine className="w-8 h-8 text-green-600" />
          <h1 className="text-2xl font-bold text-gray-900">
            {t('app.brand')}
          </h1>
        </div>
        
        <nav className="hidden md:flex items-center space-x-2 text-sm text-gray-500">
          <span>{t('header.nav.dashboard')}</span>
          <span>/</span>
          <span>{t('header.nav.familyTree')}</span>
          <span>/</span>
          <span className="text-gray-900 font-medium">{familyName}</span>
        </nav>
      </div>

      <div className="flex items-center space-x-4">
        <LanguageSwitcher />

        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('header.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-4 py-2 w-64 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <NotificationMenu />

        <UserMenu />
      </div>
    </header>
  );
};