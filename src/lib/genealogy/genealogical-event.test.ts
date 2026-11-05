import { describe, expect, it } from 'vitest'

import { EVENT_KINDS, makeEvent } from './genealogical-event'

describe('makeEvent (v419 AC4)', () => {
  it('membuat event valid lengkap dengan id, kind, date verbatim, place, dan calendarSystem', () => {
    const ev = makeEvent({
      id: 'evt-001',
      kind: 'BIRT',
      date: '12 Agustus 1901',
      place: 'Kec. Sukajadi, Kota Bandung, Jawa Barat',
      calendarSystem: 'GREGORIAN',
    })
    expect(ev).toEqual({
      id: 'evt-001',
      kind: 'BIRT',
      date: '12 Agustus 1901',
      place: 'Kec. Sukajadi, Kota Bandung, Jawa Barat',
      calendarSystem: 'GREGORIAN',
      dualDate: undefined,
    })
  })

  it.each(['BIRT', 'DEAT', 'MARR'] as const)(
    'menerima kind valid %s',
    (kind) => {
      const ev = makeEvent({ id: `e-${kind}`, kind, date: '1900' })
      expect(ev.kind).toBe(kind)
    },
  )

  it('menerima semua CalendarSystem dari union existing tanpa duplikasi', () => {
    for (const calendarSystem of [
      'GREGORIAN',
      'JULIAN',
      'FRENCH_R',
      'HEBREW',
      'DUAL',
    ] as const) {
      const ev = makeEvent({ id: 'e-cal', kind: 'MARR', date: '1793', calendarSystem })
      expect(ev.calendarSystem).toBe(calendarSystem)
    }
  })

  it('default calendarSystem GREGORIAN bila tidak diberikan', () => {
    const ev = makeEvent({ id: 'e-def', kind: 'DEAT', date: '1 Jan 1850' })
    expect(ev.calendarSystem).toBe('GREGORIAN')
  })

  it.each(['BAPM', 'birt', '', '  '])('menolak kind tidak valid %j dengan pesan jelas', (kind) => {
    expect(() => makeEvent({ id: 'e-bad', kind, date: '1900' })).toThrow(Error)
    try {
      makeEvent({ id: 'e-bad', kind, date: '1900' })
    } catch (err) {
      expect((err as Error).message).toMatch(/kind event/i)
    }
  })

  it.each(['', '   ', undefined])('menolak date kosong %j', (date) => {
    expect(() => makeEvent({ id: 'e-date', kind: 'BIRT', date: date as string })).toThrow(/date event wajib/i)
  })

  it.each(['', '   ', undefined])('menolak id kosong %j', (id) => {
    expect(() => makeEvent({ id: id as string, kind: 'MARR', date: '1900' })).toThrow(/id event wajib/i)
  })

  it('EVENT_KINDS berisi tepat 3 kode GEDCOM', () => {
    expect(EVENT_KINDS).toHaveLength(3)
  })
})
