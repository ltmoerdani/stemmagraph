// Fixed-window rate limiter for public share endpoints (ADR 0010).
//
// Pure logic, no dependencies, no I/O: the clock is injected so tests
// are deterministic, and the store is an in-memory Map. Scope is one
// server process, which is the whole deployment for a self-hosted
// Stemmagraph; the limiter is a courtesy brake against hammering and
// password guessing, never a distributed quota. State dies with the
// process, which only means the counter restarts: the 256-bit token
// carries the real security weight, the limiter just slows brute force.
//
// Design: a fixed window per key. Each key keeps the timestamps of its
// hits inside the current window; a hit beyond the limit is refused
// with the seconds until the oldest relevant hit leaves the window.
// Stale keys are swept when the map grows past a threshold so a public
// endpoint cannot leak memory through unbounded distinct keys.

export interface RateLimitConfig {
  /** Maximum hits allowed inside one window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export interface RateLimitDecision {
  allowed: boolean
  /** Hits still available in the current window (0 when refused). */
  remaining: number
  /** Seconds until the next hit becomes allowed (0 when allowed). */
  retryAfterSeconds: number
}

/** Keys above this count trigger a sweep of fully expired windows. */
const SWEEP_THRESHOLD = 4096;

export class FixedWindowRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly config: RateLimitConfig,
    private readonly now: () => number = () => Date.now(),
  ) {
    if (!Number.isInteger(config.limit) || config.limit < 1) {
      throw new Error('limit must be a positive integer');
    }
    if (!Number.isInteger(config.windowMs) || config.windowMs < 1) {
      throw new Error('windowMs must be a positive integer');
    }
  }

  /** Records one hit for the key and decides whether it is allowed. */
  check(key: string): RateLimitDecision {
    const nowMs = this.now();
    let timestamps = this.hits.get(key);
    if (timestamps === undefined) {
      timestamps = [];
      this.hits.set(key, timestamps);
    }

    const cutoff = nowMs - this.config.windowMs;
    while (timestamps.length > 0 && timestamps[0] <= cutoff) {
      timestamps.shift();
    }

    if (timestamps.length >= this.config.limit) {
      const oldest = timestamps[0];
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((oldest + this.config.windowMs - nowMs) / 1000),
      );
      return { allowed: false, remaining: 0, retryAfterSeconds };
    }

    timestamps.push(nowMs);

    if (this.hits.size > SWEEP_THRESHOLD) {
      this.sweep(nowMs);
    }

    return {
      allowed: true,
      remaining: this.config.limit - timestamps.length,
      retryAfterSeconds: 0,
    };
  }

  /** Drops every recorded window; used by tests and admin resets. */
  reset(): void {
    this.hits.clear();
  }

  private sweep(nowMs: number): void {
    const cutoff = nowMs - this.config.windowMs;
    for (const [key, timestamps] of this.hits) {
      if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff) {
        this.hits.delete(key);
      }
    }
  }
}
