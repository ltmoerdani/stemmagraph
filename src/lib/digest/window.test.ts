// Unit tests for the pure digest window module (P2-7 AC-1).
// Covers: the Monday 00:00 UTC bucket edges, the exact 7 day span, the
// once per window guard in all four shapes it can take, timestamps inside
// the window, the ISO year boundary, ISO string inputs, and the refusal
// of an invalid clock.

import { describe, expect, it } from 'vitest';
import { shouldSendDigest, weeklyWindow } from './window';

describe('weeklyWindow returns the last complete ISO week', () => {
  it('Monday 00:00:00.000 UTC belongs to the NEW week, so the window ends there', () => {
    // 2026-08-24 is a Monday. At exactly 00:00:00.000Z the previous week
    // is complete: [2026-08-17, 2026-08-24).
    const window = weeklyWindow(new Date('2026-08-24T00:00:00.000Z'));
    expect(window.startAt.toISOString()).toBe('2026-08-17T00:00:00.000Z');
    expect(window.endAt.toISOString()).toBe('2026-08-24T00:00:00.000Z');
  });

  it('Sunday 23:59:59.999 UTC is still the old week, so the window ends one Monday earlier', () => {
    const window = weeklyWindow(new Date('2026-08-23T23:59:59.999Z'));
    expect(window.startAt.toISOString()).toBe('2026-08-10T00:00:00.000Z');
    expect(window.endAt.toISOString()).toBe('2026-08-17T00:00:00.000Z');
  });

  it('every window spans exactly 7 days and both edges are Monday 00:00 UTC', () => {
    for (const now of [
      new Date('2026-08-26T09:15:00Z'),
      new Date('2026-01-01T12:00:00Z'),
      new Date('2026-12-31T23:00:00Z'),
    ]) {
      const window = weeklyWindow(now);
      expect(window.endAt.getTime() - window.startAt.getTime()).toBe(7 * 86_400_000);
      for (const edge of [window.startAt, window.endAt]) {
        expect(edge.getUTCDay()).toBe(1); // Monday
        expect(edge.getUTCHours()).toBe(0);
        expect(edge.getUTCMinutes()).toBe(0);
        expect(edge.getUTCSeconds()).toBe(0);
        expect(edge.getUTCMilliseconds()).toBe(0);
      }
    }
  });

  it('crosses the ISO year boundary honestly (late December Monday)', () => {
    // 2026-12-28 is a Monday. On the Sunday before it, the last complete
    // week is [2026-12-21, 2026-12-28).
    const window = weeklyWindow(new Date('2027-01-03T23:00:00Z'));
    expect(window.startAt.toISOString()).toBe('2026-12-21T00:00:00.000Z');
    expect(window.endAt.toISOString()).toBe('2026-12-28T00:00:00.000Z');
  });

  it('accepts an ISO string the same as a Date', () => {
    expect(weeklyWindow('2026-08-24T00:00:00.000Z')).toEqual(weeklyWindow(new Date('2026-08-24T00:00:00.000Z')));
  });

  it('refuses an invalid clock instead of emailing the wrong week', () => {
    expect(() => weeklyWindow('not-a-date')).toThrow(TypeError);
  });
});

describe('shouldSendDigest sends at most once per window', () => {
  const windowStart = new Date('2026-08-17T00:00:00.000Z');

  it('null (never sent) authorizes the send', () => {
    expect(shouldSendDigest(null, windowStart)).toBe(true);
  });

  it('a send exactly 7 days earlier (the previous window edge) still authorizes', () => {
    expect(shouldSendDigest(new Date('2026-08-10T00:00:00.000Z'), windowStart)).toBe(true);
    expect(shouldSendDigest(new Date('2026-08-09T23:59:59.999Z'), windowStart)).toBe(true);
  });

  it('a timestamp exactly ON windowStart blocks the resend (guard edge)', () => {
    expect(shouldSendDigest(windowStart, windowStart)).toBe(false);
  });

  it('a timestamp inside the window blocks the resend', () => {
    expect(shouldSendDigest(new Date('2026-08-20T12:00:00.000Z'), windowStart)).toBe(false);
    expect(shouldSendDigest(new Date('2026-08-23T23:59:59.999Z'), windowStart)).toBe(false);
  });

  it('a timestamp after the window (sent for a LATER window) also blocks', () => {
    expect(shouldSendDigest(new Date('2026-08-25T08:00:00.000Z'), windowStart)).toBe(false);
  });

  it('accepts ISO strings and fails closed on garbage', () => {
    expect(shouldSendDigest('2026-08-16T00:00:00.000Z', '2026-08-17T00:00:00.000Z')).toBe(true);
    expect(shouldSendDigest('2026-08-17T00:00:00.000Z', '2026-08-17T00:00:00.000Z')).toBe(false);
    expect(shouldSendDigest('garbage', windowStart)).toBe(false);
  });
});
