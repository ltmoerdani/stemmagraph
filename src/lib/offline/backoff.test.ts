import { describe, it, expect } from 'vitest';
import { BASE_MS, CAP_MS, MAX_ATTEMPTS, computeBackoff } from './backoff';

describe('computeBackoff', () => {
  it('konstanta default sesuai kontrak v113', () => {
    expect(BASE_MS).toBe(500);
    expect(CAP_MS).toBe(20000);
    expect(MAX_ATTEMPTS).toBe(5);
  });

  it('bounds rng 0: hasil 0 untuk attempt 0..4', () => {
    for (let attempt = 0; attempt <= 4; attempt += 1) {
      expect(computeBackoff(attempt, () => 0)).toBe(0);
    }
  });

  it('bounds rng 1: hasil tepat min(CAP_MS, BASE_MS * 2^attempt) untuk attempt 0..4', () => {
    const expected = [500, 1000, 2000, 4000, 8000];
    for (let attempt = 0; attempt <= 4; attempt += 1) {
      expect(computeBackoff(attempt, () => 1)).toBe(expected[attempt]);
    }
  });

  it('cap: attempt 10 tidak pernah melebihi CAP_MS, batas atas tetap 20000', () => {
    expect(computeBackoff(10, () => 1)).toBe(CAP_MS);
    expect(computeBackoff(10, () => 0)).toBe(0);
    expect(BASE_MS * 2 ** 10).toBeGreaterThan(CAP_MS);
  });

  it('determinisme: rng injeksi sama menghasilkan delay sama', () => {
    const seq = [0.1, 0.5, 0.9, 0.3, 0.7];
    let call = 0;
    const rng = () => {
      const value = seq[call % seq.length];
      call += 1;
      return value;
    };
    const first = [0, 1, 2, 3, 4].map((attempt) => computeBackoff(attempt, rng));
    call = 0;
    const second = [0, 1, 2, 3, 4].map((attempt) => computeBackoff(attempt, rng));
    expect(first).toEqual(second);
    expect(first).toEqual([50, 500, 1800, 1200, 5600]);
  });

  it('hasil selalu bilangan bulat dalam rentang 0..batas atas untuk rng acak', () => {
    for (let attempt = 0; attempt <= 4; attempt += 1) {
      const bound = Math.min(CAP_MS, BASE_MS * 2 ** attempt);
      for (let i = 0; i < 50; i += 1) {
        const delay = computeBackoff(attempt);
        expect(delay).toBeGreaterThanOrEqual(0);
        expect(delay).toBeLessThanOrEqual(bound);
        expect(Number.isInteger(delay)).toBe(true);
      }
    }
  });
});
