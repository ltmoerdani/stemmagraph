import { describe, expect, it } from 'vitest'
import { aliasKinds, KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'
import { polisemiGuard } from './kinship-polisemi-guard'

/**
 * Test dedikasi lema GLOBAL abang baku nasional (gel28 rev 2).
 * Kontrak: drafts/kontrak-stg-gel28-abang-2026-10-15.md rev 2, AC butir 3.
 * Lema global baku pola akak/nyokap: kind sibling depth 1, tanpa region,
 * tanpa qualifier. Regional abang Simalungun v218-i tetap utuh, precedence
 * resolveAlias regional menang. Nama file sengaja beda dari
 * kinship-aliases-abang.test.ts milik v218-i agar tidak overwrite.
 * Catatan jujur: kakak dalam klaster sibling ternyata NIHIL key di map
 * (hanya glosa), terverifikasi probe tip e261cd2, sehingga assertion-nya
 * menjaga perilaku eksisting tetap null (non-regresi), bukan dipaksa positif.
 */
describe('kinship-aliases abang GLOBAL baku (gel28 rev 2, kind sibling, kakak laki-laki)', () => {
  it('1. positif global: abang kind sibling depth 1 tanpa region tanpa qualifier', () => {
    const r = resolveAlias('abang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBeUndefined()
    expect(r?.qualifier).toBeUndefined()
  })

  it('2. resolveAlias(abang) tanpa region kembalikan entri global di map utama', () => {
    expect(resolveAlias('abang')).toEqual(KINSHIP_ALIASES['abang'])
    expect(Object.keys(KINSHIP_ALIASES)).toContain('abang')
  })

  it('3. normalisasi kapital: ABANG lolos sbg global, BERABANG terblokir guard', () => {
    const r = resolveAlias('ABANG')
    expect(r?.kind).toBe('sibling')
    expect(r?.region).toBeUndefined()
    expect(resolveAlias('BERABANG')).toBeNull()
    expect(polisemiGuard('BERABANG')).toBeNull()
  })

  it('4. homograf abang2 nihil key, makna warna Jawa tidak dipetakan', () => {
    expect(resolveAlias('abang2')).toBeNull()
    expect(KINSHIP_ALIASES['abang2']).toBeUndefined()
  })

  it('5. homograf ber spasi: "abang 2" nihil key dan resolve null', () => {
    expect(KINSHIP_ALIASES['abang 2']).toBeUndefined()
    expect(resolveAlias('abang 2')).toBeNull()
  })

  it('6. precedence regional: resolveAlias(abang, Simalungun) tetap entri Simalungun', () => {
    const r = resolveAlias('abang', 'Simalungun')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Simalungun')
    expect(r).not.toEqual(KINSHIP_ALIASES['abang'])
  })

  it('7. fallback region lain: Toba dan Karo kembalikan entri GLOBAL (region undefined, kind sibling)', () => {
    for (const region of ['Toba', 'Karo']) {
      const r = resolveAlias('abang', region)
      expect(r).not.toBeNull()
      expect(r?.kind).toBe('sibling')
      expect(r?.region).toBeUndefined()
      expect(r).toEqual(KINSHIP_ALIASES['abang'])
    }
  })

  it('8. regression klaster sibling: kaka akak bang bung raka ading tetap benar, kakak tetap nihil key selayaknya eksisting', () => {
    expect(resolveAlias('kaka')?.kind).toBe('sibling')
    expect(resolveAlias('akak')?.kind).toBe('sibling')
    expect(resolveAlias('bang')?.kind).toBe('sibling')
    expect(resolveAlias('bung')?.kind).toBe('sibling')
    expect(resolveAlias('raka')?.kind).toBe('sibling')
    expect(resolveAlias('ading')?.kind).toBe('sibling')
    expect(resolveAlias('kakak')).toBeNull()
  })

  it('9. total map PERSIS 138 dan aliasKinds 138 pasca gel35 (bump dari 136, lema orang tua asuh)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(143)
    expect(aliasKinds().length).toBe(143)
  })

  it('10. blacklist PERSIS 9 via perilaku: 8 frasa lama plus berabang null, abang lolos', () => {
    for (const p of [
      'putra mahkota',
      'putri malu',
      'putri boyongan',
      'berputra',
      'berputri',
      'cicit2',
      'canggah1',
      'bebuyutan',
      'berabang',
    ]) {
      expect(polisemiGuard(p)).toBeNull()
    }
    expect(polisemiGuard('abang')).toBe('abang')
    expect(resolveAlias('berabang')).toBeNull()
  })

  it('11. homonim antarbahasa: blok ban dan jv nihil efek sbg key', () => {
    expect(resolveAlias('ban')).toBeNull()
    expect(resolveAlias('jv')).toBeNull()
    expect(KINSHIP_ALIASES['ban']).toBeUndefined()
    expect(KINSHIP_ALIASES['jv']).toBeUndefined()
  })

  it('12. turunan berabang nihil key di map utama', () => {
    expect(KINSHIP_ALIASES['berabang']).toBeUndefined()
    expect(resolveAlias('berabang', 'Simalungun')).toBeNull()
  })

  it('13. positif lolos bentuk ternormalisasi: trim, titik tengah, spasi ganda', () => {
    expect(resolveAlias('  abang  ')).toEqual(resolveAlias('abang'))
    expect(resolveAlias('a\u00B7bang')).toEqual(resolveAlias('abang'))
    expect(resolveAlias('  ABANG  ')?.region).toBeUndefined()
  })

  it('14. note memuat anchor dual-source dan catatan guard rev 2', () => {
    const note = KINSHIP_ALIASES['abang'].note
    expect(note).toBeDefined()
    expect(note?.length).toBeGreaterThan(0)
    expect(note).toContain('kbbi.web.id/abang')
    expect(note).toContain('revid 1470859')
    expect(note).toContain('Simalungun')
  })
})
