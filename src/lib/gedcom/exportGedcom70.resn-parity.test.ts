// Test flag exportPrivacyParity (v135-ii): RESN PRIVACY ikut dibuang
// dari hasil ekspor bila flag aktif. Cakupan: byte-identity saat flag
// false atau absen (perilaku merged v135 utuh), pembuangan PRIVACY dan
// CONFIDENTIAL saat flag true, LOCKED tetap lolos, kombinasi multi
// nilai, dan penerusan flag lewat jalur exportGedzip.

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

describe('exportGedcom70 privacy parity flag (v135-ii)', () => {
  it('t1: flag absen dan flag false menghasilkan byte identik', () => {
    const input = {
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full' as const,
      exportedAt: EXPORTED_AT,
    }
    const absent = exportGedcom70(input).gedcom
    const explicitFalse = exportGedcom70({
      ...input,
      exportPrivacyParity: false,
    }).gedcom
    expect(explicitFalse).toBe(absent)
  })

  it('t2: flag false byte-identik dengan perilaku merged (PRIVACY tertulis)', () => {
    const input = {
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full' as const,
      exportedAt: EXPORTED_AT,
    }
    const baseline = exportGedcom70(input).gedcom
    const flagged = exportGedcom70({
      ...input,
      exportPrivacyParity: false,
      memberResn: { m1: 'LOCKED, PRIVACY' },
    }).gedcom
    const unflagged = exportGedcom70({
      ...input,
      memberResn: { m1: 'LOCKED, PRIVACY' },
    }).gedcom
    // Tanpa flag aktif, hasil sama persis dengan perilaku merged:
    // multi nilai tertulis normal, record PRIVACY lolos filter.
    expect(flagged).toBe(unflagged)
    expect(resnLines(baseline)).toEqual(['1 RESN PRIVACY'])
    expect(resnLines(flagged)).toEqual(['1 RESN LOCKED, PRIVACY'])
  })

  it('t3: flag true membuang record RESN PRIVACY sampai habis', () => {
    const gedcom = exportGedcom70({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      exportPrivacyParity: true,
    }).gedcom
    expect(resnLines(gedcom)).toEqual([])
    expect(gedcom).not.toContain('RESN')
  })

  it('t4: flag true membuang PRIVACY dari memberResn (event level)', () => {
    const gedcom = exportGedcom70({
      members: [member({ id: 'm1' })],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      exportPrivacyParity: true,
      memberResn: { m1: 'privacy' },
    }).gedcom
    expect(resnLines(gedcom)).toEqual([])
    expect(gedcom).not.toContain('RESN')
  })

  it('t5: flag true dengan CONFIDENTIAL tetap tanpa tag RESN', () => {
    const gedcom = exportGedcom70({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      exportPrivacyParity: true,
      memberResn: { m1: 'CONFIDENTIAL' },
    }).gedcom
    // CONFIDENTIAL selalu dibuang filter terlepas dari nilai flag.
    expect(resnLines(gedcom)).toEqual([])
    expect(gedcom).not.toContain('RESN')
  })

  it('t6: flag true tetap menuliskan LOCKED', () => {
    const gedcom = exportGedcom70({
      members: [member({ id: 'm1' })],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      exportPrivacyParity: true,
      memberResn: { m1: 'locked' },
    }).gedcom
    expect(resnLines(gedcom)).toEqual(['1 RESN LOCKED'])
  })

  it('t7: flag true pada multi nilai hanya menyisakan LOCKED', () => {
    const gedcom = exportGedcom70({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      exportPrivacyParity: true,
      memberResn: { m1: 'LOCKED, PRIVACY' },
    }).gedcom
    expect(resnLines(gedcom)).toEqual(['1 RESN LOCKED'])
  })

  it('t8: exportGedzip meneruskan flag ke isi arsip', () => {
    const result = exportGedzip({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
      exportPrivacyParity: true,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const files = unzipSync(result.zip)
    const text = new TextDecoder().decode(files[GEDZIP_ENTRY_NAME])
    expect(resnLines(text)).toEqual([])
    // Pembanding: tanpa flag, arsip yang sama memuat RESN PRIVACY.
    const unflagged = exportGedzip({
      members: [privateLiving()],
      relationships: [],
      privacyMode: 'full',
      exportedAt: EXPORTED_AT,
    })
    expect(unflagged.ok).toBe(true)
    if (!unflagged.ok) return
    const files2 = unzipSync(unflagged.zip)
    const text2 = new TextDecoder().decode(files2[GEDZIP_ENTRY_NAME])
    expect(resnLines(text2)).toEqual(['1 RESN PRIVACY'])
  })
})
