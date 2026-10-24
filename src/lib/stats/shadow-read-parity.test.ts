import { describe, expect, it } from 'vitest'
import { runShadowReadParity, type ShadowReadInput } from './shadow-read-parity'
import type { EntityEventInput } from './event-entity-parity'

function exact(year: number, month: number, day: number): EntityEventInput {
  return { subjectId: 'p', partnerSubjectId: null, dateKind: 'EXACT', yearStart: year, monthStart: month, dayStart: day }
}

function partial(year: number): EntityEventInput {
  return { subjectId: 'p', partnerSubjectId: null, dateKind: 'EXACT', yearStart: year, monthStart: null, dayStart: null }
}

const matchPenuh: ShadowReadInput = {
  birthsLegacy: [{ personId: 'p', birthDate: '1875-03-12' }],
  birthsEntity: [exact(1875, 3, 12)],
  deathsLegacy: [{ personId: 'p', deathDate: null }],
  deathsEntity: [partial(1955)],
  weddingsLegacy: [{ familyId: 'f', marriageDate: '1946-06-01' }],
  weddingsEntity: [{ subjectId: 'f', partnerSubjectId: 'g', dateKind: 'EXACT', yearStart: 1946, monthStart: 6, dayStart: 1 }],
  divorcesLegacy: [{ familyId: 'f', divorceDate: null }],
  divorcesEntity: [{ subjectId: 'f', partnerSubjectId: null, dateKind: 'ABOUT', yearStart: null, monthStart: null, dayStart: null }],
}

const mismatchBirths: ShadowReadInput = {
  ...matchPenuh,
  birthsLegacy: [{ personId: 'p', birthDate: '1875-03-12' }, { personId: 'q', birthDate: '1901-01-01' }],
  birthsEntity: [exact(1875, 3, 12)],
}

describe('shadow-read-parity v384 harness', () => {
  it('match penuh: allMatch true, diffs kosong, fingerprint sha256 stabil', () => {
    const r1 = runShadowReadParity(matchPenuh)
    const r2 = runShadowReadParity(matchPenuh)
    expect(r1.allMatch).toBe(true)
    expect(r1.modules).toHaveLength(4)
    for (const m of r1.modules) {
      expect(m.match).toBe(true)
      expect(m.diffs).toEqual([])
      expect(m.fingerprint).toMatch(/^[0-9a-f]{64}$/)
    }
    expect(r1.fingerprint).toMatch(/^[0-9a-f]{64}$/)
    expect(r1.fingerprint).toBe(r2.fingerprint)
    expect(r1.modules.map((m) => m.module)).toEqual([
      'births-by-century',
      'deaths-by-century',
      'weddings-by-century',
      'divorces-by-century',
    ])
  })

  it('mismatch terdeteksi: diff berisi label, match false, fingerprint berubah', () => {
    const rMatch = runShadowReadParity(matchPenuh)
    const rDiff = runShadowReadParity(mismatchBirths)
    const births = rDiff.modules.find((m) => m.module === 'births-by-century')
    expect(births).toBeDefined()
    expect(births!.match).toBe(false)
    expect(births!.diffs.length).toBeGreaterThan(0)
    expect(births!.diffs.join('\n')).toContain('1900')
    expect(rDiff.allMatch).toBe(false)
    expect(rDiff.fingerprint).not.toBe(rMatch.fingerprint)
  })

  it('fingerprint menangkap perubahan diffs meski urutan input sama', () => {
    const a = runShadowReadParity(matchPenuh)
    const b = runShadowReadParity({ ...matchPenuh, deathsLegacy: [{ personId: 'p', deathDate: '2001-01-15' }], deathsEntity: [exact(2001, 1, 15)] })
    expect(b.allMatch).toBe(true)
    expect(b.fingerprint).not.toBe(a.fingerprint)
  })
})
