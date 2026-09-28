import { describe, expect, it } from 'vitest'
import { aliasKinds, resolveAlias } from './kinship-aliases'

describe('kinship-aliases rantai atas (v174-iii)', () => {
  it('buyut ri resolve ancestor depth 4 region Ri', () => {
    const r = resolveAlias('buyut ri')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
    expect(r?.depth).toBe(4)
    expect(r?.region).toBe('Ri')
  })

  it('buyut jw resolve ancestor depth 3 region Jw', () => {
    const r = resolveAlias('buyut jw')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
    expect(r?.depth).toBe(3)
    expect(r?.region).toBe('Jw')
  })

  it('doktrin notes/417: dua entri terkualifikasi dialek buyut2 punya depth berbeda (kontradiksi intra-lema terdokumentasi)', () => {
    const ri = resolveAlias('buyut ri')
    const jw = resolveAlias('buyut jw')
    expect(ri?.depth).toBe(4)
    expect(jw?.depth).toBe(3)
    expect(ri?.depth).not.toBe(jw?.depth)
    expect(ri?.note).toContain('notes/417')
    expect(jw?.note).toContain('notes/417')
  })

  it('buyut tanpa dialek tetap perilaku existing descendant depth 3 (tidak berubah)', () => {
    const r = resolveAlias('buyut')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('descendant')
    expect(r?.depth).toBe(3)
    expect(r?.note).toContain('dua arah')
  })

  it('poyang tetap ancestor depth 4', () => {
    const r = resolveAlias('poyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
    expect(r?.depth).toBe(4)
  })

  it('moyang tetap ancestor', () => {
    const r = resolveAlias('moyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('datuk tetap grandparent', () => {
    const r = resolveAlias('datuk')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('grandparent')
  })

  it('guard homonim: normalize lowercase berarti AKI kapital tak terdaftar terpisah, aliasKinds tidak memuat key berhuruf kapital', () => {
    const upper = resolveAlias('AKI')
    const lower = resolveAlias('aki')
    expect(upper).toEqual(lower)
    const kinds = aliasKinds()
    for (const key of kinds) {
      expect(key).toBe(key.toLowerCase())
    }
  })

  it('frasa datuk poyang kolektif tetap ancestor', () => {
    const r = resolveAlias('datuk poyang')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('leluhur tetap ancestor', () => {
    const r = resolveAlias('leluhur')
    expect(r).not.toBeNull()
    expect(r?.kind).toBe('ancestor')
  })

  it('rantai lengkap: anak cucu cicit depth 1 2 3, dan rantai atas kakek datuk moyang poyang kind benar semuanya', () => {
    const anak = resolveAlias('anak')
    const cucu = resolveAlias('cucu')
    const cicit = resolveAlias('cicit')
    expect(anak?.kind).toBe('child')
    expect(cucu?.kind).toBe('grandchild')
    expect(cicit?.kind).toBe('descendant')
    expect(cicit?.depth).toBe(3)

    const kakek = resolveAlias('kakek')
    const datuk = resolveAlias('datuk')
    const moyang = resolveAlias('moyang')
    const poyang = resolveAlias('poyang')
    expect(kakek?.kind).toBe('grandparent')
    expect(datuk?.kind).toBe('grandparent')
    expect(moyang?.kind).toBe('ancestor')
    expect(poyang?.kind).toBe('ancestor')
  })

  it('add-only: aliasKinds bertambah TEPAT 2 key baru (buyut ri, buyut jw) dan tidak menghapus entri lama', () => {
    const kinds = aliasKinds()
    expect(kinds).toContain('buyut ri')
    expect(kinds).toContain('buyut jw')
    expect(kinds).toContain('buyut')
    expect(kinds).toContain('poyang')
    expect(kinds).toContain('datuk poyang')
    // baseline develop a84f0bc (v174-ii) 39 lema; add-only v174-iii +2 buyut = 41; v184-i +13 klaster kakak maskulin = 54; v184-ii +7 kakak feminin = 61; karo agi+turang +2 di eeb3677 lupa bump = 63; v185-i +1 dik = 64; v186-i +2 sembuyak senina = 66
    expect(kinds.length).toBe(66)
  })
})
