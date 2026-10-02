import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES_REGIONAL, resolveAlias } from './kinship-aliases'

describe('kinship-aliases sukut Karo (v192-i regional map, kutub ketiga rakut sitelu)', () => {
  it('resolveAlias sukut tanpa region bernilai null: sukut hanya ada di map regional Karo', () => {
    expect(resolveAlias('sukut')).toBeNull()
  })

  it('resolveAlias sukut region Karo kembalikan entri sibling depth 1', () => {
    const r = resolveAlias('sukut', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
    expect(r?.region).toBe('Karo')
  })

  it('resolveAlias sukut region Sunda bernilai null: Sunda tidak terdaftar sebagai pemilik sukut', () => {
    expect(resolveAlias('sukut', 'Sunda')).toBeNull()
  })

  it('normalize spasi: sukut dengan spasi pinggir tetap kena', () => {
    const r = resolveAlias(' sukut ', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('struktur entri sukut: note memuat dua DOI jurnal dan evidence notes/459', () => {
    const karo = KINSHIP_ALIASES_REGIONAL.Karo
    expect(karo.sukut).toBeDefined()
    expect(karo.sukut.region).toBe('Karo')
    expect(karo.sukut.note).toContain('10.14421/jsa.2017.112-06')
    expect(karo.sukut.note).toContain('10.33153/dewaruci.v12i1.2515')
    expect(karo.sukut.note).toContain('notes/459')
  })

  it('determinisme: dua panggilan berurutan hasil identik (deep equal)', () => {
    const a = resolveAlias('sukut', 'Karo')
    const b = resolveAlias('sukut', 'Karo')
    expect(a).toEqual(b)
    expect(b).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.sukut)
  })

  it('regresi: resolveAlias senina tetap entri regional sibling yang sudah ada', () => {
    const r = resolveAlias('senina', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('regresi: resolveAlias sembuyak tetap entri regional sibling yang sudah ada', () => {
    const r = resolveAlias('sembuyak', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
    expect(r?.depth).toBe(1)
  })

  it('regresi: resolveAlias nini tanpa region tetap entri global grandparent multi region', () => {
    const r = resolveAlias('nini')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
    expect(r?.region).toContain('Karo')
  })

  it('regresi: komposit bapa tua dari v191-ii tidak tertimpa entri sukut', () => {
    const r = resolveAlias('bapa tua', 'Karo')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('parent')
  })

  it('determinisme penuh: hasil sama dengan objek map regional eksak', () => {
    expect(resolveAlias('sukut', 'Karo')).toEqual(KINSHIP_ALIASES_REGIONAL.Karo.sukut)
  })

  it('guard: objek Karo di KINSHIP_ALIASES_REGIONAL berisi tepat 17 key (v196-i bump, sukut tetap)', () => {
    const keys = Object.keys(KINSHIP_ALIASES_REGIONAL.Karo).sort()
    expect(keys).toEqual(['bapa nguda', 'bapa tua', 'batangna', 'bibi', 'diberu', 'eda', 'impal', 'kaka', 'kempu', 'lemirat', 'ngerbani', 'nini', 'nini bulang', 'nini ribu', 'pak tua', 'pak uda', 'sepemeren', 'sukut', 'turangku', 'unjuken'])
    expect(keys.length).toBe(20)
  })
})
