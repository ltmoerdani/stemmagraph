import { describe, expect, it } from 'vitest'
import { KINSHIP_ALIASES, resolveAlias } from './kinship-aliases'

/**
 * Guard test key adinda (v253xxxi gelombang dua belas, test-only).
 * Sumber entri DUA: KBBI VI resmi kemendikdasmen (akses 13 Okt 2026,
 * HTTP 200): a.din.da n hor sapaan akrab kepada adik, satu lema
 * nihil homograf bernomor, gugus hor.
 * Plus Wiktionary ID oldid 1109917 blok Bahasa Indonesia Nomina:
 * hormat adik (mengandung pengertian lebih hormat dan ramah),
 * etimologi adik plus -nda, kategori Turunan kata adik, rujukan
 * R:KBBI Daring, flag rfv impor dari KBBI dicatat jujur.
 * GUARD HOMOGRAF: adikanda nihil di KBBI VI dan nihil di Wiktionary
 * ID TIDAK dipetakan. Ejaan ber titik a.din.da TIDAK dipakai sbg
 * key (pola budhe dari bu.de, se.du.lur, man.tu).
 * GUARD HOMONIM ANTARBAHASA: nihil blok bahasa lain di oldid sama.
 * Entri live ada di kinship-aliases.ts; test ini mengunci kind
 * sibling depth 1 region hor register hormat, posisi alfabetis
 * sisip sebelum anak, gugus hor dan sibling non-regresi, dan guard
 * anti homonim.
 */

describe('kinship-aliases adinda (v253xxxi gelombang dua belas)', () => {
  it('1. entri live: kind sibling, depth 1, region hor, register hormat', () => {
    const e = KINSHIP_ALIASES['adinda']
    expect(e).toBeDefined()
    expect(e.kind).toBe('sibling')
    expect(e.depth).toBe(1)
    expect(e.region).toBe('hor')
    expect(e.register).toBe('hormat')
  })

  it('2. resolusi varian: adinda, Adinda, spasi adinda spasi resolve ke entri sama', () => {
    const base = resolveAlias('adinda')
    expect(base).not.toBeNull()
    expect(resolveAlias('Adinda')).toEqual(base)
    expect(resolveAlias('  adinda ')).toEqual(base)
    expect(base?.kind).toBe('sibling')
    expect(base?.depth).toBe(1)
  })

  it('3. ejaan ber titik a.din.da TIDAK jadi key (pola budhe), guard negatif', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('a.din.da')
    expect(resolveAlias('a.din.da')).toBeNull()
  })

  it('4. homograf adikanda TIDAK dipetakan (nihil di KBBI VI dan Wiktionary ID)', () => {
    expect(Object.keys(KINSHIP_ALIASES)).not.toContain('adikanda')
    expect(resolveAlias('adikanda')).toBeNull()
  })

  it('5. padanan non-regresi: kanda Jawa/Sunda dan ayunda gugus hor tetap utuh', () => {
    expect(KINSHIP_ALIASES['kanda']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa/Sunda',
    })
    expect(KINSHIP_ALIASES['ayunda']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'hor',
      register: 'hormat',
    })
  })

  it('6. gugus sibling tetap utuh non-regresi: kakang sedulur nilai existing tak berubah', () => {
    expect(KINSHIP_ALIASES['kakang']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      region: 'Jawa',
    })
    expect(KINSHIP_ALIASES['sedulur']).toMatchObject({
      kind: 'sibling',
      depth: 1,
      qualifier: 'jw',
      region: 'Jawa',
    })
  })

  it('7. guard register hormat konsisten dengan keterangan sumber, bukan sapaan netral', () => {
    const r = resolveAlias('adinda')
    expect(r?.register).toBe('hormat')
    expect(r?.qualifier).toBeUndefined()
  })

  it('8. posisi alfabetis: adinda sisip sebelum anak di Object.keys', () => {
    const keys = Object.keys(KINSHIP_ALIASES)
    const iAdinda = keys.indexOf('adinda')
    const iAnak = keys.indexOf('anak')
    expect(iAdinda).toBeGreaterThanOrEqual(0)
    expect(iAnak).toBeGreaterThan(iAdinda)
    expect(keys[iAdinda + 1]).toBe('anak')
  })

  it('9. determinisme: dua kali resolve hasil identik', () => {
    const a = resolveAlias('adinda')
    const b = resolveAlias('adinda')
    expect(a).toEqual(b)
  })

  it('10. guard jumlah key PERSIS 118 pasca gelombang dua belas', () => {
    expect(Object.keys(KINSHIP_ALIASES)).toHaveLength(128)
  })

  it('11. klaster sibling depth 1 global 34 anggota pasca adinda', () => {
    const siblingDepth1 = Object.entries(KINSHIP_ALIASES).filter(
      ([, entry]) => entry.kind === 'sibling' && entry.depth === 1,
    )
    expect(siblingDepth1.length).toBe(38)
    const keys = new Set(siblingDepth1.map(([key]) => key))
    expect(keys.has('adinda')).toBe(true)
  })
})
