// Test flushOutbox dengan deps in-memory murni: tidak menyentuh idb,
// array entries dimanipulasi langsung oleh helper flushDepsOver.
// v113: kasus baru mencakup retry backoff, batas MAX_ATTEMPTS, error kontrak,
// dan purge retensi 24 jam.
import { describe, it, expect } from 'vitest';
import { flushOutbox, type FlushDeps, type FlushStatus } from './flush';
import { MAX_ATTEMPTS } from './backoff';
import type { OutboxEntry } from './outbox';

const HOUR = 60 * 60 * 1000;

function makeEntry(
  id: string,
  batchKey: string,
  createdAt: number,
  extra: Partial<OutboxEntry> = {}
): OutboxEntry {
  return { id, batchKey, kind: 'member.add', memberId: 'member-' + id, createdAt, ...extra };
}

interface StatusRecord {
  status: FlushStatus;
  remaining: number;
}

// Helper: deps nyata yang memanipulasi array entries yang sama (mutabel).
// sendBatch yang gagal transport tercatat di attempts, tidak di sendCalls.
function flushDepsOver(entries: OutboxEntry[], now: () => number = () => 0) {
  const statusLog: StatusRecord[] = [];
  const sendCalls: Array<{ entries: OutboxEntry[]; batchKey: string }> = [];
  const attempts: string[] = [];
  const clearedCalls: string[][] = [];
  const delays: number[] = [];
  const deletedIds: string[][] = [];
  const persistedEntries: OutboxEntry[] = [];
  const failedKeys = new Set<string>();
  const contractKeys = new Set<string>();

  const deps: FlushDeps = {
    listEntries: async () => [...entries],
    sendBatch: async (batchEntries, batchKey) => {
      attempts.push(batchKey);
      if (failedKeys.has(batchKey)) {
        throw new Error('transport gagal: ' + batchKey);
      }
      if (contractKeys.has(batchKey)) {
        const error = new Error('kontrak: ' + batchKey);
        error.name = 'ContractError';
        throw error;
      }
      sendCalls.push({ entries: batchEntries, batchKey });
    },
    clearBatch: async (keys) => {
      clearedCalls.push(keys);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (keys.includes(entries[i].batchKey)) {
          entries.splice(i, 1);
        }
      }
    },
    onStatus: (status, remaining) => {
      statusLog.push({ status, remaining });
    },
    delay: async (ms) => {
      delays.push(ms);
    },
    now,
    rng: () => 1,
    deleteEntries: async (ids) => {
      deletedIds.push(ids);
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (ids.includes(entries[i].id)) {
          entries.splice(i, 1);
        }
      }
    },
    persistEntry: async (entry) => {
      persistedEntries.push({ ...entry });
    },
  };

  return {
    deps,
    statusLog,
    sendCalls,
    attempts,
    clearedCalls,
    delays,
    deletedIds,
    persistedEntries,
    failBatch(batchKey: string) {
      failedKeys.add(batchKey);
    },
    failContract(batchKey: string) {
      contractKeys.add(batchKey);
    },
  };
}

describe('flushOutbox (v112 perilaku existing)', () => {
  it('outbox kosong: status empty remaining 0, sendBatch dan clearBatch tidak dipanggil', async () => {
    const h = flushDepsOver([]);

    await flushOutbox(h.deps);

    expect(h.statusLog).toEqual([{ status: 'empty', remaining: 0 }]);
    expect(h.sendCalls).toHaveLength(0);
    expect(h.clearedCalls).toHaveLength(0);
  });

  it('satu batch sukses: sendBatch sekali dengan entries dan batchKey benar, clearBatch [batchKey], flushed remaining 0', async () => {
    const entries = [makeEntry('e1', 'b1', 1), makeEntry('e2', 'b1', 2)];
    const h = flushDepsOver(entries);

    await flushOutbox(h.deps);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].batchKey).toBe('b1');
    expect(h.sendCalls[0].entries.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(h.clearedCalls).toEqual([['b1']]);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
    expect(entries).toHaveLength(0);
  });

  it('transport gagal di satu-satunya batch: retry sampai MAX_ATTEMPTS, clearBatch tidak dipanggil, failed remaining = jumlah entry', async () => {
    const entries = [
      makeEntry('e1', 'b1', 1),
      makeEntry('e2', 'b1', 2),
      makeEntry('e3', 'b1', 3),
    ];
    const h = flushDepsOver(entries);
    h.failBatch('b1');

    await flushOutbox(h.deps);

    expect(h.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(h.clearedCalls).toHaveLength(0);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 3 }]);
    expect(entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(entries[0].status).toBe('failed');
  });

  it('batch pertama sukses kedua gagal: clearBatch hanya batch pertama, remaining = entry batch kedua, urutan sendBatch ikut createdAt', async () => {
    const entries = [
      makeEntry('a1', 'batch-a', 1),
      makeEntry('a2', 'batch-a', 2),
      makeEntry('b1', 'batch-b', 10),
      makeEntry('b2', 'batch-b', 11),
      makeEntry('b3', 'batch-b', 12),
    ];
    const h = flushDepsOver(entries);
    h.failBatch('batch-b');

    await flushOutbox(h.deps);

    // batch-a sukses sekali; batch-b di-retry sampai MAX_ATTEMPTS lalu berhenti.
    expect(h.attempts[0]).toBe('batch-a');
    expect(h.attempts.filter((k) => k === 'batch-b')).toHaveLength(MAX_ATTEMPTS);
    expect(h.clearedCalls).toEqual([['batch-a']]);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 3 }]);
    expect(entries.map((e) => e.id).sort()).toEqual(['b1', 'b2', 'b3']);
    expect(entries[0].status).toBe('failed');
  });

  it('grouping: 3 entry batchKey sama dengan input acak terkirim sebagai satu panggilan urut createdAt', async () => {
    const entries = [makeEntry('e3', 'b1', 30), makeEntry('e1', 'b1', 10), makeEntry('e2', 'b1', 20)];
    const h = flushDepsOver(entries);

    await flushOutbox(h.deps);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
  });

  it('dua batchKey berbeda terkirim dua panggilan berurutan sesuai createdAt terkecil tiap grup', async () => {
    const entries = [
      makeEntry('z1', 'batch-z', 50),
      makeEntry('a1', 'batch-a', 5),
      makeEntry('z2', 'batch-z', 51),
    ];
    const h = flushDepsOver(entries);

    await flushOutbox(h.deps);

    expect(h.sendCalls.map((c) => c.batchKey)).toEqual(['batch-a', 'batch-z']);
    expect(h.clearedCalls).toEqual([['batch-a'], ['batch-z']]);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
  });

  it('onStatus tidak diberikan: tidak throw, alur tetap jalan sampai clearBatch', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const deps: FlushDeps = {
      listEntries: async () => [...entries],
      sendBatch: async () => undefined,
      clearBatch: async (keys) => {
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          if (keys.includes(entries[i].batchKey)) {
            entries.splice(i, 1);
          }
        }
      },
      delay: async () => undefined,
    };

    await expect(flushOutbox(deps)).resolves.toBeUndefined();
    expect(entries).toHaveLength(0);
  });
});

describe('flushOutbox retry transport v113', () => {
  it('transport gagal lalu sukses: retry dengan backoff, clearBatch tetap jalan, flushed', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const h = flushDepsOver(entries);
    let calls = 0;
    const original = h.deps.sendBatch;
    h.deps.sendBatch = async (batchEntries, batchKey) => {
      calls += 1;
      if (calls === 1) {
        throw new Error('transport gagal sekali');
      }
      return original(batchEntries, batchKey);
    };

    await flushOutbox(h.deps);

    // Panggilan pertama throw sebelum tercatat di attempts; yang tercatat
    // hanya percobaan kedua yang mencapai sendBatch asli.
    expect(calls).toBe(2);
    expect(h.attempts).toHaveLength(1);
    expect(h.delays).toEqual([1000]);
    expect(h.clearedCalls).toEqual([['b1']]);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
    expect(entries).toHaveLength(0);
  });

  it('MAX_ATTEMPTS transport gagal: berhenti, batch tetap di outbox, status failed + lastError, remaining benar', async () => {
    const entries = [
      makeEntry('e1', 'b1', 1),
      makeEntry('e2', 'b1', 2),
      makeEntry('e3', 'b2', 10),
    ];
    const h = flushDepsOver(entries);
    h.failBatch('b1');

    await flushOutbox(h.deps);

    expect(h.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(h.attempts.every((k) => k === 'b1')).toBe(true);
    // Backoff antar percobaan: 4 delay (setelah percobaan 1..4), attempt 1..4.
    expect(h.delays).toEqual([1000, 2000, 4000, 8000]);
    expect(h.clearedCalls).toHaveLength(0);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 3 }]);
    expect(entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(entries[0].status).toBe('failed');
    expect(entries[0].lastError).toContain('b1');
  });

  it('error kontrak 4xx: tidak di-retry, tidak menaikkan attempt, tidak ada delay, batch tetap di outbox', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const h = flushDepsOver(entries);
    h.failContract('b1');

    await flushOutbox(h.deps);

    expect(h.attempts).toEqual(['b1']);
    expect(h.delays).toEqual([]);
    expect(h.clearedCalls).toHaveLength(0);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 1 }]);
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe('failed');
    expect(entries[0].lastError).toContain('kontrak');
  });

  it('retry backoff mengikuti urutan attempt: delay percobaan ke-n = computeBackoff(n)', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const h = flushDepsOver(entries);
    let calls = 0;
    const original = h.deps.sendBatch;
    h.deps.sendBatch = async (batchEntries, batchKey) => {
      calls += 1;
      if (calls <= 3) {
        throw new Error('transport gagal tiga kali');
      }
      return original(batchEntries, batchKey);
    };

    await flushOutbox(h.deps);

    expect(h.delays).toEqual([1000, 2000, 4000]);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
  });

  it('persistEntry terpanggil per entry dengan status failed dan lastError berisi batchKey saat MAX_ATTEMPTS habis', async () => {
    const entries = [
      makeEntry('e1', 'b1', 1),
      makeEntry('e2', 'b1', 2),
    ];
    const h = flushDepsOver(entries);
    h.failBatch('b1');

    await flushOutbox(h.deps);

    expect(h.attempts).toHaveLength(MAX_ATTEMPTS);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 2 }]);
    expect(h.persistedEntries).toHaveLength(2);
    expect(h.persistedEntries.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
    for (const persisted of h.persistedEntries) {
      expect(persisted.status).toBe('failed');
      expect(persisted.lastError).toContain('b1');
    }
  });

  it('persistEntry gagal throw: siklus tetap jalan, penandaan in-memory tetap terisi, tidak menghentikan flush', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const h = flushDepsOver(entries);
    h.failBatch('b1');
    h.deps.persistEntry = async () => {
      throw new Error('idb error');
    };

    await expect(flushOutbox(h.deps)).resolves.toBeUndefined();

    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 1 }]);
    expect(entries[0].status).toBe('failed');
    expect(entries[0].lastError).toContain('b1');
  });

  it('persistEntry tidak diberikan: penandaan failed tetap jalan tanpa error (opsional)', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const h = flushDepsOver(entries);
    h.failBatch('b1');
    delete h.deps.persistEntry;

    await expect(flushOutbox(h.deps)).resolves.toBeUndefined();

    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 1 }]);
    expect(entries[0].status).toBe('failed');
  });
});

describe('flushOutbox purge retensi v113', () => {
  it('failed 25 jam dibuang di awal siklus, pending 25 jam dan failed 23 jam aman', async () => {
    const NOW = 100 * HOUR;
    const entries = [
      makeEntry('old-failed', 'b1', NOW - 25 * HOUR, { status: 'failed' }),
      makeEntry('young-failed', 'b2', NOW - 23 * HOUR, { status: 'failed' }),
      makeEntry('old-pending', 'b3', NOW - 25 * HOUR),
    ];
    const h = flushDepsOver(entries, () => NOW);

    await flushOutbox(h.deps);

    expect(h.deletedIds).toEqual([['old-failed']]);
    // Urutan pengiriman mengikuti createdAt: b3 (25 jam lalu) sebelum b2 (23 jam).
    expect(h.sendCalls.map((c) => c.batchKey)).toEqual(['b3', 'b2']);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
    // Kedua batch tersisa sukses terkirim lalu dibersihkan dari outbox.
    expect(entries).toHaveLength(0);
  });

  it('semua entry failed expired: status empty, tidak ada sendBatch', async () => {
    const NOW = 50 * HOUR;
    const entries = [
      makeEntry('f1', 'b1', NOW - 30 * HOUR, { status: 'failed' }),
      makeEntry('f2', 'b2', NOW - 25 * HOUR, { status: 'failed' }),
    ];
    const h = flushDepsOver(entries, () => NOW);

    await flushOutbox(h.deps);

    expect(h.deletedIds).toHaveLength(1);
    expect(h.deletedIds[0].sort()).toEqual(['f1', 'f2']);
    expect(h.sendCalls).toHaveLength(0);
    expect(h.statusLog).toEqual([{ status: 'empty', remaining: 0 }]);
    expect(entries).toHaveLength(0);
  });

  it('entry tanpa status dianggap pending: tidak dibuang walau lebih tua 25 jam', async () => {
    const NOW = 100 * HOUR;
    const entries = [makeEntry('legacy', 'b1', NOW - 25 * HOUR)];
    const h = flushDepsOver(entries, () => NOW);

    await flushOutbox(h.deps);

    expect(h.deletedIds).toHaveLength(0);
    expect(h.sendCalls).toHaveLength(1);
    expect(entries).toHaveLength(0);
  });
});
