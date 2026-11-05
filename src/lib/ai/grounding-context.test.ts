import { describe, expect, it } from 'vitest'

import {
  buildGroundingContext,
  type GroundingContextInput,
} from './grounding-context'
import type { CalendarSystem } from '../genealogy/calendar-system'
import type {
  EventKind,
  GenealogicalEvent,
} from '../genealogy/genealogical-event'
import type {
  GenealogicalCitation,
  GenealogicalSource,
  QuayLevel,
} from '../genealogy/source-citation'
import type { FamilyMember } from '../../types/family'

// Fixtures mengikuti type nyata di src/lib/genealogy dan src/types/family.ts.

function makeMember(id: string): FamilyMember {
  return {
    id,
    name: `Anggota ${id}`,
    gender: 'M',
    isAlive: true,
    generation: 2,
    maritalStatus: 'married',
    spouseId: 'pasangan-lain',
    spouseIds: ['pasangan-lain'],
  }
}

function makeEventInput(
  id: string,
  kind: EventKind,
  date: string,
  extra: { place?: string; dualDate?: string } = {},
): GenealogicalEvent {
  const calendar: CalendarSystem = 'GREGORIAN'
  return {
    id,
    kind,
    date,
    ...(extra.place !== undefined ? { place: extra.place } : {}),
    calendarSystem: calendar,
    ...(extra.dualDate !== undefined ? { dualDate: extra.dualDate } : {}),
  }
}

function makeSourceInput(id: string, title: string): GenealogicalSource {
  return { id, title, category: 'other' }
}

function makeCitationInput(
  id: string,
  sourceId: string,
  memberId: string,
  eventId: string,
  eventKind: EventKind,
  quay: QuayLevel,
  page?: string,
): GenealogicalCitation {
  return {
    id,
    sourceId,
    memberId,
    eventId,
    eventKind,
    quay,
    ...(page !== undefined ? { page } : {}),
  }
}

function buildFixtureInput(): {
  input: GroundingContextInput
  baseline: {
    member: FamilyMember
    events: GenealogicalEvent[]
    sources: GenealogicalSource[]
    citations: GenealogicalCitation[]
  }
} {
  const member = makeMember('m-1')
  const events: GenealogicalEvent[] = [
    makeEventInput('e-1', 'BIRT', '12 Agustus 1901', {
      place: 'Bandung',
    }),
    makeEventInput('e-2', 'MARR', '5 Juni 1925'),
    makeEventInput('e-3', 'DEAT', '3 Maret 1980', {
      place: 'Jakarta',
      dualDate: '3 Maret 1980 / 18 Maret 1980',
    }),
  ]
  const sources: GenealogicalSource[] = [
    makeSourceInput('s-1', 'Akta kelahiran No. 123'),
    makeSourceInput('s-2', 'Buku catatan keluarga'),
  ]
  const citations: GenealogicalCitation[] = [
    makeCitationInput('c-1', 's-1', 'm-1', 'e-1', 'BIRT', 3, 'hal. 2'),
    makeCitationInput('c-2', 's-2', 'm-1', 'e-1', 'BIRT', 1),
    makeCitationInput('c-3', 's-1', 'm-1', 'e-3', 'DEAT', 2),
  ]
  return {
    input: { member, events, sources, citations },
    baseline: {
      member,
      events,
      sources,
      citations,
    },
  }
}

const deepFreeze = <T,>(value: T): T => {
  if (value !== null && typeof value === 'object') {
    Object.freeze(value)
    for (const key of Object.values(value as Record<string, unknown>)) {
      deepFreeze(key as T)
    }
  }
  return value
}

describe('buildGroundingContext (v420 Pilar 5 micro-1)', () => {
  it('AC1 fakta dengan sitasi valid masuk events dengan citations urut sesuai input', () => {
    const { input } = buildFixtureInput()
    const ctx = buildGroundingContext(input)

    expect(ctx.memberId).toBe('m-1')
    expect(ctx.events).toHaveLength(2)
    expect(ctx.events[0]).toStrictEqual({
      eventId: 'e-1',
      kind: 'BIRT',
      date: '12 Agustus 1901',
      place: 'Bandung',
      calendarSystem: 'GREGORIAN',
      citations: [
        { citationId: 'c-1', sourceId: 's-1', quay: 3, page: 'hal. 2' },
        { citationId: 'c-2', sourceId: 's-2', quay: 1 },
      ],
    })
    expect(ctx.events[1]).toStrictEqual({
      eventId: 'e-3',
      kind: 'DEAT',
      date: '3 Maret 1980',
      place: 'Jakarta',
      calendarSystem: 'GREGORIAN',
      dualDate: '3 Maret 1980 / 18 Maret 1980',
      citations: [{ citationId: 'c-3', sourceId: 's-1', quay: 2 }],
    })
  })

  it('AC2 fakta tanpa sitasi valid masuk unverified dengan reason no-valid-citation', () => {
    const { input } = buildFixtureInput()
    input.citations = []
    const ctx = buildGroundingContext(input)

    expect(ctx.events).toHaveLength(0)
    expect(ctx.unverified).toHaveLength(3)
    for (const fact of ctx.unverified) {
      expect(fact.reason).toBe('no-valid-citation')
    }
    expect(ctx.unverified[0].eventId).toBe('e-1')
    expect(ctx.unverified[2].eventId).toBe('e-3')
  })

  it('AC3 sitasi yang menunjuk sumber tak dikenal tidak meng-grounding fakta', () => {
    const { input } = buildFixtureInput()
    input.citations = [
      makeCitationInput('c-x', 's-404', 'm-1', 'e-1', 'BIRT', 3),
    ]
    const ctx = buildGroundingContext(input)

    expect(ctx.events).toHaveLength(0)
    expect(ctx.unverified).toHaveLength(3)
  })

  it('AC4 sitasi memberId beda diabaikan', () => {
    const { input } = buildFixtureInput()
    input.citations = [
      makeCitationInput('c-y', 's-1', 'm-lain', 'e-1', 'BIRT', 3),
    ]
    const ctx = buildGroundingContext(input)

    expect(ctx.events).toHaveLength(0)
    expect(ctx.unverified).toHaveLength(3)
  })

  it('AC5 sitasi eventKind tidak cocok diabaikan', () => {
    const { input } = buildFixtureInput()
    input.citations = [
      makeCitationInput('c-z', 's-1', 'm-1', 'e-1', 'DEAT', 3),
    ]
    const ctx = buildGroundingContext(input)

    expect(ctx.events).toHaveLength(0)
    expect(ctx.unverified).toHaveLength(3)
  })

  it('AC6 field optional hanya muncul bila teks terisi, kosong tidak muncul', () => {
    const member = makeMember('m-2')
    const events: GenealogicalEvent[] = [
      { id: 'e-10', kind: 'BIRT', date: '1 Januari 1950', calendarSystem: 'GREGORIAN' },
    ]
    const ctx = buildGroundingContext({
      member,
      events,
      sources: [makeSourceInput('s-9', 'Sumber minimal')],
      citations: [
        makeCitationInput('c-9', 's-9', 'm-2', 'e-10', 'BIRT', 3),
      ],
    })

    expect(ctx.events).toHaveLength(1)
    expect('place' in ctx.events[0]).toBe(false)
    expect('dualDate' in ctx.events[0]).toBe(false)
    expect('page' in ctx.events[0].citations[0]).toBe(false)
  })

  it('AC7 eventId tidak ada di katalog tidak meng-grounding', () => {
    const { input } = buildFixtureInput()
    input.citations = [
      makeCitationInput('c-w', 's-1', 'm-1', 'e-404', 'BIRT', 3),
    ]
    const ctx = buildGroundingContext(input)

    expect(ctx.events).toHaveLength(0)
    expect(ctx.unverified).toHaveLength(3)
  })

  it('AC8 deterministik: dua pemanggilan input sama hasil sama persis, urutan events input terjaga', () => {
    const { input } = buildFixtureInput()
    const a = buildGroundingContext(input)
    const b = buildGroundingContext(input)

    expect(a).toStrictEqual(b)
    expect(a.events.map((f) => f.eventId)).toStrictEqual(['e-1', 'e-3'])
    expect(a.unverified.map((f) => f.eventId)).toStrictEqual(['e-2'])
  })

  it('AC9 input tidak dimutasi: snapshot structuredClone tetap identik pasca panggilan', () => {
    const { input, baseline } = buildFixtureInput()
    const before = structuredClone(baseline)

    buildGroundingContext(input)

    expect(structuredClone(baseline.member)).toStrictEqual(before.member)
    expect(structuredClone(baseline.events)).toStrictEqual(before.events)
    expect(structuredClone(baseline.sources)).toStrictEqual(before.sources)
    expect(structuredClone(baseline.citations)).toStrictEqual(before.citations)
  })

  it('AC10 deepFreeze input tetap jalan (implementasi tidak menulis ke input beku)', () => {
    const { input } = buildFixtureInput()
    deepFreeze(input)
    const ctx = buildGroundingContext(input)

    expect(ctx.events).toHaveLength(2)
    expect(ctx.unverified).toHaveLength(1)
  })

  it('AC11 page kosong string tidak masuk ref sitasi', () => {
    const member = makeMember('m-3')
    const events: GenealogicalEvent[] = [
      { id: 'e-20', kind: 'DEAT', date: '2 Februari 1990', calendarSystem: 'GREGORIAN' },
    ]
    const ctx = buildGroundingContext({
      member,
      events,
      sources: [makeSourceInput('s-8', 'Sumber halaman kosong')],
      citations: [
        makeCitationInput('c-8', 's-8', 'm-3', 'e-20', 'DEAT', 3, ''),
      ],
    })

    expect(ctx.events).toHaveLength(1)
    expect('page' in ctx.events[0].citations[0]).toBe(false)
  })
})
