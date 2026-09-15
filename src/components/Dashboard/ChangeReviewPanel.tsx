import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, Clock, FileDiff, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getChangeReviewApi } from '../../lib/adapters';
import type { ChangeProposalRecord, TreeRoleValue } from '../../lib/adapters';
import { formatDate } from '../../lib/i18n';

/**
 * Change review panel (P2-5 AC-5, ADR 0009).
 *
 * One panel, two honest shapes decided by the server's answer: an owner
 * reviews every pending proposal and can accept (apply), reject (with a
 * required note), or mark it distinct forever; an editor only sees their
 * own submissions with the outcome and the decision note. Viewers never
 * reach this component: the dashboard only mounts the entry button for
 * owner and editor trees, and the server refuses viewers with 403 on the
 * list endpoint anyway. Server messages render verbatim, like the
 * invitations panel.
 */
export const ChangeReviewPanel: React.FC<{
  treeId: string;
  treeName: string;
  onClose: () => void;
}> = ({ treeId, treeName, onClose }) => {
  const { t, i18n } = useTranslation();
  const changeApi = getChangeReviewApi();

  const [role, setRole] = useState<TreeRoleValue | null>(null);
  const [proposals, setProposals] = useState<ChangeProposalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [acceptDoneId, setAcceptDoneId] = useState<string | null>(null);
  // Reject flows need a note per proposal before the call goes out.
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!changeApi) return;
    try {
      const page = await changeApi.listChangeProposals(treeId);
      setRole(page.role);
      setProposals(page.proposals);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [changeApi, treeId]);

  useEffect(() => {
    if (!changeApi) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await changeApi.listChangeProposals(treeId);
        if (cancelled) return;
        setRole(page.role);
        setProposals(page.proposals);
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
  }, [changeApi, treeId]);

  const handleAccept = async (proposal: ChangeProposalRecord) => {
    if (!changeApi) return;
    setBusyId(proposal.id);
    setActionError(null);
    try {
      await changeApi.acceptChangeProposal(proposal.id);
      setAcceptDoneId(proposal.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('changeReview.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (proposal: ChangeProposalRecord) => {
    if (!changeApi) return;
    if (rejectNote.trim().length < 3) {
      setActionError(t('changeReview.rejectNoteRequired'));
      return;
    }
    setBusyId(proposal.id);
    setActionError(null);
    try {
      await changeApi.rejectChangeProposal(proposal.id, rejectNote.trim());
      setRejectingId(null);
      setRejectNote('');
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('changeReview.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const handleDistinct = async (proposal: ChangeProposalRecord) => {
    if (!changeApi) return;
    setBusyId(proposal.id);
    setActionError(null);
    try {
      await changeApi.distinctChangeProposal(proposal.id);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : t('changeReview.actionFailed'));
    } finally {
      setBusyId(null);
    }
  };

  const formatWhen = (value: string | null): string =>
    value === null ? '' : formatDate(value, i18n.language);

  /** Renders one before/after field slice as label-value rows. */
  const renderSlice = (slice: Record<string, unknown>) => (
    <dl className="text-sm space-y-1">
      {Object.entries(slice).map(([field, value]) => (
        <div key={field} className="flex gap-2">
          <dt className="text-gray-500 min-w-24">{field}</dt>
          <dd className="text-gray-900 break-all">{value === null || value === '' ? '-' : String(value)}</dd>
        </div>
      ))}
    </dl>
  );

  const renderProposal = (proposal: ChangeProposalRecord) => (
    <article
      key={proposal.id}
      className="border border-gray-200 rounded-lg p-4 space-y-3"
      data-testid={`change-proposal-${proposal.id}`}
    >
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <FileDiff className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-900">
            {t(`changeReview.targetType.${proposal.targetType}`)}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              proposal.state === 'pending'
                ? 'bg-amber-100 text-amber-800'
                : proposal.state === 'rejected'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-purple-100 text-purple-700'
            }`}
          >
            {t(`changeReview.state.${proposal.state}`)}
          </span>
        </div>
        <time className="text-xs text-gray-500">
          {t('changeReview.proposedAt', { date: formatWhen(proposal.createdAt) })}
        </time>
      </header>

      <div className="space-y-1 text-sm text-gray-700">
        <p className="font-medium text-gray-900">{t('changeReview.reasonLabel')}</p>
        <p>{proposal.reasonNote}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <section className="bg-gray-50 rounded-md p-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">
            {t('changeReview.beforeLabel')}
          </h4>
          {renderSlice(proposal.before)}
        </section>
        <section className="bg-green-50 rounded-md p-3">
          <h4 className="text-xs font-semibold text-green-700 uppercase mb-2">
            {t('changeReview.afterLabel')}
          </h4>
          {renderSlice(proposal.after)}
        </section>
      </div>

      {proposal.state !== 'pending' && (
        <footer className="text-xs text-gray-600 space-y-1 border-t border-gray-100 pt-2">
          <p>{t('changeReview.decidedAt', { date: formatWhen(proposal.decidedAt) })}</p>
          {proposal.decisionNote !== null && proposal.decisionNote !== '' && (
            <p>
              <span className="font-medium">{t('changeReview.decisionNoteLabel')}:</span>{' '}
              {proposal.decisionNote}
            </p>
          )}
        </footer>
      )}

      {role === 'owner' && proposal.state === 'pending' && (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          {rejectingId === proposal.id ? (
            <div className="space-y-2">
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder={t('changeReview.rejectNotePlaceholder')}
                rows={2}
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                data-testid={`reject-note-${proposal.id}`}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void handleReject(proposal)}
                  disabled={busyId === proposal.id}
                  className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {t('changeReview.actionReject')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRejectingId(null);
                    setRejectNote('');
                  }}
                  className="px-3 py-1.5 rounded-md border border-gray-300 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {t('changeReview.cancelReject')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleAccept(proposal)}
                disabled={busyId === proposal.id}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                {t('changeReview.actionAccept')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRejectingId(proposal.id);
                  setRejectNote('');
                }}
                disabled={busyId === proposal.id}
                className="px-3 py-1.5 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                {t('changeReview.actionReject')}
              </button>
              <button
                type="button"
                onClick={() => void handleDistinct(proposal)}
                disabled={busyId === proposal.id}
                title={t('changeReview.distinctHint')}
                className="px-3 py-1.5 rounded-md border border-purple-300 text-purple-700 text-sm font-medium hover:bg-purple-50 disabled:opacity-50"
              >
                {t('changeReview.actionDistinct')}
              </button>
            </div>
          )}
          {acceptDoneId === proposal.id && (
            <p className="text-sm text-green-700 flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4" />
              {t('changeReview.acceptDone')}
            </p>
          )}
        </div>
      )}
    </article>
  );

  if (!changeApi) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-xl max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">{t('changeReview.open')}</h2>
            <button type="button" onClick={onClose} aria-label={t('changeReview.close')}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <p className="text-sm text-gray-600">{t('changeReview.unavailable')}</p>
        </div>
      </div>
    );
  }

  const pendingCount = proposals.filter((p) => p.state === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" data-testid="change-review-panel">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {t('changeReview.title', { treeName })}
            </h2>
            <p className="text-sm text-gray-500 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              {role === 'owner'
                ? `${t('changeReview.ownerTitle')} (${pendingCount})`
                : t('changeReview.editorTitle')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              aria-label={t('changeReview.refresh')}
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
            <button type="button" onClick={onClose} aria-label={t('changeReview.close')}>
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </header>

        <div className="overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <p className="text-sm text-gray-500">{t('changeReview.loading')}</p>
          ) : loadFailed ? (
            <p className="text-sm text-red-600">{t('changeReview.loadFailed')}</p>
          ) : proposals.length === 0 ? (
            <p className="text-sm text-gray-500">
              {role === 'owner' ? t('changeReview.emptyOwner') : t('changeReview.emptyEditor')}
            </p>
          ) : (
            proposals.map(renderProposal)
          )}

          {actionError !== null && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="break-words">{actionError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
