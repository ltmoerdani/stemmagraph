import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCitationApi, setAdapter, resetAdapter } from './index';
import { RestAdapter } from './rest.adapter';
import { MockAdapter } from './mock.adapter';
import type { CitationSpec } from './types';

/**
 * v155-iii-a: pin permukaan sitasi adapter. Fokus uji: kontrak factory
 * getCitationApi (null untuk adapter non-server, instance untuk
 * RestAdapter), penerusan verbatim pointer dan spec utuh ke route
 * /api/v1, urutan LifeEvent sebelum sitasi, bentuk return string dan
 * void keduanya diterima, serta never throws pada kegagalan jaringan.
 */

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeRest = () => new RestAdapter({ baseUrl: 'http://stub.test' });

const specPenuh: CitationSpec = {
  sourceId: 'src_1',
  sourcePointer: '@I12@',
  page: '12',
  quay: '2',
  note: 'akta lahir',
  eventType: 'BIRTH',
  memberId: 'mem_1',
  partnerMemberId: 'mem_2',
};

afterEach(() => {
  vi.unstubAllGlobals();
  resetAdapter();
});

describe('getCitationApi (factory)', () => {
  it('null untuk mock adapter tanpa server backend', () => {
    setAdapter(new MockAdapter());
    expect(getCitationApi()).toBeNull();
  });

  it('bukan null untuk RestAdapter dan mengembalikan instance aktif', () => {
    const rest = makeRest();
    setAdapter(rest);
    const api = getCitationApi();
    expect(api).not.toBeNull();
    expect(api).toBe(rest);
  });
});

describe('RestAdapter citation surface', () => {
  it('upsertSource meneruskan pointer verbatim ke route sources/upsert', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: 'src_baru' }));
    vi.stubGlobal('fetch', fetchMock);

    const id = await makeRest().upsertSource('tree_1', '@S7@');

    expect(id).toBe('src_baru');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_1/sources/upsert');
    expect(init.method).toBe('PUT');
    expect(JSON.parse(String(init.body))).toEqual({ pointer: '@S7@' });
  });

  it('upsertCitation meneruskan spec utuh per field ke route citations/upsert', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(200, { id: 'cit_9' }));
    vi.stubGlobal('fetch', fetchMock);

    const id = await makeRest().upsertCitation('tree_1', specPenuh);

    expect(id).toBe('cit_9');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_1/citations/upsert');
    const sent = JSON.parse(String(init.body)) as CitationSpec;
    expect(sent.eventType).toBe('BIRTH');
    expect(sent.memberId).toBe('mem_1');
    expect(sent.partnerMemberId).toBe('mem_2');
    expect(sent.sourceId).toBe('src_1');
    expect(sent.sourcePointer).toBe('@I12@');
    expect(sent.page).toBe('12');
    expect(sent.quay).toBe('2');
    expect(sent.note).toBe('akta lahir');
  });

  it('upsertLifeEvent terpanggil sebelum upsertCitation bila keduanya diurutkan', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(200, { id: 'evt_1' }))
      .mockResolvedValueOnce(json(200, { id: 'cit_1' }));
    vi.stubGlobal('fetch', fetchMock);

    const adapter = makeRest();
    const eventId = await adapter.upsertLifeEvent('tree_1', 'mem_1', 'BIRTH', 'mem_2');
    const citationId = await adapter.upsertCitation('tree_1', specPenuh);

    expect(eventId).toBe('evt_1');
    expect(citationId).toBe('cit_1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const firstUrl = fetchMock.mock.calls[0][0] as string;
    const secondUrl = fetchMock.mock.calls[1][0] as string;
    expect(firstUrl).toContain('/life-events/upsert');
    expect(secondUrl).toContain('/citations/upsert');
  });

  it('bentuk return string dan void dua-duanya diterima pada upsertCitation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, {})));
    const tanpaId = await makeRest().upsertCitation('tree_1', specPenuh);
    expect(tanpaId).toBeUndefined();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(200, { id: 'cit_2' })));
    const denganId = await makeRest().upsertCitation('tree_1', specPenuh);
    expect(denganId).toBe('cit_2');
  });

  it('upsertLifeEvent mengirim optional field hanya bila ada', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json(201, { id: 'evt_2' }));
    vi.stubGlobal('fetch', fetchMock);

    const id = await makeRest().upsertLifeEvent('tree_2', 'mem_3', 'MARRIAGE');

    expect(id).toBe('evt_2');
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://stub.test/trees/tree_2/life-events/upsert');
    expect(JSON.parse(String(init.body))).toEqual({ memberId: 'mem_3', eventType: 'MARRIAGE' });
  });

  it('network error pada upsertSource tidak melempar, kembalikan string kosong', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const id = await makeRest().upsertSource('tree_1', '@S1@');
    expect(id).toBe('');
  });

  it('network error pada upsertCitation dan upsertLifeEvent tidak melempar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    const adapter = makeRest();

    const cit = await adapter.upsertCitation('tree_1', specPenuh);
    expect(cit).toBeUndefined();

    const evt = await adapter.upsertLifeEvent('tree_1', 'mem_1', 'DEATH');
    expect(evt).toBe('');
  });

  it('respons error HTTP 500 tidak melempar pada upsertSource', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(500, { message: 'boom' })));

    const id = await makeRest().upsertSource('tree_1', '@S2@');
    expect(id).toBe('');
  });
});
