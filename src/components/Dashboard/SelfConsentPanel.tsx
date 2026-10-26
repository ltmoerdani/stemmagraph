/**
 * SelfConsentPanel (v409 AC4): panel consent self-service untuk subjek
 * data di Dashboard. Panel memanggil getConsentSelfApi().listSelfConsent()
 * saat mount; fetch gagal atau daftar kosong = panel tidak tampil (pola
 * MergeApprovalsPanel). Subjek data melihat daftar anggota yang emailnya
 * cocok akunnya, status granted per anggota, lalu mencatat
 * grant/revoke/regrant dengan scope wajib plus note opsional melalui
 * postSelfConsent (endpoint v408). Revoke dan regrant minta konfirmasi
 * eksplisit dua langkah (pola approval v392; APG: jalur aman Batal
 * tersedia, WCAG 2.2 SC 2.5.8 target tombol minimal 24x24 px, SC 2.4.7
 * indikator fokus focus-visible tidak dihapus).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getConsentSelfApi } from '../../lib/adapters';
import type { SelfConsentEntry } from '../../lib/adapters';
import { formatDate } from '../../lib/i18n';

type ConsentSelfAction = 'grant' | 'revoke' | 'regrant';

export const SelfConsentPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, i18n } = useTranslation();
  // Adapter diambil sekali (useState initializer) supaya identitas stabil
  // antar render (pola MergeApprovalsPanel).
  const [selfApi] = useState(() => getConsentSelfApi());
  const [members, setMembers] = useState<SelfConsentEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'revoke' | 'regrant' | null>(null);
  const [scope, setScope] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async (): Promise<void> => {
    if (!selfApi) return;
    try {
      const overview = await selfApi.listSelfConsent();
      setMembers(overview.members);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [selfApi]);

  // Initial fetch pola MergeApprovalsPanel: async IIFE agar state update
  // selalu mendarat setelah await, tidak pernah sinkron dalam effect.
  useEffect(() => {
    if (!selfApi) return;
    let cancelled = false;
    (async () => {
      try {
        const overview = await selfApi.listSelfConsent();
        if (!cancelled) {
          setMembers(overview.members);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selfApi]);

  const submit = async (entry: SelfConsentEntry, action: ConsentSelfAction): Promise<void> => {
    if (!selfApi || busyId) return;
    if (scope.trim().length === 0) {
      setActionError(t('consentSelf.scopeRequired'));
      return;
    }
    setBusyId(entry.memberId);
    setActionError(null);
    try {
      await selfApi.postSelfConsent(
        entry.memberId,
        action,
        scope.trim(),
        note.trim() === '' ? undefined : note.trim(),
      );
      setConfirming(null);
      setScope('');
      setNote('');
      await load();
    } catch (e) {
      setActionError(e instanceof Error && e.message ? e.message : null);
    } finally {
      setBusyId(null);
    }
  };

  // Guard render: adapter non-rest (null), fetch gagal, atau daftar kosong
  // = panel tidak tampil sama sekali (AC4, pola MergeApprovalsPanel).
  if (!selfApi || loadFailed || members === null || members.length === 0) return null;

  const renderEntry = (entry: SelfConsentEntry) => {
    const isSelected = selectedId === entry.memberId;
    const confirmOpen = isSelected && confirming !== null;
    return (
      <article
        key={entry.memberId}
        className="border border-gray-200 rounded-lg p-4 space-y-3"
        data-testid={`self-consent-entry-${entry.memberId}`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <UserCheck className="w-4 h-4 text-teal-600" aria-hidden="true" />
            <span data-testid="self-consent-tree-name">{entry.treeName}</span>
          </div>
          <span
            className={entry.granted ? 'text-xs font-medium text-teal-700' : 'text-xs font-medium text-gray-500'}
            data-testid="self-consent-status"
          >
            {entry.granted ? t('consentSelf.statusGranted') : t('consentSelf.statusRevoked')}
          </span>
        </div>
        <div className="text-xs text-gray-500" data-testid="self-consent-last">
          {entry.lastAction !== null
            ? `${t('consentSelf.lastAction')}: ${entry.lastAction}${entry.lastAt !== null ? ` (${formatDate(entry.lastAt, i18n.language)})` : ''}`
            : t('consentSelf.noHistory')}
        </div>
        {isSelected && (
          <div className="space-y-2">
            <label htmlFor="self-consent-scope" className="block text-sm font-medium text-gray-700 mb-1">
              {t('consentSelf.scopeLabel')} *
            </label>
            <input
              id="self-consent-scope"
              data-testid="self-consent-scope"
              type="text"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              placeholder={t('consentSelf.scopePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
            <label htmlFor="self-consent-note" className="block text-sm font-medium text-gray-700 mb-1">
              {t('consentSelf.noteLabel')}
            </label>
            <input
              id="self-consent-note"
              data-testid="self-consent-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('consentSelf.notePlaceholder')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
            />
          </div>
        )}
        {confirmOpen ? (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-md" data-testid={`self-consent-confirm-box-${entry.memberId}`}>
            <p className="text-xs text-amber-900 mb-2">
              {confirming === 'revoke'
                ? t('consentSelf.confirmRevoke', { name: entry.treeName })
                : t('consentSelf.confirmRegrant', { name: entry.treeName })}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                data-testid={`self-consent-cancel-${entry.memberId}`}
                onClick={() => setConfirming(null)}
                className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {t('consentSelf.cancel')}
              </button>
              <button
                type="button"
                data-testid={`self-consent-confirm-${confirming}-${entry.memberId}`}
                disabled={busyId !== null}
                onClick={() => void submit(entry, confirming as ConsentSelfAction)}
                className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {confirming === 'revoke' ? t('consentSelf.revokeAction') : t('consentSelf.regrantAction')}
              </button>
            </div>
          </div>
        ) : isSelected ? (
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              data-testid={`self-consent-grant-${entry.memberId}`}
              disabled={busyId !== null || entry.granted}
              onClick={() => void submit(entry, 'grant')}
              className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              {t('consentSelf.grantAction')}
            </button>
            <button
              type="button"
              data-testid={`self-consent-revoke-${entry.memberId}`}
              disabled={busyId !== null || !entry.granted}
              onClick={() => setConfirming('revoke')}
              className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {t('consentSelf.revokeAction')}
            </button>
            <button
              type="button"
              data-testid={`self-consent-regrant-${entry.memberId}`}
              disabled={busyId !== null || entry.granted}
              onClick={() => setConfirming('regrant')}
              className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-50"
            >
              {t('consentSelf.regrantAction')}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid={`self-consent-manage-${entry.memberId}`}
              aria-expanded={false}
              onClick={() => {
                setSelectedId(entry.memberId);
                setConfirming(null);
                setActionError(null);
              }}
              className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors"
            >
              {t('consentSelf.manage')}
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900" data-testid="self-consent-title">
              {t('consentSelf.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            data-testid="self-consent-close"
            aria-label={t('consentSelf.close')}
            className="min-w-[24px] min-h-[24px] text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg" role="alert" data-testid="self-consent-error">
              <p className="text-red-800 text-sm">{actionError}</p>
            </div>
          )}
          {members.map(renderEntry)}
        </div>
      </div>
    </div>
  );
};
