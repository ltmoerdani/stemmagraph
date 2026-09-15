import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getGrowthMetricsApi } from '../../lib/adapters';
import type { GrowthMetricsSnapshot } from '../../lib/adapters';

/**
 * Growth metrics section (P2-8 AC-3) inside the owner admin panel.
 *
 * A read-only weekly table of the invitation funnel and k-factor plus the
 * tree snapshot row. The server re-checks requireOwner on every call, so
 * this component never trusts its caller for security. Numbers arrive
 * already rounded to 4 decimals by the server; the panel renders them as
 * delivered instead of re-rounding client-side. When the active adapter
 * has no server backend (mock, supabase) the section shows an honest
 * unavailable note, never fabricated zeros.
 */
export const GrowthMetricsPanel: React.FC = () => {
  const { t } = useTranslation();
  const [snapshot, setSnapshot] = useState<GrowthMetricsSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  const growthApi = getGrowthMetricsApi();

  const load = useCallback(async () => {
    if (!growthApi) return;
    try {
      setSnapshot(await growthApi.fetchGrowthMetrics());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [growthApi]);

  useEffect(() => {
    // Initial fetch. Inline async with a cancelled flag: the shared load()
    // helper stays for the retry button, and this copy cannot setState
    // after the panel unmounts mid-request.
    if (!growthApi) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await growthApi.fetchGrowthMetrics();
        if (cancelled) return;
        setSnapshot(data);
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
  }, [growthApi]);

  if (!growthApi) {
    return (
      <section className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <h3 className="text-sm font-bold text-gray-900">{t('growthMetrics.title')}</h3>
        <p className="mt-1 text-xs text-gray-500">{t('growthMetrics.unavailable')}</p>
      </section>
    );
  }

  const weeks = snapshot?.weeks ?? [];
  const isEmpty = !loadFailed && !isLoading && weeks.every((week) => week.e1 === 0 && week.e2 === 0 && week.e3 === 0);

  const formatRate = (value: number) => String(value);

  return (
    <section className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-xl" aria-label={t('growthMetrics.title')}>
      <h3 className="text-sm font-bold text-gray-900">{t('growthMetrics.title')}</h3>
      <p className="mt-0.5 text-xs text-gray-500">{t('growthMetrics.subtitle')}</p>

      {isLoading && <p className="mt-3 text-sm text-gray-500">{t('growthMetrics.loading')}</p>}

      {loadFailed && (
        <div className="mt-3">
          <p className="text-sm text-red-600">{t('growthMetrics.loadFailed')}</p>
          <button
            onClick={() => void load()}
            className="mt-2 px-3 py-1 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {t('growthMetrics.retry')}
          </button>
        </div>
      )}

      {!isLoading && !loadFailed && (
        <>
          <p className="mt-3 text-xs text-gray-600">
            {t('growthMetrics.treesWithActiveEditor', { pct: String(snapshot?.treesWithActiveEditorPct ?? 0) })}
          </p>

          {isEmpty ? (
            <p className="mt-3 text-sm text-gray-500">{t('growthMetrics.empty')}</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase border-b border-gray-200">
                    <th className="py-2 pr-3 font-semibold">{t('growthMetrics.table.week')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('growthMetrics.table.e1')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('growthMetrics.table.e2')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('growthMetrics.table.e3')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('growthMetrics.table.k')}</th>
                    <th className="py-2 pr-3 font-semibold">{t('growthMetrics.table.pakaiRate')}</th>
                    <th className="py-2 font-semibold">{t('growthMetrics.table.aktivasiRate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week) => (
                    <tr key={week.isoWeek} className="border-b border-gray-100 last:border-b-0">
                      <td className="py-2 pr-3 font-medium text-gray-900 whitespace-nowrap">{week.isoWeek}</td>
                      <td className="py-2 pr-3 text-gray-700">{week.e1}</td>
                      <td className="py-2 pr-3 text-gray-700">{week.e2}</td>
                      <td className="py-2 pr-3 text-gray-700">{week.e3}</td>
                      <td className="py-2 pr-3 text-gray-900">{formatRate(week.k)}</td>
                      <td className="py-2 pr-3 text-gray-700">{formatRate(week.pakaiRate)}</td>
                      <td className="py-2 text-gray-700">{formatRate(week.aktivasiRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
};
