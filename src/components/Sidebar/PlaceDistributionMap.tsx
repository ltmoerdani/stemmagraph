import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { useFamilyStore } from '../../store/familyStore';
import { getStatsApi } from '../../lib/adapters';
import type { PlaceDistributionPointDto } from '../../lib/adapters/types';

// v399: peta sebaran anggota Fase 1 Lokal. Proyeksi equirectangular
// murni di SVG lokal: tanpa dependency peta, tanpa tile, tanpa request
// jaringan di atas satu fetch agregat non-PII ke route v399. Marker
// menampilkan count per sel 2 derajat hasil pembulatan server; bila
// tidak ada titik berkooordinat, section menampilkan fallback daftar
// teks singkat dan tidak menggambar peta kosong.

const MAP_W = 360;
const MAP_H = 180;

/** Proyeksi equirectangular: x = lng + 180, y = 90 - lat (derajat). */
function project(lat: number, lng: number): { x: number; y: number } {
  return { x: lng + 180, y: 90 - lat };
}

export const PlaceDistributionMap: React.FC = () => {
  const { t } = useTranslation();
  const currentFamilyTreeId = useFamilyStore((s) => s.currentFamilyTreeId);
  // Data dibawa bersama treeId asalnya (pola v398 loaded key guard):
  // render hanya bila data sudah termuat DAN masih milik tree aktif,
  // sehingga perpindahan tree tidak memflash peta lama tanpa perlu
  // setState sinkron di effect body.
  const [data, setData] = useState<{ treeId: string; points: PlaceDistributionPointDto[] } | null>(null);

  // Pola fetch persis StatsSidebar: adapter null (mock, supabase),
  // treeId kosong, fetch berjalan, atau gagal berarti section tidak
  // dirender; tanpa mock data apa pun.
  useEffect(() => {
    const api = currentFamilyTreeId ? getStatsApi() : null;
    if (!currentFamilyTreeId || !api) return;
    let cancelled = false;
    api
      .getPlaceDistribution(currentFamilyTreeId)
      .then((dto) => {
        if (cancelled) return;
        setData({ treeId: currentFamilyTreeId, points: dto.points });
      })
      .catch(() => {
        if (cancelled) return;
        setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [currentFamilyTreeId]);

  if (!data || data.treeId !== currentFamilyTreeId) return null;
  const points = data.points;

  // Fallback daftar teks: tidak ada place berkooordinat di tree ini.
  if (points.length === 0) {
    return (
      <div className="mb-8" data-testid="place-distribution-empty">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.placeDistribution.title')}</h3>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <MapPin className="w-4 h-4 text-gray-400" />
          <span>{t('stats.placeDistribution.empty')}</span>
        </div>
      </div>
    );
  }

  const maxCount = Math.max(...points.map((p) => p.count));
  const radius = (count: number): number => 3 + (count / maxCount) * 7;

  return (
    <div className="mb-8" data-testid="place-distribution-map">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('stats.placeDistribution.title')}</h3>
      <svg
        role="img"
        aria-label={t('stats.placeDistribution.title')}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full h-auto border border-gray-200 rounded bg-gray-50"
        data-testid="place-distribution-svg"
      >
        {/* Garis khatulistiwa dan meridian sebagai acuan grid equirectangular */}
        <line x1={0} y1={MAP_H / 2} x2={MAP_W} y2={MAP_H / 2} stroke="#e5e7eb" strokeWidth={0.5} />
        <line x1={MAP_W / 2} y1={0} x2={MAP_W / 2} y2={MAP_H} stroke="#e5e7eb" strokeWidth={0.5} />
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="none" stroke="#d1d5db" strokeWidth={0.5} />
        {points.map((p) => {
          const { x, y } = project(p.lat, p.lng);
          return (
            <circle
              key={`${p.lat},${p.lng}`}
              cx={x}
              cy={y}
              r={radius(p.count)}
              fill="#2563eb"
              fillOpacity={0.55}
              stroke="#1d4ed8"
              strokeWidth={0.5}
            >
              <title>{t('stats.placeDistribution.markerTitle', { count: p.count })}</title>
            </circle>
          );
        })}
      </svg>
      <div className="mt-2 text-xs text-gray-500">{t('stats.placeDistribution.legend')}</div>
    </div>
  );
};
