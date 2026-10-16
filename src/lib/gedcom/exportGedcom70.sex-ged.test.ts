// Test export SEX fidelity (v262): sexPayload memakai resolveSexGed,
// prefer kolom sexGed verbatim bila isinya enum M/F/X/U, nilai asing
// diabaikan dan gugur ke fallback sexFromGender(gender) seperti jalur
// lama. Round-trip inti: SEX U import lalu export harus kembali SEX U
// identik (menutup lubang maximal70 I4 yang sebelumnya berubah SEX X).
// Fixture kecil didefinisikan di sini; fixtures round-trip existing
// tidak disentuh.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import { importIndividuals } from './importIndividuals'
import { buildImportPlan } from './importPlan'
import type { FamilyMemberRecord } from '../adapters/types'

const EXPORTED_AT = new Date('2026-10-16T00:00:00Z')

function member(
  partial: Partial<FamilyMemberRecord> & Pick<FamilyMemberRecord, 'id'>,
): FamilyMemberRecord {
  return {
    treeId: 'tree-1',
    name: `Nama ${partial.id}`,
    birthDate: '1 JAN 1990',
    gender: 'male',
    isAlive: false,
    generation: 1,
    maritalStatus: 'single',
    ...partial,
  }
}

/** Semua payload baris '1 SEX ...' dalam urutan dokumen. */
function sexPayloads(gedcom: string): string[] {
  return gedcom
    .split('\n')
    .filter((line) => line.startsWith('1 SEX '))
    .map((line) => line.slice('1 SEX '.length))
}

function exportOne(m: FamilyMemberRecord): string {
  return exportGedcom70({ members: [m], relationships: [], exportedAt: EXPORTED_AT }).gedcom
}

describe('exportGedcom70 sexGed prefer verbatim (v262)', () => {
  it('sexGed U menang atas gender dan menghasilkan tepat satu SEX U', () => {
    const gedcom = exportOne(member({ id: 'a', sexGed: 'U', gender: 'male' }))
    expect(sexPayloads(gedcom)).toEqual(['U'])
  })

  it('sexGed X menang atas gender male', () => {
    const gedcom = exportOne(member({ id: 'a', sexGed: 'X', gender: 'male' }))
    expect(sexPayloads(gedcom)).toEqual(['X'])
  })

  it('sexGed M dan F verbatim menimpa gender model', () => {
    expect(sexPayloads(exportOne(member({ id: 'a', sexGed: 'M', gender: 'female' })))).toEqual(['M'])
    expect(sexPayloads(exportOne(member({ id: 'b', sexGed: 'F', gender: 'male' })))).toEqual(['F'])
  })

  it('sexGed asing ZZZ diabaikan, gugur ke fallback gender male jadi SEX M', () => {
    const gedcom = exportOne(member({ id: 'a', sexGed: 'ZZZ', gender: 'male' }))
    expect(sexPayloads(gedcom)).toEqual(['M'])
  })

  it('sexGed asing dengan gender other gugur ke fallback SEX X', () => {
    const gedcom = exportOne(member({ id: 'a', sexGed: 'ZZZ', gender: 'other' }))
    expect(sexPayloads(gedcom)).toEqual(['X'])
  })

  it('legacy tanpa sexGed: fallback jalur lama male M, female F, other X', () => {
    expect(sexPayloads(exportOne(member({ id: 'a', gender: 'male' })))).toEqual(['M'])
    expect(sexPayloads(exportOne(member({ id: 'b', gender: 'female' })))).toEqual(['F'])
    expect(sexPayloads(exportOne(member({ id: 'c', gender: 'other' })))).toEqual(['X'])
  })

  it('sexGed kosong diperlakukan nihil, fallback tetap jalan', () => {
    const gedcom = exportOne(member({ id: 'a', sexGed: '', gender: 'female' }))
    expect(sexPayloads(gedcom)).toEqual(['F'])
  })

  it('ROUND-TRIP inti: import SEX U lalu export menghasilkan tepat satu SEX U identik', () => {
    const source = exportOne(member({ id: 'a', sexGed: 'U', gender: 'other', name: 'Anak /U/' }))
    expect(sexPayloads(source)).toEqual(['U'])

    const parsed = importIndividuals(source)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].sex).toBe('U')

    const plan = buildImportPlan(parsed, [])
    expect(plan.members[0].sexGed).toBe('U')
    expect(plan.members[0].gender).toBe('other')

    const reexport = exportGedcom70({
      members: [member({ id: 'a', sexGed: plan.members[0].sexGed, gender: 'other', name: 'Anak /U/' })],
      relationships: [],
      exportedAt: EXPORTED_AT,
    }).gedcom
    expect(sexPayloads(reexport)).toEqual(['U'])
  })

  it('dua member bercampur sexGed dan legacy: tiap INDI tepat satu baris SEX', () => {
    const result = exportGedcom70({
      members: [
        member({ id: 'a', sexGed: 'U', gender: 'male' }),
        member({ id: 'b', gender: 'other' }),
      ],
      relationships: [],
      exportedAt: EXPORTED_AT,
    })
    expect(sexPayloads(result.gedcom)).toEqual(['U', 'X'])
    expect(result.stats.individuals).toBe(2)
  })
})
