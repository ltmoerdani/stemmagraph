/**
 * Modul pure scheduler purge erasure (STG v123-i).
 * Memindai daftar member, mengevaluasi status COMPLETED dan tenggat dueAt,
 * serta memanggil eksekutor purge untuk kandidat yang memenuhi syarat.
 * Murni tanpa IO langsung dan tanpa import express/server/index.
 */

import {
  erasureStateFromEvents,
  type ErasureEventRow,
} from '../../lib/consent/erasure-wiring';
import {
  isErasurePurgeDue,
} from '../../lib/consent/erasure-purge-plan';
import type {
  ErasurePurgeExecuteResult,
} from '../../lib/consent/erasure-purge-execute';

export interface ErasurePurgeSchedulerDeps {
  listMemberIds(): Promise<string[]>;
  listEvents(memberId: string): Promise<ErasureEventRow[]>;
  executePurge(memberId: string): Promise<ErasurePurgeExecuteResult>;
  nowIso(): string;
}

export interface ErasurePurgeSchedulerSummary {
  candidates: string[];
  purged: string[];
  skipped: string[];
}

const REPLAY_EVENT_TYPES = new Set(['erasure.requested', 'erasure.completed', 'erasure.cancelled']);

/**
 * Pindai dan jalankan purge erasure untuk semua member yang memenuhi syarat due.
 * Replay event ledger via erasureStateFromEvents, pilih state COMPLETED,
 * cek tenggat via isErasurePurgeDue, lewati yang belum due atau sudah ter-purge,
 * panggil executePurge per kandidat, dan kembalikan ringkasan deterministik.
 */
export async function scanErasurePurges(
  deps: ErasurePurgeSchedulerDeps,
):
  Promise<ErasurePurgeSchedulerSummary> {
  const memberIds = await deps.listMemberIds();
  const sortedMemberIds = [...memberIds].sort();

  const candidates: string[] = [];
  const purged: string[] = [];
  const skipped: string[] = [];
  const now = deps.nowIso();

  for (const memberId of sortedMemberIds) {
    let events: ErasureEventRow[];
    try {
      events = await deps.listEvents(memberId);
    } catch {
      skipped.push(memberId);
      continue;
    }

    const hasPurgedAudit = events.some((row) => row.type === ('erasure.purged' as string));
    if (hasPurgedAudit) {
      skipped.push(memberId);
      continue;
    }

    const replayRows = events.filter((row) => REPLAY_EVENT_TYPES.has(row.type));
    let state;
    try {
      state = erasureStateFromEvents(replayRows);
    } catch {
      skipped.push(memberId);
      continue;
    }

    if (!state || state.status !== 'COMPLETED' || !state.dueAt) {
      skipped.push(memberId);
      continue;
    }

    let due = false;
    try {
      due = isErasurePurgeDue(state.dueAt, now);
    } catch {
      skipped.push(memberId);
      continue;
    }

    if (!due) {
      skipped.push(memberId);
      continue;
    }

    candidates.push(memberId);
    let execResult: ErasurePurgeExecuteResult;
    try {
      execResult = await deps.executePurge(memberId);
    } catch {
      skipped.push(memberId);
      continue;
    }

    if (execResult.success && execResult.purged) {
      purged.push(memberId);
    } else {
      skipped.push(memberId);
    }
  }

  return {
    candidates,
    purged,
    skipped,
  };
}
