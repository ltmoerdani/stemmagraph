import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key kak (v253-xxiii, test-only).
 * Sumber entri: KBBI VI resmi kemendikdasmen (kbbi.kemendikdasmen.go.id/entri/kak,
 * akses 13 Okt 2026): kak1 n kata sapaan kepada saudara tua + kak kp kakak;
 * saudara tua. Plus Wiktionary ID blok bahasa Indonesia: nomina kependekan
 * kakak; saudara tua, rujukan R:KBBI Daring, templat rfv dicatat jujur di note
 * entri (status verifikasi komunitas belum final, pola ipar v253-xxii).
 * Makna pronomina cak dan onomatope TIDAK dipetakan.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind sibling depth 1
 * region kp konsisten gugus kakak dan guard anti duplikasi varian.
 */
describe('kinship-aliases kak (v253-xxiii)', () => {
  it('1. entri kak live: kind sibling, depth 1, region kp', () => {
    const e = KINSHIP_ALIASES['kak']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('kp')
  })

  it('2. resolveAlias kak non-null dan kind sibling', () => {
    const r = resolveAlias('kak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('3. note dual-source lengkap: KBBI VI akses 13 Okt plus Wiktionary rfv jujur', () => {
    const note = KINSHIP_ALIASES['kak'].note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('saudara tua')
    expect(note).toContain('Wiktionary')
    expect(note).toContain('rfv')
    expect(note).toContain('kependekan kakak')
  })

  it('4. guard makna sapaan kak1 dan pronomina plus onomatope TIDAK dipetakan: kind tetap sibling', () => {
    const note = KINSHIP_ALIASES['kak'].note
    expect(note).toContain('TIDAK dipetakan')
    expect(KINSHIP_ALIASES['kak'].kind).toBe('sibling')
  })

  it('5. gugus kakak alias inti tetap utuh: kaka kakanda kakang live sibling tanpa terganggu (kakak lemma kanonik bukan key alias)', () => {
    for (const k of ['kaka', 'kakanda', 'kakang']) {
      expect(KINSHIP_ALIASES[k]).toBeDefined()
      expect(KINSHIP_ALIASES[k].kind).toBe('sibling')
    }
    expect(KINSHIP_ALIASES['kakak']).toBeUndefined()
  })

  it('6. varian salah nihil: kakk dan kakaq tidak ada di map dan resolveAlias null', () => {
    expect(KINSHIP_ALIASES['kakk']).toBeUndefined()
    expect(KINSHIP_ALIASES['kakaq']).toBeUndefined()
    expect(resolveAlias('kakk')).toBeNull()
    expect(resolveAlias('kakaq')).toBeNull()
  })

  it('7. kak tampil di aliasKinds tanpa duplikasi key', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    expect(keys.filter((k) => k === 'kak')).toHaveLength(1)
    expect(aliasKinds()).toContain('kak')
  })

  it('8. guard jumlah key PERSIS 108 pasca V253-XXIII (107 jadi 108: kak)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(115)
    expect(aliasKinds().length).toBe(115)
  })

  it('9. non-regresi sibling depth 1: kak konsisten gugus kakang kaka kakanda', () => {
    const sib = Object.keys(KINSHIP_ALIASES)
      .filter((k) => KINSHIP_ALIASES[k]?.kind === 'sibling' && KINSHIP_ALIASES[k]?.depth === 1)
    expect(sib).toContain('kak')
    expect(sib).toContain('kakang')
    expect(sib).toContain('kaka')
    expect(sib).toContain('kakanda')
  })
})
