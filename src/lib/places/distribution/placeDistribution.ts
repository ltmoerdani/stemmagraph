// v399: modul agregasi murni peta sebaran tempat (Fase 1 Lokal).
// Input daftar koordinat place, output titik {lat,lng,count} murni:
// tanpa nama place, tanpa identitas anggota. Proyeksi dan render
// dilakukan di komponen UI; modul ini hanya menghitung.
// Pembulatan 2 desimal membuat sel agregasi ~1.1 km di ekuator.

export interface PlaceCoordinateInput {
  latitude: number | null;
  longitude: number | null;
}

export interface PlaceDistributionPoint {
  lat: number;
  lng: number;
  count: number;
}

export interface PlaceDistributionResult {
  points: PlaceDistributionPoint[];
  /** Jumlah place berkooordinat valid yang masuk agregasi. */
  totalPlaced: number;
  /** Jumlah place tanpa koordinat atau koordinat di luar rentang. */
  excludedNoCoords: number;
}

const ERROR_PREFIX = 'place-distribution';

/** Bulatkan ke 2 desimal; +0 menormalkan -0 agar kunci sel stabil. */
function round2(value: number): number {
  return Math.round(value * 100) / 100 + 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Koordinat valid: finite dan di dalam rentang derajat resmi. */
function isValidLat(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

function isValidLng(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function computePlaceDistribution(entries: unknown): PlaceDistributionResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX}: input harus array`);
  }

  const cells = new Map<string, PlaceDistributionPoint>();
  let totalPlaced = 0;
  let excludedNoCoords = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const entry: unknown = entries[index];
    if (!isRecord(entry)) {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} harus objek`);
    }

    const rawLat: unknown = entry.latitude;
    const rawLng: unknown = entry.longitude;
    if (rawLat !== null && typeof rawLat !== 'number') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} latitude harus number atau null`);
    }
    if (rawLng !== null && typeof rawLng !== 'number') {
      throw new Error(`${ERROR_PREFIX}: entri index ${index} longitude harus number atau null`);
    }

    const lat = rawLat as number | null;
    const lng = rawLng as number | null;

    if (
      lat === null ||
      lng === null ||
      !isValidLat(lat) ||
      !isValidLng(lng)
    ) {
      excludedNoCoords += 1;
      continue;
    }

    const rLat = round2(lat);
    const rLng = round2(lng);
    const key = `${rLat},${rLng}`;
    const existing = cells.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      cells.set(key, { lat: rLat, lng: rLng, count: 1 });
    }
    totalPlaced += 1;
  }

  // Urutan deterministik: count menurun, lalu lat naik, lalu lng naik.
  const points = [...cells.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    if (a.lat !== b.lat) return a.lat - b.lat;
    return a.lng - b.lng;
  });

  return { points, totalPlaced, excludedNoCoords };
}
