import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias, KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL } from './kinship-aliases'
import { regionalEntry, regionalNote } from './__tests__/alias-entry'

describe('kinship-aliases dongan sa- Toba (v221-i, kind sibling, kolektif kawan se-perut, tiga sumber)', () => {
  it('1. positif: dongan sa- Toba kind sibling, depth 1, region Toba', () => {
    const r = resolveAlias('dongan sa-', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Toba')
  })

  it('2. varian sapoesok, saboetoeha, saboltok dicatat sebagai konten note, bukan kunci terpisah', () => {
    const note = regionalNote('Toba', 'dongan sa-')
    for (const v of ['dongan sapoesok', 'saboetoeha', 'saboltok', 'sapoesok']) {
      expect(note, v).toContain(v === 'dongan sapoesok' ? 'sapoesok' : v)
    }
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    for (const v of ['dongan sapoesok', 'dongan saboetoeha', 'dongan saboltok']) {
      expect(keys).not.toContain(v)
      expect(resolveAlias(v, 'Toba'), v).toBeNull()
    }
  })

  it('3. non-duplikat: dongan polos tetap null di Toba dan global', () => {
    expect(resolveAlias('dongan', 'Toba')).toBeNull()
    expect(resolveAlias('dongan')).toBeNull()
    expect(Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)).not.toContain('dongan')
  })

  it('4. negatif homonim: dongan saboltok pistol dan tondong bukan kinship', () => {
    expect(resolveAlias('dongan saboltok pistol', 'Toba')).toBeNull()
    expect(resolveAlias('dongan saboltok pistol')).toBeNull()
    expect(resolveAlias('tondong', 'Toba')).toBeNull()
    expect(resolveAlias('tondong')).toBeNull()
  })

  it('5. struktur field persis kind, depth, region, register, note', () => {
    const e = regionalEntry('Toba', 'dongan sa-')
    expect(Object.keys(e).sort()).toEqual(['depth', 'kind', 'note', 'region', 'register'])
    expect(e.register).toBe('netral')
    expect(typeof e.note).toBe('string')
  })

  it('6. note memuat buikgenoot, Stap 1912, Holle, Tuuk 1897 dan jumlah sumber', () => {
    const note = regionalNote('Toba', 'dongan sa-')
    for (const f of ['buikgenoot', 'Stap 1912', 'hlm 85', 'Holle', 'hlm 354', 'Tuuk 1897', 'hlm 853', 'TIGA SUMBER', 'bloedverwant', 'se-perut', 'se-pusar', 'se-kandungan']) {
      expect(note, f).toContain(f)
    }
  })

  it('7. case-insensitive, trim, dan spasi ganda menghasilkan entri yang sama', () => {
    const base = resolveAlias('dongan sa-', 'Toba')
    expect(resolveAlias('DONGAN SA-', 'Toba')).toEqual(base)
    expect(resolveAlias('  Dongan Sa- ', 'Toba')).toEqual(base)
    expect(resolveAlias('dongan   sa-', 'Toba')).toEqual(base)
  })

  it('8. kunci tunggal: tepat satu di peta Toba, tidak ada di peta global dan region lain', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba)
    expect(keys.filter((k) => k === 'dongan sa-')).toHaveLength(1)
    expect(new Set(keys).size).toBe(keys.length)
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('dongan sa-')
    expect(resolveAlias('dongan sa-')).toBeNull()
    expect(resolveAlias('dongan sa-', 'Karo')).toBeNull()
    expect(resolveAlias('dongan sa-', 'Simalungun')).toBeNull()
  })

  it('9. regresi karuhun ancestor global tetap utuh', () => {
    expect(resolveAlias('karuhun')?.kind).toBe('ancestor')
  })

  it('10. regresi pariban Toba cousin depth 1 tetap utuh', () => {
    const r = resolveAlias('pariban', 'Toba')
    expect(r?.kind).toBe('cousin')
    expect(r?.depth).toBe(1)
  })

  it('11. regresi eda Karo sibling depth 1 tetap utuh', () => {
    const r = resolveAlias('eda', 'Karo')
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('12. aliasKinds tetap terurut dan tidak bocor kunci regional', () => {
    const keys = aliasKinds()
    expect(keys).toEqual([...keys].sort())
    expect(keys).toEqual(Object.keys(KINSHIP_ALIASES).sort())
    expect(keys).not.toContain('dongan sa-')
  })

  it('13. negatif sapoesok polos null di Toba dan global', () => {
    expect(resolveAlias('sapoesok', 'Toba')).toBeNull()
    expect(resolveAlias('sapoesok')).toBeNull()
    expect(resolveAlias('saboetoeha', 'Toba')).toBeNull()
  })

  it('14. idempoten: dua kali resolve hasil sama dan identik dengan isi peta', () => {
    const a = resolveAlias('dongan sa-', 'Toba')
    const b = resolveAlias('dongan sa-', 'Toba')
    expect(a).toEqual(b)
    expect(a).toBe(KINSHIP_ALIASES_REGIONAL.Toba['dongan sa-'])
  })

  it('15. note tanpa em dash maupun double hyphen, dan mencatat evidence notes/517 dan notes/518', () => {
    const note = regionalNote('Toba', 'dongan sa-')
    expect(note.includes('\u2014')).toBe(false)
    expect(note.includes('--')).toBe(false)
    expect(note).toContain('notes/517')
    expect(note).toContain('notes/518')
  })
})
