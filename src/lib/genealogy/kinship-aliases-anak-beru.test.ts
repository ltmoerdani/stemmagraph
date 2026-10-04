import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases anak beru Karo (v225-i, kind pernikahan depth 1, resiprokal kalimbubu)', () => {
  it('anak beru resolve ke pernikahan depth 1 region Karo', () => {
    const e = resolveAlias('anak beru', 'Karo')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('pernikahan')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('normalisasi case-insensitive dan trim', () => {
    expect(resolveAlias('Anak Beru', 'Karo')).not.toBeNull()
    expect(resolveAlias(' Anak Beru ', 'Karo')).not.toBeNull()
  })

  it('negatif arah reciprocity: note anak beru memuat arah pengambil perempuan, bukan pemberi (v222-i kalimbubu cabang terpisah)', () => {
    const ab = resolveAlias('anak beru', 'Karo')
    expect(ab).not.toBeNull()
    expect(ab?.note).toContain('pengambil perempuan')
    expect(ab?.note).toContain('resiprokal dengan kalimbubu')
  })

  it('negatif arah reciprocity: note anak beru tidak mengklaim pemberi perempuan', () => {
    expect(resolveAlias('anak beru', 'Karo')?.note).not.toContain('anak beru adalah pemberi')
  })

  it('negatif homonim: beru polos nihil, bukan lemma berdiri sendiri', () => {
    expect(resolveAlias('beru')).toBeNull()
  })

  it('negatif homonim: anak polos nihil (anak adalah entri map utama beda makna, anakanak juga nihil sebagai string) tetap non-regresi', () => {
    expect(resolveAlias('anakberu')).toBeNull()
  })

  it('negatif: anak beru2 (varian fiktif) nihil', () => {
    expect(resolveAlias('anak beru2')).toBeNull()
  })

  it('note memuat empat sumber: Meiliana LITERA DOI, Wahyuni Puteri Hijau DOI, Woollams baris 220-224, Singarimbun DOI', () => {
    const note = resolveAlias('anak beru', 'Karo')?.note ?? ''
    expect(note).toContain('10.21831/ltr.v19i1.30478')
    expect(note).toContain('10.24114/ph.v8i2.47936')
    expect(note).toContain('1885/145878')
    expect(note).toContain('10.2307/jj.13167910')
    expect(note).toContain('hakim moral')
  })

  it('note memuat arah reciprocity eksplisit: anak beru pengambil, kalimbubu pemberi', () => 
{
    const note = resolveAlias('anak beru', 'Karo')?.note ?? ''
    expect(note).toContain('anak beru adalah pengambil')
    expect(note).toContain('kalimbubu adalah pemberi')
  })

  it('non-regresi entri Karo existing: senina sembuyak eda lemirat kalimbubu tetap utuh', () => {
    expect(resolveAlias('senina', 'Karo')).not.toBeNull()
    expect(resolveAlias('sembuyak', 'Karo')).not.toBeNull()
    expect(resolveAlias('eda', 'Karo')).not.toBeNull()
    expect(resolveAlias('lemirat', 'Karo')).not.toBeNull()
    expect(resolveAlias('nande', 'Karo')).not.toBeNull()
    expect(resolveAlias('impal', 'Karo')).not.toBeNull()
    expect(resolveAlias('kaka', 'Karo')).not.toBeNull()
  })

  it('non-regresi entri map utama: anak tetap child, tidak tertimpa alias anak beru', () => {
    expect(resolveAlias('anak')?.kind).toBe('child')
    expect(KINSHIP_ALIASES).not.toHaveProperty('anak beru')
  })

  it('key eksak satu, di map regional Karo, bukan map utama', () => {
    const karoKeys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).filter((k) => k.includes('anak'))
    expect(karoKeys).toEqual(['anak beru', 'anak beru menteri']) // v235-i +1 anak beru menteri
  })

  it('struktur entri persis 4 field depth kind note region', () => {
    const e = resolveAlias('anak beru', 'Karo')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note', 'region'])
  })
})
