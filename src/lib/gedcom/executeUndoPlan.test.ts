/**
 * @vitest-environment node
 *
 * Test unit executeUndoPlan (v377): eksekutor rencana undo import.
 * io dibuat stub per kasus; asersi urutan panggilan dipakai untuk
 * membuktikan fase relasi berjalan sebelum fase member. Semua kasus
 * kontrak kontrak v377: urutan fase, dedupe, invalid input tanpa lempar,
 * jujur per entri, relasi tak terkait tak disentuh, plan kosong.
 */
import { describe, it, expect, vi } from 'vitest';
import { executeUndoPlan, type UndoExecuteIO } from './executeUndoPlan';

interface Rel {
  id: string;
  memberId: string;
  relatedId: string;
}

interface Call {
  kind: 'relation' | 'member';
  id: string;
}

/** Stub io yang merekam urutan panggilan delete lintas fase. */
function stubIo(
  relations: Rel[],
  opts?: {
    failDeleteRelationship?: (id: string) => boolean;
    failDeleteMember?: (id: string) => boolean;
    failList?: boolean;
  },
): { io: UndoExecuteIO; calls: Call[] } {
  const calls: Call[] = [];
  const io: UndoExecuteIO = {
    listRelationships: vi.fn(async (_treeId: string) => {
      if (opts?.failList) throw new Error('list down');
      return relations;
    }),
    deleteRelationship: vi.fn(async (id: string) => {
      if (opts?.failDeleteRelationship?.(id)) throw new Error(`del rel ${id} gagal`);
      calls.push({ kind: 'relation', id });
    }),
    deleteMember: vi.fn(async (id: string) => {
      if (opts?.failDeleteMember?.(id)) throw new Error(`del member ${id} gagal`);
      calls.push({ kind: 'member', id });
    }),
  };
  return { io, calls };
}

const RELS: Rel[] = [
  { id: 'r1', memberId: 'm1', relatedId: 'm2' },
  { id: 'r2', memberId: 'old', relatedId: 'm2' },
  { id: 'r3', memberId: 'keep1', relatedId: 'keep2' },
  { id: 'r4', memberId: 'm3', relatedId: 'keep3' },
];

describe('executeUndoPlan v377', () => {
  it('kasus 1 happy path: relasi terkait dihapus dulu, baru member, urutan panggilan terbukti', async () => {
    const { io, calls } = stubIo(RELS);
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['m1', 'm2', 'm3'], relationCountToReverse: 3, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.invalidInput).toBe(false);
    expect(report.removedRelationIds).toEqual(['r1', 'r2', 'r4']);
    expect(report.deletedMemberIds).toEqual(['m1', 'm2', 'm3']);
    expect(report.failedRelations).toEqual([]);
    expect(report.failedMembers).toEqual([]);
    // Urutan: semua relasi (r1 r2 r4) sebelum member pertama (m1).
    expect(calls.map((c) => `${c.kind}:${c.id}`)).toEqual([
      'relation:r1',
      'relation:r2',
      'relation:r4',
      'member:m1',
      'member:m2',
      'member:m3',
    ]);
  });

  it('kasus 2 dedupe: id duplikat di memberIdsToDelete dihapus sekali urut kemunculan', async () => {
    const { io } = stubIo([]);
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['m2', 'm1', 'm2', 'm1'], relationCountToReverse: 0, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.deletedMemberIds).toEqual(['m2', 'm1']);
    expect(io.deleteMember).toHaveBeenCalledTimes(2);
  });

  it('kasus 3 plan bentuk buruk: invalidInput true tanpa lempar, io tak tersentuh', async () => {
    const { io } = stubIo(RELS);
    const bads: unknown[] = [
      null,
      42,
      'plan',
      [],
      {},
      { memberIdsToDelete: 'bukan-array' },
    ];
    for (const plan of bads) {
      const report = await executeUndoPlan(plan, 'tree-1', io);
      expect(report.invalidInput).toBe(true);
      expect(report.deletedMemberIds).toEqual([]);
      expect(report.removedRelationIds).toEqual([]);
    }
    expect(io.listRelationships).not.toHaveBeenCalled();
    expect(io.deleteMember).not.toHaveBeenCalled();
  });

  it('kasus 4 io bentuk buruk dan treeId kosong: invalidInput true tanpa lempar', async () => {
    const reportA = await executeUndoPlan(
      { memberIdsToDelete: ['m1'] },
      'tree-1',
      { listRelationships: 'bukan-fungsi', deleteRelationship: () => {}, deleteMember: () => {} },
    );
    expect(reportA.invalidInput).toBe(true);
    const reportB = await executeUndoPlan({ memberIdsToDelete: ['m1'] }, '', stubIo([]).io);
    expect(reportB.invalidInput).toBe(true);
    const reportC = await executeUndoPlan({ memberIdsToDelete: ['m1'] }, 'tree-1', null);
    expect(reportC.invalidInput).toBe(true);
  });

  it('kasus 5 gagal satu member: dicatat ke failedMembers, member berikutnya lanjut', async () => {
    const { io } = stubIo([], { failDeleteMember: (id) => id === 'm2' });
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['m1', 'm2', 'm3'], relationCountToReverse: 0, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.invalidInput).toBe(false);
    expect(report.failedMembers).toEqual([{ id: 'm2', error: 'del member m2 gagal' }]);
    expect(report.deletedMemberIds).toEqual(['m1', 'm3']);
    expect(io.deleteMember).toHaveBeenCalledTimes(3);
  });

  it('kasus 6 gagal satu relasi: dicatat ke failedRelations, relasi berikutnya lanjut', async () => {
    const { io } = stubIo(RELS, { failDeleteRelationship: (id) => id === 'r2' });
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['m1', 'm2'], relationCountToReverse: 2, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.invalidInput).toBe(false);
    expect(report.failedRelations).toEqual([{ id: 'r2', error: 'del rel r2 gagal' }]);
    expect(report.removedRelationIds).toEqual(['r1']);
    // Member tetap dihapus meski relasinya gagal dihapus (jujur per entri).
    expect(report.deletedMemberIds).toEqual(['m1', 'm2']);
  });

  it('kasus 7 relasi tak terkait tidak disentuh: hanya r yang menyentuh set yang dihapus', async () => {
    const { io } = stubIo(RELS);
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['m1'], relationCountToReverse: 1, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    // r2 menyentuh old-keep... r3 antar keep, tidak menyentuh m1: tak disentuh.
    expect(report.removedRelationIds).toEqual(['r1']);
    expect(io.deleteRelationship).toHaveBeenCalledTimes(1);
    expect(io.deleteRelationship).toHaveBeenCalledWith('r1');
    expect(report.deletedMemberIds).toEqual(['m1']);
  });

  it('kasus 8 plan kosong tanpa karya: io delete tak dipanggil, report bersih', async () => {
    const { io } = stubIo(RELS);
    const report = await executeUndoPlan(
      { memberIdsToDelete: [], relationCountToReverse: 0, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.invalidInput).toBe(false);
    expect(report.deletedMemberIds).toEqual([]);
    expect(report.removedRelationIds).toEqual([]);
    expect(io.listRelationships).toHaveBeenCalledTimes(1);
    expect(io.deleteRelationship).not.toHaveBeenCalled();
    expect(io.deleteMember).not.toHaveBeenCalled();
  });

  it('kasus 9 listRelationships gagal: invalidInput true, member tidak dihapus, error tercatat', async () => {
    const { io } = stubIo(RELS, { failList: true });
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['m1'], relationCountToReverse: 1, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.invalidInput).toBe(true);
    expect(report.deletedMemberIds).toEqual([]);
    expect(report.failedRelations).toHaveLength(1);
    expect(report.failedRelations[0].error).toContain('list down');
    expect(io.deleteRelationship).not.toHaveBeenCalled();
    expect(io.deleteMember).not.toHaveBeenCalled();
  });

  it('kasus 10 entri non-string dan id kosong di memberIdsToDelete di-skip tanpa lempar', async () => {
    const { io } = stubIo([]);
    const report = await executeUndoPlan(
      { memberIdsToDelete: ['', 42, null, 'm1'], relationCountToReverse: 0, safe: true, conflicts: [] },
      'tree-1',
      io,
    );
    expect(report.invalidInput).toBe(false);
    expect(report.deletedMemberIds).toEqual(['m1']);
    expect(io.deleteMember).toHaveBeenCalledTimes(1);
  });
});
