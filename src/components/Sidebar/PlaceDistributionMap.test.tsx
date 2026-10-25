/**
 * @vitest-environment jsdom
 *
 * Test UI v399: PlaceDistributionMap. Pola StatsSidebar.age-groups
 * (store family di-mock, i18next instance test membundel kedua locale
 * JSON aplikasi yang sama). Cakupan: adapter null tidak render, treeId
 * kosong tidak render, sukses render SVG dengan marker count (id dan
 * en), fallback daftar teks saat points kosong, fetch gagal tidak
 * render, dan tidak ada request tile/jaringan selain satu fetch
 * adapter (dipastikan getPlaceDistribution dipanggil satu kali).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import { PlaceDistributionMap } from './PlaceDistributionMap';
import idCommon from '../../lib/i18n/locales/id/common.json';
import enCommon from '../../lib/i18n/locales/en/common.json';

const { mockTreeId, mockApi } = vi.hoisted(() => ({
  mockTreeId: { value: 'tree-1' as string | null },
  mockApi: { getPlaceDistribution: vi.fn() },
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: (selector?: (s: unknown) => unknown) => {
    const state = { currentFamilyTreeId: mockTreeId.value };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../lib/adapters', () => ({
  getStatsApi: () => (mockTreeId.value ? mockApi : null),
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

function renderMap(): void {
  render(
    <I18nextProvider i18n={testI18n}>
      <PlaceDistributionMap />
    </I18nextProvider>,
  );
}

beforeEach(async () => {
  mockTreeId.value = 'tree-1';
  await testI18n.changeLanguage('id');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PlaceDistributionMap', () => {
  it('tidak merender sebelum data termuat', () => {
    mockApi.getPlaceDistribution.mockReturnValue(new Promise(() => {}));
    renderMap();
    expect(screen.queryByTestId('place-distribution-map')).toBeNull();
    expect(mockApi.getPlaceDistribution).toHaveBeenCalledTimes(1);
  });

  it('tidak merender saat adapter null (mock/supabase)', () => {
    mockTreeId.value = null;
    renderMap();
    expect(screen.queryByTestId('place-distribution-map')).toBeNull();
    expect(mockApi.getPlaceDistribution).not.toHaveBeenCalled();
  });

  it('merender SVG dengan marker sesuai payload id', async () => {
    mockApi.getPlaceDistribution.mockResolvedValue({
      points: [
        { lat: -6.21, lng: 106.85, count: 3 },
        { lat: 40.71, lng: -74.01, count: 1 },
      ],
      totalPlaced: 4,
      excludedNoCoords: 1,
    });
    renderMap();
    await waitFor(() => expect(screen.getByTestId('place-distribution-svg')).toBeTruthy());
    expect(screen.getByText('Peta sebaran anggota')).toBeTruthy();
    expect(screen.getByText('Ukuran lingkaran = jumlah tempat yang bulat ke sel 2 desimal')).toBeTruthy();
    const svg = screen.getByTestId('place-distribution-svg');
    const circles = svg.querySelectorAll('circle');
    expect(circles).toHaveLength(2);
    // Marker terbesar punya count 3.
    const radii = [...circles].map((c) => Number(c.getAttribute('r')));
    expect(Math.max(...radii)).toBeCloseTo(10, 5);
  });

  it('merender label en saat bahasa Inggris', async () => {
    await testI18n.changeLanguage('en');
    mockApi.getPlaceDistribution.mockResolvedValue({
      points: [{ lat: 0, lng: 0, count: 2 }],
      totalPlaced: 2,
      excludedNoCoords: 0,
    });
    renderMap();
    await waitFor(() => expect(screen.getByTestId('place-distribution-svg')).toBeTruthy());
    expect(screen.getByText('Member distribution map')).toBeTruthy();
    const svg = screen.getByTestId('place-distribution-svg');
    const title = svg.querySelector('title');
    expect(title?.textContent).toBe('2 places in this area');
  });

  it('fallback daftar teks saat points kosong', async () => {
    mockApi.getPlaceDistribution.mockResolvedValue({
      points: [],
      totalPlaced: 0,
      excludedNoCoords: 5,
    });
    renderMap();
    await waitFor(() => expect(screen.getByTestId('place-distribution-empty')).toBeTruthy());
    expect(screen.getByText('Belum ada tempat berkooordinat pada pohon ini')).toBeTruthy();
    expect(screen.queryByTestId('place-distribution-svg')).toBeNull();
  });

  it('tidak merender saat fetch gagal', async () => {
    mockApi.getPlaceDistribution.mockRejectedValue(new Error('network down'));
    renderMap();
    await waitFor(() => expect(mockApi.getPlaceDistribution).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('place-distribution-map')).toBeNull();
  });
});
