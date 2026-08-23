import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getAccountAdminApi } from '../../lib/adapters';
import type { AdminAccount, AccountStatusAction } from '../../lib/adapters';
import { actionsForStatus } from '../../lib/account-states/adminView';
import { formatDate } from '../../lib/i18n';

/**
 * Account administration panel (P2-1, AC-5b).
 *
 * Owner-only modal listing every account with its status and the actions
 * the shared state machine allows. The visibility gate (AC-5d) lives in
 * UserMenu via isAdminUser; the server re-checks requireOwner on every
 * call, so this component never trusts its caller for security.
 *
 * Action failures (including LAST_OWNER_GUARD) render the server message
 * verbatim: the guard text is already the honest explanation.
 */
export const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const accountAdmin = getAccountAdminApi();

  const load = useCallback(async () => {
    if (!accountAdmin) return;
    try {
      setAccounts(await accountAdmin.listAccounts());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [accountAdmin]);

  // The panel starts with isLoading true (mount fetch). Re-arm the spinner
  // in event handlers only, never synchronously inside an effect.
  const loadWithSpinner = () => {
    setIsLoading(true);
    void load();
  };

  useEffect(() => {
    // Initial fetch. Inline async with a cancelled flag: the shared load()
    // helper stays for event handlers, and this copy cannot setState after
    // the modal unmounts mid-request.
    if (!accountAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const accounts = await accountAdmin.listAccounts();
        if (cancelled) return;
        setAccounts(accounts);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accountAdmin]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  if (!accountAdmin) return null;

  const runAction = async (account: AdminAccount, action: AccountStatusAction) => {
    setBusyAccountId(account.id);
    setActionError(null);
    try {
      const updated = await accountAdmin.setAccountStatus(account.id, action);
      setAccounts((prev) =>
        prev.map((a) => (a.id === updated.id ? updated : a)),
      );
    } catch (error) {
      // Verbatim server message: LAST_OWNER_GUARD, INVALID_TRANSITION, and
      // friends already explain themselves in one honest sentence.
      setActionError(error instanceof Error ? error.message : String(error));
      void load();
    } finally {
      setBusyAccountId(null);
    }
  };

  const actionButtonClass = (action: AccountStatusAction) =>
    action === 'disable'
      ? 'text-red-700 border-red-300 hover:bg-red-50'
      : 'text-green-700 border-green-300 hover:bg-green-50';

  const statusBadgeClass = (status: AdminAccount['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-800';
      case 'active':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-200 text-gray-600';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-black/40 cursor-default"
        aria-label={t('admin.close')}
        onClick={onClose}
        style={{ outline: 'none' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('admin.title')}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-start justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('admin.title')}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{t('admin.subtitle')}</p>
          </div>
          <div className="flex items-center space-x-1">
            <button
              onClick={loadWithSpinner}
              disabled={isLoading}
              className="p-2 rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
              aria-label={t('admin.refresh')}
              title={t('admin.refresh')}
            >
              <RefreshCw
                className={`w-4 h-4 text-gray-500 ${isLoading ? 'animate-spin' : ''}`}
              />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-gray-100 transition-colors"
              aria-label={t('admin.close')}
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-5 overflow-y-auto">
          <p className="text-xs text-gray-400 mb-3">
            {t('admin.accounts', { count: accounts.length })}
          </p>

          {loadFailed && (
            <p className="mb-3 text-sm text-red-600">{t('admin.loadError')}</p>
          )}
          {actionError && (
            <p className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {actionError}
            </p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                  <th className="py-2 pr-3 font-semibold">{t('admin.table.name')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('admin.table.role')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('admin.table.status')}</th>
                  <th className="py-2 pr-3 font-semibold">{t('admin.table.createdAt')}</th>
                  <th className="py-2 font-semibold">{t('admin.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account.id} className="border-b border-gray-50 last:border-b-0">
                    <td className="py-2.5 pr-3">
                      <span className="block font-medium text-gray-900">
                        {account.name}
                      </span>
                      <span className="block text-xs text-gray-500">{account.email}</span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          account.role === 'owner'
                            ? 'bg-indigo-100 text-indigo-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {t(`admin.role.${account.role}`)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(account.status)}`}
                      >
                        {t(`admin.status.${account.status}`)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(account.createdAt, i18n.language)}
                    </td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-1.5">
                        {actionsForStatus(account.status).map((action) => (
                          <button
                            key={action}
                            onClick={() => void runAction(account, action)}
                            disabled={busyAccountId !== null}
                            className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors disabled:opacity-50 ${actionButtonClass(action)}`}
                          >
                            {t(`admin.action.${action}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
