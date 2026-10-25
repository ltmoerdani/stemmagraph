/**
 * MergeApprovalsPanel (v392 AC6): panel antrian persetujuan merge
 * berisiko di Dashboard. Entry badge menampilkan jumlah PENDING dari
 * GET merge-approvals (query status=PENDING); klik membuka daftar
 * approval dengan alasan berbahaya per kode dan dua aksi eksplisit
 * (approve/reject). Approve mengeksekusi merge server-side dan panel
 * menyegarkan antrian.
 *
 * Pola panel mengikuti ChangeReviewPanel: guard role ada di server
 * (edit_member), viewer tidak pernah melihat badge karena endpoint
 * 403 dan badge disembunyikan saat fetch gagal. Adapter tanpa server
 * (getMergeApi null): badge tidak dirender.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getMergeApi } from '../../lib/adapters';
import type { MergeApprovalRecord, MergeRiskReasonView } from '../../lib/adapters';
import { formatDate } from '../../lib/i18n';

export const MergeApprovalsPanel: React.FC<{ treeId: string; treeName: string; onClose: () => void }> = ({
  treeId,
  treeName,
  onClose,
}) => {
  const { t, i18n } = useTranslation();
  // Adapter diambil sekali (useState initializer) supaya identitas stabil
  // antar render; getMergeApi() per render bisa mengembalikan instance
  // berbeda dan memicu fetch ulang pada effect.
  const [mergeApi] = useState(() => getMergeApi());
  const [approvals, setApprovals] = useState<MergeApprovalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null);

  const load = useCallback(async () => {
    if (!mergeApi) return;
    try {
      setApprovals(await mergeApi.listMergeApprovals(treeId, { status: 'PENDING' }));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [mergeApi, treeId]);

  // Initial fetch follows the ChangeReviewPanel shape: an async IIFE so
  // state updates land after the await, never synchronously in the effect.
  useEffect(() => {
    if (!mergeApi) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await mergeApi.listMergeApprovals(treeId, { status: 'PENDING' });
        if (!cancelled) {
          setApprovals(rows);
          setLoadFailed(false);
        }
      } catch {
        if (!cancelled) setLoadFailed(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mergeApi, treeId]);

  const decide = async (approval: MergeApprovalRecord, action: 'approve' | 'reject'): Promise<void> => {
    if (!mergeApi || busyId) return;
    setBusyId(approval.id);
    setActionError(null);
    try {
      await mergeApi.decideMergeApproval(treeId, approval.id, action);
      setConfirming(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error && e.message ? e.message : null);
    } finally {
      setBusyId(null);
    }
  };

  const renderReason = (r: MergeRiskReasonView) => (
    <li key={r.code} className="text-xs text-gray-700" data-testid={`panel-reason-${r.code}`}>
      {t(`mergeApproval.reason.${r.code}`, { actual: r.actual, threshold: r.threshold })}
    </li>
  );

  const renderApproval = (a: MergeApprovalRecord) => (
    <article key={a.id} className="border border-gray-200 rounded-lg p-4 space-y-3" data-testid={`merge-approval-${a.id}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
          <ShieldAlert className="w-4 h-4 text-amber-600" />
          <span>
            {t('mergeApproval.pending.requestedBy')} {a.requesterId}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {t('mergeApproval.dialog.expiresLabel')}: {formatDate(a.expiresAt, i18n.language)}
        </span>
      </div>
      <div className="text-xs text-gray-500">
        <span className="font-medium text-gray-700">{t('mergeApproval.dialog.reasonsLabel')}:</span>
        <ul className="mt-1 space-y-1">{(a.reasons ?? []).map(renderReason)}</ul>
      </div>
      {confirming === null || busyId === a.id ? (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            data-testid={`approval-reject-${a.id}`}
            disabled={busyId !== null}
            onClick={() => setConfirming('reject')}
            className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
          >
            {t('mergeApproval.dialog.rejectConfirm')}
          </button>
          <button
            type="button"
            data-testid={`approval-approve-${a.id}`}
            disabled={busyId !== null}
            onClick={() => setConfirming('approve')}
            className="px-3 py-1.5 text-sm rounded-md bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {t('mergeApproval.dialog.approveConfirm')}
          </button>
        </div>
      ) : (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md" data-testid={`approval-confirm-box-${a.id}`}>
          <p className="text-xs text-amber-900 mb-2">
            {confirming === 'approve' ? t('mergeApproval.dialog.approveTitle') : t('mergeApproval.dialog.rejectTitle')}?
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              data-testid={`approval-cancel-${a.id}`}
              onClick={() => setConfirming(null)}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {t('mergeApproval.dialog.cancel')}
            </button>
            <button
              type="button"
              data-testid={`approval-confirm-${confirming}-${a.id}`}
              disabled={busyId !== null}
              onClick={() => void decide(a, confirming)}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors disabled:opacity-50 ${
                confirming === 'approve' ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-red-600 text-white hover:bg-red-700'
              }`}
            >
              {confirming === 'approve' ? t('mergeApproval.dialog.approveConfirm') : t('mergeApproval.dialog.rejectConfirm')}
            </button>
          </div>
        </div>
      )}
    </article>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <div>
            <h2 className="text-lg font-bold text-gray-900" data-testid="merge-approvals-title">
              {t('mergeApproval.panel.title', { name: treeName })}
            </h2>
          </div>
          <button onClick={onClose} data-testid="merge-approvals-close" aria-label="close" className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {actionError && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg" role="alert" data-testid="merge-approvals-error">
              <p className="text-red-800 text-sm">{actionError}</p>
            </div>
          )}
          {isLoading ? (
            <p className="text-sm text-gray-500">{t('mergeApproval.panel.loading')}</p>
          ) : loadFailed ? (
            <p className="text-sm text-red-700">{t('mergeApproval.panel.loadFailed')}</p>
          ) : approvals.length === 0 ? (
            <p className="text-sm text-gray-500" data-testid="merge-approvals-empty">{t('mergeApproval.pending.queueEmpty')}</p>
          ) : (
            approvals.map(renderApproval)
          )}
        </div>
      </div>
    </div>
  );
};
