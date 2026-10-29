export class IndexedDbUnavailableError extends Error {
  constructor() {
    super('IndexedDB is not available in this environment');
    this.name = 'IndexedDbUnavailableError';
  }
}

const DB_NAME = 'stemmagraph-offline';
const DB_VERSION = 1;
const STORE_TREES = 'trees';

type TreesDb = IDBDatabase;

interface TreeRecord {
  treeId: string;
  payload: unknown;
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
