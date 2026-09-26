import { describe, expect, it } from 'vitest'
import { resolveAlias } from './kinship-aliases'

describe('kinship-aliases memuat alias (v174-ii)', () => {
  it('dansanak resolve kind sibling', () => {
    const r = resolveAlias('dansanak')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('dansa-dansi resolve kind sibling', () => {
    const r = resolveAlias('dansa-dansi')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('sibling')
  })

  it('dansanak dan dansa-dansi hasil identik', () => {
    const a = resolveAlias('dansanak')
    const b = resolveAlias('dansa-dansi')
    expect(a).toEqual(b)
  })
})
