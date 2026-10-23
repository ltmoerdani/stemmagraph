/**
 * Event entity reads (v381 AC1, GOAL Wiring Pembaca Event):
 * modul PURE yang memotong (cut reads) pembacaan births-by-century
 * dan deaths-by-century dari kolom String legacy ke tabel LifeEvent.
 *
 * Latar: v380 membangun fondasi ADR 0011 (LifeEvent, LifeEventCitation,
 * modul paritas dual-read). v381 melangkah ke fase cut reads: sumber
 * kebenaran agregasi abad mulai mengalir dari EntityEventInput (baris
 * LifeEvent ringkas) bukan lagi dari kolom String.
 *
 * Kontrak:
 *   - entityBirthRecords(events): EntityEventInput[] menjadi
 *     BirthRecord[] ({ personId, birthDate }) siap masuk
 *     computeBirthsByCentury. Tanggal ISO hanya terbentuk bila
 *     dateKind EXACT lengkap tahun-bulan-hari (isoDateFromPartial);
 *     presisi parsial menjadi null sehingga masuk penghitung undated,
 *     mengikuti aturan kejujuran ADR 0011.
 *   - entityDeathRecords(events): sama, menghasilkan DeathRecord[]
 *     untuk computeDeathsByCentury.
 *   - computeBirthsByCenturyFromEvents(events): gabungan mapping
 *     plus agregasi dalam satu panggilan.
 *   - computeDeathsByCenturyFromEvents(events): idem untuk kematian.
 *
 * Tanpa mengubah signature modul stats existing, tanpa drop kolom
 * legacy (fase dual-read tetap hidup berdampingan), tanpa I/O, tanpa
 * randomness, tanpa jam sistem: murni transformasi array. subjectId
 * kosong difilter pola modul parity v380 (baris tanpa subjek tidak
 * layak dihitung).
 */

import {
  computeBirthsByCentury,
  type BirthRecord,
  type BirthsByCenturyResult,
} from './births-by-century'
import {
  computeDeathsByCentury,
  type DeathRecord,
  type DeathsByCenturyResult,
} from './deaths-by-century'
import {
  computeWeddingsByCentury,
  type WeddingRecord,
  type WeddingsByCenturyResult,
} from './weddings-by-century'
import {
  computeDivorcesByCentury,
  type DivorceRecord,
  type DivorcesByCenturyResult,
} from './divorces-by-century'
import { isoDateFromPartial, type EntityEventInput } from './event-entity-parity'

function entityIso(event: EntityEventInput): string | null {
  return isoDateFromPartial(event.dateKind, event.yearStart, event.monthStart, event.dayStart)
}

/** familyId pola parity v380: subjectId saja bila tanpa pasangan. */
function familyKeyOf(event: EntityEventInput): string {
  return event.partnerSubjectId
    ? `${event.subjectId}<${event.partnerSubjectId}>`
    : event.subjectId
}

/** EntityEventInput[] menjadi BirthRecord[] (sumber LifeEvent BIRTH). */
export function entityBirthRecords(events: readonly EntityEventInput[]): BirthRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ personId: e.subjectId, birthDate: entityIso(e) }))
}

/** EntityEventInput[] menjadi DeathRecord[] (sumber LifeEvent DEATH). */
export function entityDeathRecords(events: readonly EntityEventInput[]): DeathRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ personId: e.subjectId, deathDate: entityIso(e) }))
}

/** EntityEventInput[] menjadi WeddingRecord[] (sumber LifeEvent MARRIAGE). */
export function entityWeddingRecords(events: readonly EntityEventInput[]): WeddingRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ familyId: familyKeyOf(e), marriageDate: entityIso(e) }))
}

/** EntityEventInput[] menjadi DivorceRecord[] (sumber LifeEvent DIVORCE). */
export function entityDivorceRecords(events: readonly EntityEventInput[]): DivorceRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ familyId: familyKeyOf(e), divorceDate: entityIso(e) }))
}

/** Agregasi kelahiran per abad langsung dari baris LifeEvent ringkas. */
export function computeBirthsByCenturyFromEvents(
  events: readonly EntityEventInput[],
): BirthsByCenturyResult {
  return computeBirthsByCentury(entityBirthRecords(events))
}

/** Agregasi pernikahan per abad langsung dari baris LifeEvent ringkas. */
export function computeWeddingsByCenturyFromEvents(
  events: readonly EntityEventInput[],
): WeddingsByCenturyResult {
  return computeWeddingsByCentury(entityWeddingRecords(events))
}

/** Agregasi perceraian per abad langsung dari baris LifeEvent ringkas. */
export function computeDivorcesByCenturyFromEvents(
  events: readonly EntityEventInput[],
): DivorcesByCenturyResult {
  return computeDivorcesByCentury(entityDivorceRecords(events))
}

/** Agregasi kematian per abad langsung dari baris LifeEvent ringkas. */
export function computeDeathsByCenturyFromEvents(
  events: readonly EntityEventInput[],
): DeathsByCenturyResult {
  return computeDeathsByCentury(entityDeathRecords(events))
}
