// Pure growth-metrics projector for owner dashboards (P2-8 AC-1).
//
// This module is intentionally free of I/O: no database, no HTTP, no React.
// It consumes raw event rows (the same shape the P2-2 store returns) and
// projects them into weekly growth buckets. The endpoint stays a thin shell
// over these decisions, and every rule here is unit-testable.
//
// Funnel mapping (fixed, no new event types, ADR 0007):
//   E1 = INVITATION_CREATED        an owner minted an invitation link
//   E2 = ACCOUNT_PENDING_CREATED   a registration was created
//   E3 = ACCOUNT_ACTIVATED         an owner approved the account
//   E4 = INVITATION_REVOKED        an owner revoked a live invitation
// E4 is part of the funnel vocabulary but carries no weekly output column;
// INVITATION_USED rows are accepted and ignored here. Both stay that way so
// callers can hand over a slice of the store without pre-filtering.
//
// Metric definitions (AC-1, exact):
//   K(W) = (accounts with an ACCOUNT_ACTIVATED inside W AND an earlier
//          ACCOUNT_PENDING_CREATED AND not disabled at the end of W)
//          / (accounts active at the start of W)
//   active at start of W = recorded ACCOUNT_ACTIVATED before the start of W
//          and not disabled at the start of W
//   pakaiRate(W)     = E2 inside W / E1 inside W
//   aktivasiRate(W)  = E3 inside W / E2 inside W
// The rate numerators are raw counts and deliberately differ from the
// restricted K numerator; the difference is documented in ADR 0007.
//
// Honesty rules:
//   - Buckets are ISO weeks, Monday 00:00 UTC. Weeks are half-open
//     intervals [startAt, endAt): an event exactly at endAt belongs to the
//     next week, and "before" boundaries are strict.
//   - weeks defaults to 12 and clamps into 1..26.
//   - Division by zero yields an honest 0, never NaN and never an error.
//   - Garbage input (unknown type, broken payload, invalid timestamp)
//     returns an honest validation error; nothing is silently skipped,
//     because a silently corrupted aggregate is worse than a refused one.

import {
  isEventType,
  parseEventPayload,
  type EventType,
} from '../events';

// ─── Parameters ──────────────────────────────────────────

export const GROWTH_WEEKS_DEFAULT = 12;
export const GROWTH_WEEKS_MIN = 1;
export const GROWTH_WEEKS_MAX = 26;

/** The five event types the projector consumes; other store types are ignored. */
export const GROWTH_METRIC_EVENT_TYPES: readonly EventType[] = [
  'INVITATION_CREATED',
  'ACCOUNT_PENDING_CREATED',
  'ACCOUNT_ACTIVATED',
  'ACCOUNT_DISABLED',
  'ACCOUNT_ENABLED',
];

/** Rates keep full precision here; serialization rounds to 4 decimals. */
export const GROWTH_METRIC_DECIMALS = 4;

/** Rounds one metric at the serialization boundary (endpoint response). */
export function roundGrowthMetric(value: number): number {
  const factor = 10 ** GROWTH_METRIC_DECIMALS;
  return Math.round(value * factor) / factor;
}

// ─── Input ───────────────────────────────────────────────

/** One raw Event row from the store, exactly the columns the projector reads. */
export interface GrowthEventRow {
  readonly type: string;
  readonly payloadJson: string;
  readonly createdAt: Date | string;
}

export interface GrowthMetricsOptions {
  /** Integer weeks; clamped into 1..26. Non-integers are refused. */
  weeks?: number;
  /** Reference instant anchoring the newest bucket; required on purpose. */
  now: Date | string;
}

/** One projected ISO week. Rates are exact fractions, unrounded. */
export interface GrowthWeekMetrics {
  readonly isoWeek: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly e1: number;
  readonly e2: number;
  readonly e3: number;
  readonly k: number;
  readonly pakaiRate: number;
  readonly aktivasiRate: number;
  readonly denominator: number;
}

export type GrowthMetricsResult =
  | { ok: true; weeks: GrowthWeekMetrics[] }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string };

// ─── ISO week math (UTC) ─────────────────────────────────

const DAY_MS = 86_400_000;

/** Monday 00:00:00.000 UTC of the ISO week containing the instant. */
function startOfIsoWeekUtc(at: Date): Date {
  const monday = new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate()));
  const weekday = monday.getUTCDay(); // 0 = Sunday .. 6 = Saturday
  const back = weekday === 0 ? -6 : 1 - weekday;
  monday.setUTCDate(monday.getUTCDate() + back);
  return monday;
}

/**
 * ISO week label like "2026-W35". The Thursday of the week decides the ISO
 * year, which keeps year boundaries honest (a Monday in late December can
 * belong to week 1 of the next ISO year).
 */
function isoWeekLabel(monday: Date): string {
  const thursday = new Date(monday.getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const jan1 = Date.UTC(year, 0, 1);
  const dayOfYear = Math.floor((thursday.getTime() - jan1) / DAY_MS) + 1;
  const week = Math.floor((dayOfYear - 1) / 7) + 1;
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ─── Row parsing ─────────────────────────────────────────

interface ParsedGrowthEvent {
  readonly type: EventType;
  readonly subjectUserId: string | null;
  readonly at: number;
}

function invalid(message: string): GrowthMetricsResult {
  return { ok: false, code: 'VALIDATION_ERROR', message };
}

function parseRow(row: GrowthEventRow): ParsedGrowthEvent | GrowthMetricsResult {
  if (typeof row !== 'object' || row === null) return invalid('growth metrics row must be an object');
  if (!isEventType(row.type)) return invalid(`unknown event type: ${String(row.type)}`);

  const createdAt =
    row.createdAt instanceof Date
      ? row.createdAt
      : typeof row.createdAt === 'string'
        ? new Date(row.createdAt)
        : null;
  if (createdAt === null || createdAt.toString() === 'Invalid Date') {
    return invalid('event createdAt must be a Date or an ISO string');
  }

  const payload = parseEventPayload(row.payloadJson);
  if (payload === null || typeof payload !== 'object') {
    return invalid(`event payload is not valid JSON: ${String(row.type)}`);
  }

  const subjectUserId = (payload as { subjectUserId?: unknown }).subjectUserId;
  const isAccountFact = row.type !== 'INVITATION_CREATED' && row.type !== 'INVITATION_USED' && row.type !== 'INVITATION_REVOKED';
  if (isAccountFact) {
    if (typeof subjectUserId !== 'string' || subjectUserId === '') {
      return invalid(`account event payload is missing subjectUserId: ${row.type}`);
    }
  }
  return {
    type: row.type,
    subjectUserId: isAccountFact ? (subjectUserId as string) : null,
    at: createdAt.getTime(),
  };
}

// ─── Account timeline ────────────────────────────────────

interface AccountTimeline {
  readonly pendingAt: readonly number[]; // E2 timestamps, ascending
  readonly activatedAt: readonly number[]; // E3 timestamps, ascending
  readonly flips: readonly { at: number; disabled: boolean }[]; // DISABLED/ENABLED, ascending
}

function buildTimeline(facts: readonly ParsedGrowthEvent[]): AccountTimeline {
  const pendingAt: number[] = [];
  const activatedAt: number[] = [];
  const flips: { at: number; disabled: boolean }[] = [];
  for (const fact of facts) {
    if (fact.type === 'ACCOUNT_PENDING_CREATED') pendingAt.push(fact.at);
    else if (fact.type === 'ACCOUNT_ACTIVATED') activatedAt.push(fact.at);
    else if (fact.type === 'ACCOUNT_DISABLED') flips.push({ at: fact.at, disabled: true });
    else if (fact.type === 'ACCOUNT_ENABLED') flips.push({ at: fact.at, disabled: false });
  }
  return { pendingAt, activatedAt, flips };
}

/** True when the last DISABLED/ENABLED strictly before `at` is a disable. */
function disabledBefore(flips: readonly { at: number; disabled: boolean }[], at: number): boolean {
  let disabled = false;
  let seen = false;
  for (const flip of flips) {
    if (flip.at >= at) break;
    disabled = flip.disabled;
    seen = true;
  }
  return seen && disabled;
}

// ─── Projection ──────────────────────────────────────────

function zeroRate(denominator: number, numerator: number): number {
  // Honest zero on an empty denominator: documented, never NaN, never thrown.
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Projects raw event rows into weekly growth buckets. Buckets are ordered
 * oldest first, ending with the ISO week containing `now`. Events older
 * than the window still feed the denominator (activation history), and
 * events after a bucket's end cannot affect that bucket.
 */
export function computeGrowthMetrics(
  rows: readonly GrowthEventRow[],
  options: GrowthMetricsOptions,
): GrowthMetricsResult {
  let weeks = GROWTH_WEEKS_DEFAULT;
  if (options.weeks !== undefined) {
    if (typeof options.weeks !== 'number' || !Number.isInteger(options.weeks)) {
      return invalid('weeks must be an integer between 1 and 26');
    }
    weeks = Math.min(GROWTH_WEEKS_MAX, Math.max(GROWTH_WEEKS_MIN, options.weeks));
  }
  const now =
    options.now instanceof Date ? options.now : typeof options.now === 'string' ? new Date(options.now) : null;
  if (now === null || now.toString() === 'Invalid Date') {
    return invalid('now must be a Date or an ISO string');
  }

  const parsed: ParsedGrowthEvent[] = [];
  for (const row of rows) {
    const result = parseRow(row);
    if ('ok' in result && !result.ok) return result;
    parsed.push(result as ParsedGrowthEvent);
  }

  const timelines = new Map<string, { facts: ParsedGrowthEvent[]; timeline?: AccountTimeline }>();
  for (const fact of parsed) {
    if (fact.subjectUserId === null) continue; // invitation facts carry no account
    const entry = timelines.get(fact.subjectUserId) ?? { facts: [] };
    entry.facts.push(fact);
    timelines.set(fact.subjectUserId, entry);
  }
  for (const entry of timelines.values()) {
    entry.facts.sort((a, b) => a.at - b.at);
    entry.timeline = buildTimeline(entry.facts);
  }

  const currentMonday = startOfIsoWeekUtc(now);
  const buckets: GrowthWeekMetrics[] = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const startAt = new Date(currentMonday.getTime() - index * 7 * DAY_MS);
    const endAt = new Date(startAt.getTime() + 7 * DAY_MS);
    const startMs = startAt.getTime();
    const endMs = endAt.getTime();

    let e1 = 0;
    let e2 = 0;
    let e3 = 0;
    for (const fact of parsed) {
      if (fact.at < startMs || fact.at >= endMs) continue;
      if (fact.type === 'INVITATION_CREATED') e1 += 1;
      else if (fact.type === 'ACCOUNT_PENDING_CREATED') e2 += 1;
      else if (fact.type === 'ACCOUNT_ACTIVATED') e3 += 1;
    }

    let denominator = 0;
    let numerator = 0;
    for (const entry of timelines.values()) {
      const timeline = entry.timeline!;
      const activatedBeforeStart = timeline.activatedAt.some((at) => at < startMs);
      if (activatedBeforeStart && !disabledBefore(timeline.flips, startMs)) denominator += 1;

      const activationInWeek = timeline.activatedAt.find((at) => at >= startMs && at < endMs);
      if (activationInWeek === undefined) continue;
      const bornFromInvitation = timeline.pendingAt.some((at) => at < activationInWeek);
      if (bornFromInvitation && !disabledBefore(timeline.flips, endMs)) numerator += 1;
    }

    buckets.push({
      isoWeek: isoWeekLabel(startAt),
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      e1,
      e2,
      e3,
      k: zeroRate(denominator, numerator),
      pakaiRate: zeroRate(e1, e2),
      aktivasiRate: zeroRate(e2, e3),
      denominator,
    });
  }
  return { ok: true, weeks: buckets };
}

// ─── Query-string parsing (endpoint, P2-6 pattern) ───────

export interface GrowthMetricsQueryInput {
  weeks?: unknown;
}

export type GrowthMetricsQuery =
  | { ok: true; weeks: number }
  | { ok: false; code: 'VALIDATION_ERROR'; message: string };

/**
 * Parses ?weeks= honestly: absent means the default 12, a non-integer or
 * non-string value is a 400 (never a silent ignore), and an integer is
 * clamped into 1..26 like the feed limit.
 */
export function parseGrowthMetricsQuery(input: GrowthMetricsQueryInput): GrowthMetricsQuery {
  if (input.weeks === undefined) return { ok: true, weeks: GROWTH_WEEKS_DEFAULT };
  if (typeof input.weeks !== 'string' || input.weeks.trim() === '') {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'weeks must be an integer between 1 and 26' };
  }
  const parsed = Number(input.weeks.trim());
  if (!Number.isInteger(parsed)) {
    return { ok: false, code: 'VALIDATION_ERROR', message: 'weeks must be an integer between 1 and 26' };
  }
  return { ok: true, weeks: Math.min(GROWTH_WEEKS_MAX, Math.max(GROWTH_WEEKS_MIN, parsed)) };
}
