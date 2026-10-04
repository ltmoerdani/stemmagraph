import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

const KEY = 'mehamat man kalimbubu'

describe('kinship-aliases mehamat man kalimbubu Karo (v227-i, komposit formula afinal depth 2)', () => {
  it('entri mehamat man kalimbubu terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo[KEY]
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(2)
    expect(e.region).toBe('Karo')
    expect((e.note ?? '').length).toBeGreaterThan(50)
  })

  it('resolve penuh lewat resolveAlias region Karo', () => {
    const e = resolveAlias(KEY, 'Karo')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(2)
  })

  it('normalisasi huruf besar dan spasi ganda tetap resolve', () => {
    expect(resolveAlias('  Mehamat  Man  Kalimbubu ', 'Karo')?.depth).toBe(2)
    expect(resolveAlias('MEHAMAT MAN KALIMBUBU', 'Karo')?.depth).toBe(2)
  })

  it('negatif homonim: mehamat polos nihil, dengan maupun tanpa region', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo.mehamat).toBeUndefined()
    expect(resolveAlias('mehamat', 'Karo')).toBeNull()
    expect(resolveAlias('mehamat')).toBeNull()
  })

  it('negatif potongan formula: mehamat man nihil', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['mehamat man']).toBeUndefined()
    expect(resolveAlias('mehamat man', 'Karo')).toBeNull()
  })

  it('negatif potongan formula: man kalimbubu nihil', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['man kalimbubu']).toBeUndefined()
    expect(resolveAlias('man kalimbubu', 'Karo')).toBeNull()
  })

  it('negatif non-duplikat komponen formula lain: metenget ersenina nihil (tidak didaftarkan di item ini)', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metenget ersenina']).toBeUndefined()
    expect(resolveAlias('metenget ersenina', 'Karo')).toBeNull()
  })

  it('negatif non-duplikat komponen formula lain: metami man anak beru nihil', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metami man anak beru']).toBeUndefined()
    expect(resolveAlias('metami man anak beru', 'Karo')).toBeNull()
  })

  it('non-regresi: kalimbubu depth 1 tetap resolve dan tidak tertimpa komposit', () => {
    const e = resolveAlias('kalimbubu', 'Karo')
    expect(e).not.toBeNull()
    expect(e?.depth).toBe(1)
    expect(KINSHIP_ALIASES_REGIONAL.Karo.kalimbubu?.depth).toBe(1)
  })

  it('non-regresi: anak beru tetap resolve', () => {
    expect(resolveAlias('anak beru', 'Karo')).not.toBeNull()
  })

  it('non-regresi: puang kalimbubu v226-i tetap resolve depth 2', () => {
    expect(resolveAlias('puang kalimbubu', 'Karo')?.depth).toBe(2)
  })

  it('note memuat DOI JAMPARING dan makna respect utk kalimbubu', () => {
    const note = resolveAlias(KEY, 'Karo')?.note ?? ''
    expect(note).toContain('10.57235/jamparing.v3i1.4771')
    expect(note).toContain('Dibata Ni Idah')
  })

  it('note memuat DOI SIMBOLIKA dengan status jujur abstrak-only', () => {
    const note = resolveAlias(KEY, 'Karo')?.note ?? ''
    expect(note).toContain('10.31289/simbolika.v9i2.10139')
    expect(note).toContain('403')
  })

  it('note memuat penguat JERUMI', () => {
    const note = resolveAlias(KEY, 'Karo')?.note ?? ''
    expect(note).toContain('10.57235/jerumi.v3i1.6375')
  })

  it('map utama KINSHIP_ALIASES tidak tersentuh entri komposit ini', () => {
    expect(KINSHIP_ALIASES.mehamat).toBeUndefined()
    expect(KINSHIP_ALIASES[KEY]).toBeUndefined()
  })
})
