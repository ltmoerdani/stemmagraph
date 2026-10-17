/**
 * @vitest-environment jsdom
 *
 * v270 fase ii: wiring kelompok umur PBB ke StatsSidebar.
 * Store family di-mock (pola StatsSidebar.living-stats.test.tsx) supaya
 * komponen memanggil computeAgeGroupsPBB dari members sungguhan di store.
 * i18n memakai instance i18next test via I18nextProvider yang membundel
 * kedua locale dari berkas JSON aplikasi yang sama: label id (default)
 * dan en diuji lewat i18n.changeLanguage. Loader lazy resourcesToBackend
 * milik app tidak deterministik di vitest (chunk en jatuh ke fallback id),
 * sehingga instance test membundel kedua locale; paritas kunci en-id
 * tetap dijaga locales.parity.test.ts.
 * Jam sistem dipatok 2026-06-15T10:00:00Z agar umur deterministik.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { createInstance } from 'i18next';
import { I18nextProvider } from 'react-i18next';
import type { ReactNode } from 'react';
import type { FamilyMember, FamilyStats } from '../../../types/family';
import { StatsSidebar } from '../StatsSidebar';
import idCommon from '../../../lib/i18n/locales/id/common.json';
import enCommon from '../../../lib/i18n/locales/en/common.json';

const { mockMembers, mockStats } = vi.hoisted(() => ({
  mockMembers: { list: [] as FamilyMember[] },
  mockStats: { value: null as FamilyStats | null },
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector?: (s: unknown) => unknown) => {
    const state = { members: mockMembers.list, stats: mockStats.value };
    return selector ? selector(state) : state;
  },
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
    maleCount: mockMembers.list.filter((m) => m.gender === 'male').length,
    femaleCount: mockMembers.list.filter((m) => m.gender === 'female').length,
    ageDistribution: { '0-18': 2, '19-35': 1, '36-60': 1, '60+': 0 },
    locationDistribution: { Jakarta: 2, Bandung: 1 },
  };
}

const Wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
);

function renderSidebar(members: FamilyMember[]): void {
  mockMembers.list = members;
  mockStats.value = baseStats();
  render(<StatsSidebar />, { wrapper: Wrapper });
}

/** Nilai gabungan teks pada baris label + angka (div flex terdekat di atas label). */
function rowValue(label: string): string {
  const row = screen.getByText(label).closest('div');
  if (!row) throw new Error(`baris ${label} tidak ditemukan`);
  return row.textContent ?? '';
}

beforeEach(async () => {
  vi.useFakeTimers({ now: new Date('2026-06-15T10:00:00Z'), toFake: ['Date'] });
  await testI18n.changeLanguage('id');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/* Fixture campur, jam 2026-06-15:
 * c1 2015-03-10 umur 11 -> children, c2 2020-07-04 umur 5 -> children,
 * a1 1990-01-01 umur 36 -> adults, s1 1950-01-01 umur 76 -> seniors,
 * d1 deceased, x1 birthDate rusak. Eksak: children 2, adults 1, seniors 1. */
const CAMPURAN: FamilyMember[] = [
  member({ id: 'c1', name: 'Anak Satu', birthDate: '2015-03-10' }),
  member({ id: 'c2', name: 'Anak Dua', birthDate: '2020-07-04', gender: 'female' }),
  member({ id: 'a1', name: 'Dewasa Satu', birthDate: '1990-01-01' }),
  member({ id: 's1', name: 'Lansia Satu', birthDate: '1950-01-01' }),
  member({
    id: 'd1',
    name: 'Almarhum',
    birthDate: '1950-01-01',
    deathDate: '2020-01-01',
    isAlive: false,
  }),
  member({ id: 'x1', name: 'Tanpa Tanggal', birthDate: 'bukan-tanggal' }),
];

const LABEL_ID = ['Anak-anak (0-14)', 'Dewasa (15-64)', 'Lansia (65+)'];
const LABEL_EN = ['Children (0-14)', 'Adults (15-64)', 'Seniors (65+)'];

describe('StatsSidebar Age Groups PBB wiring v270-ii', () => {
  it('merender section Age Groups PBB antara Living Stats dan Age Distribution', () => {
    renderSidebar(CAMPURAN);
    const living = screen.getByText('Living Stats');
    const ageGroups = screen.getByText('Kelompok Umur PBB');
    const ageDist = screen.getByText('Age Distribution');
    const setelahLiving =
      living.compareDocumentPosition(ageGroups) & Node.DOCUMENT_POSITION_FOLLOWING;
    const sebelumDist =
      ageGroups.compareDocumentPosition(ageDist) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(setelahLiving).toBeTruthy();
    expect(sebelumDist).toBeTruthy();
  });

  it('angka eksak fixture campur per kelompok: children 2, adults 1, seniors 1', () => {
    renderSidebar(CAMPURAN);
    expect(rowValue('Anak-anak (0-14)')).toContain('2');
    expect(rowValue('Dewasa (15-64)')).toContain('1');
    expect(rowValue('Lansia (65+)')).toContain('1');
  });

  it('label id (default) dirender untuk judul dan ketiga baris', () => {
    renderSidebar(CAMPURAN);
    expect(screen.getByText('Kelompok Umur PBB')).toBeTruthy();
    for (const label of LABEL_ID) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('label en via i18n.changeLanguage dengan angka sama', async () => {
    await testI18n.changeLanguage('en');
    renderSidebar(CAMPURAN);
    expect(screen.getByText('Age Groups PBB')).toBeTruthy();
    for (const label of LABEL_EN) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(rowValue('Children (0-14)')).toContain('2');
    expect(rowValue('Adults (15-64)')).toContain('1');
    expect(rowValue('Seniors (65+)')).toContain('1');
  });

  it('pohon kosong: ketiga kelompok 0', () => {
    renderSidebar([]);
    for (const label of LABEL_ID) {
      expect(rowValue(label)).toContain('0');
    }
  });

  it('deceased tidak menambah kelompok mana pun', () => {
    renderSidebar([
      member({
        id: 'd2',
        name: 'Meninggal Umur 76',
        birthDate: '1950-01-01',
        deathDate: '2020-01-01',
        isAlive: false,
      }),
    ]);
    for (const label of LABEL_ID) {
      expect(rowValue(label)).toContain('0');
    }
  });

  it('birthDate rusak tidak menambah kelompok mana pun', () => {
    renderSidebar([member({ id: 'x2', name: 'Rusak', birthDate: 'bukan-tanggal' })]);
    for (const label of LABEL_ID) {
      expect(rowValue(label)).toContain('0');
    }
  });

  it('boundary anniversary: umur 14 children dan umur 15 adults', () => {
    renderSidebar([
      member({ id: 'b14', name: 'Umur Empat Belas', birthDate: '2011-06-16' }),
      member({ id: 'b15', name: 'Umur Lima Belas', birthDate: '2011-06-15' }),
    ]);
    expect(rowValue('Anak-anak (0-14)')).toContain('1');
    expect(rowValue('Dewasa (15-64)')).toContain('1');
    expect(rowValue('Lansia (65+)')).toContain('0');
  });

  it('anti-regresi: Living Stats tetap dirender dengan hitungan dari fixture campur', () => {
    renderSidebar(CAMPURAN);
    const card = screen.getByText('Living').parentElement;
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText('5')).toBeTruthy();
    const deceasedCard = screen.getByText('Deceased').parentElement;
    expect(within(deceasedCard as HTMLElement).getByText('1')).toBeTruthy();
  });

  it('anti-regresi: Gender Distribution tetap dirender dengan hitungan', () => {
    renderSidebar(CAMPURAN);
    expect(screen.getByText('Gender Distribution')).toBeTruthy();
    const maleCard = screen.getByText('Male').parentElement;
    const femaleCard = screen.getByText('Female').parentElement;
    expect(within(maleCard as HTMLElement).getByText('5')).toBeTruthy();
    expect(within(femaleCard as HTMLElement).getByText('1')).toBeTruthy();
  });

  it('anti-regresi: Age Distribution dan Locations tetap dirender dengan isinya', () => {
    renderSidebar(CAMPURAN);
    expect(screen.getByText('Age Distribution')).toBeTruthy();
    expect(rowValue('0-18 years')).toContain('2');
    expect(screen.getByText('Locations')).toBeTruthy();
    const locRow = screen.getByText('Jakarta').parentElement?.parentElement;
    expect(locRow?.textContent ?? '').toContain('2');
  });
});
