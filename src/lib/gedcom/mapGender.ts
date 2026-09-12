// Pemeta nilai gender lama ke nilai kanonik proyek (ADR 0011 fase 2, S1F2-B).
//
// Field FamilyMember.gender bertipe String bebas di skema; data lama berisi
// campuran Inggris, singkatan, dan Bahasa Indonesia. Nilai yang SUDAH dipakai
// proyek (src/types/family.ts: gender 'male' | 'female'; dipakai oleh
// UnifiedMemberModal, EditableMemberCard, MiniMap, ReactFlowFamilyTree,
// CanvasControls, FamilyMemberNode) adalah 'male' dan 'female'.
//
// Tabel pemetaan eksplisit (kunci lowercase, spasi tepi dan spasi ganda
// dilipat, case-insensitive):
//   male   : "male", "m", "man", "boy", "laki-laki", "laki laki", "laki",
//            "lelaki", "pria"
//   female : "female", "f", "woman", "girl", "perempuan", "wanita", "cewek"
//   unknown: seluruh nilai lain, termasuk string kosong, whitespace saja,
//            null, dan undefined
//
// Aturan tanpa memihak: input kosong/null/tak dikenal WAJIB mengembalikan
// 'unknown' (nilai eksplisit netral). Fungsi ini TIDAK PERNAH memfallback
// ke 'male' atau 'female'; menebak gender bukan bagian dari pemetaan data.
// Fungsi murni: tanpa efek samping, tanpa state, tanpa import.

/** Nilai gender kanonik hasil pemetaan. */
export type CanonicalGender = 'male' | 'female' | 'unknown'

/** Tabel pemetaan eksplisit; kunci sudah lowercase dan whitespace dilipat. */
const GENDER_MAP: Readonly<Record<string, CanonicalGender>> = {
  // Inggris penuh dan singkatan.
  male: 'male',
  m: 'male',
  man: 'male',
  boy: 'male',
  female: 'female',
  f: 'female',
  woman: 'female',
  girl: 'female',
  // Bahasa Indonesia; "laki laki" dengan spasi juga diterima.
  'laki-laki': 'male',
  'laki laki': 'male',
  laki: 'male',
  lelaki: 'male',
  pria: 'male',
  perempuan: 'female',
  wanita: 'female',
  cewek: 'female',
}

/**
 * Petakan string gender lama ke 'male' | 'female' | 'unknown'.
 * Tidak pernah melempar error dan tidak pernah mengarang jawaban:
 * nilai di luar tabel pemetaan kembali sebagai 'unknown'.
 */
export function mapGender(input: string | null | undefined): CanonicalGender {
  if (input === null || input === undefined) return 'unknown'
  const key = input.trim().replace(/\s+/g, ' ').toLowerCase()
  if (key.length === 0) return 'unknown'
  return GENDER_MAP[key] ?? 'unknown'
}
