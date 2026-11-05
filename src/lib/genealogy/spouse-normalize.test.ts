import { describe, it, expect } from 'vitest'
import { deriveSpouseFields, normalizeSpouseIds } from './spouse-normalize'
import { hydrateMembers } from '../../store/familyStore'
import type { FamilyMemberRecord, MemberRelationship } from '../lib/adapters'

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

describe('normalizeSpouseIds: snapshot asli tidak termutasi (on-read)', () => {
  it('data lama: keluaran objek baru, snapshot masukan tetap utuh', () => {
    const snapshot = { id: 'm1', spouseId: 'm2', name: 'Budi' }
    const out = normalizeSpouseIds(snapshot)
    expect(out).not.toBe(snapshot)
    expect(snapshot).toStrictEqual({ id: 'm1', spouseId: 'm2', name: 'Budi' })
    expect(snapshot.spouseIds).toBeUndefined()
    expect(out.spouseIds).toStrictEqual(['m2'])
  })

  it('pemetaan kumpulan snapshot: hasil ternormalisasi, array sumber tak tersentuh', () => {
    const snapshots = [{ id: 'm1', spouseId: 'm2' }, { id: 'm2', spouseId: 'm1' }, { id: 'm3' }]
    const members = snapshots.map(normalizeSpouseIds)
    expect(members[0].spouseIds).toStrictEqual(['m2'])
    expect(members[1].spouseIds).toStrictEqual(['m1'])
    expect(snapshots[0].spouseIds).toBeUndefined()
    expect(snapshots[2]).toStrictEqual({ id: 'm3' })
  })

  it('anggota sudah ternormalisasi keluar identik secara nilai', () => {
    const member = { id: 'm1', spouseIds: ['m2', 'm3'], spouseId: 'm2' }
    const out = normalizeSpouseIds(member)
    expect(out).toStrictEqual(member)
    expect(out.spouseIds).toStrictEqual(['m2', 'm3'])
  })

  it('anggota tanpa pasangan keluar referensi sama (tidak ada rekonstruksi)', () => {
    const member = { id: 'm1', name: 'Budi' }
    expect(normalizeSpouseIds(member)).toBe(member)
  })
})

describe('normalizeSpouseIds: idempoten', () => {
  it('normalisasi dua kali menghasilkan nilai sama (data legacy)', () => {
    const once = normalizeSpouseIds({ id: 'm1', spouseId: 'm2' })
    const twice = normalizeSpouseIds(once)
    expect(twice).toStrictEqual(once)
    expect(twice.spouseIds).toStrictEqual(['m2'])
  })

  it('normalisasi dua kali menghasilkan nilai sama (data rusak multi field)', () => {
    const once = normalizeSpouseIds({ id: 'm1', spouseIds: ['m2', 'm1', 'm3'], spouseId: 'm9' })
    const twice = normalizeSpouseIds(once)
    expect(twice).toStrictEqual(once)
  })

  it('titik tetap: aplikasi kedua menghasilkan nilai sama', () => {
    const once = normalizeSpouseIds({ id: 'm1', spouseId: 'm2' })
    const twice = normalizeSpouseIds(once)
    expect(twice).toStrictEqual(once)
    expect(twice.spouseIds).toStrictEqual(['m2'])
  })
})

describe('hydrateMembers on-read: derivasi pasangan dari relasi', () => {
  const TREE_ID = 't1'

  function rec(id: string, name: string): FamilyMemberRecord {
    return {
      id,
      treeId: TREE_ID,
      name,
      birthDate: '1990-01-01',
      gender: 'male',
      isAlive: true,
      generation: 2,
      maritalStatus: 'single',
    } as FamilyMemberRecord
  }

  function rel(id: string, memberId: string, relatedId: string): MemberRelationship {
    return { id, treeId: TREE_ID, memberId, relatedId, type: 'spouse' }
  }

  it('pasangan ganda: spouseIds urutan rel terjaga, spouseId elemen pertama', () => {
    const members = hydrateMembers(
      [rec('m1', 'Budi'), rec('m2', 'Citra'), rec('m3', 'Dewi')],
      [rel('r1', 'm1', 'm2'), rel('r2', 'm1', 'm3')],
    )
    const budi = members.find((m) => m.id === 'm1')
    expect(budi?.spouseIds).toStrictEqual(['m2', 'm3'])
    expect(budi?.spouseId).toBe('m2')
  })

  it('rel spouse dua arah (seed mock) tidak menghasilkan duplikat', () => {
    const members = hydrateMembers(
      [rec('m1', 'Budi'), rec('m2', 'Citra')],
      [rel('r1', 'm1', 'm2'), rel('r2', 'm2', 'm1')],
    )
    const budi = members.find((m) => m.id === 'm1')
    const citra = members.find((m) => m.id === 'm2')
    expect(budi?.spouseIds).toStrictEqual(['m2'])
    expect(budi?.spouseId).toBe('m2')
    expect(citra?.spouseIds).toStrictEqual(['m1'])
  })

  it('anggota tanpa rel spouse tidak membawa field pasangan', () => {
    const members = hydrateMembers([rec('m1', 'Budi')], [])
    expect(members[0].spouseIds).toBeUndefined()
    expect(members[0].spouseId).toBeUndefined()
  })
})
