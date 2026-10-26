import { describe, expect, it } from 'vitest'
import type { FamilyMemberRecord } from '../adapters/types'
import {
  buildPhotoZipManifest,
  DEFAULT_MAX_AGGREGATE_BYTES,
  PHOTO_ZIP_EXPORT_SCHEMA_VERSION,
} from './photoZipExport'
import { unzipSync } from 'fflate'

function member(overrides: Partial<FamilyMemberRecord>): FamilyMemberRecord {
  return {
    id: 'm1',
    treeId: 't1',
    name: 'Budi Santoso',
    birthDate: '1970-01-01',
    gender: 'male',
    isAlive: true,
    generation: 2,
    maritalStatus: 'married',
    ...overrides,
  }
}

const FIXTURE_MEMBERS: FamilyMemberRecord[] = [
  member({ id: 'm2', name: 'Siti Aminah', gender: 'female', isAlive: false, deathDate: '2020-05-05', photoUrl: '/api/v1/members/m2/photo?f=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jpg' }),
  member({ id: 'm1', photoUrl: '/api/v1/members/m1/photo?f=11111111-2222-3333-4444-555555555555.jpg' }),
  member({ id: 'm3', name: 'Anak Dimuka', privacyStatus: 'shared', photoUrl: '/api/v1/members/m3/photo?f=66666666-7777-8888-9999-000000000000.webp' }),
  member({ id: 'm4', name: 'Rahasia Keluarga', privacyStatus: 'private', photoUrl: '/api/v1/members/m4/photo?f=99999999-aaaa-bbbb-cccc-dddddddddddd.png' }),
  member({ id: 'm5', name: 'Tanpa Foto', privacyStatus: undefined }),
]

const FIXED_AT = new Date('2026-10-26T00:00:00.000Z')

function photoBytes(seed: number, size: number = 8): Uint8Array {
  const bytes = new Uint8Array(size)
  for (let i = 0; i < size; i += 1) bytes[i] = (seed + i) % 256
  return bytes
}

function fixturePhotos(): Map<string, Uint8Array> {
  return new Map([
    ['m1', photoBytes(1)],
    ['m2', photoBytes(2)],
    ['m3', photoBytes(3)],
    // m4 sengaja tidak ada di map: simulasi file hilang di disk
  ])
}

describe('buildPhotoZipManifest (v403 AC1)', () => {
  it('schemaVersion terkunci stemmagraph-photo-export/1', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.manifest.schemaVersion).toBe(PHOTO_ZIP_EXPORT_SCHEMA_VERSION)
    expect(result.manifest.schemaVersion).toBe('stemmagraph-photo-export/1')
  })

  it('deterministik: dua panggilan input sama menghasilkan bytes zip identik', () => {
    const a = buildPhotoZipManifest({
      members: [...FIXTURE_MEMBERS].reverse(),
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
    })
    const b = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
    })
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(Buffer.from(a.zip).equals(Buffer.from(b.zip))).toBe(true)
  })

  it('mode clean: penyaringan berasal dari exportPrivacyGate (hidup private/tanpa consent direduksi)', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    // m2 mendiang, m3 shared: masuk. m1 hidup tanpa flag: direduksi.
    // m4 hidup private: direduksi.
    const exportedIds = result.manifest.exported.map((e) => e.memberId)
    expect(exportedIds).toEqual(['m2', 'm3'])
    const redactedIds = result.manifest.skipped
      .filter((s) => s.reason === 'redacted')
      .map((s) => s.memberId)
    // m5 juga direduksi: cek gate lebih dulu sebelum cek foto.
    expect(redactedIds).toEqual(['m1', 'm4', 'm5'])
    expect(result.manifest.privacy.mode).toBe('clean')
    expect(result.manifest.privacy.livingRedacted).toBe(3)
    expect(result.manifest.privacy.deceased).toBe(1)
  })

  it('mode clean: anggota hidup consent shared tetap diekspor', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const m3 = result.manifest.exported.find((e) => e.memberId === 'm3')
    expect(m3).toBeDefined()
    expect(m3?.filename).toBe('photos/m3.webp')
  })

  it('mode full: gate tidak menyaring apa pun, hanya file yang benar-benar hilang yang di-skip', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
      privacyMode: 'full',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const exportedIds = result.manifest.exported.map((e) => e.memberId)
    expect(exportedIds).toEqual(['m1', 'm2', 'm3'])
    // m4 punya pointer foto tapi bytes tidak tersedia: skip jujur.
    const missing = result.manifest.skipped.find((s) => s.memberId === 'm4')
    expect(missing?.reason).toBe('file_not_found')
    const noPhoto = result.manifest.skipped.find((s) => s.memberId === 'm5')
    expect(noPhoto?.reason).toBe('missing_photo')
  })

  it('entry name deterministik berbasis id + manifest.json di akar arsip', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
      privacyMode: 'full',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const unzipped = unzipSync(result.zip)
    const names = Object.keys(unzipped).sort()
    expect(names).toContain('manifest.json')
    expect(names).toContain('photos/m1.jpg')
    expect(names).toContain('photos/m2.jpg')
    expect(names).toContain('photos/m3.webp')
    const manifest = JSON.parse(new TextDecoder().decode(unzipped['manifest.json'])) as {
      schemaVersion: string
    }
    expect(manifest.schemaVersion).toBe('stemmagraph-photo-export/1')
  })

  it('batas agregat: melewati bound menghasilkan AGGREGATE_LIMIT tanpa zip', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
      maxAggregateBytes: 10,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('AGGREGATE_LIMIT')
    expect(result.limitBytes).toBe(10)
    expect(result.totalBytes).toBeGreaterThan(10)
  })

  it('guard agregat tidak termasuk foto yang direduksi di mode clean', () => {
    const result = buildPhotoZipManifest({
      members: FIXTURE_MEMBERS,
      photos: fixturePhotos(),
      exportedAt: FIXED_AT,
      maxAggregateBytes: DEFAULT_MAX_AGGREGATE_BYTES,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const total = result.manifest.exported.reduce((acc, e) => acc + e.sizeBytes, 0)
    expect(total).toBe(16) // m2 mendiang + m3 shared, 8 bytes per foto
  })
})
