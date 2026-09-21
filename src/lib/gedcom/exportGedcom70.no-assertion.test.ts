// Tests NO assertion export wiring (v137-ii-b): memberNoAssertions dan
// familyNoAssertions pada ExportGedcom70Input tersambung ke serialisasi
// GEDCOM 7. Cakupan: NO MARR di FAM, NO BURI di INDI, extTag underscore,
// multi assertion per record, DatePeriod FROM-TO, byte-identity tanpa
// input, round-trip import, dan idempotensi export dua kali.

import { describe, expect, it } from 'vitest'
import { exportGedcom70 } from './exportGedcom70'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'
import type { ParsedNoAssertion } from './no-assertion'

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

function rel(
  id: string,
  memberId: string,
  relatedId: string,
  type: MemberRelationship['type'],
): MemberRelationship {
  return { id, memberId, relatedId, type }
}

function couple(): {
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
} {
  return {
    members: [member({ id: 'a' }), member({ id: 'b', gender: 'female' })],
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
  // The vendored serializer only prints xrefs for records actually
  // pointed to: a linked INDI reads '0 @I1@ INDI', an isolated one is
  // a bare '0 INDI'. Accept both.
  const start = lines.findIndex(
    (l) => l === `0 ${tag}` || l === `0 @${xref}@ ${tag}`,
  )
  if (start === -1) return []
  const end = lines.findIndex((l, i) => i > start && l.startsWith('0 '))
  return lines.slice(start, end === -1 ? lines.length : end)
}

const BURI: ParsedNoAssertion[] = [{ event: 'BURI', date: 'TO 1900' }]
const MARR: ParsedNoAssertion[] = [{ event: 'MARR', date: 'TO 1900' }]

describe('exportGedcom70 NO assertion wiring (v137-ii-b)', () => {
  it('t1: INDI NO BURI dengan DATE TO 1900 ditulis di record INDI', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: { m1: BURI },
    })
    const indi = blockOf(gedcom, 'INDI')
    expect(indi).toContain('1 NO BURI')
    expect(indi).toContain('2 DATE TO 1900')
  })

  it('t2: FAM NO MARR dengan DATE TO 1900 ditulis di record FAM', () => {
    const { gedcom } = exportGedcom70({
      ...couple(),
      exportedAt: EXPORTED_AT,
      familyNoAssertions: { 'a,b': MARR },
    })
    const fam = blockOf(gedcom, 'FAM', 'F1')
    expect(fam).toContain('1 NO MARR')
    expect(fam).toContain('2 DATE TO 1900')
  })

  it('t3: extTag _MYEVENT diterima sebagai payload NO', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: { m1: [{ event: '_MYEVENT' }] },
    })
    expect(blockOf(gedcom, 'INDI')).toContain('1 NO _MYEVENT')
  })

  it('t4: multi assertion dalam satu INDI, urutan terjaga', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: {
        m1: [
          { event: 'MARR', date: 'TO 1900' },
          { event: 'DIV' },
        ],
      },
    })
    const indi = blockOf(gedcom, 'INDI')
    expect(indi.indexOf('1 NO MARR')).toBeLessThan(indi.indexOf('1 NO DIV'))
  })

  it('t5: multi assertion dalam satu FAM, urutan terjaga', () => {
    const { gedcom } = exportGedcom70({
      ...couple(),
      exportedAt: EXPORTED_AT,
      familyNoAssertions: {
        'a,b': [{ event: 'MARR' }, { event: 'ENGA', date: 'FROM 1900 TO 1950' }],
      },
    })
    const fam = blockOf(gedcom, 'FAM', 'F1')
    expect(fam).toContain('1 NO MARR')
    expect(fam).toContain('1 NO ENGA')
    expect(fam).toContain('2 DATE FROM 1900 TO 1950')
  })

  it('t6: DatePeriod FROM-TO diteruskan verbatim di INDI', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: {
        m1: [{ event: 'BURI', date: 'FROM 1900 TO 1950' }],
      },
    })
    expect(blockOf(gedcom, 'INDI')).toContain(
      '2 DATE FROM 1900 TO 1950',
    )
  })

  it('t7: assertion tanpa date menulis baris NO saja tanpa sub-line DATE', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1', birthDate: undefined })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: { m1: [{ event: 'MARR' }] },
    })
    const indi = blockOf(gedcom, 'INDI')
    expect(indi).toContain('1 NO MARR')
    expect(indi.some((l) => l.startsWith('2 DATE'))).toBe(false)
  })

  it('t8: tanpa input NO keluaran byte-identik (omit vs record kosong)', () => {
    const base = couple()
    const a = exportGedcom70({
      ...base,
      exportedAt: EXPORTED_AT,
    }).gedcom
    const b = exportGedcom70({
      ...base,
      exportedAt: EXPORTED_AT,
      memberNoAssertions: {},
      familyNoAssertions: {},
    }).gedcom
    expect(a).toBe(b)
    expect(a).not.toContain(' NO ')
  })

  it('t9: payload event tidak valid dilewati, tidak menulis baris NO', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: {
        m1: [{ event: 'NOTANEVENT' }, { event: 'MARR' }],
      },
    })
    const indi = blockOf(gedcom, 'INDI')
    expect(indi).not.toContain('NO NOTANEVENT')
    expect(indi).toContain('1 NO MARR')
  })

  it('t10: kunci family salah tidak menulis NO', () => {
    const { gedcom } = exportGedcom70({
      ...couple(),
      exportedAt: EXPORTED_AT,
      familyNoAssertions: { 'b,a': MARR },
    })
    expect(gedcom).not.toContain('1 NO MARR')
  })

  it('t11: round-trip importIndividuals mengembalikan assertions sama', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: { m1: BURI },
    })
    const indis = importIndividuals(gedcom)
    expect(indis[0].noAssertions).toEqual(BURI)
  })

  it('t12: round-trip importFamilies mengembalikan assertions sama', () => {
    const { gedcom } = exportGedcom70({
      ...couple(),
      exportedAt: EXPORTED_AT,
      familyNoAssertions: { 'a,b': MARR },
    })
    const fams = importFamilies(gedcom)
    expect(fams[0].noAssertions).toEqual(MARR)
  })

  it('t13: idempoten, export dua kali hasil string persis sama', () => {
    const input = {
      ...couple(),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: { a: BURI },
      familyNoAssertions: { 'a,b': MARR },
    }
    const first = exportGedcom70(input).gedcom
    const second = exportGedcom70(input).gedcom
    expect(first).toBe(second)
  })

  it('t14: array kosong tidak menulis baris NO', () => {
    const { gedcom } = exportGedcom70({
      ...solo([member({ id: 'm1' })]),
      exportedAt: EXPORTED_AT,
      memberNoAssertions: { m1: [] },
    })
    expect(gedcom).not.toContain(' NO ')
  })
})
