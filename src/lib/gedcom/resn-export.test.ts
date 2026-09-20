// Test delegasi RESN export (v128-ii-a).
import { describe, expect, it } from 'vitest';
import { resnTagForStatus } from './resn-export';

describe('resnTagForStatus', () => {
  it('shared ke null', () => {
    expect(resnTagForStatus('shared')).toBeNull();
  });

  it('private ke PRIVACY', () => {
    expect(resnTagForStatus('private')).toBe('PRIVACY');
  });

  it('null ke PRIVACY', () => {
    expect(resnTagForStatus(null)).toBe('PRIVACY');
  });

  it('undefined ke PRIVACY', () => {
    expect(resnTagForStatus(undefined)).toBe('PRIVACY');
  });

  it('string kosong ke PRIVACY', () => {
    expect(resnTagForStatus('')).toBe('PRIVACY');
  });

  it('TOPSECRET ke PRIVACY', () => {
    expect(resnTagForStatus('TOPSECRET')).toBe('PRIVACY');
  });

  it('lowercase shared ke null', () => {
    // Fungsi pure mencocokkan 'shared' secara eksak; varian non-lowercase jatuh ke PRIVACY.
    expect(resnTagForStatus('shared')).toBeNull();
  });

  it('hasil hanya PRIVACY atau null', () => {
    const inputs = ['shared', 'private', null, undefined, '', 'TOPSECRET', 'SHARED', 'rahasia'];
    for (const input of inputs) {
      const result = resnTagForStatus(input);
      expect(result === 'PRIVACY' || result === null).toBe(true);
    }
  });
});
