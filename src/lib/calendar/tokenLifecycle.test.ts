/**
 * Test dedikasi v400 AC5: modul pure lifecycle token ICS
 * (src/lib/calendar/tokenLifecycle.ts).
 *
 * Cakupan: umur token (rotatedAt fallback createdAt), guard rotasi
 * 90 hari (tepat 90 hari tidak dirotasi), guard grace 7 hari token
 * prev (tepat 7 hari masih sah), nilai rusak fail closed.
 */
import { describe, expect, it } from 'vitest';
import {
  ICS_TOKEN_GRACE_DAYS,
  ICS_TOKEN_MAX_AGE_DAYS,
  isPrevTokenWithinGrace, isTokenDueForRotation, tokenAgeStart,
} from './tokenLifecycle';

const DAY_MS = 86_400_000;
const CREATED = new Date('2026-07-01T00:00:00.000Z');

describe('tokenAgeStart (v400)', () => {
  it('rotatedAt valid dipakai apa adanya', () => {
    const rotated = new Date(CREATED.getTime() + 30 * DAY_MS);
    expect(tokenAgeStart({ rotatedAt: rotated, createdAt: CREATED }).getTime()).toBe(rotated.getTime());
  });

  it('rotatedAt null jatuh ke createdAt (fallback kontrak v400)', () => {
    expect(tokenAgeStart({ rotatedAt: null, createdAt: CREATED }).getTime()).toBe(CREATED.getTime());
  });

  it('rotatedAt rusak jatuh ke createdAt (fail safe ke nilai yang pasti ada)', () => {
    expect(tokenAgeStart({ rotatedAt: 'bukan-tanggal', createdAt: CREATED }).getTime()).toBe(CREATED.getTime());
  });

  it('createdAt rusak melempar TypeError (fail closed)', () => {
    expect(() => tokenAgeStart({ rotatedAt: null, createdAt: 'bukan-tanggal' })).toThrow(TypeError);
  });

  it('menerima string ISO sebagai input', () => {
    expect(tokenAgeStart({ rotatedAt: null, createdAt: CREATED.toISOString() }).getTime()).toBe(CREATED.getTime());
  });
});

describe('isTokenDueForRotation (v400, umur > 90 hari)', () => {
  it('konstanta: 90 hari umur maksimum', () => {
    expect(ICS_TOKEN_MAX_AGE_DAYS).toBe(90);
  });

  it('umur 91 hari: due', () => {
    const now = new Date(CREATED.getTime() + 91 * DAY_MS);
    expect(isTokenDueForRotation({ rotatedAt: null, createdAt: CREATED }, now)).toBe(true);
  });

  it('tepat 90 hari: belum due (age > max, bukan age >= max)', () => {
    const now = new Date(CREATED.getTime() + 90 * DAY_MS);
    expect(isTokenDueForRotation({ rotatedAt: null, createdAt: CREATED }, now)).toBe(false);
  });

  it('umur 89 hari: belum due', () => {
    const now = new Date(CREATED.getTime() + 89 * DAY_MS);
    expect(isTokenDueForRotation({ rotatedAt: null, createdAt: CREATED }, now)).toBe(false);
  });

  it('umur dihitung dari rotatedAt terakhir, bukan createdAt, bila sudah pernah dirotasi', () => {
    const rotated = new Date(CREATED.getTime() + 80 * DAY_MS);
    const now = rotated.getTime() + 91 * DAY_MS;
    expect(isTokenDueForRotation({ rotatedAt: rotated, createdAt: CREATED }, new Date(now))).toBe(true);
    expect(isTokenDueForRotation({ rotatedAt: rotated, createdAt: CREATED }, new Date(rotated.getTime() + 90 * DAY_MS))).toBe(false);
  });

  it('now rusak melempar TypeError (fail closed)', () => {
    expect(() => isTokenDueForRotation({ rotatedAt: null, createdAt: CREATED }, 'rusak')).toThrow(TypeError);
  });
});

describe('isPrevTokenWithinGrace (v400, grace 7 hari)', () => {
  it('konstanta: 7 hari grace', () => {
    expect(ICS_TOKEN_GRACE_DAYS).toBe(7);
  });

  it('2 hari sejak rotasi: masih dalam grace', () => {
    const rotatedAt = new Date('2026-10-20T00:00:00.000Z');
    expect(isPrevTokenWithinGrace(rotatedAt, new Date(rotatedAt.getTime() + 2 * DAY_MS))).toBe(true);
  });

  it('tepat 7 hari: masih sah (<= grace)', () => {
    const rotatedAt = new Date('2026-10-19T00:00:00.000Z');
    expect(isPrevTokenWithinGrace(rotatedAt, new Date(rotatedAt.getTime() + 7 * DAY_MS))).toBe(true);
  });

  it('lewat 7 hari (7 hari + 1 ms): tidak sah, 404', () => {
    const rotatedAt = new Date('2026-10-19T00:00:00.000Z');
    expect(isPrevTokenWithinGrace(rotatedAt, new Date(rotatedAt.getTime() + 7 * DAY_MS + 1))).toBe(false);
  });

  it('rotatedAt null: gagal tertutup (tidak pernah sah)', () => {
    expect(isPrevTokenWithinGrace(null, new Date())).toBe(false);
  });

  it('rotatedAt rusak: gagal tertutup', () => {
    expect(isPrevTokenWithinGrace('bukan-tanggal', new Date())).toBe(false);
  });

  it('now rusak: gagal tertutup', () => {
    expect(isPrevTokenWithinGrace(new Date(), 'rusak')).toBe(false);
  });
});
