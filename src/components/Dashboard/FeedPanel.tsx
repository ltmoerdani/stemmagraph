import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCheck, CheckCircle, ChevronDown, Link2, RefreshCw, Send, UserPlus, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getActivityFeedApi } from '../../lib/adapters';
import { FEED_TYPE_SELECTIONS, type FeedItem, type FeedTypeSelection } from '../../lib/feed';
import { formatDate } from '../../lib/i18n';
import { useAuthStore } from '../../store/authStore';

/**
 * Activity feed panel (P2-6 AC-4, ADR 0006).
 *
 * Read-only list of what happened in the viewer's trees and account:
 * localized labels projected by src/lib/feed from the P2-2 event store.
 * The panel itself holds only view state (items, cursor, filter); every
 * scope and minimization decision was already made server side, so the
 * item payloads that reach this component carry no contact data and no
 * invitation tokens by construction.
 *
 * Honest states: loading, retryable failure, empty (with a distinct text
 * when a type filter matched nothing), and unavailable when the active
 * adapter has no server backend (mock, supabase) because the feed reads
 * the server event store.
 */
export const FeedPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const feedApi = getActivityFeedApi();
  const user = useAuthStore((state) => state.user);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [filter, setFilter] = useState<FeedTypeSelection>('all');
  // Loading starts true only when a backend exists; the unavailable state
  // renders immediately otherwise, without a flash of the loading text.
  const [isLoading, setIsLoading] = useState(feedApi !== null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  // First page per filter. The effect reruns when the filter changes and
  // replaces the list; cancelled guards the unmounted / superseded case.
  // Loading is toggled from event handlers (filter change, retry), never
  // synchronously inside the effect body.
  useEffect(() => {
    if (!feedApi) return;
    let cancelled = false;
    (async () => {
      try {
        const page = await feedApi.fetchActivityFeed({
          type: filter === 'all' ? undefined : filter,
        });
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
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
  }, [feedApi, filter]);

  const handleLoadMore = useCallback(async () => {
    if (!feedApi || nextCursor === null || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await feedApi.fetchActivityFeed({
        type: filter === 'all' ? undefined : filter,
        before: nextCursor,
      });
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }, [feedApi, filter, isLoadingMore, nextCursor]);

  const handleRetry = useCallback(() => {
    setLoadFailed(false);
    setIsLoading(true);
    feedApi
      ?.fetchActivityFeed({ type: filter === 'all' ? undefined : filter })
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch(() => setLoadFailed(true))
      .finally(() => setIsLoading(false));
  }, [feedApi, filter]);

  const iconFor = (item: FeedItem): React.ReactNode => {
    const className = 'w-4 h-4';
    switch (item.type) {
      case 'ACCOUNT_PENDING_CREATED':
        return <UserPlus className={className} />;
      case 'ACCOUNT_ACTIVATED':
        return <CheckCircle className={className} />;
      case 'ACCOUNT_DISABLED':
        return <X className={className} />;
      case 'ACCOUNT_ENABLED':
        return <CheckCheck className={className} />;
      case 'INVITATION_CREATED':
        return <Link2 className={className} />;
      case 'INVITATION_USED':
        return <Send className={className} />;
      case 'INVITATION_REVOKED':
        return <X className={className} />;
    }
  };

  // Localizes interpolation values with an honest fallback to the raw
  // value when a key is missing, so an unknown channel never renders as
  // a bare i18n key.
  const localizeParams = (item: FeedItem): Record<string, string> => ({
    invitationId: item.params['invitationId'] ?? '',
    invitationType: t(`activityFeed.invitationType.${item.params['invitationType']}`, {
      defaultValue: item.params['invitationType'] ?? '',
    }),
    channel: t(`activityFeed.channel.${item.params['channel']}`, {
      defaultValue: item.params['channel'] ?? '',
    }),
    result: item.params['result'] ?? '',
  });

  const labelFor = (item: FeedItem): string => {
    // A pending registration is always the viewer's own fact: account
    // events about other people never enter the feed.
    if (item.type === 'ACCOUNT_PENDING_CREATED') {
      return t(item.i18nKey);
    }
    if (item.kind === 'account') {
      const asActor = item.actorUserId !== null && item.actorUserId === user?.id;
      return t(`${item.i18nKey}.${asActor ? 'asActor' : 'asSubject'}`);
    }
    if (item.type === 'INVITATION_USED') {
      const outcome = item.params['result'] === 'failure' ? 'failure' : 'success';
      return t(`${item.i18nKey}.${outcome}`, localizeParams(item));
    }
    return t(item.i18nKey, localizeParams(item));
  };

  const renderBody = (): React.ReactNode => {
    if (!feedApi) {
      return (
        <div className="text-center py-12 text-gray-500" data-testid="feed-unavailable">
          <p>{t('activityFeed.unavailable')}</p>
        </div>
      );
    }
    if (isLoading) {
      return (
        <div className="text-center py-12 text-gray-500" data-testid="feed-loading">
          <p>{t('activityFeed.loading')}</p>
        </div>
      );
    }
    if (loadFailed) {
      return (
        <div className="text-center py-12" data-testid="feed-error">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-gray-700 mb-4">{t('activityFeed.loadFailed')}</p>
          <button
            onClick={handleRetry}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            <span>{t('activityFeed.retry')}</span>
          </button>
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="text-center py-12" data-testid="feed-empty">
          <p className="text-gray-500">
            {filter === 'all' ? t('activityFeed.empty') : t('activityFeed.emptyFiltered')}
          </p>
        </div>
      );
    }
    return (
      <div>
        <ul className="divide-y divide-gray-100" data-testid="feed-items">
          {items.map((item) => (
            <li key={item.id} className="flex items-start space-x-3 py-3">
              <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 shrink-0">
                {iconFor(item)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-900 break-words">{labelFor(item)}</p>
                <time dateTime={item.createdAt} className="text-xs text-gray-400">
                  {formatDate(item.createdAt, i18n.language)}
                </time>
              </div>
            </li>
          ))}
        </ul>
        {nextCursor !== null && (
          <div className="text-center py-4">
            <button
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="feed-load-more"
            >
              <ChevronDown className="w-4 h-4" />
              <span>{isLoadingMore ? t('activityFeed.loading') : t('activityFeed.loadMore')}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="bg-white rounded-xl shadow-xs border border-gray-200" data-testid="feed-panel" aria-label={t('activityFeed.title')}>
      <div className="p-6 pb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{t('activityFeed.title')}</h3>
          <p className="text-sm text-gray-500">{t('activityFeed.subtitle')}</p>
        </div>
        <label className="flex items-center space-x-2 text-sm text-gray-600">
          <span className="whitespace-nowrap">{t('activityFeed.filterLabel')}</span>
          <select
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as FeedTypeSelection);
              setIsLoading(true);
              setLoadFailed(false);
            }}
            className="border border-gray-300 rounded-lg px-3 py-1.5 bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={t('activityFeed.filterLabel')}
            data-testid="feed-filter"
          >
            {FEED_TYPE_SELECTIONS.map((selection) => (
              <option key={selection} value={selection}>
                {selection === 'all'
                  ? t('activityFeed.filterAll')
                  : t(`activityFeed.types.${selection}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="px-6 pb-6">{renderBody()}</div>
    </section>
  );
};
