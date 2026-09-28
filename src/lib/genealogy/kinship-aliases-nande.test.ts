import { describe, expect, it } from 'vitest'

import {
  KINSHIP_ALIASES,
  aliasKinds,
  resolveAlias,
} from './kinship-aliases'

describe('alias Karo nande ibukota kelompok (v187-i)', () => {
  it('nande resolve ke sibling depth 1 region Karo', () => {
    const e = resolveAlias('nande')
    expect(e).not.toBeNull()
    expect(e?.kind).toBe('sibling')
    expect(e?.depth).toBe(1)
    expect(e?.region).toBe('Karo')
  })

  it('nande ter-normalisasi case-insensitive dan trim', () => {
    expect(resolveAlias('Nande')).not.toBeNull()
    expect(resolveAlias(' Nande ')).not.toBeNull()
    expect(resolveAlias('NANDE')).not.toBeNull()
  })

  it('nande punya note evidence notes/442', () => {
    expect(resolveAlias('nande')?.note).toContain('evidence notes/442')
    expect(resolveAlias('nande')?.note).toContain('ibu')
  })

  it('struktur entri nande persis 4 field kind depth region note', () => {
    const e = resolveAlias('nande')
    expect(e).not.toBeNull()
    expect(Object.keys(e as object).sort()).toEqual(['depth', 'kind', 'note', 'region'])
  })

  it('aliasKinds memuat nande, tetap sorted', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('nande')
    const sorted = [...kinds].sort()
    expect(kinds).toEqual(sorted)
  })

  it('nande key terdaftar tunggal di KINSHIP_ALIASES', () => {
    const keys = Object.keys(KINSHIP_ALIASES).filter((k) => k === 'nande')
    expect(keys).toEqual(['nande'])
  })

  it('negatif: nanam tidak terdaftar', () => {
    expect(resolveAlias('nanam')).toBeNull()
  })

  it('negatif: nana tidak terdaftar', () => {
    expect(resolveAlias('nana')).toBeNull()
  })

  it('negatif: namuk tidak terdaftar', () => {
    expect(resolveAlias('namuk')).toBeNull()
  })

  it('negatif: namo tidak terdaftar', () => {
    expect(resolveAlias('namo')).toBeNull()
  })

  it('negatif: perpusteknik bukan key kekerabatan', () => {
    expect(resolveAlias('perpusteknik')).toBeNull()
  })

  it('karakterisasi: entri sembuyak dan senina tetap utuh tak berubah pasca penambahan nande', () => {
    const sembuyak = resolveAlias('sembuyak')
    const senina = resolveAlias('senina')
    expect(sembuyak?.kind).toBe('sibling')
    expect(sembuyak?.depth).toBe(1)
    expect(sembuyak?.region).toBe('Karo')
    expect(sembuyak?.note).toContain('evidence notes/440')
    expect(senina?.kind).toBe('sibling')
    expect(senina?.depth).toBe(1)
    expect(senina?.region).toBe('Karo')
    expect(senina?.note).toContain('evidence notes/440')
  })

  it('deterministik: resolveAlias nande dipanggil dua kali menghasilkan hasil sama', () => {
    const first = resolveAlias('nande')
    const second = resolveAlias('nande')
    expect(first).toEqual(second)
  })
})
