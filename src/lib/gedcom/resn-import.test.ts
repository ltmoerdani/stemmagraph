// Test delegasi RESN import (v128-ii-a).
import { describe, expect, it } from 'vitest';
import { privacyStatusFromResn } from './resn-import';

describe('privacyStatusFromResn', () => {
  it('CONFIDENTIAL ke private', () => {
    expect(privacyStatusFromResn('CONFIDENTIAL')).toBe('private');
  });

  it('PRIVACY ke private', () => {
    expect(privacyStatusFromResn('PRIVACY')).toBe('private');
  });

  it('LOCKED ke private', () => {
    expect(privacyStatusFromResn('LOCKED')).toBe('private');
  });

  it('lowercase confidential ke private', () => {
    expect(privacyStatusFromResn('confidential')).toBe('private');
  });

  it('null ke null', () => {
    expect(privacyStatusFromResn(null)).toBeNull();
  });

  it('undefined ke null', () => {
    expect(privacyStatusFromResn(undefined)).toBeNull();
  });

  it('string kosong ke null', () => {
    expect(privacyStatusFromResn('')).toBeNull();
  });

  it('_FOO ke null', () => {
    expect(privacyStatusFromResn('_FOO')).toBeNull();
  });
});
