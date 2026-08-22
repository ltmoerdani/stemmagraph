// Regresi kelas bug S-14: arah relasi tipe child (S-15 AC-4d).
//
// Konteks: lima varian tipe UI anak (biological_child, step_child,
// adopted_child, grandchild, great_grandchild) oleh addMemberWithRelationship
// disimpan sebagai edge 'parent' dengan memberId = orang tua sasaran dan
// relatedId = anggota baru (pembalikan arah, fix QA put-1 Temuan-2), supaya
// hidrasi dan ekspor membentuk parentChild dengan benar.
//
// Batasan yang dicatat jujur: fungsi pemetaan varian UI ke tipe adapter
// (mapRelationshipType) dan offset generasinya hidup sebagai fungsi internal
// src/store/familyStore.ts, tidak diekspor, dan modul itu menempel zustand
// plus adapter sehingga bukan modul murni yang sah diimpor unit test node.
// Sesuai arahan task, store TIDAK direfactor demi test. Jalur end-to-end
// arah relasi sudah dijaga permanen oleh harness scripts/verify-s14-roundtrip.mjs
// (bagian npm run verify). Di file ini yang diuji murni adalah kontrak
// inversi arah pada lapisan konsumen akhir yang terimpor: mapper GEDCOM.
//
// Dua invariant:
// 1. Edge 'parent' (memberId ortu, relatedId anak) yang ditulis fix S-14
//    dikenali mapper: anak menjadi CHIL dengan FAMC, orang tua FAMS.
// 2. Edge 'child' terbalik (memberId anak, relatedId ortu) menghasilkan
//    keluaran byte identik dengan edge 'parent' searah: dua arah tulisan
//    yang sama maknanya tidak boleh menghasilkan topologi berbeda.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord, MemberRelationship } from '../adapters/types'

const EXPORTED_AT = new Date('2026-08-22T00:00:00Z')

/** Kelima varian tipe UI yang fix S-14 balik arahnya menjadi edge parent. */
const CHILD_UI_VARIANTS = [
  'biological_child',
  'step_child',
  'adopted_child',
  'grandchild',
  'great_grandchild',
] as const

function twoPersonTree(members: FamilyMemberRecord[], relationships: MemberRelationship[]) {
  return exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
}

function parentChildMembers(): FamilyMemberRecord[] {
  // Id dipilih supaya urutan sort menempatkan orang tua sebagai I1 dan
  // anak sebagai I2 (xref INDI diberi nomor urut id menaik).
  return [
    {
      id: 'a',
      treeId: 'tree-1',
      name: 'Orang Tua',
      birthDate: '1 JAN 1970',
      gender: 'female',
      isAlive: true,
      generation: 1,
      maritalStatus: 'single',
    },
    {
      id: 'b',
      treeId: 'tree-1',
      name: 'Anggota Baru',
      birthDate: '1 JAN 2000',
      gender: 'male',
      isAlive: true,
      generation: 2,
      maritalStatus: 'single',
    },
  ]
}

describe('kontrak arah relasi anak (regresi S-14)', () => {
  it.each(CHILD_UI_VARIANTS)(
    'varian %s: edge parent ortu->anak membentuk CHIL dengan FAMC pada anak',
    (variant) => {
      const members = parentChildMembers()
      // Bentuk edge yang ditulis store setelah fix S-14 untuk varian ini:
      // arah dibalik, memberId selalu orang tua sasaran.
      const relationships: MemberRelationship[] = [
        { id: `rel-${variant}`, treeId: 'tree-1', memberId: 'a', relatedId: 'b', type: 'parent' },
      ]
      const { gedcom, stats } = twoPersonTree(members, relationships)
      expect(stats.individuals).toBe(2)
      expect(stats.families).toBe(1)
      expect(gedcom).toContain('0 @F1@ FAM')
      expect(gedcom).toContain('1 CHIL @I2@')
      expect(gedcom).toContain('1 FAMC @F1@')
      expect(gedcom).toContain('1 FAMS @F1@')
    },
  )

  it('edge child (anak->ortu) ekuivalen byte dengan edge parent (ortu->anak)', () => {
    const members = parentChildMembers()
    const forward = twoPersonTree(members, [
      { id: 'r-forward', treeId: 'tree-1', memberId: 'a', relatedId: 'b', type: 'parent' },
    ])
    const inverse = twoPersonTree(members, [
      { id: 'r-inverse', treeId: 'tree-1', memberId: 'b', relatedId: 'a', type: 'child' },
    ])
    expect(inverse.gedcom).toBe(forward.gedcom)
    expect(inverse.stats).toEqual(forward.stats)
  })

  it('edge child dan parent yang sama pasangannya tidak menduplikasi FAM', () => {
    const members = parentChildMembers()
    const { gedcom, stats } = twoPersonTree(members, [
      { id: 'r-parent', treeId: 'tree-1', memberId: 'a', relatedId: 'b', type: 'parent' },
      { id: 'r-child', treeId: 'tree-1', memberId: 'b', relatedId: 'a', type: 'child' },
    ])
    expect(stats.families).toBe(1)
    expect((gedcom.match(/0 @F\d+@ FAM/g) ?? []).length).toBe(1)
    expect((gedcom.match(/1 CHIL @I2@/g) ?? []).length).toBe(1)
  })

  it('relasi antar anggota sama sendiri (self loop) tidak membentuk FAM', () => {
    const members = parentChildMembers()
    const { stats } = twoPersonTree(members, [
      { id: 'r-self', treeId: 'tree-1', memberId: 'a', relatedId: 'a', type: 'parent' },
    ])
    expect(stats.families).toBe(0)
  })
})
