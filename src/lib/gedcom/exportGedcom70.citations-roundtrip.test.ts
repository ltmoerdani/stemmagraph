// Tests event-level SOURCE citation export wiring (v151-iii):
// memberEventCitations dan familyEventCitations pada ExportGedcom70Input
// tersambung ke struktur event BIRT/DEAT (INDI) dan MARR/DIV (FAM).
// Cakupan: SOUR event-level verbatim (payload '@X@' ditulis serializer
// sebagai '@@X@', unpescape fromString mengembalikan '@X@'),
// PAGE/QUAY/NOTE sub-line, multi citation, event tak tercipta nihil
// output, paritas privasi v135 (BIRT redacted ter-skip), byte-identity
// tanpa input.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'
import type { ParsedCitation } from './citation'

const EXPORTED_AT = new Date('2026-09-23T00:00:00Z')

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
  return { id, memberId, relatedId, type }
}

function couple(maritalStatus: 'married' | 'divorced'): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return {
    members: [
      member({ id: 'a', maritalStatus }),
      member({ id: 'b', gender: 'female', maritalStatus }),
    ],
    relationships: [rel('r1', 'a', 'b', 'spouse')],
  }
}

function solo(members: FamilyMemberRecord[]): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return { members, relationships: [] }
}

/** Lines of one record block (INDI/FAM), from its 0-line to the next 0-line. */
function blockOf(gedcom: string, tag: string, xref = 'I1'): string[] {
  const lines = gedcom.split('\n')
  const start = lines.findIndex(
    (l) => l === `0 ${tag}` || l === `0 @${xref}@ ${tag}`,
  )
  if (start === -1) return []
  const end = lines.findIndex((l, i) => i > start && l.startsWith('0 '))
  return lines.slice(start, end === -1 ? lines.length : end)
}

const S1: ParsedCitation = { sourcePointer: '@S1@' }

function exportSolo(
  m: FamilyMemberRecord,
  citations?: Record<string, ParsedCitation[]>,
): string {
  return exportGedcom70({
    ...solo([m]),
    exportedAt: EXPORTED_AT,
    memberEventCitations: citations,
  }).gedcom
}

function exportFam(
  maritalStatus: 'married' | 'divorced',
  citations?: Record<string, ParsedCitation[]>,
): string {
  return exportGedcom70({
    ...couple(maritalStatus),
    exportedAt: EXPORTED_AT,
    familyEventCitations: citations,
  }).gedcom
}

describe('exportGedcom70 event citation wiring (v151-iii)', () => {
  it('t1: SOUR event-level BIRT individu ditulis di bawah BIRT', () => {
    const indi = blockOf(exportSolo(member({ id: 'm1' }), { 'm1:BIRT': [S1] }), 'INDI')
    expect(indi).toContain('1 BIRT')
    expect(indi).toContain('2 SOUR @@S1@')
    expect(indi.indexOf('2 DATE 1 JAN 1990')).toBeLessThan(
      indi.indexOf('2 SOUR @@S1@'),
    )
  })

  it('t2: SOUR MARR keluarga ditulis di bawah MARR, key peserta terurut', () => {
    const fam = blockOf(
      exportFam('married', { 'a,b:MARR': [{ sourcePointer: '@S2@' }] }),
      'FAM',
      'F1',
    )
    expect(fam).toContain('1 MARR Y')
    expect(fam).toContain('2 SOUR @@S2@')
    expect(fam.indexOf('1 MARR Y')).toBeLessThan(fam.indexOf('2 SOUR @@S2@'))
  })

  it('t3: input absent atau kosong menghasilkan output byte-identical', () => {
    const base = exportGedcom70({ ...solo([member({ id: 'm1' })]), exportedAt: EXPORTED_AT })
    const absent = exportSolo(member({ id: 'm1' }))
    const empty = exportSolo(member({ id: 'm1' }), {})
    expect(absent).toBe(base.gedcom)
    expect(empty).toBe(base.gedcom)
  })

  it('t4: PAGE, QUAY, dan NOTE ditulis verbatim sebagai sub-line SOUR', () => {
    const indi = blockOf(
      exportSolo(member({ id: 'm1' }), {
        'm1:BIRT': [
          { sourcePointer: '@S3@', page: 'p. 42', quay: '3', note: 'catatan keluarga' },
        ],
      }),
      'INDI',
    )
    expect(indi).toContain('2 SOUR @@S3@')
    expect(indi).toContain('3 PAGE p. 42')
    expect(indi).toContain('3 QUAY 3')
    expect(indi).toContain('3 NOTE catatan keluarga')
  })

  it('t5: multi citation satu event menjadi beberapa SOUR berurutan', () => {
    const indi = blockOf(
      exportSolo(member({ id: 'm1' }), {
        'm1:BIRT': [
          { sourcePointer: '@S1@' },
          { sourcePointer: '@S2@', page: 'hlm 7' },
        ],
      }),
      'INDI',
    )
    const first = indi.indexOf('2 SOUR @@S1@')
    const second = indi.indexOf('2 SOUR @@S2@')
    expect(first).toBeGreaterThan(-1)
    expect(second).toBeGreaterThan(first)
    expect(indi[second + 1]).toBe('3 PAGE hlm 7')
  })

  it('t6: citation untuk event yang tidak tercipta nihil output', () => {
    // isAlive true tanpa deathDate: DEAT tidak pernah dibuat.
    // ('1 SOUR' HEAD milik HEAD record, bukan event citation.)
    const gedcom = exportSolo(member({ id: 'm1' }), { 'm1:DEAT': [S1] })
    expect(gedcom).not.toContain('2 SOUR')
    expect(gedcom).not.toContain('1 DEAT')
  })

  it('t7: BIRT anggota living redacted: citation ter-skip, paritas v135', () => {
    const input = {
      ...solo([member({ id: 'm1', privacyStatus: 'private' })]),
      exportedAt: EXPORTED_AT,
      privacyMode: 'clean' as const,
      memberEventCitations: { 'm1:BIRT': [S1] },
    }
    const gedcom = exportGedcom70(input).gedcom
    const indi = blockOf(gedcom, 'INDI')
    expect(gedcom).toContain('[Living]')
    expect(indi).not.toContain('1 BIRT')
    expect(indi).not.toContain('SOUR')
  })

  it('t8: SOUR event-level DEAT individu ditulis di bawah DEAT', () => {
    const indi = blockOf(
      exportSolo(
        member({ id: 'm1', isAlive: false, deathDate: '5 JUN 1970' }),
        { 'm1:DEAT': [{ sourcePointer: '@S4@' }] },
      ),
      'INDI',
    )
    expect(indi).toContain('1 DEAT')
    expect(indi).toContain('2 SOUR @@S4@')
  })

  it('t9: SOUR DIV keluarga ditulis di bawah DIV', () => {
    const fam = blockOf(
      exportFam('divorced', { 'a,b:DIV': [{ sourcePointer: '@S5@' }] }),
      'FAM',
      'F1',
    )
    expect(fam).toContain('1 DIV Y')
    expect(fam).toContain('2 SOUR @@S5@')
    expect(fam.indexOf('1 DIV Y')).toBeLessThan(fam.indexOf('2 SOUR @@S5@'))
  })
})
