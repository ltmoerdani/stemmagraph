/**
 * Test modul pure mergeJournal (v391): builder snapshot dan planUnmerge.
 * Pola src/lib/dedup/mergeMembers.test.ts: data polos, tanpa I/O.
 */
import { describe, it, expect } from 'vitest';
import {
  buildMergeJournal,
  planUnmerge,
  type MergeJournal,
  type JournalRelRow,
} from './mergeJournal';

const RELS: JournalRelRow[] = [
  { id: 'r-w', treeId: 'tree-1', memberId: 'w-1', relatedId: 'pri-1', type: 'spouse' },
  { id: 'r-d', treeId: 'tree-1', memberId: 'pri-1', relatedId: 'dup-1', type: 'parent' },
];

function jurnalContoh(): MergeJournal {
  return buildMergeJournal({
    duplicateId: 'dup-1',
    primary: { id: 'pri-1', name: 'Andi' },
    mergedAt: new Date('2026-10-25T00:00:00.000Z'),
    rewire: [{ rel: RELS[0]!, side: 'relatedId' }],
    deleted: [RELS[1]!],
    movedGenealogyEventIds: ['e-1'],
    movedLifeEventIds: ['le-1'],
  });
}

describe('buildMergeJournal (v391)', () => {
  it('menghasilkan snapshot lengkap: rewire per sisi asal, deleted penuh, events, primary, timestamp', () => {
    const j = jurnalContoh();
    expect(j.version).toBe(1);
    expect(j.duplicateId).toBe('dup-1');
    expect(j.primary).toEqual({ id: 'pri-1', name: 'Andi' });
    expect(j.mergedAt).toBe('2026-10-25T00:00:00.000Z');
    expect(j.rewire).toEqual([
      { relationId: 'r-w', side: 'relatedId', memberId: 'w-1', relatedId: 'pri-1', type: 'spouse' },
    ]);
    expect(j.deleted).toEqual([
      { id: 'r-d', treeId: 'tree-1', memberId: 'pri-1', relatedId: 'dup-1', type: 'parent' },
    ]);
    expect(j.movedGenealogyEventIds).toEqual(['e-1']);
    expect(j.movedLifeEventIds).toEqual(['le-1']);
  });

  it('tidak membagikan referensi array input (salinan defensif)', () => {
    const ids = ['e-1'];
    const j = buildMergeJournal({
      duplicateId: 'dup-1',
      primary: { id: 'pri-1', name: 'Andi' },
      mergedAt: new Date(0),
      rewire: [],
      deleted: [],
      movedGenealogyEventIds: ids,
      movedLifeEventIds: [],
    });
    ids.push('e-2');
    expect(j.movedGenealogyEventIds).toEqual(['e-1']);
  });
});

describe('planUnmerge (v391)', () => {
  const BASE = {
    duplicateId: 'dup-1',
    currentPrimaryId: 'pri-1',
    rels: [{ id: 'r-w', memberId: 'w-1', relatedId: 'pri-1', type: 'spouse' }],
    currentGenealogyEventIds: ['e-1'],
    currentLifeEventIds: ['le-1'],
  };

  it('jurnal cocok: ops balik lengkap dalam urutan deterministik', () => {
    const plan = planUnmerge({ journal: jurnalContoh(), ...BASE });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.ops).toEqual([
      { kind: 'rewireBack', relationId: 'r-w', side: 'relatedId', duplicateId: 'dup-1' },
      { kind: 'deleteRecreated', relationId: 'r-d' },
      { kind: 'moveBackGenealogyEvent', eventId: 'e-1', duplicateId: 'dup-1' },
      { kind: 'moveBackLifeEvent', eventId: 'le-1', duplicateId: 'dup-1' },
      { kind: 'clearMerge', duplicateId: 'dup-1' },
    ]);
  });

  it('relasi rewire hilang: JOURNAL_MISMATCH', () => {
    const plan = planUnmerge({ journal: jurnalContoh(), ...BASE, rels: [] });
    expect(plan).toEqual({ ok: false, code: 'JOURNAL_MISMATCH' });
  });

  it('relasi rewire isi berubah sejak merge: JOURNAL_MISMATCH', () => {
    const plan = planUnmerge({
      journal: jurnalContoh(),
      ...BASE,
      rels: [{ id: 'r-w', memberId: 'w-1', relatedId: 'ORANG-LAIN', type: 'spouse' }],
    });
    expect(plan).toEqual({ ok: false, code: 'JOURNAL_MISMATCH' });
  });

  it('relasi terhapus ternyata hidup lagi: JOURNAL_MISMATCH', () => {
    const plan = planUnmerge({
      journal: jurnalContoh(),
      ...BASE,
      rels: [
        { id: 'r-w', memberId: 'w-1', relatedId: 'pri-1', type: 'spouse' },
        { id: 'r-d', memberId: 'pri-1', relatedId: 'dup-1', type: 'parent' },
      ],
    });
    expect(plan).toEqual({ ok: false, code: 'JOURNAL_MISMATCH' });
  });

  it('event pindah tidak lagi di primary: JOURNAL_MISMATCH', () => {
    const plan = planUnmerge({ journal: jurnalContoh(), ...BASE, currentGenealogyEventIds: [] });
    expect(plan).toEqual({ ok: false, code: 'JOURNAL_MISMATCH' });
  });

  it('primary id di jurnal beda dengan state: JOURNAL_MISMATCH', () => {
    const j = { ...jurnalContoh(), primary: { id: 'pri-9', name: 'Andi' } };
    const plan = planUnmerge({ journal: j, ...BASE });
    expect(plan).toEqual({ ok: false, code: 'JOURNAL_MISMATCH' });
  });

  it('jurnal rusak (bukan objek / version salah): JOURNAL_MISMATCH', () => {
    const rusak = { version: 99, duplicateId: 'dup-1' } as unknown as MergeJournal;
    expect(planUnmerge({ journal: rusak, ...BASE })).toEqual({ ok: false, code: 'JOURNAL_MISMATCH' });
    expect(planUnmerge({ journal: null as unknown as MergeJournal, ...BASE })).toEqual({
      ok: false,
      code: 'JOURNAL_MISMATCH',
    });
  });

  it('tanpa rewire dan tanpa deleted: tetap valid, hanya moveback dan clearMerge', () => {
    const j = buildMergeJournal({
      duplicateId: 'dup-1',
      primary: { id: 'pri-1', name: 'Andi' },
      mergedAt: new Date(0),
      rewire: [],
      deleted: [],
      movedGenealogyEventIds: [],
      movedLifeEventIds: [],
    });
    const plan = planUnmerge({ journal: j, ...BASE, currentGenealogyEventIds: [], currentLifeEventIds: [] });
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.ops).toEqual([{ kind: 'clearMerge', duplicateId: 'dup-1' }]);
  });
});
