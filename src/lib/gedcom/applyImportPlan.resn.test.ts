// Test v130-ii: privacyStatus dari PlannedMember diteruskan utuh ke
// CreateMemberInput lewat memberInput, dan undefined tetap undefined
// (regresi: member tanpa RESN tidak mendapat field fabrikasi).

import { describe, expect, it } from 'vitest'
import { applyImportPlan } from './applyImportPlan'
import type { ImportApplyIO } from './applyImportPlan'
import type { ImportPlan, PlannedMember } from './importPlan'

function member(
  xref: string | undefined,
  privacyStatus?: 'shared' | 'private',
): PlannedMember {
  return {
    xref,
    name: `Nama ${xref ?? 'anon'}`,
    gender: 'other',
    birthDate: undefined,
    birthPlace: undefined,
    deathDate: undefined,
    deathPlace: undefined,
    privacyStatus,
  }
}

function makeIO(): { io: ImportApplyIO; inputs: Parameters<ImportApplyIO['createMember']> } {
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

describe('v130-ii: CreateMemberInput meneruskan privacyStatus', () => {
  it('member private (RESN multi) meneruskan privacyStatus private', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(planOf([member('I1', 'private')]), io)
    expect(inputs[0]?.privacyStatus).toBe('private')
  })

  it('member tanpa RESN tidak menambah field privacyStatus (regresi)', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(planOf([member('I1')]), io)
    expect(inputs[0]?.privacyStatus).toBeUndefined()
    expect('privacyStatus' in (inputs[0] as object)).toBe(true)
  })

  it('beberapa member: nilai per member tidak tertukar', async () => {
    const { io, inputs } = makeIO()
    await applyImportPlan(planOf([member('I1', 'private'), member('I2')]), io)
    expect(inputs[0]?.privacyStatus).toBe('private')
    expect(inputs[1]?.privacyStatus).toBeUndefined()
  })
})
