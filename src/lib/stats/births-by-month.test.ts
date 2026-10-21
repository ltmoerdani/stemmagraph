import { describe, it, expect } from 'vitest'
import { computeBirthsByMonth } from './births-by-month'

describe('computeBirthsByMonth', () => {
  it('distribusi dasar 12 bulan: setiap bulan terisi di indeks yang tepat', () => {
    const res = computeBirthsByMonth([
      { birthDate: '2001-01-15' },
      { birthDate: '2002-02-10' },
      { birthDate: '2003-03-05' },
      { birthDate: '2004-04-20' },
      { birthDate: '2005-05-11' },
      { birthDate: '2006-06-02' },
      { birthDate: '2007-07-30' },
      { birthDate: '2008-08-08' },
      { birthDate: '2009-09-17' },
      { birthDate: '2010-10-25' },
      { birthDate: '2011-11-03' },
      { birthDate: '2012-12-31' },
    ])
    expect(res.birthsByMonth).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1])
    expect(res.total).toBe(12)
    expect(res.peakMonth).toBe(0)
    expect(res.peakCount).toBe(1)
  })

  it('akumulasi multi-entri di bulan yang sama', () => {
    const res = computeBirthsByMonth([
      { birthDate: '1990-03-01' },
      { birthDate: '1991-03-15' },
      { birthDate: '1992-03-31' },
      { birthDate: '1990-07-04' },
    ])
    expect(res.birthsByMonth[2]).toBe(3)
    expect(res.birthsByMonth[6]).toBe(1)
    expect(res.total).toBe(4)
    expect(res.peakMonth).toBe(2)
    expect(res.peakCount).toBe(3)
  })

  it('urutan input diacak menghasilkan output identik', () => {
    const entries = [
      { birthDate: '1990-01-01' },
      { birthDate: '1990-06-10' },
      { birthDate: '1990-06-20' },
      { birthDate: '1990-12-25' },
    ]
    const maju = computeBirthsByMonth(entries)
    const acak = computeBirthsByMonth([...entries].reverse())
    expect(acak).toEqual(maju)
    expect(maju.birthsByMonth).toEqual([1, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1])
  })

  it('total tepat sama dengan jumlah entri', () => {
    const res = computeBirthsByMonth([
      { birthDate: '1980-04-01' },
      { birthDate: '1981-05-01' },
      { birthDate: '1982-06-01' },
      { birthDate: '1983-07-01' },
      { birthDate: '1984-08-01' },
    ])
    expect(res.total).toBe(5)
    expect(res.birthsByMonth.reduce((a, b) => a + b, 0)).toBe(res.total)
  })

  it('peakMonth tie memilih indeks terkecil', () => {
    const res = computeBirthsByMonth([
      { birthDate: '1990-02-01' },
      { birthDate: '1990-02-02' },
      { birthDate: '1990-09-01' },
      { birthDate: '1990-09-02' },
      { birthDate: '1990-12-01' },
    ])
    expect(res.peakMonth).toBe(1)
    expect(res.peakCount).toBe(2)
  })

  it('peakMonth dan peakCount null saat total 0', () => {
    const res = computeBirthsByMonth([])
    expect(res.birthsByMonth).toEqual(new Array(12).fill(0))
    expect(res.total).toBe(0)
    expect(res.peakMonth).toBeNull()
    expect(res.peakCount).toBeNull()
  })

  it('input kosong menghasilkan struktur lengkap tanpa error', () => {
    const res = computeBirthsByMonth([])
    expect(res.birthsByMonth).toHaveLength(12)
    expect(res).toEqual({
      birthsByMonth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      total: 0,
      peakMonth: null,
      peakCount: null,
    })
  })

  it('throw berprefiks saat input bukan array', () => {
    expect(() => computeBirthsByMonth('bukan array')).toThrowError(
      /^births-by-month: input harus array$/,
    )
    expect(() => computeBirthsByMonth(undefined)).toThrowError(
      /^births-by-month: input harus array$/,
    )
    expect(() => computeBirthsByMonth({})).toThrowError(
      /^births-by-month: input harus array$/,
    )
  })

  it('throw ber-index saat entri bukan objek', () => {
    const act = () =>
      computeBirthsByMonth([{ birthDate: '1990-01-01' }, 42] as unknown[])
    expect(act).toThrowError(
      /^births-by-month: entri index 1 harus objek$/,
    )
  })

  it('throw ber-index saat birthDate hilang', () => {
    const act = () =>
      computeBirthsByMonth([{}, { birthDate: '1990-01-01' }] as unknown[])
    expect(act).toThrowError(
      /^births-by-month: entri index 0 birthDate harus string$/,
    )
  })

  it('throw ber-index saat birthDate bukan string', () => {
    const act = () =>
      computeBirthsByMonth([{ birthDate: 19900101 }] as unknown[])
    expect(act).toThrowError(
      /^births-by-month: entri index 0 birthDate harus string$/,
    )
  })

  it('throw ber-index saat format bukan YYYY-MM-DD', () => {
    const act = () =>
      computeBirthsByMonth([{ birthDate: '1990/01/01' }])
    expect(act).toThrowError(
      /^births-by-month: entri index 0 birthDate format bukan YYYY-MM-DD$/,
    )
  })

  it('throw saat bulan 00 dan bulan 13', () => {
    const actNol = () => computeBirthsByMonth([{ birthDate: '1990-00-10' }])
    expect(actNol).toThrowError(
      /^births-by-month: entri index 0 birthDate bulan di luar 1 sampai 12$/,
    )
    const act13 = () => computeBirthsByMonth([{ birthDate: '1990-13-05' }])
    expect(act13).toThrowError(
      /^births-by-month: entri index 0 birthDate bulan di luar 1 sampai 12$/,
    )
  })

  it('throw saat tanggal tidak valid secara kalender (31 April)', () => {
    const act = () => computeBirthsByMonth([{ birthDate: '1990-04-31' }])
    expect(act).toThrowError(
      /^births-by-month: entri index 0 birthDate bukan tanggal kalender valid$/,
    )
  })

  it('29 Feb kabisat valid dan masuk indeks Februari', () => {
    const res = computeBirthsByMonth([
      { birthDate: '2000-02-29' },
      { birthDate: '2024-02-29' },
    ])
    expect(res.birthsByMonth[1]).toBe(2)
    expect(res.total).toBe(2)
  })

  it('29 Feb non-kabisat throw', () => {
    const act = () => computeBirthsByMonth([{ birthDate: '1900-02-29' }])
    expect(act).toThrowError(
      /^births-by-month: entri index 0 birthDate bukan tanggal kalender valid$/,
    )
    const act2023 = () => computeBirthsByMonth([{ birthDate: '2023-02-29' }])
    expect(act2023).toThrowError(
      /^births-by-month: entri index 0 birthDate bukan tanggal kalender valid$/,
    )
  })

  it('throw saat format DD-MM-YYYY', () => {
    const act = () => computeBirthsByMonth([{ birthDate: '25-12-1990' }])
    expect(act).toThrowError(
      /^births-by-month: entri index 0 birthDate format bukan YYYY-MM-DD$/,
    )
  })

  it('throw ber-index menunjuk entri yang tepat di tengah array', () => {
    const act = () =>
      computeBirthsByMonth([
        { birthDate: '1990-01-01' },
        { birthDate: '1990-02-01' },
        { birthDate: '1990-02-30' },
      ])
    expect(act).toThrowError(
      /^births-by-month: entri index 2 birthDate bukan tanggal kalender valid$/,
    )
  })
})
