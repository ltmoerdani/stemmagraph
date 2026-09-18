import { describe, expect, it } from 'vitest'

import type { GenealogicalDate } from './genealogical-date'
import { parseGenealogicalDate } from './genealogical-date'
import { makeEvent } from './event-model'
import {
  eventToRow,
  linkToRow,
  rowToEvent,
  rowToLink,
  type GenealogicalLink,
} from './schema-wiring'

const exact1900: GenealogicalDate = { modifier: 'exact', year: 1900, quality: null }

describe('eventToRow + rowToEvent round-trip', () => {
  it('kasus 1: event lengkap (exact date + place) round-trip tanpa kehilangan', () => {
    const event = makeEvent('BIRT', exact1900, 'Bandung')
    const row = eventToRow(event, 'member-1')
    expect(row).toEqual({
      memberId: 'member-1',
      type: 'BIRT',
      dateGed: JSON.stringify(exact1900),
      place: 'Bandung',
    })
    expect(rowToEvent(row)).toEqual(event)
  })

  it('kasus 2: date ABT 1850 round-trip lewat JSON', () => {
    const event = makeEvent('DEAT', parseGenealogicalDate('ABT 1850'))
    const row = eventToRow(event, 'm2')
    expect(rowToEvent(row)).toEqual(event)
  })

  it('kasus 3: date range BET 1900 AND 1910 round-trip', () => {
    const event = makeEvent('MARR', parseGenealogicalDate('BET 1900 AND 1910'), 'Surabaya')
    const row = eventToRow(event, 'm3')
    expect(rowToEvent(row)).toEqual(event)
  })

  it('kasus 4: phrase bebas round-trip utuh', () => {
    const event = makeEvent('BIRT', parseGenealogicalDate('pada musim hujan 1901'))
    expect(rowToEvent(eventToRow(event, 'm4'))).toEqual(event)
  })

  it('kasus 5: round-trip tanpa mutation memberId lain', () => {
    const row = eventToRow(makeEvent('MARR'), 'm5')
    expect(Object.keys(row).sort()).toEqual(['dateGed', 'memberId', 'place', 'type'])
  })
})

describe('event row edge cases', () => {
  it('kasus 6: date null tersimpan null dan kembali null', () => {
    const row = eventToRow(makeEvent('BIRT', null, 'Solo'), 'm6')
    expect(row.dateGed).toBeNull()
    const back = rowToEvent(row)
    expect(back?.date).toBeNull()
    expect(back?.place).toBe('Solo')
  })

  it('kasus 7: place null tersimpan null dan kembali null', () => {
    const row = eventToRow(makeEvent('DEAT', exact1900), 'm7')
    expect(row.place).toBeNull()
    expect(rowToEvent(row)?.place).toBeNull()
  })

  it('kasus 8: type di luar daftar (BAPM) menghasilkan null', () => {
    expect(rowToEvent({ type: 'BAPM', dateGed: null, place: null })).toBeNull()
  })

  it('kasus 9: type case-sensitive (birt) menghasilkan null', () => {
    expect(rowToEvent({ type: 'birt', dateGed: null, place: null })).toBeNull()
  })

  it('kasus 10: dateGed teks lama non-JSON diparse via parseGenealogicalDate', () => {
    const back = rowToEvent({ type: 'BIRT', dateGed: 'ABT 1900', place: null })
    expect(back?.date).toEqual(parseGenealogicalDate('ABT 1900'))
    expect(back?.date?.modifier).toBe('about')
  })

  it('kasus 11: dateGed string kosong menghasilkan date null', () => {
    expect(rowToEvent({ type: 'BIRT', dateGed: '', place: null })?.date).toBeNull()
  })
})

describe('linkToRow + rowToLink', () => {
  it('kasus 12: link BIRTH round-trip', () => {
    const link: GenealogicalLink = { childId: 'c1', parentId: 'p1', pedi: 'BIRTH' }
    const row = linkToRow(link)
    expect(row).toEqual({ childId: 'c1', parentId: 'p1', type: 'BIRTH' })
    expect(rowToLink(row)).toEqual({ childId: 'c1', parentId: 'p1', type: 'BIRTH' })
  })

  it('kasus 13: pedi sealed menjadi OTHER, raw utuh tersedia', () => {
    const link: GenealogicalLink = { childId: 'c2', parentId: 'p2', pedi: 'sealed' }
    expect(linkToRow(link).type).toBe('OTHER')
    // raw utuh: nilai asli tidak diubah oleh pemetaan
    expect(link.pedi).toBe('sealed')
  })

  it('kasus 14: varian huruf kecil birth tetap OTHER', () => {
    expect(linkToRow({ childId: 'c3', parentId: 'p3', pedi: 'birth' }).type).toBe('OTHER')
  })

  it('kasus 15: rowToLink type di luar daftar menghasilkan null', () => {
    expect(rowToLink({ childId: 'c4', parentId: 'p4', type: 'SEALED' })).toBeNull()
  })

  it('kasus 16: rowToLink round-trip ADOPTED', () => {
    const row = linkToRow({ childId: 'c5', parentId: 'p5', pedi: 'ADOPTED' })
    expect(rowToLink(row)).toEqual({ childId: 'c5', parentId: 'p5', type: 'ADOPTED' })
  })
})
