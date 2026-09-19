/**
 * Test scheduler purge erasure (STG v123-i).
 * Kasus yang dijamin: COMPLETED due terpurge sekali, belum due di-skip,
 * sudah purged idempoten tanpa dobel, campuran state, ringkasan hitungan,
 * determinisme urutan, deps error tertangani, nowIso konsisten, nihil due
 * nihil aksi, dua kandidat berurutan, kegagalan executePurge, dan replay
 * ledger rusak.
 */

import { describe, expect, it } from 'vitest';
import {
  scanErasurePurges,
  type ErasurePurgeSchedulerDeps,
} from './erasure-purge-scheduler';
import type { ErasureEventRow } from '../../lib/consent/erasure-wiring';
import type { ErasurePurgeExecuteResult } from '../../lib/consent/erasure-purge-execute';

const REQUESTED_AT = '2026-08-01T00:00:00.000Z';
const COMPLETED_AT = '2026-08-10T00:00:00.000Z';
const NOW_DUE = '2026-09-15T00:00:00.000Z';
const NOW_BEFORE = '2026-08-20T00:00:00.000Z';

function requestedRow(memberId: string): ErasureEventRow {
  return {
    type: 'erasure.requested',
    payloadJson: JSON.stringify({ memberId, requestedAt: REQUESTED_AT }),
  };
}

function completedRow(memberId: string): ErasureEventRow {
  return {
    type: 'erasure.completed',
    payloadJson: JSON.stringify({ memberId, completedAt: COMPLETED_AT }),
  };
}

/** Baris ledger pada test: gabungan tipe replay dan tipe audit erasure.purged. */
type LedgerRow = { type: string; payloadJson: string };

function purgedAuditRow(memberId: string): LedgerRow {
  return {
    type: 'erasure.purged',
    payloadJson: JSON.stringify({ memberId, purgedAt: NOW_DUE }),
  };
}

interface Env {
  deps: ErasurePurgeSchedulerDeps;
  purgeCalls: string[];
  ledgers: Map<string, LedgerRow[]>;
  nowCalls: number;
}

interface EnvOptions {
  now?: string;
  executePurgeOutcome?: (memberId: string) => ErasurePurgeExecuteResult;
  failListEventsFor?: string;
  failExecutePurgeFor?: string;
}

function makeEnv(
  members: string[],
  ledgersInit: Record<string, ErasureEventRow[]>,
  options: EnvOptions = {},
): Env {
  const ledgers = new Map<string, LedgerRow[]>();
  for (const [memberId, rows] of Object.entries(ledgersInit)) {
    ledgers.set(memberId, rows.map((row) => ({ ...row })));
  }
  const env: Env = {
    purgeCalls: [],
    ledgers,
    nowCalls: 0,
    deps: {} as ErasurePurgeSchedulerDeps,
  };
  const now = options.now ?? NOW_DUE;
  env.deps = {
    async listMemberIds() {
      return [...members];
    },
    async listEvents(memberId) {
      if (options.failListEventsFor === memberId) {
        throw new Error('ledger tidak terjangkau');
      }
      return (ledgers.get(memberId) ?? []) as ErasureEventRow[];
    },
    async executePurge(memberId) {
      if (options.failExecutePurgeFor === memberId) {
        throw new Error('eksekutor gagal');
      }
      env.purgeCalls.push(memberId);
      const outcome = options.executePurgeOutcome
        ? options.executePurgeOutcome(memberId)
        : { success: true, purged: true };
      if (outcome.success && outcome.purged) {
        ledgers.get(memberId)?.push(purgedAuditRow(memberId));
      }
      return outcome;
    },
    nowIso() {
      env.nowCalls += 1;
      return now;
    },
  };
  return env;
}

describe('scanErasurePurges', () => {
  it('COMPLETED due: terpurge tepat sekali dengan audit erasure.purged', async () => {
    const env = makeEnv(['m-1'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toEqual(['m-1']);
    expect(summary.purged).toEqual(['m-1']);
    expect(env.purgeCalls).toEqual(['m-1']);
    const audit = env.ledgers.get('m-1')?.filter((row) => row.type === 'erasure.purged');
    expect(audit).toHaveLength(1);
  });

  it('belum due: di-skip tanpa memanggil executePurge', async () => {
    const env = makeEnv(['m-1'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
    }, { now: NOW_BEFORE });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toEqual([]);
    expect(summary.purged).toEqual([]);
    expect(summary.skipped).toEqual(['m-1']);
    expect(env.purgeCalls).toEqual([]);
  });

  it('sudah purged: idempoten, scan ulang tidak memanggil executePurge dobel', async () => {
    const env = makeEnv(['m-1'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
    });

    const first = await scanErasurePurges(env.deps);
    const callsAfterFirst = env.purgeCalls.length;
    const second = await scanErasurePurges(env.deps);

    expect(first.purged).toEqual(['m-1']);
    expect(second.candidates).toEqual([]);
    expect(second.purged).toEqual([]);
    expect(second.skipped).toEqual(['m-1']);
    expect(env.purgeCalls).toHaveLength(callsAfterFirst);
    const audit = env.ledgers.get('m-1')?.filter((row) => row.type === 'erasure.purged');
    expect(audit).toHaveLength(1);
  });

  it('campuran state: hanya COMPLETED due yang diproses', async () => {
    const env = makeEnv(['m-req', 'm-can', 'm-done', 'm-early'], {
      'm-req': [requestedRow('m-req')],
      'm-can': [
        requestedRow('m-can'),
        {
          type: 'erasure.cancelled',
          payloadJson: JSON.stringify({ memberId: 'm-can', cancelledAt: COMPLETED_AT }),
        },
      ],
      'm-done': [requestedRow('m-done'), completedRow('m-done')],
      'm-early': [requestedRow('m-early'), completedRow('m-early')],
    }, { now: NOW_BEFORE });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.purged).toEqual([]);
    expect(summary.skipped.sort()).toEqual(['m-can', 'm-done', 'm-early', 'm-req']);
    expect(env.purgeCalls).toEqual([]);
  });

  it('ringkasan hitungan benar: panjang tiap kelompok sesuai isi', async () => {
    const env = makeEnv(['m-a', 'm-b', 'm-c'], {
      'm-a': [requestedRow('m-a'), completedRow('m-a')],
      'm-b': [requestedRow('m-b'), completedRow('m-b')],
      'm-c': [requestedRow('m-c')],
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toHaveLength(2);
    expect(summary.purged).toHaveLength(2);
    expect(summary.skipped).toHaveLength(1);
    expect(summary.skipped).toEqual(['m-c']);
  });

  it('determinisme urutan: input acak diproses terurut leksikografis', async () => {
    const env = makeEnv(['m-c', 'm-a', 'm-b'], {
      'm-a': [requestedRow('m-a'), completedRow('m-a')],
      'm-b': [requestedRow('m-b'), completedRow('m-b')],
      'm-c': [requestedRow('m-c'), completedRow('m-c')],
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toEqual(['m-a', 'm-b', 'm-c']);
    expect(env.purgeCalls).toEqual(['m-a', 'm-b', 'm-c']);
    expect(summary.purged).toEqual(['m-a', 'm-b', 'm-c']);
  });

  it('deps error ditangani: listEvents gagal tetap skip, member lain tetap diproses', async () => {
    const env = makeEnv(['m-rusak', 'm-sehat'], {
      'm-sehat': [requestedRow('m-sehat'), completedRow('m-sehat')],
    }, { failListEventsFor: 'm-rusak' });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.purged).toEqual(['m-sehat']);
    expect(summary.skipped).toEqual(['m-rusak']);
    expect(env.purgeCalls).toEqual(['m-sehat']);
  });

  it('nowIso konsisten: dipanggil satu kali untuk seluruh scan', async () => {
    const env = makeEnv(['m-1', 'm-2'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
      'm-2': [requestedRow('m-2'), completedRow('m-2')],
    });

    await scanErasurePurges(env.deps);

    expect(env.nowCalls).toBe(1);
    expect(env.purgeCalls).toEqual(['m-1', 'm-2']);
  });

  it('nihil due nihil aksi: tanpa kandidat, tanpa panggilan eksekusi', async () => {
    const env = makeEnv(['m-1'], {
      'm-1': [],
    }, { now: NOW_BEFORE });

    const summary = await scanErasurePurges(env.deps);

    expect(summary).toEqual({ candidates: [], purged: [], skipped: ['m-1'] });
    expect(env.purgeCalls).toEqual([]);
  });

  it('dua kandidat berurutan: keduanya terpurge pada scan yang sama', async () => {
    const env = makeEnv(['m-2', 'm-1'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
      'm-2': [requestedRow('m-2'), completedRow('m-2')],
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toEqual(['m-1', 'm-2']);
    expect(summary.purged).toEqual(['m-1', 'm-2']);
    expect(env.purgeCalls).toEqual(['m-1', 'm-2']);
  });

  it('executePurge gagal: kandidat terhitung tapi masuk skipped tanpa purged', async () => {
    const env = makeEnv(['m-1', 'm-gagal'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
      'm-gagal': [requestedRow('m-gagal'), completedRow('m-gagal')],
    }, {
      failExecutePurgeFor: 'm-gagal',
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toEqual(['m-1', 'm-gagal']);
    expect(summary.purged).toEqual(['m-1']);
    expect(summary.skipped).toEqual(['m-gagal']);
  });

  it('executePurge melaporkan purged false: tidak masuk daftar purged', async () => {
    const env = makeEnv(['m-1'], {
      'm-1': [requestedRow('m-1'), completedRow('m-1')],
    }, {
      executePurgeOutcome: () => ({ success: true, purged: false, message: 'sudah bersih' }),
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.candidates).toEqual(['m-1']);
    expect(summary.purged).toEqual([]);
    expect(summary.skipped).toEqual(['m-1']);
  });

  it('replay ledger rusak: transisi ilegal membuat member di-skip tanpa crash', async () => {
    const env = makeEnv(['m-rusak', 'm-sehat'], {
      'm-rusak': [completedRow('m-rusak')],
      'm-sehat': [requestedRow('m-sehat'), completedRow('m-sehat')],
    });

    const summary = await scanErasurePurges(env.deps);

    expect(summary.skipped).toEqual(['m-rusak']);
    expect(summary.purged).toEqual(['m-sehat']);
  });
});
