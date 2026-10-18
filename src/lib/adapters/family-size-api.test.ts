import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestAdapter } from './rest.adapter';
import { AdapterError, type FamilySizeStatsDto } from './types';

/**
 * v289: pin permukaan stats ukuran keluarga adapter. Fokus uji: kontrak
 * getFamilySizeStats pada RestAdapter, URL path persis dengan treeId
 * ter-encode, payload agregat diteruskan apa adanya termasuk average dan
 * median null serta field ekstra tanpa sanitasi, serta error jaringan dan
 * respons non-OK 401, 403, 404 naik ke pemanggil tanpa penangkap lokal.
 */

const payloadLengkap = {
  average: 2.5,
  median: 2,
  max: 6,
  distribution: { zero: 1, oneToTwo: 3, threeToFour: 2, fivePlus: 1 },
  familyCount: 7,
  excludedCount: 1,
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeRest = () => new RestAdapter({ baseUrl: 'http://stub.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RestAdapter getFamilySizeStats', () => {
  it('mengembalikan payload agregat lengkap apa adanya pada 200', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, payloadLengkap));
    vi.stubGlobal('fetch', fetchMock);

    const hasil = await makeRest().getFamilySizeStats('tree_1');

    expect(hasil).toEqual(payloadLengkap);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_1/stats/family-size');
    expect(init.method).toBe('GET');
  });

  it('URL path persis /trees/<id>/stats/family-size tanpa query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, payloadLengkap));
    vi.stubGlobal('fetch', fetchMock);

    await makeRest().getFamilySizeStats('tree_abc');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_abc/stats/family-size');
    expect(String(url)).not.toContain('?');
  });

  it('treeId berisi karakter khusus tetap ter-encode di path', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, payloadLengkap));
    vi.stubGlobal('fetch', fetchMock);

    await makeRest().getFamilySizeStats('tr ee/1?x');

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tr%20ee%2F1%3Fx/stats/family-size');
  });

  it('error jaringan naik ke pemanggil tanpa penangkap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    await expect(makeRest().getFamilySizeStats('tree_1')).rejects.toThrow(TypeError);
  });

  it('respons 401 naik sebagai AdapterError dengan statusCode 401', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(401, { message: 'tidak berwenang' })));

    const err = await makeRest().getFamilySizeStats('tree_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).statusCode).toBe(401);
  });

  it('respons 403 naik sebagai AdapterError dengan statusCode 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(403, { message: 'terlarang' })));

    const err = await makeRest().getFamilySizeStats('tree_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).statusCode).toBe(403);
  });

  it('respons 404 naik sebagai AdapterError dengan statusCode 404', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(404, { message: 'pohon nihil' })));

    const err = await makeRest().getFamilySizeStats('tree_1').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AdapterError).statusCode).toBe(404);
  });

  it('average dan median null diteruskan utuh tanpa diubah jadi angka', async () => {
    const payloadNull = {
      average: null,
      median: null,
      max: 0,
      distribution: { zero: 0, oneToTwo: 0, threeToFour: 0, fivePlus: 0 },
      familyCount: 0,
      excludedCount: 0,
    };
    const fetchMock = vi.fn().mockResolvedValue(json(200, payloadNull));
    vi.stubGlobal('fetch', fetchMock);

    const hasil: FamilySizeStatsDto = await makeRest().getFamilySizeStats('tree_kosong');

    expect(hasil.average).toBeNull();
    expect(hasil.median).toBeNull();
    expect(hasil).toEqual(payloadNull);
  });

  it('payload dengan field ekstra diteruskan apa adanya tanpa sanitasi', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, { ...payloadLengkap, cached: true, generatedAt: '2026-10-18T00:00:00Z' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const hasil: FamilySizeStatsDto = await makeRest().getFamilySizeStats('tree_9');

    expect(hasil.familyCount).toBe(7);
    expect((hasil as Record<string, unknown>)['cached']).toBe(true);
    expect((hasil as Record<string, unknown>)['generatedAt']).toBe('2026-10-18T00:00:00Z');
  });
});
