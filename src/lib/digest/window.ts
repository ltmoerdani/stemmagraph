// Pure weekly-digest window math for P2-7 (ADR 0008).
//
// This module is intentionally free of I/O: no database, no HTTP, no
// React, no nodemailer. It answers the two questions every digest pass
// needs: which ISO week is the last complete one, and has this recipient
// already been served for it. Both answers follow the same bucket rule
// as the growth metrics (ADR 0007): ISO weeks, Monday 00:00 UTC,
// half-open [startAt, endAt). The digest always reports the week that
// has just ended, never the week in progress.

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

/** A digest window: one complete ISO week, half-open [startAt, endAt). */
export interface WeeklyWindow {
  readonly startAt: Date;
  readonly endAt: Date;
}

/** Monday 00:00:00.000 UTC of the ISO week containing the instant. */
function startOfIsoWeekUtc(at: Date): Date {
  const monday = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const weekday = monday.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const back = weekday === 0 ? -6 : 1 - weekday;
  monday.setUTCDate(monday.getUTCDate() + back);
  return monday;
}

/**
 * The last COMPLETE ISO week before `now`: the week preceding the one
 * `now` sits in. Accepts a Date or an ISO string; throws on a value that
 * is not a valid instant, because a digest window built from a broken
 * clock would silently email the wrong week.
 */
export function weeklyWindow(now: Date | string): WeeklyWindow {
  const at = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(at.getTime())) {
    throw new TypeError('weeklyWindow: now must be a Date or an ISO string');
  }
  const currentMonday = startOfIsoWeekUtc(at);
  return {
    startAt: new Date(currentMonday.getTime() - WEEK_MS),
    endAt: currentMonday,
  };
}

/**
 * The once per window guard. True when digestLastSentAt is null (the
 * recipient has never been served) or strictly earlier than windowStart
 * (every send so far belongs to an older window). False from the first
 * millisecond of windowStart onward, including timestamps inside the
 * window and exactly on its edge: one send per window, no exceptions.
 * A malformed timestamp parses to NaN and compares false, which fails
 * closed: garbage never authorizes an extra email.
 */
export function shouldSendDigest(
  digestLastSentAt: Date | string | null,
  windowStart: Date | string,
): boolean {
  if (digestLastSentAt === null) return true;
  const last = digestLastSentAt instanceof Date ? digestLastSentAt : new Date(digestLastSentAt);
  const start = windowStart instanceof Date ? windowStart : new Date(windowStart);
  return last.getTime() < start.getTime();
}
