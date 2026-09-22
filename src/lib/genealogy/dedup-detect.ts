/**
 * Deteksi duplikat anggota keluarga (pure, tanpa I/O, tanpa import berkas lain).
 * GOAL v146-STG-DEDUP-DETECT fase i.
 *
 * Skor komposisi (0..100):
 * - Nama depan sama persis (case-insensitive, trim): +45
 * - Nama belakang sama persis (case-insensitive, trim): +35
 * - Tahun lahir sama (4 digit pertama dari string tanggal apa pun): +20
 *
 * Hanya pasangan dengan skor >= threshold (default 80) yang dikembalikan.
 * Hasil deterministik: pasangan dinormalisasi idA < idB leksikal, kandidat
 * unik per kombinasi id, daftar diurutkan berdasarkan idA lalu idB.
 */

export interface DedupCandidate {
  idA: string;
  idB: string;
  score: number;
  reasons: string[];
}

export interface DedupPersonInput {
  id: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  birthPlace?: string;
  gender?: string;
}

export interface FindDuplicatePairsOptions {
  /** Skor minimum (0..100) agar pasangan dilaporkan. Default 80. */
  threshold?: number;
}

const SCORE_SAME_FIRST_NAME = 45;
const SCORE_SAME_LAST_NAME = 35;
const SCORE_SAME_BIRTH_YEAR = 20;
const DEFAULT_THRESHOLD = 80;

export const DEDUP_REASON = {
  SAME_FIRST_NAME: 'SAME_FIRST_NAME',
  SAME_LAST_NAME: 'SAME_LAST_NAME',
  SAME_BIRTH_YEAR: 'SAME_BIRTH_YEAR',
} as const;

function normalizeName(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Ambil 4 digit pertama yang muncul pada string tanggal apa pun
 * (ISO, lokal, atau lainnya). Kembalikan null bila tidak ada.
 */
function extractBirthYear(birthDate: string | undefined): string | null {
  if (!birthDate) {
    return null;
  }
  const match = birthDate.match(/\d{4}/);
  return match ? match[0] : null;
}

/** Orang tanpa nama (nama depan dan belakang kosong) tidak dipasangkan. */
function hasAnyName(person: DedupPersonInput): boolean {
  return normalizeName(person.firstName) !== '' || normalizeName(person.lastName) !== '';
}

function compareId(x: string, y: string): number {
  if (x < y) return -1;
  if (x > y) return 1;
  return 0;
}

export function findDuplicatePairs(
  persons: DedupPersonInput[],
  options: FindDuplicatePairsOptions = {},
): DedupCandidate[] {
  const threshold = options.threshold ?? DEFAULT_THRESHOLD;
  const eligible = persons.filter(hasAnyName);
  const byPair = new Map<string, DedupCandidate>();

  for (let i = 0; i < eligible.length; i++) {
    for (let j = i + 1; j < eligible.length; j++) {
      const p = eligible[i];
      const q = eligible[j];
      if (p.id === q.id) {
        continue;
      }

      // Normalisasi pasangan: idA < idB leksikal, agar urutan input tidak berpengaruh.
      const swap = compareId(q.id, p.id) < 0;
      const first = swap ? q : p;
      const second = swap ? p : q;

      const reasons: string[] = [];
      let score = 0;

      const firstNameA = normalizeName(first.firstName);
      const firstNameB = normalizeName(second.firstName);
      if (firstNameA !== '' && firstNameA === firstNameB) {
        reasons.push(DEDUP_REASON.SAME_FIRST_NAME);
        score += SCORE_SAME_FIRST_NAME;
      }

      const lastNameA = normalizeName(first.lastName);
      const lastNameB = normalizeName(second.lastName);
      if (lastNameA !== '' && lastNameA === lastNameB) {
        reasons.push(DEDUP_REASON.SAME_LAST_NAME);
        score += SCORE_SAME_LAST_NAME;
      }

      const yearA = extractBirthYear(first.birthDate);
      const yearB = extractBirthYear(second.birthDate);
      if (yearA !== null && yearB !== null && yearA === yearB) {
        reasons.push(DEDUP_REASON.SAME_BIRTH_YEAR);
        score += SCORE_SAME_BIRTH_YEAR;
      }

      if (reasons.length > 0 && score >= threshold) {
        const key = first.id + '\u0000' + second.id;
        if (!byPair.has(key)) {
          byPair.set(key, { idA: first.id, idB: second.id, score, reasons });
        }
      }
    }
  }

  const candidates = Array.from(byPair.values());
  candidates.sort((a, b) => compareId(a.idA, b.idA) || compareId(a.idB, b.idB));
  return candidates;
}
