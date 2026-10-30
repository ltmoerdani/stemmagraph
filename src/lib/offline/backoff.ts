// Modul backoff murni untuk retry flush outbox (GOAL v113).
// Formula mengikuti pola full jitter AWS: delay = floor(rng() * min(CAP_MS, BASE_MS * 2^attempt)).
// Fungsi tanpa side effect; rng dapat diinjeksi agar test deterministik.

export const BASE_MS = 500;
export const CAP_MS = 20000;
export const MAX_ATTEMPTS = 5;

export function computeBackoff(attempt: number, rng: () => number = Math.random): number {
  return Math.floor(rng() * Math.min(CAP_MS, BASE_MS * 2 ** attempt));
}
