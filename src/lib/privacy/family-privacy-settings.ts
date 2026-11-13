/**
 * v445 fase 2: pengaturan relasi-privasi per keluarga plus privasi
 * pasca-kematian. Modul PURE: tanpa import eksternal, tanpa efek
 * samping, mudah dites.
 *
 * Dua pengaturan terpisah yang tidak saling menimpa:
 * - relationshipSteps: N langkah jarak kekerabatan (1..12, default 2)
 *   yang dipakai enforcement baca fase 1 menggantikan konstanta
 *   DEFAULT_RELATIONSHIP_DISTANCE_LIMIT.
 * - posthumousYears: N tahun pasca-kematian (0..100, default 30);
 *   anggota meninggal lewat batas ini terbaca penuh, di bawahnya
 *   tetap mengikuti aturan living-rule fase 1.
 *
 * relationshipMode: "redact-full" (redaksi penuh detail di luar
 * jangkauan, fallback fase 1) ATAU "name-only" (nama saja). Mode
 * menentukan payload respons jalur di luar batas jarak.
 */

/** N langkah default, sama dengan DEFAULT_RELATIONSHIP_DISTANCE_LIMIT fase 1. */
export const DEFAULT_RELATIONSHIP_STEPS = 2

/** Rentang valid N langkah (inklusif). */
export const RELATIONSHIP_STEPS_MIN = 1
export const RELATIONSHIP_STEPS_MAX = 12

/** N tahun pasca-kematian default dan rentang validnya (inklusif). */
export const DEFAULT_POSTHUMOUS_YEARS = 30
export const POSTHUMOUS_YEARS_MIN = 0
export const POSTHUMOUS_YEARS_MAX = 100

export type RelationshipPrivacyMode = 'redact-full' | 'name-only'

export const RELATIONSHIP_MODES: RelationshipPrivacyMode[] = ['redact-full', 'name-only']

/** Bentuk pengaturan yang dipakai enforcement dan UI. */
export interface FamilyPrivacySettingsValue {
  relationshipSteps: number
  relationshipMode: RelationshipPrivacyMode
  posthumousYears: number
}

/** Pengaturan default bila keluarga belum punya baris. */
export function defaultFamilyPrivacySettings(): FamilyPrivacySettingsValue {
  return {
    relationshipSteps: DEFAULT_RELATIONSHIP_STEPS,
    relationshipMode: 'redact-full',
    posthumousYears: DEFAULT_POSTHUMOUS_YEARS,
  }
}

/**
 * Validasi N langkah. Return null bila valid, else pesan kunci i18n.
 * Pesan dikembalikan sebagai kode sehingga UI memilih bahasa.
 */
export function validateRelationshipSteps(raw: unknown): string | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return 'relationshipPrivacy.error.invalidNumber'
  }
  if (raw < RELATIONSHIP_STEPS_MIN || raw > RELATIONSHIP_STEPS_MAX) {
    return 'relationshipPrivacy.error.stepsOutOfRange'
  }
  return null
}

/**
 * Validasi N tahun pasca-kematian. Return null bila valid, else kode i18n.
 */
export function validatePosthumousYears(raw: unknown): string | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) {
    return 'relationshipPrivacy.error.invalidNumber'
  }
  if (raw < POSTHUMOUS_YEARS_MIN || raw > POSTHUMOUS_YEARS_MAX) {
    return 'relationshipPrivacy.error.posthumousOutOfRange'
  }
  return null
}

/** Validasi mode. Return null bila valid, else kode i18n. */
export function validateRelationshipMode(raw: unknown): string | null {
  if (typeof raw !== 'string' || !RELATIONSHIP_MODES.includes(raw as RelationshipPrivacyMode)) {
    return 'relationshipPrivacy.error.invalidMode'
  }
  return null
}

/**
 * Normalisasi body settings menjadi nilai valid atau daftar error.
 * Tanpa lempar: pemanggil memilih respons. Partial: field yang tidak
 * dikirim tidak dinormalisasi (undefined pada hasil).
 */
export interface NormalizeSettingsResult {
  value?: Partial<FamilyPrivacySettingsValue>
  errors: string[]
}

export function normalizeFamilyPrivacySettings(body: unknown): NormalizeSettingsResult {
  const errors: string[] = []
  const value: Partial<FamilyPrivacySettingsValue> = {}
  const src = (body ?? {}) as Record<string, unknown>

  if (src['relationshipSteps'] !== undefined) {
    const err = validateRelationshipSteps(src['relationshipSteps'])
    if (err) errors.push(err)
    else value.relationshipSteps = src['relationshipSteps'] as number
  }
  if (src['relationshipMode'] !== undefined) {
    const err = validateRelationshipMode(src['relationshipMode'])
    if (err) errors.push(err)
    else value.relationshipMode = src['relationshipMode'] as RelationshipPrivacyMode
  }
  if (src['posthumousYears'] !== undefined) {
    const err = validatePosthumousYears(src['posthumousYears'])
    if (err) errors.push(err)
    else value.posthumousYears = src['posthumousYears'] as number
  }

  return { value, errors }
}

/**
 * Privasi pasca-kematian, fungsi pure tanggal.
 *
 * Aturan: anggota dengan deathDate terisi terbaca PENUH setelah N tahun
 * sejak tanggal kematian. deathDate kosong berarti diperlakukan sebagai
 * living-rule (belum meninggal tercatat), kembalikan false.
 *
 * Boundary inklusif tepat N tahun: usia kematian >= N tahun dianggap
 * lewat batas (hari ultah kematian ke-N sudah lolos pada tanggal
 * perbandingan itu sendiri). Referensi waktu adalah now sebagai Date,
 * bukan jam sistem, sehingga test bisa deterministik.
 */
export function isPosthumouslyPublic(
  deathDate: string | null | undefined,
  posthumousYears: number,
  now: Date,
): boolean {
  if (!deathDate || typeof deathDate !== 'string') return false
  const parsed = new Date(`${deathDate}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) return false
  const cutoff = new Date(parsed)
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() + posthumousYears)
  return now.getTime() >= cutoff.getTime()
}
