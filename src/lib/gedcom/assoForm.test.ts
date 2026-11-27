// Test unit modul pure assoForm (v468): validasi form asosiasi ASSO
// meniru kontrak spek GEDCOM 7.0.18 (ROLE {1:1}, VOID+PHRASE untuk
// orang di luar pohon, label tanpa xref).

import { describe, expect, it } from 'vitest'
import {
  validateAssoForm,
  buildAssociation,
  assoLabel,
  ASSO_ROLE_OPTIONS,
} from './assoForm'
import { ASSO_ROLE_VALUES } from './assoRole'
import type { AssoFormInput } from './assoForm'

function baseInput(overrides: Partial<AssoFormInput> = {}): AssoFormInput {
  return {
    person: { id: 'm2', name: 'Siti Aminah' },
    outsideTree: false,
    outsideName: '',
    role: 'WITN',
    rolePhrase: '',
    ...overrides,
  }
}

describe('validateAssoForm (AC2 ROLE wajib)', () => {
  it('menolak simpan tanpa ROLE dengan pesan jelas', () => {
    const res = validateAssoForm(baseInput({ role: '' }))
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('Role is required'))).toBe(true)
  })

  it('lulus bila ROLE enum terisi dan person existing dipilih', () => {
    const res = validateAssoForm(baseInput())
    expect(res.ok).toBe(true)
    expect(res.errors).toEqual([])
  })

  it('role OTHER tanpa PHRASE peran ditolak', () => {
    const res = validateAssoForm(baseInput({ role: 'OTHER', rolePhrase: '  ' }))
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('OTHER requires a phrase'))).toBe(true)
  })

  it('role OTHER dengan PHRASE peran lulus', () => {
    const res = validateAssoForm(
      baseInput({ role: 'OTHER', rolePhrase: 'Teacher' }),
    )
    expect(res.ok).toBe(true)
  })

  it('mode orang di luar pohon tanpa nama ditolak', () => {
    const res = validateAssoForm(
      baseInput({ outsideTree: true, person: null, outsideName: '' }),
    )
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('outside the tree'))).toBe(true)
  })

  it('mode existing tanpa person terpilih ditolak (AC1)', () => {
    const res = validateAssoForm(baseInput({ person: null }))
    expect(res.ok).toBe(false)
    expect(res.errors.some((e) => e.includes('Select a person'))).toBe(true)
  })
})

describe('buildAssociation (AC1 AC3)', () => {
  it('person existing menghasilkan xref id person, bukan person baru', () => {
    const asso = buildAssociation(baseInput())
    expect(asso.xref).toBe('m2')
    expect(asso.role).toBe('WITN')
    expect(asso.roleResolved.known).toBe(true)
  })

  it('mode orang di luar pohon meniru contoh resmi spek (AC3)', () => {
    const asso = buildAssociation(
      baseInput({
        outsideTree: true,
        person: null,
        outsideName: 'Mr Stockdale',
        role: 'OTHER',
        rolePhrase: 'Teacher',
      }),
    )
    expect(asso.xref).toBeNull()
    expect(asso.role).toBe('OTHER')
    expect(asso.phrase).toBe('Mr Stockdale')
    expect(asso.roleResolved.value).toBe('OTHER')
  })

  it('role OTHER existing menyimpan phrase peran', () => {
    const asso = buildAssociation(
      baseInput({ role: 'OTHER', rolePhrase: 'Godparent' }),
    )
    expect(asso.xref).toBe('m2')
    expect(asso.role).toBe('OTHER')
    expect(asso.phrase).toBe('Godparent')
  })
})

describe('assoLabel (AC4 xref tak terlihat)', () => {
  it('label person existing memakai nama, bukan @I1@', () => {
    const asso = buildAssociation(baseInput())
    const label = assoLabel(asso, (id) => (id === 'm2' ? 'Siti Aminah' : undefined))
    expect(label).toBe('Siti Aminah')
    expect(label).not.toContain('@')
  })

  it('label @VOID@ memakai PHRASE nama tersimpan', () => {
    const asso = buildAssociation(
      baseInput({
        outsideTree: true,
        person: null,
        outsideName: 'Mr Stockdale',
        role: 'OTHER',
        rolePhrase: 'Teacher',
      }),
    )
    const label = assoLabel(asso, () => undefined)
    expect(label).toBe('Mr Stockdale')
    expect(label).not.toContain('@VOID@')
  })

  it('xref tak dikenal tetap tidak menampilkan xref mentah', () => {
    const asso = buildAssociation(baseInput())
    const label = assoLabel(asso, () => undefined)
    expect(label).toBe('Unknown person')
    expect(label).not.toContain('m2')
  })
})

describe('ASSO_ROLE_OPTIONS', () => {
  it('mewarisi 15 nilai enum spek untuk dropdown UI', () => {
    expect(ASSO_ROLE_OPTIONS).toEqual(ASSO_ROLE_VALUES)
    expect(ASSO_ROLE_OPTIONS).toHaveLength(15)
  })
})
