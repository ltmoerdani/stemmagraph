// Unit test modul paritas dual-read (v380): ISO dari PartialDate,
// paritas lulus di fixture untuk empat modul abad, selisih terdeteksi
// saat sumbernya beda, dan perilaku presisi parsial (undated). Tanpa
// DB sama sekali.

import { describe, expect, it } from 'vitest'
import {
  compareBirthsCenturyParity,
  compareDeathsCenturyParity,
  compareDivorcesCenturyParity,
  compareWeddingsCenturyParity,
  isoDateFromPartial,
  type EntityEventInput,
} from './event-entity-parity'

function exactEvent(overrides: Partial<EntityEventInput> = {}): EntityEventInput {
  return {
    subjectId: 'p1',
    partnerSubjectId: null,
    dateKind: 'EXACT',
    yearStart: 1874,
    monthStart: 3,
    dayStart: 12,
    ...overrides,
  }
}

describe('isoDateFromPartial', () => {
  it('EXACT lengkap menghasilkan ISO berpadding nol', () => {
    expect(isoDateFromPartial('EXACT', 874, 3, 12)).toBe('0874-03-12')
    expect(isoDateFromPartial('EXACT', 1874, 3, 12)).toBe('1874-03-12')
  })

  it('selain EXACT atau komponen parsial: null (undated, jangan mengarang presisi)', () => {
    expect(isoDateFromPartial('ABOUT', 1874, null, null)).toBeNull()
    expect(isoDateFromPartial('RANGE', 1874, 3, 12)).toBeNull()
    expect(isoDateFromPartial('EXACT', 1874, null, 12)).toBeNull()
    expect(isoDateFromPartial(null, 1874, 3, 12)).toBeNull()
  })
})

describe('paritas fixture - lulus', () => {
  it('births: kolom String legacy vs LifeEvent BIRTH angka sama', () => {
    const legacy = [
      { personId: 'p1', birthDate: '1874-03-12' },
      { personId: 'p2', birthDate: '1874-07-01' },
      { personId: 'p3', birthDate: '1950-11-30' },
      { personId: 'p4', birthDate: null },
    ]
    const entity: EntityEventInput[] = [
      exactEvent({ subjectId: 'p1' }),
      exactEvent({ subjectId: 'p2', monthStart: 7, dayStart: 1 }),
      exactEvent({ subjectId: 'p3', yearStart: 1950, monthStart: 11, dayStart: 30 }),
      exactEvent({ subjectId: 'p4', dateKind: null, yearStart: null, monthStart: null, dayStart: null }),
    ]
    const result = compareBirthsCenturyParity(legacy, entity)
    expect(result.match).toBe(true)
    expect(result.diffs).toEqual([])
  })

  it('deaths: kolom String legacy vs LifeEvent DEATH angka sama', () => {
    const legacy = [
      { personId: 'p1', deathDate: '1938-05-20' },
      { personId: 'p2', deathDate: '1938-05-21' },
      { personId: 'p3', deathDate: null },
    ]
    const entity: EntityEventInput[] = [
      exactEvent({ subjectId: 'p1', yearStart: 1938, monthStart: 5, dayStart: 20 }),
      exactEvent({ subjectId: 'p2', yearStart: 1938, monthStart: 5, dayStart: 21 }),
      exactEvent({ subjectId: 'p3', dateKind: null, yearStart: null, monthStart: null, dayStart: null }),
    ]
    const result = compareDeathsCenturyParity(legacy, entity)
    expect(result.match).toBe(true)
  })

  it('weddings: agregat keluarga legacy vs LifeEvent MARRIAGE dua member', () => {
    const legacy = [
      { familyId: 'f1', marriageDate: '1900-01-15' },
      { familyId: 'f2', marriageDate: '1965-06-05' },
      { familyId: 'f3', marriageDate: null },
    ]
    const entity: EntityEventInput[] = [
      exactEvent({ subjectId: 'm1', partnerSubjectId: 'm2', yearStart: 1900, monthStart: 1, dayStart: 15 }),
      exactEvent({ subjectId: 'm3', partnerSubjectId: 'm4', yearStart: 1965, monthStart: 6, dayStart: 5 }),
      exactEvent({ subjectId: 'm5', partnerSubjectId: 'm6', dateKind: null, yearStart: null, monthStart: null, dayStart: null }),
    ]
    const result = compareWeddingsCenturyParity(legacy, entity)
    expect(result.match).toBe(true)
  })

  it('divorces: agregat keluarga legacy vs LifeEvent DIVORCE', () => {
    const legacy = [
      { familyId: 'f1', divorceDate: '1972-09-01' },
      { familyId: 'f2', divorceDate: null },
    ]
    const entity: EntityEventInput[] = [
      exactEvent({ subjectId: 'm1', partnerSubjectId: 'm2', yearStart: 1972, monthStart: 9, dayStart: 1 }),
      exactEvent({ subjectId: 'm3', partnerSubjectId: 'm4', dateKind: null, yearStart: null, monthStart: null, dayStart: null }),
    ]
    const result = compareDivorcesCenturyParity(legacy, entity)
    expect(result.match).toBe(true)
  })
})

describe('paritas fixture - selisih terdeteksi', () => {
  it('count abad beda: match false dengan pesan selisih', () => {
    const legacy = [{ personId: 'p1', birthDate: '1874-03-12' }]
    const entity = [exactEvent({ subjectId: 'p1' }), exactEvent({ subjectId: 'p2' })]
    const result = compareBirthsCenturyParity(legacy, entity)
    expect(result.match).toBe(false)
    expect(result.diffs.length).toBeGreaterThan(0)
    expect(result.diffs[0]).toContain('births-by-century')
  })

  it('undated beda terdeteksi', () => {
    const legacy = [{ personId: 'p1', birthDate: null }]
    const entity = [exactEvent({ subjectId: 'p1' })]
    const result = compareBirthsCenturyParity(legacy, entity)
    expect(result.match).toBe(false)
    expect(result.diffs.some((d) => d.includes('undated'))).toBe(true)
  })

  it('presisi parsial di sisi entity jatuh ke undated dan selisihnya dilaporkan', () => {
    const legacy = [{ personId: 'p1', birthDate: '1874-03-12' }]
    const entity = [exactEvent({ subjectId: 'p1', dateKind: 'ABOUT', dayStart: null })]
    const result = compareBirthsCenturyParity(legacy, entity)
    expect(result.match).toBe(false)
  })
})
