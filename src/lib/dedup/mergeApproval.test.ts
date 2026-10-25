/**
 * Test modul pure assessMergeRisk v392 (Approval Workflow Merge Berisiko).
 *
 * Kontrak threshold: rewire >= 4, delete >= 1, facts >= 6, atau primary
 * dan duplikat keduanya terhubung graf generasi. Urutan reasons wajib
 * deterministik mengikuti urutan konstanta: rewire, delete, facts,
 * generasi.
 */
import { describe, expect, it } from 'vitest';
import {
  assessMergeRisk,
  isGenerationConnected,
  MERGE_APPROVAL_REWIRE_THRESHOLD,
  MERGE_APPROVAL_DELETE_THRESHOLD,
  MERGE_APPROVAL_FACTS_THRESHOLD,
} from './mergeApproval';

const AMAN = {
  rewireCount: 0,
  deleteCount: 0,
  movedFactCount: 0,
  bothGenerationsConnected: false,
};

describe('assessMergeRisk threshold (v392)', () => {
  it('konstanta threshold terekspor sesuai kontrak', () => {
    expect(MERGE_APPROVAL_REWIRE_THRESHOLD).toBe(4);
    expect(MERGE_APPROVAL_DELETE_THRESHOLD).toBe(1);
    expect(MERGE_APPROVAL_FACTS_THRESHOLD).toBe(6);
  });

  it('rewire 3 = ALLOW tanpa alasan', () => {
    const out = assessMergeRisk({ ...AMAN, rewireCount: 3 });
    expect(out.needsApproval).toBe(false);
    expect(out.risk).toBe('LOW');
    expect(out.reasons).toEqual([]);
  });

  it('rewire 4 = NEEDS_APPROVAL RELATION_REWIRE', () => {
    const out = assessMergeRisk({ ...AMAN, rewireCount: 4 });
    expect(out.needsApproval).toBe(true);
    expect(out.risk).toBe('NEEDS_APPROVAL');
    expect(out.reasons).toEqual([{ code: 'RELATION_REWIRE', actual: 4, threshold: 4 }]);
  });

  it('delete 0 = ALLOW', () => {
    const out = assessMergeRisk({ ...AMAN, deleteCount: 0 });
    expect(out.needsApproval).toBe(false);
    expect(out.risk).toBe('LOW');
  });

  it('delete 1 = NEEDS_APPROVAL RELATION_DELETE', () => {
    const out = assessMergeRisk({ ...AMAN, deleteCount: 1 });
    expect(out.needsApproval).toBe(true);
    expect(out.risk).toBe('NEEDS_APPROVAL');
    expect(out.reasons).toEqual([{ code: 'RELATION_DELETE', actual: 1, threshold: 1 }]);
  });

  it('facts 5 = ALLOW', () => {
    const out = assessMergeRisk({ ...AMAN, movedFactCount: 5 });
    expect(out.needsApproval).toBe(false);
  });

  it('facts 6 = NEEDS_APPROVAL FACTS_MOVED', () => {
    const out = assessMergeRisk({ ...AMAN, movedFactCount: 6 });
    expect(out.needsApproval).toBe(true);
    expect(out.reasons).toEqual([{ code: 'FACTS_MOVED', actual: 6, threshold: 6 }]);
  });

  it('generasi false = ALLOW, true = NEEDS_APPROVAL GENERATION_BOTH_CONNECTED', () => {
    const aman = assessMergeRisk({ ...AMAN });
    expect(aman.needsApproval).toBe(false);
    const berisiko = assessMergeRisk({ ...AMAN, bothGenerationsConnected: true });
    expect(berisiko.needsApproval).toBe(true);
    expect(berisiko.reasons).toEqual([
      { code: 'GENERATION_BOTH_CONNECTED', actual: 1, threshold: 1 },
    ]);
  });

  it('kombinasi multi-reason urutan deterministik: rewire, delete, facts, generasi', () => {
    const out = assessMergeRisk({
      rewireCount: 5,
      deleteCount: 2,
      movedFactCount: 7,
      bothGenerationsConnected: true,
    });
    expect(out.reasons.map((r) => r.code)).toEqual([
      'RELATION_REWIRE',
      'RELATION_DELETE',
      'FACTS_MOVED',
      'GENERATION_BOTH_CONNECTED',
    ]);
    expect(out.stats).toEqual({
      rewireCount: 5,
      deleteCount: 2,
      movedFactCount: 7,
      bothGenerationsConnected: true,
    });
  });

  it('stats mengikuti input persis pada keputusan ALLOW', () => {
    const out = assessMergeRisk({
      rewireCount: 2,
      deleteCount: 0,
      movedFactCount: 3,
      bothGenerationsConnected: false,
    });
    expect(out.needsApproval).toBe(false);
    expect(out.stats).toEqual({
      rewireCount: 2,
      deleteCount: 0,
      movedFactCount: 3,
      bothGenerationsConnected: false,
    });
  });
});

describe('isGenerationConnected', () => {
  const rels = [
    { id: 'r1', memberId: 'a', relatedId: 'b', type: 'parent' },
    { id: 'r2', memberId: 'c', relatedId: 'd', type: 'spouse' },
  ];

  it('true bila anggota jadi sisi relasi parent-child', () => {
    expect(isGenerationConnected('a', rels)).toBe(true);
    expect(isGenerationConnected('b', rels)).toBe(true);
  });

  it('false untuk relasi non parent-child (spouse)', () => {
    expect(isGenerationConnected('c', rels)).toBe(false);
    expect(isGenerationConnected('d', rels)).toBe(false);
  });

  it('false untuk anggota tanpa relasi apa pun', () => {
    expect(isGenerationConnected('z', rels)).toBe(false);
  });
});
