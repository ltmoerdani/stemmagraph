import { describe, it, expect } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias, aliasKinds } from './kinship-aliases'

describe('KINSHIP_ALIASES', () => {
  it('anak resolve child', () => {
    expect(resolveAlias('anak')).toEqual({ kind: 'child' })
  })

  it('cucu resolve grandchild', () => {
    expect(resolveAlias('cucu')).toEqual({ kind: 'grandchild' })
  })

  it('cicit resolve descendant depth 3', () => {
    expect(resolveAlias('cicit')).toEqual({ kind: 'descendant', depth: 3 })
  })

  it('piut resolve descendant depth 4', () => {
    expect(resolveAlias('piut')).toEqual({ kind: 'descendant', depth: 4 })
  })

  it('kakek resolve grandparent', () => {
    expect(resolveAlias('kakek')).toEqual({ kind: 'grandparent' })
  })

  it('frasa sub-entri nenek moyang resolve ancestor', () => {
    expect(resolveAlias('nenek moyang')).toEqual({ kind: 'ancestor' })
  })

  it('sepupu resolve cousin', () => {
    expect(resolveAlias('sepupu')).toEqual({ kind: 'cousin' })
  })

  it('keponakan resolve sibling-child', () => {
    expect(resolveAlias('keponakan')).toEqual({ kind: 'sibling-child' })
  })

  it('normalisasi titik tengah mo·yang sama dengan moyang', () => {
    expect(resolveAlias('mo·yang')).toEqual(resolveAlias('moyang'))
    expect(resolveAlias('mo·yang')).toEqual({
      kind: 'ancestor',
      note: 'homonim pangkat: jarak 2 berarti grandparent',
    })
  })

  it('normalisasi titik tengah po·yang sama dengan poyang', () => {
    expect(resolveAlias('po·yang')).toEqual(resolveAlias('poyang'))
    expect(resolveAlias('po·yang')).toEqual({
      kind: 'ancestor',
      depth: 4,
      note: 'makna 2 Mk: orang tua kakek atau nenek',
    })
  })

  it('qualifier opa cak tersimpan', () => {
    expect(resolveAlias('opa')).toEqual({ kind: 'grandparent', qualifier: 'cak' })
  })

  it('qualifier eyang jw tersimpan', () => {
    expect(resolveAlias('eyang')).toEqual({ kind: 'grandparent', qualifier: 'jw' })
  })

  it('qualifier misan sunda tersimpan beserta note', () => {
    expect(resolveAlias('misan')).toEqual({
      kind: 'cousin',
      qualifier: 'sunda',
      note: 'makna 2 Jawa: turun satu pangkat',
    })
  })

  it('buyut membawa note dua arah', () => {
    expect(resolveAlias('buyut')).toEqual({
      kind: 'descendant',
      depth: 3,
      note: 'dua arah: naik 3 berarti ancestor pangkat 3, konteks wajib',
    })
  })

  it.each([
    'piat',
    'senenek',
    'semoyang',
    'anggas',
    'miut',
    'ranggas',
    'cicit2',
    '',
  ])('kasus negatif %j resolve null', (phrase) => {
    expect(resolveAlias(phrase)).toBeNull()
  })

  it('aliasKinds terurut alfabetis dan deterministik', () => {
    const kinds = aliasKinds()
    expect(kinds).toEqual([...kinds].sort())
    expect(kinds).toEqual(Object.keys(KINSHIP_ALIASES).sort())
    for (let i = 1; i < kinds.length; i++) {
      expect(kinds[i - 1] < kinds[i]).toBe(true)
    }
  })
})
