/**
 * Kartu read-only khusus anggota ter-redaksi name-only (fase ii).
 *
 * Kontrak v261-ii: NOL <img>, NOL photoUrl, NOL ikon gender biner, NOL tombol
 * edit. Klik maksimal membuka panel detail nama. Kartu tetap menampilkan
 * keberadaan anggota (preseden Gramps Web silhouette, konsisten desain
 * v261-i: redaksi data, bukan penghapusan entri).
 */

import React from 'react';
import { useTranslation } from 'react-i18next';

export interface RedactedMemberCardProps {
  id: string;
  name: string;
  isAlive: boolean;
  generation: number | null;
  gender: string | null;
  onSelect?: (id: string) => void;
}

export const RedactedMemberCard: React.FC<RedactedMemberCardProps> = ({
  id,
  name,
  onSelect,
}) => {
  const { t } = useTranslation(['canvas', 'common']);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      onSelect?.(id);
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3 cursor-pointer hover:border-gray-300"
      onClick={() => onSelect?.(id)}
      onKeyDown={handleKeyDown}
    >
      <div
        aria-hidden="true"
        className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium shrink-0"
      >
        {name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-gray-900 truncate">{name}</p>
        <p className="text-sm text-gray-500">{t('canvas:memberRedacted.restricted')}</p>
      </div>
    </div>
  );
};
