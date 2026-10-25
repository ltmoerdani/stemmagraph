/**
 * CalendarFeedPanel (v394 AC5): panel langganan kalender keluarga via ICS
 * di Dashboard. Hanya tree owner/editor yang punya tombol masuk (kontrak
 * server: viewer 403). Isi: buat/rotate token feed (token penuh tampil
 * tepat satu kali saat rotate, preseden invitation + Stripe), salin URL
 * subscribe, petunjuk singkat Google Calendar From URL dan Apple Calendar,
 * dan revoke.
 *
 * Adapter tanpa server (getCalendarFeedApi null): tombol masuk tidak
 * dirender di Dashboard dan panel tidak pernah termount. Guard role ada
 * di server (owner/editor), panel hanya menampilkan hasil secara jujur.
 */
import React, { useState } from 'react';
import { X, CalendarPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCalendarFeedApi } from '../../lib/adapters';

export const CalendarFeedPanel: React.FC<{ treeId: string; treeName: string; onClose: () => void }> = ({
  treeId,
  treeName,
  onClose,
}) => {
  const { t } = useTranslation();
  // Adapter diambil sekali (useState initializer) agar identitas stabil
  // antar render, pola MergeApprovalsPanel.
  const [calendarApi] = useState(() => getCalendarFeedApi());
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const feedUrl =
    token === null
      ? null
      : `${window.location.origin}/api/v1/trees/${encodeURIComponent(treeId)}/calendar.ics?token=${encodeURIComponent(token)}`;

  const rotate = async (): Promise<void> => {
    if (!calendarApi || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await calendarApi.rotateCalendarToken(treeId);
      setToken(res.token);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : null);
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (): Promise<void> => {
    if (!calendarApi || busy) return;
    setBusy(true);
    setError(null);
    try {
      await calendarApi.revokeCalendarToken(treeId);
      setToken(null);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : null);
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = (): void => {
    if (feedUrl === null) return;
    // jsdom test env has no clipboard; success state is optimistic.
    void navigator.clipboard?.writeText(feedUrl).catch(() => undefined);
    setCopied(true);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white rounded-t-xl">
          <h2 className="text-lg font-bold text-gray-900" data-testid="calendar-feed-title">
            {t('calendarFeed.panel.title', { name: treeName })}
          </h2>
          <button onClick={onClose} data-testid="calendar-feed-close" aria-label="close" className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {error !== null && (
            <div className="p-3 bg-red-50 border border-red-300 rounded-lg" role="alert" data-testid="calendar-feed-error">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}
          {feedUrl === null ? (
            <p className="text-sm text-gray-500" data-testid="calendar-feed-inactive">
              {t('calendarFeed.panel.inactive')}
            </p>
          ) : (
            <div className="space-y-2" data-testid="calendar-feed-active">
              <p className="text-xs text-gray-500">{t('calendarFeed.panel.urlLabel')}</p>
              <code className="block text-xs bg-gray-50 border border-gray-200 rounded-md p-2 break-all" data-testid="calendar-feed-url">
                {feedUrl}
              </code>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  data-testid="calendar-feed-copy"
                  onClick={copyUrl}
                  className="px-3 py-1.5 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  {copied ? t('calendarFeed.panel.copied') : t('calendarFeed.panel.copy')}
                </button>
              </div>
              <p className="text-xs text-gray-500">{t('calendarFeed.panel.hintGoogle')}</p>
              <p className="text-xs text-gray-500">{t('calendarFeed.panel.hintApple')}</p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
            <button
              type="button"
              data-testid="calendar-feed-revoke"
              disabled={busy || feedUrl === null}
              onClick={() => void revoke()}
              className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 transition-colors disabled:opacity-50"
            >
              {t('calendarFeed.panel.revoke')}
            </button>
            <button
              type="button"
              data-testid="calendar-feed-rotate"
              disabled={busy}
              onClick={() => void rotate()}
              className="px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {token === null ? t('calendarFeed.panel.create') : t('calendarFeed.panel.rotate')}
              <CalendarPlus className="w-4 h-4 inline ml-1" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
