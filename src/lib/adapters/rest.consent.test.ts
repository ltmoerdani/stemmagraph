import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestAdapter } from './rest.adapter';

/**
 * S-06c: pin the consent surface of RestAdapter. The server answers
 * GET /members/:memberId/consent with { records, granted } and POST
 * with 201 { record, granted, privacyStatus }; the adapter routes the
 * calls and unwraps nothing beyond defaults for absent collections.
 */

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeAdapter = () => new RestAdapter({ baseUrl: 'http://stub.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RestAdapter consent surface', () => {
  it('POST grant returns the 201 body: record, granted, privacyStatus', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(201, {
        record: {
          id: 'rec_1',
          memberId: 'm1',
          action: 'grant',
          scope: 'export photos',
          note: 'asked by phone',
          at: '2026-09-16T02:00:00.000Z',
        },
        granted: true,
        privacyStatus: 'shared',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await makeAdapter().postConsent('m1', 'grant', 'export photos', 'asked by phone');

    expect(result.record.action).toBe('grant');
    expect(result.record.scope).toBe('export photos');
    expect(result.granted).toBe(true);
    expect(result.privacyStatus).toBe('shared');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/members/m1/consent');
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      action: 'grant',
      scope: 'export photos',
      note: 'asked by phone',
    });
  });

  it('GET returns the replayed ledger shape: records list plus granted flag', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(200, {
          records: [
            {
              id: 'rec_1',
              memberId: 'm1',
              action: 'grant',
              scope: 'export photos',
              note: null,
              at: '2026-09-16T02:00:00.000Z',
            },
            {
              id: 'rec_2',
              memberId: 'm1',
              action: 'revoke',
              scope: 'export photos',
              note: null,
              at: '2026-09-16T03:00:00.000Z',
            },
          ],
          granted: false,
        }),
      ),
    );

    const state = await makeAdapter().getConsent('m1');

    expect(state.granted).toBe(false);
    expect(state.records).toHaveLength(2);
    expect(state.records[0].action).toBe('grant');
    expect(state.records[1].action).toBe('revoke');
    expect(state.records[1].at).toBe('2026-09-16T03:00:00.000Z');
  });

  it('GET defaults absent collections to empty list and false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, {})));

    const state = await makeAdapter().getConsent('m2');

    expect(state.records).toEqual([]);
    expect(state.granted).toBe(false);
  });

  it('POST omits note from the body when the caller sends none', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      json(201, {
        record: {
          id: 'rec_3',
          memberId: 'm1',
          action: 'regrant',
          scope: 'export tree',
          note: null,
          at: '2026-09-16T04:00:00.000Z',
        },
        granted: true,
        privacyStatus: 'shared',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await makeAdapter().postConsent('m1', 'regrant', 'export tree');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ action: 'regrant', scope: 'export tree' });
  });
});
