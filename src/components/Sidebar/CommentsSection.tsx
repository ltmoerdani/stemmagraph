import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCommentApi } from '../../lib/adapters';
import type { CommentItem } from '../../lib/adapters/types';

const MAX_BODY_LENGTH = 2000;

interface CommentsSectionProps {
  memberId: string;
}

/**
 * Profile comments panel (GOAL v416 AC2).
 * Follows the MergeApprovalsPanel hide-on-failure pattern: when the
 * comment API is unavailable (mock/supabase adapter) or the initial
 * fetch fails, the whole section stays hidden instead of crashing.
 */
export const CommentsSection: React.FC<CommentsSectionProps> = ({ memberId }) => {
  const { t } = useTranslation();
  const api = getCommentApi();

  const [hidden, setHidden] = useState(false);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    setComments([]);
    setNextCursor(null);
    setDraft('');
    setError(null);
    setHidden(false);
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
              <p className="text-xs text-gray-400 mt-1">{formatDate(comment.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}

      {nextCursor !== null && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="mb-4 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50"
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
          <span className="text-xs text-gray-400">{t('commentSection.charsLeft', { count: remaining })}</span>
          <button
            type="submit"
            disabled={!canSubmit}
            className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t('commentSection.send')}
          </button>
        </div>
      </form>

      {error !== null && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
    </section>
  );
};
