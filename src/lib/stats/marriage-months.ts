/**
 * Marriage months (v283 fase i): modul PURE untuk komputasi distribusi bulan
 * pernikahan pertama per orang, pilar 2 VISION-stemmagraph.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan.
 *
 * Semantik (kontrak kukuh v283, 18 Okt 2026, jangkar webtrees
 * countFirstMarriagesByMonth):
 *   Pasangan sah bila monthStart integer 1 sampai 12, apa pun dateKind.
 *   Non-EXACT (ABT, EST, RANGE) dengan bulan terisi TETAP masuk; ini beda
 *   sengaja dari v280 yang mensyaratkan EXACT, konsisten jangkar webtrees
 *   d_julianday2. Tahun-only (monthStart null) gugur filter.
 *   Kandidat sah diurut deterministik: yearStart asc, monthStart asc,
 *   dayStart asc dengan null dianggap 0, tie pairId ascending.
 *   Greedy dedup per orang: pasangan masuk hitungan hanya bila spouseAId
 *   DAN spouseBId keduanya belum pernah menjadi anggota pasangan yang
 *   sudah masuk hitungan lebih awal (seen array diisi saat pasangan
 *   diterima, semantik jangkar webtrees).
 *   marriageCount = banyak pasangan masuk; excludedCount = banyak pasangan
 *   gugur filter bulan. Pasangan sah yang gugur karena dedup tidak masuk
 *   excludedCount.
 *
 * Deterministik: urutan input tidak mengubah hasil.
 */

export interface MarriagePairInput {
  pairId: string;
  spouseAId: string;
  spouseBId: string;
  dateKind: string;
  yearStart: number | null;
  monthStart: number | null;
  dayStart: number | null;
}

export interface MarriageMonthsResult {
  countsByMonth: Record<string, number>;
  marriageCount: number;
  excludedCount: number;
}

/** Kode bulan GEDCOM urut Januari sampai Desember; kunci output tetap 12. */
const MONTH_CODES = [
  'JAN',
  'FEB',
  'MAR',
  'APR',
  'MAY',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OCT',
  'NOV',
  'DEC',
] as const;

/** Nilai urut komponen tanggal: null dianggap 0 (paling awal). */
function datePart(v: number | null): number {
  return v === null ? 0 : v;
}

/** Sah bila monthStart integer di rentang 1 sampai 12. */
function isValidMonth(p: MarriagePairInput): boolean {
  return (
    p.monthStart !== null &&
    Number.isInteger(p.monthStart) &&
    p.monthStart >= 1 &&
    p.monthStart <= 12
  );
}

export function computeMarriageMonths(
  pairs: MarriagePairInput[]
): MarriageMonthsResult {
  const countsByMonth: Record<string, number> = {};
  for (const code of MONTH_CODES) {
    countsByMonth[code] = 0;
  }

  const valid = pairs.filter((p) => isValidMonth(p));
  const excludedCount = pairs.length - valid.length;

  // Urutan kanonik kandidat sah; tie terakhir pairId ascending.
  const sorted = [...valid].sort((a, b) => {
    const ya = datePart(a.yearStart);
    const yb = datePart(b.yearStart);
    if (ya !== yb) {
      return ya - yb;
    }
    const ma = datePart(a.monthStart as number);
    const mb = datePart(b.monthStart as number);
    if (ma !== mb) {
      return ma - mb;
    }
    const da = datePart(a.dayStart);
    const db = datePart(b.dayStart);
    if (da !== db) {
      return da - db;
    }
    if (a.pairId !== b.pairId) {
      return a.pairId < b.pairId ? -1 : 1;
    }
    return 0;
  });

  // Greedy dedup: sekali orang terhitung menikah, ia tidak masuk pasangan lain.
  const seen = new Set<string>();
  let marriageCount = 0;
  for (const p of sorted) {
    if (seen.has(p.spouseAId) || seen.has(p.spouseBId)) {
      continue;
    }
    seen.add(p.spouseAId);
    seen.add(p.spouseBId);
    const monthIndex = (p.monthStart as number) - 1;
    countsByMonth[MONTH_CODES[monthIndex]] += 1;
    marriageCount += 1;
  }

  return { countsByMonth, marriageCount, excludedCount };
}
