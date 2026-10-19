import { describe, expect, it } from 'vitest'

import {
  computeSexRatioAnomalies,
  type SexRatioFamily,
} from './sex-ratio-anomalies'

function fam(...sexes: (string | null)[]): SexRatioFamily {
  return { children: sexes.map((sex) => ({ sex })) }
}

function allMale(count: number): SexRatioFamily {
  return fam(...Array<string>(count).fill('M'))
}

describe('computeSexRatioAnomalies', () => {
  it('kasus 1: input kosong menghasilkan array kosong tanpa throw', () => {
    expect(computeSexRatioAnomalies([])).toEqual([])
  })

  it('kasus 2: semua child tanpa sex valid (null, kosong, X) diabaikan, hasil kosong', () => {
    const families = [fam(null, '', 'X', 'unknown'), fam(null, null)]
    expect(computeSexRatioAnomalies(families)).toEqual([])
  })

  it('kasus 3: family dengan sexed di bawah minChildren default 6 tidak masuk', () => {
    expect(computeSexRatioAnomalies([allMale(5)])).toEqual([])
  })

  it('kasus 4: dominan share di bawah skewThreshold default 0.8 tidak masuk', () => {
    const families = [fam('M', 'M', 'M', 'M', 'F', 'F')]
    expect(computeSexRatioAnomalies(families)).toEqual([])
  })

  it('kasus 5: dominan share tepat 0.80 masuk (8M dari 10 sexed)', () => {
    const families = [fam('M', 'M', 'M', 'M', 'M', 'M', 'M', 'M', 'F', 'F')]
    const result = computeSexRatioAnomalies(families)
    expect(result).toHaveLength(1)
    expect(result[0].maleCount).toBe(8)
    expect(result[0].femaleCount).toBe(2)
    expect(result[0].sexedCount).toBe(10)
    expect(result[0].dominantShare).toBe(0.8)
  })

  it('kasus 6: sex case-insensitive, m dan f dihitung sama dengan M dan F', () => {
    const belowThreshold = [fam('m', 'm', 'm', 'm', 'm', 'm', 'f', 'F')]
    expect(computeSexRatioAnomalies(belowThreshold)).toEqual([])

    const passing = [fam('m', 'm', 'm', 'm', 'm', 'f')]
    const result = computeSexRatioAnomalies(passing)
    expect(result).toHaveLength(1)
    expect(result[0].maleCount).toBe(5)
    expect(result[0].femaleCount).toBe(1)
    expect(result[0].sexedCount).toBe(6)
    expect(result[0].dominantShare).toBeCloseTo(5 / 6, 12)
  })

  it('kasus 7: hasil urut dominan share menurun, bentuk output tanpa identitas family', () => {
    const families = [
      fam('M', 'M', 'M', 'M', 'M', 'F'),
      fam('M', 'M', 'M', 'M', 'M', 'M'),
    ]
    const result = computeSexRatioAnomalies(families)
    expect(result).toHaveLength(2)
    expect(result[0].dominantShare).toBe(1)
    expect(result[1].dominantShare).toBeCloseTo(5 / 6, 12)
    expect(Object.keys(result[0])).toEqual([
      'maleCount',
      'femaleCount',
      'sexedCount',
      'dominantShare',
    ])
  })

  it('kasus 8: share sama, tie-break jumlah sexed menurun', () => {
    const families = [allMale(6), allMale(8)]
    const result = computeSexRatioAnomalies(families)
    expect(result).toHaveLength(2)
    expect(result[0].sexedCount).toBe(8)
    expect(result[1].sexedCount).toBe(6)
  })

  it('kasus 9: share dan sexed sama, urutan mengikuti indeks input', () => {
    const families = [allMale(6), allMale(6), allMale(6)]
    const result = computeSexRatioAnomalies(families)
    expect(result).toHaveLength(3)
    expect(result.every((entry) => entry.dominantShare === 1)).toBe(true)
  })

  it('kasus 10: limit default 10 memotong 12 anomali menjadi 10', () => {
    const families = Array.from({ length: 12 }, () => allMale(6))
    const result = computeSexRatioAnomalies(families)
    expect(result).toHaveLength(10)
  })

  it('kasus 11: limit custom 2 dari 4 anomali menghasilkan 2 teratas', () => {
    const families = [allMale(6), allMale(6), allMale(6), allMale(6)]
    const result = computeSexRatioAnomalies(families, { limit: 2 })
    expect(result).toHaveLength(2)
  })

  it('kasus 12: minChildren custom 3 menerima family 3 sexed yang default tolak', () => {
    const families = [fam('M', 'M', 'M')]
    expect(computeSexRatioAnomalies(families)).toEqual([])
    const result = computeSexRatioAnomalies(families, { minChildren: 3 })
    expect(result).toHaveLength(1)
    expect(result[0].sexedCount).toBe(3)
  })

  it('kasus 13: sex bertipe bukan string dan bukan null melempar Error', () => {
    const broken = {
      children: [{ sex: 7 as unknown as string }],
    }
    expect(() => computeSexRatioAnomalies([broken])).toThrowError(
      /child sex must be a string or null/
    )
  })

  it('kasus 14: families bukan array melempar Error', () => {
    const broken = allMale(6) as unknown as SexRatioFamily[]
    expect(() => computeSexRatioAnomalies(broken)).toThrowError(
      /families must be an array/
    )
  })
})
