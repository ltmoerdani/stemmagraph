import { describe, expect, it } from 'vitest'
import {
  hasInlawModifier,
  inlawCounterpart,
  inlawLabel,
  inlawLabels,
  inlawPhraseOverride,
  isComposedInlawLabel,
  type InlawRelation,
} from './kinship-inlaw'

const rel = (basis: InlawRelation['basis'], modifier: InlawRelation['modifier']): InlawRelation => ({
  basis,
  modifier,
})

describe('kinship-inlaw (GOAL v179-iii fase i, pure only)', () => {
  it('modifier spouse di atas basis self menghasilkan pasangan', () => {
    expect(inlawLabels(rel('self', 'spouse')).id).toBe('pasangan')
  })

  it('mertua dari spouseParent (kombinasi self)', () => {
    expect(inlawLabels(rel('self', 'spouseParent')).id).toBe('mertua')
  })

  it('menantu dari child plus spouse', () => {
    expect(inlawLabels(rel('child', 'spouse')).id).toBe('menantu')
  })

  it('ipar dari basis sibling plus modifier spouse', () => {
    expect(inlawLabels(rel('sibling', 'spouse')).id).toBe('ipar')
  })

  it('menantu dari childSpouse tanpa enum kelima (kombinasi ganda)', () => {
    expect(inlawLabels(rel('self', 'childSpouse')).id).toBe('menantu')
  })

  it('bisan turun dari kombinasi ganda dua sisi parent spouseParent', () => {
    expect(inlawLabels(rel('parent', 'spouseParent')).id).toBe('bisan')
  })

  it('counterpart mertua adalah menantu dari sudut child childSpouse', () => {
    expect(inlawCounterpart(rel('self', 'spouseParent'))).toEqual(rel('child', 'childSpouse'))
  })

  it('counterpart besan kembali ke mertua (dua sisi saling berhadapan)', () => {
    expect(inlawCounterpart(rel('self', 'childSpouse'))).toEqual(rel('parent', 'spouseParent'))
  })

  it('fallback locale tak dikenal ke id', () => {
    expect(inlawLabel(rel('self', 'spouseParent'), 'jv')).toBe('mertua')
  })

  it('locale en bekerja normal', () => {
    expect(inlawLabel(rel('sibling', 'spouse'), 'en')).toBe("spouse's sibling")
  })

  it('jalur phrase regional tanpa enum baru', () => {
    expect(inlawPhraseOverride(rel('self', 'spouseParent'), 'mintho')).toBe(
      'mintho (istilah regional)',
    )
  })

  it('phrase identik label baku tidak diberi tanda regional', () => {
    expect(inlawPhraseOverride(rel('self', 'spouseParent'), 'mertua')).toBe('mertua')
  })

  it('guard homonim: label gabungan hanya untuk modifier ganda atau sibling', () => {
    expect(isComposedInlawLabel(rel('self', 'spouseParent'))).toBe(true)
    expect(isComposedInlawLabel(rel('sibling', 'none'))).toBe(false)
    expect(hasInlawModifier('none')).toBe(false)
    expect(hasInlawModifier('spouse')).toBe(true)
  })

  it('besan dan bisan tetap relasi dua set orang tua setelah koreksi KBBI', () => {
    // KBBI besan arti 2: hubungan keluarga antara dua orang tua karena
    // anak mereka kawin; bukan sebutan untuk pasangan anak.
    expect(inlawLabels(rel('child', 'childSpouse')).id).toBe('besan')
    expect(inlawLabels(rel('parent', 'spouseParent')).id).toBe('bisan')
  })

  it('korespondensi label dua sisi: menantu di sini adalah bisan di sana', () => {
    expect(inlawLabels(inlawCounterpart(rel('self', 'childSpouse'))).id).toBe('bisan')
    expect(inlawLabels(inlawCounterpart(rel('parent', 'spouseParent'))).id).toBe('besan')
  })
})
