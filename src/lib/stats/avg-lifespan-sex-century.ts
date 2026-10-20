/**
 * Rerata umur kematian per jenis kelamin per kohort abad kelahiran
 * (v322 fase i): modul PURE di atas array LifespanEntry, pilar 2
 * VISION-stemmagraph. Jangkar: wt_statistic.php baris 473
 * getAverageLifespanBySexAndCentury() dengan guard minimum sampel 10.
 *
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan:
 * murni transformasi array menjadi payload agregat.
 *
 * Dua lapis pemeriksaan dipisah tegas (pola v308 s.d. v321):
 *   1. Parser strict parseLifespanEntries LEMPAR Error dengan nama
 *      field dan indeks elemen untuk bentuk payload salah (bukan
 *      array, elemen bukan objek, sex di luar enum, tahun bukan
 *      number/null). Tidak ada silent-filter di level parser.
 *   2. Data invalid sah dihitung counter, bukan throw: tahun null,
 *      birthYear <= 0 (guard BCE), deathYear < birthYear. Umur 0
 *      (deathYear == birthYear) tetap valid.
 *
 * Filter kohort: sex 'U' atau null di-skip dari sel dan dihitung
 * excludedUnknown. Umur = deathYear - birthYear (integer tahun
 * sederhana, tanpa koreksi anniversary). Abad kohort dari tahun
 * lahir: floor(birthYear / 100) * 100, label "<start>-<start+99>".
 *
 * Guard: sel abad x sex dengan sampel di bawah MIN_SAMPLES
 * mengembalikan null, bukan rerata. Input kosong atau semua invalid
 * tetap mengembalikan payload utuh tanpa throw. Deterministik:
 * centuries urut ascending, urutan input tidak mengubah output.
 */

export const MIN_SAMPLES = 10;

export type Sex = 'M' | 'F' | 'U';

export interface LifespanEntry {
  sex: Sex | null;
  birthYear: number | null;
  deathYear: number | null;
}

export interface CenturyBucket {
  start: number;
  label: string;
}

export interface AvgLifespanPayload {
  sexes: ['F', 'M'];
  centuries: CenturyBucket[];
  matrix: (number | null)[][];
  sampleSizes: number[][];
  validLifespans: number;
  invalidLifespans: number;
  excludedUnknown: number;
}

interface SexSamples {
  f: number[];
  m: number[];
}

function isSex(value: unknown): value is Sex {
  return value === 'M' || value === 'F' || value === 'U';
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Parser strict: bentuk payload salah melempar Error dengan nama
 * field dan indeks elemen di pesan. Isi data yang valid bentuknya
 * diterima apa adanya; kelayakan angka (BCE, umur negatif) dinilai
 * di lapis compute sebagai counter invalid, bukan di sini.
 */
export function parseLifespanEntries(payload: unknown): LifespanEntry[] {
  if (!Array.isArray(payload)) {
    throw new Error(
      'parseLifespanEntries: payload harus array, diterima ' + typeof payload,
    );
  }
  return payload.map((item, index) => {
    if (item === null || typeof item !== 'object' || Array.isArray(item)) {
      throw new Error(
        'parseLifespanEntries: elemen[' + index + '] harus objek, diterima ' +
        (item === null ? 'null' : typeof item),
      );
    }
    const raw = item as Record<string, unknown>;
    if (!isSex(raw.sex) && raw.sex !== null) {
      throw new Error(
        'parseLifespanEntries: elemen[' + index + '].sex harus "M", "F", "U", atau null, diterima ' +
        JSON.stringify(raw.sex),
      );
    }
    if (raw.birthYear !== null && typeof raw.birthYear !== 'number') {
      throw new Error(
        'parseLifespanEntries: elemen[' + index + '].birthYear harus number atau null, diterima ' +
        typeof raw.birthYear,
      );
    }
    if (raw.deathYear !== null && typeof raw.deathYear !== 'number') {
      throw new Error(
        'parseLifespanEntries: elemen[' + index + '].deathYear harus number atau null, diterima ' +
        typeof raw.deathYear,
      );
    }
    return {
      sex: raw.sex as Sex | null,
      birthYear: raw.birthYear as number | null,
      deathYear: raw.deathYear as number | null,
    };
  });
}

function cellValue(samples: number[]): number | null {
  if (samples.length < MIN_SAMPLES) {
    return null;
  }
  const total = samples.reduce((acc, age) => acc + age, 0);
  return round1(total / samples.length);
}

/**
 * Hitung payload rerata umur per sex per abad kelahiran. Menerima
 * unknown supaya jalur parser strict ikut teruji dari pintu utama.
 */
export function computeAvgLifespanBySexCentury(payload: unknown): AvgLifespanPayload {
  const entries = parseLifespanEntries(payload);

  const cells = new Map<number, SexSamples>();
  let validLifespans = 0;
  let invalidLifespans = 0;
  let excludedUnknown = 0;

  for (const entry of entries) {
    if (entry.sex === 'U' || entry.sex === null) {
      excludedUnknown += 1;
      continue;
    }
    if (entry.birthYear === null || entry.deathYear === null) {
      invalidLifespans += 1;
      continue;
    }
    if (entry.birthYear <= 0) {
      invalidLifespans += 1;
      continue;
    }
    if (entry.deathYear < entry.birthYear) {
      invalidLifespans += 1;
      continue;
    }

    validLifespans += 1;
    const age = entry.deathYear - entry.birthYear;
    const start = Math.floor(entry.birthYear / 100) * 100;
    const cell = cells.get(start) ?? { f: [], m: [] };
    if (entry.sex === 'F') {
      cell.f.push(age);
    } else {
      cell.m.push(age);
    }
    cells.set(start, cell);
  }

  const starts = Array.from(cells.keys()).sort((a, b) => a - b);

  return {
    sexes: ['F', 'M'],
    centuries: starts.map((start) => ({
      start,
      label: start + '-' + (start + 99),
    })),
    matrix: starts.map((start) => {
      const cell = cells.get(start) as SexSamples;
      return [cellValue(cell.f), cellValue(cell.m)];
    }),
    sampleSizes: starts.map((start) => {
      const cell = cells.get(start) as SexSamples;
      return [cell.f.length, cell.m.length];
    }),
    validLifespans,
    invalidLifespans,
    excludedUnknown,
  };
}
