/**
 * Test event entity reads (v381 AC1/AC3): paritas 100% legacy vs
 * entity untuk births-by-century dan deaths-by-century, kasus
 * undated, presisi parsial null, EXACT lengkap, input kosong, dan
 * filter subjectId kosong.
 */

import { describe, it, expect } from 'vitest'
import {
  entityBirthRecords,
  entityDeathRecords,
  entityWeddingRecords,
  entityDivorceRecords,
  computeBirthsByCenturyFromEvents,
  computeDeathsByCenturyFromEvents,
  computeWeddingsByCenturyFromEvents,
  computeDivorcesByCenturyFromEvents,
} from './event-entity-reads'
import {
  compareBirthsCenturyParity,
  compareDeathsCenturyParity,
  compareWeddingsCenturyParity,
  compareDivorcesCenturyParity,
  type EntityEventInput,
} from './event-entity-parity'
import {
  computeBirthsByCentury,
  type BirthRecord,
} from './births-by-century'
import {
  computeDeathsByCentury,
  type DeathRecord,
} from './deaths-by-century'
import {
  computeWeddingsByCentury,
  type WeddingRecord,
} from './weddings-by-century'
import {
  computeDivorcesByCentury,
  type DivorceRecord,
} from './divorces-by-century'

function event(partial: Partial<EntityEventInput>): EntityEventInput {
  return {
    subjectId: 'p1',
    partnerSubjectId: null,
    dateKind: null,
    yearStart: null,
    monthStart: null,
    dayStart: null,
    ...partial,
  }
}

describe('entityBirthRecords', () => {
  it('EXACT lengkap menjadi tanggal ISO', () => {
    const rows = entityBirthRecords([
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 1876, monthStart: 3, dayStart: 5 }),
    ])
    expect(rows).toEqual([{ personId: 'a', birthDate: '1876-03-05' }])
  })

  it('presisi parsial (bulan saja) menjadi null undated', () => {
    const rows = entityBirthRecords([
      event({ subjectId: 'a', dateKind: 'MONTH', yearStart: 1900, monthStart: 7, dayStart: null }),
    ])
    expect(rows).toEqual([{ personId: 'a', birthDate: null }])
  })

  it('EXACT tidak lengkap (hari null) menjadi null', () => {
    const rows = entityBirthRecords([
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 1900, monthStart: 7, dayStart: null }),
    ])
    expect(rows).toEqual([{ personId: 'a', birthDate: null }])
  })

  it('tanpa tanggal sama sekali menjadi null', () => {
    const rows = entityBirthRecords([event({ subjectId: 'a' })])
    expect(rows).toEqual([{ personId: 'a', birthDate: null }])
  })

  it('subjectId kosong difilter', () => {
    const rows = entityBirthRecords([event({ subjectId: '' })])
    expect(rows).toEqual([])
  })

  it('input kosong menghasilkan array kosong', () => {
    expect(entityBirthRecords([])).toEqual([])
  })
})

describe('entityDeathRecords', () => {
  it('EXACT lengkap menjadi tanggal ISO', () => {
    const rows = entityDeathRecords([
      event({ subjectId: 'b', dateKind: 'EXACT', yearStart: 1945, monthStart: 11, dayStart: 30 }),
    ])
    expect(rows).toEqual([{ personId: 'b', deathDate: '1945-11-30' }])
  })

  it('presisi parsial menjadi null undated', () => {
    const rows = entityDeathRecords([
      event({ subjectId: 'b', dateKind: 'YEAR', yearStart: 1945, monthStart: null, dayStart: null }),
    ])
    expect(rows).toEqual([{ personId: 'b', deathDate: null }])
  })
})

describe('computeBirthsByCenturyFromEvents', () => {
  it('agregasi abad dari baris LifeEvent ringkas', () => {
    const result = computeBirthsByCenturyFromEvents([
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 1850, monthStart: 1, dayStart: 2 }),
      event({ subjectId: 'b', dateKind: 'EXACT', yearStart: 1859, monthStart: 12, dayStart: 31 }),
      event({ subjectId: 'c', dateKind: 'EXACT', yearStart: 1901, monthStart: 6, dayStart: 3 }),
      event({ subjectId: 'd' }),
    ])
    expect(result.centuries).toEqual([
      { century: '1800', count: 2 },
      { century: '1900', count: 1 },
    ])
    expect(result.total).toBe(3)
    expect(result.undated).toBe(1)
  })

  it('input kosong: nihil abad, total 0, undated 0', () => {
    const result = computeBirthsByCenturyFromEvents([])
    expect(result.centuries).toEqual([])
    expect(result.total).toBe(0)
    expect(result.undated).toBe(0)
  })
})

describe('computeDeathsByCenturyFromEvents', () => {
  it('agregasi abad dari baris LifeEvent ringkas', () => {
    const result = computeDeathsByCenturyFromEvents([
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 1920, monthStart: 5, dayStart: 10 }),
      event({ subjectId: 'b', dateKind: 'EXACT', yearStart: 1920, monthStart: 8, dayStart: 2 }),
    ])
    expect(result.centuries).toEqual([{ century: '1900', count: 2 }])
    expect(result.total).toBe(2)
    expect(result.undated).toBe(0)
  })
})

describe('paritas 100% legacy vs entity (AC1)', () => {
  it('births: hasil entity identik legacy pada fixture sama', () => {
    const legacyRecords: BirthRecord[] = [
      { personId: 'a', birthDate: '1850-01-02' },
      { personId: 'b', birthDate: '1859-12-31' },
      { personId: 'c', birthDate: '1901-06-03' },
      { personId: 'd', birthDate: null },
    ]
    const entityEvents: EntityEventInput[] = [
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 1850, monthStart: 1, dayStart: 2 }),
      event({ subjectId: 'b', dateKind: 'EXACT', yearStart: 1859, monthStart: 12, dayStart: 31 }),
      event({ subjectId: 'c', dateKind: 'EXACT', yearStart: 1901, monthStart: 6, dayStart: 3 }),
      event({ subjectId: 'd' }),
    ]
    const legacy = computeBirthsByCentury(legacyRecords)
    const fromEntity = computeBirthsByCenturyFromEvents(entityEvents)
    expect(fromEntity).toEqual(legacy)
    const parity = compareBirthsCenturyParity(legacyRecords, entityEvents)
    expect(parity.match).toBe(true)
    expect(parity.diffs).toEqual([])
  })

  it('deaths: hasil entity identik legacy pada fixture sama', () => {
    const legacyRecords: DeathRecord[] = [
      { personId: 'a', deathDate: '1920-05-10' },
      { personId: 'b', deathDate: null },
    ]
    const entityEvents: EntityEventInput[] = [
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 1920, monthStart: 5, dayStart: 10 }),
      event({ subjectId: 'b' }),
    ]
    const legacy = computeDeathsByCentury(legacyRecords)
    const fromEntity = computeDeathsByCenturyFromEvents(entityEvents)
    expect(fromEntity).toEqual(legacy)
    const parity = compareDeathsCenturyParity(legacyRecords, entityEvents)
    expect(parity.match).toBe(true)
    expect(parity.diffs).toEqual([])
  })

  it('29 Feb kabisat valid dan paritas terjaga', () => {
    const legacyRecords: BirthRecord[] = [
      { personId: 'a', birthDate: '2000-02-29' },
    ]
    const entityEvents: EntityEventInput[] = [
      event({ subjectId: 'a', dateKind: 'EXACT', yearStart: 2000, monthStart: 2, dayStart: 29 }),
    ]
    expect(computeBirthsByCenturyFromEvents(entityEvents)).toEqual(
      computeBirthsByCentury(legacyRecords),
    )
    expect(compareBirthsCenturyParity(legacyRecords, entityEvents).match).toBe(true)
  })
})

describe('v382 entityWeddingRecords', () => {
  it('EXACT lengkap dengan partner menghasilkan familyId gabungan', () => {
    const rows = entityWeddingRecords([
      event({ subjectId: 'f1', partnerSubjectId: 'f2', dateKind: 'EXACT', yearStart: 1868, monthStart: 4, dayStart: 12 }),
    ])
    expect(rows).toEqual([{ familyId: 'f1<f2>', marriageDate: '1868-04-12' }])
  })

  it('partner kosong menghasilkan familyId subjectId saja', () => {
    const rows = entityWeddingRecords([event({ subjectId: 'solo', dateKind: 'EXACT', yearStart: 1870, monthStart: 1, dayStart: 1 })])
    expect(rows).toEqual([{ familyId: 'solo', marriageDate: '1870-01-01' }])
  })

  it('presisi parsial dan dateKind non-EXACT menjadi null', () => {
    const rows = entityWeddingRecords([
      event({ subjectId: 'a', partnerSubjectId: 'b', dateKind: 'YEAR', yearStart: 1880, monthStart: null, dayStart: null }),
      event({ subjectId: 'c', partnerSubjectId: 'd', dateKind: 'ABT', yearStart: 1882, monthStart: 6, dayStart: 15 }),
      event({ subjectId: 'e', partnerSubjectId: 'f', dateKind: 'BEF', yearStart: 1885, monthStart: 3, dayStart: 3 }),
      event({ subjectId: 'g', partnerSubjectId: 'h' }),
    ])
    expect(rows.map((r) => r.marriageDate)).toEqual([null, null, null, null])
  })

  it('pasangan berbeda menghasilkan familyId berbeda', () => {
    const rows = entityWeddingRecords([
      event({ subjectId: 'a', partnerSubjectId: 'b' }),
      event({ subjectId: 'b', partnerSubjectId: 'a' }),
      event({ subjectId: 'a', partnerSubjectId: 'c' }),
    ])
    expect(rows.map((r) => r.familyId)).toEqual(['a<b>', 'b<a>', 'a<c>'])
  })

  it('subjectId kosong difilter, input kosong aman', () => {
    expect(entityWeddingRecords([event({ subjectId: '' })])).toEqual([])
    expect(entityWeddingRecords([])).toEqual([])
  })
})

describe('v382 entityDivorceRecords', () => {
  it('EXACT lengkap dengan partner menghasilkan DivorceRecord', () => {
    const rows = entityDivorceRecords([
      event({ subjectId: 'f1', partnerSubjectId: 'f2', dateKind: 'EXACT', yearStart: 1901, monthStart: 9, dayStart: 2 }),
    ])
    expect(rows).toEqual([{ familyId: 'f1<f2>', divorceDate: '1901-09-02' }])
  })
})

describe('v382 agregasi weddings dari events', () => {
  it('agregasi abad dari baris LifeEvent MARRIAGE', () => {
    const result = computeWeddingsByCenturyFromEvents([
      event({ subjectId: 'a', partnerSubjectId: 'b', dateKind: 'EXACT', yearStart: 1848, monthStart: 5, dayStart: 20 }),
      event({ subjectId: 'c', partnerSubjectId: 'd', dateKind: 'EXACT', yearStart: 1851, monthStart: 8, dayStart: 9 }),
      event({ subjectId: 'e', partnerSubjectId: 'f' }),
    ])
    expect(result.centuries).toEqual([{ century: '1800', count: 2 }])
    expect(result.total).toBe(2)
    expect(result.undated).toBe(1)
  })
})

describe('v382 agregasi divorces dari events', () => {
  it('agregasi abad dari baris LifeEvent DIVORCE', () => {
    const result = computeDivorcesByCenturyFromEvents([
      event({ subjectId: 'a', partnerSubjectId: 'b', dateKind: 'EXACT', yearStart: 1925, monthStart: 2, dayStart: 14 }),
    ])
    expect(result.centuries).toEqual([{ century: '1900', count: 1 }])
    expect(result.total).toBe(1)
    expect(result.undated).toBe(0)
  })
})

describe('v382 paritas 100% weddings dan divorces (AC2)', () => {
  it('weddings: hasil entity identik legacy pada fixture sama', () => {
    const legacyRecords: WeddingRecord[] = [
      { familyId: 'a<b>', marriageDate: '1848-05-20' },
      { familyId: 'c<d>', marriageDate: null },
    ]
    const entityEvents: EntityEventInput[] = [
      event({ subjectId: 'a', partnerSubjectId: 'b', dateKind: 'EXACT', yearStart: 1848, monthStart: 5, dayStart: 20 }),
      event({ subjectId: 'c', partnerSubjectId: 'd' }),
    ]
    expect(computeWeddingsByCenturyFromEvents(entityEvents)).toEqual(
      computeWeddingsByCentury(legacyRecords),
    )
    const parity = compareWeddingsCenturyParity(legacyRecords, entityEvents)
    expect(parity.match).toBe(true)
    expect(parity.diffs).toEqual([])
  })

  it('divorces: hasil entity identik legacy pada fixture sama', () => {
    const legacyRecords: DivorceRecord[] = [
      { familyId: 'x<y>', divorceDate: '1925-02-14' },
      { familyId: 'p<q>', divorceDate: null },
    ]
    const entityEvents: EntityEventInput[] = [
      event({ subjectId: 'x', partnerSubjectId: 'y', dateKind: 'EXACT', yearStart: 1925, monthStart: 2, dayStart: 14 }),
      event({ subjectId: 'p', partnerSubjectId: 'q' }),
    ]
    expect(computeDivorcesByCenturyFromEvents(entityEvents)).toEqual(
      computeDivorcesByCentury(legacyRecords),
    )
    const parity = compareDivorcesCenturyParity(legacyRecords, entityEvents)
    expect(parity.match).toBe(true)
    expect(parity.diffs).toEqual([])
  })

  it('29 Feb kabisat valid dan paritas weddings terjaga', () => {
    const legacyRecords: WeddingRecord[] = [
      { familyId: 'a<b>', marriageDate: '2000-02-29' },
    ]
    const entityEvents: EntityEventInput[] = [
      event({ subjectId: 'a', partnerSubjectId: 'b', dateKind: 'EXACT', yearStart: 2000, monthStart: 2, dayStart: 29 }),
    ]
    expect(computeWeddingsByCenturyFromEvents(entityEvents)).toEqual(
      computeWeddingsByCentury(legacyRecords),
    )
    expect(compareWeddingsCenturyParity(legacyRecords, entityEvents).match).toBe(true)
  })
})
