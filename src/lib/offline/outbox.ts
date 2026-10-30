import { openOfflineDb, requestToPromise, transactionDone } from './idb';

const STORE_OUTBOX = 'outbox';

export type OutboxOpKind = 'member.add' | 'member.update' | 'member.remove';

export interface OutboxOp {
  kind: OutboxOpKind;
  memberId: string;
  data?: Record<string, unknown>;
}

export type OutboxEntryStatus = 'pending' | 'failed';

export interface OutboxEntry {
  id: string;
  batchKey: string;
  kind: OutboxOpKind;
  memberId: string;
  data?: Record<string, unknown>;
  createdAt: number;
  // Field opsional v113 (guard defensif, tanpa bump versi DB): entry lama
  // di idb tidak punya kedua field ini dan tetap valid dibaca.
  status?: OutboxEntryStatus;
  lastError?: string;
}

// Satu batch = satu aksi user; batchKey dipakai untuk clearBatch setelah
// seluruh batch tersinkron ke server.
export function beginBatch(): string {
  return crypto.randomUUID();
}

export async function enqueueOp(
  op: OutboxOp,
  batchKey: string,
  createdAt: number = Date.now()
): Promise<OutboxEntry> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    batchKey,
    kind: op.kind,
    memberId: op.memberId,
    data: op.data,
    createdAt,
  };
  store.put(entry);
  await transactionDone(tx);
  return entry;
}

// Set status + lastError pada satu entry (v113: penanda hasil percobaan flush).
export async function setEntryStatus(
  id: string,
  status: OutboxEntryStatus,
  lastError?: string
): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  const request = store.get(id);
  const existing = (await requestToPromise(request)) as OutboxEntry | undefined;
  if (existing) {
    const updated: OutboxEntry = { ...existing, status };
    if (lastError !== undefined) {
      updated.lastError = lastError;
    }
    store.put(updated);
  }
  await transactionDone(tx);
}

export async function listOutbox(): Promise<OutboxEntry[]> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readonly');
  const request = tx.objectStore(STORE_OUTBOX).getAll();
  const entries = (await requestToPromise(request)) as OutboxEntry[];
  await transactionDone(tx);
  return entries.sort((a, b) => a.createdAt - b.createdAt);
}

// Hapus entry dari batch yang sudah terkonfirmasi sukses di server.
// v113: juga dipakai purge retensi; entry tanpa field status dianggap pending
// (aman dari purge) karena guard defensif membaca status ?? 'pending'.
export function entryStatus(entry: OutboxEntry): OutboxEntryStatus {
  return entry.status ?? 'pending';
}

export async function clearBatch(batchKeys: string[]): Promise<void> {
  if (batchKeys.length === 0) {
    return;
  }
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  const request = store.getAll();
  const entries = (await requestToPromise(request)) as OutboxEntry[];
  for (const entry of entries) {
    if (batchKeys.includes(entry.batchKey)) {
      store.delete(entry.id);
    }
  }
  await transactionDone(tx);
}

// Retensi v113: buang entry berstatus failed berumur lebih dari maxAgeMs
// (dibanding nowMs agar test bisa menginjeksi waktu). Entry pending, failed
// muda, dan entry tanpa status dianggap pending (guard defensif) tetap aman.
// Mengembalikan jumlah entry yang dibuang.
export async function purgeExpiredOutbox(
  maxAgeMs: number = 24 * 60 * 60 * 1000,
  nowMs: number = Date.now()
): Promise<number> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  const request = store.getAll();
  const entries = (await requestToPromise(request)) as OutboxEntry[];
  let purged = 0;
  for (const entry of entries) {
    const status = entry.status ?? 'pending';
    if (status === 'failed' && nowMs - entry.createdAt > maxAgeMs) {
      store.delete(entry.id);
      purged += 1;
    }
  }
  await transactionDone(tx);
  return purged;
}

export async function countOutbox(): Promise<number> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readonly');
  const request = tx.objectStore(STORE_OUTBOX).count();
  const count = await requestToPromise(request);
  await transactionDone(tx);
  return count;
}
