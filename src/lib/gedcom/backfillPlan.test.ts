// Unit test perencana backfill murni (S1F2-B): pemisahan aksi vs skip,
// idempotensi (skip already-exists), sumber kosong, jaminan
// originalDateString verbatim, dan konversi kolom PartialDate
// termasuk RANGE. Tanpa DB sama sekali.

import { describe, expect, it } from 'vitest'
import { buildBackfillPlan, toPartialDateColumns } from './backfillPlan'
import type { BackfillMemberInput } from './backfillPlan'

function member(overrides: Partial<BackfillMemberInput> = {}): BackfillMemberInput {
  return {
    id: 'm1',
    treeId: 't1',
    name: 'Kakek Susilo',
    birthDate: '12 JAN 1900',
    deathDate: '1994',
    existingEventTypes: [],
    ...overrides,
  }
}

describe('buildBackfillPlan - aksi', () => {
  it('member lengkap tanpa event: dua aksi BIRTH dan DEATH dengan hasil parse', () => {
    const plan = buildBackfillPlan([member()])
    expect(plan.actions).toHaveLength(2)
    const birth = plan.actions.find((a) => a.eventType === 'BIRTH')
    const death = plan.actions.find((a) => a.eventType === 'DEATH')
    expect(birth?.date).toMatchObject({ dateKind: 'EXACT', year: 1900, month: 1, day: 12 })
    expect(death?.date).toMatchObject({ dateKind: 'EXACT', year: 1994 })
    expect(birth?.treeId).toBe('t1')
    expect(death?.memberId).toBe('m1')
  })

  it('hasil parse membawa originalDateString verbatim, tidak dirapikan', () => {
    const plan = buildBackfillPlan([member({ birthDate: '  abt   1900  ', deathDate: null })])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]?.eventType).toBe('BIRTH')
    expect(plan.actions[0]?.date.originalDateString).toBe('  abt   1900  ')
    expect(plan.actions[0]?.date).toMatchObject({ dateKind: 'ABOUT', year: 1900 })
  })

  it('teks tak terurai tetap jadi aksi ABOUT tanpa mengarang presisi', () => {
    const plan = buildBackfillPlan([member({ birthDate: 'zaman belanda' })])
    expect(plan.actions).toHaveLength(2)
    const birth = plan.actions.find((a) => a.eventType === 'BIRTH')
    expect(birth?.date).toMatchObject({ dateKind: 'ABOUT' })
    expect(birth?.date).not.toHaveProperty('year')
    expect(birth?.date.originalDateString).toBe('zaman belanda')
  })

  it('RENCANA RANGE: BET 1900 AND 1910 terurai dua ujung', () => {
    const plan = buildBackfillPlan([member({ deathDate: 'BET 1900 AND 1910', birthDate: '' })])
    const death = plan.actions.find((a) => a.eventType === 'DEATH')
    expect(death?.date).toMatchObject({ dateKind: 'RANGE' })
    expect(plan.actions).toHaveLength(1)
  })

  it('deterministik: input sama menghasilkan rencana sama (murni)', () => {
    const first = buildBackfillPlan([member()])
    const second = buildBackfillPlan([member()])
    expect(first).toEqual(second)
  })
})

describe('buildBackfillPlan - skip dan idempotensi', () => {
  it('member yang sudah punya BIRTH hanya mendapat aksi DEATH', () => {
    const plan = buildBackfillPlan([member({ existingEventTypes: ['BIRTH'] })])
    expect(plan.actions.map((a) => a.eventType)).toEqual(['DEATH'])
    expect(plan.skips).toEqual([
      { memberId: 'm1', memberName: 'Kakek Susilo', eventType: 'BIRTH', reason: 'already-exists' },
    ])
  })

  it('member yang sudah punya keduanya: nol aksi, dua skip already-exists', () => {
    const plan = buildBackfillPlan([member({ existingEventTypes: ['BIRTH', 'DEATH', 'MARR'] })])
    expect(plan.actions).toHaveLength(0)
    expect(plan.skips.map((s) => s.reason)).toEqual(['already-exists', 'already-exists'])
  })

  it('birthDate string kosong: skip empty-source, tidak mengarang event', () => {
    const plan = buildBackfillPlan([member({ birthDate: '' })])
    expect(plan.actions.map((a) => a.eventType)).toEqual(['DEATH'])
    expect(plan.skips).toEqual([
      { memberId: 'm1', memberName: 'Kakek Susilo', eventType: 'BIRTH', reason: 'empty-source' },
    ])
  })

  it('deathDate null dan whitespace: keduanya skip empty-source', () => {
    const plan = buildBackfillPlan([
      member({ deathDate: null }),
      member({ id: 'm2', name: 'Nenek Wati', deathDate: '   ' }),
    ])
    expect(plan.actions.map((a) => a.eventType)).toEqual(['BIRTH', 'BIRTH'])
    const skips = plan.skips.filter((s) => s.eventType === 'DEATH')
    expect(skips).toHaveLength(2)
    expect(skips.every((s) => s.reason === 'empty-source')).toBe(true)
  })
})

describe('toPartialDateColumns', () => {
  it('EXACT lengkap: kolom start terisi, end null, original verbatim', () => {
    const plan = buildBackfillPlan([member()])
    const cols = toPartialDateColumns(plan.actions[0]?.date as Parameters<typeof toPartialDateColumns>[0])
    expect(cols).toEqual({
      dateKind: 'EXACT',
      yearStart: 1900,
      monthStart: 1,
      dayStart: 12,
      yearEnd: null,
      monthEnd: null,
      dayEnd: null,
      originalDateString: '12 JAN 1900',
    })
  })

  it('RANGE: from ke kolom start, to ke kolom end', () => {
    const cols = toPartialDateColumns({
      dateKind: 'RANGE',
      from: { year: 1900 },
      to: { year: 1910, month: 6 },
      originalDateString: 'BET 1900 AND JUN 1910',
    })
    expect(cols.yearStart).toBe(1900)
    expect(cols.yearEnd).toBe(1910)
    expect(cols.monthEnd).toBe(6)
    expect(cols.dayStart).toBeNull()
    expect(cols.originalDateString).toBe('BET 1900 AND JUN 1910')
  })

  it('ABOUT tanpa komponen: semua kolom tanggal null, kind ABOUT', () => {
    const cols = toPartialDateColumns({ dateKind: 'ABOUT', originalDateString: 'zaman belanda' })
    expect(cols).toEqual({
      dateKind: 'ABOUT',
      yearStart: null,
      monthStart: null,
      dayStart: null,
      yearEnd: null,
      monthEnd: null,
      dayEnd: null,
      originalDateString: 'zaman belanda',
    })
  })
})
