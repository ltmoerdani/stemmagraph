import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

// Gel27 rev 2 (15 Okt 2026): cicit buyut canggah SUDAH key live sebelum gel27;
// tugas gel27 direvscopen PM dari tambah key menjadi pengayaan note dual-source
// plus guard negatif homograf, key map dan guard total TIDAK berubah saat gel27;
// total kini 132 sejak gel28 (lema abang global), bump literal tercatat di commit gel28.
// Evidence first-hand PM akses 15 Okt 2026: mirror kbbi.web.id cicit (ci·cit1
// anak dari cucu, homograf cicit2 onomatope), buyut (bu·yut n 2 anak dari cucu),
// canggah (cang·gah1 galah dahan bercabang, kekerabatan hanya di KBBI VI cang.gah2),
// Wiktionary ID revid cicit 1113041, buyut 1313716, canggah 1314027.

describe('kinship-aliases gel27 rev 2 pengayaan cicit buyut canggah', () => {
  it('1. cicit resolve descendant depth 3, note dual-source baru', () => {
    const r = resolveAlias('cicit')
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(3)
    expect(r?.note).toContain('anak dari cucu')
    expect(r?.note).toContain('kbbi.web.id/cicit')
    expect(r?.note).toContain('1113041')
  })

  it('2. buyut resolve descendant depth 3, note dual-source baru, arah dua terjaga', () => {
    const r = resolveAlias('buyut')
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(3)
    expect(r?.note).toContain('kbbi.web.id/buyut')
    expect(r?.note).toContain('1313716')
    expect(r?.note).toContain('dua arah')
  })

  it('3. canggah resolve descendant depth 4, note sumber Wiktionary plus KBBI VI', () => {
    const r = resolveAlias('canggah')
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(4)
    expect(r?.note).toContain('1314027')
    expect(r?.note).toContain('KBBI VI')
    expect(r?.note).toContain('cucu dari cucu')
  })

  it('4. guard total map TIDAK berubah: 134 klaim kontrak rev1 dianulir, tetap 131', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(133)
    expect(Object.keys(KINSHIP_ALIASES)).not.toHaveLength(134)
  })

  it('5. guard negatif homograf cicit2 onomatope nihil key terpisah', () => {
    expect(KINSHIP_ALIASES['cicit2']).toBeUndefined()
    expect(resolveAlias('ci.cit2')).toBeNull()
  })

  it('6. guard negatif homograf canggah1 galah nihil key, resolve tetap kekerabatan', () => {
    expect(KINSHIP_ALIASES['canggah1']).toBeUndefined()
    const r = resolveAlias('canggah')
    expect(r?.note).toContain('galah')
  })

  it('7. guard negatif idiom bebuyutan nihil key', () => {
    expect(KINSHIP_ALIASES['bebuyutan']).toBeUndefined()
    expect(resolveAlias('bebuyutan')).toBeNull()
  })

  it('8. guard negatif arah naik buyut orang tua dari nenek nihil key, kandidat gel29', () => {
    expect(KINSHIP_ALIASES['nenek dari kakek']).toBeUndefined()
    expect(resolveAlias('nenek dari kakek')).toBeNull()
  })

  it('9. rantai turun resmi utuh regresi: anak cucu cicit buyut canggah', () => {
    expect(resolveAlias('anak')?.kind).toBe('child')
    expect(resolveAlias('cucu')?.kind).toBe('grandchild')
    expect(resolveAlias('cicit')?.depth).toBe(3)
    expect(resolveAlias('buyut')?.depth).toBe(3)
    expect(resolveAlias('canggah')?.depth).toBe(4)
  })

  it('10. anggas regdept 5 tidak tersentuh, piut depth 4 tetap', () => {
    expect(resolveAlias('anggas')?.depth).toBe(5)
    expect(resolveAlias('piut')).toEqual({ kind: 'descendant', depth: 4 })
  })

  it('11. note canggah jujur soal mirror III nihil makna kekerabatan (kasus negatif senjata)', () => {
    const note = KINSHIP_ALIASES['canggah'].note ?? ''
    expect(note).toContain('CATATAN JUJUR')
    expect(note).toContain('cang·gah1 galah')
  })

  it('12. note tiga lemma memuat referensi kontrak rev 2', () => {
    for (const k of ['cicit', 'buyut', 'canggah']) {
      expect(KINSHIP_ALIASES[k].note).toContain('rev 2')
    }
  })
})
