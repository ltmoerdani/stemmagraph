/**
 * RESN level event untuk parse GEDCOM 7 (v133-i).
 *
 * GEDCOM 7 mengizinkan RESN pada level event (MARR, DEAT, dsb)
 * selain pada level record INDI/FAM (lihat notes/298 dan 299,
 * webtrees Fact.php memperlakukan RESN sebagai fakta event).
 *
 * Kontrak modul ini pure: tidak membaca DB, tidak memutar export,
 * hanya membentuk dan menormalkan nilai RESN.
 *
 * Bentuk sumber yang diterima:
 * - Objek event dengan field `resn` (string atau array string),
 *   bentuk hasil mapping struktur aplikasi.
 * - Objek payload GEDCOM dengan sub-struktur ber-tag RESN
 *   (field `sub`), bentuk mentah parser vendor gedcstruct.
 *
 * Nilai RESN pada satu baris boleh multi-nilai dipisah koma
 * (enumset, contoh fixture maximal70: "CONFIDENTIAL, LOCKED").
 */

export type ResnLevel = 'CONFIDENTIAL' | 'PRIVACY' | 'LOCKED'

export const RESN_LEVELS: readonly ResnLevel[] = [
  'CONFIDENTIAL',
  'PRIVACY',
  'LOCKED',
]

/** Sub-struktur GEDCOM minimal yang relevan untuk RESN. */
export interface ResnSubStructure {
  tag?: string
  value?: string
}

/**
 * Bentuk input event: field `resn` langsung, atau payload GEDCOM
 * dengan sub-struktur (nilai `resn` diabaikan bila keduanya ada,
 * field `resn` menang karena sudah berbentuk aplikasi).
 */
export interface EventResnInput {
  resn?: string | readonly string[] | null
  sub?: readonly ResnSubStructure[]
}

/** Bentuk input record (INDI/FAM) untuk penentuan RESN efektif. */
export type RecordResnInput = EventResnInput

/**
 * Normalisasi satu token nilai RESN.
 *
 * - CONFIDENTIAL, PRIVACY, LOCKED diterima case-insensitive
 *   dan dikembalikan dalam bentuk kanonik huruf besar.
 * - Nilai tak dikenal dipertahankan raw (hanya trim spasi),
 *   lapisan parse tidak menghakimi nilai yang belum dikenal;
 *   pemetaan ke privacyStatus tetap di src/lib/privacy/resn.ts.
 * - String kosong setelah trim mengembalikan null.
 */
export function normalizeResnToken(raw: string): string | null {
  const token = raw.trim()
  if (token === '') return null
  const upper = token.toUpperCase()
  if (upper === 'CONFIDENTIAL' || upper === 'PRIVACY' || upper === 'LOCKED') {
    return upper
  }
  return token
}

/**
 * Normalisasi satu baris nilai RESN yang mungkin multi-nilai.
 * Enumset GEDCOM 7 dipisah koma, contoh: "CONFIDENTIAL, LOCKED".
 * Token kosong akibat koma berlebih dibuang.
 */
export function normalizeResnLine(raw: string): string[] {
  return raw
    .split(',')
    .map((token) => normalizeResnToken(token))
    .filter((token): token is string => token !== null)
}

/**
 * Ekstrak nilai RESN dari struktur level event.
 *
 * - Field `resn` string dinormalkan (case-insensitive, multi-nilai
 *   koma). Field `resn` array dinormalkan per elemen.
 * - Bila field `resn` nihil, dicari sub-struktur ber-tag RESN
 *   pada payload GEDCOM (`sub`), termasuk pergeseran tag lowercase
 *   dari beberapa parser.
 * - Mengembalikan null bila event tidak membawa RESN sama sekali;
 *   kontrak nilai nihil konsisten null, bukan array kosong.
 */
export function extractEventResn(
  event: EventResnInput | null | undefined,
): string[] | null {
  if (event == null) return null

  const resn = event.resn
  if (typeof resn === 'string') {
    const dinormalkan = normalizeResnLine(resn)
    return dinormalkan.length > 0 ? dinormalkan : null
  }
  if (Array.isArray(resn)) {
    const dinormalkan = resn.flatMap((nilai) => normalizeResnLine(String(nilai)))
    return dinormalkan.length > 0 ? dinormalkan : null
  }

  const sub = event.sub
  if (Array.isArray(sub)) {
    const baris = sub.filter(
      (child) => typeof child?.tag === 'string' && child.tag.toUpperCase() === 'RESN',
    )
    const dinormalkan = baris.flatMap((child) =>
      typeof child.value === 'string' ? normalizeResnLine(child.value) : [],
    )
    return dinormalkan.length > 0 ? dinormalkan : null
  }

  return null
}

/**
 * RESN efektif suatu event: precedence RESN event level MENGUNGULI
 * RESN record level, mengikuti pola webtrees Fact.php (notes/298).
 *
 * - Event membawa RESN, apa pun isinya, menang atas record.
 * - Event nihil, RESN record dipakai.
 * - Keduanya nihil mengembalikan null (kontrak konsisten null).
 */
export function effectiveResn(
  event: EventResnInput | null | undefined,
  record: RecordResnInput | null | undefined,
): string[] | null {
  const levelEvent = extractEventResn(event)
  if (levelEvent !== null) return levelEvent
  return extractEventResn(record)
}
