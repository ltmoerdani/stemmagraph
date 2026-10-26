/**
 * Test wiring v411 AC2: getSelfConsentEvents di ConsentSelfApi RestAdapter.
 * Route GET /members/:memberId/consent/self/events membawa array records;
 * adapter meneruskan tanpa unwrap berlebihan; absent collection jadi [].
 * Pola rest.consent.test.ts.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestAdapter } from './rest.adapter';

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeAdapter = () => new RestAdapter({ baseUrl: 'http://stub.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RestAdapter getSelfConsentEvents (v411 AC2)', () => {
  it('GET route events dan balikan array records utuh', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(200, {
        records: [
          { id: 'rec-a', memberId: 'm1', action: 'grant', scope: 'share', note: null, at: '2026-10-01T00:00:00.000Z' },
          { id: 'rec-b', memberId: 'm1', action: 'revoke', scope: 'share', note: null, at: '2026-10-02T00:00:00.000Z' },
        ],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeAdapter().getSelfConsentEvents('m1');

    expect(result.records).toHaveLength(2);
    expect(result.records[0].action).toBe('grant');
    expect(result.records[1].action).toBe('revoke');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/members/m1/consent/self/events');
    expect(init.method).toBe('GET');
  });

  it('body nihil atau records absen: fallback array kosong tanpa crash', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, {})));
    const result = await makeAdapter().getSelfConsentEvents('m1');
    expect(result.records).toEqual([]);
  });
});
