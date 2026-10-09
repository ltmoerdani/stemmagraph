import { describe, it, expect } from 'vitest'
import {
  KINSHIP_ALIASES,
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
} from './kinship-aliases'

/**
 * v253-iii: opung (grandparent Toba, dual-source, kontrak kontrak-v253iii-stg-opung-2026-10-09.md).
 * Kanon ejaan opung mengikuti KBBI (keputusan PM); ompung (dobel m) diarahkan ke
 * komposit 'ompung suhut' depth 2 yang entri terpisah dan JANGAN disentuh.
 */
describe('kinship-aliases opung (v253-iii, grandparent Toba, nihil depth eksplisit)', () => {
  it('1. entri live: opung di KINSHIP_ALIASES_REGIONAL.Toba, kind grandparent, region Toba, tanpa depth field', () => {
    const entry = KINSHIP_ALIASES_REGIONAL.Toba['opung']
    expect(entry).toBeDefined()
    expect(entry.kind).toBe('grandparent')
    expect(entry.region).toBe('Toba')
    expect(entry.depth).toBeUndefined()
    expect('depth' in entry).toBe(false)
    const note = entry.note
    expect(note).toContain('KBBI VI')
    expect(note).toContain('kbbi.kemendikdasmen.go.id/entri/opung')
    expect(note).toContain('Wiktionary ID')
    expect(note).toContain('1133439')
    expect(note).toContain('ompung suhut')
    expect(note).toContain('JANGAN disentuh')
  })

  it('2. resolveAlias opung dengan region Toba grandparent; tanpa region nihil karena opung regional bukan alias global', () => {
    const r = resolveAlias('opung', 'Toba')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.region).toBe('Toba')
    expect(resolveAlias('opung')).toBeNull()
    expect(KINSHIP_ALIASES['opung']).toBeUndefined()
  })

  it('3. guard anti-dup komposit: ompung standalone nihil, ompung suhut tetap grandparent depth 2', () => {
    expect(resolveAlias('ompung')).toBeNull()
    expect(resolveAlias('ompung', 'Toba')).toBeNull()
    expect(KINSHIP_ALIASES_REGIONAL.Toba['ompung']).toBeUndefined()
    const komp = resolveAlias('ompung suhut', 'Toba')
    expect(komp).not.toBeNull()
    expect(komp?.kind).toBe('grandparent')
    expect(komp?.depth).toBe(2)
    expect(komp?.region).toBe('Toba')
  })

  it('4. guard homonim: kakek tetap grandparent map utama tanpa pergeseran, nihil key opung di KINSHIP_ALIASES', () => {
    const kakek = resolveAlias('kakek')
    expect(kakek).not.toBeNull()
    expect(kakek?.kind).toBe('grandparent')
    expect(KINSHIP_ALIASES['kakek']?.kind).toBe('grandparent')
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('opung')
  })

  it('5. guard bump: key Toba PERSIS 13 alfabetis, urutan ompung suhut lalu opung lalu pahompu', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Toba).sort()
    expect(keys).toHaveLength(13)
    expect(keys).toEqual([
      'amangboru',
      'boru',
      'butet',
      'dongan sa-',
      'haha',
      'iboto',
      'lae',
      'namboru',
      'ompung suhut',
      'opung',
      'pahompu',
      'pariban',
      'tulang',
    ])
    const iOmpungSuhut = keys.indexOf('ompung suhut')
    const iOpung = keys.indexOf('opung')
    const iPahompu = keys.indexOf('pahompu')
    expect(iOpung).toBe(iOmpungSuhut + 1)
    expect(iPahompu).toBe(iOpung + 1)
  })

  it('6. non-regresi tetangga Toba: butet child dan pariban cousin tetap utuh', () => {
    const butet = resolveAlias('butet', 'Toba')
    expect(butet).not.toBeNull()
    expect(butet?.kind).toBe('child')
    expect(butet?.depth).toBe(1)
    const pariban = resolveAlias('pariban', 'Toba')
    expect(pariban).not.toBeNull()
    expect(pariban?.kind).toBe('cousin')
    expect(pariban?.depth).toBe(1)
  })
})
