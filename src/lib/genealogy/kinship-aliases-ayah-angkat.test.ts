import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'
import { polisemiGuard } from './kinship-polisemi-guard'

/**
 * Guard test lema ayah angkat (gel38, kind parent baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/ayah%20angkat HTTP 200 satu makna relasi
 * (orang tua laki-laki yang bukan orang tua kandung, tetapi secara resmi
 * menurut prosedur adat atau hukum diakui sebagai ayah) plus Wiktionary ID
 * pageid 125025 revid 1141749 blok bahasa Indonesia nomina identik KBBI
 * kata per kata, rujukan R:KBBI Daring. Keputusan leksikon PM: makna
 * hukum/adat saja tanpa makna lain. Entri live di kinship-aliases.ts;
 * test ini mengunci kontrak gel38. Guard: angkat verba, mengangkat
 * (blacklist tetap 11), dan terangkat TIDAK dipetakan; ayah tunggal nihil;
 * anak angkat tetap kind child (gel29), orang tua angkat tetap kind parent
 * (gel37), orang tua asuh tetap kind parent (gel35), anti-difusi pola
 * non-difusi kind; ibu angkat TIDAK dipetakan karena single-source
 * Wiktionary revid 1190402 tanpa mirror KBBI. Total map 139 menjadi 140.
 */
describe('kinship-aliases ayah angkat (gel38)', () => {
  const GUARD_KEYS = 144

  it('1. positif: entri live kind parent frasa utuh', () => {
    const e = KINSHIP_ALIASES['ayah angkat']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(resolveAlias('ayah angkat')?.kind).toBe('parent')
  })

  it('2. tanpa region, tanpa register, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['ayah angkat']
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi: mengangkat null via polisemiGuard (blacklist tetap 11)', () => {
    expect(polisemiGuard('mengangkat')).toBeNull()
    expect(resolveAlias('mengangkat')).toBeNull()
  })

  it('4. negasi: terangkat nihil key, resolve null', () => {
    expect(KINSHIP_ALIASES['terangkat']).toBeUndefined()
    expect(resolveAlias('terangkat')).toBeNull()
  })

  it('5. negasi: ayah tunggal nihil di map, resolve null (preseden nyokap tetua)', () => {
    expect(KINSHIP_ALIASES['ayah']).toBeUndefined()
    expect(resolveAlias('ayah')).toBeNull()
  })

  it('6. negasi: kata angkat sendiri (verba) nihil key, resolve null', () => {
    expect(KINSHIP_ALIASES['angkat']).toBeUndefined()
    expect(resolveAlias('angkat')).toBeNull()
  })

  it('7. negasi: ibu angkat nihil di map (single-source Wiktionary revid 1190402 tanpa mirror KBBI)', () => {
    expect(KINSHIP_ALIASES['ibu angkat']).toBeUndefined()
    expect(resolveAlias('ibu angkat')).toBeNull()
  })

  it('8. anti-difusi: anak angkat tetap kind child BUKAN parent (gel29, pola non-difusi kind)', () => {
    const e = KINSHIP_ALIASES['anak angkat']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(e.kind).not.toBe('parent')
  })

  it('9. anti-difusi: orang tua angkat tetap kind parent (gel37) dan orang tua asuh tetap kind parent (gel35)', () => {
    const ota = KINSHIP_ALIASES['orang tua angkat']
    expect(ota).toBeDefined()
    expect(ota.kind).toBe('parent')
    expect(ota.kind).not.toBe('child')
    const ots = KINSHIP_ALIASES['orang tua asuh']
    expect(ots).toBeDefined()
    expect(ots.kind).toBe('parent')
    expect(ots.kind).not.toBe('child')
  })

  it('10. blacklist POLISEMI length PERSIS 11 secara perilaku (11 frasa unik semua diblok)', () => {
    const ELEVEN = [
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
      'mengangkat',
    ]
    expect(ELEVEN).toHaveLength(11)
    for (const p of ELEVEN) {
      expect(polisemiGuard(p)).toBeNull()
    }
    expect(polisemiGuard('ayah angkat')).not.toBeNull()
  })

  it('11. total map PERSIS 140 dan aliasKinds 140 pasca gel38 (GUARD_KEYS bump 139 jadi 140)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS)
    expect(aliasKinds().length).toBe(GUARD_KEYS)
  })

  it('12. resolveAlias frasa persis ternormalisasi (spasi berlebih dan kapital)', () => {
    const r = resolveAlias('  AYAH   angkat  ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
  })

  it('13. note dual-source lengkap: KBBI VI resmi, pageid revid, tanggal akses, guard, anti-difusi, kontrak', () => {
    const note = KINSHIP_ALIASES['ayah angkat'].note ?? ''
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/ayah%20angkat')
    expect(note).toContain('pageid 125025')
    expect(note).toContain('revid 1141749')
    expect(note).toContain('15 Okt 2026')
    expect(note).toContain('mengangkat')
    expect(note).toContain('terangkat')
    expect(note).toContain('anak angkat')
    expect(note).toContain('orang tua angkat')
    expect(note).toContain('orang tua asuh')
    expect(note).toContain('ibu angkat')
    expect(note).toContain('kontrak-stg-gel38-ayah-angkat')
  })
})
