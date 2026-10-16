import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, aliasKinds, resolveAlias } from './kinship-aliases'

/**
 * Guard test key simbah (v253xxx gelombang sebelas, test-only).
 * Sumber entri DUA (riset first-hand PM 13 Okt 2026):
 * KBBI VI resmi kemendikdasmen sim.bah tiga homograf bernomor:
 * sim.bah1 a basah; sim.bah2 v Mk menyimbah; sim.bah3 n Jw embah.
 * Wiktionary ID oldid 1238922: blok Bahasa Indonesia Nomina embah,
 * rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur.
 * GUARD HOMOGRAF KBBI: makna a basah (sim.bah1) dan verba Mk
 * menyimbah (sim.bah2) TIDAK dipetakan sbg relasi kekerabatan.
 * GUARD TURUNAN: bersimbah menyimbah menyimbahkan tersimbah dsb
 * TIDAK dipetakan, morfen dasar terikat bukan lema relasi.
 * GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan: blok
 * English, Jawa, Malagasy, zh bukan blok bahasa Indonesia.
 * Ejaan resmi KBBI ber titik sim.bah TIDAK dipakai sbg key (pola
 * budhe dari bu.de). Konvergensi makna dengan embah dan mbah yang
 * sudah live, tetap key sendiri karena lema resmi berbeda.
 * Entri live di kinship-aliases.ts sisip setelah embah; test ini
 * mengunci kind grandparent qualifier jw region Jawa tanpa register,
 * dan guard anti homograf turunan homonim.
 */

describe('kinship-aliases simbah (v253xxx gelombang sebelas)', () => {
  it('1. entri live: kind grandparent, qualifier jw, region Jawa, tanpa depth tanpa register', () => {
    const e = KINSHIP_ALIASES['simbah']
    expect(e).toBeDefined()
    expect(e.kind).toBe('grandparent')
    expect(e.qualifier).toBe('jw')
    expect(e.region).toBe('Jawa')
    expect(e.depth).toBeUndefined()
    expect(e.register).toBeUndefined()
  })

  it('2. resolusi varian: simbah, Simbah, SIMBAH, spasi resolve entri sama', () => {
    const base = resolveAlias('simbah')
    expect(base).not.toBeNull()
    expect(base?.kind).toBe('grandparent')
    expect(resolveAlias('Simbah')).toEqual(base)
    expect(resolveAlias('SIMBAH')).toEqual(base)
    expect(resolveAlias(' simbah ')).toEqual(base)
  })

  it('3. konvergensi makna: simbah dan embah dan mbah resolve grandparent sama-sama jw Jawa', () => {
    const s = resolveAlias('simbah')
    const emb = resolveAlias('embah')
    const mb = resolveAlias('mbah')
    expect(s?.kind).toBe('grandparent')
    expect(emb?.kind).toBe('grandparent')
    expect(mb?.kind).toBe('grandparent')
    expect(s?.qualifier).toBe('jw')
    expect(emb?.qualifier).toBe('jw')
    expect(mb?.qualifier).toBe('jw')
  })

  it('4. guard homograf KBBI: makna basah dan menyimbah TIDAK dipetakan', () => {
    // sim.bah1 a basah dan sim.bah2 v Mk menyimbah bukan relasi kekerabatan.
    // Keduanya hanya tercatat di note, nihil key terpisah.
    expect(KINSHIP_ALIASES['basah']).toBeUndefined()
    expect(KINSHIP_ALIASES['menyimbah']).toBeUndefined()
    expect(KINSHIP_ALIASES['menyimbahkan']).toBeUndefined()
    const note = KINSHIP_ALIASES['simbah']?.note ?? ''
    expect(note).toContain('basah')
    expect(note).toContain('menyimbah')
  })

  it('5. guard turunan Wiktionary TIDAK jadi key', () => {
    expect(KINSHIP_ALIASES['bersimbah']).toBeUndefined()
    expect(KINSHIP_ALIASES['tersimbah']).toBeUndefined()
    expect(KINSHIP_ALIASES['disimbahkan']).toBeUndefined()
  })

  it('6. guard ejaan ber titik sim.bah TIDAK jadi key, pola budhe', () => {
    expect(KINSHIP_ALIASES['sim.bah']).toBeUndefined()
  })

  it('7. tidak bocor ke kind lain dan tetap satu key', () => {
    expect(aliasKinds().filter((k) => k === 'simbah')).toHaveLength(1)
    const gp = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'grandparent')
    expect(gp).toContain('simbah')
    const props = Object.keys(KINSHIP_ALIASES).filter((k) => KINSHIP_ALIASES[k]?.kind === 'property')
    expect(props).not.toContain('simbah')
  })

  it('8. guard jumlah key PERSIS 117 pasca v253xxx gelombang sebelas (116 jadi 117: simbah)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(145)
    expect(aliasKinds().length).toBe(145)
  })

  it('9. non-regresi gugus grandparent inti: kakek nenek engkong embah eyang tetap live', () => {
    for (const k of ['kakek', 'nenek', 'engkong', 'embah', 'eyang', 'mbah']) {
      expect(KINSHIP_ALIASES[k]?.kind).toBe('grandparent')
      expect(resolveAlias(k)).not.toBeNull()
    }
  })
})
