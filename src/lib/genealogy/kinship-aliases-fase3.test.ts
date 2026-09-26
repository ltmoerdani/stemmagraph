import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship aliases fase III: enam entri kolektif padanan nenek moyang', () => {
  it('karuhun terpetakan sebagai ancestor', () => {
    expect(resolveAlias('karuhun')).toEqual({ kind: 'ancestor' })
  })

  it('indu terpetakan sebagai ancestor', () => {
    expect(resolveAlias('indu')).toEqual({ kind: 'ancestor' })
  })

  it('opo terpetakan sebagai ancestor', () => {
    expect(resolveAlias('opo')).toEqual({ kind: 'ancestor' })
  })

  it('umbu terpetakan sebagai ancestor', () => {
    expect(resolveAlias('umbu')).toEqual({ kind: 'ancestor' })
  })

  it('zatua terpetakan sebagai ancestor', () => {
    expect(resolveAlias('zatua')).toEqual({ kind: 'ancestor' })
  })

  it('pitarah terpetakan sebagai ancestor', () => {
    expect(resolveAlias('pitarah')).toEqual({ kind: 'ancestor' })
  })

  it('regresi: "Nenek Moyang" tetap kind ancestor', () => {
    expect(resolveAlias('Nenek Moyang')?.kind).toBe('ancestor')
  })

  it('eyang punya register hormat dan region Jawa', () => {
    const entry = resolveAlias('eyang')
    expect(entry?.register).toBe('hormat')
    expect(entry?.region).toBe('Jawa')
  })

  it('aki punya region Sunda dan kind grandparent', () => {
    const entry = resolveAlias('aki')
    expect(entry?.region).toBe('Sunda')
    expect(entry?.kind).toBe('grandparent')
  })

  it('regresi baku: kakek tetap grandparent tanpa region', () => {
    const entry = resolveAlias('kakek')
    expect(entry?.kind).toBe('grandparent')
    expect(entry?.region).toBeUndefined()
  })

  it('note homonim utuh untuk nini dan datuk', () => {
    expect(resolveAlias('nini')?.note).toContain('homonim')
    expect(resolveAlias('datuk')?.note).toContain('homonim')
  })

  it('aliasKinds memuat karuhun dan pitarah', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('karuhun')
    expect(kinds).toContain('pitarah')
  })
})
