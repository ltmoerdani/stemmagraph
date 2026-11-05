import type { CalendarSystem } from '../genealogy/calendar-system'
import type { EventKind, GenealogicalEvent } from '../genealogy/genealogical-event'
import type {
  GenealogicalCitation,
  GenealogicalSource,
  QuayLevel,
} from '../genealogy/source-citation'
import type { FamilyMember } from '../../types/family'

/**
 * Grounding context builder (STG v420 Pilar 5, micro-1).
 *
 * Membangun konteks AI yang source-grounded dari satu anggota keluarga:
 * hanya fakta event yang tersambung ke sitasi valid yang boleh masuk
 * context, dan tiap fakta membawa referensi citation id serta source id
 * (pola SOUR/QUAY GEDCOM 7). Fakta tanpa sitasi valid dikumpulkan di
 * field unverified agar caller tahu apa yang belum terdukung sumber.
 *
 * Kontrak anti-halusinasi: fungsi ini murni deterministik (output sama
 * untuk input sama), tanpa random, tanpa timestamp, dan hanya memakai
 * type import dari modul genealogy existing sehingga tanpa runtime
 * dependency berat. Pemanggilan LLM dan API key berada di luar modul
 * ini (micro berikutnya, BYO key).
 */

/** Referensi sitasi yang menempel pada satu fakta event. */
export interface GroundingCitationRef {
  /** GenealogicalCitation.id sitasi pendukung fakta ini. */
  citationId: string
  /** GenealogicalSource.id sumber yang dirujuk sitasi. */
  sourceId: string
  /** Tingkat keyakinan QUAY GEDCOM 7 (0-3). */
  quay: QuayLevel
  /** Penunjuk halaman/lembar dalam sumber bila sitasi mencantumkan. */
  page?: string
}

/** Satu fakta event yang terdukung minimal satu sitasi valid. */
export interface GroundedEventFact {
  eventId: string
  kind: EventKind
  /** Tanggal verbatim dari event, tanpa normalisasi. */
  date: string
  place?: string
  calendarSystem: CalendarSystem
  dualDate?: string
  /** Daftar sitasi pendukung, urut sesuai urutan input citations. */
  citations: GroundingCitationRef[]
}

/** Satu fakta event yang TIDAK punya sitasi valid: dilarang masuk context. */
export interface UnverifiedEventFact {
  eventId: string
  kind: EventKind
  date: string
  place?: string
  calendarSystem: CalendarSystem
  dualDate?: string
  /** Alasan fakta tidak lolos grounding. */
  reason: 'no-valid-citation'
}

/** Konteks AI source-grounded untuk satu anggota. */
export interface GroundingContext {
  /** Identifier anggota subjek konteks (bukan klaim fakta). */
  memberId: string
  /** Hanya fakta tersambung sitasi valid, urut sesuai urutan events input. */
  events: GroundedEventFact[]
  /** Fakta tanpa sitasi valid, urut sesuai urutan events input. */
  unverified: UnverifiedEventFact[]
}

/** Masukan builder grounding context. */
export interface GroundingContextInput {
  member: FamilyMember
  events: readonly GenealogicalEvent[]
  sources: readonly GenealogicalSource[]
  citations: readonly GenealogicalCitation[]
}

function teksTerisi(value: string | undefined): boolean {
  return value !== undefined && value !== ''
}

/**
 * Sitasi valid bila: memberId cocok dengan anggota subjek, eventId
 * menunjuk event yang ada pada katalog input, eventKind cocok dengan
 * kind event tersebut, dan sourceId ada pada katalog sources. Sitasi
 * yang menunjuk sumber tak dikenal dianggap menggantung dan tidak
 * meng-grounding fakta apa pun.
 */
export function buildGroundingContext(
  input: GroundingContextInput,
): GroundingContext {
  const { member, events, sources, citations } = input

  const sourceIds = new Set(sources.map((source) => source.id))
  const eventById = new Map(events.map((event) => [event.id, event]))

  const validByEvent = new Map<string, GroundingCitationRef[]>()
  for (const citation of citations) {
    if (citation.memberId !== member.id) {
      continue
    }
    const event = eventById.get(citation.eventId)
    if (event === undefined) {
      continue
    }
    if (citation.eventKind !== event.kind) {
      continue
    }
    if (!sourceIds.has(citation.sourceId)) {
      continue
    }
    const ref: GroundingCitationRef = {
      citationId: citation.id,
      sourceId: citation.sourceId,
      quay: citation.quay,
      ...(teksTerisi(citation.page) ? { page: citation.page } : {}),
    }
    const existing = validByEvent.get(citation.eventId)
    if (existing === undefined) {
      validByEvent.set(citation.eventId, [ref])
    } else {
      existing.push(ref)
    }
  }

  const grounded: GroundedEventFact[] = []
  const unverified: UnverifiedEventFact[] = []
  for (const event of events) {
    const base = {
      eventId: event.id,
      kind: event.kind,
      date: event.date,
      ...(teksTerisi(event.place) ? { place: event.place } : {}),
      calendarSystem: event.calendarSystem,
      ...(teksTerisi(event.dualDate) ? { dualDate: event.dualDate } : {}),
    }
    const refs = validByEvent.get(event.id)
    if (refs !== undefined && refs.length > 0) {
      grounded.push({ ...base, citations: [...refs] })
    } else {
      unverified.push({ ...base, reason: 'no-valid-citation' })
    }
  }

  return { memberId: member.id, events: grounded, unverified }
}
