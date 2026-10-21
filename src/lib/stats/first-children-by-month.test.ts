/**
 * Test first children by month (v345 fase i): 22 kasus sesuai
 * checklist kontrak bagian 5, pola gaya test v339/v343/v344.
 */
import { describe, expect, it } from 'vitest'
import { computeFirstChildrenByMonth } from './first-children-by-month'

const ent = (familyId: string, id: string, birthDate: string) => ({
  familyId,
  child: { id, birthDate },
})

const expectThrow = (records: unknown, detail?: RegExp) => {
  expect(() => computeFirstChildrenByMonth(records)).toThrow(
    detail ?? /^first-children-by-month/,
  )
}

describe('computeFirstChildrenByMonth', () => {
  it('kasus 1: dasar satu keluarga satu anak masuk bulan lahirnya', () => {
    const r = computeFirstChildrenByMonth([ent('F1', 'c1', '2020-01-15')])
    expect(r.firstChildrenByMonth[0]).toBe(1)
    expect(r.total).toBe(1)
    expect(r.peakMonth).toBe(0)
    expect(r.peakCount).toBe(1)
    expect(r.familiesCounted).toBe(1)
  })

  it('kasus 2: multi keluarga terakumulasi', () => {
    const r = computeFirstChildrenByMonth([
      ent('F1', 'c1', '2020-02-01'),
      ent('F2', 'c2', '2021-02-20'),
      ent('F3', 'c3', '2022-03-03'),
    ])
    expect(r.firstChildrenByMonth[1]).toBe(2)
    expect(r.firstChildrenByMonth[2]).toBe(1)
    expect(r.total).toBe(3)
    expect(r.familiesCounted).toBe(3)
  })

  it('kasus 3: anak kedua dan ketiga tidak terhitung, hanya paling awal', () => {
    const r = computeFirstChildrenByMonth([
      ent('F1', 'k2', '2021-07-02'),
      ent('F1', 'k1', '2019-12-31'),
      ent('F1', 'k3', '2023-05-05'),
    ])
    expect(r.firstChildrenByMonth[11]).toBe(1)
    expect(r.firstChildrenByMonth[6]).toBe(0)
    expect(r.firstChildrenByMonth[4]).toBe(0)
    expect(r.total).toBe(1)
    expect(r.familiesCounted).toBe(1)
  })

  it('kasus 4: tie birthDate identik satu keluarga ambil entri pertama', () => {
    const r = computeFirstChildrenByMonth([
      ent('F1', 'pertama', '2020-05-05'),
      ent('F1', 'kedua', '2020-05-05'),
    ])
    expect(r.familiesCounted).toBe(1)
    expect(r.firstChildrenByMonth[4]).toBe(1)
    expect(r.total).toBe(1)
  })

  it('kasus 5: bulan kosong bernilai 0 dan array 12 slot', () => {
    const r = computeFirstChildrenByMonth([ent('F1', 'c1', '2020-06-10')])
    expect(r.firstChildrenByMonth).toHaveLength(12)
    r.firstChildrenByMonth.forEach((count, month) => {
      expect(count).toBe(month === 5 ? 1 : 0)
    })
  })

  it('kasus 6: total dan familiesCounted tepat dengan duplikat keluarga', () => {
    const r = computeFirstChildrenByMonth([
      ent('F1', 'c1', '2020-06-15'),
      ent('F1', 'c2', '2020-06-20'),
      ent('F2', 'c3', '2021-08-08'),
    ])
    expect(r.total).toBe(2)
    expect(r.familiesCounted).toBe(2)
    expect(r.total).toBe(r.familiesCounted)
  })

  it('kasus 7: peakMonth tertinggi, tie pilih indeks terkecil', () => {
    const r = computeFirstChildrenByMonth([
      ent('F1', 'c1', '2020-05-01'),
      ent('F2', 'c2', '2021-05-02'),
      ent('F3', 'c3', '2022-11-03'),
      ent('F4', 'c4', '2023-11-04'),
    ])
    expect(r.peakMonth).toBe(4)
    expect(r.peakCount).toBe(2)
  })

  it('kasus 8: input kosong, total 0, familiesCounted 0, peakMonth null, peakCount 0', () => {
    const r = computeFirstChildrenByMonth([])
    expect(r).toEqual({
      firstChildrenByMonth: new Array(12).fill(0),
      total: 0,
      peakMonth: null,
      peakCount: 0,
      familiesCounted: 0,
    })
  })

  it('kasus 9: urutan records diacak hasil distribusi identik', () => {
    const a = [
      ent('F1', 'muda', '2021-07-07'),
      ent('F2', 'c', '2018-03-03'),
      ent('F1', 'tua', '2019-01-02'),
    ]
    const b = [a[2], a[0], a[1]]
    expect(computeFirstChildrenByMonth(a)).toEqual(
      computeFirstChildrenByMonth(b),
    )
  })

  it('kasus 10: input bukan array throw ber-prefix', () => {
    expectThrow('bukan array')
    expectThrow(null)
    expectThrow(42)
    expectThrow({})
  })

  it('kasus 11: entri bukan objek throw ber-index', () => {
    expectThrow([null], /entri index 0/)
    expectThrow([7], /entri index 0/)
    expectThrow([[ent('F1', 'c', '2020-01-01')]], /entri index 0/)
    expectThrow([ent('F1', 'c', '2020-01-01'), 'rusak'], /entri index 1/)
  })

  it('kasus 12: familyId bukan string throw ber-index', () => {
    expectThrow(
      [{ familyId: 1, child: { id: 'c', birthDate: '2020-01-01' } }],
      /entri index 0 familyId harus string/,
    )
  })

  it('kasus 13: child bukan objek throw ber-index', () => {
    expectThrow([{ familyId: 'F1', child: null }], /entri index 0/)
    expectThrow([{ familyId: 'F1', child: 'x' }], /entri index 0/)
    expectThrow([{ familyId: 'F1', child: [] }], /entri index 0/)
  })

  it('kasus 14: id bukan string throw ber-index', () => {
    expectThrow(
      [{ familyId: 'F1', child: { id: 9, birthDate: '2020-01-01' } }],
      /entri index 0 id harus string/,
    )
  })

  it('kasus 15: birthDate bukan string throw ber-index', () => {
    expectThrow(
      [{ familyId: 'F1', child: { id: 'c', birthDate: 20200101 } }],
      /entri index 0 birthDate harus string/,
    )
  })

  it('kasus 16: format bukan YYYY-MM-DD throw', () => {
    expectThrow([ent('F1', 'c', '2020-1-1')], /format bukan YYYY-MM-DD/)
    expectThrow([ent('F1', 'c', '01-01-2020')], /format bukan YYYY-MM-DD/)
    expectThrow([ent('F1', 'c', '2020/01/01')], /format bukan YYYY-MM-DD/)
    expectThrow([ent('F1', 'c', '2020-01')], /format bukan YYYY-MM-DD/)
  })

  it('kasus 17: bulan 00 dan 13 throw', () => {
    expectThrow([ent('F1', 'c', '2020-00-10')], /bulan di luar 1 sampai 12/)
    expectThrow([ent('F1', 'c', '2020-13-10')], /bulan di luar 1 sampai 12/)
  })

  it('kasus 18: hari tidak valid kalender throw', () => {
    expectThrow([ent('F1', 'c', '2020-02-30')], /bukan tanggal kalender valid/)
    expectThrow([ent('F1', 'c', '2020-04-31')], /bukan tanggal kalender valid/)
    expectThrow([ent('F1', 'c', '2020-01-32')], /bukan tanggal kalender valid/)
  })

  it('kasus 19: 29 Feb non-kabisat throw, kabisat valid', () => {
    expectThrow([ent('F1', 'c', '2023-02-29')], /bukan tanggal kalender valid/)
    const ok = computeFirstChildrenByMonth([ent('F1', 'c', '2024-02-29')])
    expect(ok.firstChildrenByMonth[1]).toBe(1)
  })

  it('kasus 20: semua pesan pelanggaran ber-prefix first-children-by-month', () => {
    const kotor = [
      'bukan array',
      [null],
      [{ familyId: 1, child: { id: 'c', birthDate: '2020-01-01' } }],
      [{ familyId: 'F1', child: null }],
      [{ familyId: 'F1', child: { id: 2, birthDate: '2020-01-01' } }],
      [{ familyId: 'F1', child: { id: 'c', birthDate: true } }],
      [ent('F1', 'c', 'salah')],
      [ent('F1', 'c', '2020-00-01')],
      [ent('F1', 'c', '2021-02-29')],
    ]
    kotor.forEach((records) => {
      expect(() => computeFirstChildrenByMonth(records)).toThrow(
        /^first-children-by-month/,
      )
    })
  })

  it('kasus 21: tidak memutasi input', () => {
    const records = [
      ent('F1', 'c1', '2020-01-01'),
      ent('F1', 'c2', '2021-01-01'),
    ]
    const snapshot = JSON.stringify(records)
    computeFirstChildrenByMonth(records)
    expect(JSON.stringify(records)).toBe(snapshot)
  })

  it('kasus 22: output berupa numbers dan peakCount konsisten', () => {
    const r = computeFirstChildrenByMonth([
      ent('F1', 'c1', '2020-07-04'),
      ent('F2', 'c2', '2021-07-11'),
    ])
    r.firstChildrenByMonth.forEach((count) => {
      expect(typeof count).toBe('number')
    })
    expect(typeof r.total).toBe('number')
    expect(typeof r.peakCount).toBe('number')
    expect(typeof r.familiesCounted).toBe('number')
    expect(r.peakMonth).toBe(6)
    expect(r.peakCount).toBe(2)
  })
})
