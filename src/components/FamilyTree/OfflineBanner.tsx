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
 * GOAL v112 slice 3: baris badge outbox saat ada perubahan lokal menunggu
 * kirim, tombol buka dialog konfirmasi, dan baris status hasil flush.
 * Pure UI: tanpa props, tanpa efek samping.
 */
export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const offlineLoaded = useFamilyStore((s) => s.offlineLoaded);
  const reconnectStatus = useFamilyStore((s) => s.reconnectStatus);
  const outboxPendingCount = useFamilyStore((s) => s.outboxPendingCount);
  const outboxStatus = useFamilyStore((s) => s.outboxStatus);
  const setOutboxConfirmOpen = useFamilyStore((s) => s.setOutboxConfirmOpen);

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
      {outboxPendingCount > 0 && (
        <div data-testid="offline-outbox-badge">
          {t('offline.outbox.pending', { count: outboxPendingCount })}
          <button
            type="button"
            data-testid="offline-outbox-flush"
            onClick={() => setOutboxConfirmOpen(true)}
          >
            {t('offline.outbox.send')}
          </button>
        </div>
      )}
      {outboxStatus === 'flushed' && (
        <div data-testid="offline-outbox-status">{t('offline.outbox.flushed')}</div>
      )}
      {outboxStatus === 'failed' && (
        <div data-testid="offline-outbox-status">{t('offline.outbox.failed')}</div>
      )}
    </div>
  );
};
