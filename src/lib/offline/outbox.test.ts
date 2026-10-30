import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { beginBatch, clearBatch, countOutbox, enqueueOp, listOutbox } from './outbox';
import { closeOfflineDb, openOfflineDb } from './idb';

class MockRequest<T> {
  result: T;
  error: DOMException | null = null;
  onsuccess: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(result: T) {
    this.result = result;
  }
}

class MockObjectStore {
  private entries = new Map<string, unknown>();
  indexNames: DOMStringList;

  constructor() {
    this.indexNames = {
      length: 1,
      item: () => 'batchKey',
      contains: (name: string) => name === 'batchKey',
    } as unknown as DOMStringList;
  }

  get(key: IDBValidKey): MockRequest<unknown> {
    const value = this.entries.get(String(key));
    return this.settle(new MockRequest(value === undefined ? undefined : value));
  }

  put(record: { id: string }): MockRequest<IDBValidKey> {
    this.entries.set(record.id, record);
    return this.settle(new MockRequest(record.id));
  }

  delete(key: IDBValidKey): MockRequest<undefined> {
    this.entries.delete(String(key));
    return this.settle(new MockRequest(undefined));
  }

  clear(): MockRequest<undefined> {
    this.entries.clear();
    return this.settle(new MockRequest(undefined));
  }

  getAll(): MockRequest<unknown[]> {
    return this.settle(new MockRequest(Array.from(this.entries.values())));
  }

  count(): MockRequest<number> {
    return this.settle(new MockRequest(this.entries.size));
  }

  createIndex(): void {
    // index sudah diwakili indexNames statis di atas
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
    // Macrotask, alasan sama dengan idb.test.ts: handler oncomplete harus
    // terpasang sebelum callback dijalankan.
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }
}

interface MockDbShape {
  stores: Map<string, MockObjectStore>;
}

function makeStoreList(names: string[]): DOMStringList {
  return {
    length: names.length,
    item: (index: number) => names[index],
    contains: (name: string) => names.includes(name),
    [Symbol.iterator]: function* () {
      yield* names;
    },
  } as unknown as DOMStringList;
}

class MockIndexedDb {
  objectStoreNames: DOMStringList;
  private shape: MockDbShape;

  constructor(storeNames: string[]) {
    this.objectStoreNames = makeStoreList(storeNames);
    this.shape = { stores: new Map() };
    for (const name of storeNames) {
      this.shape.stores.set(name, new MockObjectStore());
    }
  }

  transaction(storeNames: string | string[]): MockTransaction {
    const name = Array.isArray(storeNames) ? storeNames[0] : storeNames;
    const store = this.shape.stores.get(name) ?? new MockObjectStore();
    return new MockTransaction(store);
  }

  createObjectStore(name: string): MockObjectStore {
    const store = new MockObjectStore();
    this.shape.stores.set(name, store);
    const names = Array.from(this.shape.stores.keys());
    this.objectStoreNames = makeStoreList(names);
    return store;
  }

  close(): void {
    // no-op in mock
  }
}

class MockOpenRequest extends MockRequest<MockIndexedDb> {
  onupgradeneeded: (() => void) | null = null;

  constructor(storeNames: string[]) {
    super(new MockIndexedDb(storeNames));
    queueMicrotask(() => {
      this.onupgradeneeded?.();
      this.onsuccess?.();
    });
  }
}

function installMockIndexedDb(storeNames: string[]): void {
  const factory = {
    open: () => new MockOpenRequest(storeNames),
  };
  vi.stubGlobal('indexedDB', factory);
}

describe('offline outbox wrapper', () => {
  beforeEach(() => {
    installMockIndexedDb(['trees', 'tree-backup', 'outbox']);
  });

  afterEach(() => {
    closeOfflineDb();
    vi.unstubAllGlobals();
  });

  it('(a) enqueueOp menyimpan entry dengan id, batchKey, createdAt terisi', async () => {
    const batchKey = beginBatch();
    const entry = await enqueueOp(
      { kind: 'member.add', memberId: 'm1', data: { name: 'Ali' } },
      batchKey
    );
    expect(entry.id).toBeTypeOf('string');
    expect(entry.id).not.toBe('');
    expect(entry.batchKey).toBe(batchKey);
    expect(entry.kind).toBe('member.add');
    expect(entry.memberId).toBe('m1');
    expect(entry.data).toEqual({ name: 'Ali' });
    expect(entry.createdAt).toBeTypeOf('number');
  });

  it('(b) listOutbox urut createdAt naik', async () => {
    const batchKey = beginBatch();
    await enqueueOp({ kind: 'member.add', memberId: 'm1' }, batchKey);
    await enqueueOp({ kind: 'member.update', memberId: 'm2' }, batchKey);
    await enqueueOp({ kind: 'member.remove', memberId: 'm3' }, batchKey);
    const list = await listOutbox();
    expect(list.map((e) => e.memberId)).toEqual(['m1', 'm2', 'm3']);
    for (let i = 1; i < list.length; i += 1) {
      expect(list[i - 1].createdAt).toBeLessThanOrEqual(list[i].createdAt);
    }
  });

  it('(c) clearBatch menghapus hanya batch yang diminta', async () => {
    const batchA = beginBatch();
    const batchB = beginBatch();
    await enqueueOp({ kind: 'member.add', memberId: 'm1' }, batchA);
    await enqueueOp({ kind: 'member.add', memberId: 'm2' }, batchB);
    await enqueueOp({ kind: 'member.update', memberId: 'm3' }, batchA);
    await clearBatch([batchA]);
    const remaining = await listOutbox();
    expect(remaining.length).toBe(1);
    expect(remaining[0].memberId).toBe('m2');
    expect(remaining[0].batchKey).toBe(batchB);
  });

  it('(d) countOutbox benar', async () => {
    expect(await countOutbox()).toBe(0);
    const batchKey = beginBatch();
    await enqueueOp({ kind: 'member.add', memberId: 'm1' }, batchKey);
    await enqueueOp({ kind: 'member.remove', memberId: 'm2' }, batchKey);
    expect(await countOutbox()).toBe(2);
    await clearBatch([batchKey]);
    expect(await countOutbox()).toBe(0);
  });

  it('(e) upgrade versi DB tidak menghapus store lama', async () => {
    // Mulai dari DB versi lama yang hanya punya trees (v1).
    // Mock menjalankan onupgradeneeded saat open, jadi tree-backup dan
    // outbox dibuat oleh upgrade; yang di-assert adalah trees tetap utuh.
    installMockIndexedDb(['trees']);
    const dbUpgraded = await openOfflineDb();
    expect(dbUpgraded.objectStoreNames.contains('trees')).toBe(true);
    expect(dbUpgraded.objectStoreNames.contains('tree-backup')).toBe(true);
    expect(dbUpgraded.objectStoreNames.contains('outbox')).toBe(true);
    closeOfflineDb();

    // Buka ulang dengan store tree penuh: semua store tetap terbaca.
    installMockIndexedDb(['trees', 'tree-backup', 'outbox']);
    const dbFull = await openOfflineDb();
    expect(dbFull.objectStoreNames.contains('trees')).toBe(true);
    expect(dbFull.objectStoreNames.contains('tree-backup')).toBe(true);
    expect(dbFull.objectStoreNames.contains('outbox')).toBe(true);
  });
});
