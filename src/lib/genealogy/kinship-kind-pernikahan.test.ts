import { describe, expect, it } from 'vitest';
import type { KinshipKind, RelationshipResult } from './kinship-calc';
import { KINSHIP_LABELS, kinshipLabel } from './kinship-labels';
import { kinshipPhrase } from './kinship-phrase';

const OLD_KINDS: KinshipKind[] = [
  'self',
  'partner',
  'parent',
  'child',
  'sibling',
  'grandparent',
  'grandchild',
  'parent-sibling',
  'sibling-child',
  'cousin',
  'ancestor',
  'descendant',
  'unrelated',
];

const FALLBACK_ID = 'hubungan tidak dikenal';
const FALLBACK_EN = 'unknown relationship';

describe('kinship kind pernikahan', () => {
  it('t1: pernikahan terdaftar di KINSHIP_LABELS', () => {
    expect(Object.keys(KINSHIP_LABELS)).toContain('pernikahan');
  });

  it('t2: jumlah kind kini 15', () => {
    expect(Object.keys(KINSHIP_LABELS)).toHaveLength(15);
  });

  it('t3: 13 kind lama plus property semua masih utuh', () => {
    expect(OLD_KINDS).toHaveLength(13);
    const keys = Object.keys(KINSHIP_LABELS);
    for (const kind of OLD_KINDS) {
      expect(keys).toContain(kind);
    }
    expect(keys).toContain('property');
    expect(KINSHIP_LABELS.property.id).toBe('harta mas kawin');
    expect(KINSHIP_LABELS.property.en).toBe('bridewealth property');
  });

  it('t4: label id pernikahan persis relasi karena perkawinan', () => {
    expect(KINSHIP_LABELS.pernikahan.id).toBe('relasi karena perkawinan');
    expect(kinshipLabel('pernikahan', 'id')).toBe('relasi karena perkawinan');
  });

  it('t5: label en pernikahan persis affinal relation', () => {
    expect(KINSHIP_LABELS.pernikahan.en).toBe('affinal relation');
    expect(kinshipLabel('pernikahan', 'en')).toBe('affinal relation');
  });

  it('t6: kinshipPhrase pernikahan id tanpa depth', () => {
    expect(kinshipPhrase({ kind: 'pernikahan' }, 'id')).toBe('relasi karena perkawinan');
  });

  it('t7: kinshipPhrase pernikahan en tanpa depth', () => {
    expect(kinshipPhrase({ kind: 'pernikahan' }, 'en')).toBe('affinal relation');
  });

  it('t8: RelationshipResult pernikahan depth undefined tidak melempar', () => {
    const result: RelationshipResult = { kind: 'pernikahan', depth: undefined };
    expect(() => kinshipPhrase(result, 'id')).not.toThrow();
    expect(() => kinshipPhrase(result, 'en')).not.toThrow();
    expect(kinshipPhrase(result, 'id')).not.toBe(FALLBACK_ID);
    expect(kinshipPhrase(result, 'en')).not.toBe(FALLBACK_EN);
  });

  it('t9: frasa pernikahan tidak bergantung depth', () => {
    const base = {
      id: kinshipPhrase({ kind: 'pernikahan' }, 'id'),
      en: kinshipPhrase({ kind: 'pernikahan' }, 'en'),
    };
    for (const depth of [0, 1, 2, 5, 99]) {
      expect(kinshipPhrase({ kind: 'pernikahan', depth }, 'id')).toBe(base.id);
      expect(kinshipPhrase({ kind: 'pernikahan', depth }, 'en')).toBe(base.en);
    }
  });

  it('t10: label pernikahan tidak bentrok dengan 14 kind lain', () => {
    const others = [...OLD_KINDS, 'property' as KinshipKind];
    const ids = others.map((k) => KINSHIP_LABELS[k].id);
    const ens = others.map((k) => KINSHIP_LABELS[k].en);
    expect(ids).not.toContain(KINSHIP_LABELS.pernikahan.id);
    expect(ens).not.toContain(KINSHIP_LABELS.pernikahan.en);
  });

  it('t11: kind asing mirip pernikahan jatuh ke fallback', () => {
    const alien = { kind: 'Pernikahan' } as unknown as RelationshipResult;
    expect(kinshipPhrase(alien, 'id')).toBe(FALLBACK_ID);
    expect(kinshipPhrase(alien, 'en')).toBe(FALLBACK_EN);
  });
});
