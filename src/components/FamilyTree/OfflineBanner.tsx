import React from 'react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../store/familyStore';

/**
 * Banner status offline (GOAL v109 slice 2): tampil hanya saat store
 * menandai offlineLoaded, artinya members dimuat dari snapshot perangkat
 * karena fetch ke adapter gagal (koneksi terputus).
 * GOAL v111 slice 2b: baris status reconnect tampil hanya saat status
 * 'refreshed' (data server dimuat ulang) atau 'kept' (data lokal dipertah);
 * 'idle' dan 'offline_still' tanpa baris tambahan. Tetap satu container
 * role=status agar test v109 tidak berubah.
 * Pure UI: tanpa props, tanpa efek samping.
 */
export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const offlineLoaded = useFamilyStore((s) => s.offlineLoaded);
  const reconnectStatus = useFamilyStore((s) => s.reconnectStatus);

  if (!offlineLoaded) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" data-testid="offline-banner">
      {t('offline.banner')}
      {reconnectStatus === 'refreshed' && (
        <div data-testid="offline-reconnect-status">{t('offline.reconnect.refreshed')}</div>
      )}
      {reconnectStatus === 'kept' && (
        <div data-testid="offline-reconnect-status">{t('offline.reconnect.kept')}</div>
      )}
    </div>
  );
};
