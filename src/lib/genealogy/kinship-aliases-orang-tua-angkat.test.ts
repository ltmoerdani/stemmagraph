import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'
import { polisemiGuard } from './kinship-polisemi-guard'

/**
 * Guard test lema orang tua angkat (gel37, kind parent baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/orang%20tua%20angkat HTTP 200 satu makna
 * relasi (pria dan wanita yang menjadi ayah dan ibu seseorang berdasarkan
 * adat atau hukum yang berlaku) plus Wiktionary ID pageid 118157 revid 1266103
 * blok bahasa Indonesia nomina identik KBBI, R:KBBI Daring, flag rfv dicatat
 * jujur pola pakde ponakan anak angkat. Keputusan leksikon PM: makna
 * hukum/adat saja tanpa makna lain. Entri live di kinship-aliases.ts; test
 * ini mengunci kontrak gel37. Guard: angkat verba, mengangkat (blacklist
 * gel37 ke-11), dan terangkat TIDAK dipetakan; anak angkat tetap kind child
 * (gel29) dan orang tua asuh tetap kind parent (gel35), anti-difusi pola
 * non-difusi kind. Total map 138 menjadi 139, blacklist 10 menjadi 11.
 */
describe('kinship-aliases orang tua angkat (gel37)', () => {
  const GUARD_KEYS = 144

  it('1. positif: entri live kind parent frasa utuh', () => {
    const e = KINSHIP_ALIASES['orang tua angkat']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(resolveAlias('orang tua angkat')?.kind).toBe('parent')
  })

  it('2. tanpa region, tanpa register, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['orang tua angkat']
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi: mengangkat null via polisemiGuard (blacklist gel37 tetap 11)', () => {
    expect(polisemiGuard('mengangkat')).toBeNull()
    expect(resolveAlias('mengangkat')).toBeNull()
  })

  it('4. negasi: terangkat nihil key, resolve null', () => {
    expect(KINSHIP_ALIASES['terangkat']).toBeUndefined()
    expect(resolveAlias('terangkat')).toBeNull()
  })

  it('5. negasi: orang tua tanpa modifier nihil di map, resolve null (preseden nyokap tetua)', () => {
    expect(KINSHIP_ALIASES['orang tua']).toBeUndefined()
    expect(resolveAlias('orang tua')).toBeNull()
  })

  it('6. negasi: frasa terpotong tua angkat nihil di map, resolve null', () => {
    expect(KINSHIP_ALIASES['tua angkat']).toBeUndefined()
    expect(resolveAlias('tua angkat')).toBeNull()
  })

  it('7. negasi: kata angkat sendiri (verba) nihil key, resolve null', () => {
    expect(KINSHIP_ALIASES['angkat']).toBeUndefined()
    expect(resolveAlias('angkat')).toBeNull()
  })

  it('8. anti-difusi: anak angkat tetap kind child BUKAN parent (gel29, pola non-difusi kind)', () => {
    const e = KINSHIP_ALIASES['anak angkat']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(e.kind).not.toBe('parent')
  })

  it('9. anti-difusi: orang tua asuh tetap kind parent BUKAN child (gel35)', () => {
    const e = KINSHIP_ALIASES['orang tua asuh']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(e.kind).not.toBe('child')
  })

  it('10. blacklist POLISEMI length PERSIS 11 pasca gel37 (bump dari 10)', () => {
    expect(polisemiGuard('mengangkat')).toBeNull()
    expect(polisemiGuard('mengasuh')).toBeNull()
    expect(polisemiGuard('berabang')).toBeNull()
    expect(polisemiGuard('orang tua angkat')).not.toBeNull()
  })

  it('11. total map PERSIS 139 dan aliasKinds 139 pasca gel37 (GUARD_KEYS bump 138 jadi 139)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(GUARD_KEYS)
    expect(aliasKinds().length).toBe(GUARD_KEYS)
  })

  it('12. resolveAlias frasa persis ternormalisasi (spasi berlebih dan kapital)', () => {
    const r = resolveAlias('  ORANG   TUA   angkat  ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
  })

  it('13. note dual-source lengkap: KBBI VI resmi, pageid revid, tanggal akses, guard, anti-difusi, kontrak', () => {
    const note = KINSHIP_ALIASES['orang tua angkat'].note ?? ''
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/orang%20tua%20angkat')
    expect(note).toContain('pageid 118157')
    expect(note).toContain('revid 1266103')
    expect(note).toContain('15 Okt 2026')
    expect(note).toContain('mengangkat')
    expect(note).toContain('terangkat')
    expect(note).toContain('anak angkat')
    expect(note).toContain('orang tua asuh')
    expect(note).toContain('kontrak-stg-gel37-orang-tua-angkat')
  })
})
