import { describe, expect, it } from 'vitest'
import { polisemiGuard } from './kinship-polisemi-guard'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Test dedikasi guard polisemi terpusat (v254, diperbarui gel28 rev 2).
 * Kontrak: drafts/kontrak-stg-v254-polisemi-guard-2026-10-15.md rev 2.
 * Catatan jujur gel28: header lama menulis total map 131 TIDAK berubah;
 * sejak lema GLOBAL abang masuk map (kontrak
 * drafts/kontrak-stg-gel28-abang-2026-10-15.md rev 2), total map BUMP 132
 * dan blacklist 8 jadi 9 (tambah berabang). Lanjutan gel35: total map 137 dan
 * blacklist 9 jadi 10 (tambah mengasuh, turunan verba meN- pola berputra). Guard tetap tidak menambah lema;
 * bump datang dari lema map, bukan dari guard.
 */
describe('kinship-polisemi-guard v254', () => {
  it('1. semua 10 frasa blacklist resolve null via polisemiGuard', () => {
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
      'mengasuh',
    ]) {
      expect(polisemiGuard(p)).toBeNull()
    }
  })

  it('2. semua 10 frasa blacklist resolve null via resolveAlias', () => {
    for (const p of ['putra mahkota', 'putri malu', 'putri boyongan', 'berputra', 'berputri', 'cicit2', 'canggah1', 'bebuyutan', 'berabang', 'mengasuh']) {
      expect(resolveAlias(p)).toBeNull()
    }
  })

  it('3. positif putra putri cicit buyut canggah tetap jalan pasca guard', () => {
    expect(resolveAlias('putra')?.kind).toBe('child')
    expect(resolveAlias('putri')?.kind).toBe('child')
    expect(resolveAlias('cicit')?.kind).toBe('descendant')
    expect(resolveAlias('buyut')?.kind).toBe('descendant')
    expect(resolveAlias('canggah')?.kind).toBe('descendant')
  })

  it('4. normalisasi kapital: PUTRA MAHKOTA terblokir, Putra lolos', () => {
    expect(polisemiGuard('PUTRA MAHKOTA')).toBeNull()
    expect(resolveAlias('PUTRA MAHKOTA')).toBeNull()
    expect(resolveAlias('Putra')?.kind).toBe('child')
  })

  it('5. normalisasi spasi ganda dan trim terblokir', () => {
    expect(polisemiGuard('  putra   mahkota  ')).toBeNull()
    expect(polisemiGuard('putri  malu')).toBeNull()
    expect(resolveAlias(' bebuyutan ')).toBeNull()
  })

  it('6. titik tengah: ci·cit2 dan cang·gah1 terblokir setelah normalisasi', () => {
    expect(polisemiGuard('ci·cit2')).toBeNull()
    expect(polisemiGuard('cang·gah1')).toBeNull()
    expect(resolveAlias('ci·cit2')).toBeNull()
    expect(resolveAlias('cang·gah1')).toBeNull()
  })
  it('7. frasa whitelist lolos guard dan mengembalikan frasa ternormalisasi', () => {
    expect(polisemiGuard('putra')).toBe('putra')
    expect(polisemiGuard('cicit')).toBe('cicit')
    expect(polisemiGuard('  Cicit  ')).toBe('cicit')
  })

  it('8. guard total map PERSIS 137 pasca gel35 (bump dari 136, lema orang tua asuh)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(137)
    expect(aliasKinds().length).toBe(137)
  })

  it('9. guard ad-hoc v253xlii tetap kunci: resolveAlias frasa non-relasi nihil key map', () => {
    expect(KINSHIP_ALIASES['berputra']).toBeUndefined()
    expect(KINSHIP_ALIASES['berputri']).toBeUndefined()
    expect(KINSHIP_ALIASES['putra mahkota']).toBeUndefined()
    expect(KINSHIP_ALIASES['putri malu']).toBeUndefined()
    expect(KINSHIP_ALIASES['putri boyongan']).toBeUndefined()
  })

  it('10. cicit2 canggah1 bebuyutan nihil key di map dan nihil lema baru', () => {
    expect(KINSHIP_ALIASES['cicit2']).toBeUndefined()
    expect(KINSHIP_ALIASES['canggah1']).toBeUndefined()
    expect(KINSHIP_ALIASES['bebuyutan']).toBeUndefined()
    expect(KINSHIP_ALIASES['putra mahkota']).toBeUndefined()
    expect(KINSHIP_ALIASES['putri malu']).toBeUndefined()
    expect(KINSHIP_ALIASES['putri boyongan']).toBeUndefined()
  })

  it('11. positif lain tidak terdampak guard: anak cucu ading', () => {
    expect(resolveAlias('anak')?.kind).toBe('child')
    expect(resolveAlias('cucu')?.kind).toBe('grandchild')
    expect(resolveAlias('ading')?.kind).toBe('sibling')
  })

  it('12. kombinasi regional: putra lolos dengan region, blacklist tetap null', () => {
    expect(resolveAlias('putra', 'Toba')).not.toBeNull()
    expect(resolveAlias('putra mahkota', 'Toba')).toBeNull()
    expect(resolveAlias('cicit2', 'Simalungun')).toBeNull()
  })

  it('13. guard idempoten dan pure: dua kali panggil hasil sama', () => {
    expect(polisemiGuard('putri malu')).toBeNull()
    expect(polisemiGuard('putri malu')).toBeNull()
    expect(polisemiGuard('buyut')).toBe('buyut')
    expect(polisemiGuard('buyut')).toBe('buyut')
  })

  it('14. blacklist mudah ditambah: entry baru via satu baris array (simulasi perilaku)', () => {
    // Simulasi: frasa di luar blacklist lolos, entri blacklist null.
    // Penambahan entri nyata cukup satu baris di POLISEMI_BLACKLIST.
    expect(polisemiGuard('kakak')).toBe('kakak')
    expect(polisemiGuard('kakak')).not.toBeNull()
  })

  it('15. kasus negatif berabang (gel28): nihil key map dan resolve null, lema abang tetap lolos', () => {
    expect(resolveAlias('berabang')).toBeNull()
    expect(KINSHIP_ALIASES['berabang']).toBeUndefined()
    expect(polisemiGuard('berabang')).toBeNull()
    expect(resolveAlias('abang')?.kind).toBe('sibling')
  })
})
