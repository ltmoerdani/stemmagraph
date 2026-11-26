import { describe, it, expect } from 'vitest';
import { detectDateSlash } from './dateSlashGate';

describe('detectDateSlash (STG v465 unit C1 import gate)', () => {
  it('menolak tahun slash 1851/52 dengan offset 4', () => {
    const err = detectDateSlash('1851/52');
    expect(err).not.toBeNull();
    expect(err?.code).toBe('DATE_SLASH_NOTATION');
    expect(err?.offset).toBe(4);
    expect(err?.payload).toBe('1851/52');
    expect(err?.message).toContain('offset 4');
  });

  it('menolak dual date 30 JAN 1648/49 dengan offset 11', () => {
    const err = detectDateSlash('30 JAN 1648/49');
    expect(err).not.toBeNull();
    expect(err?.code).toBe('DATE_SLASH_NOTATION');
    expect(err?.offset).toBe(11);
  });

  it('payload bersih lolos', () => {
    expect(detectDateSlash('30 JAN 1649')).toBeNull();
  });

  it('payload undefined lolos', () => {
    expect(detectDateSlash(undefined)).toBeNull();
  });
});
