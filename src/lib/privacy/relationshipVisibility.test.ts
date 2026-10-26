/**
 * Test unit filter relasi viewer v412 fase 1 (modul pure).
 * Kontrak: relasi dua ujung hidden dibuang, campuran full dan hidden
 * hanya membuang busur yang menyentuh hidden, name-only lolos, daftar
 * kosong tetap kosong, deterministik dua panggilan, fail closed untuk
 * ujung absen dari peta, urutan output mengikuti input.
 */
import { describe, expect, it } from 'vitest';
import { filterRelationshipsForViewer } from './relationshipVisibility';

interface Rel {
  memberId: string;
  relatedId: string;
}

describe('filterRelationshipsForViewer v412 fase 1', () => {
  it('relasi dua ujung hidden: dibuang', () => {
    const out = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: { a: 'hidden', b: 'hidden' },
      relationships: [{ memberId: 'a', relatedId: 'b' }],
    });
    expect(out).toEqual([]);
  });

  it('campuran full dan hidden: hanya busur penyentuh hidden dibuang', () => {
    const rels: Rel[] = [
      { memberId: 'v', relatedId: 'h1' },
      { memberId: 'h1', relatedId: 'h2' },
      { memberId: 'v', relatedId: 'd' },
      { memberId: 'd', relatedId: 's' },
    ];
    const out = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: {
        v: 'full',
        h1: 'hidden',
        h2: 'hidden',
        d: 'full',
        s: 'name-only',
      },
      relationships: rels,
    });
    expect(out.map((r) => [r.memberId, r.relatedId])).toEqual([
      ['v', 'd'],
      ['d', 's'],
    ]);
  });

  it('ujung name-only tetap lolos: yang dilindungi hanya hidden', () => {
    const out = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: { n1: 'name-only', n2: 'name-only', f: 'full' },
      relationships: [
        { memberId: 'n1', relatedId: 'n2' },
        { memberId: 'f', relatedId: 'n1' },
      ],
    });
    expect(out).toHaveLength(2);
  });

  it('daftar relasi kosong: hasil kosong', () => {
    const out = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: { a: 'full' },
      relationships: [],
    });
    expect(out).toEqual([]);
  });

  it('ujung absen dari peta: dibuang, fail closed', () => {
    const out = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: { a: 'full' },
      relationships: [
        { memberId: 'a', relatedId: 'tak-terdata' },
        { memberId: 'juga-tak-terdata', relatedId: 'a' },
      ],
    });
    expect(out).toEqual([]);
  });

  it('determinisme: dua panggilan input sama hasil identik', () => {
    const rels: Rel[] = [
      { memberId: 'a', relatedId: 'b' },
      { memberId: 'b', relatedId: 'c' },
      { memberId: 'c', relatedId: 'h' },
    ];
    const map = { a: 'full', b: 'name-only', c: 'full', h: 'hidden' } as const;
    const first = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: map,
      relationships: rels,
    });
    const second = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: map,
      relationships: rels,
    });
    expect(first).toEqual(second);
    expect(first.map((r) => [r.memberId, r.relatedId])).toEqual([
      ['a', 'b'],
      ['b', 'c'],
    ]);
  });

  it('urutan output mengikuti urutan input tanpa penyusunan ulang', () => {
    const rels: Rel[] = [
      { memberId: 'z', relatedId: 'y' },
      { memberId: 'a', relatedId: 'c' },
    ];
    const out = filterRelationshipsForViewer<Rel>({
      visibilityByMemberId: { z: 'full', y: 'full', a: 'full', c: 'full' },
      relationships: rels,
    });
    expect(out.map((r) => r.memberId)).toEqual(['z', 'a']);
  });
});
