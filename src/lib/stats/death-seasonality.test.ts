import { describe, expect, it } from 'vitest'

import { computeDeathSeasonality, type DeathRecord } from './death-seasonality'

function rec(deathDate: string): DeathRecord {
  return { deathDate }
}

describe('computeDeathSeasonality', () => {
  it('kasus 1: input kosong menghasilkan 12 bulan nol, total 0, winterPeakScore null', () => {
    expect(computeDeathSeasonality([])).toEqual({
      deathsByMonth: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      total: 0,
      winterPeakScore: null,
    })
  })

  it('kasus 2: satu entri Januari masuk indeks 0, score 4.0 (share 1.0 dibagi 0.25)', () => {
    const result = computeDeathSeasonality([rec('1980-01-15')])
    expect(result.deathsByMonth[0]).toBe(1)
    expect(result.total).toBe(1)
    expect(result.winterPeakScore).toBe(4)
  })

  it('kasus 3: distribusi 12 bulan benar per indeks (0 = Januari sampai 11 = Desember)', () => {
    const result = computeDeathSeasonality([
      rec('1980-01-05'),
      rec('1981-02-05'),
      rec('1982-03-05'),
      rec('1983-04-05'),
      rec('1984-05-05'),
      rec('1985-06-05'),
      rec('1985-06-06'),
      rec('1986-07-05'),
      rec('1987-08-05'),
      rec('1988-09-05'),
      rec('1989-10-05'),
      rec('1990-11-05'),
      rec('1991-12-05'),
    ])
    expect(result.deathsByMonth).toEqual([1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1])
    expect(result.total).toBe(13)
  })

  it('kasus 4: puncak Des-Jan-Feb menghasilkan score di atas 1.0', () => {
    const result = computeDeathSeasonality([
      rec('1980-01-10'),
      rec('1980-01-20'),
      rec('1980-02-10'),
      rec('1980-02-20'),
      rec('1980-02-25'),
      rec('1980-02-26'),
      rec('1980-12-10'),
      rec('1980-12-20'),
      rec('1980-12-30'),
      rec('1981-03-10'),
      rec('1981-06-10'),
      rec('1981-07-10'),
    ])
    expect(result.total).toBe(12)
    expect(result.winterPeakScore).toBe(3)
    expect(result.winterPeakScore).toBeGreaterThan(1.0)
  })

  it('kasus 5: puncak bulan panas (Jun-Jul-Agu) menghasilkan score di bawah 1.0', () => {
    const result = computeDeathSeasonality([
      rec('1980-06-10'),
      rec('1980-06-20'),
      rec('1980-07-10'),
      rec('1980-07-20'),
      rec('1980-08-10'),
      rec('1980-08-20'),
      rec('1980-08-25'),
      rec('1980-03-10'),
      rec('1980-09-10'),
    ])
    expect(result.total).toBe(9)
    expect(result.winterPeakScore).toBe(0)
    expect(result.winterPeakScore).toBeLessThan(1.0)
  })

  it('kasus 6: share musim dingin tepat 0.25 tanpa flat menghasilkan score 1.0 netral', () => {
    const result = computeDeathSeasonality([
      rec('1980-01-05'),
      rec('1980-02-05'),
      rec('1980-03-05'),
      rec('1980-04-05'),
      rec('1980-05-05'),
      rec('1980-06-05'),
      rec('1980-07-05'),
      rec('1980-08-05'),
    ])
    expect(result.deathsByMonth).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0])
    expect(result.total).toBe(8)
    expect(result.winterPeakScore).toBe(1)
  })

  it('kasus 7: distribusi flat antar 12 bulan menghasilkan winterPeakScore null', () => {
    const result = computeDeathSeasonality([
      rec('1980-01-01'),
      rec('1980-02-01'),
      rec('1980-03-01'),
      rec('1980-04-01'),
      rec('1980-05-01'),
      rec('1980-06-01'),
      rec('1980-07-01'),
      rec('1980-08-01'),
      rec('1980-09-01'),
      rec('1980-10-01'),
      rec('1980-11-01'),
      rec('1980-12-01'),
    ])
    expect(result.total).toBe(12)
    expect(result.winterPeakScore).toBeNull()
  })

  it('kasus 8: flat lintas tahun tetap null, total menghitung semua tahun', () => {
    const result = computeDeathSeasonality([
      rec('1950-01-01'),
      rec('1960-02-01'),
      rec('1970-03-01'),
      rec('1980-04-01'),
      rec('1990-05-01'),
      rec('1955-06-01'),
      rec('1965-07-01'),
      rec('1975-08-01'),
      rec('1985-09-01'),
      rec('1995-10-01'),
      rec('1951-11-01'),
      rec('1961-12-01'),
    ])
    expect(result.total).toBe(12)
    expect(result.winterPeakScore).toBeNull()
  })

  it('kasus 9: guard bulan tidak valid (13 dan 00) melempar Error, bukan silent skip', () => {
    expect(() => computeDeathSeasonality([rec('1980-13-01')])).toThrow(/Invalid calendar deathDate/)
    expect(() => computeDeathSeasonality([rec('1980-00-10')])).toThrow(/Invalid calendar deathDate/)
    expect(() => computeDeathSeasonality([rec('1980-99-10')])).toThrow(/Invalid calendar deathDate/)
  })

  it('kasus 10: guard tanggal tidak valid kalender (31 Apr, 30 Feb) melempar Error', () => {
    expect(() => computeDeathSeasonality([rec('1980-04-31')])).toThrow(/Invalid calendar deathDate/)
    expect(() => computeDeathSeasonality([rec('1980-02-30')])).toThrow(/Invalid calendar deathDate/)
  })

  it('kasus 11: guard kabisat: 29 Feb 2000 valid, 29 Feb 1900 melempar Error', () => {
    const kabisat = computeDeathSeasonality([rec('2000-02-29')])
    expect(kabisat.deathsByMonth[1]).toBe(1)
    expect(() => computeDeathSeasonality([rec('1900-02-29')])).toThrow(/Invalid calendar deathDate/)
  })

  it('kasus 12: guard format salah melempar Error eksplisit (pola strict v301)', () => {
    expect(() => computeDeathSeasonality([rec('Januari 1980')])).toThrow(
      /Invalid deathDate format/,
    )
    expect(() => computeDeathSeasonality([rec('1980/01/02')])).toThrow(
      /Invalid deathDate format/,
    )
    expect(() => computeDeathSeasonality([rec('1980-1-2')])).toThrow(/Invalid deathDate format/)
    expect(() => computeDeathSeasonality([rec('-0001-05-05')])).toThrow(
      /Invalid deathDate format/,
    )
  })

  it('kasus 13: determinisme: dua panggilan identik dan urutan input tidak memengaruhi hasil', () => {
    const input = [
      rec('1980-12-01'),
      rec('1980-01-02'),
      rec('1980-07-03'),
      rec('1980-07-04'),
      rec('1980-02-05'),
    ]
    const first = computeDeathSeasonality(input)
    const second = computeDeathSeasonality(input)
    expect(second).toEqual(first)
    const shuffled = computeDeathSeasonality([
      input[3],
      input[0],
      input[4],
      input[2],
      input[1],
    ])
    expect(shuffled).toEqual(first)
  })

  it('kasus 14: deathsByMonth selalu 12 indeks dan total konsisten dengan jumlahnya', () => {
    const result = computeDeathSeasonality([
      rec('2001-05-10'),
      rec('2002-05-11'),
      rec('2003-05-12'),
      rec('2004-11-13'),
    ])
    expect(result.deathsByMonth).toHaveLength(12)
    const sum = result.deathsByMonth.reduce((a, b) => a + b, 0)
    expect(sum).toBe(result.total)
    expect(result.total).toBe(4)
  })
})
