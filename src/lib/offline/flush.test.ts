// Test flushOutbox dengan deps in-memory murni: tidak menyentuh idb,
// array entries dimanipulasi langsung oleh helper flushDepsOver.
import { describe, it, expect } from 'vitest';
import { flushOutbox, type FlushDeps, type FlushStatus } from './flush';
import type { OutboxEntry } from './outbox';

function makeEntry(id: string, batchKey: string, createdAt: number): OutboxEntry {
  return { id, batchKey, kind: 'member.add', memberId: 'member-' + id, createdAt };
}

interface StatusRecord {
  status: FlushStatus;
  remaining: number;
}

// Helper: deps nyata yang memanipulasi array entries yang sama (mutabel).
// sendBatch yang gagal tidak tercatat di sendCalls, hanya di attempts.
function flushDepsOver(entries: OutboxEntry[]) {
  const statusLog: StatusRecord[] = [];
  const sendCalls: Array<{ entries: OutboxEntry[]; batchKey: string }> = [];
  const attempts: string[] = [];
  const clearedCalls: string[][] = [];
  const failedKeys = new Set<string>();

  const deps: FlushDeps = {
    listEntries: async () => [...entries],
    sendBatch: async (batchEntries, batchKey) => {
      attempts.push(batchKey);
      if (failedKeys.has(batchKey)) {
        throw new Error('transport gagal: ' + batchKey);
      }
      sendCalls.push({ entries: batchEntries, batchKey });
    },
    clearBatch: async (keys) => {
      clearedCalls.push(keys);
      for (let i = entries.length - 1; i >= 0; i--) {
        if (keys.includes(entries[i].batchKey)) {
          entries.splice(i, 1);
        }
      }
    },
    onStatus: (status, remaining) => {
      statusLog.push({ status, remaining });
    },
  };

  return {
    deps,
    statusLog,
    sendCalls,
    attempts,
    clearedCalls,
    failBatch(batchKey: string) {
      failedKeys.add(batchKey);
    },
  };
}

describe('flushOutbox', () => {
  it('outbox kosong: status empty remaining 0, sendBatch dan clearBatch tidak dipanggil', async () => {
    const h = flushDepsOver([]);

    await flushOutbox(h.deps);

    expect(h.statusLog).toEqual([{ status: 'empty', remaining: 0 }]);
    expect(h.sendCalls).toHaveLength(0);
    expect(h.clearedCalls).toHaveLength(0);
  });

  it('satu batch sukses: sendBatch sekali dengan entries dan batchKey benar, clearBatch [batchKey], flushed remaining 0', async () => {
    const entries = [
      makeEntry('e1', 'b1', 1),
      makeEntry('e2', 'b1', 2),
    ];
    const h = flushDepsOver(entries);

    await flushOutbox(h.deps);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].batchKey).toBe('b1');
    expect(h.sendCalls[0].entries.map((e) => e.id)).toEqual(['e1', 'e2']);
    expect(h.clearedCalls).toEqual([['b1']]);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
    expect(entries).toHaveLength(0);
  });

  it('transport gagal di satu-satunya batch: clearBatch tidak dipanggil, failed remaining = jumlah entry, batch tetap di list', async () => {
    const entries = [
      makeEntry('e1', 'b1', 1),
      makeEntry('e2', 'b1', 2),
      makeEntry('e3', 'b1', 3),
    ];
    const h = flushDepsOver(entries);
    h.failBatch('b1');

    await flushOutbox(h.deps);

    expect(h.clearedCalls).toHaveLength(0);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 3 }]);
    expect(entries.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
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

    expect(h.attempts).toEqual(['batch-a', 'batch-b']);
    expect(h.clearedCalls).toEqual([['batch-a']]);
    expect(h.statusLog).toEqual([{ status: 'failed', remaining: 3 }]);
    expect(entries.map((e) => e.id).sort()).toEqual(['b1', 'b2', 'b3']);
  });

  it('grouping: 3 entry batchKey sama dengan input acak terkirim sebagai satu panggilan urut createdAt', async () => {
    const entries = [
      makeEntry('e3', 'b1', 30),
      makeEntry('e1', 'b1', 10),
      makeEntry('e2', 'b1', 20),
    ];
    const h = flushDepsOver(entries);

    await flushOutbox(h.deps);

    expect(h.sendCalls).toHaveLength(1);
    expect(h.sendCalls[0].batchKey).toBe('b1');
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

    expect(h.sendCalls).toHaveLength(2);
    expect(h.sendCalls[0].batchKey).toBe('batch-a');
    expect(h.sendCalls[0].entries.map((e) => e.id)).toEqual(['a1']);
    expect(h.sendCalls[1].batchKey).toBe('batch-z');
    expect(h.sendCalls[1].entries.map((e) => e.id)).toEqual(['z1', 'z2']);
    expect(h.clearedCalls).toEqual([['batch-a'], ['batch-z']]);
    expect(h.statusLog).toEqual([{ status: 'flushed', remaining: 0 }]);
  });

  it('onStatus tidak diberikan: tidak throw, alur tetap jalan sampai clearBatch', async () => {
    const entries = [makeEntry('e1', 'b1', 1)];
    const deps: FlushDeps = {
      listEntries: async () => [...entries],
      sendBatch: async () => undefined,
      clearBatch: async (keys) => {
        for (let i = entries.length - 1; i >= 0; i--) {
          if (keys.includes(entries[i].batchKey)) {
            entries.splice(i, 1);
          }
        }
      },
    };

    await expect(flushOutbox(deps)).resolves.toBeUndefined();
    expect(entries).toHaveLength(0);
  });
});
