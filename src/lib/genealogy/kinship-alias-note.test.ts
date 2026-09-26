import { describe, expect, it } from 'vitest'
import { aliasNoteForPhrase, aliasDisplay } from './kinship-alias-note'

describe('aliasNoteForPhrase (kasus inti, commit dini)', () => {
  it('aki Sunda menjadi istilah regional untuk kakek nenek', () => {
    expect(aliasNoteForPhrase('aki')).toBe('istilah regional untuk kakek nenek')
  })

  it('eyang hormat Jawa menjadi istilah hormat untuk kakek nenek', () => {
    expect(aliasNoteForPhrase('eyang')).toBe('istilah hormat (Jawa) untuk kakek nenek')
  })

  it('frasa tak dikenali mengembalikan null', () => {
    expect(aliasNoteForPhrase('bukan alias')).toBeNull()
  })
})

describe('aliasNoteForPhrase (fase ii, AC penuh v176-ii)', () => {
  it('ninik hormat Melayu/Minangkabau memuat region di catatan', () => {
    expect(aliasNoteForPhrase('ninik')).toBe(
      'istilah hormat (Melayu/Minangkabau) untuk kakek nenek'
    )
  })

  it('nini multi region tanpa register hormat menjadi istilah regional', () => {
    expect(aliasNoteForPhrase('nini')).toBe('istilah regional untuk kakek nenek')
  })

  it('mbah Jawa tanpa register hormat menjadi istilah regional', () => {
    expect(aliasNoteForPhrase('mbah')).toBe('istilah regional untuk kakek nenek')
  })

  it('opa Betawi cak menjadi istilah regional tanpa region di teks', () => {
    expect(aliasNoteForPhrase('opa')).toBe('istilah regional untuk kakek nenek')
  })

  it('misan Sunda memetakan ke label baku sepupu', () => {
    expect(aliasNoteForPhrase('misan')).toBe('istilah regional untuk sepupu')
  })

  it('entri kolektif tanpa metadata regional mengembalikan null', () => {
    expect(aliasNoteForPhrase('karuhun')).toBeNull()
    expect(aliasNoteForPhrase('nenek moyang')).toBeNull()
  })

  it('label baku nasional mengembalikan null', () => {
    expect(aliasNoteForPhrase('anak')).toBeNull()
    expect(aliasNoteForPhrase('sepupu')).toBeNull()
  })

  it('normalisasi spasi dan kapital tetap dikenali', () => {
    expect(aliasNoteForPhrase('  Eyang  ')).toBe('istilah hormat (Jawa) untuk kakek nenek')
  })
})

describe('aliasDisplay (fase ii)', () => {
  it('alias regional: label baku utama plus catatan dan metadata', () => {
    expect(aliasDisplay('eyang')).toEqual({
      label: 'kakek nenek',
      note: 'istilah hormat (Jawa) untuk kakek nenek',
      region: 'Jawa',
      register: 'hormat',
    })
  })

  it('label baku: label utama, catatan nihil, metadata nihil', () => {
    expect(aliasDisplay('anak')).toEqual({
      label: 'anak',
      note: null,
      region: null,
      register: null,
    })
  })

  it('frasa tak dikenali mengembalikan null', () => {
    expect(aliasDisplay('bukan alias')).toBeNull()
  })

  it('catatan homonim non regional tetap tampil lewat entry.note', () => {
    expect(aliasDisplay('datuk')).toEqual({
      label: 'kakek nenek',
      note: 'homonim: makna 2 leluhur saat konteks naik jauh',
      region: 'Melayu',
      register: null,
    })
  })
})

describe('aliasDisplay locale en (fase ii)', () => {
  it('eyang di locale en berlabel grandparent', () => {
    const disp = aliasDisplay('eyang', 'en')
    expect(disp?.label).toBe('grandparent')
    expect(disp?.region).toBe('Jawa')
  })

  it('anak di locale en berlabel child', () => {
    expect(aliasDisplay('anak', 'en')?.label).toBe('child')
  })
})

describe('determinisme (fase ii)', () => {
  it('panggilan berulang menghasilkan output identik', () => {
    expect(aliasDisplay('aki')).toEqual(aliasDisplay('aki'))
    expect(aliasNoteForPhrase('eyang')).toBe(aliasNoteForPhrase('eyang'))
    expect(JSON.stringify(aliasDisplay('nini'))).toBe(JSON.stringify(aliasDisplay('nini')))
  })
})
