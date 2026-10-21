/**
 * Statistik missing event gaps (polanya wt_statistic.php baris 1114, jangkar getMissingEventGaps).
 * Pure function, tanpa I/O, tanpa Date, tanpa random, deterministik.
 */

export interface PersonRecord {
  id: string;
  birthDate: string | null;
  birthPlace: string | null;
  deathDate: string | null;
}

export interface MissingEventGapsResult {
  rows: Array<{
    event: 'BIRT' | 'DEAT';
    kind: 'event' | 'place';
    value: number;
    total: number;
  }>;
}

const ERROR_PREFIX = 'missing-event-gaps';

function isMissingText(value: string | null): boolean {
  return value === null || value.trim() === '';
}

/**
 * Hitung celah data peristiwa (kelahiran/kematian, tanggal/lokasi).
 * Rows selalu 4 baris urut tetap: BIRT-event, BIRT-place, DEAT-event, DEAT-place.
 * DEAT-place selalu value 0 karena schema tidak punya deathPlace (keputusan kontrak).
 */
export function computeMissingEventGaps(records: PersonRecord[]): MissingEventGapsResult {
  if (!Array.isArray(records)) {
    throw new Error(`${ERROR_PREFIX}: records harus array`);
  }

  let birtEventMissing = 0;
  let birtPlaceMissing = 0;
  let deatEventMissing = 0;

  for (let i = 0; i < records.length; i++) {
    const record: unknown = records[i];
    if (typeof record !== 'object' || record === null) {
      throw new Error(`${ERROR_PREFIX}: record index ${i} bukan objek`);
    }
    const entry = record as Record<string, unknown>;

    if (typeof entry.id !== 'string' || entry.id === '') {
      throw new Error(`${ERROR_PREFIX}: record index ${i} id harus string non-kosong`);
    }

    if (entry.birthDate !== null && typeof entry.birthDate !== 'string') {
      throw new Error(`${ERROR_PREFIX}: record index ${i} birthDate harus string atau null`);
    }
    if (entry.birthPlace !== null && typeof entry.birthPlace !== 'string') {
      throw new Error(`${ERROR_PREFIX}: record index ${i} birthPlace harus string atau null`);
    }
    if (entry.deathDate !== null && typeof entry.deathDate !== 'string') {
      throw new Error(`${ERROR_PREFIX}: record index ${i} deathDate harus string atau null`);
    }

    if (isMissingText(entry.birthDate)) {
      birtEventMissing++;
    }
    if (isMissingText(entry.birthPlace)) {
      birtPlaceMissing++;
    }
    if (isMissingText(entry.deathDate)) {
      deatEventMissing++;
    }
  }

  const total = records.length;

  return {
    rows: [
      { event: 'BIRT', kind: 'event', value: birtEventMissing, total },
      { event: 'BIRT', kind: 'place', value: birtPlaceMissing, total },
      { event: 'DEAT', kind: 'event', value: deatEventMissing, total },
      { event: 'DEAT', kind: 'place', value: 0, total },
    ],
  };
}
