// Wiring test RESN ekspor (v135): memberResn pada ExportGedcom70Input
// tersambung ke resolveExportResn (resn-export-filter). Cakupan:
// byte-identity tanpa memberResn, CONFIDENTIAL tidak menulis tag RESN
// sama sekali, PRIVACY/LOCKED lolos ternormalisasi, precedence event
// atas record, perilaku lama saat input nihil, multi-nilai koma, dan
// cakupan jalur exportGedzip.

import { describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import { exportGedcom70 } from './exportGedcom70'
import { exportGedzip, GEDZIP_ENTRY_NAME } from './exportGedzip'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'

const EXPORTED_AT = new Date('2026-09-21T00:00:00Z')

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

function solo(members: FamilyMemberRecord[]): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return { members, relationships: [] }
}

function resnLines(gedcom: string): string[] {
  return gedcom
    .split('\n')
    .filter((line) => line.includes('RESN'))
}

// Member hidup dengan consent 'private': jalur record RESN PRIVACY
// existing pada mode full (v128-ii-c).
function privateLiving(id = 'm1'): FamilyMemberRecord {
  return member({ id, privacyStatus: 'private' })
}

describe('exportGedcom70 RESN wiring (v135)', () => {
  it('t1: tanpa memberResn keluaran byte-identik dengan omit vs undefined', () => {
    const input = solo([privateLiving()])
    const a = exportGedcom70({
      ...input,
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
    }).gedcom
    const b = exportGedcom70({
      ...input,
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: undefined,
    }).gedcom
    expect(b).toBe(a)
    // Jalur record existing tetap menulis PRIVACY.
    expect(resnLines(a)).toEqual(['1 RESN PRIVACY'])
  })

  it('t2: CONFIDENTIAL dihapus utuh, tanpa tag RESN kosongan', () => {
    const gedcom = exportGedcom70({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: { m1: 'CONFIDENTIAL' },
    }).gedcom
    // Event CONFIDENTIAL mengungguli record PRIVACY lalu dibuang
    // filter: struktur RESN hilang seluruhnya (notes/303).
    expect(resnLines(gedcom)).toEqual([])
    expect(gedcom).not.toContain('RESN')
  })

  it('t3: PRIVACY dari memberResn lolos ternormalisasi', () => {
    const gedcom = exportGedcom70({
      members: [member({ id: 'm1' })],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: { m1: 'privacy' },
    }).gedcom
    expect(resnLines(gedcom)).toEqual(['1 RESN PRIVACY'])
  })

  it('t4: LOCKED dari memberResn lolos ternormalisasi', () => {
    const gedcom = exportGedcom70({
      members: [member({ id: 'm1' })],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: { m1: 'locked' },
    }).gedcom
    expect(resnLines(gedcom)).toEqual(['1 RESN LOCKED'])
  })

  it('t5: precedence event mengungguli record RESN', () => {
    const base = {
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full' as const,
      exportedAt: EXPORTED_AT,
    }
    // Event LOCKED menang: record PRIVACY tidak tertulis.
    const locked = exportGedcom70({
      ...base,
      memberResn: { m1: 'LOCKED' },
    }).gedcom
    expect(resnLines(locked)).toEqual(['1 RESN LOCKED'])
    // Event CONFIDENTIAL menang lalu dibuang: tidak ada RESN.
    const confident = exportGedcom70({
      ...base,
      memberResn: { m1: 'CONFIDENTIAL' },
    }).gedcom
    expect(resnLines(confident)).toEqual([])
  })

  it('t6: memberResn nihil mempertahankan perilaku lama', () => {
    const full = exportGedcom70({
      members: [
        member({ id: 'm1' }),
        member({ id: 'm2', privacyStatus: 'shared' }),
      ],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: {},
    }).gedcom
    // Tanpa status private dan tanpa memberResn: tidak ada RESN.
    expect(resnLines(full)).toEqual([])
    // Mode clean tidak pernah menulis RESN record.
    const clean = exportGedcom70({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'clean',
      exportedAt: EXPORTED_AT,
    }).gedcom
    expect(resnLines(clean)).toEqual([])
  })

  it('t7: multi-nilai koma dan array dinormalisasi dedup urutan', () => {
    const base = {
      members: [member({ id: 'm1' })],
      relationships: [],
      privacyMode: 'full' as const,
      exportedAt: EXPORTED_AT,
    }
    const comma = exportGedcom70({
      ...base,
      memberResn: { m1: 'LOCKED, PRIVACY, LOCKED' },
    }).gedcom
    expect(resnLines(comma)).toEqual(['1 RESN LOCKED, PRIVACY'])
    const arr = exportGedcom70({
      ...base,
      memberResn: { m1: ['LOCKED', 'locked'] },
    }).gedcom
    expect(resnLines(arr)).toEqual(['1 RESN LOCKED'])
  })

  it('t8: exportGedzip meneruskan memberResn ke arsip', () => {
    const result = exportGedzip({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: { m1: 'LOCKED' },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const files = unzipSync(result.zip)
    const text = new TextDecoder().decode(files[GEDZIP_ENTRY_NAME])
    expect(resnLines(text)).toEqual(['1 RESN LOCKED'])
  })

  it('t9: memberResn untuk id tak dikenal tidak berefek', () => {
    const gedcom = exportGedcom70({
      members: [member({ id: 'm1' })],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      memberResn: { m9: 'LOCKED' },
    }).gedcom
    expect(resnLines(gedcom)).toEqual([])
  })
})
