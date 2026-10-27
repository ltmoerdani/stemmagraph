/**
 * @vitest-environment jsdom
 *
 * v290 fase iii b: wiring Family Size stats ke StatsSidebar.
 * Pola StatsSidebar.generations.test.tsx (v286): store family di-mock
 * vi.hoisted, getStatsApi di-mock vi.mock adapters index, i18n instance
 * test membundel kedua locale JSON aplikasi.
 * Data berasal dari endpoint server v288 via adapter, bukan store klien.
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

interface FamilySizeRow {
  average: number | null;
  median: number | null;
  max: number;
  distribution: {
    zero: number;
    oneToTwo: number;
    threeToFour: number;
    fivePlus: number;
  };
  familyCount: number;
  excludedCount: number;
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

function payloadFamilySize(overrides?: Partial<FamilySizeRow>): FamilySizeRow {
  return {
    average: 2.5,
    median: 2,
    max: 12,
    distribution: { zero: 1, oneToTwo: 4, threeToFour: 2, fivePlus: 1 },
    familyCount: 8,
    excludedCount: 0,
    ...overrides,
  };
}

function mockApiWith(
  impl: (treeId: string) => Promise<FamilySizeRow>,
): {
  getFamilySizeStats: (treeId: string) => Promise<FamilySizeRow>;
  getOldestLiving: () => Promise<never[]>;
  getGenerationsCount: () => Promise<{ generationCount: number }>;
  listUpcomingAnniversaries: () => Promise<never[]>;
  getPlaceDistribution: () => Promise<{ points: never[]; totalPlaced: number; excludedNoCoords: number }>;
  getFamilyDistribution: () => Promise<{ countries: never[]; totalWithPlace: number; excludedNoPlace: number }>;
} {
  return {
    getFamilySizeStats: vi.fn(impl),
    // Stub diam: section oldest living tidak dirender pada test wiring
    // family size; payload array kosong menjaga render tetap minimal.
    getOldestLiving: vi.fn(() => Promise.resolve([])),
    getGenerationsCount: vi.fn(() => Promise.resolve({ generationCount: 1 })),
    listUpcomingAnniversaries: vi.fn(() => Promise.resolve([])),
    // Stub diam (payload kosong): section lain tidak dirender pada test
    // wiring family size; sekalian menutup utang stub v399.
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

describe('StatsSidebar Family Size wiring v290', () => {
  it('sukses: average median max familyCount dirender dengan 1 desimal', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve(payloadFamilySize()));
    renderSidebar();
    expect(await screen.findByText('Ukuran Keluarga')).toBeTruthy();
    expect(screen.getByText('Rata-rata anak per keluarga')).toBeTruthy();
    expect(screen.getByText('2.5')).toBeTruthy();
    expect(screen.getByText('Median anak per keluarga')).toBeTruthy();
    expect(screen.getByText('2.0')).toBeTruthy();
    expect(screen.getByText('Keluarga terbesar')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('Jumlah keluarga')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('4 bucket distribusi terlabel dan terisi dari dto.distribution', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve(payloadFamilySize()));
    renderSidebar();
    expect(await screen.findByText('Ukuran Keluarga')).toBeTruthy();
    expect(screen.getByText('Tanpa anak')).toBeTruthy();
    expect(screen.getByText('1 sampai 2 anak')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('3 sampai 4 anak')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('5 anak atau lebih')).toBeTruthy();
  });

  it('dto.average null: section tidak dirender walau fetch sukses', async () => {
    mockApi.value = mockApiWith(() =>
      Promise.resolve(payloadFamilySize({ average: null, median: null })),
    );
    renderSidebar();
    await flush();
    expect(screen.queryByText('Ukuran Keluarga')).toBeNull();
  });

  it('api null (adapter mock nihil): section tidak dirender tanpa crash', async () => {
    mockApi.value = null;
    renderSidebar();
    await flush();
    expect(screen.queryByText('Ukuran Keluarga')).toBeNull();
  });

  it('treeId kosong: api tak dipanggil dan section tidak dirender', async () => {
    const spy = mockApiWith(() => Promise.resolve(payloadFamilySize()));
    mockApi.value = spy;
    mockTreeId.value = null;
    renderSidebar();
    await flush();
    expect(spy.getFamilySizeStats).not.toHaveBeenCalled();
    expect(screen.queryByText('Ukuran Keluarga')).toBeNull();
    mockTreeId.value = 'tree-1';
  });

  it('fetch reject: section tidak dirender tanpa crash', async () => {
    mockApi.value = mockApiWith(() => Promise.reject(new Error('network down')));
    renderSidebar();
    await flush();
    expect(screen.queryByText('Ukuran Keluarga')).toBeNull();
  });

  it('loading awal: section tidak dirender sebelum promise resolved', async () => {
    let resolveFn: (v: FamilySizeRow) => void = () => undefined;
    const pending = new Promise<FamilySizeRow>((resolve) => {
      resolveFn = resolve;
    });
    mockApi.value = mockApiWith(() => pending);
    renderSidebar();
    expect(screen.queryByText('Ukuran Keluarga')).toBeNull();
    await act(async () => {
      resolveFn(payloadFamilySize());
      await pending;
    });
    expect(await screen.findByText('Ukuran Keluarga')).toBeTruthy();
  });

  it('locale id dan en: label berbeda sesuai locale', async () => {
    await testI18n.changeLanguage('id');
    mockApi.value = mockApiWith(() => Promise.resolve(payloadFamilySize()));
    renderSidebar();
    expect(await screen.findByText('Ukuran Keluarga')).toBeTruthy();
    expect(screen.getByText('Rata-rata anak per keluarga')).toBeTruthy();
    expect(screen.getByText('Tanpa anak')).toBeTruthy();
    cleanup();

    await testI18n.changeLanguage('en');
    mockApi.value = mockApiWith(() => Promise.resolve(payloadFamilySize()));
    renderSidebar();
    expect(await screen.findByText('Family Size')).toBeTruthy();
    expect(screen.getByText('Average children per family')).toBeTruthy();
    expect(screen.getByText('Median children per family')).toBeTruthy();
    expect(screen.getByText('Largest family')).toBeTruthy();
    expect(screen.getByText('Families')).toBeTruthy();
    expect(screen.getByText('No children')).toBeTruthy();
    expect(screen.getByText('1 to 2 children')).toBeTruthy();
    expect(screen.getByText('3 to 4 children')).toBeTruthy();
    expect(screen.getByText('5 or more children')).toBeTruthy();
    await testI18n.changeLanguage('id');
  });

  it('excludedCount positif: tidak merusak render', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve(payloadFamilySize({ excludedCount: 7 })));
    renderSidebar();
    expect(await screen.findByText('Ukuran Keluarga')).toBeTruthy();
    expect(screen.getByText('2.5')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('payload kontrak v288 lengkap: seluruh nilai dirender utuh', async () => {
    mockApi.value = mockApiWith(() =>
      Promise.resolve(
        payloadFamilySize({
          average: 3.42,
          median: 3,
          max: 14,
          distribution: { zero: 2, oneToTwo: 4, threeToFour: 3, fivePlus: 1 },
          familyCount: 10,
          excludedCount: 1,
        }),
      ),
    );
    renderSidebar();
    expect(await screen.findByText('Ukuran Keluarga')).toBeTruthy();
    expect(screen.getByText('3.4')).toBeTruthy();
    expect(screen.getByText('3.0')).toBeTruthy();
    expect(screen.getByText('14')).toBeTruthy();
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('Tanpa anak')).toBeTruthy();
    expect(screen.getByText('1 sampai 2 anak')).toBeTruthy();
    expect(screen.getByText('3 sampai 4 anak')).toBeTruthy();
    expect(screen.getByText('5 anak atau lebih')).toBeTruthy();
  });

  it('perubahan treeId memicu panggilan baru dengan id terbaru', async () => {
    const spy = mockApiWith((treeId) =>
      Promise.resolve(payloadFamilySize({ max: treeId === 'tree-2' ? 20 : 12 })),
    );
    mockApi.value = spy;
    const { rerender } = renderSidebar();
    await flush();
    expect(spy.getFamilySizeStats).toHaveBeenCalledTimes(1);
    expect(spy.getFamilySizeStats).toHaveBeenCalledWith('tree-1');
    mockTreeId.value = 'tree-2';
    rerender(<StatsSidebar />);
    await flush();
    expect(spy.getFamilySizeStats).toHaveBeenCalledTimes(2);
    expect(spy.getFamilySizeStats).toHaveBeenLastCalledWith('tree-2');
    expect(screen.getByText('20')).toBeTruthy();
  });

  it('unmount saat promise pending: resolved value tidak memicu update state', async () => {
    let resolveFn: (v: FamilySizeRow) => void = () => undefined;
    const pending = new Promise<FamilySizeRow>((resolve) => {
      resolveFn = resolve;
    });
    mockApi.value = mockApiWith(() => pending);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = renderSidebar();
    unmount();
    await act(async () => {
      resolveFn(payloadFamilySize());
      await pending;
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
