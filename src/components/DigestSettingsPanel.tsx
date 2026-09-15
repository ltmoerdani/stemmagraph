import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getDigestApi } from '../lib/adapters';
import type { DigestPreview } from '../lib/adapters';
import { formatDate } from '../lib/i18n';
import {
  optInAfterSave,
  resolveDigestPanelView,
  type DigestPreferenceSaveResult,
} from '../lib/digest/panelState';

/**
 * Weekly digest settings (P2-7, ADR 0008): the consent switch plus an
 * honest preview of last week's email.
 *
 * The toggle PUTs only the caller's own opt-in column; the preview GETs
 * the digest for the last complete ISO week so the user can look before
 * switching on. When the active adapter has no server backend (mock,
 * supabase) the panel shows an unavailable note instead of faking a
 * switch. Every render branch comes from the pure resolver in
 * panelState.ts; this shell only fetches and paints.
 */
export const DigestSettingsPanel: React.FC = () => {
  const { t, i18n } = useTranslation();
  const digestApi = getDigestApi();
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [optIn, setOptIn] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);

  const load = useCallback(async () => {
    if (!digestApi) return;
    try {
      const data = await digestApi.fetchWeeklyDigestPreview();
      setPreview(data);
      setOptIn(data.optIn);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, [digestApi]);

  useEffect(() => {
    // Initial fetch. Inline async with a cancelled flag: the shared load()
    // helper stays for the retry button, and this copy cannot setState
    // after the panel unmounts mid-request.
    if (!digestApi) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await digestApi.fetchWeeklyDigestPreview();
        if (cancelled) return;
        setPreview(data);
        setOptIn(data.optIn);
        setLoadFailed(false);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [digestApi]);

  const handleToggle = async () => {
    if (!digestApi || optIn === null || saving) return;
    const previousOptIn = optIn;
    setOptIn(!previousOptIn); // optimistic flip, undone on rejection
    setSaveFailed(false);
    setSaving(true);
    let result: DigestPreferenceSaveResult;
    try {
      const saved = await digestApi.updateDigestPreferences(!previousOptIn);
      result = { ok: true, optIn: saved.optIn };
    } catch {
      result = { ok: false };
    }
    setSaving(false);
    setSaveFailed(!result.ok);
    setOptIn(optInAfterSave(previousOptIn, result));
  };

  const view = resolveDigestPanelView({
    apiAvailable: digestApi !== null,
    loadFailed,
    preview,
  });

  const windowLabel =
    preview === null
      ? null
      : t('digest.windowLabel', {
          start: formatDate(preview.window.startAt, i18n.language),
          end: formatDate(preview.window.endAt, i18n.language),
        });

  if (view.state === 'unavailable') {
    return (
      <section className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-xl">
        <h3 className="text-sm font-bold text-gray-900">{t('digest.title')}</h3>
        <p className="mt-1 text-xs text-gray-500">{t('digest.unavailable')}</p>
      </section>
    );
  }

  const switchOn = optIn ?? false;

  return (
    <section className="mt-8 p-4 bg-gray-50 border border-gray-200 rounded-xl" aria-label={t('digest.title')}>
      <h3 className="text-sm font-bold text-gray-900">{t('digest.title')}</h3>
      <p className="mt-0.5 text-xs text-gray-500">{t('digest.subtitle')}</p>

      {/* Consent switch: PUT /api/v1/digest/preferences */}
      <div className="mt-3 flex items-start space-x-3">
        <button
          type="button"
          role="switch"
          aria-checked={switchOn}
          aria-label={t('digest.optInLabel')}
          disabled={optIn === null || saving}
          onClick={() => void handleToggle()}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            switchOn ? 'bg-green-600' : 'bg-gray-300'
          } ${optIn === null || saving ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-green-500'}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              switchOn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
        <div>
          <p className="text-sm font-medium text-gray-900">{t('digest.optInLabel')}</p>
          <p className="text-xs text-gray-500">{t('digest.optInHint')}</p>
        </div>
      </div>

      {saving && <p className="mt-2 text-xs text-gray-500">{t('digest.saving')}</p>}
      {saveFailed && <p className="mt-2 text-xs text-red-600">{t('digest.saveFailed')}</p>}

      {view.state === 'loading' && <p className="mt-3 text-sm text-gray-500">{t('digest.loading')}</p>}

      {view.state === 'loadFailed' && (
        <div className="mt-3">
          <p className="text-sm text-red-600">{t('digest.loadFailed')}</p>
          <button
            onClick={() => void load()}
            className="mt-2 px-3 py-1 rounded border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            {t('digest.retry')}
          </button>
        </div>
      )}

      {view.state === 'empty' && (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-900">{t('digest.previewTitle')}</p>
          {windowLabel !== null && <p className="mt-1 text-xs text-gray-600">{windowLabel}</p>}
          <p className="mt-1 text-sm text-gray-500">{t('digest.previewEmpty')}</p>
        </div>
      )}

      {view.state === 'ready' && (
        <div className="mt-3">
          <p className="text-sm font-medium text-gray-900">{t('digest.previewTitle')}</p>
          {windowLabel !== null && <p className="mt-1 text-xs text-gray-600">{windowLabel}</p>}
          <p className="mt-2 text-xs font-medium text-gray-700">{view.subject}</p>
          <pre className="mt-1 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-700 whitespace-pre-wrap font-mono">
            {view.body}
          </pre>
        </div>
      )}
    </section>
  );
};
