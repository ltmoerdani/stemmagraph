import { describe, expect, it } from 'vitest';
import { computeCitationCoverage } from './citation-coverage';

describe('computeCitationCoverage', () => {
  it('(a) returns null for empty tree', () => {
    expect(computeCitationCoverage([], [])).toBeNull();
  });

  it('(b) returns 100.0 when all individuals covered', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const events = [
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm2', citationId: 'c2' },
    ];
    expect(computeCitationCoverage(members, events)).toBe(100.0);
  });

  it('(c) returns 0.0 when no individual has a citation', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const events = [
      { memberId: 'm1', citationId: null },
      { memberId: 'm2', citationId: null },
    ];
    expect(computeCitationCoverage(members, events)).toBe(0.0);
  });

  it('(d) rounds to 1 decimal', () => {
    // 2 / 3 = 66.6666... -> 66.7
    const members = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
    const events = [
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm2', citationId: 'c2' },
    ];
    expect(computeCitationCoverage(members, events)).toBe(66.7);
  });

  it('(e) multiple cited LifeEvents of one individual count once', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const events = [
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm1', citationId: 'c2' },
      { memberId: 'm1', citationId: 'c3' },
    ];
    expect(computeCitationCoverage(members, events)).toBe(50.0);
  });

  it('(f) LifeEvent with citationId null does not count', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const events = [
      { memberId: 'm1', citationId: null },
      { memberId: 'm2', citationId: 'c2' },
    ];
    expect(computeCitationCoverage(members, events)).toBe(50.0);
  });

  it('(g) partner event citation does not cover the partner individual', () => {
    // Only the event owner (memberId) is covered; partnerMemberId is out of
    // scope by definition, so m2 stays uncovered.
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const events = [
      { memberId: 'm1', citationId: 'c1' },
    ];
    expect(computeCitationCoverage(members, events)).toBe(50.0);
  });

  it('(h) input order does not change the result', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
    const events = [
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm2', citationId: 'c2' },
    ];
    const forward = computeCitationCoverage(members, events);
    const backward = computeCitationCoverage(
      [...members].reverse(),
      [...events].reverse()
    );
    expect(forward).toBe(backward);
  });

  it('(i) result always within 0 to 100', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const none = computeCitationCoverage(members, [
      { memberId: 'm1', citationId: null },
    ]);
    const all = computeCitationCoverage(members, [
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm2', citationId: 'c2' },
    ]);
    expect(none).toBeGreaterThanOrEqual(0);
    expect(none).toBeLessThanOrEqual(100);
    expect(all).toBeGreaterThanOrEqual(0);
    expect(all).toBeLessThanOrEqual(100);
  });

  it('(j) deterministic across repeated calls', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }, { id: 'm3' }];
    const events = [{ memberId: 'm1', citationId: 'c1' }];
    const first = computeCitationCoverage(members, events);
    const second = computeCitationCoverage(members, events);
    expect(first).toBe(second);
    expect(first).toBe(33.3);
  });

  it('(k) mixed covered and uncovered counts exactly', () => {
    const members = [
      { id: 'm1' },
      { id: 'm2' },
      { id: 'm3' },
      { id: 'm4' },
    ];
    const events = [
      { memberId: 'm1', citationId: 'c1' },
      { memberId: 'm2', citationId: null },
      { memberId: 'm4', citationId: 'c4' },
    ];
    // covered: m1, m4 -> 2/4 = 50.0
    expect(computeCitationCoverage(members, events)).toBe(50.0);
  });

  it('(@VOID@ addendum) citationId @VOID@ counts as NOT covered', () => {
    const members = [{ id: 'm1' }, { id: 'm2' }];
    const events = [
      { memberId: 'm1', citationId: '@VOID@' },
      { memberId: 'm2', citationId: 'c2' },
    ];
    expect(computeCitationCoverage(members, events)).toBe(50.0);
  });
});
