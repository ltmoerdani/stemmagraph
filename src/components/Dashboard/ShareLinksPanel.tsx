import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Link2, RefreshCw, X, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getShareLinkAdminApi } from '../../lib/adapters';
import type { ShareLinkRecord } from '../../lib/adapters';
import { formatDate } from '../../lib/i18n';

/**
 * Owner panel for share link management (S-05, GAP #4, ADR 0010).
 *
 * Two blocks: the share link list (created date, active/revoked state,
 * masked token, last used) and the revoke action with an inline confirm
 * step. The server owns every decision (FORBIDDEN_TREE, SHARE_LINK_*
 * codes); this component renders the honest server messages verbatim.
 * Tokens arrive masked from the server and stay masked here; the panel
 * has no way to reveal them.
 */
export const ShareLinksPanel: React.FC<{ treeId: string; treeName: string; onClose: () => void }> = ({
  treeId,
  treeName,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  const shareApi = getShareLinkAdminApi();

  const [links, setLinks] = useState<ShareLinkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingRevoke, setPendingRevoke] = useState<ShareLinkRecord | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const load = useCallback(async () => {
    if (!shareApi) return;
    try {
      setLinks(await shareApi.listShareLinks(treeId));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [shareApi, treeId]);

  useEffect(() => {
    if (!shareApi) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await shareApi.listShareLinks(treeId);
        if (cancelled) return;
        setLinks(rows);
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
  }, [shareApi, treeId]);

  const handleRevoke = async () => {
    if (!shareApi || !pendingRevoke) return;
    setIsRevoking(true);
    setActionError(null);
    try {
      await shareApi.revokeShareLink(pendingRevoke.id);
      setPendingRevoke(null);
      setLinks(await shareApi.listShareLinks(treeId));
    } catch (err) {
      // SHARE_LINK_ALREADY_REVOKED and friends arrive as honest server text.
      setActionError(err instanceof Error ? err.message : t('sharePanel.revokeFailed'));
    } finally {
      setIsRevoking(false);
    }
  };

  const stateBadge = (state: ShareLinkRecord['state']) => {
    const palette: Record<ShareLinkRecord['state'], string> = {
      active: 'bg-green-100 text-green-800',
      revoked: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${palette[state]}`}>
        {t(`sharePanel.state.${state}`)}
      </span>
    );
  };

  if (!shareApi) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
          <p className="text-sm text-gray-700">{t('sharePanel.unavailable')}</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-4 w-full rounded-lg bg-gray-100 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200"
          >
            {t('sharePanel.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" data-testid="share-links-panel">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div className="flex items-center space-x-2">
            <Link2 className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">{t('sharePanel.title', { treeName })}</h2>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                void load();
              }}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
              title={t('sharePanel.refresh')}
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-4">
          {actionError && (
            <div className="flex items-start space-x-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <p className="text-sm text-red-800">{actionError}</p>
            </div>
          )}

          {/* Link list */}
          <section>
            <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('sharePanel.listTitle')}</h3>
            <p className="mb-2 text-xs text-gray-500">{t('sharePanel.listHint')}</p>
            {isLoading ? (
              <p className="py-4 text-center text-sm text-gray-500">{t('sharePanel.loading')}</p>
            ) : loadFailed ? (
              <p className="py-4 text-center text-sm text-red-600">{t('sharePanel.loadFailed')}</p>
            ) : links.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">{t('sharePanel.empty')}</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
                {links.map((link) => (
                  <li key={link.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        <span className="font-mono text-xs text-gray-500">{link.tokenMasked}</span>
                        {' · '}
                        {t(`sharePanel.mode.${link.mode}`)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('sharePanel.created', { date: formatDate(link.createdAt, i18n.language) })}
                        {link.lastUsedAt && (
                          <>
                            {' · '}
                            {t('sharePanel.lastUsed', { date: formatDate(link.lastUsedAt, i18n.language) })}
                          </>
                        )}
                        {link.revokedAt && (
                          <>
                            {' · '}
                            {t('sharePanel.revokedAt', { date: formatDate(link.revokedAt, i18n.language) })}
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center space-x-2">
                      {stateBadge(link.state)}
                      {link.state === 'active' && (
                        <button
                          type="button"
                          onClick={() => setPendingRevoke(link)}
                          className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                        >
                          {t('sharePanel.revoke')}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Inline revoke confirmation: nothing leaves the panel until confirmed. */}
          {pendingRevoke && (
            <section className="rounded-lg border border-red-200 bg-red-50 p-4" data-testid="share-revoke-confirm">
              <div className="flex items-start space-x-2">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-red-900">{t('sharePanel.confirmTitle')}</p>
                  <p className="mt-1 text-xs text-red-800">
                    {t('sharePanel.confirmBody', { token: pendingRevoke.tokenMasked })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex space-x-2">
                <button
                  type="button"
                  onClick={handleRevoke}
                  disabled={isRevoking}
                  data-testid="share-revoke-confirm-button"
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isRevoking ? t('sharePanel.revoking') : t('sharePanel.confirmAction')}
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRevoke(null)}
                  disabled={isRevoking}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  {t('sharePanel.cancel')}
                </button>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
