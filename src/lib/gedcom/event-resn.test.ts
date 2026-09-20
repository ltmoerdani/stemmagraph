// Test lapisan pure RESN level event (v133-i).
//
// Nilai uji diambil dari fixture resmi gedcom.io maximal70.ged:
// record INDI membawa "1 RESN CONFIDENTIAL, LOCKED" (multi-nilai
// enumset dipisah koma), dan event level MARR/DEAT boleh membawa
// RESN sendiri sesuai pola webtrees Fact.php (notes/298, 299).

import { describe, expect, it } from 'vitest'
import {
  effectiveResn,
  extractEventResn,
  normalizeResnLine,
  type EventResnInput,
} from './event-resn'

// Cuplikan nilai dari scripts/fixtures-gedcom70/maximal70.ged.
const RESN_RECORD_INDI = 'CONFIDENTIAL, LOCKED'
const RESN_MARR_EVENT = 'CONFIDENTIAL, LOCKED'
const RESN_DEAT_EVENT = 'privacy'

const marrDenganResn: EventResnInput = { resn: RESN_MARR_EVENT }
const deatDenganResn: EventResnInput = { resn: RESN_DEAT_EVENT }
const recordDenganResn: EventResnInput = { resn: RESN_RECORD_INDI }

describe('extractEventResn atas event MARR fixture maximal70', () => {
  it('multi-nilai enumset dipisah koma diurai penuh', () => {
    expect(extractEventResn(marrDenganResn)).toEqual([
      'CONFIDENTIAL',
      'LOCKED',
    ])
  })
})

describe('extractEventResn atas event DEAT fixture maximal70', () => {
  it('nilai lowercase dinormalkan ke bentuk kanonik', () => {
    expect(extractEventResn(deatDenganResn)).toEqual(['PRIVACY'])
  })
})

describe('effectiveResn precedence event atas record', () => {
  it('RESN event MARR mengungguli RESN record INDI', () => {
    const event: EventResnInput = { resn: 'PRIVACY' }
    expect(effectiveResn(event, recordDenganResn)).toEqual(['PRIVACY'])
  })

  it('RESN record dipakai hanya bila event nihil', () => {
    expect(effectiveResn(null, recordDenganResn)).toEqual([
      'CONFIDENTIAL',
      'LOCKED',
    ])
    expect(effectiveResn({ resn: null }, recordDenganResn)).toEqual([
      'CONFIDENTIAL',
      'LOCKED',
    ])
  })

  it('event dan record sama-sama nihil mengembalikan null', () => {
    expect(effectiveResn(null, null)).toBeNull()
    expect(effectiveResn({ resn: null }, { resn: undefined })).toBeNull()
  })
})

describe('normalisasi nilai RESN', () => {
  it('case-insensitive untuk tiga nilai enumset', () => {
    expect(normalizeResnLine('confidential')).toEqual(['CONFIDENTIAL'])
    expect(normalizeResnLine('Privacy')).toEqual(['PRIVACY'])
    expect(normalizeResnLine('locked')).toEqual(['LOCKED'])
  })

  it('nilai tak dikenal dipertahankan raw utuh', () => {
    expect(normalizeResnLine('RAHASIA KELUARGA')).toEqual([
      'RAHASIA KELUARGA',
    ])
    expect(extractEventResn({ resn: 'CUSTOM-VALUE' })).toEqual([
      'CUSTOM-VALUE',
    ])
  })
})

describe('kombinasi multi event dalam satu record', () => {
  it('tiap event diekstrak mandiri, event tanpa RESN nihil', () => {
    const marr: EventResnInput = { resn: RESN_MARR_EVENT }
    const deat: EventResnInput = { resn: RESN_DEAT_EVENT }
    const buri: EventResnInput = {}
    expect(extractEventResn(marr)).toEqual(['CONFIDENTIAL', 'LOCKED'])
    expect(extractEventResn(deat)).toEqual(['PRIVACY'])
    expect(extractEventResn(buri)).toBeNull()
  })
})

describe('bentuk wire-level payload GEDCOM', () => {
  it('sub-struktur ber-tag RESN terbaca dari payload parser', () => {
    const event: EventResnInput = {
      sub: [
        { tag: 'DATE', value: '1998' },
        { tag: 'RESN', value: 'CONFIDENTIAL, LOCKED' },
      ],
    }
    expect(extractEventResn(event)).toEqual(['CONFIDENTIAL', 'LOCKED'])
  })

  it('tag lowercase dari parser alternatif tetap terbaca', () => {
    const event: EventResnInput = { sub: [{ tag: 'resn', value: 'locked' }] }
    expect(extractEventResn(event)).toEqual(['LOCKED'])
  })
})
