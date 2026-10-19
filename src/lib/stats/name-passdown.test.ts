import { describe, expect, it } from 'vitest'

import {
  computeSameSexNamePassdown,
  type NamePassdownPair,
} from './name-passdown'

function pair(
  parentGivn: string,
  childGivn: string,
  childBirthYear: number | null,
  parentSex: string | null
): NamePassdownPair {
  return { parentGivn, childGivn, childBirthYear, parentSex }
}

function repeat(n: number, make: (i: number) => NamePassdownPair): NamePassdownPair[] {
  return Array.from({ length: n }, (_, i) => make(i))
}

describe('computeSameSexNamePassdown', () => {
  it('kasus 1: array kosong menghasilkan categories, fatherSon, motherDaughter kosong', () => {
    expect(computeSameSexNamePassdown([])).toEqual({
      categories: [],
      fatherSon: [],
      motherDaughter: [],
    })
  })

  it('kasus 2: parser strict, input null, undefined, object melempar Error', () => {
    expect(() => computeSameSexNamePassdown(null as unknown as NamePassdownPair[])).toThrow(Error)
    expect(() => computeSameSexNamePassdown(undefined as unknown as NamePassdownPair[])).toThrow(Error)
    expect(() => computeSameSexNamePassdown({} as unknown as NamePassdownPair[])).toThrow(Error)
  })

  it('kasus 3: childBirthYear null, 0, NaN menyebabkan pasangan dibuang', () => {
    const pairs = [
      pair('Johann', 'Johann', null, 'M'),
      pair('Johann', 'Johann', 0, 'M'),
      pair('Johann', 'Johann', Number.NaN, 'M'),
    ]
    expect(computeSameSexNamePassdown(pairs)).toEqual({
      categories: [],
      fatherSon: [],
      motherDaughter: [],
    })
  })

  it('kasus 4: parentSex U, null, selain M/F menyebabkan pasangan dibuang', () => {
    const pairs = [
      pair('Johann', 'Johann', 1850, 'U'),
      pair('Johann', 'Johann', 1851, null),
      pair('Johann', 'Johann', 1852, 'x'),
    ]
    expect(computeSameSexNamePassdown(pairs)).toEqual({
      categories: [],
      fatherSon: [],
      motherDaughter: [],
    })
  })

  it('kasus 5: parentSex m dan f lowercase diterima dan masuk seri yang benar', () => {
    const pairs = [
      pair('Johann', 'Johann', 1850, 'm'),
      pair('Maria', 'Maria', 1850, 'f'),
    ]
    const result = computeSameSexNamePassdown(pairs)
    expect(result.categories).toEqual([1800])
    expect(result.fatherSon).toEqual([null])
    expect(result.motherDaughter).toEqual([null])
  })

  it('kasus 6: fold diakritik, Jose polos vs Jose beraksen tetap match', () => {
    const pairs = repeat(10, () => pair('Jose', 'Jos\u00e9', 1905, 'M'))
    const result = computeSameSexNamePassdown(pairs)
    expect(result.categories).toEqual([1900])
    expect(result.fatherSon).toEqual([1])
  })

  it('kasus 7: inisial satu huruf dibuang, match via Friedrich, tanpa match palsu', () => {
    const matchPairs = repeat(10, () => pair('J. Friedrich', 'Friedrich', 1860, 'M'))
    const matched = computeSameSexNamePassdown(matchPairs)
    expect(matched.fatherSon).toEqual([1])

    const noMatchPairs = repeat(10, () => pair('J. Friedrich', 'Heinrich', 1860, 'M'))
    const notMatched = computeSameSexNamePassdown(noMatchPairs)
    expect(notMatched.fatherSon).toEqual([0])

  })

  it('kasus 8: match token posisi tengah, Johann Friedrich vs Wilhelm Friedrich', () => {
    const pairs = repeat(10, () => pair('Johann Friedrich', 'Wilhelm Friedrich', 1871, 'M'))
    const result = computeSameSexNamePassdown(pairs)
    expect(result.fatherSon).toEqual([1])
  })

  it('kasus 9: koer 9 pasangan di bawah floor 10, nilai null, abad tetap di sumbu', () => {
    const pairs = repeat(9, (i) => pair('Johann', 'Johann', 1800 + i, 'M'))
    const result = computeSameSexNamePassdown(pairs)
    expect(result.categories).toEqual([1800])
    expect(result.fatherSon).toEqual([null])
    expect(result.motherDaughter).toEqual([null])
  })

  it('kasus 10: koer tepat 10 dengan 7 match menghasilkan fraksi 0.7', () => {
    const pairs = repeat(10, (i) =>
      i < 7 ? pair('Johann', 'Johann', 1855, 'M') : pair('Johann', 'Peter', 1855, 'M')
    )
    const result = computeSameSexNamePassdown(pairs)
    expect(result.fatherSon).toEqual([0.7])
  })

  it('kasus 11: fraksi dibulatkan 4 desimal, 4 dari 12 = 0.3333', () => {
    const pairs = repeat(12, (i) =>
      i % 3 === 0 ? pair('Maria', 'Maria', 1633, 'F') : pair('Maria', 'Anna', 1633, 'F')
    )
    const result = computeSameSexNamePassdown(pairs)
    expect(result.motherDaughter).toEqual([0.3333])
  })

  it('kasus 12: dua seri independen, abad fatherSon saja tetap di categories, motherDaughter null', () => {
    const pairs = repeat(10, () => pair('Johann', 'Johann', 1850, 'M'))
    pairs.push(pair('Maria', 'Anna', 1750, 'F'))
    const result = computeSameSexNamePassdown(pairs)
    expect(result.categories).toEqual([1700, 1800])
    expect(result.fatherSon).toEqual([null, 1])
    expect(result.motherDaughter).toEqual([null, null])
  })

  it('kasus 13: tahun BCE negatif -50 melipat ke abad -100 dan urut menaik', () => {
    const pairs = repeat(10, () => pair('Kleopatra', 'kleopatra', -50, 'F'))
    pairs.push(...repeat(10, () => pair('Johann', 'Johann', 1850, 'M')))
    const result = computeSameSexNamePassdown(pairs)
    expect(result.categories).toEqual([-100, 1800])
    expect(result.motherDaughter).toEqual([1, null])
    expect(result.fatherSon).toEqual([null, 1])
  })

  it('kasus 14: trim spasi berlebih dan fold case, JOHANN vs johann match', () => {
    const pairs = repeat(10, () => pair('  JOHANN   Friedrich ', '  johann  ', 1889, 'M'))
    const result = computeSameSexNamePassdown(pairs)
    expect(result.categories).toEqual([1800])
    expect(result.fatherSon).toEqual([1])
  })
})
