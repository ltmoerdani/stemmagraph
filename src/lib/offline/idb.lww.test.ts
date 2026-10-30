import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  closeOfflineDb,
  getBackupTree,
  getTree,
  putTreeLww,
  type BackupRecord,
} from './idb';

// v110: mock IndexedDB dua store (trees + tree-backup) untuk putTreeLww.
// Pola settle sama dengan idb.test.ts: request selesai lewat microtask,
// oncomplete transaksi lewat macrotask setTimeout(0) sehingga handler
// selalu sudah terpasang sebelum callback dijalankan.

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
    setTimeout(() => {
      this.oncomplete?.();
    }, 0);
  }
}

class MockIndexedDb {
  objectStoreNames: DOMStringList;
  private stores = new Map<string, MockObjectStore>();

  constructor() {
    this.stores.set('trees', new MockObjectStore());
    this.objectStoreNames = {
      length: 1,
      item: () => 'trees',
      contains: (name: string) => this.stores.has(name),
      [Symbol.iterator]: function* () {
        yield 'trees';
      },
    } as unknown as DOMStringList;
  }

  // dipanggil onupgradeneeded untuk store tree-backup
  createObjectStore(name: string): void {
    this.stores.set(name, new MockObjectStore());
  }

  transaction(name: string): MockTransaction {
    const store = this.stores.get(name);
    if (!store) {
      throw new Error(`store tidak dikenal: ${name}`);
    }
    return new MockTransaction(store);
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

function makePayload(name: string, savedAt: string): Record<string, unknown> {
  return {
    treeId: 't1',
    name,
    savedAt,
    members: [],
    relationships: [],
  };
}

describe('putTreeLww v110 (LWW + backup single-slot)', () => {
  beforeEach(() => {
    installMockIndexedDb();
  });

  afterEach(() => {
    closeOfflineDb();
    vi.unstubAllGlobals();
  });

  const OLD = '2026-01-01T00:00:00.000Z';
  const MID = '2026-01-02T00:00:00.000Z';
  const NEW = '2026-01-03T00:00:00.000Z';

  it('1. tulis pertama: status written, tanpa backup', async () => {
    const status = await putTreeLww('t1', makePayload('A', OLD), OLD);
    expect(status).toBe('written');
    expect(await getBackupTree('t1')).toBeNull();
    expect(await getTree('t1')).toEqual(makePayload('A', OLD));
  });

  it('2. tulis kedua lebih baru: record lama pindah ke backup, status written_with_backup', async () => {
    await putTreeLww('t1', makePayload('A', OLD), OLD);
    const status = await putTreeLww('t1', makePayload('B', MID), MID);
    expect(status).toBe('written_with_backup');

    const backup: BackupRecord | null = await getBackupTree('t1');
    expect(backup).not.toBeNull();
    expect(backup?.payload).toEqual(makePayload('A', OLD));
    expect(backup?.savedAt).toBe(OLD);
    expect(typeof backup?.replacedAt).toBe('string');
    expect(await getTree('t1')).toEqual(makePayload('B', MID));
  });

  it('3. incoming lebih tua: skipped_stale, existing utuh, backup tetap kosong', async () => {
    await putTreeLww('t1', makePayload('B', MID), MID);
    const status = await putTreeLww('t1', makePayload('A', OLD), OLD);
    expect(status).toBe('skipped_stale');
    expect(await getTree('t1')).toEqual(makePayload('B', MID));
    expect(await getBackupTree('t1')).toBeNull();
  });

  it('4. backup satu slot terpisah dari record utama, terbaca kembali, berganti generasi', async () => {
    await putTreeLww('t1', makePayload('A', OLD), OLD);
    await putTreeLww('t1', makePayload('B', MID), MID);
    await putTreeLww('t1', makePayload('C', NEW), NEW);

    const backup = await getBackupTree('t1');
    const main = await getTree('t1');
    expect(backup?.payload).toEqual(makePayload('B', MID));
    expect(backup?.savedAt).toBe(MID);
    expect(main).toEqual(makePayload('C', NEW));
    expect(backup?.payload).not.toEqual(main);
  });

  it('5. savedAt sama: incoming tetap ditulis, record lama masuk backup', async () => {
    await putTreeLww('t1', makePayload('A', OLD), OLD);
    const status = await putTreeLww('t1', makePayload('B', OLD), OLD);
    expect(status).toBe('written_with_backup');
    expect(await getTree('t1')).toEqual(makePayload('B', OLD));
    expect((await getBackupTree('t1'))?.payload).toEqual(makePayload('A', OLD));
  });
});
