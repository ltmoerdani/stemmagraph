/**
 * Perekat antara tipe genealogis pure dan baris Prisma (v116-iii-b).
 *
 * Konvensi arah data:
 *   event/link (domain) -> row (untuk db.genealogyEvent.create /
 *   db.familyLink.create), dan sebaliknya row -> event/link.
 *
 * Semua fungsi pure: tidak ada eksekusi query, tidak ada import dari
 * server/. Serialisasi dateGed memakai JSON GenealogicalDate
 * (genealogical-date.ts); pembacaan menerima JSON tersebut dan, untuk
 * nilai teks lama yang bukan JSON, jatuh ke parseGenealogicalDate.
 */

import type { GenealogicalDate } from './genealogical-date'
import { parseGenealogicalDate } from './genealogical-date'
import { isEventType, type GenealogicalEvent } from './event-model'
import { mapPediToRelationship, type RelationshipType } from './relationship'

/** Daftar tipe RelationshipType; duplikat lokal agar file ini self-contained. */
const RELATIONSHIP_TYPES = ['BIRTH', 'ADOPTED', 'FOSTER', 'OTHER'] as const

/** Bentuk baris siap insert untuk model GenealogyEvent. */
export interface GenealogyEventRow {
  memberId: string
  type: string
  dateGed: string | null
  place: string | null
}

/**
 * Susun objek siap db.genealogyEvent.create dari event domain.
 * Tidak mengeksekusi apa pun; pemanggil yang menjalankan create.
 */
export function eventToRow(
  event: GenealogicalEvent,
  memberId: string,
): GenealogyEventRow {
  return {
    memberId,
    type: event.type,
    dateGed: event.date === null ? null : JSON.stringify(event.date),
    place: event.place,
  }
}

/**
 * Baca dateGed: JSON GenealogicalDate bila bisa diparse sebagai objek
 * ber-modifier; selain itu teks tanggal (ABT 1900, 1900, frase bebas)
 * lewat parseGenealogicalDate. Bila keduanya gagal menghasilkan tanggal
 * bermakna, kembalikan null.
 */
function readDateGed(raw: string): GenealogicalDate | null {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'modifier' in parsed &&
      typeof (parsed as { modifier: unknown }).modifier === 'string'
    ) {
      return parsed as GenealogicalDate
    }
  } catch {
    // bukan JSON: lanjut ke parser teks di bawah
  }
  return parseGenealogicalDate(raw)
}

/**
 * Bangun kembali GenealogicalEvent dari baris database.
 * type di luar daftar (bukan BIRT/DEAT/MARR) menghasilkan null;
 * dateGed null tetap sah (event tanpa tanggal).
 */
export function rowToEvent(row: {
  type: string
  dateGed: string | null
  place: string | null
}): GenealogicalEvent | null {
  if (!isEventType(row.type)) return null
  const date: GenealogicalDate | null =
    row.dateGed === null ? null : readDateGed(row.dateGed)
  return { type: row.type, date, place: row.place }
}

/** Tautan anak ke orang tua dalam bentuk domain, sebelum masuk baris. */
export interface GenealogicalLink {
  childId: string
  parentId: string
  /** Nilai PEDI mentah dari sumber (GEDCOM/CSV), apa adanya. */
  pedi: string
}

/** Bentuk baris siap insert untuk model FamilyLink. */
export interface FamilyLinkRow {
  childId: string
  parentId: string
  type: RelationshipType
}

/**
 * Susun objek siap db.familyLink.create dari tautan domain.
 * type dihitung lewat mapPediToRelationship: nilai di luar
 * BIRTH/ADOPTED/FOSTER (termasuk sealed dan varian case) menjadi OTHER.
 */
export function linkToRow(link: GenealogicalLink): FamilyLinkRow {
  return {
    childId: link.childId,
    parentId: link.parentId,
    type: mapPediToRelationship(link.pedi).type,
  }
}

/**
 * Bangun kembali tautan dari baris database.
 * type di luar daftar RelationshipType menghasilkan null.
 */
export function rowToLink(row: {
  childId: string
  parentId: string
  type: string
}): { childId: string; parentId: string; type: RelationshipType } | null {
  if (!(RELATIONSHIP_TYPES as readonly string[]).includes(row.type)) {
    return null
  }
  return {
    childId: row.childId,
    parentId: row.parentId,
    type: row.type as RelationshipType,
  }
}
