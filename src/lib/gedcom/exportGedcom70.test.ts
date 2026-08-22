// Unit test semantik mapper ekspor GEDCOM 7.0 (S-15 AC-4a).
//
// Fokus: invariant semantik keluaran exportGedcom70 pada data kecil buatan:
// determinisme, bentuk HEAD/TRLR, penomoran xref, perakitan FAM dari relasi
// spouse dan parent, redaksi mode clean, serta pemetaan SEX dan DEAT.
// Ini sengaja TIDAK mengulang uji byte-round-trip fixture resmi
// minimal70/same-sex-marriage/maximal70 yang sudah dipegang harness
// scripts/verify-gedcom70.mjs; di sini cukup perilaku mapper dilihat dari
// string keluarannya.

import { describe, expect, it } from 'vitest'
import { version as appVersion } from '../../../package.json'
import { exportGedcom70 } from './exportGedcom70'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

const EXPORTED_AT = new Date('2026-08-22T00:00:00Z')

function member(
  partial: Partial<FamilyMemberRecord> & Pick<FamilyMemberRecord, 'id'>,
): FamilyMemberRecord {
  return {
    treeId: 'tree-1',
    name: `Nama ${partial.id}`,
    birthDate: '1 JAN 1990',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...partial,
  }
}

function rel(
  id: string,
  memberId: string,
  relatedId: string,
  type: MemberRelationship['type'],
): MemberRelationship {
  return { id, treeId: 'tree-1', memberId, relatedId, type }
}

function countMatches(text: string, pattern: RegExp): number {
  return (text.match(pattern) ?? []).length
}

function coupleWithChild() {
  const members = [
    member({ id: 'a', name: 'Ayah', gender: 'male' }),
    member({ id: 'b', name: 'Ibu', gender: 'female' }),
    member({ id: 'c', name: 'Anak', generation: 2 }),
  ]
  // Kedua orang tua tercatat sebagai edge parent: syarat mapper menempatkan
  // anak pada FAM pasangan (keduanya membentuk pasangan suami istri).
  const relationships = [
    rel('r1', 'a', 'b', 'spouse'),
    rel('r2', 'a', 'c', 'parent'),
    rel('r3', 'b', 'c', 'parent'),
  ]
  return { members, relationships }
}

describe('exportGedcom70: invariant semantik', () => {
  it('deterministik: input sama dengan exportedAt sama menghasilkan byte identik', () => {
    const { members, relationships } = coupleWithChild()
    const first = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    const second = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(first.gedcom).toBe(second.gedcom)
  })

  it('HEAD memuat identitas produk, versi 7.0, dan tanggal ekspor; ditutup TRLR tanpa BOM', () => {
    const { members, relationships } = coupleWithChild()
    const { gedcom } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(gedcom.charCodeAt(0)).not.toBe(0xfeff)
    expect(gedcom).toContain('0 HEAD')
    expect(gedcom).toContain('1 SOUR Stemmagraph')
    expect(gedcom).toContain(`2 VERS ${appVersion}`)
    expect(gedcom).toContain('1 GEDC')
    expect(gedcom).toContain('2 VERS 7.0')
    expect(gedcom).toContain('1 DATE 22 AUG 2026')
    expect(gedcom.trimEnd().endsWith('0 TRLR')).toBe(true)
  })

  it('xref INDI diberi nomor urut id anggota dan stats menghitung individu serta keluarga', () => {
    const { members, relationships } = coupleWithChild()
    const { gedcom, stats } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(gedcom).toContain('0 @I1@ INDI')
    expect(gedcom).toContain('0 @I2@ INDI')
    expect(gedcom).toContain('0 @I3@ INDI')
    expect(countMatches(gedcom, /0 @I\d+@ INDI/g)).toBe(3)
    expect(stats.individuals).toBe(3)
    expect(countMatches(gedcom, /0 @F\d+@ FAM/g)).toBe(1)
    expect(stats.families).toBe(1)
  })

  it('anak dari pasangan suami istri masuk sebagai CHIL pada satu FAM bersama', () => {
    const { members, relationships } = coupleWithChild()
    const { gedcom } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(countMatches(gedcom, /1 CHIL @I3@/g)).toBe(1)
    expect(countMatches(gedcom, /1 FAMS @F1@/g)).toBe(2)
    expect(countMatches(gedcom, /1 FAMC @F1@/g)).toBe(1)
  })

  it('anak dengan hanya satu orang tua tercatat tidak dimasukkan ke FAM pasangan orang tuanya', () => {
    const members = [
      member({ id: 'a', name: 'Ayah', gender: 'male' }),
      member({ id: 'b', name: 'Ibu', gender: 'female' }),
      member({ id: 'c', name: 'Anak', generation: 2 }),
    ]
    // a dan b pasangan, tetapi hanya a yang tercatat sebagai orang tua c.
    // Mapper tidak boleh mengarang orang tua kedua: c masuk FAM single
    // parent milik a, bukan ke FAM pasangan a dan b.
    const relationships = [
      rel('r1', 'a', 'b', 'spouse'),
      rel('r2', 'a', 'c', 'parent'),
    ]
    const { gedcom, stats } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(stats.families).toBe(2)
    expect(countMatches(gedcom, /1 CHIL @I3@/g)).toBe(1)
    expect(countMatches(gedcom, /1 FAMC @F2@/g)).toBe(1)
  })

  it('dua orang tua yang tidak tercatat sebagai pasangan menghasilkan dua FAM single parent berisi anak yang sama', () => {
    const members = [
      member({ id: 'a', name: 'Ortu Satu' }),
      member({ id: 'b', name: 'Ortu Dua', gender: 'female' }),
      member({ id: 'c', name: 'Anak', generation: 2 }),
    ]
    const relationships = [
      rel('r1', 'a', 'c', 'parent'),
      rel('r2', 'b', 'c', 'parent'),
    ]
    const { gedcom, stats } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(stats.families).toBe(2)
    expect(countMatches(gedcom, /1 CHIL @I3@/g)).toBe(2)
  })

  it('relasi yang menunjuk id tidak dikenal diabaikan dan tidak membentuk FAM baru', () => {
    const members = [member({ id: 'a', name: 'Sendiri' })]
    const relationships = [
      rel('r1', 'a', 'ghost', 'spouse'),
      rel('r2', 'ghost', 'a', 'parent'),
    ]
    const { gedcom, stats } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(stats.families).toBe(0)
    expect(countMatches(gedcom, /0 @F\d+@ FAM/g)).toBe(0)
  })

  it('mode clean meredam anggota hidup tanpa flag shared: NAME diganti, BIRT hilang, topologi tetap', () => {
    const { members, relationships } = coupleWithChild()
    const full = exportGedcom70({
      members, relationships, exportedAt: EXPORTED_AT, privacyMode: 'full',
    })
    const clean = exportGedcom70({
      members, relationships, exportedAt: EXPORTED_AT, privacyMode: 'clean',
    })
    // Ketiganya hidup tanpa privacyStatus: semua teredam di mode clean.
    expect(clean.gedcom).toContain('1 NAME [Living]')
    expect(clean.gedcom).not.toContain('1 NAME Anak')
    expect(clean.gedcom).not.toContain('2 DATE 1 JAN 1990')
    // Topologi FAM tidak berubah oleh redaksi.
    expect(countMatches(clean.gedcom, /0 @F\d+@ FAM/g)).toBe(
      countMatches(full.gedcom, /0 @F\d+@ FAM/g),
    )
    expect(countMatches(clean.gedcom, /1 CHIL @\w+@/g)).toBe(
      countMatches(full.gedcom, /1 CHIL @\w+@/g),
    )
    expect(clean.stats.families).toBe(full.stats.families)
    // Mode full tetap memuat nama asli.
    expect(full.gedcom).toContain('1 NAME Anak')
    expect(full.gedcom).not.toContain('[Living]')
  })

  it('kematian: tanggal tercatat menulis DEAT DATE, tanpa tanggal menulis DEAT Y', () => {
    const members = [
      member({ id: 'a', name: 'Punya Tanggal', isAlive: false, deathDate: '5 MAR 2020' }),
      member({ id: 'b', name: 'Tanpa Tanggal', isAlive: false }),
    ]
    const { gedcom } = exportGedcom70({ members, relationships: [], exportedAt: EXPORTED_AT })
    expect(gedcom).toContain('1 DEAT')
    expect(gedcom).toContain('2 DATE 5 MAR 2020')
    expect(gedcom).toContain('1 DEAT Y')
  })

  it('pemetaan SEX: male M, female F, other X', () => {
    const members = [
      member({ id: 'a', name: 'Laki', gender: 'male' }),
      member({ id: 'b', name: 'Perempuan', gender: 'female' }),
      member({ id: 'c', name: 'Lainnya', gender: 'other' }),
    ]
    const { gedcom } = exportGedcom70({ members, relationships: [], exportedAt: EXPORTED_AT })
    expect(gedcom).toContain('1 SEX M')
    expect(gedcom).toContain('1 SEX F')
    expect(gedcom).toContain('1 SEX X')
  })

  it('photoUrl non http(s) dilewati dan terhitung di stats.skippedPhotos', () => {
    const members = [
      member({ id: 'a', name: 'Blob', photoUrl: 'blob:http://localhost/abc' }),
    ]
    const { gedcom, stats } = exportGedcom70({ members, relationships: [], exportedAt: EXPORTED_AT })
    expect(stats.skippedPhotos).toBe(1)
    expect(gedcom).not.toContain('OBJE')
  })

  it('pasangan dengan status divorced menghasilkan MARR Y dan DIV Y dalam satu FAM', () => {
    const members = [
      member({ id: 'a', name: 'Mantan Satu', maritalStatus: 'divorced' }),
      member({ id: 'b', name: 'Mantan Dua', gender: 'female', maritalStatus: 'divorced' }),
    ]
    const relationships = [rel('r1', 'a', 'b', 'spouse')]
    const { gedcom } = exportGedcom70({ members, relationships, exportedAt: EXPORTED_AT })
    expect(countMatches(gedcom, /1 MARR Y/g)).toBe(1)
    expect(countMatches(gedcom, /1 DIV Y/g)).toBe(1)
  })
})
