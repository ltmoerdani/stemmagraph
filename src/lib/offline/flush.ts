// Flush outbox saat reconnect: kirim batch secara berurutan sesuai createdAt,
// hapus batch dari outbox hanya setelah server mengonfirmasi sukses.
// v113: kegagalan transport di-retry dalam satu siklus dengan backoff
// eksponensial ber-jitter (computeBackoff), maksimal MAX_ATTEMPTS percobaan
// per batch; jawaban kontrak server (400/422/409, nama error ContractError)
// dianggap final dan tidak di-retry. Entry batch gagal diberi status failed
// plus lastError. Entry failed berumur lebih dari 24 jam dibuang di awal
// siklus agar antrean tidak mengendap selamanya.
// Fungsi tidak pernah reject ke pemanggil.
import type { OutboxEntry } from './outbox';
import { MAX_ATTEMPTS, computeBackoff } from './backoff';

export type FlushStatus = 'flushed' | 'failed' | 'empty';

export interface FlushDeps {
  listEntries: () => Promise<OutboxEntry[]>;
  sendBatch: (entries: OutboxEntry[], batchKey: string) => Promise<void>;
  clearBatch: (keys: string[]) => Promise<void>;
  onStatus?: (status: FlushStatus, remaining: number) => void;
  /** Tunda sebelum percobaan berikutnya (default setTimeout, di-inject untuk test). */
  delay?: (ms: number) => Promise<void>;
  /** Percobaan transport maksimum per batch dalam satu siklus (default MAX_ATTEMPTS). */
  maxAttempts?: number;
  /** Sumber waktu untuk purge retensi (default Date.now, di-inject untuk test). */
  now?: () => number;
  /** Umur maksimum entry failed sebelum dibuang (default 24 jam). */
  retentionMs?: number;
  /** Sumber angka acak jitter (default Math.random, di-inject untuk test deterministik). */
  rng?: () => number;
  /** Hapus entry per id dari penyimpanan (purge retensi; opsional untuk test in-memory). */
  deleteEntries?: (ids: string[]) => Promise<void>;
  /** Persist hasil penandaan satu entry (status failed + lastError) ke penyimpanan; opsional. */
  persistEntry?: (entry: OutboxEntry) => Promise<void>;
}

/** Penanda error kontrak: batchAdapter melempar jawaban final server sehingga tidak boleh di-retry. */
export const CONTRACT_ERROR_NAME = 'ContractError';

function isContractError(error: unknown): boolean {
  return error instanceof Error && error.name === CONTRACT_ERROR_NAME;
}

function defaultDelay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function flushOutbox(deps: FlushDeps): Promise<void> {
  try {
    const entries = await deps.listEntries();

    if (entries.length === 0) {
      deps.onStatus?.('empty', 0);
      return;
    }

    // Purge retensi v113: entry failed lebih tua dari retentionMs dibuang
    // dari siklus ini. Entry pending, entry failed muda, dan entry tanpa
    // status dianggap pending (guard defensif) dan tetap aman.
    const nowMs = deps.now?.() ?? Date.now();
    const retentionMs = deps.retentionMs ?? 24 * 60 * 60 * 1000;
    const expiredIds = new Set(
      entries
        .filter(
          (entry) =>
            (entry.status ?? 'pending') === 'failed' &&
            nowMs - entry.createdAt > retentionMs
        )
        .map((entry) => entry.id)
    );
    if (expiredIds.size > 0) {
      if (deps.deleteEntries) {
        await deps.deleteEntries([...expiredIds]);
      }
      for (let i = entries.length - 1; i >= 0; i -= 1) {
        if (expiredIds.has(entries[i].id)) {
          entries.splice(i, 1);
        }
      }
      if (entries.length === 0) {
        deps.onStatus?.('empty', 0);
        return;
      }
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

    const delay = deps.delay ?? defaultDelay;
    const maxAttempts = deps.maxAttempts ?? MAX_ATTEMPTS;
    const rng = deps.rng ?? Math.random;
    let clearedCount = 0;

    for (const group of ordered) {
      let attempt = 0;
      let sent = false;
      let contractFinal = false;
      // Retry hanya untuk kegagalan transport. Error kontrak (nama
      // ContractError) adalah jawaban final server: berhenti tanpa
      // menaikkan attempt dan tanpa menunggu backoff.
      while (attempt < maxAttempts) {
        try {
          await deps.sendBatch(group.entries, group.batchKey);
          sent = true;
          break;
        } catch (error) {
          if (isContractError(error)) {
            contractFinal = true;
            break;
          }
          attempt += 1;
          if (attempt < maxAttempts) {
            await delay(computeBackoff(attempt, rng));
          }
        }
      }

      if (sent) {
        await deps.clearBatch([group.batchKey]);
        clearedCount += group.entries.length;
        continue;
      }

      // Batch gagal: tandai entry status failed + lastError singkat,
      // hentikan siklus, batch ini dan semua batch setelahnya tetap di outbox
      // (at-least-once tetap terjaga).
      const lastError = contractFinal
        ? 'jawaban final server: kontrak ' + group.batchKey
        : 'gagal ' + attempt + 'x transport: ' + group.batchKey;
      for (const entry of group.entries) {
        entry.status = 'failed';
        entry.lastError = lastError;
        // Persist hasil penandaan ke penyimpanan (v113): tanpa ini status failed
        // hanya in-memory dan purge retensi tidak pernah melihat entry tersebut.
        // Gagal persist satu entry tidak menghentikan siklus penandaan.
        try {
          await deps.persistEntry?.(entry);
        } catch {
          // Abaikan: penandaan in-memory tetap berlaku untuk siklus ini.
        }
      }
      deps.onStatus?.('failed', entries.length - clearedCount);
      return;
    }

    deps.onStatus?.('flushed', 0);
  } catch {
    // Fungsi ini tidak pernah reject ke pemanggil.
    // Kegagalan listEntries dibiarkan tanpa status karena outbox belum terbaca.
  }
}
