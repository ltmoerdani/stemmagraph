// Unit test helper eventDateValueGed + wiring BIRT/DEAT (v116 iv-c).
//
// Fokus: preferensi kolom Ged lewat datePayloadFromGed + toGedcomDateValue,
// pemisahan semantik FROM-TO (periode) vs BET-AND (rentang), fallback legacy
// parseEventDate + formatGedcomDateValue tanpa penajaman, raw fallback
// byte-preserved, dan kesetaraan byte dengan jalur legacy murni saat kolom
// Ged nihil. Kasus wire-level memastikan DATE sampai di output exportGedcom70.

import { describe, expect, it } from 'vitest'
import {
  eventDateValueGed,
  exportGedcom70,
  type EventDateInput,
} from './exportGedcom70'
import type { FamilyMemberRecord } from '../adapters/types'

function member(
  partial: Partial<FamilyMemberRecord> & Pick<FamilyMemberRecord, 'id'>,
): FamilyMemberRecord {
  return {
    treeId: 'tree-1',
    name: `Nama ${partial.id}`,
    birthDate: '1 JAN 1990',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
    ...partial,
  }
}

describe('eventDateValueGed: preferensi kolom Ged', () => {
  it('tahun eksak dari kolom Ged menang atas raw legacy', () => {
    const input: EventDateInput = { raw: '1 JAN 1990', ged: '1902' }
    expect(eventDateValueGed(input)).toBe('1902')
  })

  it('periode FROM-TO diserialkan utuh via toGedcomDateValue', () => {
    const input: EventDateInput = { raw: '', ged: 'FROM 1900 TO 1910' }
    expect(eventDateValueGed(input)).toBe('FROM 1900 TO 1910')
  })

  it('rentang BET-AND diserialkan utuh via toGedcomDateValue', () => {
    const input: EventDateInput = { raw: '', ged: 'BET 1900 AND 1910' }
    expect(eventDateValueGed(input)).toBe('BET 1900 AND 1910')
  })

  it('ABT mempertahankan modifier approx', () => {
    const input: EventDateInput = { raw: null, ged: 'ABT 1875' }
    expect(eventDateValueGed(input)).toBe('ABT 1875')
  })

  it('CAL mempertahankan modifier calculated', () => {
    const input: EventDateInput = { raw: null, ged: 'CAL 1875' }
    expect(eventDateValueGed(input)).toBe('CAL 1875')
  })

  it('EST mempertahankan modifier estimated', () => {
    const input: EventDateInput = { raw: null, ged: 'EST 1850' }
    expect(eventDateValueGed(input)).toBe('EST 1850')
  })

  it('phrase dibungkus kurung tanpa diubah isinya', () => {
    const input: EventDateInput = {
      raw: null,
      ged: 'sometime after the war',
    }
    expect(eventDateValueGed(input)).toBe('(sometime after the war)')
  })
})

describe('eventDateValueGed: semantik FROM-TO vs BET-AND', () => {
  it('FROM-TO dan BET-AND tidak tertukar hasil serialisasinya', () => {
    const period: EventDateInput = { raw: null, ged: 'FROM 1900 TO 1910' }
    const range: EventDateInput = { raw: null, ged: 'BET 1900 AND 1910' }
    expect(eventDateValueGed(period)).toBe('FROM 1900 TO 1910')
    expect(eventDateValueGed(range)).toBe('BET 1900 AND 1910')
    expect(eventDateValueGed(period)).not.toBe(eventDateValueGed(range))
  })
})

describe('eventDateValueGed: fallback legacy tanpa penajaman', () => {
  it('ABT legacy tetap approximate, tanpa penajaman ke eksak', () => {
    const input: EventDateInput = { raw: 'ABT 1900', ged: null }
    expect(eventDateValueGed(input)).toBe('ABT 1900')
  })

  it('rentang BET-AND legacy tetap rentang', () => {
    const input: EventDateInput = { raw: 'BET 1900 AND 1910', ged: null }
    expect(eventDateValueGed(input)).toBe('BET 1900 AND 1910')
  })

  it('EST legacy tidak dikenali parser lama dan tetap byte-preserved', () => {
    const input: EventDateInput = { raw: 'EST 1850', ged: null }
    expect(eventDateValueGed(input)).toBe('EST 1850')
  })

  it('string legacy malformed diteruskan apa adanya (raw fallback)', () => {
    const input: EventDateInput = { raw: 'musim panas 1945', ged: null }
    expect(eventDateValueGed(input)).toBe('musim panas 1945')
  })

  it('kolom Ged kosong (string spasi) jatuh ke jalur legacy', () => {
    const input: EventDateInput = { raw: '1901', ged: '   ' }
    expect(eventDateValueGed(input)).toBe('1901')
  })
})

describe('eventDateValueGed: kesetaraan jalur legacy murni', () => {
  it('kolom Ged nihil (null/undefined/tiada) menghasilkan byte identik', () => {
    const raws = ['12 MAR 1945', 'MAR 1945', '1945', '1945-03-12']
    for (const raw of raws) {
      const bare = eventDateValueGed({ raw })
      const nulled = eventDateValueGed({ raw, ged: null })
      const undefinedGed = eventDateValueGed({ raw, ged: undefined })
      expect(bare).toBe(nulled)
      expect(bare).toBe(undefinedGed)
    }
    expect(eventDateValueGed({ raw: '1945-03-12', ged: null })).toBe(
      '12 MAR 1945',
    )
  })
})

describe('wiring BIRT/DEAT pada output export', () => {
  it('BIRT.DATE dan DEAT.DATE memakai payload kolom Ged di output', () => {
    const m = member({
      id: 'a',
      birthDate: '1 JAN 1900',
      birthDateGed: 'FROM 1900 TO 1910',
      isAlive: false,
      deathDate: '5 JUN 1930',
      deathDateGed: 'BET 1920 AND 1930',
    })
    const { gedcom } = exportGedcom70({
      members: [m],
      relationships: [],
      exportedAt: new Date('2026-09-18T00:00:00Z'),
    })
    const lines = gedcom.split('\n')
    const birt = lines.indexOf('1 BIRT')
    const deat = lines.indexOf('1 DEAT')
    expect(birt).toBeGreaterThan(0)
    expect(deat).toBeGreaterThan(birt)
    expect(lines[birt + 1]).toBe('2 DATE FROM 1900 TO 1910')
    expect(lines[deat + 1]).toBe('2 DATE BET 1920 AND 1930')
  })

  it('kolom Ged lebih diutamakan daripada raw pada DATE output', () => {
    const m = member({
      id: 'a',
      birthDate: '1 JAN 1990',
      birthDateGed: '1902',
    })
    const { gedcom } = exportGedcom70({
      members: [m],
      relationships: [],
      exportedAt: new Date('2026-09-18T00:00:00Z'),
    })
    expect(gedcom).toContain('2 DATE 1902')
    expect(gedcom).not.toContain('2 DATE 1 JAN 1990')
  })
})
