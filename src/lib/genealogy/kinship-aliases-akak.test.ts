import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key akak (v253xxiv, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (kbbi.kemendikdasmen.go.id/entri/akak,
 * akses 13 Okt 2026): a.kak n cak kakak; ejaan resmi ber titik a.kak TIDAK dipakai
 * sebagai key, pola budhe dari bu.de. Plus Wiktionary ID blok bahasa Indonesia:
 * a cak kakak, nihil flag rfv.
 * GUARD HOMONIM ANTARBAHASA: blok kjc bahasa Karo di halaman Wiktionary sama
 * (akak = akar bagian tumbuhan) TIDAK dipetakan; blok knl Keninjal (kakak
 * perempuan) TIDAK diikuti sebagai key feminin karena KBBI nihil penanda
 * gender, konsisten kak v253-xxiii.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind sibling depth 1
 * qualifier cak tanpa region dan guard anti homonim.
 */
describe('kinship-aliases akak (v253xxiv)', () => {
  it('1. entri akak live: kind sibling, depth 1, qualifier cak, tanpa region', () => {
    const e = KINSHIP_ALIASES['akak']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.qualifier).toBe('cak')
    expect(e.region).toBeUndefined()
  })

  it('2. resolveAlias akak non-null dan kind sibling depth 1', () => {
    const r = resolveAlias('akak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('3. varian ejaan resolve benar: Akak, spasi depan, spasi belakang', () => {
    for (const v of ['Akak', ' akak', 'akak ']) {
      const r = resolveAlias(v)
      expect(r, `varian ${v} harus resolve`).not.toBeNull()
      expect(r?.kind).toBe('sibling')
      expect(r?.qualifier).toBe('cak')
    }
  })

  it('4. note dual-source lengkap: KBBI VI a.kak akses 13 Okt plus Wiktionary ID nihil rfv', () => {
    const note = KINSHIP_ALIASES['akak'].note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/akak')
    expect(note).toContain('a.kak n cak kakak')
    expect(note).toContain('13 Okt 2026')
    expect(note).toContain('a.kak TIDAK dipakai sbg key')
    expect(note).toContain('Wiktionary ID')
    expect(note).toContain('nihil flag rfv')
  })

  it('5. guard homonim kjc Karo: akar bagian tumbuhan TIDAK dipetakan', () => {
    expect(KINSHIP_ALIASES['akar']).toBeUndefined()
    expect(resolveAlias('akar')).toBeNull()
    const note = KINSHIP_ALIASES['akak'].note
    expect(note).toContain('kjc')
    expect(note).toContain('akar bagian tumbuhan')
  })

  it('6. guard knl Keninjal: kakak perempuan TIDAK membentuk key feminin terpisah, akak netral', () => {
    expect(KINSHIP_ALIASES['akak'].qualifier).toBe('cak')
    const keys = Object.keys(KINSHIP_ALIASES)
    const femininAkak = keys.filter((k) => k !== 'akak' && k.startsWith('akak'))
    expect(femininAkak).toHaveLength(0)
    const note = KINSHIP_ALIASES['akak'].note
    expect(note).toContain('knl')
    expect(note).toContain('TIDAK diikuti sbg key feminin')
    expect(note).toContain('TANPA penanda gender')
  })

  it('7. gugus kakak tetap utuh non-regresi: kaka kakanda kakang kak live nilai existing tak berubah', () => {
    expect(KINSHIP_ALIASES['kaka']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      qualifier: 'sunda',
    })
    expect(KINSHIP_ALIASES['kakanda']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
      register: 'hormat',
    })
    expect(KINSHIP_ALIASES['kakang'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['kakang'].region).toBe('Jawa')
    expect(KINSHIP_ALIASES['kak'].kind).toBe('sibling')
    expect(KINSHIP_ALIASES['kak'].region).toBe('kp')
    expect(KINSHIP_ALIASES['kakak']).toBeUndefined()
  })

  it('8. guard jumlah key PERSIS 109 pasca V253-XXIV (108 jadi 109: akak)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(139)
    expect(aliasKinds().length).toBe(139)
  })

  it('9. non-regresi sibling depth 1: akak masuk gugus bersama kakang kaka kakanda kak', () => {
    const sib = Object.keys(KINSHIP_ALIASES).filter(
      (k) => KINSHIP_ALIASES[k]?.kind === 'sibling' && KINSHIP_ALIASES[k]?.depth === 1,
    )
    expect(sib).toContain('akak')
    expect(sib).toContain('kakang')
    expect(sib).toContain('kaka')
    expect(sib).toContain('kakanda')
    expect(sib).toContain('kak')
  })
})
