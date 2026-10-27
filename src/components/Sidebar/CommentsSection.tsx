import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCommentApi } from '../../lib/adapters';
import { useAuthStore } from '../../store/authStore';
import type { CommentItem } from '../../lib/adapters/types';

const MAX_BODY_LENGTH = 2000;

interface CommentsSectionProps {
  memberId: string;
}

/**
 * Profile comments panel (GOAL v416 AC2, AC3).
 * Follows the MergeApprovalsPanel hide-on-failure pattern: when the
 * comment API is unavailable (mock/supabase adapter) or the initial
 * fetch fails, the whole section stays hidden instead of crashing.
 * AC3: the author and the tree owner can delete a comment after a
 * confirm dialog; deletion is non-optimistic with inline errors.
 */
export const CommentsSection: React.FC<CommentsSectionProps> = ({ memberId }) => {
  const { t } = useTranslation();
  const api = getCommentApi();
  const user = useAuthStore((s) => s.user);

  const [hidden, setHidden] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<CommentItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    api
      .listComments(memberId)
      .then((page) => {
        if (cancelled) return;
        setComments(page.comments);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        if (!cancelled) setHidden(true);
      });
    return () => {
      cancelled = true;
    };
  }, [api, memberId]);

  const handleLoadMore = useCallback(() => {
    if (!api || nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    api
      .listComments(memberId, nextCursor)
      .then((page) => {
        setComments((prev) => [...prev, ...page.comments]);
        setNextCursor(page.nextCursor);
      })
      .catch(() => {
        setError(t('commentSection.errorInline'));
      })
      .finally(() => {
        setLoadingMore(false);
      });
  }, [api, memberId, nextCursor, loadingMore, t]);

  const canSubmit = draft.trim().length > 0 && !sending;

  const canDeleteComment = (comment: CommentItem): boolean => {
    if (!user) return false;
    return user.role === 'owner' || comment.userId === user.id;
  };

  const handleRequestDelete = useCallback(
    (comment: CommentItem, event: React.MouseEvent<HTMLButtonElement>) => {
      setError(null);
      setStatus(null);
      lastTriggerRef.current = event.currentTarget;
      setConfirmTarget(comment);
    },
    [],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!api || !confirmTarget || deletingId !== null) return;
    const commentId = confirmTarget.id;
    setDeletingId(commentId);
    setError(null);
    api
      .deleteComment(commentId)
      .then(() => {
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        setConfirmTarget(null);
        setStatus(t('commentSection.deleteSukses'));
      })
      .catch(() => {
        setError(t('commentSection.errorInline'));
      })
      .finally(() => {
        setDeletingId(null);
      });
  }, [api, confirmTarget, deletingId, t]);

  const handleCancelDelete = useCallback(() => {
    setStatus(null);
    setConfirmTarget(null);
  }, []);

  useEffect(() => {
    if (confirmTarget === null) {
      // AC4: hand focus back to the button that opened the dialog.
      const trigger = lastTriggerRef.current;
      if (trigger && document.contains(trigger)) trigger.focus();
      return;
    }
    cancelButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirmTarget(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusables = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const items = Array.from(focusables).filter((el) => !el.hasAttribute('disabled'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [confirmTarget]);

  const handleSubmit = useCallback(() => {
    if (!api || !canSubmit) return;
    const body = draft.trim();
    const tempId = `temp-${Date.now()}-${Math.round(Math.random() * 1000000)}`;
    const optimistic: CommentItem = {
      id: tempId,
      memberId,
      userId: '',
      body,
      createdAt: new Date().toISOString(),
    };
    const rollback = comments;
    setSending(true);
    setError(null);
    setComments((prev) => [optimistic, ...prev]);
    api
      .postComment(memberId, body)
      .then((result) => {
        setComments((prev) => prev.map((c) => (c.id === tempId ? result.comment : c)));
        setDraft('');
      })
      .catch(() => {
        setComments(rollback);
        setError(t('commentSection.errorInline'));
      })
      .finally(() => {
        setSending(false);
      });
  }, [api, canSubmit, draft, memberId, comments, t]);

  if (!api || hidden) return null;

  const formatDate = (iso: string) => {
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
      ? ''
      : date.toLocaleDateString('id', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const remaining = MAX_BODY_LENGTH - draft.length;

  return (
    <section className="mt-8 mb-8" aria-label={t('commentSection.title')}>
      <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
        <MessageCircle className="w-5 h-5 text-gray-400" />
        <span>{t('commentSection.title')}</span>
      </h4>

      {comments.length > 0 && (
        <ul className="space-y-4 mb-4">
          {comments.map((comment) => (
            <li key={comment.id} className="border-b border-gray-100 pb-3 last:border-b-0">
              <p className="text-sm font-medium text-gray-900">
                {comment.userName || t('commentSection.tanpaNama')}
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{comment.body}</p>
              <div className="flex items-center justify-between mt-1">
                <p className="text-xs text-gray-400">{formatDate(comment.createdAt)}</p>
                {canDeleteComment(comment) && (
                  <button
                    type="button"
                    onClick={(e) => handleRequestDelete(comment, e)}
                    disabled={deletingId !== null}
                    aria-label={t('commentSection.deleteAria')}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 outline-none"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {nextCursor !== null && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mb-4 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 outline-none"
        >
          {loadingMore ? t('commentSection.loadingMore') : t('commentSection.loadMore')}
        </button>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value.slice(0, MAX_BODY_LENGTH))}
          placeholder={t('commentSection.placeholder')}
          maxLength={MAX_BODY_LENGTH}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{t('commentSection.charsLeft', { remaining })}</span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 outline-none"
          >
            {t('commentSection.send')}
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {error !== null && <p className="mt-2 text-sm text-red-600">{error}</p>}
        {status !== null && <p className="mt-2 text-sm text-green-700">{status}</p>}
      </div>

      {confirmTarget !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCancelDelete();
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-label={t('commentSection.deleteTitle')}
            className="w-full max-w-sm bg-white rounded-lg shadow-xl p-5"
          >
            <h5 className="text-base font-semibold text-gray-900">{t('commentSection.deleteTitle')}</h5>
            <p className="mt-2 text-sm text-gray-600">{t('commentSection.deleteBody')}</p>
            <div className="mt-4 flex justify-end space-x-2">
              <button
                ref={cancelButtonRef}
                type="button"
                onClick={handleCancelDelete}
                className="px-4 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 outline-none"
              >
                {t('commentSection.deleteCancel')}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingId !== null}
                className="px-4 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 outline-none"
              >
                {deletingId !== null ? t('commentSection.deleting') : t('commentSection.deleteConfirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
