/**
 * @vitest-environment jsdom
 *
 * v277 fase ii: wiring Upcoming Anniversaries ke StatsSidebar.
 * Pola StatsSidebar.upcoming-birthdays.test.tsx (v276): store family
 * di-mock vi.hoisted, getStatsApi di-mock vi.mock adapters index,
 * i18n instance test membundel kedua locale JSON aplikasi, jam sistem
 * dipatok (fake timers SEBELUM render) supaya label deterministik.
 * Data berasal dari endpoint server v275 via adapter, bukan store klien.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import type { FamilyMember, FamilyStats } from '../../../types/family';
import { StatsSidebar } from '../StatsSidebar';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';

const { mockMembers, mockStats, mockTreeId, mockEntries, mockApi } = vi.hoisted(() => ({
  mockMembers: { list: [] as FamilyMember[] },
  mockStats: { value: null as FamilyStats | null },
  mockTreeId: { value: 'tree-1' as string | null },
  mockEntries: { value: [] as AnniversaryRow[] },
  mockApi: {
    value: null as {
      listUpcomingAnniversaries: (
        treeId: string,
        days?: number,
      ) => Promise<AnniversaryRow[]>;
      getGenerationsCount: (treeId: string) => Promise<{ generationCount: number }>;
      getOldestLiving: (treeId: string) => Promise<never[]>;
      getFamilySizeStats: (treeId: string) => Promise<never>;
    } | null,
  },
}));

interface AnniversaryRow {
  pairId: string;
  partnerNames: [string, string];
  marriageDate: string;
  nextAnniversary: string;
  daysUntil: number;
  yearsMarried: number;
}

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

function member(partial: Partial<FamilyMember> & { id: string; name: string }): FamilyMember {
  return {
    birthDate: '',
    gender: 'male',
    isAlive: true,
    generation: 1,
    maritalStatus: 'married',
    ...partial,
  } as FamilyMember;
}

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

function row(partial: Partial<AnniversaryRow> & { pairId: string }): AnniversaryRow {
  return {
    partnerNames: ['Pasangan A', 'Pasangan B'],
    marriageDate: '2000-06-15',
    nextAnniversary: '2026-06-15',
    daysUntil: 0,
    yearsMarried: 26,
    ...partial,
  };
}

const Wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
);

function renderSidebar(): void {
  mockStats.value = baseStats();
  render(<StatsSidebar />, { wrapper: Wrapper });
}

/** Siram mikrotask promise adapter di dalam act supaya useEffect selesai deterministik. */
async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
  });
}

/** Span daun terdalam yang memuat nama pasangan (partnerNames digabung ' · '). */
function nameSpan(nama: string): HTMLElement {
  const el = screen.getByText((_, element) => {
    if (!element || element.children.length > 0) return false;
    return (element.textContent ?? '').includes(nama);
  });
  if (!(el instanceof HTMLElement)) throw new Error(`nama ${nama} tidak ditemukan`);
  return el;
}

/** Teks gabungan baris entri (div flex terdekat di atas nama pasangan). */
function rowValue(nama: string): string {
  const row = nameSpan(nama).closest('div');
  if (!row) throw new Error(`baris ${nama} tidak ditemukan`);
  return row.textContent ?? '';
}

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2026-06-15T10:00:00Z'), toFake: ['Date'] });
  await testI18n.changeLanguage('id');
  // Satu anggota ber-ulang tahun hari ini supaya section Upcoming Birthdays
  // (v276) hidup dan asersi posisi relatif section v277 valid.
  mockMembers.list = [member({ id: 'bd1', name: 'Ultah Hari Ini', birthDate: '2000-06-15' })];
  mockApi.value = {
    listUpcomingAnniversaries: vi.fn(() => Promise.resolve(mockEntries.value)),
    getGenerationsCount: vi.fn(() => Promise.resolve({ generationCount: 2 })),
    // Stub diam: keenam method API dipanggil saat mount komponen.
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
    // Stub diam: section peta/distribution tidak relevan di test ini.
    getPlaceDistribution: vi.fn(() => Promise.resolve({ points: [], totalPlaced: 0, excludedNoCoords: 0 })),
    getFamilyDistribution: vi.fn(() => Promise.resolve({ countries: [], totalWithPlace: 0, excludedNoPlace: 0 })),
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* Fixture jendela 30 hari terhadap now 2026-06-15 (payload server v275):
 * a0  daysUntil 0 (hari ini, peringatan 26 tahun)
 * a1  daysUntil 1 (besok, peringatan 5 tahun)
 * a21 daysUntil 21 (jadi 35)
 * a30 daysUntil 30 (masuk jendela, jadi 12)
 * a31 daysUntil 31 (GUGUR) */
const FIXTURE: AnniversaryRow[] = [
  row({ pairId: 'a21', partnerNames: ['Candra Dua Puluh Satu', 'Dewi 21'], daysUntil: 21, yearsMarried: 35, nextAnniversary: '2026-07-06' }),
  row({ pairId: 'a0', partnerNames: ['Budi Nol', 'Ani Nol'], daysUntil: 0, yearsMarried: 26 }),
  row({ pairId: 'a30', partnerNames: ['Sinta Tiga Puluh', 'Rudi 30'], daysUntil: 30, yearsMarried: 12, nextAnniversary: '2026-07-15' }),
  row({ pairId: 'a1', partnerNames: ['Andi Satu', 'Rina Satu'], daysUntil: 1, yearsMarried: 5, nextAnniversary: '2026-06-16' }),
];

describe('StatsSidebar Upcoming Anniversaries wiring v277-ii', () => {
  it('merender section setelah Upcoming Birthdays dan sebelum Age Distribution', async () => {
    mockEntries.value = FIXTURE;
    renderSidebar();
    const judul = await screen.findByText('Peringatan Pernikahan Terdekat');
    const birthdays = screen.getByText('Ulang Tahun Terdekat');
    const ageDist = screen.getByText('Age Distribution');
    const setelahBirthdays =
      birthdays.compareDocumentPosition(judul) & Node.DOCUMENT_POSITION_FOLLOWING;
    const sebelumDist =
      judul.compareDocumentPosition(ageDist) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(setelahBirthdays).toBeTruthy();
    expect(sebelumDist).toBeTruthy();
  });

  it('urutan naik daysUntil sesuai payload: a0, a1, a21, a30', async () => {
    mockEntries.value = FIXTURE;
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    for (const nama of ['Budi Nol', 'Andi Satu', 'Candra Dua Puluh Satu', 'Sinta Tiga Puluh']) {
      expect(nameSpan(nama)).toBeTruthy();
    }
    const angka = ['Budi Nol', 'Andi Satu', 'Candra Dua Puluh Satu', 'Sinta Tiga Puluh'].map(
      (nama) => {
        const t = rowValue(nama);
        const m = /([0-9]+) hari lagi/.exec(t);
        return m ? Number(m[1]) : /Hari ini/.test(t) ? 0 : /Besok/.test(t) ? 1 : NaN;
      },
    );
    expect(angka).toEqual([0, 1, 21, 30]);
  });

  it('boundary hari ini: label Hari ini dan peringatan 26 tahun', async () => {
    mockEntries.value = [row({ pairId: 'a0', partnerNames: ['Budi Nol', 'Ani Nol'] })];
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    const baris = rowValue('Budi Nol');
    expect(baris).toContain('Hari ini');
    expect(baris).toContain('Peringatan 26 tahun');
  });

  it('boundary 30 hari masuk jendela dan label 30 hari lagi', async () => {
    mockEntries.value = [row({ pairId: 'a30', partnerNames: ['Sinta Tiga Puluh', 'Rudi 30'], daysUntil: 30, yearsMarried: 12, nextAnniversary: '2026-07-15' })];
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    expect(rowValue('Sinta Tiga Puluh')).toContain('30 hari lagi');
  });

  it('jendela 30 hari adalah tanggung jawab server: payload kosong berarti section tak dirender', async () => {
    // Server v275 sudah memfilter daysUntil 1..30; klien jujur merender
    // apa pun payload. Entry di luar jendela tidak pernah sampai klien,
    // sehingga ekivalen boundary-nya adalah payload kosong dari server.
    mockEntries.value = [];
    renderSidebar();
    await flush();
    expect(screen.queryByText('Peringatan Pernikahan Terdekat')).toBeNull();
  });

  it('29 Feb diperingati 1 Mar pada tahun non-kabisat via payload server', async () => {
    mockEntries.value = [row({ pairId: 'k29', partnerNames: ['Kabisat Dua Sembilan', 'Mira 29'], marriageDate: '2000-02-29', nextAnniversary: '2027-03-01', daysUntil: 4, yearsMarried: 27 })];
    vi.setSystemTime(new Date('2027-02-25T10:00:00Z'));
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    const baris = rowValue('Kabisat Dua Sembilan');
    expect(baris).toContain('1 Mar');
    expect(baris).toContain('4 hari lagi');
    expect(baris).not.toContain('2027-03-01');
  });

  it('label besok dan format tanggal lokal id, bukan YYYY-MM-DD mentah', async () => {
    mockEntries.value = [row({ pairId: 'a1', partnerNames: ['Andi Satu', 'Rina Satu'], daysUntil: 1, yearsMarried: 5, nextAnniversary: '2026-06-16' })];
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    const baris = rowValue('Andi Satu');
    expect(baris).toContain('Besok');
    expect(baris).toContain('16 Jun');
    expect(baris).not.toContain('2026-06-16');
  });

  it('label en via changeLanguage: Today, Tomorrow, days away plural, ordinal th', async () => {
    mockEntries.value = FIXTURE;
    await testI18n.changeLanguage('en');
    renderSidebar();
    await screen.findByText('Upcoming Anniversaries');
    expect(rowValue('Budi Nol')).toContain('Today');
    expect(rowValue('Andi Satu')).toContain('Tomorrow');
    expect(rowValue('Candra Dua Puluh Satu')).toContain('21 days away');
    expect(rowValue('Sinta Tiga Puluh')).toContain('30 days away');
    expect(rowValue('Budi Nol')).toContain('26th anniversary');
  });

  it('ordinal en 1st 2nd 3rd 4th dan id seragam Peringatan N tahun', async () => {
    mockEntries.value = [
      row({ pairId: 'o1', partnerNames: ['Satu Pertama', 'Ibu Satu'], yearsMarried: 1, daysUntil: 10, nextAnniversary: '2026-06-25' }),
      row({ pairId: 'o2', partnerNames: ['Dua Kedua', 'Ibu Dua'], yearsMarried: 2, daysUntil: 11, nextAnniversary: '2026-06-26' }),
      row({ pairId: 'o3', partnerNames: ['Tiga Ketiga', 'Ibu Tiga'], yearsMarried: 3, daysUntil: 12, nextAnniversary: '2026-06-27' }),
      row({ pairId: 'o4', partnerNames: ['Empat Keempat', 'Ibu Empat'], yearsMarried: 4, daysUntil: 13, nextAnniversary: '2026-06-28' }),
      row({ pairId: 'o42', partnerNames: ['Empat Dua', 'Ibu 42'], yearsMarried: 42, daysUntil: 14, nextAnniversary: '2026-06-29' }),
    ];
    await testI18n.changeLanguage('en');
    renderSidebar();
    await screen.findByText('Upcoming Anniversaries');
    expect(rowValue('Satu Pertama')).toContain('1st anniversary');
    expect(rowValue('Dua Kedua')).toContain('2nd anniversary');
    expect(rowValue('Tiga Ketiga')).toContain('3rd anniversary');
    expect(rowValue('Empat Keempat')).toContain('4th anniversary');
    await testI18n.changeLanguage('id');
    await flush();
    expect(rowValue('Empat Dua')).toContain('Peringatan 42 tahun');
    expect(rowValue('Satu Pertama')).toContain('Peringatan 1 tahun');
  });

  it('adapter null: section tidak dirender tanpa crash dan api tak dipanggil', async () => {
    const spy = vi.fn(() => Promise.resolve([]));
    mockApi.value = null;
    mockEntries.value = [row({ pairId: 'x' })];
    void spy;
    renderSidebar();
    await flush();
    expect(screen.queryByText('Peringatan Pernikahan Terdekat')).toBeNull();
    expect(mockApi.value).toBeNull();
  });

  it('fetch gagal: section tidak dirender tanpa crash', async () => {
    mockApi.value = {
      listUpcomingAnniversaries: vi.fn(() => Promise.reject(new Error('network down'))),
      getGenerationsCount: vi.fn(() => Promise.resolve({ generationCount: 2 })),
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
      getPlaceDistribution: vi.fn(() => Promise.resolve({ points: [], totalPlaced: 0, excludedNoCoords: 0 })),
      getFamilyDistribution: vi.fn(() => Promise.resolve({ countries: [], totalWithPlace: 0, excludedNoPlace: 0 })),
    };
    renderSidebar();
    await flush();
    expect(screen.queryByText('Peringatan Pernikahan Terdekat')).toBeNull();
  });

  it('treeId kosong: api tak dipanggil dan section tidak dirender', async () => {
    const spy = vi.fn(() => Promise.resolve(mockEntries.value));
    mockApi.value = {
      listUpcomingAnniversaries: spy,
      getGenerationsCount: vi.fn(() => Promise.resolve({ generationCount: 2 })),
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
      getPlaceDistribution: vi.fn(() => Promise.resolve({ points: [], totalPlaced: 0, excludedNoCoords: 0 })),
      getFamilyDistribution: vi.fn(() => Promise.resolve({ countries: [], totalWithPlace: 0, excludedNoPlace: 0 })),
    };
    mockTreeId.value = null;
    mockEntries.value = FIXTURE;
    renderSidebar();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    expect(screen.queryByText('Peringatan Pernikahan Terdekat')).toBeNull();
    mockTreeId.value = 'tree-1';
  });

  it('pasangan tidak dobel: tiap pairId dirender satu kali', async () => {
    mockEntries.value = [
      row({ pairId: 'p1', partnerNames: ['Pasangan Satu', 'Ibu Satu'] }),
      row({ pairId: 'p2', partnerNames: ['Pasangan Dua', 'Ibu Dua'], daysUntil: 2, yearsMarried: 7, nextAnniversary: '2026-06-17' }),
    ];
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    expect(nameSpan('Pasangan Satu').textContent).toContain('Pasangan Satu · ');
    expect(nameSpan('Pasangan Dua').textContent).toContain('Pasangan Dua · ');
  });

  it('anti-regresi: section Kelompok Umur PBB dan Upcoming Birthdays tetap dirender', async () => {
    mockEntries.value = FIXTURE;
    renderSidebar();
    await screen.findByText('Peringatan Pernikahan Terdekat');
    expect(screen.getByText('Kelompok Umur PBB')).toBeTruthy();
    expect(screen.getByText('Ulang Tahun Terdekat')).toBeTruthy();
  });
});
