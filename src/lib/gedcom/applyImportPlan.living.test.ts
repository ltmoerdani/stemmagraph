// Test v139-ii: wiring resolveInitialPrivacyStatus masuk pipeline import
// lewat memberInput. Living safe default anggap-hidup (livingSuggested
// true tanpa RESN) terangkat jadi private; nilai privacyStatus eksplisit
// tetap menang; tanpa sinyal tetap undefined tanpa fabrikasi.

import { describe, expect, it } from 'vitest'
import { applyImportPlan } from './applyImportPlan'
import type { ImportApplyIO } from './applyImportPlan'
import type { ImportPlan, PlannedMember } from './importPlan'

function member(
  xref: string | undefined,
  fields: {
    privacyStatus?: 'shared' | 'private'
    livingSuggested?: boolean
    deathDate?: PlannedMember['deathDate']
  } = {},
): PlannedMember {
  return {
    xref,
    name: `Nama ${xref ?? 'anon'}`,
    gender: 'other',
    birthDate: undefined,
    birthPlace: undefined,
    deathDate: fields.deathDate,
    deathPlace: undefined,
    livingSuggested: fields.livingSuggested,
    privacyStatus: fields.privacyStatus,
  }
}

function makeIO(): { io: ImportApplyIO; inputs: Parameters<ImportApplyIO['createMember']>[] } {
  const inputs: Parameters<ImportApplyIO['createMember']>[] = []
  const io: ImportApplyIO = {
    treeId: 'tree-1',
    createMember: (input) => {
      inputs.push(input)
      return Promise.resolve(`id-${inputs.length}`)
    },
    createRelation: () => Promise.resolve(),
  }
  return { io, inputs }
}

function planOf(members: PlannedMember[]): ImportPlan {
  return { members, relationships: [], skipped: [] }
}

describe('v139-ii: living safe default masuk pipeline import', () => {
  it('kasus 1: livingSuggested true tanpa privacyStatus, createMember menerima private', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(planOf([member('I1', { livingSuggested: true })]), io)
    expect(inputs[0]?.privacyStatus).toBe('private')
  })

  it('kasus 2: deathDate plus livingSuggested false, createMember menerima undefined', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(
      planOf([
        member('I1', {
          livingSuggested: false,
          deathDate: { dateKind: 'EXACT', originalDateString: '1900', year: 1900 },
        }),
      ]),
      io,
    )
    expect(inputs[0]?.privacyStatus).toBeUndefined()
  })

  it('kasus 3: privacyStatus eksplisit shared plus livingSuggested true, tetap shared', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(
      planOf([member('I1', { privacyStatus: 'shared', livingSuggested: true })]),
      io,
    )
    expect(inputs[0]?.privacyStatus).toBe('shared')
  })

  it('kasus 4: privacyStatus eksplisit private plus livingSuggested false, tetap private', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(
      planOf([member('I1', { privacyStatus: 'private', livingSuggested: false })]),
      io,
    )
    expect(inputs[0]?.privacyStatus).toBe('private')
  })

  it('kasus 5: member tanpa sinyal apa pun, undefined', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(planOf([member('I1')]), io)
    expect(inputs[0]?.privacyStatus).toBeUndefined()
  })

  it('kasus 6: batch campuran 3 member, hasil masing-masing benar', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(
      planOf([
        member('I1', { livingSuggested: true }),
        member('I2', { privacyStatus: 'shared', livingSuggested: true }),
        member('I3', { livingSuggested: false }),
      ]),
      io,
    )
    expect(inputs[0]?.privacyStatus).toBe('private')
    expect(inputs[1]?.privacyStatus).toBe('shared')
    expect(inputs[2]?.privacyStatus).toBeUndefined()
  })

  it('kasus 7: regresi input tanpa kedua field, tidak ada key fabrikasi', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(
      planOf([{ xref: 'I1', name: 'Nama I1', gender: 'other' }]),
      io,
    )
    expect('livingSuggested' in (inputs[0] as object)).toBe(false)
    expect(inputs[0]?.privacyStatus).toBeUndefined()
  })

  it('kasus 8: livingSuggested pada PlannedMember terbaca memberInput (terbukti lewat hasil)', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(planOf([member('I1', { livingSuggested: true })]), io)
    expect((inputs[0] as Record<string, unknown>).privacyStatus).toBe('private')
  })
})
