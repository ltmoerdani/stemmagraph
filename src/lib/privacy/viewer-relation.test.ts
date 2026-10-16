import { describe, expect, it } from 'vitest'
import { resolveViewerRelation } from './viewer-relation'

/**
 * v261-i privacy read wiring: resolusi relasi viewer berbasis email.
 * Aturan: email match target = self; spouse = partner dua arah; parent
 * dan child mengikuti arah baris (memberId orang tua dari relatedId);
 * sibling simetris; nilai type tak dikenal diabaikan; email kosong,
 * nihil match, atau ambigu = other (konservatif).
 */

const members = [
  { id: 'viewer', email: 'VIEWER@Example.com' },
  { id: 'target', email: 'target@example.com' },
  { id: 'stranger', email: 'stranger@example.com' },
  { id: 'dup1', email: 'dup@example.com' },
  { id: 'dup2', email: 'dup@example.com' },
]

function rel(memberId: string, type: string, relatedId: string) {
  return { memberId, relatedId, type }
}

describe('viewer-relation resolveViewerRelation (v261-i)', () => {
  it('1. self: email viewer match target yang sama', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [], targetMemberId: 'viewer' }),
    ).toBe('self')
  })

  it('2. partner: type spouse dipetakan partner, simetris dua arah', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('viewer', 'spouse', 'target')], targetMemberId: 'target' }),
    ).toBe('partner')
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('target', 'spouse', 'viewer')], targetMemberId: 'target' }),
    ).toBe('partner')
  })

  it('3. child: baris type child dengan memberId viewer berarti viewer anak dari target', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('viewer', 'child', 'target')], targetMemberId: 'target' }),
    ).toBe('child')
  })

  it('4. parent: arah baris terbalik, type child dengan relatedId viewer berarti viewer orang tua dari target', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('target', 'child', 'viewer')], targetMemberId: 'target' }),
    ).toBe('parent')
  })

  it('5. parent: type parent dengan memberId viewer berarti viewer orang tua dari target', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('viewer', 'parent', 'target')], targetMemberId: 'target' }),
    ).toBe('parent')
  })

  it('6. sibling: type sibling simetris', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('viewer', 'sibling', 'target')], targetMemberId: 'target' }),
    ).toBe('sibling')
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('target', 'sibling', 'viewer')], targetMemberId: 'target' }),
    ).toBe('sibling')
  })

  it('7. other: viewer tidak match anggota mana pun', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'ghost@example.com', members, relationships: [], targetMemberId: 'target' }),
    ).toBe('other')
  })

  it('8. other: email kosong atau null konservatif', () => {
    expect(resolveViewerRelation({ viewerEmail: '', members, relationships: [], targetMemberId: 'target' })).toBe('other')
    expect(resolveViewerRelation({ viewerEmail: null, members, relationships: [], targetMemberId: 'target' })).toBe('other')
  })

  it('9. other: email ambigu, dua anggota ber-email sama', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'dup@example.com', members, relationships: [], targetMemberId: 'target' }),
    ).toBe('other')
  })

  it('10. other: nilai type asing diabaikan, nihil relasi dikenali', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('viewer', 'grandparent', 'target'), rel('viewer', 'caretaker', 'target')], targetMemberId: 'target' }),
    ).toBe('other')
  })

  it('11. prioritas: partner menang saat beberapa relasi menghubungkan viewer dan target', () => {
    expect(
      resolveViewerRelation({ viewerEmail: 'viewer@example.com', members, relationships: [rel('viewer', 'sibling', 'target'), rel('viewer', 'spouse', 'target'), rel('viewer', 'parent', 'target')], targetMemberId: 'target' }),
    ).toBe('partner')
  })

  it('12. normalisasi: email dicocokkan case-insensitive dan trim', () => {
    expect(
      resolveViewerRelation({ viewerEmail: '  Viewer@EXAMPLE.com ', members, relationships: [], targetMemberId: 'viewer' }),
    ).toBe('self')
  })
})
