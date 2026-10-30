import React, { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Copy, Link2, Plus, RefreshCw, X, AlertCircle } from 'lucide-react';
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

  // Create form state: mode toggles the password field, and the created
  // link's full token lives here only until the dialog is dismissed; the
  // server never hands it out a second time (ADR 0004 discipline).
  const [createMode, setCreateMode] = useState<'public' | 'password'>('public');
  const [createPassword, setCreatePassword] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdToken, setCreatedToken] = useState<{ token: string; masked: string } | null>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCreate = async () => {
    if (!shareApi || isCreating) return;
    // Local guard mirrors the server floor so the button does not fire a
    // request that can only come back 400.
    if (createMode === 'password' && createPassword.length < 8) return;
    setIsCreating(true);
    setActionError(null);
    try {
      const created = await shareApi.createShareLink(treeId, {
        mode: createMode,
        ...(createMode === 'password' ? { password: createPassword } : {}),
      });
      // Full token captured once; the list only ever holds masked rows.
      setCreatedToken({ token: created.token, masked: created.tokenMasked });
      setCreatePassword('');
      setCreateMode('public');
      setCopied(false);
      setLinks(await shareApi.listShareLinks(treeId));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('sharePanel.createFailed'));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopy = async () => {
    if (!createdToken) return;
    try {
      await navigator.clipboard.writeText(createdToken.token);
      setCopied(true);
    } catch {
      // Clipboard can be denied; the input keeps the token selectable.
      setCopied(false);
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

          {/* Create form: sits above the list so a new link is one glance away. */}
          <section data-testid="share-create-form">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">{t('sharePanel.createTitle')}</h3>
            <div className="space-y-3 rounded-lg border border-gray-200 p-4">
              <div>
                <p className="mb-1.5 text-xs font-medium text-gray-700">{t('sharePanel.createModeLabel')}</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="share-create-mode"
                      checked={createMode === 'public'}
                      onChange={() => setCreateMode('public')}
                      data-testid="share-create-mode-public"
                    />
                    {t('sharePanel.createModePublic')}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-800">
                    <input
                      type="radio"
                      name="share-create-mode"
                      checked={createMode === 'password'}
                      onChange={() => setCreateMode('password')}
                      data-testid="share-create-mode-password"
                    />
                    {t('sharePanel.createModePassword')}
                  </label>
                </div>
              </div>
              {createMode === 'password' && (
                <div>
                  <label htmlFor="share-create-password" className="mb-1 block text-xs font-medium text-gray-700">
                    {t('sharePanel.createPasswordLabel')}
                  </label>
                  <input
                    id="share-create-password"
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    placeholder={t('sharePanel.createPasswordPlaceholder')}
                    minLength={8}
                    data-testid="share-create-password"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-gray-500">{t('sharePanel.createPasswordHint')}</p>
                </div>
              )}
              <button
                type="button"
                onClick={handleCreate}
                disabled={isCreating || (createMode === 'password' && createPassword.length < 8)}
                data-testid="share-create-button"
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {isCreating ? t('sharePanel.creating') : t('sharePanel.createAction')}
              </button>
            </div>
          </section>

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

          {/* One-time full token dialog: closes for good, the server keeps
              the token and never repeats it; only the masked row remains. */}
          {createdToken && (
            <section className="rounded-lg border border-green-200 bg-green-50 p-4" data-testid="share-created-dialog">
              <div className="flex items-start space-x-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-green-900">{t('sharePanel.createdTitle')}</p>
                  <p className="mt-1 text-xs text-green-800">{t('sharePanel.createdTokenLabel')}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      readOnly
                      value={createdToken.token}
                      data-testid="share-created-token"
                      className="w-full rounded border border-green-300 bg-white px-2 py-1.5 font-mono text-xs text-gray-900"
                    />
                    <button
                      type="button"
                      onClick={handleCopy}
                      data-testid="share-created-copy"
                      className="flex shrink-0 items-center gap-1 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-800 hover:bg-green-100"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied ? t('sharePanel.copied') : t('sharePanel.copyToken')}
                    </button>
                  </div>
                  <p className="mt-1.5 font-mono text-xs text-gray-500">{createdToken.masked}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreatedToken(null)}
                data-testid="share-created-done"
                className="mt-3 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                {t('sharePanel.done')}
              </button>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
