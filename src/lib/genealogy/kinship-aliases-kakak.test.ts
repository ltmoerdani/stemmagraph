import { describe, expect, it } from 'vitest'
import { resolveAlias, KINSHIP_ALIASES } from './kinship-aliases'

const KAKAK_ENTRIES = [
  'kakang',
  'kanda',
  'kangmas',
  'mas',
  'kakanda',
  'engkoh',
  'koko',
  'aa',
  'aang',
  'kaka',
  'akang',
  'uda',
  'kang',
] as const

describe('kinship-aliases klaster kakak maskulin (v184-i)', () => {
  it.each(KAKAK_ENTRIES)('%s resolveAlias kind sibling depth 1', (key) => {
    const r = resolveAlias(key)
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('register hormat hanya pada akang dan kakanda', () => {
    const hormatKeys = KAKAK_ENTRIES.filter((key) => resolveAlias(key)?.register === 'hormat')
    expect(hormatKeys.sort()).toEqual(['akang', 'kakanda'])
  })

  it('qualifier cak hanya pada engkoh dan koko', () => {
    const cakKeys = KAKAK_ENTRIES.filter((key) => resolveAlias(key)?.qualifier === 'cak')
    expect(cakKeys.sort()).toEqual(['engkoh', 'koko'])
  })

  it('qualifier sunda pada aa aang kaka akang uda', () => {
    const sundaKeys = KAKAK_ENTRIES.filter((key) => resolveAlias(key)?.qualifier === 'sunda')
    expect(sundaKeys.sort()).toEqual(['aa', 'aang', 'akang', 'kaka', 'uda'])
  })

  it('guard homonim: mas tetap resolve sebagai sibling, tidak bentrok entri lain', () => {
    const r = resolveAlias('mas')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Jawa')
  })

  it('tidak ada entri bang di tabel', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('bang')
  })

  it('tidak ada entri engkang di tabel', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('engkang')
  })

  it('tidak ada entri bli di tabel', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('bli')
  })

  it('normalize uppercase KAKANG tetap resolve', () => {
    const r = resolveAlias('KAKANG')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('normalize spasi di sekitar akang tetap resolve', () => {
    const r = resolveAlias(' akang ')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.register).toBe('hormat')
  })

  it('determinisme: dua kali panggil resolveAlias kang hasil identik', () => {
    const first = resolveAlias('kang')
    const second = resolveAlias('kang')
    expect(first).toEqual(second)
  })

  it('kang region Tengger', () => {
    const r = resolveAlias('kang')
    expect(r?.region).toBe('Tengger')
  })

  it('tepat 13 entri sibling depth 1 di tabel, sesuai daftar klaster kakak', () => {
    const siblingDepth1 = Object.entries(KINSHIP_ALIASES).filter(
      ([, entry]) => entry.kind === 'sibling' && entry.depth === 1,
    )
    expect(siblingDepth1.length).toBe(13)
    expect(siblingDepth1.map(([key]) => key).sort()).toEqual([...KAKAK_ENTRIES].sort())
  })

  it('semua 13 entri unik, tidak ada duplikat kunci', () => {
    const unique = new Set(KAKAK_ENTRIES)
    expect(unique.size).toBe(13)
  })

  it('kakanda tetap sibling meski memiliki register hormat', () => {
    const r = resolveAlias('kakanda')
    expect(r?.kind).toBe('sibling')
    expect(r?.register).toBe('hormat')
  })
})
