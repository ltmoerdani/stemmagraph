import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'
import { polisemiGuard } from './kinship-polisemi-guard'

/**
 * Guard test lema orang tua asuh (gel35, kind parent baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/orang%20tua%20asuh HTTP 200 (orang yang
 * membiayai sekolah dan sebagainya anak yang bukan anaknya sendiri atas dasar
 * kemanusiaan) plus Wiktionary ID pageid 118164 revid 1266105 blok bahasa
 * Indonesia nomina identik KBBI. Entri live di kinship-aliases.ts; test ini
 * mengunci kontrak gel35. Guard: asuh verba dan mengasuh TIDAK dipetakan;
 * anak asuh kini live pasca gel36 (koreksi transparan polaritas), kind child.
 */
describe('kinship-aliases orang tua asuh (gel35)', () => {
  it('1. positif: entri live kind parent', () => {
    const e = KINSHIP_ALIASES['orang tua asuh']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
  })

  it('2. tanpa region, tanpa register, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['orang tua asuh']
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi: asuh sendiri (verba) resolve null', () => {
    expect(resolveAlias('asuh')).toBeNull()
  })

  it('4. negasi: mengasuh null via polisemiGuard (blacklist 10)', () => {
    expect(polisemiGuard('mengasuh')).toBeNull()
    expect(resolveAlias('mengasuh')).toBeNull()
  })

  it('5. afirmasi: anak asuh kini live pasca gel36 (koreksi transparan polaritas gel35), kind child', () => {
    const e = KINSHIP_ALIASES['anak asuh']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(resolveAlias('anak asuh')?.kind).toBe('child')
  })

  it('6. negasi: orang tua tanpa modifier tetap nihil di map, resolve null', () => {
    expect(KINSHIP_ALIASES['orang tua']).toBeUndefined()
    expect(resolveAlias('orang tua')).toBeNull()
  })

  it('7. resolveAlias frasa persis dengan spasi berlebih ternormalisasi', () => {
    const r = resolveAlias('  ORANG   TUA  asuh  ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
  })

  it('8. total map PERSIS 138 dan aliasKinds 138 pasca gel35 (bump dari 136)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(142)
    expect(aliasKinds().length).toBe(142)
  })

  it('9. note dual-source lengkap: KBBI VI resmi, pageid, revid, tanggal akses, guard', () => {
    const note = KINSHIP_ALIASES['orang tua asuh'].note ?? ''
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/orang%20tua%20asuh')
    expect(note).toContain('pageid 118164')
    expect(note).toContain('revid 1266105')
    expect(note).toContain('15 Okt 2026')
    expect(note).toContain('mengasuh')
    expect(note).toContain('anak asuh')
  })

  it('10. pengasuh dan pengasuhan tidak dipetakan, blacklist tetap 10 frasa', () => {
    expect(KINSHIP_ALIASES['pengasuh']).toBeUndefined()
    expect(KINSHIP_ALIASES['pengasuhan']).toBeUndefined()
    expect(resolveAlias('pengasuh')).toBeNull()
    expect(resolveAlias('pengasuhan')).toBeNull()
  })
})
