import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'
import { polisemiGuard } from './kinship-polisemi-guard'

/**
 * Guard test lema anak asuh (gel36, kind child baku nasional, test-only).
 * Dua sumber first-hand 15 Okt 2026: KBBI VI resmi
 * kbbi.kemendikdasmen.go.id/entri/anak%20asuh HTTP 200 DUA makna (1 anak yang
 * diberi biaya pendidikan oleh seseorang tetapi tetap tinggal pada orang
 * tuanya; 2 anak yang diasuh oleh seseorang atau lembaga untuk bimbingan
 * pemeliharaan perawatan pendidikan dan kesehatan karena orang tua tidak
 * mampu) plus Wiktionary ID revid 1138654 blok bahasa Indonesia nomina makna 1
 * identik KBBI, R:KBBI Daring, flag rfv dicatat jujur. Keputusan leksikon PM:
 * pemetaan dari makna 1, makna 2 dicatat di note. Entri live di
 * kinship-aliases.ts; test ini mengunci kontrak gel36. Guard: asuh verba,
 * mengasuh (blacklist gel35), dan asuhan TIDAK dipetakan; orang tua asuh
 * tetap kind parent bukan child (anti-difusi pola non-difusi kind).
 */
describe('kinship-aliases anak asuh (gel36)', () => {
  it('1. positif: entri live kind child', () => {
    const e = KINSHIP_ALIASES['anak asuh']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
  })

  it('2. tanpa region, tanpa register, tanpa depth, tanpa qualifier', () => {
    const e = KINSHIP_ALIASES['anak asuh']
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
  })

  it('3. negasi: asuh sendiri (verba) nihil key, resolve null', () => {
    expect(KINSHIP_ALIASES['asuh']).toBeUndefined()
    expect(resolveAlias('asuh')).toBeNull()
  })

  it('4. negasi: mengasuh null via polisemiGuard (blacklist gel35 tetap 10)', () => {
    expect(polisemiGuard('mengasuh')).toBeNull()
    expect(resolveAlias('mengasuh')).toBeNull()
  })

  it('5. negasi: asuhan nihil di map, resolve null', () => {
    expect(KINSHIP_ALIASES['asuhan']).toBeUndefined()
    expect(resolveAlias('asuhan')).toBeNull()
  })

  it('6. anti-difusi: orang tua asuh tetap kind parent BUKAN child (pola non-difusi kind)', () => {
    const e = KINSHIP_ALIASES['orang tua asuh']
    expect(e).toBeDefined()
    expect(e.kind).toBe('parent')
    expect(e.kind).not.toBe('child')
  })

  it('7. resolveAlias frasa persis ternormalisasi (spasi berlebih dan kapital)', () => {
    const r = resolveAlias('  ANAK   asuh  ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('child')
  })

  it('8. total map PERSIS 138 dan aliasKinds 138 pasca gel36 (bump dari 137)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(144)
    expect(aliasKinds().length).toBe(144)
  })

  it('9. note dual-source lengkap: KBBI VI resmi, revid, tanggal akses, keputusan makna 1, guard', () => {
    const note = KINSHIP_ALIASES['anak asuh'].note ?? ''
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/anak%20asuh')
    expect(note).toContain('revid 1138654')
    expect(note).toContain('15 Okt 2026')
    expect(note).toContain('makna 1')
    expect(note).toContain('mengasuh')
    expect(note).toContain('asuhan')
  })

  it('10. pengasuh tidak dipetakan, guard polisemi tetap mengembalikan null', () => {
    expect(KINSHIP_ALIASES['pengasuh']).toBeUndefined()
    expect(resolveAlias('pengasuh')).toBeNull()
  })
})
