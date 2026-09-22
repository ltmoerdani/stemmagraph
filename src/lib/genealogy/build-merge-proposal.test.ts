import { describe, expect, it } from 'vitest';

import { buildMergeProposal, MERGE_PROPOSAL_TYPE, MERGE_RESOURCE_CONSTRAINT } from './build-merge-proposal';

describe('buildMergeProposal', () => {
  it('kasus 1: payload dasar tipe merge_person, target member, menunjuk survivor', () => {
    const payload = buildMergeProposal({ survivorId: 'p1', duplicateId: 'p2', reason: 'Duplikat hasil cek dedup.' });
    expect(payload.type).toBe(MERGE_PROPOSAL_TYPE);
    expect(payload.targetType).toBe('member');
    expect(payload.targetId).toBe('p1');
    expect(payload.fields.survivorId).toBe('p1');
    expect(payload.fields.duplicateId).toBe('p2');
    expect(payload.reasonNote).toBe('Duplikat hasil cek dedup.');
    expect(payload.decisions).toEqual([]);
  });

  it('kasus 2: resourcePlan mengunci satu kelahiran dan relasi unik, salinan duplicate ke survivor', () => {
    const payload = buildMergeProposal({ survivorId: 'a', duplicateId: 'b', reason: 'Skor 100.' });
    expect(payload.fields.resourcePlan.birth).toEqual({
      source: 'duplicate',
      target: 'survivor',
      constraint: MERGE_RESOURCE_CONSTRAINT.BIRTH_SINGLE,
    });
    expect(payload.fields.resourcePlan.relationship).toEqual({
      source: 'duplicate',
      target: 'survivor',
      constraint: MERGE_RESOURCE_CONSTRAINT.RELATIONSHIP_UNIQUE,
    });
  });

  it('kasus 3: reason di-trim, kosong dan lebih dari 500 karakter ditolak', () => {
    const trimmed = buildMergeProposal({ survivorId: 'a', duplicateId: 'b', reason: '  Nama dan tahun lahir sama.  ' });
    expect(trimmed.reasonNote).toBe('Nama dan tahun lahir sama.');

    expect(() => buildMergeProposal({ survivorId: 'a', duplicateId: 'b', reason: '   ' })).toThrow(/must not be empty/);
    expect(() => buildMergeProposal({ survivorId: 'a', duplicateId: 'b', reason: 'x'.repeat(501) })).toThrow(/at most 500/);
  });

  it('kasus 4: id kosong dan id sama divalidasi', () => {
    expect(() => buildMergeProposal({ survivorId: ' ', duplicateId: 'b', reason: 'alasan' })).toThrow(/survivorId/);
    expect(() => buildMergeProposal({ survivorId: 'a', duplicateId: '', reason: 'alasan' })).toThrow(/duplicateId/);
    expect(() => buildMergeProposal({ survivorId: 'a', duplicateId: 'a', reason: 'alasan' })).toThrow(/berbeda/);
  });

  it('kasus 5: decisions valid diteruskan, keputusan di luar ACCEPT/REJECT/SKIP ditolak', () => {
    const payload = buildMergeProposal({
      survivorId: 'a',
      duplicateId: 'b',
      reason: 'alasan',
      decisions: [
        { pairId: 'a\u0000b', decision: 'ACCEPT' },
        { pairId: 'a\u0000b', decision: 'REJECT' },
      ],
    });
    expect(payload.decisions).toEqual([
      { pairId: 'a\u0000b', decision: 'ACCEPT' },
      { pairId: 'a\u0000b', decision: 'REJECT' },
    ]);

    expect(() =>
      buildMergeProposal({
        survivorId: 'a',
        duplicateId: 'b',
        reason: 'alasan',
        decisions: [{ pairId: 'a\u0000b', decision: 'MAYBE' as never }],
      }),
    ).toThrow(/tidak valid/);
  });

  it('kasus 6: deterministik, dua pemanggilan input sama menghasilkan payload identik', () => {
    const input = { survivorId: 'a', duplicateId: 'b', reason: 'alasan' } as const;
    expect(buildMergeProposal(input)).toEqual(buildMergeProposal(input));
  });
});
