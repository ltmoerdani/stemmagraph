import { describe, expect, it } from 'vitest'
import {
  computeDivorceWidowhood,
  divorceWidowhoodFromRaw,
  parseFamilyUnions,
  type DivorceWidowhoodPayload,
  type FamilyUnionInput,
} from './divorce-widowhood'

function exact(y: number, m: number, d: number) {
  return { dateKind: 'EXACT', yearStart: y, monthStart: m, dayStart: d }
}

function nonExact(y: number | null, m: number | null, d: number | null) {
  return { dateKind: 'ABOUT', yearStart: y, monthStart: m, dayStart: d }
}

function union(partial: Partial<FamilyUnionInput>): FamilyUnionInput {
  return {
    unionId: 'U',
    marriageDate: null,
    divorceDate: null,
    spouses: [],
    ...partial,
  }
}

function spouse(id: string, sex: 'M' | 'F', death: unknown = null) {
  return { id, sex, deathDate: death }
}

function fullPipe(raw: unknown): DivorceWidowhoodPayload {
  return divorceWidowhoodFromRaw(raw)
}

describe('divorce cohort rate', () => {
  it('satu dekade: 1 dari 4 union bercerai, ratePct 50', () => {
    const out = computeDivorceWidowhood([
      union({ unionId: 'a', marriageDate: exact(1952, 3, 10) }),
      union({ unionId: 'b', marriageDate: exact(1955, 7, 1), divorceDate: exact(1960, 1, 5) }),
      union({ unionId: 'c', marriageDate: exact(1958, 12, 31) }),
      union({ unionId: 'd', marriageDate: exact(1950, 1, 1), divorceDate: exact(1951, 6, 6) }),
    ])
    expect(out.decades).toEqual([
      { decadeStart: 1950, label: '1950s', denominator: 4, divorces: 2, ratePct: 50 },
    ])
    expect(out.exactMarriages).toBe(4)
    expect(out.divorces).toBe(2)
    expect(out.totalUnions).toBe(4)
  })

  it('multi dekade urut ascending hanya dekade berdenominator positif', () => {
    const out = computeDivorceWidowhood([
      union({ unionId: 'a', marriageDate: exact(1971, 5, 5), divorceDate: exact(1972, 5, 5) }),
      union({ unionId: 'b', marriageDate: exact(1969, 2, 2), divorceDate: exact(1970, 2, 2) }),
      union({ unionId: 'c', marriageDate: exact(1978, 8, 8) }),
      union({ unionId: 'd', divorceDate: exact(1975, 1, 1) }),
    ])
    expect(out.decades).toEqual([
      { decadeStart: 1960, label: '1960s', denominator: 1, divorces: 1, ratePct: 100 },
      { decadeStart: 1970, label: '1970s', denominator: 2, divorces: 1, ratePct: 50 },
    ])
    expect(out.divorces).toBe(3)
    expect(out.exactMarriages).toBe(3)
  })

  it('union tanpa tanggal gugur tetap masuk denominator', () => {
    const out = computeDivorceWidowhood([
      union({ unionId: 'a', marriageDate: exact(1943, 4, 4) }),
      union({ unionId: 'b', marriageDate: exact(1944, 5, 5) }),
    ])
    expect(out.decades).toEqual([
      { decadeStart: 1940, label: '1940s', denominator: 2, divorces: 0, ratePct: 0 },
    ])
  })

  it('dateKind non-EXACT: hanya marriage EXACT yang masuk denominator', () => {
    const out = computeDivorceWidowhood([
      union({ unionId: 'a', marriageDate: nonExact(1951, 1, 1), divorceDate: exact(1952, 1, 1) }),
      union({ unionId: 'b', marriageDate: exact(1951, 1, 1), divorceDate: nonExact(1952, 1, 1) }),
      union({ unionId: 'c', marriageDate: nonExact(1951, 1, 1), divorceDate: nonExact(1951, 2, 2) }),
    ])
    // Union b tetap masuk denominator (marriage EXACT), divorce non-EXACT tak dihitung.
    expect(out.decades).toEqual([
      { decadeStart: 1950, label: '1950s', denominator: 1, divorces: 0, ratePct: 0 },
    ])
    expect(out.exactMarriages).toBe(1)
    // Counter global divorces tetap menghitung divorce EXACT (union a)
    // meski marriage-nya non-EXACT dan tak masuk cohort dekade.
    expect(out.divorces).toBe(1)
  })

  it('pembulatan ratePct 1 desimal: 1 dari 3 = 33,3', () => {
    const out = computeDivorceWidowhood([
      union({ unionId: 'a', marriageDate: exact(1961, 1, 1), divorceDate: exact(1962, 1, 1) }),
      union({ unionId: 'b', marriageDate: exact(1962, 2, 2) }),
      union({ unionId: 'c', marriageDate: exact(1963, 3, 3) }),
    ])
    expect(out.decades[0].ratePct).toBe(33.3)
  })
})

describe('parser strict', () => {
  it('payload bukan array: lempar', () => {
    expect(() => parseFamilyUnions({})).toThrowError(/payload bukan array/)
  })

  it('elemen union bukan objek: lempar dengan indeks', () => {
    expect(() => parseFamilyUnions(['x'])).toThrowError(/unions\[0\]: bukan objek/)
  })

  it('unionId bukan string: lempar', () => {
    expect(() => parseFamilyUnions([{ unionId: 5, marriageDate: null, divorceDate: null, spouses: [] }])).toThrowError(/unionId: bukan string/)
  })

  it('spouses bukan array: lempar', () => {
    expect(() => parseFamilyUnions([{ unionId: 'u', marriageDate: null, divorceDate: null, spouses: 'no' }])).toThrowError(/spouses: bukan array/)
  })

  it('elemen spouses bukan objek dan id bukan string: lempar dengan indeks ganda', () => {
    expect(() =>
      parseFamilyUnions([{ unionId: 'u', marriageDate: null, divorceDate: null, spouses: [{ id: 's', sex: 'M', deathDate: null }, 42] }]),
    ).toThrowError(/spouses\[1\]: bukan objek/)
    expect(() =>
      parseFamilyUnions([{ unionId: 'u', marriageDate: null, divorceDate: null, spouses: [{ id: 7, sex: 'M', deathDate: null }] }]),
    ).toThrowError(/spouses\[0\].id: bukan string/)
  })

  it('sex bukan M atau F: lempar', () => {
    expect(() =>
      parseFamilyUnions([{ unionId: 'u', marriageDate: null, divorceDate: null, spouses: [{ id: 's', sex: 'X', deathDate: null }] }]),
    ).toThrowError(/sex: bukan M atau F/)
  })

  it('tanggal bukan objek atau null: lempar', () => {
    expect(() =>
      parseFamilyUnions([{ unionId: 'u', marriageDate: 20200101, divorceDate: null, spouses: [] }]),
    ).toThrowError(/marriageDate: bukan objek atau null/)
  })

  it('field StdDate bukan number atau null: lempar', () => {
    expect(() =>
      parseFamilyUnions([
        {
          unionId: 'u',
          marriageDate: { dateKind: 'EXACT', yearStart: 'x', monthStart: 1, dayStart: 1 },
          divorceDate: null,
          spouses: [],
        },
      ]),
    ).toThrowError(/yearStart: bukan number atau null/)
  })
})

describe('widowhood interval', () => {
  it('survivor: suami mati dulu (earlier), interval milik suami', () => {
    const out = computeDivorceWidowhood([
      union({
        unionId: 'u1',
        spouses: [spouse('h', 'M', exact(1980, 6, 15)), spouse('w', 'F', exact(1995, 3, 20))],
      }),
    ])
    expect(out.widowhood.survivors).toEqual([
      { sex: 'M', count: 1, medianYears: 14, intervals: [14] },
    ])
    expect(out.widowhoodPairs).toBe(1)
  })

  it('survivor: istri mati dulu, interval milik F, anniversary belum tercapai kurangi 1', () => {
    const out = computeDivorceWidowhood([
      union({
        unionId: 'u1',
        spouses: [spouse('h', 'M', exact(2000, 8, 10)), spouse('w', 'F', exact(1975, 9, 15))],
      }),
    ])
    expect(out.widowhood.survivors).toEqual([
      { sex: 'F', count: 1, medianYears: 24, intervals: [24] },
    ])
  })

  it('tanggal kematian sama persis: pasangan gugur', () => {
    const out = computeDivorceWidowhood([
      union({
        unionId: 'u1',
        spouses: [spouse('h', 'M', exact(1990, 1, 1)), spouse('w', 'F', exact(1990, 1, 1))],
      }),
    ])
    expect(out.widowhood.survivors).toEqual([])
    expect(out.widowhoodPairs).toBe(0)
  })

  it('kematian non-EXACT: pasangan gugur meski sex lengkap', () => {
    const out = computeDivorceWidowhood([
      union({
        unionId: 'u1',
        spouses: [spouse('h', 'M', nonExact(1980, 1, 1)), spouse('w', 'F', exact(1990, 1, 1))],
      }),
      union({
        unionId: 'u2',
        spouses: [spouse('h2', 'M', exact(1980, 1, 1)), spouse('w2', 'F', null)],
      }),
    ])
    expect(out.widowhood.survivors).toEqual([])
    expect(out.widowhoodPairs).toBe(0)
  })

  it('bukan tepat 2 spouse: gugur', () => {
    const out = computeDivorceWidowhood([
      union({ unionId: 'u1', spouses: [spouse('a', 'M', exact(1980, 1, 1))] }),
      union({
        unionId: 'u2',
        spouses: [spouse('a', 'M', exact(1980, 1, 1)), spouse('b', 'F', exact(1990, 1, 1)), spouse('c', 'F', exact(1995, 1, 1))],
      }),
    ])
    expect(out.widowhood.survivors).toEqual([])
  })

  it('median ganjil: 3 interval pilih tengah; sex M lalu F', () => {
    const out = computeDivorceWidowhood([
      union({
        unionId: 'u1',
        spouses: [spouse('h1', 'M', exact(1980, 1, 10)), spouse('w1', 'F', exact(1990, 5, 20))],
      }),
      union({
        unionId: 'u2',
        spouses: [spouse('h2', 'M', exact(1970, 2, 2)), spouse('w2', 'F', exact(1989, 2, 3))],
      }),
      union({
        unionId: 'u3',
        spouses: [spouse('h3', 'M', exact(1985, 3, 3)), spouse('w3', 'F', exact(1998, 3, 4))],
      }),
    ])
    const rowM = out.widowhood.survivors.find((s) => s.sex === 'M')
    expect(rowM?.count).toBe(3)
    expect(rowM?.intervals).toEqual([10, 13, 19])
    expect(rowM?.medianYears).toBe(13)
  })

  it('median genap: rata dua nilai tengah dibulatkan 1 desimal', () => {
    const out = computeDivorceWidowhood([
      union({
        unionId: 'u1',
        spouses: [spouse('h1', 'M', exact(1980, 1, 1)), spouse('w1', 'F', exact(1985, 1, 1))],
      }),
      union({
        unionId: 'u2',
        spouses: [spouse('h2', 'M', exact(1980, 1, 1)), spouse('w2', 'F', exact(1986, 1, 1))],
      }),
      union({
        unionId: 'u3',
        spouses: [spouse('h3', 'M', exact(1980, 1, 1)), spouse('w3', 'F', exact(1995, 6, 15))],
      }),
      union({
        unionId: 'u4',
        spouses: [spouse('h4', 'M', exact(1980, 1, 1)), spouse('w4', 'F', exact(1996, 7, 16))],
      }),
    ])
    const rowM = out.widowhood.survivors.find((s) => s.sex === 'M')
    expect(rowM?.count).toBe(4)
    expect(rowM?.intervals).toEqual([5, 6, 15, 16])
    expect(rowM?.medianYears).toBe(10.5)
  })
})

describe('determinisme dan payload', () => {
  it('urutan input tidak mengubah output', () => {
    const base = [
      union({ unionId: 'a', marriageDate: exact(1951, 1, 1), divorceDate: exact(1961, 1, 1) }),
      union({
        unionId: 'b',
        marriageDate: exact(1952, 2, 2),
        spouses: [spouse('h', 'M', exact(1980, 4, 4)), spouse('w', 'F', exact(1993, 9, 9))],
      }),
      union({ unionId: 'c', marriageDate: exact(1948, 3, 3) }),
    ]
    const forward = computeDivorceWidowhood(base)
    const reversed = computeDivorceWidowhood([...base].reverse())
    expect(reversed).toEqual(forward)
    expect(forward.decades.map((d) => d.decadeStart)).toEqual([1940, 1950])
  })

  it('input kosong: payload utuh tanpa throw', () => {
    const out = fullPipe([])
    expect(out).toEqual({
      decades: [],
      widowhood: { survivors: [] },
      totalUnions: 0,
      exactMarriages: 0,
      divorces: 0,
      widowhoodPairs: 0,
    })
  })

  it('pipeline dari raw: payload lengkap kunci utama', () => {
    const out = fullPipe([
      {
        unionId: 'u1',
        marriageDate: exact(1955, 6, 6),
        divorceDate: exact(1958, 1, 1),
        spouses: [spouse('h', 'M', exact(1980, 1, 1)), spouse('w', 'F', exact(1989, 1, 2))],
      },
    ])
    expect(out.totalUnions).toBe(1)
    expect(out.exactMarriages).toBe(1)
    expect(out.divorces).toBe(1)
    expect(out.widowhoodPairs).toBe(1)
    expect(out.widowhood.survivors[0].sex).toBe('M')
  })
})
