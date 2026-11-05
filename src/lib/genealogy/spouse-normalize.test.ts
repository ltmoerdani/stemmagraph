import { describe, it, expect } from 'vitest'
import { deriveSpouseFields, normalizeSpouseIds } from './spouse-normalize'

// Test unit GOAL v419 AC3: normalisasi on-read relasi pasangan.
// Menguji helper murni spouse-normalize: deriveSpouseFields dan
// normalizeSpouseIds (multi-pasangan, kompatibilitas data lama,
// keutuhan snapshot, idempotensi).

describe('deriveSpouseFields: multi-pasangan', () => {
  it('urutan pasangan dipertahankan tanpa duplikat', () => {
    expect(deriveSpouseFields(['m2', 'm3', 'm4'])).toEqual({
      spouseIds: ['m2', 'm3', 'm4'],
      spouseId: 'm2',
    })
  })

  it('duplikat dibuang, kemunculan pertama yang dihitung', () => {
    expect(deriveSpouseFields(['m2', 'm3', 'm2', 'm4', 'm3'])).toEqual({
      spouseIds: ['m2', 'm3', 'm4'],
      spouseId: 'm2',
    })
  })

  it('id kosong dan undefined dibuang dari hasil', () => {
    expect(deriveSpouseFields(['m2', '', undefined, 'm3'])).toEqual({
      spouseIds: ['m2', 'm3'],
      spouseId: 'm2',
    })
  })

  it('input kosong menghasilkan kedua field undefined', () => {
    expect(deriveSpouseFields([])).toEqual({})
    expect(deriveSpouseFields(['', undefined])).toEqual({})
  })
})

describe('normalizeSpouseIds: data lama spouseId tunggal', () => {
  it('data lama tanpa spouseIds membentuk spouseIds tunggal dari spouseId legacy', () => {
    const out = normalizeSpouseIds({ id: 'm1', spouseId: 'm2' })
    expect(out.spouseIds).toStrictEqual(['m2'])
    expect(out.spouseId).toBe('m2')
  })

  it('spouseId legacy tetap elemen pertama spouseIds (sumber backward-compat)', () => {
    const out = normalizeSpouseIds({ id: 'm1', spouseIds: ['m2', 'm3'] })
    expect(out.spouseId).toBe('m2')
    expect(out.spouseIds).toStrictEqual(['m2', 'm3'])
  })

  it('spouseId legacy diabaikan bila spouseIds sudah terisi', () => {
    const out = normalizeSpouseIds({ id: 'm1', spouseIds: ['m2'], spouseId: 'm9' })
    expect(out.spouseIds).toStrictEqual(['m2'])
    expect(out.spouseId).toBe('m2')
  })

  it('self-loop dan id kosong dibuang dari spouseIds', () => {
    const out = normalizeSpouseIds({ id: 'm1', spouseIds: ['m1', '', 'm3'] })
    expect(out.spouseIds).toStrictEqual(['m3'])
    expect(out.spouseId).toBe('m3')
  })

  it('anggota tanpa pasangan menghasilkan kedua field undefined', () => {
    expect(normalizeSpouseIds({ id: 'm1' })).toStrictEqual({ id: 'm1' })
    expect(normalizeSpouseIds({ id: 'm1', spouseId: '' })).toEqual({ id: 'm1' })
  })
})
