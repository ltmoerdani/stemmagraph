import { describe, expect, it } from 'vitest'

import {
  computeSurnameMarriageMatrix,
  type SurnamePair,
} from './surname-marriage-matrix'

function pair(husbandSurname: string | null, wifeSurname: string | null): SurnamePair {
  return { husbandSurname, wifeSurname }
}

describe('computeSurnameMarriageMatrix', () => {
  it('kasus 1: array kosong mengembalikan null', () => {
    expect(computeSurnameMarriageMatrix([])).toBeNull()
  })

  it('kasus 2: satu pasangan beda surname, 2 node, matriks 2x2 simetris count 1', () => {
    const result = computeSurnameMarriageMatrix([pair('Anshari', 'Bakri')])
    expect(result).not.toBeNull()
    expect(result.nodes).toEqual(['Anshari', 'Bakri'])
    expect(result.matrix).toEqual([
      [0, 1],
      [1, 0],
    ])
    expect(result.totalPairs).toBe(1)
    expect(result.skippedMissing).toBe(0)
  })

  it('kasus 3: pasangan surname sama masuk satu node dengan diagonal bertambah', () => {
    const result = computeSurnameMarriageMatrix([
      pair('Anshari', 'Anshari'),
      pair('Anshari', 'Bakri'),
    ])
    expect(result.nodes).toEqual(['Anshari', 'Bakri'])
    expect(result.matrix).toEqual([
      [1, 1],
      [1, 0],
    ])
    expect(result.totalPairs).toBe(2)
  })

  it('kasus 4: varian kapital Anshari vs anshari jadi satu node, label kemunculan pertama menang', () => {
    const result = computeSurnameMarriageMatrix([
      pair('Anshari', 'Bakri'),
      pair('anshari', 'Cakranegara'),
    ])
    expect(result.nodes).toContain('Anshari')
    expect(result.nodes).not.toContain('anshari')
    expect(result.nodes).toHaveLength(3)
    const indexAnshari = result.nodes.indexOf('Anshari')
    expect(result.matrix[indexAnshari][indexAnshari]).toBe(0)
    expect(result.totalPairs).toBe(2)
  })

  it('kasus 5: whitespace di kedua sisi di-trim sebelum agregasi', () => {
    const result = computeSurnameMarriageMatrix([
      pair('  Anshari  ', 'Bakri'),
      pair('Anshari', '   Bakri\t'),
    ])
    expect(result.nodes).toEqual(['Anshari', 'Bakri'])
    expect(result.matrix).toEqual([
      [0, 2],
      [2, 0],
    ])
    expect(result.totalPairs).toBe(2)
    expect(result.skippedMissing).toBe(0)
  })

  it('kasus 6: null, empty, dan whitespace-only masuk skippedMissing', () => {
    const result = computeSurnameMarriageMatrix([
      pair(null, 'Bakri'),
      pair('Anshari', ''),
      pair('   ', 'Cakranegara'),
      pair('Anshari', 'Bakri'),
    ])
    expect(result.skippedMissing).toBe(3)
    expect(result.totalPairs).toBe(1)
    expect(result.nodes).toEqual(['Anshari', 'Bakri'])
  })

  it('kasus 7: topN memotong node terlemah keluar matriks', () => {
    const result = computeSurnameMarriageMatrix(
      [
        pair('Aa', 'Bb'),
        pair('Bb', 'Cc'),
        pair('Cc', 'Dd'),
        pair('Dd', 'Ee'),
      ],
      { topN: 2 },
    )
    expect(result.nodes).toHaveLength(2)
    // Bb, Cc, Dd masing-masing terlibat 2 keterlibatan; tie alfabetis
    // mengangkat Bb dan Cc, Aa dan Ee (1 keterlibatan) terpotong
    expect(result.nodes).toEqual(['Bb', 'Cc'])
    expect(result.matrix).toEqual([
      [0, 1],
      [1, 0],
    ])
    // totalPairs tetap menghitung seluruh pasangan valid meski node terpotong
    expect(result.totalPairs).toBe(4)
  })

  it('kasus 8: tie count diurutkan alfabetis key ASC', () => {
    const result = computeSurnameMarriageMatrix([
      pair('Zainal', 'Bakri'),
      pair('Anshari', 'Cakranegara'),
    ])
    expect(result.nodes).toEqual(['Anshari', 'Bakri', 'Cakranegara', 'Zainal'])
  })

  it('kasus 9: simetri [i][j] sama [j][i] pada beberapa sel', () => {
    const result = computeSurnameMarriageMatrix([
      pair('Anshari', 'Bakri'),
      pair('Bakri', 'Cakranegara'),
      pair('Anshari', 'Cakranegara'),
      pair('Cakranegara', 'Anshari'),
    ])
    const { matrix } = result
    expect(matrix).toHaveLength(3)
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        expect(matrix[i][j]).toBe(matrix[j][i])
      }
    }
    expect(matrix[0][1]).toBe(2)
    expect(matrix[0][2]).toBe(1)
    expect(matrix[1][2]).toBe(1)
  })

  it('kasus 10: pairs terurut count DESC lalu key ASC', () => {
    const result = computeSurnameMarriageMatrix([
      pair('Anshari', 'Bakri'),
      pair('Anshari', 'Bakri'),
      pair('Anshari', 'Bakri'),
      pair('Bakri', 'Cakranegara'),
      pair('Cakranegara', 'Anshari'),
      pair('Anshari', 'Anshari'),
    ])
    expect(result.pairs).toEqual([
      { a: 'Anshari', b: 'Bakri', count: 3 },
      { a: 'Anshari', b: 'Anshari', count: 1 },
      { a: 'Anshari', b: 'Cakranegara', count: 1 },
      { a: 'Bakri', b: 'Cakranegara', count: 1 },
    ])
  })

  it('kasus 11: totalPairs dan skippedMissing akurat pada campuran', () => {
    const result = computeSurnameMarriageMatrix([
      pair('Anshari', 'Bakri'),
      pair(null, null),
      pair('Anshari', 'Bakri'),
      pair('Dahlan', '   '),
      pair('Anshari', 'Anshari'),
    ])
    expect(result.totalPairs).toBe(3)
    expect(result.skippedMissing).toBe(2)
  })

  it('kasus 12: determinisme, urutan input diacak menghasilkan output identik', () => {
    const base = [
      pair('Anshari', 'Bakri'),
      pair('Bakri', 'Cakranegara'),
      pair('Anshari', 'Anshari'),
      pair('Cakranegara', 'Bakri'),
      pair('Anshari', 'Cakranegara'),
    ]
    const shuffled = [
      pair('Cakranegara', 'Bakri'),
      pair('Anshari', 'Cakranegara'),
      pair('Anshari', 'Anshari'),
      pair('Anshari', 'Bakri'),
      pair('Bakri', 'Cakranegara'),
    ]
    const first = computeSurnameMarriageMatrix(base)
    const second = computeSurnameMarriageMatrix(shuffled)
    expect(first).toEqual(second)
  })

  it('kasus tambahan: default topN 8 mengikuti jangkar, node ke-9 terpotong', () => {
    const many: SurnamePair[] = [
      pair('Anshari', 'Bakri'),
      pair('Anshari', 'Cakranegara'),
      pair('Anshari', 'Dahlan'),
      pair('Anshari', 'Endang'),
      pair('Anshari', 'Fauzi'),
      pair('Anshari', 'Gani'),
      pair('Anshari', 'Hasan'),
      pair('Anshari', 'Iskandar'),
      pair('Anshari', 'Jamil'),
    ]
    const result = computeSurnameMarriageMatrix(many)
    expect(result.nodes).toHaveLength(8)
    expect(result.nodes[0]).toBe('Anshari')
    expect(result.nodes).not.toContain('Jamil')
  })
})
