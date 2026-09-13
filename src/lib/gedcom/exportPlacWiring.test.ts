// Test wiring BIRT PLAC (S1F4-C): exportGedcom70 memanggil placePayload
// untuk birthPlace, dan birthPlace kosong berarti tanpa baris PLAC.
// Kasus sengaja minimal; sanitasi lib sudah diuji di placePayload.test.ts.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord } from '../adapters/types'

const EXPORTED_AT = new Date('2026-09-13T00:00:00Z')

function makeMember(
  overrides: Partial<FamilyMemberRecord> = {},
): FamilyMemberRecord {
  return {
    id: 'm1',
    treeId: 'tree-1',
    name: 'Budi Santoso',
    birthDate: '1 JAN 1970',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...overrides,
  }
}

function exportOne(overrides: Partial<FamilyMemberRecord> = {}): string {
  const { gedcom } = exportGedcom70({
    members: [makeMember(overrides)],
    relationships: [],
    exportedAt: EXPORTED_AT,
  })
  return gedcom
}

describe('exportGedcom70 BIRT PLAC wiring', () => {
  it('trims surrounding whitespace from birthPlace', () => {
    expect(exportOne({ birthPlace: '  Surabaya  ' })).toContain('2 PLAC Surabaya')
  })

  it('omits PLAC line when birthPlace is empty string', () => {
    expect(exportOne({ birthPlace: '' })).not.toContain('2 PLAC')
  })

  it('collapses internal tabs to a single space', () => {
    expect(exportOne({ birthPlace: 'Surabaya\tJawa Timur' })).toContain(
      '2 PLAC Surabaya Jawa Timur',
    )
  })
})
