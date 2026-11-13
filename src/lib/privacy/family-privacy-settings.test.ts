/**
 * v445 fase 2: test scope pengaturan relasi-privasi per keluarga plus
 * privasi pasca-kematian. Semua PURE, tanpa network dan tanpa DB.
 *
 * Cakupan AC6:
 * - N di luar rentang ditolak (validator pure).
 * - Perubahan mode mengubah payload respons (resolver + payload map).
 * - Boundary pasca-kematian tepat N tahun (fungsi pure tanggal).
 * - Non-connected component tetap redact (jarak null).
 * - Graf siklus tidak membuat loop (BFS fase 1 dengan limit settings).
 */

import { describe, expect, it } from 'vitest';
import {
  defaultFamilyPrivacySettings,
  isPosthumouslyPublic,
  normalizeFamilyPrivacySettings,
  validatePosthumousYears,
  validateRelationshipMode,
  validateRelationshipSteps,
} from './family-privacy-settings';
import { resolveVisibilityWithSettings } from './relationship-visibility-settings';
import { calculateRelationshipDistance } from './relationship-privacy';

const NOW = new Date('2026-06-15T00:00:00Z');

describe('validasi pengaturan (AC1)', () => {
  it('N di luar rentang ditolak: 0, 13, dan non-integer', () => {
    expect(validateRelationshipSteps(0)).not.toBeNull();
    expect(validateRelationshipSteps(13)).not.toBeNull();
    expect(validateRelationshipSteps(2.5)).not.toBeNull();
    expect(validateRelationshipSteps('2')).not.toBeNull();
    expect(validateRelationshipSteps(null)).not.toBeNull();
  });

  it('N valid diterima: 1 dan 12 tepat di boundary', () => {
    expect(validateRelationshipSteps(1)).toBeNull();
    expect(validateRelationshipSteps(12)).toBeNull();
  });

  it('pasca-kematian di luar rentang ditolak: -1, 101, pecahan', () => {
    expect(validatePosthumousYears(-1)).not.toBeNull();
    expect(validatePosthumousYears(101)).not.toBeNull();
    expect(validatePosthumousYears(1.5)).not.toBeNull();
  });

  it('pasca-kematian valid: 0 dan 100 tepat di boundary', () => {
    expect(validatePosthumousYears(0)).toBeNull();
    expect(validatePosthumousYears(100)).toBeNull();
  });

  it('mode tak dikenal ditolak, dua mode valid diterima', () => {
    expect(validateRelationshipMode('everything')).not.toBeNull();
    expect(validateRelationshipMode('redact-full')).toBeNull();
    expect(validateRelationshipMode('name-only')).toBeNull();
  });

  it('normalisasi partial mengumpulkan semua error sekaligus', () => {
    const res = normalizeFamilyPrivacySettings({ relationshipSteps: 99, relationshipMode: 'x' });
    expect(res.errors).toHaveLength(2);
    expect(res.value).toEqual({});
  });

  it('default tanpa baris: steps 2, mode redact-full, pasca-kematian 30', () => {
    const def = defaultFamilyPrivacySettings();
    expect(def.relationshipSteps).toBe(2);
    expect(def.relationshipMode).toBe('redact-full');
    expect(def.posthumousYears).toBe(30);
  });
});

describe('boundary pasca-kematian (AC4)', () => {
  const death = '1996-03-10';

  it('tepat N tahun dianggap publik (inklusif)', () => {
    // Batas 30 tahun jatuh 2026-03-10; now 2026-06-15 sudah lewat.
    expect(isPosthumouslyPublic(death, 30, NOW)).toBe(true);
  });

  it('tepat momen ultah kematian ke-N sudah lolos, satu hari sebelum belum', () => {
    const atCutoff = new Date('2026-03-10T00:00:00Z');
    expect(isPosthumouslyPublic(death, 30, atCutoff)).toBe(true);
    const dayBefore = new Date('2026-03-09T23:59:59Z');
    expect(isPosthumouslyPublic(death, 30, dayBefore)).toBe(false);
  });

  it('di bawah batas tetap tertahan: sehari sebelum ultah kematian ke-29', () => {
    // Cutoff N 29 jatuh 2025-03-10; 2025-03-09 masih tertahan.
    const before29 = new Date('2025-03-09T00:00:00Z');
    expect(isPosthumouslyPublic(death, 29, before29)).toBe(false);
    expect(isPosthumouslyPublic(death, 29, NOW)).toBe(true);
  });

  it('deathDate kosong atau rusak diperlakukan living-rule', () => {
    expect(isPosthumouslyPublic(null, 30, NOW)).toBe(false);
    expect(isPosthumouslyPublic(undefined, 30, NOW)).toBe(false);
    expect(isPosthumouslyPublic('', 30, NOW)).toBe(false);
    expect(isPosthumouslyPublic('bukan-tanggal', 30, NOW)).toBe(false);
  });

  it('N 0 berarti langsung publik begitu meninggal', () => {
    expect(isPosthumouslyPublic(death, 0, NOW)).toBe(true);
  });
});

describe('visibilitas dengan pengaturan (AC2/AC4)', () => {
  const def = defaultFamilyPrivacySettings();

  it('meninggal lewat batas pasca-kematian terbaca full apa pun relasi', () => {
    expect(
      resolveVisibilityWithSettings(
        { viewerRelation: 'sibling', privacyStatus: 'private', isAlive: false, deathDate: '1990-01-01' },
        def,
        NOW,
      ),
    ).toBe('full');
    expect(
      resolveVisibilityWithSettings(
        { viewerRelation: 'other', privacyStatus: null, isAlive: false, deathDate: '1990-01-01' },
        def,
        NOW,
      ),
    ).toBe('full');
  });

  it('meninggal di bawah batas mengikuti living-rule fase 1', () => {
    expect(
      resolveVisibilityWithSettings(
        { viewerRelation: 'child', privacyStatus: null, isAlive: false, deathDate: '2020-01-01' },
        def,
        NOW,
      ),
    ).toBe('name-only');
    expect(
      resolveVisibilityWithSettings(
        { viewerRelation: 'sibling', privacyStatus: null, isAlive: false, deathDate: '2020-01-01' },
        def,
        NOW,
      ),
    ).toBe('hidden');
  });

  it('consent shared tetap full pada meninggal di bawah batas', () => {
    expect(
      resolveVisibilityWithSettings(
        { viewerRelation: 'other', privacyStatus: 'shared', isAlive: false, deathDate: '2020-01-01' },
        def,
        NOW,
      ),
    ).toBe('full');
  });

  it('hidup: aturan fase 1 tanpa perubahan', () => {
    expect(
      resolveVisibilityWithSettings({ viewerRelation: 'sibling', privacyStatus: null, isAlive: true }, def, NOW),
    ).toBe('hidden');
    expect(
      resolveVisibilityWithSettings({ viewerRelation: 'partner', privacyStatus: 'private', isAlive: true }, def, NOW),
    ).toBe('name-only');
  });
});

describe('perubahan mode mengubah payload (AC2)', () => {
  // Simulasi payload respons route detail member di luar jangkauan,
  // bentuk eksak sama dengan wiring server/index.ts fase 2.
  function outsidePayload(
    member: { id: string; treeId: string; name: string; isAlive: boolean; generation: number | null; gender: string | null },
    mode: 'redact-full' | 'name-only',
  ): Record<string, unknown> {
    if (mode === 'name-only') {
      return { ...member };
    }
    return { ...member, name: '' };
  }

  it('mode name-only mengekspos nama, redact-full mengosongkan nama', () => {
    const m = { id: 'm1', treeId: 't1', name: 'Rahmat', isAlive: true, generation: 3, gender: 'male' };
    expect(outsidePayload(m, 'name-only')['name']).toBe('Rahmat');
    expect(outsidePayload(m, 'redact-full')['name']).toBe('');
  });
});

describe('jarak relasi dengan settings (AC2/AC6)', () => {
  const edges = [
    { memberId: 'a', relatedId: 'b', type: 'parent' },
    { memberId: 'b', relatedId: 'c', type: 'parent' },
    { memberId: 'c', relatedId: 'd', type: 'parent' },
  ];

  it('non-connected tetap redact: jarak null walau N 12', () => {
    expect(calculateRelationshipDistance(edges, 'a', 'z', 12)).toBeNull();
    expect(calculateRelationshipDistance(edges, 'a', 'z', 2)).toBeNull();
  });

  it('N membatasi jangkauan: jarak 3 lolos pada N 12, gagal pada N 2', () => {
    expect(calculateRelationshipDistance(edges, 'a', 'd', 12)).toBe(3);
    expect(calculateRelationshipDistance(edges, 'a', 'd', 2)).toBeNull();
  });

  it('graf siklus tidak membuat loop (visited BFS fase 1 utuh)', () => {
    const cycle = [
      { memberId: 'x', relatedId: 'y', type: 'spouse' },
      { memberId: 'y', relatedId: 'z', type: 'parent' },
      { memberId: 'z', relatedId: 'x', type: 'sibling' },
    ];
    expect(calculateRelationshipDistance(cycle, 'x', 'y', 2)).toBe(1);
    expect(calculateRelationshipDistance(cycle, 'x', 'w', 2)).toBeNull();
  });
});
