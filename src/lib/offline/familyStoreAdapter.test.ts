import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deserializeTree, serializeAndStore, serializeTree } from './familyStoreAdapter';
import { clearAll, closeOfflineDb, deleteTree, getTree, listTreeIds } from './idb';
import type { FamilyMember } from '../../types/family';
import type { MemberRelationship } from '../adapters';

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
    // Macrotask: handler oncomplete harus terpasang dulu (pola await request
    // sebelum transaction) sebelum callback dijalankan.
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

function makeMember(id: string, name: string): FamilyMember {
  return {
    id,
    name,
    birthDate: '1990-01-01',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'single',
  };
}

function makeRelationship(memberId: string, relatedId: string): MemberRelationship {
  return {
    id: `rel-${memberId}-${relatedId}`,
    treeId: 'tree-1',
    memberId,
    relatedId,
    type: 'spouse',
  };
}

describe('familyStoreAdapter', () => {
  beforeEach(() => {
    installMockIndexedDb();
  });

  afterEach(() => {
    closeOfflineDb();
    vi.unstubAllGlobals();
  });

  it('1. roundtrip: serialize 3 member + 2 relationship, put, get, deserialize, isi equal penuh', async () => {
    const members = [
      makeMember('m1', 'Ali'),
      makeMember('m2', 'Budi'),
      makeMember('m3', 'Citra'),
    ];
    const relationships = [
      makeRelationship('m1', 'm2'),
      makeRelationship('m2', 'm3'),
    ];
    await serializeAndStore('tree-1', 'Keluarga Besar', members, relationships);
    const stored = await getTree('tree-1');
    expect(stored).not.toBeNull();
    const restored = deserializeTree(stored);

    expect(restored.treeId).toBe('tree-1');
    expect(restored.name).toBe('Keluarga Besar');
    expect(restored.members.map((m) => m.id)).toEqual(['m1', 'm2', 'm3']);
    expect(restored.members.map((m) => m.name)).toEqual(['Ali', 'Budi', 'Citra']);
    expect(restored.relationships.map((r) => r.memberId)).toEqual(['m1', 'm2']);
    expect(restored.relationships.map((r) => r.relatedId)).toEqual(['m2', 'm3']);
    expect(restored.relationships.map((r) => r.type)).toEqual(['spouse', 'spouse']);
  });

  it('2. deleteTree: getTree null dan listTreeIds kosong', async () => {
    await serializeAndStore('tree-2', 'Hapus Saya', [makeMember('m1', 'Ali')], []);
    await deleteTree('tree-2');
    expect(await getTree('tree-2')).toBeNull();
    expect(await listTreeIds()).toEqual([]);
  });

  it('3. listTreeIds berisi id pohon yang disimpan', async () => {
    await serializeAndStore('tree-a', 'A', [makeMember('m1', 'Ali')], []);
    await serializeAndStore('tree-b', 'B', [makeMember('m1', 'Budi')], []);
    const ids = await listTreeIds();
    expect(ids).toContain('tree-a');
    expect(ids).toContain('tree-b');
    expect(ids).toHaveLength(2);
  });

  it('4. clearAll mengosongkan semua', async () => {
    await serializeAndStore('tree-x', 'X', [makeMember('m1', 'Ali')], []);
    await serializeAndStore('tree-y', 'Y', [makeMember('m1', 'Budi')], []);
    await clearAll();
    expect(await listTreeIds()).toEqual([]);
    expect(await getTree('tree-x')).toBeNull();
    expect(await getTree('tree-y')).toBeNull();
  });

  it('5a. invalid_shape: raw.members bukan array', () => {
    const raw = {
      treeId: 't',
      name: 'n',
      savedAt: '2026-01-01T00:00:00.000Z',
      members: 'bukan-array',
      relationships: [],
    };
    expect(() => deserializeTree(raw)).toThrow(/invalid_shape/);
  });

  it('5b. invalid_shape: member tanpa id', () => {
    const raw = {
      treeId: 't',
      name: 'n',
      savedAt: '2026-01-01T00:00:00.000Z',
      members: [{ name: 'tanpa-id' }],
      relationships: [],
    };
    expect(() => deserializeTree(raw)).toThrow(/invalid_shape/);
  });

  it('5c. invalid_shape: relationship tanpa type', () => {
    const raw = {
      treeId: 't',
      name: 'n',
      savedAt: '2026-01-01T00:00:00.000Z',
      members: [{ id: 'm1', name: 'Ali' }],
      relationships: [{ memberId: 'm1', relatedId: 'm2' }],
    };
    expect(() => deserializeTree(raw)).toThrow(/invalid_shape/);
  });

  it('6. payload besar: 5000 member, serialize + put + get + deserialize utuh', async () => {
    const members: FamilyMember[] = [];
    for (let i = 0; i < 5000; i++) {
      members.push(makeMember('m' + i, 'Anggota ' + i));
    }
    await serializeAndStore('tree-big', 'Stress Test', members, []);
    const stored = await getTree('tree-big');
    expect(stored).not.toBeNull();
    const restored = deserializeTree(stored);

    expect(restored.members).toHaveLength(5000);
    expect(restored.members[0].id).toBe('m0');
    expect(restored.members[0].name).toBe('Anggota 0');
    expect(restored.members[2499].id).toBe('m2499');
    expect(restored.members[2499].name).toBe('Anggota 2499');
    expect(restored.members[4999].id).toBe('m4999');
    expect(restored.members[4999].name).toBe('Anggota 4999');
  });

  it('7. serializeTree dengan field function melempar serializable_violation', () => {
    const member = makeMember('m1', 'Ali') as unknown as FamilyMember;
    (member as Record<string, unknown>).callback = () => 'x';
    expect(() => serializeTree('tree-f', 'F', [member], [])).toThrow(/serializable_violation/);
  });
});
