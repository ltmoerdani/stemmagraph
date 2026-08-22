// Unit test gerbang privasi ekspor (S-15 AC-4b).
//
// Tiga kelompok invariant:
// 1. Default aman: privacyStatus tak dikenal (atau kosong) pada anggota
//    hidup jatuh ke keputusan 'redact', bukan 'full'.
// 2. Konservatif dalam menentukan hidup: data tidak lengkap (flag hidup
//    tapi ada tanggal wafat, atau not alive tanpa tanggal) dihitung
//    hidup sehingga teredam, bukan bocor.
// 3. Gerbang tidak menyentuh topologi: laporan angka konsisten, dan pada
//    mapper GEDCOM mode clean jumlah FAM/CHIL identik dengan mode full
//    (redaksi hanya mengganti payload INDI, tidak melebarkan atau
//    menyusutkan struktur keluarga).

import { describe, expect, it } from 'vitest'
import {
  buildExportPrivacyReport,
  evaluateMemberPrivacy,
  isLiving,
  type ExportPrivacyMember,
} from './exportPrivacyGate'
import { exportGedcom70 } from '../gedcom/exportGedcom70'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

describe('evaluateMemberPrivacy: default aman', () => {
  it('anggota hidup tanpa privacyStatus (belum tercatat) di-redact', () => {
    const living: ExportPrivacyMember = { isAlive: true }
    expect(evaluateMemberPrivacy(living)).toBe('redact')
  })

  it('privacyStatus tak dikenal diperlakukan seperti private, tidak bisa melebarkan ekspor', () => {
    // Simulasi data rusak dari lapisan penyimpanan: nilai di luar union.
    const malformed = {
      isAlive: true,
      privacyStatus: 'public-yakin',
    } as unknown as ExportPrivacyMember
    expect(evaluateMemberPrivacy(malformed)).toBe('redact')
  })

  it('hidup dengan flag shared diekspor penuh, flag private di-redact', () => {
    expect(evaluateMemberPrivacy({ isAlive: true, privacyStatus: 'shared' })).toBe('full')
    expect(evaluateMemberPrivacy({ isAlive: true, privacyStatus: 'private' })).toBe('redact')
  })

  it('anggota meninggal selalu diekspor penuh berapa pun flag-nya', () => {
    expect(
      evaluateMemberPrivacy({ isAlive: false, deathDate: '5 MAR 2020', privacyStatus: 'private' }),
    ).toBe('full')
    expect(
      evaluateMemberPrivacy({ isAlive: false, deathDate: '5 MAR 2020' }),
    ).toBe('full')
  })
})

describe('isLiving: konservatif saat data tidak lengkap', () => {
  it('flag hidup tetap dihitung hidup meski ada tanggal wafat tersisa', () => {
    expect(isLiving({ isAlive: true, deathDate: '5 MAR 2020' })).toBe(true)
  })

  it('not alive tanpa tanggal wafat dihitung hidup (arah aman: redact)', () => {
    expect(isLiving({ isAlive: false, deathDate: undefined })).toBe(true)
  })

  it('not alive dengan tanggal wafat dihitung meninggal', () => {
    expect(isLiving({ isAlive: false, deathDate: '5 MAR 2020' })).toBe(false)
  })
})

describe('buildExportPrivacyReport: penjumlahan konsisten', () => {
  it('total selalu sama dengan jumlah ketiga kategori', () => {
    const members: ExportPrivacyMember[] = [
      { isAlive: false, deathDate: '1 JAN 2001' },
      { isAlive: true, privacyStatus: 'shared' },
      { isAlive: true },
      { isAlive: true, privacyStatus: 'private' },
      { isAlive: true, privacyStatus: 'shared' },
    ]
    const report = buildExportPrivacyReport(members)
    expect(report.total).toBe(5)
    expect(report.deceased).toBe(1)
    expect(report.livingFull).toBe(2)
    expect(report.livingRedacted).toBe(2)
    expect(report.livingFull + report.livingRedacted + report.deceased).toBe(report.total)
  })
})

describe('gerbang privasi tidak mengubah topologi FAM', () => {
  function sampleTree(): {
    members: FamilyMemberRecord[]
    relationships: MemberRelationship[]
  } {
    const base = {
      treeId: 'tree-1',
      birthDate: '1 JAN 1990',
      gender: 'male' as const,
      generation: 1,
      maritalStatus: 'single' as const,
    }
    const members: FamilyMemberRecord[] = [
      { ...base, id: 'a', name: 'Kakek', isAlive: false, deathDate: '1 JAN 2020' },
      { ...base, id: 'b', name: 'Ayah', isAlive: true },
      { ...base, id: 'c', name: 'Ibu', isAlive: true, gender: 'female' },
      { ...base, id: 'd', name: 'Cucu', isAlive: true, generation: 2 },
    ]
    const relationships: MemberRelationship[] = [
      { id: 'r1', treeId: 'tree-1', memberId: 'b', relatedId: 'c', type: 'spouse' },
      { id: 'r2', treeId: 'tree-1', memberId: 'b', relatedId: 'd', type: 'parent' },
    ]
    return { members, relationships }
  }

  it('mode clean mempertahankan jumlah FAM, CHIL, FAMS, dan FAMC yang sama dengan mode full', () => {
    const { members, relationships } = sampleTree()
    const exportedAt = new Date('2026-08-22T00:00:00Z')
    const full = exportGedcom70({ members, relationships, exportedAt, privacyMode: 'full' })
    const clean = exportGedcom70({ members, relationships, exportedAt, privacyMode: 'clean' })
    const famCount = (s: string) => (s.match(/0 @F\d+@ FAM/g) ?? []).length
    const childCount = (s: string) => (s.match(/1 CHIL @I\d+@/g) ?? []).length
    const famsCount = (s: string) => (s.match(/1 FAMS @F\d+@/g) ?? []).length
    const famcCount = (s: string) => (s.match(/1 FAMC @F\d+@/g) ?? []).length
    expect(famCount(clean.gedcom)).toBe(famCount(full.gedcom))
    expect(childCount(clean.gedcom)).toBe(childCount(full.gedcom))
    expect(famsCount(clean.gedcom)).toBe(famsCount(full.gedcom))
    expect(famcCount(clean.gedcom)).toBe(famcCount(full.gedcom))
    expect(clean.stats.families).toBe(full.stats.families)
    expect(clean.stats.individuals).toBe(full.stats.individuals)
  })
})
