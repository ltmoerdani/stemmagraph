/**
 * Jurnal merge dan rencana un-merge anggota, logika keputusan pure
 * (v391 Un-Merge via Jurnal Merge fase 1).
 *
 * Modul ini TIDAK menyentuh database. Dua fungsi inti:
 * - buildMergeJournal: menyusun snapshot reverse yang ditulis ATOMIK
 *   bersama operasi merge (transaksi yang sama, server/index.ts),
 * - planUnmerge: memverifikasi jurnal terhadap state terkini lalu
 *   menghasilkan daftar operasi balik atau kode guard 422.
 *
 * Kontrak GOAL v391: jurnal memuat daftar relasi rewire dengan sisi
 * asal, relasi terhapus dengan data penuh, id genealogyEvent dan
 * lifeEvent yang dipindah, id dan nama primary, timestamp. Un-merge
 * membalikan persis dari jurnal; baris duplikat tidak pernah dihapus
 * (hanya penanda mergedIntoId/mergedAt/mergeJournal yang dibersihkan).
 * Deterministik, tanpa I/O, tanpa dependency.
 */

/** Sisi baris relasi yang di-update saat merge (sisi asal rewire). */
export type RewireSide = 'memberId' | 'relatedId';

/** Satu entri rewire: snapshot baris relasi PASCA update. */
export interface JournalRewireEntry {
  relationId: string;
  /** Sisi yang diarahkan dari duplikat ke primary saat merge. */
  side: RewireSide;
  /** Nilai ketiga kolom setelah rewire (verifikasi state saat unmerge). */
  memberId: string;
  relatedId: string;
  type: string;
}

/** Satu relasi terhapus saat merge, data penuh untuk recreate. */
export interface JournalDeletedEntry {
  id: string;
  treeId: string;
  memberId: string;
  relatedId: string;
  type: string;
}

/** Snapshot reverse merge, disimpan di FamilyMember.mergeJournal (Json). */
export interface MergeJournal {
  version: 1;
  mergedAt: string;
  duplicateId: string;
  primary: { id: string; name: string };
  rewire: JournalRewireEntry[];
  deleted: JournalDeletedEntry[];
  movedGenealogyEventIds: string[];
  movedLifeEventIds: string[];
}

/** Bentuk baris relasi penuh yang dibutuhkan penyusun jurnal. */
export interface JournalRelRow {
  id: string;
  treeId: string;
  memberId: string;
  relatedId: string;
  type: string;
}

export interface BuildMergeJournalInput {
  duplicateId: string;
  primary: { id: string; name: string };
  mergedAt: Date;
  /** Entri rewire: { relasi, sisi asal } pasca update. */
  rewire: Array<{ rel: JournalRelRow; side: RewireSide }>;
  /** Relasi yang dihapus merge, data penuh sebelum dihapus. */
  deleted: JournalRelRow[];
  movedGenealogyEventIds: string[];
  movedLifeEventIds: string[];
}

/**
 * Susun snapshot jurnal dari keputusan merge. Dipanggil di route merge
 * SEBELUM transaksi; objek yang dihasilkan ditulis di operasi penandaan
 * merged yang sama sehingga merge dan jurnal atomik.
 */
export function buildMergeJournal(input: BuildMergeJournalInput): MergeJournal {
  return {
    version: 1,
    mergedAt: input.mergedAt.toISOString(),
    duplicateId: input.duplicateId,
    primary: { id: input.primary.id, name: input.primary.name },
    rewire: input.rewire.map((r) => ({
      relationId: r.rel.id,
      side: r.side,
      memberId: r.rel.memberId,
      relatedId: r.rel.relatedId,
      type: r.rel.type,
    })),
    deleted: input.deleted.map((d) => ({
      id: d.id,
      treeId: d.treeId,
      memberId: d.memberId,
      relatedId: d.relatedId,
      type: d.type,
    })),
    movedGenealogyEventIds: [...input.movedGenealogyEventIds],
    movedLifeEventIds: [...input.movedLifeEventIds],
  };
}

/** Operasi balik hasil planUnmerge; eksekusi transaksional ada di server. */
export type UnmergeOp =
  | { kind: 'rewireBack'; relationId: string; side: RewireSide; duplicateId: string }
  | { kind: 'deleteRecreated'; relationId: string }
  | { kind: 'moveBackGenealogyEvent'; eventId: string; duplicateId: string }
  | { kind: 'moveBackLifeEvent'; eventId: string; duplicateId: string }
  | { kind: 'clearMerge'; duplicateId: string };

export type UnmergePlan = { ok: true; ops: UnmergeOp[] } | { ok: false; code: 'JOURNAL_MISMATCH' };

export interface PlanUnmergeInput {
  journal: MergeJournal;
  /** Id member yang di-unmerge (harus cocok jurnal). */
  duplicateId: string;
  /** Id primary live saat ini (dari mergedIntoId baris duplikat). */
  currentPrimaryId: string;
  /** Semua relasi tree saat ini (id, memberId, relatedId, type). */
  rels: Array<Pick<JournalRelRow, 'id' | 'memberId' | 'relatedId' | 'type'>>;
  /** Id genealogyEvent yang SAAT INI menempel di primary. */
  currentGenealogyEventIds: string[];
  /** Id lifeEvent yang SAAT INI menempel di primary. */
  currentLifeEventIds: string[];
}

/**
 * Verifikasi jurnal terhadap state terkini dan susun operasi balik.
 * Guard kasus luar (belum merged, tanpa jurnal, primary merged ke pihak
 * lain) diambil dari baris duplikat/primary di server; plan ini fokus
 * pada mismatch struktural jurnal (422 JOURNAL_MISMATCH).
 */
export function planUnmerge(input: PlanUnmergeInput): UnmergePlan {
  const j = input.journal;
  if (
    j === null ||
    typeof j !== 'object' ||
    j.version !== 1 ||
    j.duplicateId !== input.duplicateId ||
    j.primary?.id !== input.currentPrimaryId ||
    !Array.isArray(j.rewire) ||
    !Array.isArray(j.deleted) ||
    !Array.isArray(j.movedGenealogyEventIds) ||
    !Array.isArray(j.movedLifeEventIds)
  ) {
    return { ok: false, code: 'JOURNAL_MISMATCH' };
  }
  const relById = new Map(input.rels.map((r) => [r.id, r]));
  const ops: UnmergeOp[] = [];

  // rewire balik: baris harus ada dengan isi PERSIS snapshot pasca merge,
  // lalu sisi asal diarahkan kembali ke duplikat.
  for (const entry of j.rewire) {
    const rel = relById.get(entry.relationId);
    if (!rel) return { ok: false, code: 'JOURNAL_MISMATCH' };
    if (
      rel.memberId !== entry.memberId ||
      rel.relatedId !== entry.relatedId ||
      rel.type !== entry.type ||
      (entry.side !== 'memberId' && entry.side !== 'relatedId') ||
      rel[entry.side] !== input.currentPrimaryId
    ) {
      return { ok: false, code: 'JOURNAL_MISMATCH' };
    }
    ops.push({ kind: 'rewireBack', relationId: entry.relationId, side: entry.side, duplicateId: input.duplicateId });
  }

  // relasi yang dulu dihapus harus TIDAK ada lagi; recreate data penuh.
  for (const d of j.deleted) {
    if (relById.has(d.id)) return { ok: false, code: 'JOURNAL_MISMATCH' };
    ops.push({ kind: 'deleteRecreated', relationId: d.id });
  }

  // events yang dipindah harus masih menempel di primary.
  const geneSet = new Set(input.currentGenealogyEventIds);
  for (const id of j.movedGenealogyEventIds) {
    if (!geneSet.has(id)) return { ok: false, code: 'JOURNAL_MISMATCH' };
    ops.push({ kind: 'moveBackGenealogyEvent', eventId: id, duplicateId: input.duplicateId });
  }
  const lifeSet = new Set(input.currentLifeEventIds);
  for (const id of j.movedLifeEventIds) {
    if (!lifeSet.has(id)) return { ok: false, code: 'JOURNAL_MISMATCH' };
    ops.push({ kind: 'moveBackLifeEvent', eventId: id, duplicateId: input.duplicateId });
  }

  ops.push({ kind: 'clearMerge', duplicateId: input.duplicateId });
  return { ok: true, ops };
}
