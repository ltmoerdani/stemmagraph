// Unit tests for the pure growth-metrics projector (P2-8 AC-1).
//
// The reference instant is fixed so every assertion is deterministic:
// NOW = Wednesday 2026-08-26T12:00:00Z sits in ISO week 2026-W35
// (Monday 2026-08-24T00:00:00Z). Two-week runs therefore produce
// W34 (08-17..08-24) then W35 (08-24..08-31), both half-open.

import { describe, expect, it } from 'vitest';
import {
  computeGrowthMetrics,
  GROWTH_WEEKS_DEFAULT,
  GROWTH_WEEKS_MAX,
  GROWTH_WEEKS_MIN,
  roundGrowthMetric,
  type GrowthEventRow,
} from './kfactor';

const NOW = new Date('2026-08-26T12:00:00Z');

function accountRow(
  type: 'ACCOUNT_PENDING_CREATED' | 'ACCOUNT_ACTIVATED' | 'ACCOUNT_DISABLED' | 'ACCOUNT_ENABLED',
  subjectUserId: string,
  at: string,
): GrowthEventRow {
  return { type, payloadJson: JSON.stringify({ subjectUserId }), createdAt: at };
}

function invitationRow(at: string): GrowthEventRow {
  return { type: 'INVITATION_CREATED', payloadJson: '{"invitationId":"inv_1"}', createdAt: at };
}

function bucket(rows: readonly GrowthEventRow[], weeks: number, index: number) {
  const result = computeGrowthMetrics(rows, { weeks, now: NOW });
  if (!result.ok) throw new Error(`unexpected validation error: ${result.message}`);
  return result.weeks[index]!;
}

describe('bucket boundaries (ISO weeks, Monday 00:00 UTC)', () => {
  it('labels buckets with ISO year-week and half-open UTC boundaries', () => {
    const first = bucket([], 2, 0);
    const last = bucket([], 2, 1);
    expect(first.isoWeek).toBe('2026-W34');
    expect(first.startAt).toBe('2026-08-17T00:00:00.000Z');
    expect(first.endAt).toBe('2026-08-24T00:00:00.000Z');
    expect(last.isoWeek).toBe('2026-W35');
    expect(last.endAt).toBe('2026-08-31T00:00:00.000Z');
  });

  it('puts Sunday 23:59:59.999 in the older week and Monday 00:00 in the newer', () => {
    const rows = [invitationRow('2026-08-23T23:59:59.999Z'), invitationRow('2026-08-24T00:00:00.000Z')];
    expect(bucket(rows, 2, 0).e1).toBe(1);
    expect(bucket(rows, 2, 1).e1).toBe(1);
  });

  it('keeps ISO year boundaries honest (late December Monday is next ISO year W01)', () => {
    const result = computeGrowthMetrics([], { weeks: 1, now: new Date('2026-01-02T12:00:00Z') });
    expect(result.ok && result.weeks[0]!.isoWeek).toBe('2026-W01');
    expect(result.ok && result.weeks[0]!.startAt).toBe('2025-12-29T00:00:00.000Z');
    const tail = computeGrowthMetrics([], { weeks: 1, now: new Date('2026-12-31T12:00:00Z') });
    expect(tail.ok && tail.weeks[0]!.isoWeek).toBe('2026-W53');
  });
});

describe('weeks parameter', () => {
  it('defaults to 12 buckets ending with the week of now', () => {
    const result = computeGrowthMetrics([], { now: NOW });
    expect(result.ok && result.weeks).toHaveLength(GROWTH_WEEKS_DEFAULT);
    expect(result.ok && result.weeks[0]!.isoWeek).toBe('2026-W24');
    expect(result.ok && result.weeks.at(-1)!.isoWeek).toBe('2026-W35');
  });

  it('clamps 0 up to 1 and 99 down to 26', () => {
    const low = computeGrowthMetrics([], { weeks: 0, now: NOW });
    const high = computeGrowthMetrics([], { weeks: 99, now: NOW });
    expect(low.ok && low.weeks).toHaveLength(GROWTH_WEEKS_MIN);
    expect(high.ok && high.weeks).toHaveLength(GROWTH_WEEKS_MAX);
  });

  it('refuses non-integer weeks honestly', () => {
    const result = computeGrowthMetrics([], { weeks: 2.5, now: NOW });
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR', message: 'weeks must be an integer between 1 and 26' });
  });
});

describe('k-factor numerator and denominator', () => {
  it('counts E3-in-week accounts with an earlier E2, split from the denominator', () => {
    const rows = [
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-18T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'A', '2026-08-19T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'B', '2026-08-20T10:00:00Z'), // no E2 first
      accountRow('ACCOUNT_PENDING_CREATED', 'C', '2026-07-01T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'C', '2026-07-02T10:00:00Z'), // active before the window
    ];
    const w34 = bucket(rows, 2, 0);
    const w35 = bucket(rows, 2, 1);
    expect(w34.e2).toBe(1);
    expect(w34.e3).toBe(2);
    expect(w34.denominator).toBe(1); // only C
    expect(w34.k).toBe(1); // only A
    expect(w35.denominator).toBe(3); // A, B, C
    expect(w35.k).toBe(0);
  });

  it('rejects a numerator account whose E2 arrived after its E3', () => {
    const rows = [
      accountRow('ACCOUNT_ACTIVATED', 'A', '2026-08-19T10:00:00Z'),
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-20T10:00:00Z'),
    ];
    expect(bucket(rows, 2, 0).k).toBe(0);
  });

  it('rejects a numerator account disabled by the end of the week', () => {
    const rows = [
      accountRow('ACCOUNT_PENDING_CREATED', 'C', '2026-07-01T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'C', '2026-07-02T10:00:00Z'),
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-18T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'A', '2026-08-19T10:00:00Z'),
      accountRow('ACCOUNT_DISABLED', 'A', '2026-08-20T10:00:00Z'),
    ];
    const w34 = bucket(rows, 2, 0);
    expect(w34.denominator).toBe(1); // C only
    expect(w34.k).toBe(0); // A is excluded: disabled before the week ends
    expect(bucket(rows, 2, 1).denominator).toBe(1); // A stays out at start of W35
  });

  it('accepts a numerator account that was disabled then re-enabled inside the week', () => {
    const rows = [
      accountRow('ACCOUNT_PENDING_CREATED', 'C', '2026-07-01T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'C', '2026-07-02T10:00:00Z'),
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-18T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'A', '2026-08-19T10:00:00Z'),
      accountRow('ACCOUNT_DISABLED', 'A', '2026-08-20T10:00:00Z'),
      accountRow('ACCOUNT_ENABLED', 'A', '2026-08-21T10:00:00Z'),
    ];
    expect(bucket(rows, 2, 0).k).toBe(1); // A counts: re-enabled before the week ends
    expect(bucket(rows, 2, 1).denominator).toBe(2); // A and C, both active at start of W35
  });

  it('excludes disabled-at-start accounts from the denominator and includes re-enabled ones', () => {
    const rows = [
      accountRow('ACCOUNT_PENDING_CREATED', 'gone', '2026-08-05T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'gone', '2026-08-06T10:00:00Z'),
      accountRow('ACCOUNT_DISABLED', 'gone', '2026-08-07T10:00:00Z'),
      accountRow('ACCOUNT_PENDING_CREATED', 'back', '2026-08-05T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'back', '2026-08-06T10:00:00Z'),
      accountRow('ACCOUNT_DISABLED', 'back', '2026-08-07T10:00:00Z'),
      accountRow('ACCOUNT_ENABLED', 'back', '2026-08-08T10:00:00Z'),
    ];
    expect(bucket(rows, 2, 0).denominator).toBe(1); // only "back"
  });

  it('feeds the denominator from activation history far before the window', () => {
    const rows = [
      accountRow('ACCOUNT_PENDING_CREATED', 'old', '2025-12-01T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'old', '2025-12-02T10:00:00Z'),
    ];
    expect(bucket(rows, 2, 0).denominator).toBe(1);
  });

  it('ignores a state flip that lands after the bucket end', () => {
    const rows = [
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-18T10:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'A', '2026-08-19T10:00:00Z'),
      accountRow('ACCOUNT_DISABLED', 'A', '2026-08-30T10:00:00Z'), // inside W35
    ];
    expect(bucket(rows, 2, 0).e3).toBe(1);
    expect(bucket(rows, 2, 0).denominator).toBe(0);
    expect(bucket(rows, 2, 1).denominator).toBe(1); // not yet disabled at start of W35
  });

  it('returns an honest zero denominator, never NaN', () => {
    const w = bucket([], 2, 0);
    expect(w.denominator).toBe(0);
    expect(w.k).toBe(0);
    expect(Number.isNaN(w.k)).toBe(false);
  });
});

describe('rates', () => {
  it('computes pakaiRate = e2/e1 and aktivasiRate = e3/e2 per week', () => {
    const rows = [
      invitationRow('2026-08-25T10:00:00Z'),
      invitationRow('2026-08-25T11:00:00Z'),
      invitationRow('2026-08-25T12:00:00Z'),
      invitationRow('2026-08-25T13:00:00Z'),
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-25T14:00:00Z'),
      accountRow('ACCOUNT_ACTIVATED', 'A', '2026-08-26T09:00:00Z'),
    ];
    const w35 = bucket(rows, 2, 1);
    expect(w35.e1).toBe(4);
    expect(w35.e2).toBe(1);
    expect(w35.e3).toBe(1);
    expect(w35.pakaiRate).toBe(0.25);
    expect(w35.aktivasiRate).toBe(1);
  });

  it('keeps exact fractions in the module and rounds only at serialization', () => {
    const rows = [
      invitationRow('2026-08-25T10:00:00Z'),
      invitationRow('2026-08-25T11:00:00Z'),
      invitationRow('2026-08-25T12:00:00Z'),
      accountRow('ACCOUNT_PENDING_CREATED', 'A', '2026-08-25T13:00:00Z'),
    ];
    const w35 = bucket(rows, 2, 1);
    expect(w35.pakaiRate).toBe(1 / 3);
    expect(roundGrowthMetric(w35.pakaiRate)).toBe(0.3333);
  });

  it('returns honest zero rates on empty denominators', () => {
    const w35 = bucket([invitationRow('2026-08-25T10:00:00Z')], 2, 1);
    expect(w35.pakaiRate).toBe(0);
    expect(w35.aktivasiRate).toBe(0);
  });
});

describe('garbage input is refused honestly', () => {
  it('refuses an unknown event type', () => {
    const result = computeGrowthMetrics([{ type: 'ACCOUNT_DELETED', payloadJson: '{}', createdAt: '2026-08-25T10:00:00Z' }], { now: NOW });
    expect(result.ok).toBe(false);
  });

  it('refuses an invalid createdAt', () => {
    const result = computeGrowthMetrics([invitationRow('not-a-date')], { now: NOW });
    expect(result.ok).toBe(false);
  });

  it('refuses an account row whose payload lacks subjectUserId', () => {
    const result = computeGrowthMetrics([{ type: 'ACCOUNT_ACTIVATED', payloadJson: '{}', createdAt: '2026-08-25T10:00:00Z' }], { now: NOW });
    expect(result.ok).toBe(false);
  });

  it('refuses a payload that is not valid JSON', () => {
    const result = computeGrowthMetrics([{ type: 'ACCOUNT_ACTIVATED', payloadJson: '{oops', createdAt: '2026-08-25T10:00:00Z' }], { now: NOW });
    expect(result.ok).toBe(false);
  });

  it('accepts and ignores the funnel types outside the projector inputs', () => {
    const rows: GrowthEventRow[] = [
      { type: 'INVITATION_USED', payloadJson: '{"invitationId":"inv_1","result":"success"}', createdAt: '2026-08-25T10:00:00Z' },
      { type: 'INVITATION_REVOKED', payloadJson: '{"invitationId":"inv_1"}', createdAt: '2026-08-25T11:00:00Z' },
    ];
    const w35 = bucket(rows, 2, 1);
    expect(w35.e1).toBe(0);
    expect(w35.e2).toBe(0);
    expect(w35.e3).toBe(0);
  });

  it('refuses an invalid now anchor', () => {
    const result = computeGrowthMetrics([], { now: 'yesterday' });
    expect(result).toEqual({ ok: false, code: 'VALIDATION_ERROR', message: 'now must be a Date or an ISO string' });
  });
});
