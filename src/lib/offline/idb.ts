export class IndexedDbUnavailableError extends Error {
  constructor() {
    super('IndexedDB is not available in this environment');
    this.name = 'IndexedDbUnavailableError';
  }
}

const DB_NAME = 'stemmagraph-offline';
// v110: naik ke 2 karena onupgradeneeded kini juga membuat store backup.
// Upgrade dari DB v1 existing hanya menambah store, data trees utuh.
const DB_VERSION = 2;
const STORE_TREES = 'trees';
const STORE_BACKUP = 'tree-backup';

export type LwwStatus = 'written' | 'skipped_stale' | 'written_with_backup';

type TreesDb = IDBDatabase;

interface TreeRecord {
  treeId: string;
  payload: unknown;
}

// BackupRecord: satu slot per treeId (single slot, satu generasi).
// savedAt disalin dari record lama, replacedAt mencatat kapan pindah.
export interface BackupRecord {
  treeId: string;
  payload: unknown;
  savedAt: string;
  replacedAt: string;
}

function requireIndexedDb(): IDBFactory {
  if (typeof indexedDB === 'undefined') {
    throw new IndexedDbUnavailableError();
  }
  return indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      reject(request.error);
    };
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => {
      resolve();
    };
    tx.onerror = () => {
      reject(tx.error);
    };
    tx.onabort = () => {
      reject(tx.error);
    };
  });
}

let dbPromise: Promise<TreesDb> | null = null;

export function openOfflineDb(): Promise<TreesDb> {
  if (dbPromise) {
    return dbPromise;
  }
  dbPromise = new Promise<TreesDb>((resolve, reject) => {
    const request = requireIndexedDb().open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_TREES)) {
        db.createObjectStore(STORE_TREES, { keyPath: 'treeId' });
      }
      if (!db.objectStoreNames.contains(STORE_BACKUP)) {
        db.createObjectStore(STORE_BACKUP, { keyPath: 'treeId' });
      }
    };
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });
  return dbPromise;
}

export function closeOfflineDb(): void {
  if (!dbPromise) {
    return;
  }
  void dbPromise
    .then((db) => {
      db.close();
    })
    .catch(() => {
      // already closed or failed to open, nothing to do
    });
  dbPromise = null;
}

export async function putTree(treeId: string, payload: unknown): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_TREES, 'readwrite');
  const store = tx.objectStore(STORE_TREES);
  const record: TreeRecord = { treeId, payload };
  store.put(record);
  await transactionDone(tx);
}

export async function getTree(treeId: string): Promise<unknown | null> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_TREES, 'readonly');
  const store = tx.objectStore(STORE_TREES);
  const request = store.get(treeId);
  const result = (await requestToPromise(request)) as TreeRecord | undefined;
  await transactionDone(tx);
  return result === undefined ? null : result.payload;
}

export async function deleteTree(treeId: string): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_TREES, 'readwrite');
  tx.objectStore(STORE_TREES).delete(treeId);
  await transactionDone(tx);
}

export async function listTreeIds(): Promise<string[]> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_TREES, 'readonly');
  const request = tx.objectStore(STORE_TREES).getAllKeys();
  const keys = await requestToPromise(request);
  await transactionDone(tx);
  return keys.filter((key): key is string => typeof key === 'string');
}

export async function clearAll(): Promise<void> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_TREES, 'readwrite');
  tx.objectStore(STORE_TREES).clear();
  await transactionDone(tx);
}

// savedAt record existing hidup di dalam payload (SerializedTree.savedAt).
// Payload unknown: kalau bentuknya tak terbaca, kembalikan string kosong
// sehingga incoming selalu dianggap lebih baru (fallback aman, tetap tulis).
function extractSavedAt(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }
  const savedAt = (payload as { savedAt?: unknown }).savedAt;
  return typeof savedAt === 'string' ? savedAt : '';
}

// Baca isi slot backup untuk satu treeId, null bila kosong.
export async function getBackupTree(treeId: string): Promise<BackupRecord | null> {
  const db = await openOfflineDb();
  const tx = db.transaction(STORE_BACKUP, 'readonly');
  const request = tx.objectStore(STORE_BACKUP).get(treeId);
  const result = (await requestToPromise(request)) as BackupRecord | undefined;
  await transactionDone(tx);
  return result === undefined ? null : result;
}

// v110: tulis pohon dengan Last-Write-Wins berbasis savedAt (ISO string;
// pembandingan leksikografis sama dengan kronologis untuk format UTC ISO).
//
// Alur (tiap fase satu transaksi, tanpa transaksi campuran):
// 1. tanpa record existing: tulis langsung, status 'written'
// 2. existing lebih baru dari incoming: skip, status 'skipped_stale'
// 3. incoming lebih baru atau sama: pindahkan existing ke slot backup
//    (satu generasi, ditimpa tiap kali) lalu tulis incoming,
//    status 'written_with_backup'
export async function putTreeLww(
  treeId: string,
  payload: unknown,
  savedAt: string
): Promise<LwwStatus> {
  const db = await openOfflineDb();

  const readTx = db.transaction(STORE_TREES, 'readonly');
  const getRequest = readTx.objectStore(STORE_TREES).get(treeId);
  const existing = (await requestToPromise(getRequest)) as TreeRecord | undefined;
  await transactionDone(readTx);

  if (existing === undefined) {
    await putTree(treeId, payload);
    return 'written';
  }

  const existingSavedAt = extractSavedAt(existing.payload);
  if (existingSavedAt !== '' && existingSavedAt > savedAt) {
    return 'skipped_stale';
  }

  const backupRecord: BackupRecord = {
    treeId,
    payload: existing.payload,
    savedAt: existingSavedAt,
    replacedAt: new Date().toISOString(),
  };
  const backupTx = db.transaction(STORE_BACKUP, 'readwrite');
  backupTx.objectStore(STORE_BACKUP).put(backupRecord);
  await transactionDone(backupTx);

  await putTree(treeId, payload);
  return 'written_with_backup';
}
