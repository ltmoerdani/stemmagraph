import React from 'react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../store/familyStore';

/**
 * Banner status offline (GOAL v109 slice 2): tampil hanya saat store
 * menandai offlineLoaded, artinya members dimuat dari snapshot perangkat
 * karena fetch ke adapter gagal (koneksi terputus).
 * Pure UI: tanpa props, tanpa efek samping.
 */
export const OfflineBanner: React.FC = () => {
  const { t } = useTranslation('common');
  const offlineLoaded = useFamilyStore((s) => s.offlineLoaded);

  if (!offlineLoaded) {
    return null;
  }

  return (
    <div role="status" aria-live="polite" data-testid="offline-banner">
      {t('offline.banner')}
    </div>
  );
};
