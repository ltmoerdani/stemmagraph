import { describe, it, expect } from 'vitest';
import { aliasKinds, resolveAlias } from './kinship-aliases';

// STG v188-i: draft kasus inti awal (3 kasus), akan diperluas setelah API aktual dicek
describe('kinship-aliases-karo-inti: v188-i kasus inti', () => {
  it('bapa resolve kind parent depth 1', () => {
    const hasil = resolveAlias('bapa', 'Karo');
    expect(hasil).not.toBeNull();
    expect(hasil?.kind).toBe('parent');
    expect(hasil?.depth).toBe(1);
  });

  it('mama resolve kind parent-sibling depth 1', () => {
    const hasil = resolveAlias('mama', 'Karo');
    expect(hasil).not.toBeNull();
    expect(hasil?.kind).toBe('parent-sibling');
    expect(hasil?.depth).toBe(1);
  });

  it('permen resolve kind sibling-child dan bukan child', () => {
    const hasil = resolveAlias('permen', 'Karo');
    expect(hasil).not.toBeNull();
    expect(hasil?.kind).toBe('sibling-child');
    expect(hasil?.kind).not.toBe('child');
  });
});
