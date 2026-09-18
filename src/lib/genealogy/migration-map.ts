/**
 * Helper pure migrasi data legacy FamilyMember ke format v116-ii.
 * Gender dinormalkan lewat normalizeGender (gender.ts), tanggal legacy
 * string diparse lewat parseGenealogicalDate (genealogical-date.ts).
 * Gagal parse menghasilkan null, phrase tetap tersimpan di struktur.
 * Modul pure: tanpa import dari server/ atau prisma.
 */

import { normalizeGender, type Gender } from './gender'
import { parseGenealogicalDate, type GenealogicalDate } from './genealogical-date'

/**
 * Petakan gender legacy ke M/F/X/U. Case insensitive,
 * input tak dikenal atau non-string kembali U.
 */
export function mapLegacyGender(input: unknown): Gender {
  if (typeof input !== 'string') return 'U'
  return normalizeGender(input)
}

/**
 * Parse birthDate legacy string ke GenealogicalDate JSON.
 * Input non-string selain null/undefined kembali null.
 */
export function birthDateToJson(input: unknown): GenealogicalDate | null {
  if (input === null || input === undefined) return null
  if (typeof input !== 'string') return null
  return parseGenealogicalDate(input)
}

/**
 * Parse deathDate legacy string ke GenealogicalDate JSON.
 * Perilaku sama dengan birthDateToJson.
 */
export function deathDateToJson(input: unknown): GenealogicalDate | null {
  if (input === null || input === undefined) return null
  if (typeof input !== 'string') return null
  return parseGenealogicalDate(input)
}

export interface LegacyMemberDates {
  id: string
  birthDate?: string | null
  deathDate?: string | null
}

export interface MigratedMemberDates {
  id: string
  birthDateGed: GenealogicalDate | null
  deathDateGed: GenealogicalDate | null
}

/**
 * Migrasi satu member: tiap panggilan menghasilkan objek baru,
 * jadi dua person beda id tidak mungkin saling menimpa (dedup safety).
 */
export function migrateMemberDates(member: LegacyMemberDates): MigratedMemberDates {
  return {
    id: member.id,
    birthDateGed: birthDateToJson(member.birthDate),
    deathDateGed: deathDateToJson(member.deathDate),
  }
}
