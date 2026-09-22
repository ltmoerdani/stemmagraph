import { describe, expect, it } from 'vitest'
import {
  buildTextDateBackfillPlan,
  genealogicalDateToPartialDateColumns,
} from './textdate-backfill'
import type { BackfillMemberInput } from './backfillPlan'

function member(overrides: Partial<BackfillMemberInput> = {}): BackfillMemberInput {
  return {
    id: 'm1',
    treeId: 't1',
    name: 'Surya Atmaja',
    birthDate: '',
    deathDate: null,
    ...overrides,
  }
}

describe('genealogicalDateToPartialDateColumns: pemetaan modifier', () => {
  it('exact -> EXACT dengan yearStart', () => {
    expect(
      genealogicalDateToPartialDateColumns({ modifier: 'exact', year: 1945 }),
    ).toEqual({
      dateKind: 'EXACT',
      yearStart: 1945,
      monthStart: null,
      dayStart: null,
      yearEnd: null,
      monthEnd: null,
      dayEnd: null,
      originalDateString: '1945',
    })
  })

  it('about dengan year -> ABOUT', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'about',
      year: 1910,
    })
    expect(r.dateKind).toBe('ABOUT')
    expect(r.yearStart).toBe(1910)
    expect(r.yearEnd).toBeNull()
  })

  it('calculated -> ABOUT dengan yearStart', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'calculated',
      year: 1900,
    })
    expect(r.dateKind).toBe('ABOUT')
    expect(r.yearStart).toBe(1900)
  })

  it('estimated -> ABOUT dengan yearStart', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'estimated',
      year: 1930,
    })
    expect(r.dateKind).toBe('ABOUT')
    expect(r.yearStart).toBe(1930)
  })

  it('from tunggal -> AFTER dengan yearStart', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'from',
      year: 1945,
    })
    expect(r.dateKind).toBe('AFTER')
    expect(r.yearStart).toBe(1945)
    expect(r.yearEnd).toBeNull()
  })

  it('to tunggal -> BEFORE dengan yearStart', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'to',
      year: 1902,
    })
    expect(r.dateKind).toBe('BEFORE')
    expect(r.yearStart).toBe(1902)
    expect(r.yearEnd).toBeNull()
  })

  it('range -> RANGE dengan yearStart dan yearEnd', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'range',
      year: 1940,
      year2: 1945,
    })
    expect(r.dateKind).toBe('RANGE')
    expect(r.yearStart).toBe(1940)
    expect(r.yearEnd).toBe(1945)
  })

  it('phrase tanpa year -> ABOUT, semua kolom angka null, originalDateString phrase', () => {
    const r = genealogicalDateToPartialDateColumns({
      modifier: 'about',
      phrase: 'hidup masa kolonial',
    })
    expect(r.dateKind).toBe('ABOUT')
    expect(r.yearStart).toBeNull()
    expect(r.monthStart).toBeNull()
    expect(r.dayStart).toBeNull()
    expect(r.yearEnd).toBeNull()
    expect(r.monthEnd).toBeNull()
    expect(r.dayEnd).toBeNull()
    expect(r.originalDateString).toBe('hidup masa kolonial')
  })
})

describe('buildTextDateBackfillPlan: aksi, skip, dan determinisme', () => {
  it("exact '1945' di slot BIRTH jadi action EXACT", () => {
    const plan = buildTextDateBackfillPlan([member({ birthDate: '1945' })])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]?.eventType).toBe('BIRTH')
    expect(plan.actions[0]?.date.dateKind).toBe('EXACT')
    expect(plan.actions[0]?.date.yearStart).toBe(1945)
    expect(plan.skips).toHaveLength(1)
    expect(plan.skips[0]?.eventType).toBe('DEATH')
    expect(plan.skips[0]?.reason).toBe('empty-source')
  })

  it('exact dengan phrase: originalDateString verbatim teks sumber', () => {
    const plan = buildTextDateBackfillPlan([
      member({ birthDate: '12 MAR 1945' }),
    ])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]?.date.originalDateString).toBe('12 MAR 1945')
    expect(plan.actions[0]?.date.dateKind).toBe('EXACT')
  })

  it('range BET-AND di slot DEATH jadi action RANGE', () => {
    const plan = buildTextDateBackfillPlan([
      member({ birthDate: '1910', deathDate: 'BET 1940 AND 1945' }),
    ])
    expect(plan.actions).toHaveLength(2)
    const death = plan.actions.find((a) => a.eventType === 'DEATH')
    expect(death?.date.dateKind).toBe('RANGE')
    expect(death?.date.yearStart).toBe(1940)
    expect(death?.date.yearEnd).toBe(1945)
    expect(plan.skips).toHaveLength(0)
  })

  it('tanggal tak terurai (whitespace saja) jadi skip, bukan action', () => {
    const plan = buildTextDateBackfillPlan([
      member({ birthDate: '   ' }),
    ])
    expect(plan.actions).toHaveLength(0)
    expect(plan.skips).toHaveLength(2)
    expect(plan.skips.every((s) => s.reason === 'empty-source')).toBe(true)
  })

  it("string kosong '' jadi skip tanpa error", () => {
    const plan = buildTextDateBackfillPlan([member({ deathDate: '' })])
    const deathSkips = plan.skips.filter((s) => s.eventType === 'DEATH')
    expect(deathSkips).toHaveLength(1)
    expect(deathSkips[0]?.reason).toBe('empty-source')
  })

  it('slot DEATH null aman dan masuk skips', () => {
    const plan = buildTextDateBackfillPlan([member({ birthDate: '1850' })])
    const deathSkips = plan.skips.filter((s) => s.eventType === 'DEATH')
    expect(deathSkips).toHaveLength(1)
    expect(deathSkips[0]?.memberId).toBe('m1')
    expect(deathSkips[0]?.reason).toBe('empty-source')
  })

  it('campuran actions dan skips deterministik mengikuti urutan input', () => {
    const plan = buildTextDateBackfillPlan([
      member({
        id: 'a',
        name: 'Anggota A',
        birthDate: 'ABT 1880',
        deathDate: 'AFT 1950',
      }),
      member({
        id: 'b',
        name: 'Anggota B',
        birthDate: '',
        deathDate: 'BEF 1920',
      }),
    ])

    expect(plan.actions.map((a) => [a.memberId, a.eventType])).toEqual([
      ['a', 'BIRTH'],
      ['a', 'DEATH'],
      ['b', 'DEATH'],
    ])
    expect(plan.actions[0]?.date).toMatchObject({
      dateKind: 'ABOUT',
      yearStart: 1880,
    })
    expect(plan.actions[1]?.date).toMatchObject({
      dateKind: 'AFTER',
      yearStart: 1950,
    })
    expect(plan.actions[2]?.date).toMatchObject({
      dateKind: 'BEFORE',
      yearStart: 1920,
    })
    expect(plan.skips).toEqual([
      {
        memberId: 'b',
        memberName: 'Anggota B',
        eventType: 'BIRTH',
        reason: 'empty-source',
      },
    ])
  })
})
