// Unit test perencana backfill place murni (S1F2-C): normalisasi nama,
// dedupe antar ejaan per tree, displayName verbatim hasil rapikan whitespace,
// skip already-linked dan empty-place, null safety, idempotensi pemanggilan
// dua kali, serta pemisahan rencana antar tree. Tanpa DB sama sekali.

import { describe, expect, it } from 'vitest'
import { buildPlaceBackfillPlan, normalizePlaceName } from './placeBackfillPlan'
import type { PlaceBackfillEventInput } from './placeBackfillPlan'

function event(overrides: Partial<PlaceBackfillEventInput> = {}): PlaceBackfillEventInput {
  return {
    eventId: 'e1',
    treeId: 't1',
    memberId: 'm1',
    eventType: 'BIRTH',
    existingPlaceId: null,
    placeText: 'Bandung, Jawa Barat',
    ...overrides,
  }
}

describe('normalizePlaceName', () => {
  it('trim, collapse whitespace beruntun menjadi satu spasi, lalu lowercase', () => {
    expect(normalizePlaceName('  Bukittinggi\t\n Sumatera   Barat  ')).toBe('bukittinggi sumatera barat')
  })

  it('null, undefined, dan teks kosong menghasilkan string kosong tanpa melempar', () => {
    expect(normalizePlaceName(null)).toBe('')
    expect(normalizePlaceName(undefined)).toBe('')
    expect(normalizePlaceName('   ')).toBe('')
  })
})

describe('buildPlaceBackfillPlan - aksi', () => {
  it('event polos: satu place dibuat dengan displayName rapikan whitespace, kapital asli dipertahankan', () => {
    const plan = buildPlaceBackfillPlan([event({ placeText: '  Bandung,   Jawa Barat ' })])
    expect(plan.createPlaces).toHaveLength(1)
    expect(plan.createPlaces[0]?.displayName).toBe('Bandung, Jawa Barat')
    expect(plan.createPlaces[0]?.normalizedName).toBe('bandung, jawa barat')
    expect(plan.createPlaces[0]?.treeId).toBe('t1')
    expect(plan.linkEvents).toHaveLength(1)
    expect(plan.linkEvents[0]?.needsCreate).toBe(true)
    expect(plan.linkEvents[0]?.eventId).toBe('e1')
  })

  it('dedupe antar ejaan beda kapital dan spasi dalam satu tree: satu create, dua link', () => {
    const plan = buildPlaceBackfillPlan([
      event({ eventId: 'e1', placeText: 'Solo  Jawa Tengah' }),
      event({ eventId: 'e2', memberId: 'm2', placeText: 'solo jawa tengah' }),
    ])
    expect(plan.createPlaces).toHaveLength(1)
    // Ejaan pertama yang menyumbang displayName.
    expect(plan.createPlaces[0]?.displayName).toBe('Solo Jawa Tengah')
    expect(plan.linkEvents).toHaveLength(2)
    expect(plan.linkEvents.map((l) => l.eventId)).toEqual(['e1', 'e2'])
    expect(plan.linkEvents.every((l) => l.normalizedName === 'solo jawa tengah')).toBe(true)
  })

  it('nama yang sudah ada di existingPlaces tidak dibuat ulang: needsCreate false', () => {
    const plan = buildPlaceBackfillPlan(
      [event({ placeText: 'Bandung, Jawa Barat' })],
      [{ treeId: 't1', normalizedName: 'bandung, jawa barat', displayName: 'Bandung, Jawa Barat' }],
    )
    expect(plan.createPlaces).toHaveLength(0)
    expect(plan.linkEvents).toHaveLength(1)
    expect(plan.linkEvents[0]?.needsCreate).toBe(false)
    // Ejaan kanonikal place existing dipakai untuk laporan.
    expect(plan.linkEvents[0]?.displayName).toBe('Bandung, Jawa Barat')
  })
})

describe('buildPlaceBackfillPlan - skip', () => {
  it('event yang sudah punya placeId di-skip dengan reason already-linked', () => {
    const plan = buildPlaceBackfillPlan([
      event({ eventId: 'e1', existingPlaceId: 'place-1' }),
      event({ eventId: 'e2', placeText: 'Solo' }),
    ])
    expect(plan.createPlaces).toHaveLength(1)
    expect(plan.linkEvents.map((l) => l.eventId)).toEqual(['e2'])
    expect(plan.skips).toHaveLength(1)
    expect(plan.skips[0]).toMatchObject({ eventId: 'e1', reason: 'already-linked' })
  })

  it('place kosong atau whitespace di-skip dengan reason empty-place', () => {
    const plan = buildPlaceBackfillPlan([
      event({ eventId: 'e1', placeText: '' }),
      event({ eventId: 'e2', placeText: '   ' }),
    ])
    expect(plan.createPlaces).toHaveLength(0)
    expect(plan.linkEvents).toHaveLength(0)
    expect(plan.skips.map((s) => s.reason)).toEqual(['empty-place', 'empty-place'])
  })

  it('null safety: placeText null/undefined dan existingPlaceId null/undefined tidak melempar', () => {
    const plan = buildPlaceBackfillPlan([
      event({ eventId: 'e1', placeText: null, existingPlaceId: null }),
      event({ eventId: 'e2', placeText: undefined, existingPlaceId: undefined }),
    ])
    expect(plan.createPlaces).toHaveLength(0)
    expect(plan.linkEvents).toHaveLength(0)
    expect(plan.skips.map((s) => s.reason)).toEqual(['empty-place', 'empty-place'])
  })
})

describe('buildPlaceBackfillPlan - idempotensi dan multi-tree', () => {
  it('dipanggil dua kali dengan input sama: hasil rencana identik (murni)', () => {
    const input = [event(), event({ eventId: 'e2', memberId: 'm2', placeText: 'solo jawa tengah' })]
    const first = buildPlaceBackfillPlan(input)
    const second = buildPlaceBackfillPlan(input)
    expect(second).toEqual(first)
  })

  it('pass kedua setelah link terisi dan place tercatat: nol create, nol link, semua skip', () => {
    const input = [event({ placeText: 'Bandung, Jawa Barat' })]
    const first = buildPlaceBackfillPlan(input)

    // Simulasi run pertama selesai: place dibuat dan setiap event terlink.
    const created = first.createPlaces.map((p) => ({
      treeId: p.treeId,
      normalizedName: p.normalizedName,
      displayName: p.displayName,
    }))
    const linked = input.map((e) => ({
      ...e,
      existingPlaceId: `place-${e.eventId}`,
    }))

    const second = buildPlaceBackfillPlan(linked, created)
    expect(second.createPlaces).toHaveLength(0)
    expect(second.linkEvents).toHaveLength(0)
    expect(second.skips).toHaveLength(1)
    expect(second.skips[0]?.reason).toBe('already-linked')
  })

  it('multi-tree terpisah: nama sama di dua tree menghasilkan dua createPlaces', () => {
    const plan = buildPlaceBackfillPlan([
      event({ eventId: 'e1', treeId: 't1', placeText: 'Yogyakarta' }),
      event({ eventId: 'e2', treeId: 't2', placeText: 'yogyakarta' }),
    ])
    expect(plan.createPlaces).toHaveLength(2)
    expect(plan.createPlaces.map((p) => p.treeId)).toEqual(['t1', 't2'])
    expect(plan.linkEvents.every((l) => l.needsCreate)).toBe(true)
    expect(plan.skips).toHaveLength(0)
  })
})
