/**
 * @vitest-environment jsdom
 *
 * v303 fase iii: wiring Oldest Living stats ke StatsSidebar.
 * Pola StatsSidebar.family-size.test.tsx (v290): store family di-mock
 * vi.hoisted, getStatsApi di-mock vi.mock adapters index, i18n instance
 * test membundel kedua locale JSON aplikasi.
 * Data berasal dari endpoint server v302 via adapter (id ageYears, tanpa PII).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import type { FamilyMember, FamilyStats } from '../../../types/family';
import { StatsSidebar } from '../StatsSidebar';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';

interface OldestLivingRow {
  id: string;
  ageYears: number;
}

const { mockMembers, mockStats, mockTreeId, mockApi } = vi.hoisted(() => ({
  mockMembers: { list: [] as FamilyMember[] },
  mockStats: { value: null as FamilyStats | null },
  mockTreeId: { value: 'tree-1' as string | null },
  mockApi: { value: null as unknown },
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      members: mockMembers.list,
      stats: mockStats.value,
      currentFamilyTreeId: mockTreeId.value,
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../lib/adapters', () => ({
  getStatsApi: () => mockApi.value,
}));

const testI18n = createInstance();
void testI18n.init({
  lng: 'id',
  fallbackLng: 'id',
  defaultNS: 'common',
  resources: {
    id: { common: idCommon },
    en: { common: enCommon },
  },
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function baseStats(): FamilyStats {
  return {
    totalMembers: mockMembers.list.length,
    totalGenerations: 1,
    maleCount: 0,
    femaleCount: 0,
    ageDistribution: {},
    locationDistribution: {},
  } as FamilyStats;
}

const Wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
);

function payloadOldestLiving(entries?: OldestLivingRow[]): OldestLivingRow[] {
  return (
    entries ?? [
      { id: 'm-1', ageYears: 98 },
      { id: 'm-2', ageYears: 95 },
      { id: 'm-3', ageYears: 91 },
    ]
  );
}

function mockApiWith(impl: (treeId: string) => Promise<OldestLivingRow[]>): {
  getOldestLiving: (treeId: string) => Promise<OldestLivingRow[]>;
  getFamilySizeStats: () => Promise<never>;
  getGenerationsCount: () => Promise<never>;
  listUpcomingAnniversaries: () => Promise<never[]>;
  getPlaceDistribution: () => Promise<{ points: never[]; totalPlaced: number; excludedNoCoords: number }>;
  getFamilyDistribution: () => Promise<{ countries: never[]; totalWithPlace: number; excludedNoPlace: number }>;
} {
  return {
    getOldestLiving: vi.fn(impl),
    getFamilySizeStats: vi.fn(() => Promise.reject(new Error('not mocked'))),
    getGenerationsCount: vi.fn(() => Promise.reject(new Error('not mocked'))),
    listUpcomingAnniversaries: vi.fn(() => Promise.resolve([])),
    // Stub diam (payload kosong): section peta/distribution tidak dirender
    // pada test wiring oldest living; sekalian menutup utang stub v399.
    getPlaceDistribution: vi.fn(() => Promise.resolve({ points: [], totalPlaced: 0, excludedNoCoords: 0 })),
    getFamilyDistribution: vi.fn(() => Promise.resolve({ countries: [], totalWithPlace: 0, excludedNoPlace: 0 })),
  };
}

function renderSidebar(): ReturnType<typeof render> {
  mockStats.value = baseStats();
  mockMembers.list = [];
  return render(<StatsSidebar />, { wrapper: Wrapper });
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

afterEach(() => {
  cleanup();
});

describe('StatsSidebar Oldest Living wiring v303', () => {
  it('sukses: judul dan peringkat 1 sampai 3 dirender dengan umur', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve(payloadOldestLiving()));
    renderSidebar();
    expect(await screen.findByText('Anggota hidup tertua')).toBeTruthy();
    expect(screen.getByText('Peringkat 1')).toBeTruthy();
    expect(screen.getByText('Peringkat 2')).toBeTruthy();
    expect(screen.getByText('Peringkat 3')).toBeTruthy();
    expect(screen.getByText('98')).toBeTruthy();
    expect(screen.getByText('95')).toBeTruthy();
    expect(screen.getByText('91')).toBeTruthy();
  });

  it('urutan render sesuai urutan payload server (age desc dari server)', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve(payloadOldestLiving()));
    renderSidebar();
    expect(await screen.findByText('Anggota hidup tertua')).toBeTruthy();
    const rows = screen.getAllByText(/Peringkat \d+/);
    expect(rows[0].textContent).toBe('Peringkat 1');
    expect(rows[1].textContent).toBe('Peringkat 2');
    expect(rows[2].textContent).toBe('Peringkat 3');
  });

  it('array kosong: section tidak dirender walau fetch sukses', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve(payloadOldestLiving([])));
    renderSidebar();
    await flush();
    expect(screen.queryByText('Anggota hidup tertua')).toBeNull();
  });

  it('api null (adapter mock nihil): section tidak dirender tanpa crash', async () => {
    mockApi.value = null;
    renderSidebar();
    await flush();
    expect(screen.queryByText('Anggota hidup tertua')).toBeNull();
  });

  it('treeId kosong: api tak dipanggil dan section tidak dirender', async () => {
    const spy = mockApiWith(() => Promise.resolve(payloadOldestLiving()));
    mockApi.value = spy;
    mockTreeId.value = null;
    renderSidebar();
    await flush();
    expect(spy.getOldestLiving).not.toHaveBeenCalled();
    expect(screen.queryByText('Anggota hidup tertua')).toBeNull();
    mockTreeId.value = 'tree-1';
  });

  it('fetch reject: section tidak dirender tanpa crash', async () => {
    mockApi.value = mockApiWith(() => Promise.reject(new Error('network down')));
    renderSidebar();
    await flush();
    expect(screen.queryByText('Anggota hidup tertua')).toBeNull();
  });

  it('loading awal: section tidak dirender sebelum promise resolved', async () => {
    let resolveFn: (v: OldestLivingRow[]) => void = () => undefined;
    const pending = new Promise<OldestLivingRow[]>((resolve) => {
      resolveFn = resolve;
    });
    mockApi.value = mockApiWith(() => pending);
    renderSidebar();
    expect(screen.queryByText('Anggota hidup tertua')).toBeNull();
    await act(async () => {
      resolveFn(payloadOldestLiving());
      await pending;
    });
    expect(await screen.findByText('Anggota hidup tertua')).toBeTruthy();
  });

  it('maks 10 entri dirender walau server kirim lebih', async () => {
    const many = Array.from({ length: 14 }, (_, i) => ({
      id: `m-${i + 1}`,
      ageYears: 100 - i,
    }));
    mockApi.value = mockApiWith(() => Promise.resolve(payloadOldestLiving(many)));
    renderSidebar();
    expect(await screen.findByText('Anggota hidup tertua')).toBeTruthy();
    const rows = screen.getAllByText(/Peringkat \d+/);
    expect(rows.length).toBe(10);
    expect(screen.queryByText('Peringkat 11')).toBeNull();
  });

  it('locale en: judul bahasa Inggris dirender', async () => {
    await act(async () => {
      await testI18n.changeLanguage('en');
    });
    mockApi.value = mockApiWith(() => Promise.resolve(payloadOldestLiving()));
    renderSidebar();
    expect(await screen.findByText('Oldest living members')).toBeTruthy();
    expect(screen.getByText('Rank 1')).toBeTruthy();
    await act(async () => {
      await testI18n.changeLanguage('id');
    });
  });

  it('payload tanpa PII: nama anggota tidak pernah muncul di section', async () => {
    mockMembers.list = [
      { id: 'm-1', firstName: 'Rahmat', lastName: 'Siregar' } as unknown as FamilyMember,
    ];
    mockApi.value = mockApiWith(() => Promise.resolve(payloadOldestLiving()));
    renderSidebar();
    expect(await screen.findByText('Anggota hidup tertua')).toBeTruthy();
    expect(screen.queryByText('Rahmat')).toBeNull();
    expect(screen.queryByText('Siregar')).toBeNull();
  });

  it('umur 0 dan entri tunggal tetap dirender', async () => {
    mockApi.value = mockApiWith(() =>
      Promise.resolve(payloadOldestLiving([{ id: 'm-x', ageYears: 0 }])),
    );
    renderSidebar();
    expect(await screen.findByText('Anggota hidup tertua')).toBeTruthy();
    expect(screen.getByText('Peringkat 1')).toBeTruthy();
    const zeroCells = screen.getAllByText('0');
    expect(zeroCells.length).toBeGreaterThanOrEqual(1);
  });
});
