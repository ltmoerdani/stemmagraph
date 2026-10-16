import { describe, expect, it } from 'vitest'
import {
  resolveRelationshipVisibility,
  type RelationshipVisibility,
  type ViewerRelation,
} from './relationship-privacy'

/**
 * v260-STG-RELATIONSHIP-PRIVACY fase i (PURE).
 * Aturan resolusi: self > deceased > consent shared > relasi inti
 * name-only > sisanya hidden. Safe default konsisten living-privacy.ts
 * dan exportPrivacyGate.ts. Fase i tanpa wiring.
 */

describe('relationship-privacy resolveRelationshipVisibility (v260 fase i)', () => {
  it('1. aturan 1: self SELALU full, bahkan saat private dan hidup', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'self', privacyStatus: 'private', isAlive: true }),
    ).toBe<RelationshipVisibility>('full')
  })

  it('2. aturan 1 kasus batas: self SELALU full juga saat privacyStatus nihil', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'self', privacyStatus: null, isAlive: true }),
    ).toBe('full')
  })

  it('3. aturan 2: deceased SELALU full menang atas private', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'other', privacyStatus: 'private', isAlive: false }),
    ).toBe('full')
  })

  it('4. aturan 2 kasus batas: deceased menang atas viewerRelation other apa pun statusnya', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'sibling', isAlive: false }),
    ).toBe('full')
  })

  it('5. aturan 3: consent shared SELALU full pada living non-self', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'sibling', privacyStatus: 'shared', isAlive: true }),
    ).toBe('full')
  })

  it('6. aturan 3: consent shared menang atas sibling hidden dan other hidden', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'other', privacyStatus: 'shared', isAlive: true }),
    ).toBe('full')
  })

  it('7. aturan 4: living private ke partner = name-only', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'partner', privacyStatus: 'private', isAlive: true }),
    ).toBe('name-only')
  })

  it('8. aturan 4: living private ke child = name-only', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'child', privacyStatus: 'private', isAlive: true }),
    ).toBe('name-only')
  })

  it('9. aturan 4: living private ke parent = name-only', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'parent', privacyStatus: 'private', isAlive: true }),
    ).toBe('name-only')
  })

  it('10. aturan 4: living private ke sibling = hidden (sibling TIDAK inti fase i)', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'sibling', privacyStatus: 'private', isAlive: true }),
    ).toBe('hidden')
  })

  it('11. aturan 4: living private ke other = hidden', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'other', privacyStatus: 'private', isAlive: true }),
    ).toBe('hidden')
  })

  it('12. aturan 5: living privacyStatus null diperlakukan private, hasil name-only utk partner', () => {
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'partner', privacyStatus: null, isAlive: true }),
    ).toBe('name-only')
  })

  it('13. aturan 5 dan 6: living tanpa status dan status tak dikenal diperlakukan private', () => {
    // undefined (absen) jatuh ke jalur private.
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'child', isAlive: true }),
    ).toBe('name-only')
    // Nilai tak dikenal dipaksa tipe any untuk membuktikan jalur runtime.
    const unknown = 'classified' as unknown as ViewerRelation
    expect(
      resolveRelationshipVisibility({ viewerRelation: 'partner', privacyStatus: 'classified' as unknown as 'shared' | 'private' | null, isAlive: true }),
    ).toBe('name-only')
    expect(unknown).toBe('classified')
  })
})
