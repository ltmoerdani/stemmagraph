/**
 * Pure search-filter engine untuk daftar anggota keluarga.
 * GOAL v150-STG-SEARCH-FILTER-ENGINE fase i.
 *
 * Pencarian teks dan filter terstruktur, deterministik, tanpa efek samping,
 * tanpa import berkas lain (pola mengikuti dedup-detect.ts).
 */

export type SearchGender = 'M' | 'F' | 'X' | 'U';

/**
 * Bentuk anggota minimum yang dibutuhkan engine.
 * Field teks opsional diperlakukan sama dengan null.
 */
export interface SearchMember {
  id: string;
  name: string;
  nickname?: string | null;
  profession?: string | null;
  currentLocation?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  deathDate?: string | null;
  gender: SearchGender;
  generation: number;
}

/** Opsi filter terstruktur untuk applySearchFilter. */
export interface SearchFilterOptions {
  /** Substring tempat lahir, case-insensitive. */
  birthPlace?: string;
  /** Jenis kelamin yang harus sama persis. */
  gender?: SearchGender;
  /** Nomor generasi yang harus sama persis. */
  generation?: number;
  /** true = masih hidup (deathDate null), false = sudah meninggal. */
  isAlive?: boolean;
}

/** Mode tampilan untuk filterAndSort. */
export type SearchViewMode = 'showAlive' | 'showDeceased' | 'selectedGeneration';

/** Kolom sortir yang didukung filterAndSort. */
export type SearchSortBy = 'name' | 'birthDate' | 'generation' | 'profession' | 'currentLocation';

export type SearchSortDirection = 'asc' | 'desc';

/** Konfigurasi gabungan untuk filterAndSort. */
export interface FilterSortOptions {
  viewMode: SearchViewMode;
  sortBy: SearchSortBy;
  sortDirection: SearchSortDirection;
  /** Nomor generasi, dipakai saat viewMode 'selectedGeneration'. */
  generation?: number;
}

/**
 * Normalisasi teks untuk pencarian: lowercase dan trim.
 * Nilai null/undefined mengembalikan string kosong agar perbandingan aman.
 */
function normalizeText(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim();
}

/**
 * Status hidup diturunkan dari deathDate: null (atau kosong) berarti hidup.
 */
function isMemberAlive(member: SearchMember): boolean {
  return (member.deathDate ?? null) === null;
}

/**
 * Cek kecocokan query pada satu field teks anggota (substring, case-insensitive).
 */
function matchesField(member: SearchMember, query: string, field: keyof SearchMember): boolean {
  return normalizeText(member[field] as string | null | undefined).includes(query);
}

/**
 * Terapkan pencarian teks dan filter terstruktur pada daftar anggota.
 *
 * Query dinormalisasi (lowercase, trim) lalu dicocokkan sebagai substring
 * case-insensitive pada name, profession, currentLocation, dan nickname.
 * Query kosong (setelah trim) meloloskan semua anggota yang lolos filter opsional.
 *
 * Pure: input tidak dimutasi, output array baru, hasil deterministik.
 */
export function applySearchFilter(
  members: SearchMember[],
  query: string,
  options: SearchFilterOptions = {},
): SearchMember[] {
  const normalizedQuery = normalizeText(query);
  const normalizedBirthPlace = normalizeText(options.birthPlace);

  return members.filter((member) => {
    if (normalizedQuery !== '') {
      const textMatch =
        matchesField(member, normalizedQuery, 'name') ||
        matchesField(member, normalizedQuery, 'profession') ||
        matchesField(member, normalizedQuery, 'currentLocation') ||
        matchesField(member, normalizedQuery, 'nickname');
      if (!textMatch) {
        return false;
      }
    }

    if (normalizedBirthPlace !== '') {
      if (!normalizeText(member.birthPlace).includes(normalizedBirthPlace)) {
        return false;
      }
    }

    if (options.gender !== undefined && member.gender !== options.gender) {
      return false;
    }

    if (options.generation !== undefined && member.generation !== options.generation) {
      return false;
    }

    if (options.isAlive !== undefined && isMemberAlive(member) !== options.isAlive) {
      return false;
    }

    return true;
  });
}

/**
 * Bandingkan dua string secara leksikal deterministik (lowercase, trim).
 */
function compareString(a: string | null | undefined, b: string | null | undefined): number {
  const na = normalizeText(a);
  const nb = normalizeText(b);
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

/**
 * Bandingkan dua tanggal string (ISO) secara deterministik.
 * Nilai null diletakkan di akhir pada urutan asc.
 */
function compareDate(a: string | null | undefined, b: string | null | undefined): number {
  const na = a ?? null;
  const nb = b ?? null;
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;
  if (na < nb) return -1;
  if (na > nb) return 1;
  return 0;
}

/**
 * Filter viewMode lalu sortir dalam satu panggilan.
 *
 * viewMode:
 * - 'showAlive': hanya anggota dengan deathDate null.
 * - 'showDeceased': hanya anggota dengan deathDate terisi.
 * - 'selectedGeneration': hanya anggota dengan generation sama dengan
 *   options.generation (tanpa options.generation hasilnya kosong).
 *
 * Sortir deterministik: hasil diurutkan berdasarkan sortBy dengan arah
 * sortDirection, tie-break by id sehingga input sama selalu menghasilkan
 * urutan output sama.
 *
 * Pure: input tidak dimutasi, output array baru.
 */
export function filterAndSort(
  members: SearchMember[],
  options: FilterSortOptions,
): SearchMember[] {
  let filtered: SearchMember[];

  switch (options.viewMode) {
    case 'showAlive':
      filtered = members.filter((member) => isMemberAlive(member));
      break;
    case 'showDeceased':
      filtered = members.filter((member) => !isMemberAlive(member));
      break;
    case 'selectedGeneration':
      filtered = members.filter(
        (member) => member.generation === options.generation,
      );
      break;
  }

  const directionFactor = options.sortDirection === 'desc' ? -1 : 1;

  return [...filtered].sort((a, b) => {
    let result = 0;
    switch (options.sortBy) {
      case 'name':
        result = compareString(a.name, b.name);
        break;
      case 'profession':
        result = compareString(a.profession, b.profession);
        break;
      case 'currentLocation':
        result = compareString(a.currentLocation, b.currentLocation);
        break;
      case 'birthDate':
        result = compareDate(a.birthDate, b.birthDate);
        break;
      case 'generation':
        result = a.generation - b.generation;
        break;
    }
    if (result !== 0) {
      return result * directionFactor;
    }
    // Tie-break deterministik by id.
    return compareString(a.id, b.id);
  });
}
