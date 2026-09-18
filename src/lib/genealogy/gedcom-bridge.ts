import { parseGenealogicalDate, toGedcomDateValue, roundTrip, type GenealogicalDate, type Gender } from './genealogical-date'
import { normalizeGender, toGedcomSex } from './gender'

/**
 * Bridge PURE GEDCOM untuk genealogy: tanpa import dari server/, tanpa prisma.
 */

/**
 * Ubah payload string tanggal menjadi JSON GenealogicalDate via parseGenealogicalDate.
 * Return null untuk payload tidak valid, tanpa throw.
 */
export function datePayloadFromGed(payload: string | null | undefined): GenealogicalDate | null {
  if (payload === null || payload === undefined) return null
  const text = String(payload).trim()
  if (text === '') return null
  try {
    return parseGenealogicalDate(text)
  } catch {
    return null
  }
}

/**
 * Gender ke string SEX GEDCOM 7 via normalizeGender lalu toGedcomSex.
 */
export function sexFromGender(g: Gender | string | null | undefined): string {
  return toGedcomSex(normalizeGender(g))
}

/**
 * Identitas eksak round-trip: parse -> toGedcomDateValue harus balik
 * identik dengan string input untuk tanggal eksak, FROM-TO, BET-AND,
 * ABT/CAL/EST, dan phrase utuh. Verifikasi makna via roundTrip
 * (parse hasil serialisasi harus tetap berhasil). Return null bila
 * tidak valid atau hasilnya tidak identik.
 */
export function roundTripFromGed(payload: string | null | undefined): string | null {
  if (payload === null || payload === undefined) return null
  const text = String(payload).trim()
  if (text === '') return null

  const parsed = parseGenealogicalDate(text)
  if (parsed === null) return null

  const reparsed = roundTrip(text)
  if (reparsed === null) return null

  // Phrase utuh: teks asli tersimpan apa adanya, identitas = teks itu sendiri.
  if (parsed.phrase !== undefined) {
    return parsed.phrase === text ? text : null
  }

  const value = toGedcomDateValue(parsed)
  return value === text ? value : null
}
