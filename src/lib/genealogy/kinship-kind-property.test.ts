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

describe('kinship kind property', () => {
  it('t1: property terdaftar di KINSHIP_LABELS', () => {
    expect(Object.keys(KINSHIP_LABELS)).toContain('property');
    expect(Object.keys(KINSHIP_LABELS)).toContain('pernikahan');
  });

  it('t2: jumlah kind kini 15 (13 lama plus property dan pernikahan)', () => {
    expect(Object.keys(KINSHIP_LABELS)).toHaveLength(15);
    expect(OLD_KINDS).toHaveLength(13);
    for (const kind of OLD_KINDS) {
      expect(Object.keys(KINSHIP_LABELS)).toContain(kind);
    }
  });

  it('t3: KINSHIP_LABELS.property id dan en persis', () => {
    expect(KINSHIP_LABELS.property.id).toBe('harta mas kawin');
    expect(KINSHIP_LABELS.property.en).toBe('bridewealth property');
  });

  it('t4: kinshipLabel property mengembalikan id dan en', () => {
    expect(kinshipLabel('property', 'id')).toBe('harta mas kawin');
    expect(kinshipLabel('property', 'en')).toBe('bridewealth property');
  });

  it('t5: kinshipPhrase property id memuat harta mas kawin', () => {
    expect(kinshipPhrase({ kind: 'property' }, 'id')).toContain('harta mas kawin');
  });

  it('t6: kinshipPhrase property en memuat bridewealth property', () => {
    expect(kinshipPhrase({ kind: 'property' }, 'en')).toContain('bridewealth property');
  });

  it('t7: frasa property tidak bergantung depth', () => {
    const base = {
      id: kinshipPhrase({ kind: 'property' }, 'id'),
      en: kinshipPhrase({ kind: 'property' }, 'en'),
    };
    for (const depth of [0, 1, 2, 5, 99]) {
      expect(kinshipPhrase({ kind: 'property', depth }, 'id')).toBe(base.id);
      expect(kinshipPhrase({ kind: 'property', depth }, 'en')).toBe(base.en);
    }
  });

  it('t8: frasa property tidak jatuh ke fallback', () => {
    expect(kinshipPhrase({ kind: 'property', depth: 1 }, 'id')).not.toBe(FALLBACK_ID);
    expect(kinshipPhrase({ kind: 'property', depth: 1 }, 'en')).not.toBe(FALLBACK_EN);
  });

  it('t9: regresi 13 kind lama punya label id dan en non-kosong', () => {
    for (const kind of OLD_KINDS) {
      expect(kinshipLabel(kind, 'id').length).toBeGreaterThan(0);
      expect(kinshipLabel(kind, 'en').length).toBeGreaterThan(0);
    }
  });

  it('t10: regresi 13 kind lama punya frasa non-fallback di kedua bahasa', () => {
    for (const kind of OLD_KINDS) {
      const result: RelationshipResult = { kind, depth: 2 };
      const id = kinshipPhrase(result, 'id');
      const en = kinshipPhrase(result, 'en');
      expect(id.length).toBeGreaterThan(0);
      expect(en.length).toBeGreaterThan(0);
      expect(id).not.toBe(FALLBACK_ID);
      expect(en).not.toBe(FALLBACK_EN);
    }
  });

  it('t11: contoh label lama eksplisit tidak berubah', () => {
    expect(kinshipLabel('self', 'id')).toBe('anda');
    expect(kinshipLabel('partner', 'en')).toBe('spouse');
    expect(kinshipLabel('parent', 'id')).toBe('orang tua');
  });

  it('t12: label property tidak bentrok dengan label kind lama', () => {
    const ids = OLD_KINDS.map((k) => KINSHIP_LABELS[k].id);
    const ens = OLD_KINDS.map((k) => KINSHIP_LABELS[k].en);
    expect(ids).not.toContain(KINSHIP_LABELS.property.id);
    expect(ens).not.toContain(KINSHIP_LABELS.property.en);
  });

  it('t13: kind asing jatuh ke fallback id dan en', () => {
    const alien = { kind: 'bukan-kind' } as unknown as RelationshipResult;
    expect(kinshipPhrase(alien, 'id')).toBe(FALLBACK_ID);
    expect(kinshipPhrase(alien, 'en')).toBe(FALLBACK_EN);
  });

  it('t14: kind asing mirip property tidak dianggap property', () => {
    const alien = { kind: 'Property' } as unknown as RelationshipResult;
    expect(kinshipPhrase(alien, 'id')).toBe(FALLBACK_ID);
    expect(kinshipPhrase(alien, 'en')).toBe(FALLBACK_EN);
  });
});
