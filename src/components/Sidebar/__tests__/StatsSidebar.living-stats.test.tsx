/**
 * @vitest-environment jsdom
 *
 * v267 fase iii: wiring Living Stats ke StatsSidebar.
 * Store family di-mock (pola Dashboard.dedup.test.tsx) supaya komponen
 * memanggil computeLivingStats dari members sungguhan di store.
 * Jam sistem dipatok 2026-06-15 via vi.setSystemTime agar umur dan
 * bucket deterministik tanpa injeksi parameter now ke komponen.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import type { FamilyMember, FamilyStats } from '../../../types/family';
import { AGE_BUCKETS } from '../../../lib/stats/living-stats';
import { StatsSidebar } from '../StatsSidebar';

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

function renderSidebar(members: FamilyMember[]): void {
  mockMembers.list = members;
  mockStats.value = baseStats();
  render(<StatsSidebar />);
}

/** Nilai gabungan teks pada baris label + angka (div flex terdekat di atas label). */
function rowValue(label: string): string {
  const row = screen.getByText(label).closest('div');
  if (!row) throw new Error(`baris ${label} tidak ditemukan`);
  return row.textContent ?? '';
}

beforeEach(() => {
  vi.useFakeTimers({ now: new Date('2026-06-15T10:00:00Z'), toFake: ['Date'] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CAMPURAN: FamilyMember[] = [
  member({ id: 'm1', name: 'Bapak Satu', birthDate: '1990-04-01' }),
  member({ id: 'm2', name: 'Ibu Dua', birthDate: '2010-08-20', gender: 'female' }),
  member({
    id: 'm3',
    name: 'Buyut Tiga',
    birthDate: '1950-01-01',
    deathDate: '2020-01-01',
    isAlive: false,
  }),
  member({ id: 'm4', name: 'Tanpa Tanggal', birthDate: 'bukan-tanggal' }),
  member({ id: 'm5', name: 'Bapak Lima', birthDate: '1970-02-10' }),
];

describe('StatsSidebar Living Stats wiring v267-iii', () => {
  it('merender section Living Stats setelah Gender Distribution', () => {
    renderSidebar(CAMPURAN);
    const gender = screen.getByText('Gender Distribution');
    const living = screen.getByText('Living Stats');
    const following = gender.compareDocumentPosition(living) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(following).toBeTruthy();
  });

  it('menampilkan jumlah living dari fixture campuran', () => {
    renderSidebar(CAMPURAN);
    const card = screen.getByText('Living').parentElement;
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText('4')).toBeTruthy();
  });

  it('menampilkan jumlah deceased dari fixture campuran', () => {
    renderSidebar(CAMPURAN);
    const card = screen.getByText('Deceased').parentElement;
    expect(card).toBeTruthy();
    expect(within(card as HTMLElement).getByText('1')).toBeTruthy();
  });

  it('menampilkan N/A saat avgLifespan null (seluruh member living)', () => {
    renderSidebar([
      member({ id: 'a1', name: 'Hidup Satu', birthDate: '1990-01-01' }),
      member({ id: 'a2', name: 'Hidup Dua', birthDate: '2000-01-01' }),
    ]);
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('menampilkan avg lifespan 1 desimal dari deceased terparse dua arah', () => {
    renderSidebar([
      member({
        id: 'd1',
        name: 'Almarhum',
        birthDate: '1950-01-01',
        deathDate: '2020-01-01',
        isAlive: false,
      }),
    ]);
    expect(screen.getByText('70 years')).toBeTruthy();
  });

  it('tetap N/A saat deceased tidak punya deathDate terparse', () => {
    renderSidebar([
      member({ id: 'd2', name: 'Tanpa Meninggal', birthDate: '1950-01-01', isAlive: false }),
    ]);
    expect(screen.getByText('N/A')).toBeTruthy();
  });

  it('member tanpa birthDate masuk Unknown Birth Date dan keluar bucket', () => {
    renderSidebar(CAMPURAN);
    expect(rowValue('Unknown Birth Date')).toContain('1');
    const expected = { '0-17': '1', '18-30': '0', '31-45': '1', '46-60': '1', '61-75': '0', '76+': '0' };
    for (const bucket of AGE_BUCKETS) {
      expect(rowValue(`${bucket} years`)).toContain(expected[bucket]);
    }
  });

  it('merender enam bucket umur sesuai AGE_BUCKETS', () => {
    renderSidebar(CAMPURAN);
    for (const bucket of AGE_BUCKETS) {
      expect(screen.getByText(`${bucket} years`)).toBeTruthy();
    }
    expect(AGE_BUCKETS).toHaveLength(6);
  });

  it('boundary 17 masuk 0-17 dan 18 masuk 18-30', () => {
    renderSidebar([
      member({ id: 'b17', name: 'Umur Tujuh Belas', birthDate: '2008-06-16' }),
      member({ id: 'b18', name: 'Umur Delapan Belas', birthDate: '2008-06-15' }),
    ]);
    expect(rowValue('0-17 years')).toContain('1');
    expect(rowValue('18-30 years')).toContain('1');
  });

  it('boundary 75 masuk 61-75 dan 76 masuk 76+', () => {
    renderSidebar([
      member({ id: 'b75', name: 'Umur Tujuh Lima', birthDate: '1950-06-16' }),
      member({ id: 'b76', name: 'Umur Tujuh Enam', birthDate: '1950-06-15' }),
    ]);
    expect(rowValue('61-75 years')).toContain('1');
    expect(rowValue('76+ years')).toContain('1');
  });

  it('deceased tidak dihitung ke bucket umur living', () => {
    renderSidebar([
      member({
        id: 'd3',
        name: 'Meninggal Umur 70',
        birthDate: '1950-01-01',
        deathDate: '2020-01-01',
        isAlive: false,
      }),
    ]);
    for (const bucket of AGE_BUCKETS) {
      expect(rowValue(`${bucket} years`)).toContain('0');
    }
  });

  it('anti-regresi: Gender Distribution tetap dirender dengan hitungan', () => {
    renderSidebar(CAMPURAN);
    expect(screen.getByText('Gender Distribution')).toBeTruthy();
    const maleCard = screen.getByText('Male').parentElement;
    const femaleCard = screen.getByText('Female').parentElement;
    expect(within(maleCard as HTMLElement).getByText('4')).toBeTruthy();
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
