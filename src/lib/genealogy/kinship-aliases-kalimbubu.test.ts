import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases kalimbubu Karo (v222-i, kind pernikahan depth 1, resiprokal anak beru)', () => {
  it('kalimbubu resolve ke pernikahan depth 1 region Karo', () => {
    const e = resolveAlias('kalimbubu', 'Karo')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('normalisasi case-insensitive dan trim', () => {
    expect(resolveAlias('Kalimbubu', 'Karo')).not.toBeNull()
    expect(resolveAlias(' Kalimbubu ', 'Karo')).not.toBeNull()
  })

  it('arah reciprocity: note memuat pemberi perempuan dan resiprokal anak beru', () => {
    const note = resolveAlias('kalimbubu', 'Karo')?.note ?? ''
    expect(note).toContain('pemberi perempuan')
    expect(note).toContain('resiprokal dengan anak beru')
    expect(note).toContain('kalimbubu adalah pemberi')
  })

  it('note memuat lima sumber: Woollams hdl, Singarimbun DOI, Meiliana DOI, Wahyuni DOI, Simbolika DOI', () => {
    const note = resolveAlias('kalimbubu', 'Karo')?.note ?? ''
    expect(note).toContain('1885/145878')
    expect(note).toContain('10.2307/jj.13167910.12')
    expect(note).toContain('10.21831/ltr.v19i1.30478')
    expect(note).toContain('10.24114/ph.v8i2.47936')
    expect(note).toContain('10.31289/simbolika.v9i2.10139')
  })

  it('komposit puang kalimbubu terdokumentasi di note, bukan key terpisah', () => {
    const note = resolveAlias('kalimbubu', 'Karo')?.note ?? ''
    expect(note).toContain('puang kalimbubu')
    expect(KINSHIP_ALIASES_REGIONAL.Karo['puang kalimbubu']).toBeUndefined()
  })

  it('negatif homonim: kalim polos nihil, bukan key', () => {
    expect(resolveAlias('kalim')).toBeNull()
  })

  it('negatif homonim EN Wiktionary: makna Lindu bubble bukan Karo, tidak dipetakan sbg konten', () => {
    const note = resolveAlias('kalimbubu', 'Karo')?.note ?? ''
    expect(note).not.toContain('Lindu')
  })

  it('negatif arah reciprocity: note tidak mengklaim kalimbubu pengambil', () => {
    expect(resolveAlias('kalimbubu', 'Karo')?.note).not.toContain('kalimbubu adalah pengambil')
  })

  it('resiprokal konsisten dengan anak beru (v225-i): dua arah note bersilangan', () => {
    const kal = resolveAlias('kalimbubu', 'Karo')?.note ?? ''
    const ab = resolveAlias('anak beru', 'Karo')?.note ?? ''
    expect(kal).toContain('anak beru')
    expect(ab).toContain('kalimbubu')
  })

  it('negatif: kalimbubu2 varian fiktif nihil', () => {
    expect(resolveAlias('kalimbubu2')).toBeNull()
  })

  it('key eksak di map regional Karo, bukan map utama', () => {
    expect(KINSHIP_ALIASES).not.toHaveProperty('kalimbubu')
    expect(KINSHIP_ALIASES_REGIONAL.Karo).toHaveProperty('kalimbubu')
  })

  it('guard posisi: kalimbubu terletak antara impal dan kempu di blok Karo', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo)
    const i = keys.indexOf('kalimbubu')
    expect(keys[i - 1]).toBe('impal')
    expect(keys[i + 1]).toBe('kempu')
  })

  it('non-regresi entri pernikahan Karo existing: lemirat ngalih ngerbani anak beru tetap utuh', () => {
    expect(resolveAlias('lemirat', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('ngalih', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('ngerbani', 'Karo')?.kind).toBe('pernikahan')
    expect(resolveAlias('anak beru', 'Karo')?.kind).toBe('pernikahan')
  })

  it('non-regresi entri Karo group: sembuyak senina nande impal kaka', () => {
    expect(resolveAlias('sembuyak', 'Karo')).not.toBeNull()
    expect(resolveAlias('senina', 'Karo')).not.toBeNull()
    expect(resolveAlias('nande', 'Karo')).not.toBeNull()
    expect(resolveAlias('impal', 'Karo')).not.toBeNull()
    expect(resolveAlias('kaka', 'Karo')).not.toBeNull()
  })
})
