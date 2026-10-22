/**
 * Birth interval (v359 fase i): modul PURE untuk statistik
 * demografi keluarga, pilar 2 VISION-stemmagraph. Metrik:
 * jarak antar kelahiran kandung berurutan dalam satu family
 * (sibling-to-sibling spacing), ukuran standar demografi
 * keluarga. Jangkar konsep: literatur birth spacing.
 *
 * Beda substansi dari v308 fertility-span (merged): v308
 * mengukur rentang TOTAL per family (earliest ke latest,
 * spanDays spanMonths) dan butuh minimal 2 anak untuk span
 * nonzero. v359 mengukur DISTRIBUSI jarak pasangan kelahiran
 * BERURUTAN (n-1 interval dari n anak), output histogram
 * interval ber-index bucket bulan via summarizeIntervals.
 * Dua anak dengan jarak sama menghasilkan v308 span identik
 * dengan dua pasang anak berjarak beda; v359 membedah
 * struktur internalnya.
 *
 * Definisi:
 * - Per family: childBirthDates diparse strict YYYY-MM-DD,
 *   diurut asc by serial UTC (sort stabil, tanggal duplikat
 *   sah dengan interval 0 hari, tidak dibuang). Interval i
 *   adalah pasangan berurutan (i-1, i); n anak menghasilkan
 *   n-1 interval.
 * - intervalsDays: selisih serial UTC dibulatkan (86400000).
 * - intervalsMonths: whole months pola spanWholeMonths
 *   fertility-span (anniversary reached), minimal 0.
 * - childCount < 2: intervalCount 0 dan array kosong, TIDAK
 *   throw. Family output diurut by familyId localeCompare.
 * - Deterministik: urutan output mengikuti input family,
 *   tanpa random, tanpa I/O. Date.UTC hanya untuk serial.
 * - Parsing strict: pelanggaran format, kalender, atau
 *   struktur input dilempar Error ber-index prefiks
 *   birth-interval, bukan difilter diam-diam.
 */

export interface BirthIntervalFamilyInput {
  familyId: string;
  childBirthDates: string[];
}

export interface BirthIntervalResult {
  familyId: string;
  childCount: number;
  intervalCount: number;
  intervalsDays: number[];
  intervalsMonths: number[];
}

export interface IntervalBucket {
  bucketStart: number;
  bucketEnd: number;
  count: number;
}

interface ParsedDate {
  iso: string;
  year: number;
  month: number;
  day: number;
  serial: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year: number, month: number): number {
  const lengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && isLeapYear(year)) return 29;
  return lengths[month - 1];
}

function parseStrictDate(raw: string, index: number): ParsedDate {
  if (typeof raw !== 'string' || !DATE_PATTERN.test(raw)) {
    throw new Error(`birth-interval: invalid date format at childBirthDates[${index}]: ${JSON.stringify(raw)}, expected strict YYYY-MM-DD`);
  }
  const year = Number(raw.slice(0, 4));
  const month = Number(raw.slice(5, 7));
  const day = Number(raw.slice(8, 10));
  const monthValid = month >= 1 && month <= 12;
  const dayValid = day >= 1 && day <= daysInMonth(year, month);
  if (!monthValid || !dayValid) {
    throw new Error(`birth-interval: invalid calendar date at childBirthDates[${index}]: ${raw}`);
  }
  const serial = Date.UTC(year, month - 1, day);
  return { iso: raw, year, month, day, serial };
}

function wholeMonths(earlier: ParsedDate, later: ParsedDate): number {
  const months = (later.year - earlier.year) * 12 + (later.month - earlier.month);
  const anniversaryReached = later.day >= earlier.day;
  return anniversaryReached ? months : months - 1;
}

function assertFamilyInput(families: unknown): void {
  if (!Array.isArray(families)) {
    throw new Error('birth-interval: families must be an array');
  }
  families.forEach((fam, index) => {
    if (typeof fam !== 'object' || fam === null || Array.isArray(fam)) {
      throw new Error(`birth-interval: families[${index}] must be an object`);
    }
    const rec = fam as { familyId?: unknown; childBirthDates?: unknown };
    if (typeof rec.familyId !== 'string' || rec.familyId.length === 0) {
      throw new Error(`birth-interval: families[${index}].familyId must be a non-empty string`);
    }
    if (!Array.isArray(rec.childBirthDates)) {
      throw new Error(`birth-interval: families[${index}].childBirthDates must be an array`);
    }
    rec.childBirthDates.forEach((d, di) => {
      if (typeof d !== 'string') {
        throw new Error(`birth-interval: families[${index}].childBirthDates[${di}] must be a string`);
      }
    });
  });
}

export function computeBirthIntervals(families: BirthIntervalFamilyInput[]): BirthIntervalResult[] {
  assertFamilyInput(families);

  const sortedFamilies = [...families].sort((a, b) => a.familyId.localeCompare(b.familyId));

  return sortedFamilies.map((fam) => {
    const dates = fam.childBirthDates
      .map((raw, index) => parseStrictDate(raw, index))
      .sort((a, b) => a.serial - b.serial);

    const intervalsDays: number[] = [];
    const intervalsMonths: number[] = [];
    for (let i = 1; i < dates.length; i += 1) {
      const earlier = dates[i - 1];
      const later = dates[i];
      intervalsDays.push(Math.round((later.serial - earlier.serial) / 86400000));
      intervalsMonths.push(Math.max(0, wholeMonths(earlier, later)));
    }

    return {
      familyId: fam.familyId,
      childCount: dates.length,
      intervalCount: intervalsDays.length,
      intervalsDays,
      intervalsMonths,
    };
  });
}

export function summarizeIntervals(intervalsMonths: number[], bucketSizeMonths = 12): IntervalBucket[] {
  if (typeof bucketSizeMonths !== 'number' || !Number.isInteger(bucketSizeMonths) || bucketSizeMonths < 1) {
    throw new Error(`birth-interval: bucketSizeMonths must be an integer >= 1, got ${JSON.stringify(bucketSizeMonths)}`);
  }
  if (!Array.isArray(intervalsMonths)) {
    throw new Error('birth-interval: intervalsMonths must be an array');
  }
  intervalsMonths.forEach((m, index) => {
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 0) {
      throw new Error(`birth-interval: intervalsMonths[${index}] must be a non-negative integer, got ${JSON.stringify(m)}`);
    }
  });

  const counts = new Map<number, number>();
  for (const m of intervalsMonths) {
    const bucketStart = Math.floor(m / bucketSizeMonths) * bucketSizeMonths;
    counts.set(bucketStart, (counts.get(bucketStart) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, count]) => ({
      bucketStart,
      bucketEnd: bucketStart + bucketSizeMonths - 1,
      count,
    }));
}
