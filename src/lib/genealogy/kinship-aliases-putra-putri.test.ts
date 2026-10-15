import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, KINSHIP_ALIASES_REGIONAL, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key putra putri (v253xlii, test-only).
 * Sumber entri DUA SUMBER terverifikasi: KBBI III mirror kbbi.web.id/putra
 * dan kbbi.web.id/putri akses 14 Okt 2026 HTTP 200 (satu lema per lema,
 * nihil homograf bernomor, tanpa label daerah) plus Wiktionary ID blok
 * Bahasa Indonesia (putra revid 1361443, putri revid 1461278, konvergen
 * KBBI, rujukan R:KBBI Daring, flag rfv impor dicatat jujur).
 * Kind child pola anak ananda, TANPA region (baku nasional).
 * GUARD POLISEMI TIDAK DIPETAKAN: makna khusus laki-laki putra (juara
 * putra, lomba lari 100 m putra), makna khusus wanita putri (lompat
 * tinggi putri, kategori putri), idiom putri malu Mimosa pudica dan
 * putri boyongan, turunan berputra berputri. Varian ejaan putera
 * puteri TIDAK dibuat key (preseden man.tu), dicatat jujur di note.
 * Entri live ada di kinship-aliases.ts klaster child dekat anak ananda,
 * urutan alfabetis internal map: putra sebelum putri.
 */
describe('kinship-aliases putra putri (v253xlii)', () => {
  it('1. entri putra live: kind child, tanpa qualifier, tanpa region, tanpa register', () => {
    const e = KINSHIP_ALIASES['putra']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. entri putri live: kind child, tanpa qualifier, tanpa region, tanpa register', () => {
    const e = KINSHIP_ALIASES['putri']
    expect(e).toBeDefined()
    expect(e.kind).toBe('child')
    expect(e.depth).toBeUndefined()
    expect(e.qualifier).toBeUndefined()
    expect(e.region).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('3. resolveAlias putra putri ke child dua arah, normalisasi kapital dan spasi kena', () => {
    expect(resolveAlias('putra')?.kind).toBe('child')
    expect(resolveAlias('putri')?.kind).toBe('child')
    expect(resolveAlias('putra')?.kind).not.toBe('parent')
    expect(resolveAlias('putri')?.kind).not.toBe('sibling')
    expect(resolveAlias('PUTRA')?.kind).toBe('child')
    expect(resolveAlias('  Putri  ')?.kind).toBe('child')
  })

  it('4. note putra memuat makna relasi, sumber ganda, dan revid 1361443', () => {
    const note = KINSHIP_ALIASES['putra'].note ?? ''
    expect(note).toContain('anak kandung laki-laki')
    expect(note).toContain('anak laki-laki')
    expect(note).toContain('kbbi.web.id/putra')
    expect(note).toContain('akses 14 Okt 2026')
    expect(note).toContain('1361443')
    expect(note).toContain('konvergen KBBI')
  })

  it('5. note putri memuat makna relasi, sumber ganda, dan revid 1461278', () => {
    const note = KINSHIP_ALIASES['putri'].note ?? ''
    expect(note).toContain('anak perempuan')
    expect(note).toContain('anak kandung wanita')
    expect(note).toContain('kbbi.web.id/putri')
    expect(note).toContain('akses 14 Okt 2026')
    expect(note).toContain('1461278')
    expect(note).toContain('konvergen KBBI')
  })

  it('6. guard polisemi makna khusus putra: juara putra dan lomba lari 100 m putra BUKAN key', () => {
    const note = KINSHIP_ALIASES['putra'].note ?? ''
    expect(note).toContain('juara putra')
    expect(note).toContain('lomba lari 100 m putra')
    expect(KINSHIP_ALIASES['juara putra']).toBeUndefined()
    expect(resolveAlias('juara putra')).toBeNull()
    expect(resolveAlias('lomba lari 100 m putra')).toBeNull()
  })

  it('7. guard polisemi makna khusus putri: lompat tinggi putri dan kategori putri BUKAN key', () => {
    const note = KINSHIP_ALIASES['putri'].note ?? ''
    expect(note).toContain('lompat tinggi putri')
    expect(note).toContain('kategori putri')
    expect(KINSHIP_ALIASES['lompat tinggi putri']).toBeUndefined()
    expect(resolveAlias('lompat tinggi putri')).toBeNull()
    expect(resolveAlias('kategori putri')).toBeNull()
  })

  it('8. guard idiom putri malu putri boyongan dan turunan berputra berputri nihil key', () => {
    const note = KINSHIP_ALIASES['putri'].note ?? ''
    expect(note).toContain('putri malu')
    expect(note).toContain('putri boyongan')
    expect(note).toContain('Mimosa pudica')
    expect(resolveAlias('putri malu')).toBeNull()
    expect(resolveAlias('putri boyongan')).toBeNull()
    expect(KINSHIP_ALIASES['berputra']).toBeUndefined()
    expect(KINSHIP_ALIASES['berputri']).toBeUndefined()
    expect(resolveAlias('berputra')).toBeNull()
    expect(resolveAlias('berputri')).toBeNull()
  })

  it('9. varian ejaan putera puteri TIDAK jadi key, dicatat jujur di note preseden man.tu', () => {
    expect(KINSHIP_ALIASES['putera']).toBeUndefined()
    expect(KINSHIP_ALIASES['puteri']).toBeUndefined()
    expect(resolveAlias('putera')).toBeNull()
    expect(resolveAlias('puteri')).toBeNull()
    expect(KINSHIP_ALIASES['putra'].note).toContain('putera')
    expect(KINSHIP_ALIASES['putri'].note).toContain('puteri')
    expect(KINSHIP_ALIASES['putra'].note).toContain('man.tu')
  })

  it('10. frasa komposit anak putra anak putri BUKAN key tunggal di map alias', () => {
    expect(KINSHIP_ALIASES['anak putra']).toBeUndefined()
    expect(KINSHIP_ALIASES['anak putri']).toBeUndefined()
    expect(resolveAlias('anak putra')).toBeNull()
    expect(resolveAlias('anak putri')).toBeNull()
  })

  it('11. regresi klaster child: anak dan ananda tetap entri lama utuh tanpa perubahan', () => {
    expect(KINSHIP_ALIASES['anak']).toEqual({ kind: 'child' })
    expect(KINSHIP_ALIASES['ananda'].kind).toBe('child')
    expect(resolveAlias('anak')?.kind).toBe('child')
    expect(resolveAlias('ananda')?.kind).toBe('child')
    const childKeys = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'child')
    expect(childKeys.sort()).toEqual(['anak', 'anak angkat', 'anak asuh', 'anak susuan', 'ananda', 'putra', 'putri'])
  })

  it('12. urutan alfabetis klaster child: putra lalu putri, di antara ananda dan cucu', () => {
    const all = Object.keys(KINSHIP_ALIASES)
    expect(all.indexOf('putra')).toBeGreaterThanOrEqual(0)
    expect(all.indexOf('putra')).toBeLessThan(all.indexOf('putri'))
    expect(all.indexOf('ananda')).toBeLessThan(all.indexOf('putra'))
    expect(all.indexOf('putri')).toBeLessThan(all.indexOf('cucu'))
  })

  it('13. guard bump total key (129 jadi 131 saat gel26, kini 136 pasca gel32) dan non-difusi regional: nihil putra putri di map regional', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(144)
    expect(aliasKinds().length).toBe(144)
    for (const region of Object.keys(KINSHIP_ALIASES_REGIONAL)) {
      expect(KINSHIP_ALIASES_REGIONAL[region]['putra']).toBeUndefined()
      expect(KINSHIP_ALIASES_REGIONAL[region]['putri']).toBeUndefined()
    }
  })

  it('14. note merujuk kontrak kukuh v253xlii', () => {
    expect(KINSHIP_ALIASES['putra'].note).toContain('drafts/kontrak-stg-v253xlii-putra-putri-2026-10-14.md')
    expect(KINSHIP_ALIASES['putri'].note).toContain('drafts/kontrak-stg-v253xlii-putra-putri-2026-10-14.md')
  })
})
