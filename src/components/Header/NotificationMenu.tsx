import React, { useCallback, useEffect, useState } from 'react';
import { Bell, CheckCheck, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAccountAdminApi } from '../../lib/adapters';
import type { AppNotification } from '../../lib/adapters';
import { useAuthStore } from '../../store/authStore';
import { describeNotification } from '../../lib/account-states/adminView';
import { formatDate } from '../../lib/i18n';

/**
 * In-app notification menu (P2-1, AC-5a).
 *
 * Renders only when the active adapter has a server-backed account
 * surface (REST) and the user is signed in. The unread badge, the
 * dropdown list, per-item mark-as-read, and mark-all-read all run
 * through AccountAdminApi; mock and supabase adapters hide the menu
 * because getAccountAdminApi() returns null for them.
 */
export const NotificationMenu: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  const accountAdmin = getAccountAdminApi();

  const load = useCallback(async () => {
    if (!accountAdmin) return;
    setIsLoading(true);
    try {
      const page = await accountAdmin.listNotifications();
      setNotifications(page.notifications);
      setUnreadCount(page.unreadCount);
      setLoadFailed(false);
    } catch {
      // A silent badge refresh stays silent; an open panel shows the error.
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [accountAdmin]);

  useEffect(() => {
    // Fetch once on mount so the badge is honest before the first open.
    void load();
  }, [load]);

  if (!accountAdmin || !isAuthenticated) return null;

  const toggleOpen = () => {
    const next = !isOpen;
    setIsOpen(next);
    // Re-read on every open: read state can change in another tab or via
    // the admin panel acting on this user's registrations.
    if (next) void load();
  };

  const markRead = async (notification: AppNotification) => {
    if (notification.readAt || !accountAdmin) return;
    try {
      const updated = await accountAdmin.markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === updated.id ? updated : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Leave the item unread; the next open re-syncs from the server.
    }
  };

  const markAllRead = async () => {
    if (!accountAdmin || unreadCount === 0) return;
    try {
      await accountAdmin.markAllNotificationsRead();
      const now = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((n) => (n.readAt ? n : { ...n, readAt: now })),
      );
      setUnreadCount(0);
    } catch {
      void load();
    }
  };

  const badgeLabel = unreadCount > 9 ? '9+' : String(unreadCount);

  return (
    <div className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
        aria-label={t('notifications.ariaLabel', { count: unreadCount })}
        aria-expanded={isOpen}
      >
        <Bell className="w-5 h-5 text-gray-600" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-10 bg-transparent border-none cursor-default"
            aria-label={t('notifications.close')}
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsOpen(false);
            }}
            style={{ outline: 'none' }}
          />
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">
                {t('notifications.title')}
              </p>
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => void load()}
                  disabled={isLoading}
                  className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  aria-label={t('notifications.refresh')}
                  title={t('notifications.refresh')}
                >
                  <RefreshCw
                    className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  onClick={() => void markAllRead()}
                  disabled={unreadCount === 0}
                  className="p-1.5 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
                  aria-label={t('notifications.markAllRead')}
                  title={t('notifications.markAllRead')}
                >
                  <CheckCheck className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {loadFailed && (
                <p className="px-3 py-4 text-sm text-red-600">
                  {t('notifications.loadError')}
                </p>
              )}
              {!loadFailed && notifications.length === 0 && (
                <p className="px-3 py-4 text-sm text-gray-500">
                  {t('notifications.empty')}
                </p>
              )}
              {notifications.map((n) => {
                const description = describeNotification(n.type, n.payload);
                const isUnread = !n.readAt;
                return (
                  <button
                    key={n.id}
                    onClick={() => void markRead(n)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-b-0 transition-colors ${
                      isUnread ? 'bg-blue-50/60 hover:bg-blue-100/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="flex items-start space-x-2">
                      {isUnread && (
                        <span
                          className="mt-1.5 w-2 h-2 rounded-full bg-blue-600 shrink-0"
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0">
                        <span
                          className={`block text-sm leading-snug ${
                            isUnread ? 'font-medium text-gray-900' : 'text-gray-600'
                          }`}
                        >
                          {t(description.key, description.values)}
                        </span>
                        <span className="block text-xs text-gray-400 mt-0.5">
                          {formatDate(n.createdAt, i18n.language)}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
