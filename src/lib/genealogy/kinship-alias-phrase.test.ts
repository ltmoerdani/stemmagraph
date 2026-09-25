import { describe, expect, it } from 'vitest';
import { kinshipAliasPhrase } from './kinship-alias-phrase';
import { kinshipLabel } from './kinship-labels';

describe('kinshipAliasPhrase', () => {
  it('anak: id', () => {
    expect(kinshipAliasPhrase('anak', 'id')).toBe('anak');
  });

  it('anak: en', () => {
    expect(kinshipAliasPhrase('anak', 'en')).toBe('child');
  });

  it('sepupu: id', () => {
    expect(kinshipAliasPhrase('sepupu', 'id')).toBe('sepupu');
  });

  it('sepupu: en', () => {
    expect(kinshipAliasPhrase('sepupu', 'en')).toBe('cousin');
  });

  it('keponakan: id', () => {
    expect(kinshipAliasPhrase('keponakan', 'id')).toBe('keponakan');
  });

  it('keponakan: en', () => {
    expect(kinshipAliasPhrase('keponakan', 'en')).toBe('nephew or niece');
  });

  it('nenek moyang: id', () => {
    expect(kinshipAliasPhrase('nenek moyang', 'id')).toBe('nenek moyang');
  });

  it('nenek moyang: en', () => {
    expect(kinshipAliasPhrase('nenek moyang', 'en')).toBe('ancestor');
  });

  it('titik tengah unicode moyang dinormalisasi', () => {
    expect(kinshipAliasPhrase('mo\u00B7yang', 'id')).toBe('nenek moyang');
  });

  it('spasi ganda dan kapital', () => {
    expect(kinshipAliasPhrase('  Nenek   MOYANG ', 'id')).toBe('nenek moyang');
  });

  it('frasa tak dikenal return null', () => {
    expect(kinshipAliasPhrase('tetangga sebelah', 'id')).toBeNull();
  });

  it('string kosong return null', () => {
    expect(kinshipAliasPhrase('', 'id')).toBeNull();
  });

  it('cicit berdepth 3 memakai jalur kinshipLabelWithDepth', () => {
    expect(kinshipAliasPhrase('cicit', 'id')).toBe('keturunan (3 generasi)');
    expect(kinshipAliasPhrase('cicit', 'en')).toBe('descendant (3 generations)');
  });

  it('konsisten dengan kinshipLabel untuk cucu', () => {
    expect(kinshipAliasPhrase('cucu', 'id')).toBe(kinshipLabel('grandchild', 'id'));
    expect(kinshipAliasPhrase('cucu', 'en')).toBe(kinshipLabel('grandchild', 'en'));
  });
});
