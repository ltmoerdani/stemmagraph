import { describe, it, expect, vi, afterEach } from 'vitest';
import { getErasureApi, setAdapter, resetAdapter } from './index';
import { RestAdapter } from './rest.adapter';
import { MockAdapter } from './mock.adapter';
import { AdapterError } from './types';

/**
 * v420 AC5: pin permukaan penghapusan data mandiri adapter REST. Fokus
 * uji: kontrak factory getErasureApi (null untuk adapter non-server,
 * instance untuk RestAdapter), routing tiga metode ke /members/:id/erasure
 * dengan metode HTTP benar, normalisasi status server (REQUESTED jadi
 * pending, COMPLETED jadi completed, selain itu none), 404 pada GET
 * diterjemahkan jadi view none alih-alih melempar, dan statusCode
 * diteruskan dari body respons write.
 */

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeRest = () => new RestAdapter({ baseUrl: 'http://stub.test' });

afterEach(() => {
  vi.unstubAllGlobals();
  resetAdapter();
});

describe('getErasureApi (factory)', () => {
  it('null untuk mock adapter tanpa server backend', () => {
    setAdapter(new MockAdapter());
    expect(getErasureApi()).toBeNull();
  });

  it('bukan null untuk RestAdapter dan mengembalikan instance aktif', () => {
    const rest = makeRest();
    setAdapter(rest);
    const api = getErasureApi();
    expect(api).not.toBeNull();
    expect(api).toBe(rest);
  });
});

describe('RestAdapter erasure surface', () => {
  it('getErasure memanggil GET /members/:id/erasure dan memetakan REQUESTED jadi pending', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, {
        status: 200,
        request: { memberId: 'm-1', status: 'REQUESTED', requestedAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-10-31T00:00:00.000Z' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const view = await makeRest().getErasure('m-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://stub.test/members/m-1/erasure');
    expect(init.method).toBe('GET');
    expect(view).toEqual({
      status: 'pending',
      requestedAt: '2026-10-01T00:00:00.000Z',
      completedAt: null,
    });
  });

  it('getErasure 404 diterjemahkan jadi view none tanpa melempar error', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(404, { code: 'ERASURE_NOT_FOUND', message: 'erasure request not found' }));
    vi.stubGlobal('fetch', fetchMock);

    const view = await makeRest().getErasure('m-1');

    expect(view).toEqual({ status: 'none', requestedAt: null, completedAt: null });
  });

  it('getErasure COMPLETED dipetakan jadi completed dengan completedAt', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, {
        status: 200,
        request: { memberId: 'm-1', status: 'COMPLETED', requestedAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-10-31T00:00:00.000Z', completedAt: '2026-10-10T00:00:00.000Z' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const view = await makeRest().getErasure('m-1');

    expect(view).toEqual({
      status: 'completed',
      requestedAt: '2026-10-01T00:00:00.000Z',
      completedAt: '2026-10-10T00:00:00.000Z',
    });
  });

  it('getErasure tanpa state ledger dipetakan none dari body tanpa request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const view = await makeRest().getErasure('m-1');

    expect(view).toEqual({ status: 'none', requestedAt: null, completedAt: null });
  });

  it('requestErasure memanggil POST /members/:id/erasure dan meneruskan statusCode 201', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(201, {
        status: 201,
        request: { memberId: 'm-1', status: 'REQUESTED', requestedAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-10-31T00:00:00.000Z' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeRest().requestErasure('m-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://stub.test/members/m-1/erasure');
    expect(init.method).toBe('POST');
    expect(result.statusCode).toBe(201);
    expect(result.view.status).toBe('pending');
    expect(result.view.requestedAt).toBe('2026-10-01T00:00:00.000Z');
  });

  it('requestErasure konflik 409 dilempar sebagai AdapterError bawaan request()', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(409, { code: 'ERASURE_CONFLICT', message: 'request ditolak' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeRest().requestErasure('m-1')).rejects.toMatchObject({
      name: 'AdapterError',
      statusCode: 409,
    });
  });

  it('cancelErasure memanggil DELETE /members/:id/erasure dan meneruskan statusCode 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, {
        status: 200,
        request: { memberId: 'm-1', status: 'CANCELLED', requestedAt: '2026-10-01T00:00:00.000Z', dueAt: '2026-10-31T00:00:00.000Z', cancelledAt: '2026-10-05T00:00:00.000Z' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeRest().cancelErasure('m-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://stub.test/members/m-1/erasure');
    expect(init.method).toBe('DELETE');
    expect(result.statusCode).toBe(200);
    expect(result.view.status).toBe('none');
    expect(result.view.completedAt).toBeNull();
  });

  it('cancelErasure error 500 tetap naik sebagai AdapterError (tidak ditelan)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(500, { code: 'internal', message: 'kegagalan internal' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(makeRest().cancelErasure('m-1')).rejects.toBeInstanceOf(AdapterError);
  });
});
