/**
 * Deteksi kandidat duplikat anggota keluarga saat entri (pure, tanpa I/O).
 * Stemmagraph v388: peringatan duplikat sebelum simpan member baru.
 *
 * Membandingkan satu calon anggota dengan anggota existing dan mengembalikan
 * kandidat berpotensi duplikat dengan skor komposit 0..100 (ambang 60).
 *
 * Sinyal skor:
 * - Nama exact (raw trim): +65
 * - Nama normalized sama (lowercase, trim, spasi rapat): +60
 * - Levenshtein ternormalisasi nama (rasio >= 0.6): +0..40 (round(rasio*40))
 * - Marga sama: +20
 * - Tahun lahir sama (4 digit pertama YYYY-MM-DD): +15
 * - Rentang tahun lahir tumpang tindih (beda maks 5 tahun): +15
 * - Gender sama dan bukan U: +10
 * - Nickname sama exact/normalized: +25
 *
 * GUARDRAIL: bila satu-satunya kecocokan adalah kemiripan nama (tanpa exact,
 * tanpa normalized) pada nama pendek (panjang <= 4 karakter atau memuat token
 * inisial bertitik seperti A.) TANPA sinyal sekunder (marga sama atau tahun
 * lahir cocok/tumpang tindih), pasangan diblokir (skor 0). Token inisial
 * bertitik tidak dihitung sebagai kesamaan token penuh. Deterministik.
 */

export interface DuplicateCandidate {
  memberId: string;
  score: number;
  reasons: string[];
}

export interface CandidateInput {
  name: string;
  nickname?: string | null;
  marga?: string | null;
  birthDate?: string | null;
  gender?: string | null;
}

export interface ExistingMember {
  id: string;
  name: string;
  nickname?: string | null;
  marga?: string | null;
  birthDate?: string | null;
  gender?: string | null;
}

export const DUPLICATE_THRESHOLD = 60;

export function findDuplicateCandidates(
  candidate: CandidateInput,
  existing: ExistingMember[],
): DuplicateCandidate[] {
  const results: DuplicateCandidate[] = [];
  if (!existing || existing.length === 0) {
    return results;
  }

  for (const member of existing) {
    const { score, reasons } = scorePair(candidate, member);
    if (score >= DUPLICATE_THRESHOLD) {
      results.push({ memberId: member.id, score, reasons });
    }
  }

  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.memberId.localeCompare(b.memberId);
  });

  return results;
}

/** Normalisasi nama: trim, lowercase, spasi berlebih jadi satu. */
function normalizeName(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Token inisial bertitik, mis. A. atau B. */
function isDottedInitialToken(token: string): boolean {
  return /^[a-z]\.$/.test(token);
}

/** Nama pendek: panjang <= 4 karakter atau memuat token inisial bertitik. */
function isShortOrInitialForm(name: string): boolean {
  if (name.length <= 4) return true;
  return name.split(' ').some((token) => isDottedInitialToken(token));
}

/** Ambil 4 digit pertama dari tanggal YYYY-MM-DD; null bila tidak ada. */
function extractBirthYear(birthDate: string | null | undefined): string | null {
  if (!birthDate) return null;
  const match = birthDate.match(/^\d{4}/);
  return match ? match[0] : null;
}

/** Levenshtein distance, DP dua baris, implementasi sendiri tanpa dependency. */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const curr = new Array(b.length + 1);
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const del = curr[j - 1] + 1;
      const ins = prev[j] + 1;
      const sub = prev[j - 1] + cost;
      curr[j] = Math.min(del, ins, sub);
    }
    prev = curr;
  }

  return prev[b.length];
}

/** Rasio kemiripan 1 - jarak/panjang maksimum. */
function levenshteinRatio(a: string, b: string): number {
  if (a.length === 0 || b.length === 0) return 0;
  return 1 - levenshteinDistance(a, b) / Math.max(a.length, b.length);
}

function scorePair(
  candidate: CandidateInput,
  member: ExistingMember,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const candName = normalizeName(candidate.name);
  const memName = normalizeName(member.name);
  const hasName = candName.length > 0 && memName.length > 0;

  let hasExactName = false;
  let hasNormalizedMatch = false;
  let fuzzyPoints = 0;

  // Nama exact (raw setelah trim saja, peka kapital).
  const candRaw = (candidate.name ?? '').trim();
  const memRaw = (member.name ?? '').trim();
  if (hasName && candRaw === memRaw) {
    score += 65;
    reasons.push('EXACT_NAME');
    hasExactName = true;
  }

  // Nama normalized sama (beda kapitalisasi atau spasi).
  if (!hasExactName && hasName && candName === memName) {
    score += 60;
    reasons.push('NORMALIZED_NAME');
    hasNormalizedMatch = true;
  }

  // Levenshtein hanya bila belum exact atau normalized.
  if (!hasExactName && !hasNormalizedMatch && hasName) {
    const ratio = levenshteinRatio(candName, memName);
    if (ratio >= 0.6) {
      fuzzyPoints = Math.round(ratio * 40);
      score += fuzzyPoints;
      reasons.push('FUZZY_NAME');
    }
  }

  // Sinyal sekunder: marga sama.
  let hasSecondary = false;
  const candMarga = normalizeName(candidate.marga);
  const memMarga = normalizeName(member.marga);
  if (candMarga.length > 0 && memMarga.length > 0 && candMarga === memMarga) {
    score += 20;
    reasons.push('SAME_MARGA');
    hasSecondary = true;
  }

  // Sinyal sekunder: tahun lahir sama atau rentang tumpang tindih.
  const candYear = extractBirthYear(candidate.birthDate);
  const memYear = extractBirthYear(member.birthDate);
  if (candYear !== null && memYear !== null) {
    if (candYear === memYear) {
      score += 15;
      reasons.push('SAME_BIRTH_YEAR');
      hasSecondary = true;
    } else if (Math.abs(Number(candYear) - Number(memYear)) <= 5) {
      score += 15;
      reasons.push('BIRTH_YEAR_OVERLAP');
      hasSecondary = true;
    }
  }

  // Gender sama dan bukan U.
  const candGender = (candidate.gender ?? '').trim().toUpperCase();
  const memGender = (member.gender ?? '').trim().toUpperCase();
  if (candGender.length > 0 && candGender === memGender && candGender !== 'U') {
    score += 10;
    reasons.push('SAME_GENDER');
  }

  // Nickname sama exact/normalized.
  const candNick = normalizeName(candidate.nickname);
  const memNick = normalizeName(member.nickname);
  if (candNick.length > 0 && memNick.length > 0 && candNick === memNick) {
    score += 25;
    reasons.push('SAME_NICKNAME');
  }

  // GUARDRAIL: fuzzy saja pada nama pendek/inisial tanpa sinyal sekunder.
  const shortOrInitial = isShortOrInitialForm(candName) || isShortOrInitialForm(memName);
  if (
    fuzzyPoints > 0 &&
    !hasExactName &&
    !hasNormalizedMatch &&
    shortOrInitial &&
    !hasSecondary
  ) {
    return { score: 0, reasons: [] };
  }

  return { score: Math.min(score, 100), reasons };
}
