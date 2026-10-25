/**
 * MergeMemberDialog (v390 fase 1): dialog konfirmasi merge anggota
 * duplikat ke primary, dibuka dari panel peringatan duplikat
 * UnifiedMemberModal. Ringkasan side-by-side (nama, tanggal lahir,
 * marga, jumlah relasi kedua sisi), wajib ketik nama primary untuk
 * mengaktifkan tombol eksekusi. Sukses menampilkan pesan dan
 * menyegarkan data tree via fetchMembers. Tanpa merge satu-klik.
 *
 * Mode entry (satu-satunya pemanggil v390): sisi duplikat adalah entri
 * baru yang sedang dibuat (belum ada di store), sisi primary adalah
 * kandidat existing. Eksekusi: anggota baru dibuat dulu lalu di-merge
 * ke primary lewat API (jejak audit utuh: baris baru ditandai
 * mergedIntoId, tidak ada penghapusan). Adapter tanpa server
 * (getMergeApi null): dialog tidak dirender.
 */
import React, { useMemo, useState } from 'react';
import { X, AlertCircle, CheckCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../store/familyStore';
import { getMergeApi } from '../../lib/adapters';
import type { MergeRiskReasonView } from '../../lib/adapters';

/** Draft entri baru (sisi duplikat) dari form UnifiedMemberModal. */
export interface MergeEntryDraft {
  name: string;
  birthDate: string;
  marga: string;
}

interface MergeMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Entri baru yang akan dibuat lalu digabung (sisi duplikat). */
  entryDraft: MergeEntryDraft;
  /** Anggota primary tujuan merge (kandidat existing). */
  primaryId: string;
  /** Dipanggil setelah merge sukses, membawa id primary. */
  onMerged?: (primaryId: string) => void;
}

export function MergeMemberDialog({ isOpen, onClose, entryDraft, primaryId, onMerged }: MergeMemberDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const members = useFamilyStore((s) => s.members);
  const relationships = useFamilyStore((s) => s.relationships);
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);
  const addMember = useFamilyStore((s) => s.addMember);
  const fetchMembers = useFamilyStore((s) => s.fetchMembers);
  const [confirmName, setConfirmName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);
  // v392: merge berisiko tidak dieksekusi; server menjawab 202 dengan
  // daftar alasan berbahaya. Dialog berpindah ke status antrian persetujuan.
  const [queuedReasons, setQueuedReasons] = useState<MergeRiskReasonView[] | null>(null);

  const primary = useMemo(() => members.find((m) => m.id === primaryId), [members, primaryId]);

  const primaryRelCount = useMemo(
    () => relationships.filter((r) => r.memberId === primaryId || r.relatedId === primaryId).length,
    [relationships, primaryId],
  );

  if (!isOpen) return null;
  const mergeApi = getMergeApi();
  if (!mergeApi || !primary) return null;

  const canExecute = confirmName.trim() === primary.name && !isSubmitting;

  const handleMerge = async (): Promise<void> => {
    if (!canExecute || !currentFamilyTreeId) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      // 1) buat anggota baru persis jalur create biasa (baris audit).
      const newId = await addMember({
        id: `member-${crypto.randomUUID()}`,
        name: entryDraft.name,
        marga: entryDraft.marga || undefined,
        gender: 'male',
        birthDate: entryDraft.birthDate,
        isAlive: true,
        generation: 1,
        maritalStatus: 'single',
      });
      if (!newId) throw new Error(t('dedup.merge.failed'));
      // 2) merge baris baru ke primary lewat API server. 202 berarti
      // merge berisiko masuk antrian persetujuan (v392), bukan kegagalan.
      const res = await mergeApi.mergeMember(currentFamilyTreeId, newId, {
        targetId: primaryId,
        confirmName: confirmName.trim(),
      });
      if (res.merged) {
        setDone(true);
        await fetchMembers(currentFamilyTreeId);
        onMerged?.(res.primaryId);
      } else {
        setQueuedReasons(res.reasons);
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : t('dedup.merge.failed'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = (): void => {
    if (isSubmitting) return;
    setConfirmName('');
    setErrorMsg('');
    setDone(false);
    setQueuedReasons(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900" data-testid="merge-dialog-title">{t('dedup.merge.title')}</h2>
              <p className="text-sm text-gray-500">{t('dedup.merge.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            data-testid="merge-dialog-close"
            aria-label="close"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {done ? (
            <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-lg" role="status">
              <div className="flex items-start space-x-3">
                <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <p className="text-green-800 text-sm font-medium" data-testid="merge-success">{t('dedup.merge.success')}</p>
              </div>
            </div>
          ) : queuedReasons ? (
            <>
              {/* v392: merge berisiko masuk antrian persetujuan; tampilkan
                  alasan berbahaya tanpa mengeksekusi apa pun. */}
              <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-lg" role="status" data-testid="merge-approval-queued">
                <div className="flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-amber-900 text-sm font-medium">{t('mergeApproval.pending.success')}</p>
                    <p className="text-xs text-amber-800 font-medium mt-3">{t('mergeApproval.dialog.reasonsLabel')}:</p>
                    <ul className="mt-1 space-y-1">
                      {queuedReasons.map((r) => (
                        <li key={r.code} className="text-xs text-amber-800" data-testid={`approval-reason-${r.code}`}>
                          {t(`mergeApproval.reason.${r.code}`, { actual: r.actual, threshold: r.threshold })}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  data-testid="merge-queued-close"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  {t('mergeApproval.dialog.cancel')}
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Ringkasan side-by-side kedua sisi merge. */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg" data-testid="merge-side-duplicate">
                  <p className="text-xs text-amber-700 font-medium mb-2">{t('dedup.merge.duplicateSide')}</p>
                  <p className="text-sm font-bold text-gray-900">{entryDraft.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{t('dedup.merge.birthDate')}: {entryDraft.birthDate || '-'}</p>
                  <p className="text-xs text-gray-600">{t('dedup.merge.marga')}: {entryDraft.marga || '-'}</p>
                  <p className="text-xs text-gray-600">{t('dedup.merge.relationCount')}: 0</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg" data-testid="merge-side-primary">
                  <p className="text-xs text-blue-700 font-medium mb-2">{t('dedup.merge.primarySide')}</p>
                  <p className="text-sm font-bold text-gray-900">{primary.name}</p>
                  <p className="text-xs text-gray-600 mt-1">{t('dedup.merge.birthDate')}: {primary.birthDate || '-'}</p>
                  <p className="text-xs text-gray-600">{t('dedup.merge.marga')}: {primary.marga || '-'}</p>
                  <p className="text-xs text-gray-600">{t('dedup.merge.relationCount')}: {primaryRelCount}</p>
                </div>
              </div>

              <p className="text-sm text-gray-700 mb-4">{t('dedup.merge.explain')}</p>

              {/* Konfirmasi: ketik nama primary untuk mengaktifkan eksekusi. */}
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="merge-confirm-name">
                {t('dedup.merge.confirmLabel', { name: primary.name })}
              </label>
              <input
                id="merge-confirm-name"
                data-testid="merge-confirm-input"
                type="text"
                value={confirmName}
                onChange={(e) => {
                  setConfirmName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoComplete="off"
              />

              {errorMsg && (
                <div className="mt-4 p-3 bg-red-50 border border-red-300 rounded-lg" role="alert" data-testid="merge-error">
                  <p className="text-red-800 text-sm">{errorMsg}</p>
                </div>
              )}

              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  data-testid="merge-cancel"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-100 transition-colors"
                >
                  {t('dedup.merge.cancel')}
                </button>
                <button
                  type="button"
                  data-testid="merge-execute"
                  onClick={handleMerge}
                  disabled={!canExecute}
                  className={`px-4 py-2 text-sm rounded-md transition-colors ${canExecute ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                >
                  {isSubmitting ? t('dedup.merge.merging') : t('dedup.merge.execute')}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
