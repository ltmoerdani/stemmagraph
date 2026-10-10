import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test polysemy dan hyphen (v174-iv, test-only).
 * Sumber: notes/416 dan notes/417 (KBBI VI plus edisi III).
 * Tidak menambah entri baru ke KINSHIP_ALIASES.
 */
describe('kinship-aliases affine guard (v174-iv)', () => {
  it('1. polysemy: ayah null (kolom Memuat mertua tidak boleh bocor jadi alias)', () => {
    expect(resolveAlias('ayah')).toBeNull()
  })

  it('2. polysemy: ibu null', () => {
    expect(resolveAlias('ibu')).toBeNull()
  })

  it('3. mertua live sejak v253-vi: kind property', () => {
    const r = resolveAlias('mertua')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('property')
  })

  it('4. polysemy: ambil kata dasar null', () => {
    expect(resolveAlias('ambil')).toBeNull()
  })

  it('5. polysemy: minantu null', () => {
    expect(resolveAlias('minantu')).toBeNull()
  })

  it('6. besan live sejak v253-vi kind property, besan2 homonim masakan tetap null', () => {
    expect(resolveAlias('besan')?.kind).toBe('property')
    expect(resolveAlias('besan2')).toBeNull()
  })

  it('7. hyphen: nenek-moyang null (key tabel pakai spasi, resolver tidak membelah hyphen)', () => {
    expect(resolveAlias('nenek-moyang')).toBeNull()
  })

  it('8. identitas: nenek moyang tetap ancestor', () => {
    const r = resolveAlias('nenek moyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('9. hyphen eksplisit: dansa-dansi resolve sibling (key memang ber-hyphen)', () => {
    const r = resolveAlias('dansa-dansi')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('10. homonym: aliasKinds tidak memuat key berhuruf kapital', () => {
    for (const key of aliasKinds()) {
      expect(key).toBe(key.toLowerCase())
    }
  })

  it('11. homonym: AKI kapital resolve sama dengan aki lowercase, tanpa key aki1 aki2', () => {
    const upper = resolveAlias('AKI')
    const lower = resolveAlias('aki')
    expect(upper).toEqual(lower)
    expect(upper?.kind).toBe('grandparent')
    expect(aliasKinds()).not.toContain('aki1')
    expect(aliasKinds()).not.toContain('aki2')
  })

  it('12. identitas: keponakan tetap sibling-child', () => {
    const r = resolveAlias('keponakan')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling-child')
  })

  it('13. determinisme: resolveAlias dua kali hasil identik pada 5 frasa', () => {
    const phrases = ['dansanak', 'dansa-dansi', 'nenek moyang', 'aki', 'keponakan']
    for (const p of phrases) {
      expect(resolveAlias(p)).toEqual(resolveAlias(p))
    }
  })

  it('14. determinisme: aliasKinds sorted dan deterministik', () => {
    expect(aliasKinds()).toEqual(aliasKinds())
    const sorted = [...aliasKinds()].sort()
    expect(aliasKinds()).toEqual(sorted)
  })
})
