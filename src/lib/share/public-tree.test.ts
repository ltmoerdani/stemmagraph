// Test payload publik share link (ADR 0010, guard utama).
//
// Invariant yang dibuktikan di sini:
// 1. Data orang hidup TIDAK bocor: anggota hidup tanpa consent (atau
//    consent selain 'shared') hanya menyisakan id, generation, dan
//    visible false. Seluruh nilai pribadinya (nama, tanggal, tempat,
//    pekerjaan, kontak, catatan) tidak ada di serialisasi JSON payload.
// 2. Default aman gerbang fase 1 dipertahankan: privacyStatus NULL atau
//    tak dikenal jatuh ke redact, data tidak lengkap dihitung hidup.
// 3. Topologi dipertahankan: relationships tetap utuh, anggota redact
//    masih dirujuk lewat id, dan ringkasan selalu konsisten.

import { describe, expect, it } from 'vitest'
import {
  buildPublicTreePayload,
  type ShareSourceMember,
  type ShareSourceRelationship,
} from './public-tree'

const LIVING_PRIVATE = {
  id: 'mem-living-private',
  name: 'Budi Livingprivate',
  nickname: 'Budi',
  birthDate: '1990-04-12',
  birthPlace: 'Bandung',
  profession: 'Engineer',
  education: 'S1',
  gender: 'male',
  isAlive: true,
  privacyStatus: null,
  generation: 2,
  // Field kontak dan catatan sengaja diisi untuk membuktikan tidak
  // pernah sampai ke payload (server memang tidak meneruskannya).
  email: 'budi@contoh.id',
  phone: '+628110000111',
  notes: 'catatan pribadi keluarga',
  currentLocation: 'Jakarta Selatan',
} as unknown as ShareSourceMember

const LIVING_SHARED: ShareSourceMember = {
  id: 'mem-living-shared',
  name: 'Sari Livingshared',
  birthDate: '1985-09-30',
  gender: 'female',
  isAlive: true,
  privacyStatus: 'shared',
  generation: 2,
}

const DECEASED: ShareSourceMember = {
  id: 'mem-deceased',
  name: 'Buyut Deceased',
  birthDate: '1920-01-02',
  deathDate: '2001-11-23',
  birthPlace: 'Solo',
  gender: 'male',
  isAlive: false,
  privacyStatus: null,
  generation: 1,
}

const RELATIONSHIPS: ShareSourceRelationship[] = [
  { memberId: DECEASED.id, relatedId: LIVING_SHARED.id, type: 'parent' },
  { memberId: DECEASED.id, relatedId: LIVING_PRIVATE.id, type: 'parent' },
]

function build() {
  return buildPublicTreePayload(
    { name: 'Keluarga Contoh', description: 'silsilah contoh' },
    [DECEASED, LIVING_SHARED, LIVING_PRIVATE],
    RELATIONSHIPS,
  )
}

describe('buildPublicTreePayload: orang hidup tidak bocor', () => {
  it('anggota hidup tanpa consent hanya menyisakan id, generation, visible', () => {
    const payload = build()
    const redacted = payload.members.find((m) => m.id === LIVING_PRIVATE.id)
    expect(redacted).toBeDefined()
    expect(redacted).toEqual({
      id: LIVING_PRIVATE.id,
      generation: 2,
      visible: false,
    })
  })

  it('serialisasi JSON payload tidak memuat satu pun nilai pribadi anggota hidup privat', () => {
    const serialized = JSON.stringify(build())
    for (const rahasia of [
      'Budi Livingprivate',
      'Budi',
      'budi@contoh.id',
      '+628110000111',
      'catatan pribadi keluarga',
      'Jakarta Selatan',
      'Bandung',
      'Engineer',
      '1990-04-12',
    ]) {
      expect(serialized).not.toContain(rahasia)
    }
  })

  it('kunci kontak dan catatan tidak pernah muncul di payload, siapa pun anggotanya', () => {
    const serialized = JSON.stringify(build())
    for (const kunci of ['email', 'phone', 'notes', 'currentLocation', 'maritalStatus']) {
      expect(serialized).not.toContain(`"${kunci}"`)
    }
  })

  it('hidup ber-flag private di-redact sama seperti tanpa flag', () => {
    const payload = buildPublicTreePayload(
      { name: 'T' },
      [{ ...LIVING_PRIVATE, privacyStatus: 'private' }],
      [],
    )
    expect(payload.members[0].visible).toBe(false)
    expect(payload.members[0]).not.toHaveProperty('name')
  })

  it('privacyStatus tak dikenal jatuh ke redact, tidak bisa melebarkan payload', () => {
    const payload = buildPublicTreePayload(
      { name: 'T' },
      [{ ...LIVING_PRIVATE, privacyStatus: 'shared-palsu' }],
      [],
    )
    expect(payload.members[0].visible).toBe(false)
  })

  it('hidup dengan tanggal wafat terisi tetap dihitung hidup sehingga di-redact', () => {
    const payload = buildPublicTreePayload(
      { name: 'T' },
      [{ ...LIVING_PRIVATE, deathDate: '2030-01-01' }],
      [],
    )
    expect(payload.members[0].visible).toBe(false)
  })

  it('not alive tanpa tanggal wafat dihitung hidup: tanpa consent di-redact', () => {
    const payload = buildPublicTreePayload(
      { name: 'T' },
      [{ ...DECEASED, isAlive: false, deathDate: null, privacyStatus: null }],
      [],
    )
    expect(payload.members[0].visible).toBe(false)
  })

  it('not alive tanpa tanggal wafat dengan consent shared tampil penuh, sesuai gerbang fase 1', () => {
    const payload = buildPublicTreePayload(
      { name: 'T' },
      [{ ...DECEASED, isAlive: false, deathDate: null, privacyStatus: 'shared' }],
      [],
    )
    expect(payload.members[0].visible).toBe(true)
  })
})

describe('buildPublicTreePayload: anggota penuh', () => {
  it('anggota meninggal tampil penuh tanpa perlu consent', () => {
    const payload = build()
    const full = payload.members.find((m) => m.id === DECEASED.id)
    expect(full).toMatchObject({
      id: DECEASED.id,
      visible: true,
      name: 'Buyut Deceased',
      birthDate: '1920-01-02',
      deathDate: '2001-11-23',
      birthPlace: 'Solo',
    })
  })

  it('anggota hidup ber-flag shared tampil penuh', () => {
    const payload = build()
    const full = payload.members.find((m) => m.id === LIVING_SHARED.id)
    expect(full).toMatchObject({
      id: LIVING_SHARED.id,
      visible: true,
      name: 'Sari Livingshared',
    })
  })

  it('anggota penuh tetap tanpa kunci kontak dan catatan', () => {
    const payload = build()
    for (const member of payload.members) {
      expect(member).not.toHaveProperty('email')
      expect(member).not.toHaveProperty('phone')
      expect(member).not.toHaveProperty('notes')
    }
  })
})

describe('buildPublicTreePayload: topologi dan ringkasan', () => {
  it('relationships diteruskan utuh walau salah satu sisi di-redact', () => {
    const payload = build()
    expect(payload.relationships).toEqual([
      { memberId: DECEASED.id, relatedId: LIVING_SHARED.id, type: 'parent' },
      { memberId: DECEASED.id, relatedId: LIVING_PRIVATE.id, type: 'parent' },
    ])
  })

  it('ringkasan konsisten: total = visible + redacted', () => {
    const payload = build()
    expect(payload.summary).toEqual({ total: 3, visible: 2, redacted: 1 })
    expect(payload.summary.total).toBe(payload.members.length)
    expect(payload.summary.visible + payload.summary.redacted).toBe(
      payload.summary.total,
    )
  })

  it('payload kosong tetap bentuk sah', () => {
    const payload = buildPublicTreePayload({ name: 'Kosong' }, [], [])
    expect(payload.members).toEqual([])
    expect(payload.relationships).toEqual([])
    expect(payload.summary).toEqual({ total: 0, visible: 0, redacted: 0 })
  })
})
