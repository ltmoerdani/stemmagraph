/**
 * @vitest-environment jsdom
 *
 * v286: wiring Generations count ke StatsSidebar.
 * Pola StatsSidebar.upcoming-anniversaries.test.tsx (v277): store family
 * di-mock vi.hoisted, getStatsApi di-mock vi.mock adapters index,
 * i18n instance test membundel kedua locale JSON aplikasi.
 * Data berasal dari endpoint server via adapter, bukan store klien.
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

interface GenerationsCountRow {
  generationCount: number | null;
}

/** Stub kosong bentuk FamilySizeStatsDto: average null berarti section tak dirender. */
interface FamilySizeStatsStub {
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

function mockApiWith(
  impl: (treeId: string) => Promise<GenerationsCountRow>,
): {
  getGenerationsCount: (treeId: string) => Promise<GenerationsCountRow>;
  getOldestLiving: () => Promise<never[]>;
  getFamilySizeStats: () => Promise<FamilySizeStatsStub>;
  listUpcomingAnniversaries: () => Promise<never[]>;
  getPlaceDistribution: () => Promise<{ points: never[]; totalPlaced: number; excludedNoCoords: number }>;
  getFamilyDistribution: () => Promise<{ countries: never[]; totalWithPlace: number; excludedNoPlace: number }>;
} {
  return {
    getGenerationsCount: vi.fn(impl),
    // Stub diam: keenam method API dipanggil saat mount, payload kosong
    // menjaga section lain tidak dirender pada test wiring generations.
    getOldestLiving: vi.fn(() => Promise.resolve([])),
    getFamilySizeStats: vi.fn(() =>
      Promise.resolve({
        average: null,
        median: null,
        max: 0,
        distribution: { zero: 0, oneToTwo: 0, threeToFour: 0, fivePlus: 0 },
        familyCount: 0,
        excludedCount: 0,
      }),
    ),
    listUpcomingAnniversaries: vi.fn(() => Promise.resolve([])),
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

describe('StatsSidebar Generations wiring v286', () => {
  it('sukses: section dirender dengan angka dari dto.generationCount', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve({ generationCount: 4 }));
    renderSidebar();
    expect(await screen.findByText('Generasi')).toBeTruthy();
    expect(screen.getByText('4 generasi')).toBeTruthy();
  });

  it('treeId kosong: api tak dipanggil dan section tidak dirender', async () => {
    const spy = mockApiWith(() => Promise.resolve({ generationCount: 4 }));
    mockApi.value = spy;
    mockTreeId.value = null;
    renderSidebar();
    await flush();
    expect(spy.getGenerationsCount).not.toHaveBeenCalled();
    expect(screen.queryByText('Generasi')).toBeNull();
    mockTreeId.value = 'tree-1';
  });

  it('fetch reject: section tidak dirender tanpa crash', async () => {
    mockApi.value = mockApiWith(() => Promise.reject(new Error('network down')));
    renderSidebar();
    await flush();
    expect(screen.queryByText('Generasi')).toBeNull();
  });

  it('generationCount null dari dto: section tidak dirender walau fetch sukses', async () => {
    mockApi.value = mockApiWith(() => Promise.resolve({ generationCount: null }));
    renderSidebar();
    await flush();
    expect(screen.queryByText('Generasi')).toBeNull();
  });

  it('locale id: judul Generasi dan label N generasi', async () => {
    await testI18n.changeLanguage('id');
    mockApi.value = mockApiWith(() => Promise.resolve({ generationCount: 7 }));
    renderSidebar();
    expect(await screen.findByText('Generasi')).toBeTruthy();
    expect(screen.getByText('7 generasi')).toBeTruthy();
  });

  it('locale en: judul Generations, plural 1 generation dan N generations', async () => {
    await testI18n.changeLanguage('en');
    mockApi.value = mockApiWith(() => Promise.resolve({ generationCount: 3 }));
    renderSidebar();
    expect(await screen.findByText('3 generations')).toBeTruthy();
    // Judul 'Generations' bentrok dengan label stat overview hardcoded;
    // pastikan section v286 ikut terender di antaranya.
    expect(screen.getAllByText('Generations').length).toBeGreaterThanOrEqual(2);
    cleanup();
    mockApi.value = mockApiWith(() => Promise.resolve({ generationCount: 1 }));
    renderSidebar();
    expect(await screen.findByText('1 generation')).toBeTruthy();
    await testI18n.changeLanguage('id');
  });

  it('perubahan treeId memicu panggilan baru dengan id terbaru', async () => {
    const spy = mockApiWith((treeId) =>
      Promise.resolve({ generationCount: treeId === 'tree-2' ? 9 : 2 }),
    );
    mockApi.value = spy;
    const { rerender } = renderSidebar();
    await flush();
    expect(spy.getGenerationsCount).toHaveBeenCalledTimes(1);
    expect(spy.getGenerationsCount).toHaveBeenCalledWith('tree-1');
    mockTreeId.value = 'tree-2';
    rerender(<StatsSidebar />);
    await flush();
    expect(spy.getGenerationsCount).toHaveBeenCalledTimes(2);
    expect(spy.getGenerationsCount).toHaveBeenLastCalledWith('tree-2');
    expect(screen.getByText('9 generasi')).toBeTruthy();
  });

  it('unmount saat promise pending: resolved value tidak memicu update state', async () => {
    let resolveFn: (v: GenerationsCountRow) => void = () => undefined;
    const pending = new Promise<GenerationsCountRow>((resolve) => {
      resolveFn = resolve;
    });
    mockApi.value = mockApiWith(() => pending);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { unmount } = renderSidebar();
    unmount();
    await act(async () => {
      resolveFn({ generationCount: 7 });
      await pending;
    });
    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
