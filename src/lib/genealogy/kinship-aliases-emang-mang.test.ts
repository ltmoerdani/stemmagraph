import { describe, expect, it } from 'vitest';
import { loadKinshipAliases } from './kinship-aliases';

describe('Kinship Aliases emang+mang', () => {
  it('should load emang entry', () => {
    const aliases = loadKinshipAliases();
    expect(aliases.emang).toBeDefined();
    expect(aliases.emang?.kind).toBe('parent-sibling');
    expect(aliases.emang?.depth).toBe(1);
  });

  it('should load mang entry', () => {
    const aliases = loadKinshipAliases();
    expect(aliases.mang).toBeDefined();
    expect(aliases.mang?.kind).toBe('parent-sibling');
    expect(aliases.mang?.depth).toBe(1);
  });

  it('should have non-regression neighbor keys', () => {
    const aliases = loadKinshipAliases();
    expect(aliases['pakde']).toBeDefined();
    expect(aliases['om']).toBeDefined();
  });
});
