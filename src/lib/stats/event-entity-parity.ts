/**
 * Paritas dual-read event entity (v380, ADR 0011 fase dual-read):
 * modul PURE yang membandingkan agregasi kolom String legacy dengan
 * agregasi LifeEvent untuk empat modul abad: births-by-century,
 * deaths-by-century, weddings-by-century, dan divorces-by-century.
 *
 * Latar: sumber kebenaran lama adalah kolom String di FamilyMember
 * (birthDate, deathDate) dan tanggal di agregat keluarga; sumber
 * kebenaran baru adalah tabel LifeEvent dengan PartialDate. Selama
 * fase dual-read keduanya hidup berdampingan; gerbang cutover (AC6
 * v380) menuntut angka kedua sumber identik.
 *
 * Kontrak:
 *   - Legacy side: records persis bentuk input modul stats existing
 *     ({ personId, birthDate }, { personId, deathDate },
 *     { familyId, marriageDate }, { familyId, divorceDate }).
 *   - Entity side: baris LifeEvent ringkas EntityEventInput
 *     (subjectId, partnerSubjectId, dan komponen PartialDate). Tanggal
 *     ISO hanya terbentuk bila dateKind EXACT lengkap tahun-bulan-hari;
 *     presisi parsial dibiarkan jadi null (undated), mengikuti aturan
 *     kejujuran ADR 0011: persisi tersimpan tidak pernah lebih tegas
 *     daripada sumbernya.
 *   - Perbandingan memakai compute*ByCentury existing apa adanya;
 *     modul ini TIDAK mengubah signature modul stats mana pun.
 *
 * Output per modul: hasil legacy, hasil entity, daftar selisih, dan
 * match. Deterministik: nihil randomness, nihil jam sistem, nihil I/O.
 */

import {
  computeBirthsByCentury,
  type BirthRecord,
} from './births-by-century'
import {
  computeDeathsByCentury,
  type DeathRecord,
} from './deaths-by-century'
import {
  computeWeddingsByCentury,
  type WeddingRecord,
} from './weddings-by-century'
import {
  computeDivorcesByCentury,
  type DivorceRecord,
} from './divorces-by-century'

/** Baris LifeEvent ringkas yang dibutuhkan perencana paritas. */
export interface EntityEventInput {
  /** personId untuk BIRTH/DEATH; familyId untuk MARRIAGE/DIVORCE. */
  subjectId: string
  /** Pasangan untuk MARRIAGE/DIVORCE; null atau tidak diisi untuk lainnya. */
  partnerSubjectId?: string | null
  /** dateKind dari PartialDate; null berarti event tanpa tanggal. */
  dateKind: string | null
  yearStart: number | null
  monthStart: number | null
  dayStart: number | null
}

/** Hasil perbandingan satu modul abad. */
export interface CenturyParityResult {
  match: boolean
  diffs: string[]
}

/**
 * ISO YYYY-MM-DD dari komponen PartialDate, hanya bila dateKind EXACT
 * dan ketiga komponen lengkap. Selain itu null (masuk undated).
 */
export function isoDateFromPartial(
  dateKind: string | null,
  yearStart: number | null,
  monthStart: number | null,
  dayStart: number | null,
): string | null {
  if (dateKind !== 'EXACT') return null
  if (yearStart === null || monthStart === null || dayStart === null) return null
  const mm = String(monthStart).padStart(2, '0')
  const dd = String(dayStart).padStart(2, '0')
  return `${String(yearStart).padStart(4, '0')}-${mm}-${dd}`
}

function entityIso(event: EntityEventInput): string | null {
  return isoDateFromPartial(event.dateKind, event.yearStart, event.monthStart, event.dayStart)
}

function familyKeyOf(event: EntityEventInput): string {
  return event.partnerSubjectId
    ? `${event.subjectId}<${event.partnerSubjectId}>`
    : event.subjectId
}

/** Dedup subject duplikat tidak dilakukan: setiap baris dihitung, konsisten kontrak modul stats. */
function birthsEntityRecords(events: readonly EntityEventInput[]): BirthRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ personId: e.subjectId, birthDate: entityIso(e) }))
}

function deathsEntityRecords(events: readonly EntityEventInput[]): DeathRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ personId: e.subjectId, deathDate: entityIso(e) }))
}

function weddingsEntityRecords(events: readonly EntityEventInput[]): WeddingRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ familyId: familyKeyOf(e), marriageDate: entityIso(e) }))
}

function divorcesEntityRecords(events: readonly EntityEventInput[]): DivorceRecord[] {
  return events
    .filter((e) => e.subjectId !== '')
    .map((e) => ({ familyId: familyKeyOf(e), divorceDate: entityIso(e) }))
}

type CenturyRow = { century: string; count: number }

function diffCenturies(label: string, legacyRows: CenturyRow[], entityRows: CenturyRow[]): string[] {
  const diffs: string[] = []
  const max = Math.max(legacyRows.length, entityRows.length)
  for (let i = 0; i < max; i += 1) {
    const l = legacyRows[i]
    const e = entityRows[i]
    if (!l || !e || l.century !== e.century || l.count !== e.count) {
      diffs.push(`${label} abad index ${i}: legacy ${JSON.stringify(l ?? null)} vs entity ${JSON.stringify(e ?? null)}`)
    }
  }
  return diffs
}

function finish(label: string, diffs: string[]): CenturyParityResult {
  return { match: diffs.length === 0, diffs: diffs.map((d) => `${label}: ${d}`) }
}

/** Paritas kelahiran per abad: kolom String legacy vs LifeEvent BIRTH. */
export function compareBirthsCenturyParity(
  legacyRecords: readonly BirthRecord[],
  entityEvents: readonly EntityEventInput[],
): CenturyParityResult {
  const legacy = computeBirthsByCentury(legacyRecords)
  const entity = computeBirthsByCentury(birthsEntityRecords(entityEvents))
  const diffs = diffCenturies('births', legacy.centuries, entity.centuries)
  if (legacy.total !== entity.total) diffs.push(`births total legacy ${legacy.total} vs entity ${entity.total}`)
  if (legacy.undated !== entity.undated) diffs.push(`births undated legacy ${legacy.undated} vs entity ${entity.undated}`)
  return finish('births-by-century', diffs)
}

/** Paritas kematian per abad: kolom String legacy vs LifeEvent DEATH. */
export function compareDeathsCenturyParity(
  legacyRecords: readonly DeathRecord[],
  entityEvents: readonly EntityEventInput[],
): CenturyParityResult {
  const legacy = computeDeathsByCentury(legacyRecords)
  const entity = computeDeathsByCentury(deathsEntityRecords(entityEvents))
  const diffs = diffCenturies('deaths', legacy.centuries, entity.centuries)
  if (legacy.total !== entity.total) diffs.push(`deaths total legacy ${legacy.total} vs entity ${entity.total}`)
  if (legacy.undated !== entity.undated) diffs.push(`deaths undated legacy ${legacy.undated} vs entity ${entity.undated}`)
  return finish('deaths-by-century', diffs)
}

/** Paritas pernikahan per abad: agregat keluarga legacy vs LifeEvent MARRIAGE. */
export function compareWeddingsCenturyParity(
  legacyRecords: readonly WeddingRecord[],
  entityEvents: readonly EntityEventInput[],
): CenturyParityResult {
  const legacy = computeWeddingsByCentury(legacyRecords)
  const entity = computeWeddingsByCentury(weddingsEntityRecords(entityEvents))
  const diffs = diffCenturies('weddings', legacy.centuries, entity.centuries)
  if (legacy.total !== entity.total) diffs.push(`weddings total legacy ${legacy.total} vs entity ${entity.total}`)
  if (legacy.undated !== entity.undated) diffs.push(`weddings undated legacy ${legacy.undated} vs entity ${entity.undated}`)
  return finish('weddings-by-century', diffs)
}

/** Paritas perceraian per abad: agregat keluarga legacy vs LifeEvent DIVORCE. */
export function compareDivorcesCenturyParity(
  legacyRecords: readonly DivorceRecord[],
  entityEvents: readonly EntityEventInput[],
): CenturyParityResult {
  const legacy = computeDivorcesByCentury(legacyRecords)
  const entity = computeDivorcesByCentury(divorcesEntityRecords(entityEvents))
  const diffs = diffCenturies('divorces', legacy.centuries, entity.centuries)
  if (legacy.total !== entity.total) diffs.push(`divorces total legacy ${legacy.total} vs entity ${entity.total}`)
  if (legacy.undated !== entity.undated) diffs.push(`divorces undated legacy ${legacy.undated} vs entity ${entity.undated}`)
  return finish('divorces-by-century', diffs)
}
