import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Lock, RefreshCw, X } from 'lucide-react';
import {
  POSTHUMOUS_YEARS_MAX,
  POSTHUMOUS_YEARS_MIN,
  RELATIONSHIP_STEPS_MAX,
  RELATIONSHIP_STEPS_MIN,
  validatePosthumousYears,
  validateRelationshipMode,
  validateRelationshipSteps,
  type FamilyPrivacySettingsValue,
} from '../../lib/privacy/family-privacy-settings';

/**
 * v445 fase 2: form pengaturan relasi-privasi per keluarga, hanya untuk
 * role pemilik/admin keluarga (owner/editor). Terpasang di dashboard
 * keluarga per tree. Guard submit ganda dengan flag saving; validasi
 * client memakai modul pure yang sama dengan server sehingga pesan
 * error i18n konsisten dua sisi.
 *
 * Panel memakai fetch langsung ke /api/v1 (pola photoClient): adapter
 * REST saja yang punya backend server; adapter lain menyembunyikan form
 * dan merender catatan tidak tersedia.
 */

interface PrivacySettingsResponse {
  relationshipSteps: number;
  relationshipMode: string;
  posthumousYears: number;
}

async function fetchSettings(treeId: string): Promise<PrivacySettingsResponse> {
  const res = await fetch(`/api/v1/trees/${encodeURIComponent(treeId)}/privacy-settings`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PrivacySettingsResponse;
}

async function putSettings(treeId: string, body: Partial<FamilyPrivacySettingsValue>): Promise<PrivacySettingsResponse> {
  const res = await fetch(`/api/v1/trees/${encodeURIComponent(treeId)}/privacy-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { errors?: string[] } | null;
    const err = new Error(`HTTP ${res.status}`) as Error & { serverErrors?: string[] };
    err.serverErrors = payload?.errors ?? [];
    throw err;
  }
  return (await res.json()) as PrivacySettingsResponse;
}

export const RelationshipPrivacyPanel: React.FC<{ treeId: string; treeRole: string }> = ({
  treeId,
  treeRole,
}) => {
  const { t } = useTranslation();
  const canManage = treeRole === 'owner' || treeRole === 'editor';

  const [settings, setSettings] = useState<PrivacySettingsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [steps, setSteps] = useState<string>('2');
  const [mode, setMode] = useState<string>('redact-full');
  const [posthumous, setPosthumous] = useState<string>('30');
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchSettings(treeId);
      setSettings(data);
      setSteps(String(data.relationshipSteps));
      setMode(data.relationshipMode);
      setPosthumous(String(data.posthumousYears));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setIsLoading(false);
    }
  }, [treeId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchSettings(treeId);
        if (cancelled) return;
        setSettings(data);
        setSteps(String(data.relationshipSteps));
        setMode(data.relationshipMode);
        setPosthumous(String(data.posthumousYears));
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
  }, [treeId]);

  if (!canManage) {
    return null;
  }

  const handleSave = async (): Promise<void> => {
    // Guard submit ganda: saat saving, abaikan klik berikutnya.
    if (saving) return;
    const nSteps = Number(steps);
    const nPosthumous = Number(posthumous);
    const errSteps = validateRelationshipSteps(nSteps);
    const errMode = validateRelationshipMode(mode);
    const errPosthumous = validatePosthumousYears(nPosthumous);
    const firstErr = errSteps ?? errMode ?? errPosthumous;
    if (firstErr) {
      setErrorKey(firstErr);
      setSaveFailed(true);
      return;
    }
    setSaving(true);
    setSaveFailed(false);
    setErrorKey(null);
    try {
      const updated = await putSettings(treeId, {
        relationshipSteps: nSteps,
        relationshipMode: mode as FamilyPrivacySettingsValue['relationshipMode'],
        posthumousYears: nPosthumous,
      });
      setSettings(updated);
      setSaveFailed(false);
    } catch (e) {
      const serverErrors = (e as Error & { serverErrors?: string[] }).serverErrors ?? [];
      setErrorKey(serverErrors[0] ?? 'relationshipPrivacy.error.saveFailed');
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  // Backend check lewat hasil fetch: endpoint /api/v1 hanya ada di
  // server REST; adapter tanpa backend membuat fetch gagal dan panel
  // menampilkan loadFailed dengan retry (jujur per keadaan, tanpa
  // menebak jenis adapter).
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mt-8" data-testid="relationship-privacy-panel">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-5 h-5 text-gray-600" />
        <h2 className="text-lg font-semibold text-gray-900">{t('relationshipPrivacy.title')}</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">{t('relationshipPrivacy.description')}</p>

      {isLoading && <p className="text-sm text-gray-500">{t('relationshipPrivacy.loading')}</p>}

      {!isLoading && loadFailed && (
        <div className="flex items-center gap-2 text-sm text-red-600">
          <AlertCircle className="w-4 h-4" />
          <span>{t('relationshipPrivacy.loadFailed')}</span>
          <button onClick={() => void load()} className="inline-flex items-center gap-1 text-green-700 hover:underline">
            <RefreshCw className="w-4 h-4" />
            {t('relationshipPrivacy.retry')}
          </button>
        </div>
      )}

      {!isLoading && !loadFailed && settings !== null && (
        <div className="space-y-4">
          <div>
            <label htmlFor="rp-steps" className="block text-sm font-medium text-gray-700 mb-1">
              {t('relationshipPrivacy.stepsLabel', { min: RELATIONSHIP_STEPS_MIN, max: RELATIONSHIP_STEPS_MAX })}
            </label>
            <input
              id="rp-steps"
              type="number"
              min={RELATIONSHIP_STEPS_MIN}
              max={RELATIONSHIP_STEPS_MAX}
              value={steps}
              onChange={(e) => setSteps(e.target.value)}
              disabled={saving}
              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{t('relationshipPrivacy.stepsHelper')}</p>
          </div>

          <div>
            <label htmlFor="rp-mode" className="block text-sm font-medium text-gray-700 mb-1">
              {t('relationshipPrivacy.modeLabel')}
            </label>
            <select
              id="rp-mode"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={saving}
              className="border border-gray-300 rounded-md px-2 py-1 text-sm"
            >
              <option value="redact-full">{t('relationshipPrivacy.modeRedactFull')}</option>
              <option value="name-only">{t('relationshipPrivacy.modeNameOnly')}</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">{t('relationshipPrivacy.modeHelper')}</p>
          </div>

          <div>
            <label htmlFor="rp-posthumous" className="block text-sm font-medium text-gray-700 mb-1">
              {t('relationshipPrivacy.posthumousLabel', { min: POSTHUMOUS_YEARS_MIN, max: POSTHUMOUS_YEARS_MAX })}
            </label>
            <input
              id="rp-posthumous"
              type="number"
              min={POSTHUMOUS_YEARS_MIN}
              max={POSTHUMOUS_YEARS_MAX}
              value={posthumous}
              onChange={(e) => setPosthumous(e.target.value)}
              disabled={saving}
              className="w-24 border border-gray-300 rounded-md px-2 py-1 text-sm"
            />
            <p className="text-xs text-gray-500 mt-1">{t('relationshipPrivacy.posthumousHelper')}</p>
          </div>

          {errorKey !== null && (
            <p className="text-sm text-red-600" role="alert">
              {t(errorKey)}
            </p>
          )}

          {saveFailed === false && settings !== null && errorKey === null && (
            <p className="text-xs text-green-700">{t('relationshipPrivacy.saved')}</p>
          )}

          <button
            onClick={() => void handleSave()}
            disabled={saving}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? t('relationshipPrivacy.saving') : t('relationshipPrivacy.save')}
          </button>
        </div>
      )}
    </div>
  );
};
