// Unit test pure rencana merge import GEDCOM (v373 GAP #2): remap xref
// masuk ke ID internal @M<n>@ tanpa tabrakan, peta xrefMap dan remap
// pointer, prioritas pencocokan durable EXID bertipe lalu UID lalu
// REFN dengan hasil kandidat tanpa auto-merge, input rusak masuk
// skipped tanpa melempar, ekstraksi identitas durable dari baris
// record mentah, dan determinisme pemanggilan ulang. Tanpa DB, tanpa
// I/O, tanpa Date.

import { describe, expect, it } from 'vitest'
import {
  buildMergePlan,
  extractDurableIdentity,
  firstPreferred,
  remapPointer,
} from './importMergePlan'
import type { IncomingRecord, ExistingIdentityIndex } from './importMergePlan'

function existingIndex(overrides: Partial<ExistingIdentityIndex> = {}): ExistingIdentityIndex {
  return {
    byExid: {},
    byUid: {},
    byRefn: {},
    usedIds: [],
    startCounter: 1,
    ...overrides,
  }
}

describe('buildMergePlan remap xref', () => {
  it('semua xref masuk dapat ID internal baru @M<n>@ berurutan tanpa tabrakan', () => {
    const incoming: IncomingRecord[] = [
      { source: 'INDI', xref: 'I1' },
      { source: 'INDI', xref: 'I2' },
      { source: 'FAM', xref: 'F1' },
    ]
    const plan = buildMergePlan(incoming, existingIndex())
    expect(plan.entries.map((e) => e.newInternalId)).toEqual(['@M1@', '@M2@', '@M3@'])
    expect(plan.xrefMap).toEqual({ I1: '@M1@', I2: '@M2@', F1: '@M3@' })
    expect(plan.entries.every((e) => e.status === 'NEW')).toBe(true)
  })

  it('startCounter non-1 dipakai sebagai nomor awal ID baru', () => {
    const incoming: IncomingRecord[] = [
      { source: 'INDI', xref: 'I1' },
      { source: 'INDI', xref: 'I2' },
    ]
    const plan = buildMergePlan(incoming, existingIndex({ startCounter: 5 }))
    expect(plan.xrefMap).toEqual({ I1: '@M5@', I2: '@M6@' })
  })

  it('usedIds existing dihormati, ID baru melompat sampai bebas tabrakan', () => {
    const incoming: IncomingRecord[] = [{ source: 'INDI', xref: 'I1' }]
    const plan = buildMergePlan(
      incoming,
      existingIndex({ usedIds: ['@M1@', '@M2@', '@M3@'] }),
    )
    expect(plan.xrefMap).toEqual({ I1: '@M4@' })
  })

  it('kecocokan durable tidak mengubah remap: xref tetap dapat ID baru', () => {
    const incoming: IncomingRecord[] = [
      { source: 'INDI', xref: 'I1', uid: 'UID-SAMA' },
    ]
    const plan = buildMergePlan(
      incoming,
      existingIndex({ byUid: { 'UID-SAMA': 'internal-77' } }),
    )
    expect(plan.xrefMap).toEqual({ I1: '@M1@' })
    expect(plan.entries[0]?.newInternalId).toBe('@M1@')
  })

  it('xref dengan spasi di trim saat masuk xrefMap', () => {
    const plan = buildMergePlan(
      [{ source: 'INDI', xref: '  I9  ' }],
      existingIndex(),
    )
    expect(plan.xrefMap).toEqual({ I9: '@M1@' })
  })
})

describe('remapPointer', () => {
  it('pointer terdaftar dipetakan ke ID internal baru', () => {
    const map = { I1: '@M1@', F1: '@M3@' }
    expect(remapPointer('I1', map)).toBe('@M1@')
    expect(remapPointer('F1', map)).toBe('@M3@')
  })

  it('pointer tak terdaftar kembali apa adanya, tidak difabrikasi', () => {
    const map = { I1: '@M1@' }
    expect(remapPointer('UNKNOWN', map)).toBe('UNKNOWN')
  })
})

describe('prioritas pencocokan durable', () => {
  it('EXID bertipe menang atas UID dan REFN', () => {
    const plan = buildMergePlan(
      [
        {
          source: 'INDI',
          xref: 'I1',
          uid: 'UID-ADA',
          refn: 'REFN-ADA',
          exids: [{ type: 'FamilySearch ID', value: 'FS-1' }],
        },
      ],
      existingIndex({
        byExid: { 'FamilySearch ID::FS-1': 'ex-exid' },
        byUid: { 'UID-ADA': 'ex-uid' },
        byRefn: { 'REFN-ADA': 'ex-refn' },
      }),
    )
    expect(plan.entries[0]?.status).toBe('MATCH_CANDIDATE')
    expect(plan.entries[0]?.matchType).toBe('EXID')
    expect(plan.entries[0]?.matchedExistingId).toBe('ex-exid')
  })

  it('UID menang atas REFN ketika EXID tidak kena', () => {
    const plan = buildMergePlan(
      [{ source: 'INDI', xref: 'I1', uid: 'UID-ADA', refn: 'REFN-ADA' }],
      existingIndex({
        byUid: { 'UID-ADA': 'ex-uid' },
        byRefn: { 'REFN-ADA': 'ex-refn' },
      }),
    )
    expect(plan.entries[0]?.matchType).toBe('UID')
    expect(plan.entries[0]?.matchedExistingId).toBe('ex-uid')
  })

  it('REFN dipakai ketika hanya REFN yang kena', () => {
    const plan = buildMergePlan(
      [{ source: 'FAM', xref: 'F1', refn: 'REFN-ADA' }],
      existingIndex({ byRefn: { 'REFN-ADA': 'ex-refn' } }),
    )
    expect(plan.entries[0]?.matchType).toBe('REFN')
    expect(plan.entries[0]?.matchedExistingId).toBe('ex-refn')
  })

  it('kecocokan pertama dalam daftar exids yang menang', () => {
    const plan = buildMergePlan(
      [
        {
          source: 'INDI',
          xref: 'I1',
          exids: [
            { type: 'tipe-a', value: 'A-1' },
            { type: 'tipe-b', value: 'B-2' },
          ],
        },
      ],
      existingIndex({
        byExid: { 'tipe-a::A-1': 'pertama', 'tipe-b::B-2': 'kedua' },
      }),
    )
    expect(plan.entries[0]?.matchedExistingId).toBe('pertama')
  })

  it('hasil kandidat tanpa auto-merge: status hanya dari union yang ada', () => {
    const plan = buildMergePlan(
      [{ source: 'INDI', xref: 'I1', uid: 'UID-SAMA' }],
      existingIndex({ byUid: { 'UID-SAMA': 'internal-77' } }),
    )
    const statuses = new Set(plan.entries.map((e) => e.status))
    expect(statuses.has('MATCH_CANDIDATE')).toBe(true)
    expect(statuses.has('MERGED')).toBe(false)
  })

  it('EXID tanpa TYPE tidak dipakai pencocokan, status NEW', () => {
    const plan = buildMergePlan(
      [{ source: 'INDI', xref: 'I1', exids: [{ value: 'NILAI-TANPA-TIPE' }] }],
      existingIndex({
        byExid: { 'undefined::NILAI-TANPA-TIPE': 'seharusnya-dilewati' },
      }),
    )
    expect(plan.entries[0]?.status).toBe('NEW')
    expect(plan.entries[0]?.matchedExistingId).toBeUndefined()
  })

  it('EXID tanpa TYPE tetap bisa MATCH_CANDIDATE lewat jalur UID', () => {
    const plan = buildMergePlan(
      [
        {
          source: 'INDI',
          xref: 'I1',
          uid: 'UID-ADA',
          exids: [{ value: 'NILAI-TANPA-TIPE' }],
        },
      ],
      existingIndex({ byUid: { 'UID-ADA': 'ex-uid' } }),
    )
    expect(plan.entries[0]?.status).toBe('MATCH_CANDIDATE')
    expect(plan.entries[0]?.matchType).toBe('UID')
  })

  it('struktur tak dikenal ikut extensionPayloads apa adanya', () => {
    const plan = buildMergePlan(
      [{ source: 'INDI', xref: 'I1', unknownTags: ['_NEW7', '_CUSTOM'] }],
      existingIndex(),
    )
    expect(plan.entries[0]?.extensionPayloads).toEqual(['_NEW7', '_CUSTOM'])
  })
})

describe('input rusak tanpa melempar', () => {
  it('incoming bukan array menghasilkan satu entri skipped invalid-input', () => {
    const plan = buildMergePlan('bukan-array', existingIndex())
    expect(plan.entries).toHaveLength(1)
    expect(plan.entries[0]?.status).toBe('SKIPPED')
    expect(plan.entries[0]?.skipReason).toBe('invalid-input')
    expect(plan.entries[0]?.newInternalId).toBeUndefined()
    expect(plan.skipped).toHaveLength(1)
    expect(plan.xrefMap).toEqual({})
  })

  it('record null dan bukan objek masuk skipped invalid-record, tetap di entries', () => {
    const plan = buildMergePlan(
      [null, undefined, 42, { source: 'INDI', xref: 'I1' }],
      existingIndex(),
    )
    expect(plan.entries).toHaveLength(4)
    expect(plan.skipped).toHaveLength(3)
    expect(plan.skipped.every((e) => e.skipReason === 'invalid-record')).toBe(true)
    expect(plan.entries[3]?.status).toBe('NEW')
    expect(plan.entries[3]?.newInternalId).toBe('@M1@')
  })

  it('source asing masuk skipped unknown-source dengan xref tercatat', () => {
    const plan = buildMergePlan(
      [{ source: 'NOTE', xref: 'N1' } as unknown as IncomingRecord],
      existingIndex(),
    )
    expect(plan.entries[0]?.status).toBe('SKIPPED')
    expect(plan.entries[0]?.skipReason).toBe('unknown-source')
    expect(plan.entries[0]?.incomingXref).toBe('N1')
    expect(plan.skipped).toHaveLength(1)
  })

  it('kombinasi ekstrem tidak pernah melempar', () => {
    expect(() => buildMergePlan(undefined, existingIndex())).not.toThrow()
    expect(() => buildMergePlan(null, existingIndex())).not.toThrow()
    expect(() => buildMergePlan(12345, existingIndex())).not.toThrow()
    expect(() => buildMergePlan({}, existingIndex())).not.toThrow()
  })
})

describe('extractDurableIdentity', () => {
  it('UID level 1 dan REFN level 1 terekstrak dari baris record', () => {
    const identity = extractDurableIdentity([
      '0 @I1@ INDI',
      '1 NAME John /Doe/',
      '1 UID 4444-AAAA-BBBB',
      '1 REFN R-2026-01',
      '1 SEX M',
    ])
    expect(identity.uid).toBe('4444-AAAA-BBBB')
    expect(identity.refn).toBe('R-2026-01')
    expect(identity.exids).toEqual([])
  })

  it('EXID level 1 dengan TYPE level 2 subordinate menghasilkan exid bertipe', () => {
    const identity = extractDurableIdentity([
      '0 @I1@ INDI',
      '1 EXID FS-123',
      '2 TYPE FamilySearch ID',
    ])
    expect(identity.exids).toEqual([
      { value: 'FS-123', type: 'FamilySearch ID' },
    ])
  })

  it('EXID tanpa TYPE tetap terekstrak dengan type undefined', () => {
    const identity = extractDurableIdentity(['1 EXID TANPA-TIPE'])
    expect(identity.exids).toEqual([{ value: 'TANPA-TIPE', type: undefined }])
  })

  it('pendingExidType direset setelah tiap EXID, tidak bocor ke EXID berikut', () => {
    const identity = extractDurableIdentity([
      '1 EXID A-1',
      '2 TYPE tipe-a',
      '1 EXID B-1',
      '2 TYPE tipe-b',
      '1 EXID C-1',
    ])
    expect(identity.exids).toEqual([
      { value: 'A-1', type: 'tipe-a' },
      { value: 'B-1', type: 'tipe-b' },
      { value: 'C-1', type: undefined },
    ])
  })

  it('baris rusak dilewati tanpa melempar: level bukan angka, token kurang, elemen non string', () => {
    const identity = extractDurableIdentity([
      'BUKAN ANGKA',
      '1',
      42,
      null,
      '1 UID UID-VALID',
    ])
    expect(identity.uid).toBe('UID-VALID')
    expect(identity.exids).toEqual([])
    expect(() => extractDurableIdentity(['x', 1, null])).not.toThrow()
  })

  it('input bukan array menghasilkan identitas kosong', () => {
    expect(extractDurableIdentity('bukan-array')).toEqual({ exids: [] })
    expect(extractDurableIdentity(null)).toEqual({ exids: [] })
    expect(extractDurableIdentity(undefined)).toEqual({ exids: [] })
  })
})

describe('firstPreferred', () => {
  it('nilai pertama yang terisi menang, undefined dan null dilewati', () => {
    expect(firstPreferred([undefined, null, 'ketiga', 'keempat'])).toBe('ketiga')
    expect(firstPreferred(['pertama', 'kedua'])).toBe('pertama')
    expect(firstPreferred([undefined, 2, 3])).toBe(2)
  })

  it('semua kosong menghasilkan undefined', () => {
    expect(firstPreferred([undefined, null])).toBeUndefined()
    expect(firstPreferred([])).toBeUndefined()
  })
})

describe('determinisme', () => {
  it('buildMergePlan dipanggil ulang dengan input sama hasil identik', () => {
    const incoming: IncomingRecord[] = [
      { source: 'INDI', xref: 'I1', uid: 'U1', exids: [{ type: 't', value: 'V' }] },
      { source: 'FAM', xref: 'F1', refn: 'R1' },
      null,
      { source: 'INDI', xref: 'I2', unknownTags: ['_X'] },
    ]
    const idx = existingIndex({
      byExid: { 't::V': 'ex-1' },
      byUid: { U1: 'ex-2' },
      byRefn: { R1: 'ex-3' },
      usedIds: ['@M9@'],
      startCounter: 8,
    })
    const first = buildMergePlan(incoming, existingIndex({
      byExid: { 't::V': 'ex-1' },
      byUid: { U1: 'ex-2' },
      byRefn: { R1: 'ex-3' },
      usedIds: ['@M9@'],
      startCounter: 8,
    }))
    const second = buildMergePlan(incoming, idx)
    expect(JSON.stringify(second)).toBe(JSON.stringify(first))
    expect(second.xrefMap).toEqual({ I1: '@M8@', F1: '@M10@', I2: '@M11@' })
  })

  it('extractDurableIdentity dipanggil ulang dengan input sama hasil identik', () => {
    const lines = ['1 UID U-1', '1 EXID E-1', '2 TYPE t-1', '1 REFN R-1']
    expect(JSON.stringify(extractDurableIdentity(lines))).toBe(
      JSON.stringify(extractDurableIdentity(lines)),
    )
  })
})
