import { describe, expect, it } from 'vitest'
import type {
  FamilyMemberRecord,
  MemberRelationship,
} from '../adapters/types'
import {
  buildTreeJsonExport,
  TREE_JSON_EXPORT_SCHEMA_VERSION,
  type MemberExport,
} from './treeJsonExport'

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
  member({ id: 'm2', name: 'Siti Aminah', gender: 'female', isAlive: false, deathDate: '2020-05-05' }),
  member({ id: 'm1' }),
  member({ id: 'm3', name: 'Anak Dimuka', privacyStatus: 'shared' }),
  member({ id: 'm4', name: 'Rahasia Keluarga', privacyStatus: 'private' }),
  member({ id: 'm5', name: 'Tanpa Tanda', privacyStatus: undefined }),
]

const FIXTURE_RELATIONSHIPS: MemberRelationship[] = [
  { id: 'r2', treeId: 't1', memberId: 'm1', relatedId: 'm2', type: 'child' },
  { id: 'r1', treeId: 't1', memberId: 'm2', relatedId: 'm1', type: 'spouse' },
]

const FIXED_AT = new Date('2026-10-26T00:00:00.000Z')

describe('buildTreeJsonExport', () => {
  it('schemaVersion terkunci stemmagraph-tree-export/1', () => {
    const doc = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
    })
    expect(doc.schemaVersion).toBe(TREE_JSON_EXPORT_SCHEMA_VERSION)
    expect(doc.schemaVersion).toBe('stemmagraph-tree-export/1')
  })

  it('deterministik: dua panggilan input sama hasil string identik', () => {
    const a = buildTreeJsonExport({
      members: [...FIXTURE_MEMBERS].reverse(),
      relationships: [...FIXTURE_RELATIONSHIPS].reverse(),
      exportedAt: FIXED_AT,
    })
    const b = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
    })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('mode clean: anggota hidup tanpa consent shared direduksi tapi id dan generation bertahan', () => {
    const doc = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
    })
    const byId = new Map(doc.members.map((m) => [m.id, m]))
    const redacted = byId.get('m4')
    expect(redacted?.redacted).toBe(true)
    if (redacted?.redacted) {
      expect(redacted.name).toBe('[Living]')
      expect(redacted).not.toHaveProperty('email')
      expect(redacted).not.toHaveProperty('phone')
      expect(redacted).not.toHaveProperty('notes')
      expect(redacted).not.toHaveProperty('birthDate')
      expect(redacted.generation).toBe(2)
    }
    const unknownConsent = byId.get('m5')
    expect(unknownConsent?.redacted).toBe(true)
  })

  it('mode clean: mendiang dan consent shared diekspor penuh', () => {
    const doc = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
    })
    const byId = new Map(doc.members.map((m) => [m.id, m]))
    expect(byId.get('m2')?.redacted).toBe(false)
    expect(byId.get('m3')?.redacted).toBe(false)
    const full = byId.get('m2')
    if (!full?.redacted) {
      expect(full.name).toBe('Siti Aminah')
      expect(full.deathDate).toBe('2020-05-05')
    }
  })

  it('mode full: gate tidak menyaring apa pun', () => {
    const doc = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
      privacyMode: 'full',
    })
    expect(doc.privacy.mode).toBe('full')
    expect(doc.members.every((m) => !m.redacted)).toBe(true)
    const byId = new Map(doc.members.map((m) => [m.id, m]))
    expect(byId.get('m4')?.redacted).toBe(false)
  })

  it('laporan privasi berasal dari gate yang sama dengan jalur GEDCOM', () => {
    const doc = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
    })
    expect(doc.privacy.mode).toBe('clean')
    expect(doc.privacy.total).toBe(5)
    expect(doc.privacy.livingFull + doc.privacy.livingRedacted + doc.privacy.deceased).toBe(5)
    // m2 deceased; m3 living full (shared); m1 m4 m5 living redacted.
    expect(doc.privacy.deceased).toBe(1)
    expect(doc.privacy.livingFull).toBe(1)
    expect(doc.privacy.livingRedacted).toBe(3)
  })

  it('urutan stabil: members dan relationships terurut id naik', () => {
    const doc = buildTreeJsonExport({
      members: FIXTURE_MEMBERS,
      relationships: FIXTURE_RELATIONSHIPS,
      exportedAt: FIXED_AT,
    })
    const ids = doc.members.map((m) => m.id)
    expect(ids).toEqual([...ids].sort())
    const relIds = doc.relationships.map((r) => r.id)
    expect(relIds).toEqual(['r1', 'r2'])
  })

  it('exportedAt diserialisasi ISO dan timestamps DB tidak ikut', () => {
    const doc = buildTreeJsonExport({
      members: [member({ createdAt: '2000-01-01T00:00:00.000Z', updatedAt: '2000-01-02T00:00:00.000Z' })],
      relationships: [],
      exportedAt: FIXED_AT,
      privacyMode: 'full',
    })
    expect(doc.exportedAt).toBe('2026-10-26T00:00:00.000Z')
    const first = doc.members[0] as Exclude<MemberExport, { redacted: true }>
    expect(first).not.toHaveProperty('createdAt')
    expect(first).not.toHaveProperty('updatedAt')
  })

  it('tree identity block diteruskan bila diberikan', () => {
    const doc = buildTreeJsonExport({
      members: [],
      relationships: [],
      exportedAt: FIXED_AT,
      tree: { id: 't1', name: 'Keluarga Besar' },
    })
    expect(doc.tree).toEqual({ id: 't1', name: 'Keluarga Besar' })
  })

  it('dokumen kosong tetap valid', () => {
    const doc = buildTreeJsonExport({
      members: [],
      relationships: [],
      exportedAt: FIXED_AT,
    })
    expect(doc.members).toEqual([])
    expect(doc.relationships).toEqual([])
    expect(doc.privacy.total).toBe(0)
  })
})
