// Flush outbox saat reconnect: kirim batch secara berurutan sesuai createdAt,
// hapus batch dari outbox hanya setelah server mengonfirmasi sukses.
// Satu batch gagal menghentikan flush, batch itu dan batch setelahnya tetap
// di outbox sehingga pengiriman bersifat at-least-once.
import type { OutboxEntry } from './outbox';

export type FlushStatus = 'flushed' | 'failed' | 'empty';

export interface FlushDeps {
  listEntries: () => Promise<OutboxEntry[]>;
  sendBatch: (entries: OutboxEntry[], batchKey: string) => Promise<void>;
  clearBatch: (keys: string[]) => Promise<void>;
  onStatus?: (status: FlushStatus, remaining: number) => void;
}

export async function flushOutbox(deps: FlushDeps): Promise<void> {
  try {
    const entries = await deps.listEntries();

    if (entries.length === 0) {
      deps.onStatus?.('empty', 0);
      return;
    }

    // Grup entries per batchKey.
    const groups = new Map<string, OutboxEntry[]>();
    for (const entry of entries) {
      const group = groups.get(entry.batchKey);
      if (group) {
        group.push(entry);
      } else {
        groups.set(entry.batchKey, [entry]);
      }
    }

    // Urutan grup mengikuti createdAt terkecil tiap grup,
    // entries dalam grup diurutkan berdasarkan createdAt.
    const ordered = [...groups.entries()]
      .map(([batchKey, groupEntries]) => {
        const sorted = [...groupEntries].sort((a, b) => a.createdAt - b.createdAt);
        return { batchKey, entries: sorted, earliest: sorted[0].createdAt };
      })
      .sort((a, b) => a.earliest - b.earliest);

    let clearedCount = 0;

    for (const group of ordered) {
      try {
        await deps.sendBatch(group.entries, group.batchKey);
        await deps.clearBatch([group.batchKey]);
        clearedCount += group.entries.length;
      } catch {
        // Batch gagal dan semua batch setelahnya tetap di outbox.
        // remaining mencakup batch yang gagal ditambah sisanya.
        deps.onStatus?.('failed', entries.length - clearedCount);
        return;
      }
    }

    deps.onStatus?.('flushed', 0);
  } catch {
    // Fungsi ini tidak pernah reject ke pemanggil.
    // Kegagalan listEntries dibiarkan tanpa status karena outbox belum terbaca.
  }
}
