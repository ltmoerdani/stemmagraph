import { openOfflineDb, requestToPromise, transactionDone } from './idb';

const STORE_OUTBOX = 'outbox';

export type OutboxOpKind = 'member.add' | 'member.update' | 'member.remove';

export interface OutboxOp {
  kind: OutboxOpKind;
  memberId: string;
  data?: Record<string, unknown>;
}

export interface OutboxEntry {
  id: string;
  batchKey: string;
  kind: OutboxOpKind;
  memberId: string;
  data?: Record<string, unknown>;
  createdAt: number;
}

// Satu batch = satu aksi user; batchKey dipakai untuk clearBatch setelah
// seluruh batch tersinkron ke server.
export function beginBatch(): string {
  return crypto.randomUUID();
}

export async function enqueueOp(op: OutboxOp, batchKey: string): Promise<OutboxEntry> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readwrite');
  const store = tx.objectStore(STORE_OUTBOX);
  const entry: OutboxEntry = {
    id: crypto.randomUUID(),
    batchKey,
    kind: op.kind,
    memberId: op.memberId,
    data: op.data,
    createdAt: Date.now(),
  };
  store.put(entry);
  await transactionDone(tx);
  return entry;
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

export async function countOutbox(): Promise<number> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_OUTBOX, 'readonly');
  const request = tx.objectStore(STORE_OUTBOX).count();
  const count = await requestToPromise(request);
  await transactionDone(tx);
  return count;
}
