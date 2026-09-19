/**
 * Test eksekutor purge erasure fase II (STG v122-ii).
 * Kasus yang dijamin: due tercapai plus COMPLETED meredaksi semua field
 * PII, belum due atau status selain COMPLETED nihil, purge run kedua
 * idempoten, member hilang terpetakan, event audit tercatat sekali,
 * presisi field sesuai daftar target, dan determinisme hasil.
 */

import { describe, expect, it } from 'vitest';
import { executeErasurePurge, type ErasurePurgeExecuteDeps } from './erasure-purge-execute';
import { ERASURE_PURGE_FIELDS } from './erasure-purge-plan';
import type { ErasureEventRow, ErasureEventType } from './erasure-wiring';

const REQUESTED_AT = '2026-08-01T00:00:00.000Z';
const COMPLETED_AT = '2026-08-10T00:00:00.000Z';
const NOW_DUE = '2026-09-05T00:00:00.000Z';
const NOW_BEFORE = '2026-08-20T00:00:00.000Z';

const REPLAY_TYPES: ErasureEventType[] = [
  'erasure.requested',
  'erasure.completed',
  'erasure.cancelled',
];

interface FakeMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
  currentLocation: string | null;
  notes: string | null;
  privacyStatus: string;
}

function makeMember(): FakeMember {
  return {
    id: 'm-1',
    name: 'Budi Santoso',
    email: 'budi@contoh.id',
    phone: '0812000111',
    photoUrl: 'https://contoh.id/foto.jpg',
    currentLocation: 'Jakarta',
    notes: 'catatan pribadi',
    privacyStatus: 'LIVING',
  };
}

function requestedRow(): ErasureEventRow {
  return {
    type: 'erasure.requested',
    payloadJson: JSON.stringify({ memberId: 'm-1', requestedAt: REQUESTED_AT }),
  };
}

function completedRow(): ErasureEventRow {
  return {
    type: 'erasure.completed',
    payloadJson: JSON.stringify({ memberId: 'm-1', completedAt: COMPLETED_AT }),
  };
}

interface Env {
  deps: ErasurePurgeExecuteDeps;
  calls: { update: number; appended: number };
  ledger: ErasureEventRow[];
}

function makeEnv(
  member: FakeMember | null,
  now: string,
  rows: ErasureEventRow[],
): Env {
  const ledger: ErasureEventRow[] = rows.map((row) => ({ ...row }));
  const calls = { update: 0, appended: 0 };
  const deps: ErasurePurgeExecuteDeps = {
    async listEvents() {
      return ledger.filter(
        (row) => REPLAY_TYPES.includes(row.type) && row.payloadJson.includes('"memberId":"m-1"'),
      );
    },
    async getMember() {
      return member;
    },
    async updateMember(_id, updated) {
      calls.update += 1;
      Object.assign(member as unknown as Record<string, unknown>, updated);
    },
    async appendEvent(row) {
      calls.appended += 1;
      ledger.push({ ...row });
    },
    nowIso: () => now,
  };
  return { deps, calls, ledger };
}

describe('executeErasurePurge', () => {
  it('due tercapai plus COMPLETED: semua field PII ter-redaksi jadi null', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_DUE, [requestedRow(), completedRow()]);

    const result = await executeErasurePurge('m-1', env.deps);

    expect(result.success).toBe(true);
    expect(result.purged).toBe(true);
    for (const field of ERASURE_PURGE_FIELDS) {
      expect(member[field]).toBeNull();
    }
  });

  it('belum due: nihil berubah, member tidak disentuh', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_BEFORE, [requestedRow(), completedRow()]);

    const result = await executeErasurePurge('m-1', env.deps);

    expect(result.success).toBe(true);
    expect(result.purged).toBe(false);
    expect(env.calls.update).toBe(0);
    expect(env.calls.appended).toBe(0);
    expect(member.email).toBe('budi@contoh.id');
  });

  it('state selain COMPLETED ditolak lewat assertErasurePurgeAllowed, ter-map 409', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_DUE, [requestedRow()]);

    const result = await executeErasurePurge('m-1', env.deps);

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ status: 409, code: 'ERASURE_CONFLICT' });
    expect(env.calls.update).toBe(0);
    expect(member.email).toBe('budi@contoh.id');
  });

  it('ledger kosong: tidak ada permintaan erasure, ter-map 409', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_DUE, []);

    const result = await executeErasurePurge('m-1', env.deps);

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ status: 409, code: 'ERASURE_CONFLICT' });
    expect(env.calls.update).toBe(0);
  });

  it('idempoten: run kedua pada state yang sama nihil delta', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_DUE, [requestedRow(), completedRow()]);

    const first = await executeErasurePurge('m-1', env.deps);
    const updateAfterFirst = env.calls.update;
    const appendedAfterFirst = env.calls.appended;

    const second = await executeErasurePurge('m-1', env.deps);

    expect(first.purged).toBe(true);
    expect(second.success).toBe(true);
    expect(second.purged).toBe(false);
    expect(env.calls.update).toBe(updateAfterFirst);
    expect(env.calls.appended).toBe(appendedAfterFirst);
  });

  it('member hilang: error ter-map 400, tidak ada update maupun event', async () => {
    const env = makeEnv(null, NOW_DUE, [requestedRow(), completedRow()]);

    const result = await executeErasurePurge('m-1', env.deps);

    expect(result.success).toBe(false);
    expect(result.error).toMatchObject({ status: 400, code: 'ERASURE_VALIDATION' });
    expect(env.calls.update).toBe(0);
    expect(env.calls.appended).toBe(0);
  });

  it('event audit tercatat tepat sekali dengan tipe erasure.purged', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_DUE, [requestedRow(), completedRow()]);

    await executeErasurePurge('m-1', env.deps);

    const auditRows = env.ledger.filter((row) => row.type === 'erasure.purged');
    expect(auditRows).toHaveLength(1);
    const payload = JSON.parse(auditRows[0].payloadJson) as Record<string, unknown>;
    expect(payload.memberId).toBe('m-1');
    expect(payload.purgedAt).toBe(NOW_DUE);
    expect(payload.fields).toEqual([...ERASURE_PURGE_FIELDS]);
  });

  it('plan presisi: hanya field daftar ERASURE_PURGE_FIELDS yang tersentuh', async () => {
    const member = makeMember();
    const env = makeEnv(member, NOW_DUE, [requestedRow(), completedRow()]);

    const result = await executeErasurePurge('m-1', env.deps);

    expect(result.plan).not.toBeUndefined();
    expect(result.plan?.fields).toEqual([...ERASURE_PURGE_FIELDS]);
    expect(member.id).toBe('m-1');
    expect(member.name).toBe('Budi Santoso');
    expect(member.privacyStatus).toBe('LIVING');
  });

  it('determinisme: dua eksekusi pada input sama menghasilkan plan identik', async () => {
    const rows = [requestedRow(), completedRow()];
    const envA = makeEnv(makeMember(), NOW_DUE, rows);
    const envB = makeEnv(makeMember(), NOW_DUE, rows);

    const resultA = await executeErasurePurge('m-1', envA.deps);
    const resultB = await executeErasurePurge('m-1', envB.deps);

    expect(resultA.plan).toEqual(resultB.plan);
    expect(resultA.success).toBe(resultB.success);
    expect(resultA.purged).toBe(resultB.purged);
  });
});
