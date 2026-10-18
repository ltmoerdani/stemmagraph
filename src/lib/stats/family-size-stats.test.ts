/**
 * Test dedikasi v287 fase i: computeFamilySizeStats
 * (src/lib/stats/family-size-stats.ts).
 *
 * Test-only, pure: nihil DB, nihil jaringan, nihil prisma. Kasus mengikuti
 * daftar kontrak KUKUH pm Ardi 18 Okt 2026: nihil keluarga null; keluarga
 * tanpa anak masuk zero dan average nol; median ganjil; median genap; max;
 * batas bucket 2 dan 3; batas bucket 4 dan 5; determinisme urutan input;
 * campuran valid dan rusak (excludedCount); kasus besar konsisten.
 */

import { describe, expect, it } from 'vitest'
import {
  computeFamilySizeStats,
  type FamilySizeInput,
} from './family-size-stats'

function family(childIds: string[]): FamilySizeInput {
  return { childIds }
}

/** Entry rusak pola v283: childIds bukan array, dibangun lewat cast. */
function broken(): FamilySizeInput {
  return { childIds: 'rusak' as unknown as string[] }
}

describe('computeFamilySizeStats (v287 fase i)', () => {
  it('array families kosong menghasilkan null', () => {
    expect(computeFamilySizeStats([])).toBeNull()
  })

  it('keluarga tanpa anak masuk bucket zero dan average nol', () => {
    const r = computeFamilySizeStats([family([]), family([])])
    expect(r).not.toBeNull()
    expect(r?.distribution.zero).toBe(2)
    expect(r?.average).toBe(0)
    expect(r?.median).toBe(0)
    expect(r?.max).toBe(0)
    expect(r?.familyCount).toBe(2)
    expect(r?.excludedCount).toBe(0)
  })

  it('semua entry rusak menghasilkan null meski array families tidak kosong', () => {
    expect(computeFamilySizeStats([broken(), broken()])).toBeNull()
  })

  it('median ganjil: nilai tengah dari 5 keluarga', () => {
    const r = computeFamilySizeStats([
      family(['a']),
      family(['a', 'b', 'c']),
      family([]),
      family(['a', 'b']),
      family(['a', 'b', 'c', 'd', 'e']),
    ])
    // sizes terurut: 0 1 2 3 5, median 2, average 11/5 = 2.2
    expect(r?.median).toBe(2)
    expect(r?.average).toBe(2.2)
    expect(r?.max).toBe(5)
    expect(r?.familyCount).toBe(5)
  })

  it('median genap: rata dua nilai tengah', () => {
    const r = computeFamilySizeStats([
      family(['a']),
      family(['a', 'b']),
      family(['a', 'b', 'c']),
      family(['a', 'b', 'c', 'd']),
    ])
    // sizes terurut: 1 2 3 4, median (2+3)/2 = 2.5, average 10/4 = 2.5
    expect(r?.median).toBe(2.5)
    expect(r?.average).toBe(2.5)
  })

  it('max mengambil ukuran keluarga terbesar', () => {
    const r = computeFamilySizeStats([
      family(['a']),
      family(['a', 'b', 'c', 'd', 'e', 'f', 'g']),
      family(['a', 'b']),
    ])
    expect(r?.max).toBe(7)
    expect(r?.distribution.fivePlus).toBe(1)
  })

  it('batas bucket 2 dan 3: size 2 oneToTwo, size 3 threeToFour', () => {
    const r = computeFamilySizeStats([family(['a', 'b']), family(['a', 'b', 'c'])])
    expect(r?.distribution.oneToTwo).toBe(1)
    expect(r?.distribution.threeToFour).toBe(1)
    expect(r?.distribution.zero).toBe(0)
    expect(r?.distribution.fivePlus).toBe(0)
  })

  it('batas bucket 4 dan 5: size 4 threeToFour, size 5 fivePlus', () => {
    const r = computeFamilySizeStats([
      family(['a', 'b', 'c', 'd']),
      family(['a', 'b', 'c', 'd', 'e']),
    ])
    expect(r?.distribution.threeToFour).toBe(1)
    expect(r?.distribution.fivePlus).toBe(1)
    expect(r?.distribution.oneToTwo).toBe(0)
  })

  it('determinisme: urutan input tidak mengubah hasil agregat', () => {
    const a = [
      family(['a', 'b', 'c']),
      family([]),
      family(['x', 'y']),
      family(['p', 'q', 'r', 's']),
    ]
    const b = [
      family(['p', 'q', 'r', 's']),
      family(['x', 'y']),
      family(['a', 'b', 'c']),
      family([]),
    ]
    expect(computeFamilySizeStats(a)).toEqual(computeFamilySizeStats(b))
  })

  it('campuran valid dan rusak: excludedCount benar, valid tetap dihitung', () => {
    const r = computeFamilySizeStats([
      family(['a']),
      broken(),
      family(['a', 'b', 'c']),
      broken(),
      family([]),
    ])
    expect(r).not.toBeNull()
    expect(r?.familyCount).toBe(3)
    expect(r?.excludedCount).toBe(2)
    // sizes: 0 1 3, total 4, average 4/3 = 1.333 dibulatkan 1.3
    expect(r?.average).toBe(1.3)
    expect(r?.median).toBe(1)
    expect(r?.distribution.zero).toBe(1)
    expect(r?.distribution.oneToTwo).toBe(1)
    expect(r?.distribution.threeToFour).toBe(1)
  })

  it('kasus besar konsisten: 200 keluarga pola berulang', () => {
    const families: FamilySizeInput[] = []
    for (let i = 0; i < 200; i += 1) {
      const size = i % 8 // 0 sampai 7, masing-masing 25 kali
      families.push(family(Array.from({ length: size }, (_, k) => `c${k}`)))
    }
    const r = computeFamilySizeStats(families)
    expect(r).not.toBeNull()
    expect(r?.familyCount).toBe(200)
    expect(r?.excludedCount).toBe(0)
    // total sizes = 25 * (0+1+...+7) = 25 * 28 = 700, average 3.5
    expect(r?.average).toBe(3.5)
    // median: elemen terurut ke-99 = 3 dan ke-100 = 4 (0-based), rata 3.5
    expect(r?.median).toBe(3.5)
    expect(r?.max).toBe(7)
    expect(r?.distribution.zero).toBe(25)
    expect(r?.distribution.oneToTwo).toBe(50)
    expect(r?.distribution.threeToFour).toBe(50)
    expect(r?.distribution.fivePlus).toBe(75)
    // jumlah seluruh bucket = familyCount
    const d = r?.distribution
    expect(d ? d.zero + d.oneToTwo + d.threeToFour + d.fivePlus : -1).toBe(200)
  })

  it('pembulatan 1 desimal: average 5/3 tampil 1.7', () => {
    const r = computeFamilySizeStats([
      family(['a', 'b', 'c']),
      family(['d', 'e']),
      family([]),
    ])
    // total 5 dari 3 keluarga: 1.6666 dibulatkan 1.7
    expect(r?.average).toBe(1.7)
    expect(r?.median).toBe(2)
  })
})
