import { describe, expect, it } from 'vitest'
import { aliasNoteForPhrase } from './kinship-alias-note'

describe('aliasNoteForPhrase (kasus inti, commit dini)', () => {
  it('aki Sunda menjadi istilah regional untuk kakek nenek', () => {
    expect(aliasNoteForPhrase('aki')).toBe('istilah regional untuk kakek nenek')
  })

  it('eyang hormat Jawa menjadi istilah hormat untuk kakek nenek', () => {
    expect(aliasNoteForPhrase('eyang')).toBe('istilah hormat (Jawa) untuk kakek nenek')
  })

  it('frasa tak dikenali mengembalikan null', () => {
    expect(aliasNoteForPhrase('bukan alias')).toBeNull()
  })
})
