import { describe, expect, it } from 'vitest'
import {
  INLAW_STANDARD_LABELS,
  inlawDisplayForPhrase,
} from './kinship-inlaw-display'
import { aliasDisplay } from './kinship-alias-note'

describe('INLAW_STANDARD_LABELS (v180-i)', () => {
  it('memuat 7 label baku: pasangan, ipar, orang tua tiri, menantu, bisan, mertua, besan', () => {
    expect(INLAW_STANDARD_LABELS).toEqual([
      'pasangan',
      'ipar',
      'orang tua tiri',
      'menantu',
      'bisan',
      'mertua',
      'besan',
    ])
  })
})

describe('inlawDisplayForPhrase (v180-i)', () => {
  it('kasus 1: semua label baku dikenali, label sama dengan frasa, region dan register nihil', () => {
    for (const label of INLAW_STANDARD_LABELS) {
      const hasil = inlawDisplayForPhrase(label)
      expect(hasil).not.toBeNull()
      expect(hasil?.label).toBe(label)
      expect(hasil?.region).toBeNull()
      expect(hasil?.register).toBeNull()
      expect(hasil?.note).not.toBeNull()
    }
  })

  it('kasus 2: trim dan case-insensitive untuk label id', () => {
    expect(inlawDisplayForPhrase('  MERTUA  ')?.label).toBe('mertua')
    expect(inlawDisplayForPhrase('\tMenantu\n')?.label).toBe('menantu')
    expect(inlawDisplayForPhrase('Besan')?.label).toBe('besan')
    expect(inlawDisplayForPhrase('Ipar')?.label).toBe('ipar')
  })

  it('kasus 3: frasa bukan label baku mengembalikan null', () => {
    expect(inlawDisplayForPhrase('bukan label')).toBeNull()
    expect(inlawDisplayForPhrase('mertua saya')).toBeNull()
    expect(inlawDisplayForPhrase('')).toBeNull()
    expect(inlawDisplayForPhrase('   ')).toBeNull()
  })

  it('kasus 4: frasa alias regional tetap jalur aliasDisplay, bukan jalur inlaw', () => {
    // Alias regional mengenali aki; jalur inlaw harus nihil untuk frasa itu.
    expect(inlawDisplayForPhrase('aki')).toBeNull()
    const dariAlias = aliasDisplay('aki')
    expect(dariAlias).not.toBeNull()
    expect(dariAlias?.label).toBe('kakek nenek')
    // Konsumen UI: aliasDisplay dipanggil dulu, inlaw hanya bila alias nihil.
    const jalurUi = aliasDisplay('aki') ?? inlawDisplayForPhrase('aki')
    expect(jalurUi?.label).toBe('kakek nenek')
  })

  it('kasus 5: note umum menyebut istilah fase pernikahan', () => {
    expect(inlawDisplayForPhrase('pasangan')?.note).toBe('istilah fase pernikahan')
    expect(inlawDisplayForPhrase('ipar')?.note).toBe('istilah fase pernikahan')
    expect(inlawDisplayForPhrase('orang tua tiri')?.note).toBe(
      'istilah fase pernikahan',
    )
  })

  it('kasus 6: note besan menyebut relasi dua set orang tua', () => {
    const hasil = inlawDisplayForPhrase('besan')
    expect(hasil?.note).toContain('istilah fase pernikahan')
    expect(hasil?.note).toContain('dua set orang tua')
    expect(hasil?.note).toContain('anak mereka kawin')
  })

  it('kasus 7: note bisan menyebut relasi dua set orang tua', () => {
    const hasil = inlawDisplayForPhrase('bisan')
    expect(hasil?.note).toContain('istilah fase pernikahan')
    expect(hasil?.note).toContain('dua set orang tua')
    expect(hasil?.note).toContain('anak mereka kawin')
  })

  it('kasus 8: note mertua dan menantu bukan note dua sisi', () => {
    expect(inlawDisplayForPhrase('mertua')?.note).toBe('istilah fase pernikahan')
    expect(inlawDisplayForPhrase('menantu')?.note).toBe('istilah fase pernikahan')
  })

  it('kasus 9: locale en fallback label en dari inlawLabel', () => {
    expect(inlawDisplayForPhrase('mertua', 'en')?.label).toBe("spouse's parent")
    expect(inlawDisplayForPhrase('menantu', 'en')?.label).toBe("child's spouse")
    expect(inlawDisplayForPhrase('ipar', 'en')?.label).toBe("spouse's sibling")
    expect(inlawDisplayForPhrase('pasangan', 'en')?.label).toBe('spouse')
    expect(inlawDisplayForPhrase('besan', 'en')?.label).toBe(
      'child married to their child',
    )
    expect(inlawDisplayForPhrase('bisan', 'en')?.label).toBe(
      "child's parent-in-law",
    )
    expect(inlawDisplayForPhrase('orang tua tiri', 'en')?.label).toBe('stepparent')
  })

  it('kasus 10: locale en note memakai istilah bahasa Inggris', () => {
    expect(inlawDisplayForPhrase('mertua', 'en')?.note).toBe('marriage term')
    expect(inlawDisplayForPhrase('besan', 'en')?.note).toBe(
      'marriage term: relation between two sets of parents through their children',
    )
  })

  it('kasus 11: locale tak dikenal fallback ke id', () => {
    expect(inlawDisplayForPhrase('mertua', 'fr' as 'id' | 'en')?.label).toBe('mertua')
    expect(inlawDisplayForPhrase('mertua', 'fr' as 'id' | 'en')?.note).toBe(
      'istilah fase pernikahan',
    )
  })

  it('kasus 12: homonim gabungan tidak diterima, hanya label baku satu kata atau frasa tetap', () => {
    expect(inlawDisplayForPhrase('mertua ipar')).toBeNull()
    expect(inlawDisplayForPhrase('besan bisan')).toBeNull()
    expect(inlawDisplayForPhrase('IPAR')).not.toBeNull()
  })

  it('kasus 13: struktur hasil AliasDisplay-compatible', () => {
    const hasil = inlawDisplayForPhrase('menantu')
    expect(Object.keys(hasil ?? {}).sort()).toEqual([
      'label',
      'note',
      'region',
      'register',
    ])
  })
})
