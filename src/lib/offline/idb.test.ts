import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAll,
  closeOfflineDb,
  deleteTree,
  getTree,
  IndexedDbUnavailableError,
  listTreeIds,
  putTree,
} from './idb';

type MockKey = IDBValidKey;

class MockRequest<T> {
  result: T;
  error: DOMException | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(result: T) {
    this.result = result;
  }
}

class MockIndexRequest extends MockRequest<MockKey[]> {}

class MockObjectStore {
  private entries = new Map<string, unknown>();

  get(key: IDBValidKey): MockRequest<unknown> {
    const value = this.entries.get(String(key));
    return this.settle(new MockRequest(value === undefined ? undefined : value));
  }

  put(record: { treeId: string }): MockRequest<IDBValidKey> {
    this.entries.set(record.treeId, record);
    return this.settle(new MockRequest(record.treeId));
  }

  delete(key: IDBValidKey): MockRequest<undefined> {
    this.entries.delete(String(key));
    return this.settle(new MockRequest(undefined));
  }

  clear(): MockRequest<undefined> {
    this.entries.clear();
    return this.settle(new MockRequest(undefined));
  }

  getAllKeys(): MockIndexRequest {
    return this.settle(new MockIndexRequest(Array.from(this.entries.keys())));
  }

  private settle<T>(request: MockRequest<T>): MockRequest<T> {
    queueMicrotask(() => {
      request.onsuccess?.();
    });
    return request;
  }
}

class MockTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;
  objectStore(): MockObjectStore {
    return this.store;
  }

  constructor(private store: MockObjectStore) {
    // Macrotask: microtask menyala sebelum handler oncomplete terpasang
    // pada pola await request dulu baru transaction, macrotask memastikan
    // handler sudah terpasang sebelum callback dijalankan.
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }
}

class MockIndexedDb {
  objectStoreNames: DOMStringList;
  private store = new MockObjectStore();

  constructor() {
    this.objectStoreNames = {
      length: 1,
      item: () => 'trees',
      contains: (name: string) => name === 'trees',
      [Symbol.iterator]: function* () {
        yield 'trees';
      },
    } as unknown as DOMStringList;
  }

  transaction(): MockTransaction {
    return new MockTransaction(this.store);
  }

  // v110: onupgradeneeded membuat store tree-backup; mock ini tak memakai
  // store kedua, cukup no-op agar upgrade path tidak melempar.
  createObjectStore(): void {
    // no-op in mock
  }

  close(): void {
    // no-op in mock
  }
}

interface MockFactory {
  open(): MockOpenRequest;
}

class MockOpenRequest extends MockRequest<MockIndexedDb> {
  onupgradeneeded: (() => void) | null = null;

  constructor() {
    super(new MockIndexedDb());
    queueMicrotask(() => {
      this.onupgradeneeded?.();
      this.onsuccess?.();
    });
  }
}

function installMockIndexedDb(): void {
  const factory: MockFactory = {
    open: () => new MockOpenRequest(),
  };
  vi.stubGlobal('indexedDB', factory);
}

describe('offline idb wrapper', () => {
  beforeEach(() => {
    installMockIndexedDb();
  });

  afterEach(() => {
    closeOfflineDb();
    vi.unstubAllGlobals();
  });

  it('putTree lalu getTree roundtrip', async () => {
    await putTree('tree-1', { nodes: [1, 2, 3] });
    const result = await getTree('tree-1');
    expect(result).toEqual({ nodes: [1, 2, 3] });
  });

  it('getTree nihil balik null', async () => {
    const result = await getTree('tidak-ada');
    expect(result).toBeNull();
  });

  it('deleteTree menghapus', async () => {
    await putTree('tree-2', { a: 1 });
    await deleteTree('tree-2');
    const result = await getTree('tree-2');
    expect(result).toBeNull();
  });

  it('listTreeIds mengembalikan daftar', async () => {
    await putTree('b', { v: 2 });
    await putTree('a', { v: 1 });
    const ids = await listTreeIds();
    expect(ids).toEqual(['b', 'a']);
  });

  it('clearAll mengosongkan', async () => {
    await putTree('x', 1);
    await putTree('y', 2);
    await clearAll();
    expect(await listTreeIds()).toEqual([]);
    expect(await getTree('x')).toBeNull();
  });

  it('IndexedDbUnavailableError bila indexedDB undefined', async () => {
    vi.stubGlobal('indexedDB', undefined);
    await expect(putTree('z', 1)).rejects.toThrow(IndexedDbUnavailableError);
  });
});
