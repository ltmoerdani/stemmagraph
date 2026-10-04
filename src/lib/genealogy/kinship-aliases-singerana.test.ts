import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases singerana Karo (v229-i, peran adat anak beru dalam pernikahan, depth 1)', () => {
  it('entri singerana terdaftar di blok Karo dengan empat field lengkap', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.singerana
    expect(e).toBeDefined()
    expect(e.kind).toBe('pernikahan')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('Karo')
    expect((e.note ?? '').length).toBeGreaterThan(50)
  })

  it('resolve penuh lewat resolveAlias region Karo', () => {
    const e = resolveAlias('singerana', 'Karo')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(1)
  })

  it('negatif konvensi regional: tanpa region nihil, entri Karo butuh argumen region eksplisit', () => {
    expect(resolveAlias('singerana')).toBeNull()
    expect(resolveAlias('singerana', 'Toba')).toBeNull()
  })

  it('normalisasi case-insensitive dan trim tetap resolve', () => {
    expect(resolveAlias(' Singerana ', 'Karo')).not.toBeNull()
    expect(resolveAlias('SINGERANA', 'Karo')?.depth).toBe(1)
  })

  it('note memuat tri-source: OSF DOI, JAMPARING DOI, EUDL DOI', () => {
    const note = resolveAlias('singerana', 'Karo')?.note ?? ''
    expect(note).toContain('10.31227/osf.io/mz6kh_v1')
    expect(note).toContain('10.57235/jamparing.v3i1.4771')
    expect(note).toContain('10.4108/eai.20-9-2019.2296621')
  })

  it('note memuat substansi peran: berbicara, bahasa santun mehamat, bukan pihak kalimbubu pemberi', () => {
    const note = resolveAlias('singerana', 'Karo')?.note ?? ''
    expect(note).toContain('berbicara')
    expect(note).toContain('mehamat')
    expect(note).toContain('pengambil perempuan')
    expect(note).toContain('bukan pihak kalimbubu pemberi perempuan')
  })

  it('negatif homonim: ngera polos nihil, tidak boleh match singerana', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo.ngera).toBeUndefined()
    expect(resolveAlias('ngera', 'Karo')).toBeNull()
    expect(resolveAlias('ngera')).toBeNull()
  })

  it('negatif homonim: anak beru polos tetap map entri existing, bukan singerana', () => {
    const ab = resolveAlias('anak beru', 'Karo')
    expect(ab?.kind).toBe('pernikahan')
    expect(ab?.depth).toBe(1)
    expect((ab?.note ?? '')).toContain('penerima perempuan')
    expect((ab?.note ?? '')).not.toContain('10.4108/eai.20-9-2019.2296621')
  })

  it('negatif reciprocity: note tidak mengklaim singerana di pihak pemberi perempuan kalimbubu', () => {
    const note = resolveAlias('singerana', 'Karo')?.note ?? ''
    expect(note).not.toContain('singerana adalah pemberi')
  })

  it('negatif bentrok v227-i: metenget ersenina dan metami man anak beru tetap nihil sebagai key', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metenget ersenina']).toBeUndefined()
    expect(resolveAlias('metenget ersenina', 'Karo')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Karo['metami man anak beru']).toBeUndefined()
    expect(resolveAlias('metami man anak beru', 'Karo')).toBeNull()
  })

  it('non-regresi: kalimbubu dan puang kalimbubu tidak tertimpa entri singerana', () => {
    expect(resolveAlias('kalimbubu', 'Karo')?.depth).toBe(1)
    expect(resolveAlias('kalimbubu', 'Karo')?.note).toContain('pemberi perempuan')
    expect(resolveAlias('puang kalimbubu', 'Karo')?.depth).toBe(2)
  })

  it('non-regresi: komposit mehamat man kalimbubu v227-i tetap depth 2 utuh', () => {
    const e = resolveAlias('mehamat man kalimbubu', 'Karo')
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(2)
  })

  it('guard: objek Karo naik tepat 27 jadi 28 key, singerana sisip alfabetis antara sepemeren dan sukut', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    expect(keys.length).toBe(29) // v232-i bump 28 jadi 29 (alias kalimbubu simada dareh)
    expect(keys).toContain('singerana')
    const sorted = [...keys].sort()
    const i = sorted.indexOf('singerana')
    expect(sorted[i - 1]).toBe('sepemeren')
    expect(sorted[i + 1]).toBe('sukut')
  })

  it('guard regional map tetap tiga region, Toba tidak tersentuh', () => {
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL).sort()).toEqual(['Karo', 'Simalungun', 'Toba'])
    expect(KINSHIP_ALIASES_REGIONAL.Toba.singerana).toBeUndefined()
  })
})
