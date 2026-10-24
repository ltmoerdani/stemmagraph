/**
 * Dialog un-merge anggota (v391 Un-Merge via Jurnal Merge fase 1).
 *
 * Muncul dari UnifiedMemberModal saat membuka anggota berstatus merged.
 * Kontrak AC5 GOAL v391: dialog konfirmasi menjelaskan konsekuensi
 * (relasi dan facts kembali ke record lama), wajib ketik nama anggota
 * merged untuk mengaktifkan tombol, tanpa undo satu-klik. Adapter tanpa
 * server (getMergeApi null): dialog tidak dirender.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Undo2 } from 'lucide-react';
import { useFamilyStore } from '../../store/familyStore';
import { getMergeApi } from '../../lib/adapters';

interface UnmergeMemberDialogProps {
  isOpen: boolean;
  onClose: () => void;
  /** Anggota merged yang akan dibalikkan (baris duplikat). */
  duplicateId: string;
  /** Dipanggil setelah un-merge sukses dan data di-refresh. */
  onUnmerged?: () => void;
}

export function UnmergeMemberDialog({ isOpen, onClose, duplicateId, onUnmerged }: UnmergeMemberDialogProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const members = useFamilyStore((s) => s.members);
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);
  const fetchMembers = useFamilyStore((s) => s.fetchMembers);
  const [confirmName, setConfirmName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [done, setDone] = useState(false);

  const duplicate = useMemo(() => members.find((m) => m.id === duplicateId), [members, duplicateId]);

  if (!isOpen) return null;
  const mergeApi = getMergeApi();
  if (!mergeApi || !duplicate) return null;

  const canExecute = confirmName.trim() === duplicate.name && !isSubmitting;

  const handleUnmerge = async (): Promise<void> => {
    if (!canExecute || !currentFamilyTreeId) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await mergeApi.unmergeMember(currentFamilyTreeId, duplicateId);
      if (res.unmerged) {
        setDone(true);
        await fetchMembers(currentFamilyTreeId);
        onUnmerged?.();
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error && err.message
          ? err.message
          : t('dedup.unmerge.failed'),
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
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center">
              <Undo2 className="w-5 h-5 text-sky-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900" data-testid="unmerge-dialog-title">{t('dedup.unmerge.title')}</h2>
              <p className="text-sm text-gray-500">{t('dedup.unmerge.subtitle', { name: duplicate.name })}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label={t('common.cancel')}
          >
            ✕
          </button>
        </div>

        {done ? (
          <div className="p-6 space-y-4">
            <p className="text-green-700 font-medium" data-testid="unmerge-success">{t('dedup.unmerge.success')}</p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                {t('common.close')}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4 text-sm text-gray-700 space-y-2">
              <p>{t('dedup.unmerge.consequence')}</p>
            </div>
            {errorMsg.length > 0 && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm" data-testid="unmerge-error">
                {errorMsg}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="unmerge-confirm-name">
                {t('dedup.unmerge.confirmLabel', { name: duplicate.name })}
              </label>
              <input
                id="unmerge-confirm-name"
                type="text"
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                placeholder={duplicate.name}
                data-testid="unmerge-confirm-input"
              />
            </div>
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-6 py-3 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                {t('dedup.unmerge.cancel')}
              </button>
              <button
                type="button"
                onClick={() => { void handleUnmerge(); }}
                disabled={!canExecute}
                data-testid="unmerge-execute"
                className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium flex items-center space-x-2 justify-center"
              >
                {isSubmitting && (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                <span>{t('dedup.unmerge.execute')}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
