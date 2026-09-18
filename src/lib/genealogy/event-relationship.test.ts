import { describe, expect, it } from 'vitest'

import { EVENT_TYPES, makeEvent } from './event-model'
import { mapPediToRelationship, makePartnerRelation } from './relationship'

describe('makeEvent', () => {
  it.each(['BIRT', 'DEAT', 'MARR'] as const)(
    'menerima tipe valid %s dengan date dan place',
    (type) => {
      const date = { modifier: 'exact' as const, year: 1900 }
      const ev = makeEvent(type, date, 'Bandung, Jawa Barat')
      expect(ev).toEqual({ type, date, place: 'Bandung, Jawa Barat' })
    },
  )

  it('menolak type di luar daftar dengan throw Error', () => {
    expect(() => makeEvent('BAPM')).toThrow()
  })

  it('menolak type huruf kecil (case-sensitive)', () => {
    expect(() => makeEvent('birt')).toThrow()
  })

  it('mengizinkan date null', () => {
    const ev = makeEvent('DEAT', null, 'Jakarta')
    expect(ev.date).toBeNull()
  })

  it('mengizinkan place null', () => {
    const ev = makeEvent('MARR', null, null)
    expect(ev.place).toBeNull()
  })

  it('menyimpan place verbatim termasuk koma dan tanda baca', () => {
    const raw = 'Kec. Sukajadi, Kota Bandung, Jawa Barat 40162; Indonesia.'
    const ev = makeEvent('BIRT', null, raw)
    expect(ev.place).toBe(raw)
    expect(ev.place).not.toContain(' || ')
  })

  it('EVENT_TYPES berisi tepat 3 tipe', () => {
    expect(EVENT_TYPES).toHaveLength(3)
  })
})

describe('mapPediToRelationship', () => {
  it.each(['BIRTH', 'ADOPTED', 'FOSTER'] as const)(
    'memetakan %s ke dirinya sendiri',
    (pedi) => {
      expect(mapPediToRelationship(pedi)).toEqual({
        type: pedi,
        raw: pedi,
      })
    },
  )

  it('memetakan sealed ke OTHER dengan raw utuh', () => {
    expect(mapPediToRelationship('sealed')).toEqual({
      type: 'OTHER',
      raw: 'sealed',
    })
  })

  it('memetakan Sealed (kapital awal) ke OTHER dengan raw utuh', () => {
    expect(mapPediToRelationship('Sealed')).toEqual({
      type: 'OTHER',
      raw: 'Sealed',
    })
  })

  it('memetakan varian huruf besar kecil acak ke OTHER dengan raw utuh', () => {
    expect(mapPediToRelationship('bIrTh')).toEqual({
      type: 'OTHER',
      raw: 'bIrTh',
    })
  })

  it('memetakan string kosong ke OTHER dengan raw utuh', () => {
    expect(mapPediToRelationship('')).toEqual({ type: 'OTHER', raw: '' })
  })
})

describe('makePartnerRelation', () => {
  it('mengembalikan relasi pasangan dengan type PARTNER', () => {
    const rel = makePartnerRelation('p1', 'p2')
    expect(rel).toEqual({ partners: ['p1', 'p2'], type: 'PARTNER' })
  })

  it('satu person boleh muncul di dua relasi berbeda tanpa konflik', () => {
    const r1 = makePartnerRelation('p1', 'p2')
    const r2 = makePartnerRelation('p1', 'p3')
    expect(r1.partners).toEqual(['p1', 'p2'])
    expect(r2.partners).toEqual(['p1', 'p3'])
    expect(r1).not.toEqual(r2)
  })
})
