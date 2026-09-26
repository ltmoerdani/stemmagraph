import { describe, it, expect } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

describe('v174-ii kolektif leluhur', () => {
  it('nenek moyang resolve ancestor', () => {
    expect(resolveAlias('nenek moyang')).toEqual({ kind: 'ancestor' })
  })

  it('datuk nenek resolve ancestor', () => {
    expect(resolveAlias('datuk nenek')).toEqual({ kind: 'ancestor' })
  })

  it('datuk poyang resolve ancestor', () => {
    expect(resolveAlias('datuk poyang')).toEqual({ kind: 'ancestor' })
  })

  it('moyang resolve ancestor', () => {
    expect(resolveAlias('moyang')?.kind).toBe('ancestor')
  })

  it('leluhur resolve ancestor (jangkar KBBI VI nenek moyang)', () => {
    expect(resolveAlias('leluhur')).toEqual({ kind: 'ancestor' })
  })
})

describe('v174-ii alias sepupu kedua dan misan', () => {
  it('sepupu kedua resolve cousin', () => {
    expect(resolveAlias('sepupu kedua')).toEqual({
      kind: 'cousin',
      note: expect.stringContaining('misan'),
    })
  })

  it('misan resolve cousin sunda', () => {
    expect(resolveAlias('misan')).toEqual({
      kind: 'cousin',
      qualifier: 'sunda',
      note: expect.stringContaining('turun satu pangkat'),
    })
  })
})

describe('v174-ii rantai regional grandparent', () => {
  it('aki resolve grandparent dengan guard homonim accu', () => {
    const r = resolveAlias('aki')
    expect(r).not.toBeNull()
    expect(r.kind).toBe('grandparent')
  })

  it('hanya satu entri aki di KINSHIP_ALIASES (regresi dup aki)', () => {
    const keys = Object.keys(KINSHIP_ALIASES).filter((k) => k === 'aki')
    expect(keys).toHaveLength(1)
  })

  it('nini resolve grandparent dengan guard homonim sapaan', () => {
    const r = resolveAlias('nini')
    expect(r).not.toBeNull()
    expect(r.kind).toBe('grandparent')
    expect(r.note).toContain('sapaan')
  })

  it('ninik resolve grandparent mk', () => {
    expect(resolveAlias('ninik')?.kind).toBe('grandparent')
    expect(resolveAlias('ninik')?.qualifier).toBe('mk')
  })

  it('opa tetap grandparent cak (regresi rantai lama)', () => {
    expect(resolveAlias('opa')).toEqual({ kind: 'grandparent', qualifier: 'cak', region: 'Betawi' })
  })
})

describe('v174-ii poyang gen 4', () => {
  it('poyang resolve ancestor depth 4', () => {
    expect(resolveAlias('poyang')).toEqual({
      kind: 'ancestor',
      depth: 4,
      note: expect.stringContaining('orang tua kakek'),
    })
  })

  it('rantai naik gen 4 utuh: orangtua, kakek, buyut, poyang', () => {
    expect(resolveAlias('buyut')?.depth).toBe(3)
    expect(resolveAlias('poyang')?.depth).toBe(4)
    expect(resolveAlias('leluhur')?.kind).toBe('ancestor')
  })
})
