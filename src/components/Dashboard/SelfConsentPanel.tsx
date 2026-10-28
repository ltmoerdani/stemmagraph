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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X, UserCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getConsentSelfApi, getErasureApi } from '../../lib/adapters';
import type { SelfConsentEntry, ConsentRecordView, ErasureStatusView } from '../../lib/adapters';
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
  // v411 AC3: riwayat penuh per member (timeline), diambil saat member
  // dipilih kelola; kosong = null berarti belum diambil.
  const [eventsByMember, setEventsByMember] = useState<Record<string, ConsentRecordView[] | null>>({});
  // v420 AC2: pengajuan penghapusan data per member self. View null =
  // sedang dimuat, undefined = belum pernah diminta. Trigger button per
  // member disimpan untuk return focus setelah dialog konfirmasi ditutup.
  const [erasureApi] = useState(() => getErasureApi());
  const [erasureByMember, setErasureByMember] = useState<Record<string, ErasureStatusView | null>>({});
  const [erasureConfirmId, setErasureConfirmId] = useState<string | null>(null);
  const [erasureBusy, setErasureBusy] = useState<string | null>(null);
  const [erasureErrors, setErasureErrors] = useState<Record<string, string | null>>({});
  const erasureTriggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const closeErasureConfirm = useCallback((memberId: string | null): void => {
    setErasureConfirmId(null);
    if (memberId !== null) {
      erasureTriggerRefs.current[memberId]?.focus();
    }
  }, []);

  // Esc menutup dialog konfirmasi erasure (pola GedcomImporterModal).
  useEffect(() => {
    if (erasureConfirmId === null) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeErasureConfirm(erasureConfirmId);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [erasureConfirmId, closeErasureConfirm]);

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

  // v420 AC2: muat status penghapusan saat kelola dibuka (null = loading).
  const loadErasure = useCallback(async (memberId: string): Promise<void> => {
    if (!erasureApi) return;
    setErasureByMember((prev) => ({ ...prev, [memberId]: null }));
    try {
      const view = await erasureApi.getErasure(memberId);
      setErasureByMember((prev) => ({ ...prev, [memberId]: view }));
    } catch {
      setErasureErrors((prev) => ({ ...prev, [memberId]: t('erasureSelf.loadFailed') }));
      setErasureByMember((prev) => ({ ...prev, [memberId]: { status: 'none', requestedAt: null, completedAt: null } }));
    }
  }, [erasureApi, t]);

  const submitErasure = async (memberId: string): Promise<void> => {
    if (!erasureApi || erasureBusy) return;
    setErasureBusy(memberId);
    setErasureErrors((prev) => ({ ...prev, [memberId]: null }));
    try {
      const result = await erasureApi.requestErasure(memberId);
      setErasureByMember((prev) => ({ ...prev, [memberId]: result.view }));
      closeErasureConfirm(memberId);
    } catch (e) {
      setErasureErrors((prev) => ({
        ...prev,
        [memberId]: e instanceof Error && e.message ? e.message : t('erasureSelf.requestFailed'),
      }));
    } finally {
      setErasureBusy(null);
    }
  };

  const cancelErasureRequest = async (memberId: string): Promise<void> => {
    if (!erasureApi || erasureBusy) return;
    setErasureBusy(memberId);
    setErasureErrors((prev) => ({ ...prev, [memberId]: null }));
    try {
      const result = await erasureApi.cancelErasure(memberId);
      setErasureByMember((prev) => ({ ...prev, [memberId]: result.view }));
    } catch (e) {
      setErasureErrors((prev) => ({
        ...prev,
        [memberId]: e instanceof Error && e.message ? e.message : t('erasureSelf.cancelFailed'),
      }));
    } finally {
      setErasureBusy(null);
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
                // v420 AC2: muat status penghapusan data saat kelola dibuka.
                if (erasureByMember[entry.memberId] === undefined) {
                  void loadErasure(entry.memberId);
                }
                // v411 AC3: ambil riwayat penuh saat kelola dibuka (sekali,
                // hasil di-cache sampai panel ditutup).
                if (eventsByMember[entry.memberId] === undefined && selfApi) {
                  setEventsByMember((prev) => ({ ...prev, [entry.memberId]: null }));
                  void selfApi
                    .getSelfConsentEvents(entry.memberId)
                    .then((res) => {
                      setEventsByMember((prev) => ({ ...prev, [entry.memberId]: res.records }));
                    })
                    .catch(() => {
                      setEventsByMember((prev) => ({ ...prev, [entry.memberId]: [] }));
                    });
                }
              }}
              ref={(el) => {
                erasureTriggerRefs.current[entry.memberId] = el;
              }}
              className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-teal-300 text-teal-700 hover:bg-teal-50 transition-colors"
            >
              {t('consentSelf.manage')}
            </button>
          </div>
        )}
        {isSelected && erasureApi && erasureByMember[entry.memberId] !== undefined && (
          <div
            data-testid={`self-erasure-${entry.memberId}`}
            className="border-t border-gray-100 pt-2 space-y-2"
          >
            <p className="text-xs font-medium text-gray-700">{t('erasureSelf.sectionTitle')}</p>
            {erasureByMember[entry.memberId] === null ? (
              <p className="text-xs text-gray-400" data-testid={`self-erasure-loading-${entry.memberId}`}>
                {t('erasureSelf.loading')}
              </p>
            ) : (
              <>
                {(erasureByMember[entry.memberId] as ErasureStatusView).status === 'pending' ? (
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800" data-testid={`self-erasure-pending-${entry.memberId}`}>
                      {t('erasureSelf.pendingSince', {
                        date: formatDate(
                          (erasureByMember[entry.memberId] as ErasureStatusView).requestedAt ?? '',
                          i18n.language,
                        ),
                      })}
                    </p>
                    <button
                      type="button"
                      data-testid={`self-erasure-cancel-${entry.memberId}`}
                      disabled={erasureBusy !== null}
                      onClick={() => void cancelErasureRequest(entry.memberId)}
                      className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50"
                    >
                      {t('erasureSelf.cancelAction')}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    data-testid={`self-erasure-request-${entry.memberId}`}
                    disabled={erasureBusy !== null}
                    onClick={() => setErasureConfirmId(entry.memberId)}
                    className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {t('erasureSelf.requestAction')}
                  </button>
                )}
              </>
            )}
            {erasureErrors[entry.memberId] && (
              <p className="text-xs text-red-700" role="alert" data-testid={`self-erasure-error-${entry.memberId}`}>
                {erasureErrors[entry.memberId]}
              </p>
            )}
          </div>
        )}
        {isSelected && eventsByMember[entry.memberId] !== undefined && (
          <div data-testid={`self-consent-history-${entry.memberId}`} className="border-t border-gray-100 pt-2 space-y-1">
            <p className="text-xs font-medium text-gray-700">{t('consentSelf.historyTitle')}</p>
            {eventsByMember[entry.memberId] === null ? (
              <p className="text-xs text-gray-400">{t('consentSelf.historyLoading')}</p>
            ) : (eventsByMember[entry.memberId] as ConsentRecordView[]).length === 0 ? (
              <p className="text-xs text-gray-400">{t('consentSelf.noHistory')}</p>
            ) : (
              <ul className="space-y-1">
                {(eventsByMember[entry.memberId] as ConsentRecordView[]).map((ev) => (
                  <li key={ev.id} className="text-xs text-gray-600" data-testid={`self-consent-history-row-${ev.id}`}>
                    {`${formatDate(ev.at, i18n.language)} : ${ev.action} : ${ev.scope}${ev.note ? ` : ${ev.note}` : ''}`}
                  </li>
                ))}
              </ul>
            )}
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
      {erasureApi !== null && erasureConfirmId !== null && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
          data-testid={`self-erasure-confirm-backdrop-${erasureConfirmId}`}
          onClick={() => closeErasureConfirm(erasureConfirmId)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`self-erasure-confirm-title-${erasureConfirmId}`}
            data-testid={`self-erasure-confirm-${erasureConfirmId}`}
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id={`self-erasure-confirm-title-${erasureConfirmId}`}
              className="text-base font-bold text-gray-900"
            >
              {t('erasureSelf.confirmTitle')}
            </h3>
            <p className="text-sm text-gray-700">{t('erasureSelf.confirmBody')}</p>
            <p className="text-xs text-gray-500">{t('erasureSelf.confirmNote')}</p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                data-testid={`self-erasure-confirm-cancel-${erasureConfirmId}`}
                onClick={() => closeErasureConfirm(erasureConfirmId)}
                className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
              >
                {t('erasureSelf.confirmStay')}
              </button>
              <button
                type="button"
                data-testid={`self-erasure-confirm-accept-${erasureConfirmId}`}
                autoFocus
                disabled={erasureBusy !== null}
                onClick={() => void submitErasure(erasureConfirmId)}
                className="min-w-[24px] min-h-[24px] px-3 py-1.5 text-xs rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {t('erasureSelf.confirmAccept')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
