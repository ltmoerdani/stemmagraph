/**
 * @vitest-environment jsdom
 *
 * v276 fase ii: wiring Upcoming Birthdays ke StatsSidebar.
 * Pola StatsSidebar.age-groups.test.tsx: store family di-mock vi.hoisted,
 * i18n instance test membundel kedua locale JSON aplikasi, jam sistem
 * dipatok 2026-06-15T10:00:00Z (fake timers SEBELUM render) supaya
 * daysUntil deterministik. Paritas kunci id-en tetap dijaga
 * locales.parity.test.ts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
    locationDistribution: { Jakarta: 1 },
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

/** Teks gabungan baris entri (div flex terdekat di atas nama). */
function rowValue(nama: string): string {
  const row = screen.getByText(nama).closest('div');
  if (!row) throw new Error(`baris ${nama} tidak ditemukan`);
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

/* Fixture jendela 30 hari terhadap now 2026-06-15:
 * b0  2000-06-15 daysUntil 0 (hari ini, jadi 26)
 * b1  1990-06-16 daysUntil 1 (besok, jadi 36)
 * b21 1995-07-06 daysUntil 21 (jadi 31)
 * b30 1970-07-15 daysUntil 30 (masuk jendela, jadi 56)
 * b31 1960-07-17 daysUntil 31 (GUGUR)
 * d1 deceased 1980-06-20 (gugur filter living)
 * x1 birthDate rusak (diabaikan modul) */
const FIXTURE: FamilyMember[] = [
  member({ id: 'b21', name: 'Candra Dua Puluh Satu', birthDate: '1995-07-06' }),
  member({ id: 'b0', name: 'Budi Nol', birthDate: '2000-06-15' }),
  member({ id: 'b30', name: 'Sinta Tiga Puluh', birthDate: '1970-07-15', gender: 'female' }),
  member({ id: 'b1', name: 'Andi Satu', birthDate: '1990-06-16' }),
  member({ id: 'b31', name: 'Dedi Luar Jendela', birthDate: '1960-07-17' }),
  member({
    id: 'd1',
    name: 'Almarhum Juni',
    birthDate: '1980-06-20',
    deathDate: '2024-06-20',
    isAlive: false,
  }),
  member({ id: 'x1', name: 'Tanpa Tanggal', birthDate: 'bukan-tanggal' }),
];

describe('StatsSidebar Upcoming Birthdays wiring v276-ii', () => {
  it('merender section setelah Kelompok Umur PBB dan sebelum Age Distribution', () => {
    renderSidebar(FIXTURE);
    const judul = screen.getByText('Ulang Tahun Terdekat');
    const ageGroups = screen.getByText('Kelompok Umur PBB');
    const ageDist = screen.getByText('Age Distribution');
    const setelahGroups =
      ageGroups.compareDocumentPosition(judul) & Node.DOCUMENT_POSITION_FOLLOWING;
    const sebelumDist =
      judul.compareDocumentPosition(ageDist) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(setelahGroups).toBeTruthy();
    expect(sebelumDist).toBeTruthy();
  });

  it('urutan naik daysUntil: b0, b1, b21, b30; b31 dan deceased dan rusak gugur', () => {
    renderSidebar(FIXTURE);
    for (const nama of ['Budi Nol', 'Andi Satu', 'Candra Dua Puluh Satu', 'Sinta Tiga Puluh']) {
      expect(screen.getByText(nama)).toBeTruthy();
    }
    expect(screen.queryByText('Dedi Luar Jendela')).toBeNull();
    expect(screen.queryByText('Almarhum Juni')).toBeNull();
    expect(screen.queryByText('Tanpa Tanggal')).toBeNull();
    const semua = ['Budi Nol', 'Andi Satu', 'Candra Dua Puluh Satu', 'Sinta Tiga Puluh'].map(
      (nama) => rowValue(nama),
    );
    const angka = semua.map((t) => {
      const m = /([0-9]+) hari lagi/.exec(t);
      return m ? Number(m[1]) : /Hari ini/.test(t) ? 0 : /Besok/.test(t) ? 1 : NaN;
    });
    expect(angka).toEqual([0, 1, 21, 30]);
  });

  it('boundary hari ini: label Hari ini dan ulang tahun ke-26', () => {
    renderSidebar([member({ id: 'b0', name: 'Budi Nol', birthDate: '2000-06-15' })]);
    const baris = rowValue('Budi Nol');
    expect(baris).toContain('Hari ini');
    expect(baris).toContain('Ulang tahun ke-26');
  });

  it('boundary 30 hari masuk jendela dan label 30 hari lagi', () => {
    renderSidebar([member({ id: 'b30', name: 'Sinta Tiga Puluh', birthDate: '1970-07-15' })]);
    expect(rowValue('Sinta Tiga Puluh')).toContain('30 hari lagi');
  });

  it('boundary 31 hari gugur sehingga section kosong tak dirender', () => {
    renderSidebar([member({ id: 'b31', name: 'Dedi Luar Jendela', birthDate: '1960-07-17' })]);
    expect(screen.queryByText('Ulang Tahun Terdekat')).toBeNull();
  });

  it('29 Feb diperingati 1 Mar pada tahun non-kabisat', () => {
    vi.setSystemTime(new Date('2027-02-25T10:00:00Z'));
    renderSidebar([member({ id: 'k29', name: 'Kabisat Dua Sembilan', birthDate: '2000-02-29' })]);
    const baris = rowValue('Kabisat Dua Sembilan');
    expect(baris).toContain('1 Mar');
    expect(baris).toContain('4 hari lagi');
  });

  it('label besok dan format tanggal lokal id', () => {
    renderSidebar([member({ id: 'b1', name: 'Andi Satu', birthDate: '1990-06-16' })]);
    const baris = rowValue('Andi Satu');
    expect(baris).toContain('Besok');
    expect(baris).toContain('16 Jun');
    expect(baris).not.toContain('1990-06-16');
  });

  it('label en via changeLanguage: Today dan days away plural', async () => {
    await testI18n.changeLanguage('en');
    renderSidebar(FIXTURE);
    expect(screen.getByText('Upcoming Birthdays')).toBeTruthy();
    expect(rowValue('Budi Nol')).toContain('Today');
    expect(rowValue('Andi Satu')).toContain('Tomorrow');
    expect(rowValue('Candra Dua Puluh Satu')).toContain('21 days away');
    expect(rowValue('Sinta Tiga Puluh')).toContain('30 days away');
    expect(rowValue('Budi Nol')).toContain('Turning 26');
  });

  it('deceased tidak pernah masuk daftar meski ultahnya dekat', () => {
    renderSidebar([
      member({
        id: 'd2',
        name: 'Almarhum Dekat',
        birthDate: '1980-06-20',
        deathDate: '2024-06-20',
        isAlive: false,
      }),
    ]);
    expect(screen.queryByText('Ulang Tahun Terdekat')).toBeNull();
  });

  it('birthDate rusak diabaikan tanpa error dan section kosong tak dirender', () => {
    renderSidebar([member({ id: 'x1', name: 'Tanpa Tanggal', birthDate: 'bukan-tanggal' })]);
    expect(screen.queryByText('Ulang Tahun Terdekat')).toBeNull();
  });

  it('anti-regresi: section Kelompok Umur PBB tetap dirender dengan fixture penuh', () => {
    renderSidebar(FIXTURE);
    expect(screen.getByText('Kelompok Umur PBB')).toBeTruthy();
  });

  it('count numerik dirender sebagai angka, bukan placeholder i18n', () => {
    renderSidebar([member({ id: 'b21', name: 'Candra Dua Puluh Satu', birthDate: '1995-07-06' })]);
    const baris = rowValue('Candra Dua Puluh Satu');
    expect(baris).toContain('21 hari lagi');
    expect(baris).not.toContain('{{count}}');
  });
});
