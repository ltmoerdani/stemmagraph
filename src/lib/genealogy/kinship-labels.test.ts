import { describe, expect, it } from 'vitest';
import type { KinshipKind } from './kinship-calc';
import { KINSHIP_LABELS, kinshipLabel, kinshipLabelWithDepth } from './kinship-labels';

describe('kinship-labels', () => {
  it('t1: semua 13 kind punya entri id dan en string non-kosong', () => {
    const kinds = Object.keys(KINSHIP_LABELS) as KinshipKind[];
    expect(kinds).toHaveLength(13);
    for (const kind of kinds) {
      expect(typeof KINSHIP_LABELS[kind].id).toBe('string');
      expect(typeof KINSHIP_LABELS[kind].en).toBe('string');
      expect(KINSHIP_LABELS[kind].id.length).toBeGreaterThan(0);
      expect(KINSHIP_LABELS[kind].en.length).toBeGreaterThan(0);
    }
  });

  it('t2: partner id dan en', () => {
    expect(kinshipLabel('partner', 'id')).toBe('pasangan');
    expect(kinshipLabel('partner', 'en')).toBe('spouse');
  });

  it('t3: parent id dan en', () => {
    expect(kinshipLabel('parent', 'id')).toBe('orang tua');
    expect(kinshipLabel('parent', 'en')).toBe('parent');
  });

  it('t4: parent-sibling id', () => {
    expect(kinshipLabel('parent-sibling', 'id')).toBe('om atau tante');
  });

  it('t5: sibling-child id', () => {
    expect(kinshipLabel('sibling-child', 'id')).toBe('keponakan');
  });

  it('t6: cousin id', () => {
    expect(kinshipLabel('cousin', 'id')).toBe('sepupu');
  });

  it('t7: unrelated id', () => {
    expect(kinshipLabel('unrelated', 'id')).toBe('tidak berhubungan');
  });

  it('t8: locale invalid fallback ke id', () => {
    expect(kinshipLabel('child', 'fr' as never)).toBe('anak');
  });

  it('t9: depth undefined return label polos', () => {
    expect(kinshipLabelWithDepth('parent', undefined, 'id')).toBe('orang tua');
    expect(kinshipLabelWithDepth('parent', undefined, 'id')).not.toContain('(');
  });

  it('t10: depth 0 return label polos', () => {
    expect(kinshipLabelWithDepth('partner', 0, 'id')).toBe('pasangan');
    expect(kinshipLabelWithDepth('partner', 0, 'en')).toBe('spouse');
  });

  it('t11: ancestor depth 3 id', () => {
    expect(kinshipLabelWithDepth('ancestor', 3, 'id')).toBe('nenek moyang (3 generasi)');
  });

  it('t12: ancestor depth 3 en', () => {
    expect(kinshipLabelWithDepth('ancestor', 3, 'en')).toBe('ancestor (3 generations)');
  });

  it('t13: parent depth 1 id', () => {
    expect(kinshipLabelWithDepth('parent', 1, 'id')).toBe('orang tua (1 generasi)');
  });

  it('t14: output deterministik', () => {
    const a = kinshipLabelWithDepth('descendant', 2, 'id');
    const b = kinshipLabelWithDepth('descendant', 2, 'id');
    expect(a).toBe(b);
    expect(a).toBe('keturunan (2 generasi)');
  });
});
