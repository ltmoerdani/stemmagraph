// v112 slice 3: unit test createBatchSender (bagian B).
// fetch di-mock penuh; store familyStore di-mock ringan untuk menyediakan
// currentFamilyTreeId. Lingkungan node, tanpa IndexedDB.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const treeIdHolder = { value: 't1' };

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: {
    getState: () => ({ currentFamilyTreeId: treeIdHolder.value }),
  },
}));

import { createBatchSender, BATCH_CONTRACT_ERROR_LABEL } from './batchAdapter';
import { BATCH_OPS_CONTRACT } from './contract';
import type { OutboxEntry } from './outbox';

function makeEntry(overrides: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id: 'e1',
    batchKey: 'b1',
    kind: 'member.add',
    memberId: 'm1',
    data: { name: 'Budi' },
    createdAt: 1000,
    ...overrides,
  };
}

const fetchMock = vi.fn<[], Promise<Response>>();

function jsonResponse(status: number): Response {
  return new Response('{}', { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createBatchSender', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    treeIdHolder.value = 't1';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('(1) 200: resolve, URL path, header, dan body sesuai kontrak', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200));
    const send = createBatchSender({ fetchImpl: fetchMock as unknown as typeof fetch });
    const entries = [
      makeEntry(),
      makeEntry({ id: 'e2', kind: 'member.remove', memberId: 'm2', data: undefined }),
    ];

    await expect(send(entries, 'b1')).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BATCH_OPS_CONTRACT.path.replace(':treeId', 't1'));
    expect(init.method).toBe('POST');
    const headers = init.headers as Record<string, string>;
    expect(headers['Idempotency-Key']).toBe('b1');
    expect(headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(init.body))).toEqual({
      ops: [
        { kind: 'member.add', memberId: 'm1', data: { name: 'Budi' } },
        { kind: 'member.remove', memberId: 'm2' },
      ],
    });
  });

  it('(2) 400: throw berlabel kontrak, tanpa retry (fetch tepat satu panggilan)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400));
    const send = createBatchSender({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(send([makeEntry()], 'b1')).rejects.toThrow(BATCH_CONTRACT_ERROR_LABEL);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('(3) 422: throw berlabel kontrak', async () => {
    fetchMock.mockResolvedValue(jsonResponse(422));
    const send = createBatchSender({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(send([makeEntry()], 'b1')).rejects.toThrow(BATCH_CONTRACT_ERROR_LABEL);
  });

  it('(4) 409: throw berlabel kontrak', async () => {
    fetchMock.mockResolvedValue(jsonResponse(409));
    const send = createBatchSender({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(send([makeEntry()], 'b1')).rejects.toThrow(BATCH_CONTRACT_ERROR_LABEL);
  });

  it('(5) fetch reject (jaringan): throw tanpa label kontrak, pemanggil boleh retry', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    const send = createBatchSender({ fetchImpl: fetchMock as unknown as typeof fetch });

    await expect(send([makeEntry()], 'b1')).rejects.toThrow(/kegagalan jaringan/);
    await expect(send([makeEntry()], 'b1')).rejects.not.toThrow(BATCH_CONTRACT_ERROR_LABEL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
