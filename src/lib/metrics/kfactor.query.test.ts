// Query-string parsing tests for the growth metrics endpoint (P2-8 AC-2).
// Mirrors the P2-6 feed limit discipline: absent means default, an honest
// integer is clamped into range, and garbage is a 400, never a silent ignore.

import { describe, expect, it } from 'vitest';
import {
  GROWTH_WEEKS_DEFAULT,
  GROWTH_WEEKS_MAX,
  GROWTH_WEEKS_MIN,
  parseGrowthMetricsQuery,
} from './kfactor';

describe('parseGrowthMetricsQuery', () => {
  it('defaults to 12 weeks when the parameter is absent', () => {
    expect(parseGrowthMetricsQuery({})).toEqual({ ok: true, weeks: GROWTH_WEEKS_DEFAULT });
  });

  it('accepts an integer string and trims it', () => {
    expect(parseGrowthMetricsQuery({ weeks: '5' })).toEqual({ ok: true, weeks: 5 });
    expect(parseGrowthMetricsQuery({ weeks: ' 8 ' })).toEqual({ ok: true, weeks: 8 });
  });

  it('clamps out-of-range integers into 1..26', () => {
    expect(parseGrowthMetricsQuery({ weeks: '0' })).toEqual({ ok: true, weeks: GROWTH_WEEKS_MIN });
    expect(parseGrowthMetricsQuery({ weeks: '99' })).toEqual({ ok: true, weeks: GROWTH_WEEKS_MAX });
    expect(parseGrowthMetricsQuery({ weeks: '-3' })).toEqual({ ok: true, weeks: GROWTH_WEEKS_MIN });
  });

  it('refuses garbage honestly instead of ignoring it', () => {
    const expected = { ok: false, code: 'VALIDATION_ERROR', message: 'weeks must be an integer between 1 and 26' };
    expect(parseGrowthMetricsQuery({ weeks: 'abc' })).toEqual(expected);
    expect(parseGrowthMetricsQuery({ weeks: '' })).toEqual(expected);
    expect(parseGrowthMetricsQuery({ weeks: '2.5' })).toEqual(expected);
    expect(parseGrowthMetricsQuery({ weeks: 5 })).toEqual(expected);
    expect(parseGrowthMetricsQuery({ weeks: ['7'] })).toEqual(expected);
  });
});
