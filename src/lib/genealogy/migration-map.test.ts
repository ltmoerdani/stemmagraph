import { describe, expect, it } from 'vitest'
import { roundTrip } from './genealogical-date'
import {
  birthDateToJson,
  deathDateToJson,
  mapLegacyGender,
  migrateMemberDates,
} from './migration-map'

describe('mapLegacyGender', () => {
  it('memetakan male ke M', () => {
    expect(mapLegacyGender('male')).toBe('M')
  })

  it('memetakan FEMALE ke F case insensitive', () => {
    expect(mapLegacyGender('FEMALE')).toBe('F')
  })

  it('memetakan other ke X', () => {
    expect(mapLegacyGender('other')).toBe('X')
  })

  it('menerima singkatan m dan f', () => {
    expect(mapLegacyGender('m')).toBe('M')
    expect(mapLegacyGender('f')).toBe('F')
  })

  it('memetakan input tak dikenal ke U', () => {
    expect(mapLegacyGender('misterius')).toBe('U')
  })

  it('memetakan null dan non-string ke U', () => {
    expect(mapLegacyGender(null)).toBe('U')
    expect(mapLegacyGender(42)).toBe('U')
  })
})

describe('birthDateToJson', () => {
  it('mem-parse tahun tunggal ke exact', () => {
    expect(birthDateToJson('1920')).toEqual({ modifier: 'exact', year: 1920, quality: null })
  })

  it('mem-parse ABT 1850 ke about', () => {
    expect(birthDateToJson('ABT 1850')).toEqual({ modifier: 'about', year: 1850, quality: null })
  })

  it('mem-parse FROM 1900 TO 1910 ke periode from-to', () => {
    expect(birthDateToJson('FROM 1900 TO 1910')).toEqual({
      modifier: 'from',
      year: 1900,
      year2: 1910,
      quality: null,
    })
  })

  it('roundTrip FROM-TO menghasilkan struktur setara', () => {
    const pertama = birthDateToJson('FROM 1900 TO 1910')
    const kedua = roundTrip('FROM 1900 TO 1910')
    expect(pertama).toEqual(kedua)
  })

  it('menyimpan phrase utuh saat parse gagal, tanpa year', () => {
    expect(birthDateToJson('sometime in June')).toEqual({
      modifier: 'exact',
      phrase: 'sometime in June',
      quality: null,
    })
  })

  it('mengembalikan null untuk input kosong dan non-string', () => {
    expect(birthDateToJson(null)).toBeNull()
    expect(birthDateToJson('')).toBeNull()
    expect(birthDateToJson(1900)).toBeNull()
  })
})

describe('deathDateToJson', () => {
  it('mem-parse BEFORE 1950 ke to', () => {
    expect(deathDateToJson('BEFORE 1950')).toEqual({ modifier: 'to', year: 1950, quality: null })
  })

  it('menyimpan phrase kematian di struktur', () => {
    const hasil = deathDateToJson('died in the winter')
    expect(hasil?.phrase).toBe('died in the winter')
    expect(hasil?.modifier).toBe('exact')
  })
})

describe('migrateMemberDates dedup safety', () => {
  it('dua person beda id menghasilkan hasil saling independen', () => {
    const a = migrateMemberDates({ id: 'p1', birthDate: 'ABT 1850', deathDate: '1901' })
    const b = migrateMemberDates({ id: 'p2', birthDate: 'FROM 1900 TO 1910', deathDate: null })

    expect(a.id).toBe('p1')
    expect(b.id).toBe('p2')
    expect(a.birthDateGed?.year).toBe(1850)
    expect(b.birthDateGed?.year).toBe(1900)
    expect(b.birthDateGed?.year2).toBe(1910)
    expect(a.deathDateGed?.year).toBe(1901)
    expect(b.deathDateGed).toBeNull()
  })

  it('hasil antar person tidak berbagi referensi objek', () => {
    const a = migrateMemberDates({ id: 'p1', birthDate: 'ABT 1850' })
    const b = migrateMemberDates({ id: 'p2', birthDate: 'ABT 1850' })

    expect(a.birthDateGed).not.toBe(b.birthDateGed)
  })
})
