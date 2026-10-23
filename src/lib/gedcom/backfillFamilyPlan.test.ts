// Unit test perencana backfill keluarga murni (v380): normalisasi arah
// pasangan, pemisahan aksi vs skip, idempotensi (skip already-exists),
// sumber kosong (jangan mengarang status), slot DIVORCE, dan
// determinisme. Tanpa DB sama sekali.

import { describe, expect, it } from 'vitest'
import {
  BACKFILL_FAMILY_EVENT_TYPES,
  buildBackfillFamilyPlan,
  coupleKeyOf,
  type BackfillFamilyCoupleInput,
} from './backfillFamilyPlan'

function couple(overrides: Partial<BackfillFamilyCoupleInput> = {}): BackfillFamilyCoupleInput {
  return {
    treeId: 't1',
    memberAId: 'm1',
    memberBId: 'm2',
    statusA: 'married',
    statusB: 'married',
    existingEventKeys: [],
    ...overrides,
  }
}

describe('coupleKeyOf', () => {
  it('kanonik: A-B dan B-A menghasilkan kunci sama', () => {
    expect(coupleKeyOf('aaa', 'bbb')).toBe('aaa|bbb')
    expect(coupleKeyOf('bbb', 'aaa')).toBe('aaa|bbb')
  })
})

describe('buildBackfillFamilyPlan - aksi', () => {
  it('pasangan married tanpa event: satu aksi MARRIAGE, tanpa DIVORCE', () => {
    const plan = buildBackfillFamilyPlan([couple()])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({
      treeId: 't1',
      memberId: 'm1',
      partnerMemberId: 'm2',
      eventType: 'MARRIAGE',
      date: null,
    })
    expect(plan.skips).toHaveLength(0)
  })

  it('pasangan divorced: MARRIAGE dan DIVORCE dua aksi, urut MARRIAGE dulu', () => {
    const plan = buildBackfillFamilyPlan([couple({ statusA: 'divorced' })])
    expect(plan.actions.map((a) => a.eventType)).toEqual(['MARRIAGE', 'DIVORCE'])
  })

  it('widowed tetap ever-married: MARRIAGE aksi, tanpa DIVORCE', () => {
    const plan = buildBackfillFamilyPlan([couple({ statusB: 'widowed' })])
    expect(plan.actions.map((a) => a.eventType)).toEqual(['MARRIAGE'])
  })

  it('urutan kanonik: input B-A menghasilkan memberId kecil dulu', () => {
    const plan = buildBackfillFamilyPlan([couple({ memberAId: 'zzz', memberBId: 'aaa' })])
    expect(plan.actions[0]).toMatchObject({ memberId: 'aaa', partnerMemberId: 'zzz' })
  })

  it('date selalu null: model tidak menyimpan tanggal pernikahan', () => {
    const plan = buildBackfillFamilyPlan([couple({ statusA: 'divorced' })])
    expect(plan.actions.every((a) => a.date === null)).toBe(true)
  })
})

describe('buildBackfillFamilyPlan - skip dan idempotensi', () => {
  it('MARRIAGE sudah ada: skip already-exists, tanpa aksi MARRIAGE', () => {
    const plan = buildBackfillFamilyPlan([
      couple({ existingEventKeys: ['m1|m2|MARRIAGE'] }),
    ])
    expect(plan.actions).toHaveLength(0)
    expect(plan.skips).toEqual([
      { treeId: 't1', memberId: 'm1', partnerMemberId: 'm2', eventType: 'MARRIAGE', reason: 'already-exists' },
    ])
  })

  it('kunci existing kanonik dikenali: skip sebelum aksi dibuat', () => {
    // Skrip membangun kunci existing dari LifeEvent dua arah; planner
    // hanya mencocokkan string kunci yang diberikan.
    const plan = buildBackfillFamilyPlan([
      couple({ existingEventKeys: ['m1|m2|MARRIAGE'] }),
    ])
    expect(plan.actions).toHaveLength(0)
  })

  it('kedua event sudah ada: dua skip already-exists', () => {
    const plan = buildBackfillFamilyPlan([
      couple({ statusA: 'divorced', existingEventKeys: ['m1|m2|MARRIAGE', 'm1|m2|DIVORCE'] }),
    ])
    expect(plan.actions).toHaveLength(0)
    expect(plan.skips.map((s) => s.reason)).toEqual(['already-exists', 'already-exists'])
  })

  it('kedua member single: skip empty-source, tidak mengarang pernikahan', () => {
    const plan = buildBackfillFamilyPlan([couple({ statusA: 'single', statusB: 'single' })])
    expect(plan.actions).toHaveLength(0)
    expect(plan.skips).toEqual([
      { treeId: 't1', memberId: 'm1', partnerMemberId: 'm2', eventType: 'MARRIAGE', reason: 'empty-source' },
    ])
  })

  it('DIVORCE tanpa divorced: slot tidak dibuat sama sekali, tanpa skip', () => {
    const plan = buildBackfillFamilyPlan([couple({ statusA: 'married', statusB: 'widowed' })])
    expect(plan.skips.filter((s) => s.eventType === 'DIVORCE')).toHaveLength(0)
  })
})

describe('buildBackfillFamilyPlan - dedup dan determinisme', () => {
  it('pasangan ganda A-B dan B-A: satu aksi saja, entri pertama menang', () => {
    const plan = buildBackfillFamilyPlan([
      couple({ memberAId: 'm2', memberBId: 'm1' }),
      couple(),
    ])
    expect(plan.actions).toHaveLength(1)
    expect(plan.actions[0]).toMatchObject({ memberId: 'm1', partnerMemberId: 'm2' })
  })

  it('deterministik: input sama menghasilkan rencana sama (murni)', () => {
    const input = [couple({ statusA: 'divorced' }), couple({ memberAId: 'm3', memberBId: 'm4' })]
    expect(buildBackfillFamilyPlan(input)).toEqual(buildBackfillFamilyPlan(input))
  })

  it('konstanta eventType keluarga: MARRIAGE dan DIVORCE', () => {
    expect([...BACKFILL_FAMILY_EVENT_TYPES]).toEqual(['MARRIAGE', 'DIVORCE'])
  })
})
