import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestAdapter } from './rest.adapter';
import { AdapterError, type GenerationsCountDto } from './types';

/**
 * v285: pin permukaan stats generasi adapter. Fokus uji: kontrak
 * getGenerationsCount pada RestAdapter, URL path persis dengan treeId
 * ter-encode, payload generationCount diteruskan apa adanya termasuk
 * field ekstra tanpa sanitasi, serta error jaringan dan respons
 * non-OK 401, 403, 404 naik ke pemanggil tanpa penangkap lokal.
 */

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeRest = () => new RestAdapter({ baseUrl: 'http://stub.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RestAdapter getGenerationsCount', () => {
  it('mengembalikan payload generationCount apa adanya pada 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { generationCount: 4 }));
    vi.stubGlobal('fetch', fetchMock);

    const hasil = await makeRest().getGenerationsCount('tree_1');

    expect(hasil).toEqual({ generationCount: 4 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_1/stats/generations');
    expect(init.method).toBe('GET');
  });

  it('URL path persis /trees/<id>/stats/generations tanpa query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { generationCount: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await makeRest().getGenerationsCount('tree_abc');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_abc/stats/generations');
    expect(String(url)).not.toContain('?');
  });

  it('treeId berisi karakter khusus tetap ter-encode di path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { generationCount: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    await makeRest().getGenerationsCount('tr ee/1?x');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tr%20ee%2F1%3Fx/stats/generations');
  });

  it('error jaringan naik ke pemanggil tanpa penangkap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(makeRest().getGenerationsCount('tree_1')).rejects.toThrow(TypeError);
  });

  it('respons 401 naik sebagai AdapterError dengan statusCode 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { message: 'tidak berwenang' })));

    const err = await makeRest().getGenerationsCount('tree_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).statusCode).toBe(401);
  });

  it('respons 403 naik sebagai AdapterError dengan statusCode 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(403, { message: 'terlarang' })));

    const err = await makeRest().getGenerationsCount('tree_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).statusCode).toBe(403);
  });

  it('respons 404 naik sebagai AdapterError dengan statusCode 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(404, { message: 'pohon nihil' })));

    const err = await makeRest().getGenerationsCount('tree_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).statusCode).toBe(404);
  });

  it('payload dengan field ekstra diteruskan apa adanya tanpa sanitasi', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, { generationCount: 7, depthByMember: { mem_1: 1 }, cached: true }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const hasil: GenerationsCountDto = await makeRest().getGenerationsCount('tree_9');

    expect(hasil.generationCount).toBe(7);
    expect((hasil as Record<string, unknown>)['depthByMember']).toEqual({ mem_1: 1 });
    expect((hasil as Record<string, unknown>)['cached']).toBe(true);
  });
});
