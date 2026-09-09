// Test rate limiter share publik (ADR 0010). Jam disuntik supaya
// perilaku window deterministik: lolos sampai limit, ditolak dengan
// retryAfter yang tepat, pulih tepat saat window berlalu, dan hitung
// per kunci terpisah.

import { describe, expect, it } from 'vitest'
import { FixedWindowRateLimiter } from './rate-limit'

function makeClock() {
  let nowMs = 1_000_000;
  return {
    now: () => nowMs,
    advance: (ms: number) => {
      nowMs += ms;
    },
  };
}

describe('FixedWindowRateLimiter', () => {
  it('mengizinkan tepat sampai limit, lalu menolak', () => {
    const clock = makeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 3, windowMs: 60_000 }, clock.now);
    expect(limiter.check('ip-a').allowed).toBe(true);
    expect(limiter.check('ip-a').allowed).toBe(true);
    const third = limiter.check('ip-a');
    expect(third.allowed).toBe(true);
    expect(third.remaining).toBe(0);
    const fourth = limiter.check('ip-a');
    expect(fourth.allowed).toBe(false);
    expect(fourth.remaining).toBe(0);
  });

  it('retryAfterSeconds dihitung dari hit tertua yang masih mengunci window', () => {
    const clock = makeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 30_000 }, clock.now);
    limiter.check('ip-a');
    clock.advance(10_000);
    const blocked = limiter.check('ip-a');
    expect(blocked.allowed).toBe(false);
    // Hit pertama di ms 1.000.000 mengunci sampai 1.030.000; sekarang
    // 1.010.000, sisa 20 detik dibulatkan ke atas.
    expect(blocked.retryAfterSeconds).toBe(20);
  });

  it('window pulih tepat setelah durasi berlalu', () => {
    const clock = makeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 2, windowMs: 60_000 }, clock.now);
    limiter.check('ip-a');
    limiter.check('ip-a');
    expect(limiter.check('ip-a').allowed).toBe(false);
    clock.advance(60_000);
    const recovered = limiter.check('ip-a');
    expect(recovered.allowed).toBe(true);
    expect(recovered.remaining).toBe(1);
  });

  it('kunci berbeda tidak saling memengaruhi', () => {
    const clock = makeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 }, clock.now);
    expect(limiter.check('ip-a').allowed).toBe(true);
    expect(limiter.check('ip-b').allowed).toBe(true);
    expect(limiter.check('ip-a').allowed).toBe(false);
    expect(limiter.check('ip-b').allowed).toBe(false);
  });

  it('konfigurasi tidak valid ditolak di konstruktor', () => {
    expect(() => new FixedWindowRateLimiter({ limit: 0, windowMs: 1000 })).toThrow();
    expect(() => new FixedWindowRateLimiter({ limit: 5, windowMs: 0 })).toThrow();
    expect(() => new FixedWindowRateLimiter({ limit: 1.5, windowMs: 1000 })).toThrow();
  });

  it('reset mengosongkan seluruh hitungan', () => {
    const clock = makeClock();
    const limiter = new FixedWindowRateLimiter({ limit: 1, windowMs: 60_000 }, clock.now);
    limiter.check('ip-a');
    limiter.reset();
    expect(limiter.check('ip-a').allowed).toBe(true);
  });
});
