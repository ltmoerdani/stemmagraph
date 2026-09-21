import { describe, it, expect } from 'vitest'
import { buildImportPlan } from './importPlan'
import type { ImportedIndividual, ImportedFamily } from './importIndividuals'
import type {} from './importFamilies'

// Helper: satu individual minimal dengan xref dan opsi death.
function indi(xref: string, opts: { death?: unknown; birth?: unknown; resn?: unknown } = {}): ImportedIndividual {
  return {
    xref,
    name: `Nama ${xref}`,
    sex: undefined,
    birthDate: opts.birth as never,
    deathDate: opts.death as never,
    resn: opts.resn as never,
  } as unknown as ImportedIndividual
}

function fam(xref: string): ImportedFamily {
  return { xref } as unknown as ImportedFamily
}

describe('importPlan livingSuggested (v138-c wiring assessImportPrivacy)', () => {
  it('t1: individual dengan DEAT (deathDate ada) livingSuggested false', () => {
    const plan = buildImportPlan([indi('I1', { death: { kind: 'exact' } })], [fam('F1')], [])
    expect(plan.members.find((m) => m.xref === 'I1')?.livingSuggested).toBe(false)
  })

  it('t2: individual tanpa DEAT livingSuggested true safe default', () => {
    const plan = buildImportPlan([indi('I2')], [], [])
    expect(plan.members.find((m) => m.xref === 'I2')?.livingSuggested).toBe(true)
  })

  it('t3: deathDate string kosong dianggap tidak ada, living true', () => {
    const plan = buildImportPlan([indi('I3', { death: '' })], [], [])
    expect(plan.members.find((m) => m.xref === 'I3')?.livingSuggested).toBe(true)
  })

  it('t4: batch campuran living dan non-living dinilai per individual', () => {
    const plan = buildImportPlan(
      [indi('A', { death: { kind: 'exact' } }), indi('B'), indi('C')],
      [],
      [],
    )
    const a = plan.members.find((m) => m.xref === 'A')
    const b = plan.members.find((m) => m.xref === 'B')
    const c = plan.members.find((m) => m.xref === 'C')
    expect(a?.livingSuggested).toBe(false)
    expect(b?.livingSuggested).toBe(true)
    expect(c?.livingSuggested).toBe(true)
  })

  it('t5: regresi privacyStatus dari RESN CONFIDENTIAL tetap termap private', () => {
    const plan = buildImportPlan([indi('I5', { resn: 'CONFIDENTIAL' })], [], [])
    const m = plan.members.find((x) => x.xref === 'I5')
    expect(m?.privacyStatus).toBe('private')
    expect(m?.livingSuggested).toBe(true)
  })

  it('t6: regresi RESN absen privacyStatus tetap undefined, living tetap dinilai', () => {
    const plan = buildImportPlan([indi('I6')], [], [])
    const m = plan.members.find((x) => x.xref === 'I6')
    expect(m?.privacyStatus).toBeUndefined()
    expect(m?.livingSuggested).toBe(true)
  })

  it('t7: field lain plan tidak berubah (xref name gender deathDate utuh)', () => {
    const ind = indi('I7', { death: { kind: 'exact' } })
    ind.sex = 'M'
    const plan = buildImportPlan([ind], [], [])
    const m = plan.members.find((x) => x.xref === 'I7')
    expect(m).toBeDefined()
    expect(m?.name).toBe('Nama I7')
    expect(m?.gender).toBe('male')
    expect(m?.deathDate).toEqual({ kind: 'exact' })
    expect(Object.keys(m ?? {}).sort()).toEqual(
      ['birthDate', 'birthPlace', 'deathDate', 'deathPlace', 'gender', 'livingSuggested', 'name', 'privacyStatus', 'xref'].sort(),
    )
    expect(m && 'resn' in m).toBe(false)
  })

  it('t8: individual tanpa xref tetap dinilai living (id kosong di gate, hasil tetap benar)', () => {
    const plan = buildImportPlan([indi('')], [], [])
    expect(plan.members[0]?.livingSuggested).toBe(true)
  })

  it('t9: DEAT tanpa payload tapi ada tanggal di level substructure, gunakan kontrak hasValue', () => {
    const plan = buildImportPlan([indi('I9', { death: 0 })], [], [])
    expect(plan.members.find((x) => x.xref === 'I9')?.livingSuggested).toBe(false)
  })

  it('t10: plan dengan nihil member tidak error dan tidak menambah field', () => {
    const plan = buildImportPlan([], [], [])
    expect(plan.members).toEqual([])
    expect(plan.relationships).toEqual([])
    expect(plan.skipped).toEqual([])
    expect(plan.members.every((m) => typeof m.livingSuggested === 'boolean')).toBe(true)
  })
})
