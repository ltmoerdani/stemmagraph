import { describe, expect, it } from 'vitest'
import { buildImportPlan, type PlannedMember } from './importPlan'
import type { ImportedIndividual } from './importIndividuals'
import type { ImportedFamily } from './importFamilies'

/** Individual minimal; resn opsional sesuai kontrak parser. */
function indiv(xref: string, resn?: string): ImportedIndividual {
  return {
    xref,
    name: `Nama ${xref}`,
    sex: 'M',
    birthDate: undefined,
    birthPlace: undefined,
    deathDate: undefined,
    deathPlace: undefined,
    resn,
  }
}

const NO_FAMILIES: ImportedFamily[] = []

/** Kasus utama notes/298: RESN multi-nilai resmi maximal70.ged. */
const MULTI = 'CONFIDENTIAL, LOCKED'

function privacyByXref(members: PlannedMember[]): Map<string, string | undefined> {
  return new Map(members.map((m) => [m.xref ?? '', m.privacyStatus]))
}

describe('v130-ii: pemetaan RESN ke PlannedMember.privacyStatus', () => {
  it('kasus 1 notes/298: CONFIDENTIAL, LOCKED menghasilkan private', () => {
    const plan = buildImportPlan([indiv('I1', MULTI)], NO_FAMILIES)
    expect(plan.members[0]?.privacyStatus).toBe('private')
  })

  it('RESN PRIVACY tunggal menghasilkan private', () => {
    const plan = buildImportPlan([indiv('I1', 'PRIVACY')], NO_FAMILIES)
    expect(plan.members[0]?.privacyStatus).toBe('private')
  })

  it('RESN absent menghasilkan privacyStatus undefined', () => {
    const plan = buildImportPlan([indiv('I1')], NO_FAMILIES)
    expect(plan.members[0]?.privacyStatus).toBeUndefined()
  })

  it('RESN tak dikenal menghasilkan privacyStatus undefined (tidak fabrikasi)', () => {
    const plan = buildImportPlan([indiv('I1', 'WEIRD, STUFF')], NO_FAMILIES)
    expect(plan.members[0]?.privacyStatus).toBeUndefined()
  })

  it('RESN tanpa spasi tetap termap (ABNF listDelim)', () => {
    const plan = buildImportPlan([indiv('I1', 'CONFIDENTIAL,LOCKED')], NO_FAMILIES)
    expect(plan.members[0]?.privacyStatus).toBe('private')
  })

  it('campuran: member ber-RESN dan tanpa RESN dalam satu plan', () => {
    const plan = buildImportPlan([indiv('I1', MULTI), indiv('I2')], NO_FAMILIES)
    const by = privacyByXref(plan.members)
    expect(by.get('I1')).toBe('private')
    expect(by.get('I2')).toBeUndefined()
  })
})
