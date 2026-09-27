/**
 * @vitest-environment jsdom
 *
 * Test UI alias v179-i: perilaku render MemberDetailSidebarKinship saat
 * frasa kekerabatan dikenali aliasDisplay. Kasus region-only, register-only,
 * dan prioritas note disiapkan lewat stub aliasDisplay (mock parsial dengan
 * importOriginal) karena tabel alias asli selalu mengisi note untuk entri
 * regional. Pola mock dan render persis MemberDetailSidebarKinship.wiring.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import { MemberDetailSidebarKinship } from './MemberDetailSidebarKinship';
import type { AliasDisplay } from '../../lib/genealogy/kinship-alias-note';
import type { FamilyMember } from '../../types/family';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  graph: null as KinshipGraph | null,
  hookMember: null as FamilyMember | null,
  aliasStub: null as
    | null
    | ((phrase: string, locale: 'id' | 'en') => AliasDisplay | null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mocks.language } }),
}));

vi.mock('../../hooks/useKinshipGraph', () => ({
  useKinshipGraph: () => ({ graph: mocks.graph, selectedMember: mocks.hookMember }),
}));

vi.mock('../../store/familyStore', () => ({
  useFamilyStore: () => ({ selectedMember: null, setSelectedMember: vi.fn() }),
}));

vi.mock('../../lib/genealogy/kinship-alias-note', async (importOriginal) => {
  const asli = await importOriginal<
    typeof import('../../lib/genealogy/kinship-alias-note')
  >();
  return {
    ...asli,
    aliasDisplay: (phrase: string, locale: 'id' | 'en' = 'id'): AliasDisplay | null =>
      mocks.aliasStub !== null
        ? mocks.aliasStub(phrase, locale)
        : asli.aliasDisplay(phrase, locale),
  };
});

function member(id: string): FamilyMember {
  return { id } as unknown as FamilyMember;
}

const PARENT_LINK: ChildLink[] = [
  { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
];

beforeEach(() => {
  mocks.language = 'id';
  mocks.graph = null;
  mocks.hookMember = null;
  mocks.aliasStub = null;
});

afterEach(cleanup);

function renderSidebar(id: string): void {
  mocks.hookMember = member(id);
  render(<MemberDetailSidebarKinship />);
}

describe('MemberDetailSidebarKinship alias ui (v179-i)', () => {
  it('kasus 1: frasa dikenali alias dengan note, label baku tampil plus span catatan berisi note', () => {
    mocks.graph = buildKinshipGraph(
      ['anak', 'ortu', 'nenek', 'buyut'],
      [],
      [
        { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
        { childId: 'ortu', parentId: 'nenek', type: 'BIRTH' },
        { childId: 'nenek', parentId: 'buyut', type: 'BIRTH' },
      ],
    );
    renderSidebar('anak');
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.textContent).toContain('keturunan');
    const spans = screen.getAllByTestId('member-kinship-alias-note');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe(
      'dua arah: naik 3 berarti ancestor pangkat 3, konteks wajib',
    );
  });

  it('kasus 2: alias tanpa note tapi punya region, span berisi region', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.aliasStub = () => ({
      label: 'orang tua',
      note: null,
      region: 'Sunda',
      register: null,
    });
    renderSidebar('anak');
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.textContent).toContain('orang tua');
    const spans = screen.getAllByTestId('member-kinship-alias-note');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('Sunda');
  });

  it('kasus 3: alias hanya register, span berisi register', () => {
    mocks.graph = buildKinshipGraph(['anak', 'saudara', 'ortu'], [], [
      { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
      { childId: 'saudara', parentId: 'ortu', type: 'BIRTH' },
    ]);
    mocks.aliasStub = (phrase) =>
      phrase === 'kakak atau adik'
        ? { label: 'saudara', note: null, region: null, register: 'hormat' }
        : null;
    renderSidebar('anak');
    const spans = screen.getAllByTestId('member-kinship-alias-note');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('hormat');
  });

  it('kasus 4: prioritas note di atas region bila keduanya ada', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu', 'nenek'], [], [
      { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
      { childId: 'ortu', parentId: 'nenek', type: 'BIRTH' },
    ]);
    mocks.aliasStub = (phrase) =>
      phrase === 'kakek atau nenek'
        ? { label: 'kakek nenek', note: 'catatan utama', region: 'Jawa', register: 'hormat' }
        : null;
    renderSidebar('anak');
    const spans = screen.getAllByTestId('member-kinship-alias-note');
    expect(spans.length).toBe(1);
    expect(spans[0].textContent).toBe('catatan utama');
    expect(spans[0].textContent).not.toContain('Jawa');
  });

  it('kasus 5: frasa tidak dikenali, aliasDisplay null, tanpa span tambahan teks polos', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    renderSidebar('anak');
    const ul = screen.getByLabelText('member-kinship');
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBe(1);
    expect(lis[0].textContent).toBe('ayah atau ibu');
    expect(ul.querySelector('span[data-testid="member-kinship-alias-note"]')).toBeNull();
  });

  it('kasus 6: frasa dikenali tanpa ketiga metadata, label saja tanpa span', () => {
    mocks.graph = buildKinshipGraph(['orang', 'anak', 'cucu'], [], [
      { childId: 'anak', parentId: 'orang', type: 'BIRTH' },
      { childId: 'cucu', parentId: 'anak', type: 'BIRTH' },
    ]);
    mocks.aliasStub = (phrase) =>
      phrase === 'anak laki-laki atau anak perempuan'
        ? { label: 'anak', note: null, region: null, register: null }
        : null;
    renderSidebar('orang');
    const ul = screen.getByLabelText('member-kinship');
    const lis = Array.from(ul.querySelectorAll('li'));
    const liLabel = lis.find((li) => li.textContent === 'anak');
    expect(liLabel).toBeDefined();
    expect(liLabel?.querySelector('span')).toBeNull();
    expect(screen.queryAllByTestId('member-kinship-alias-note')).toHaveLength(0);
  });

  it('kasus 7: dukungan locale id dan en pada label', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], PARENT_LINK);
    mocks.aliasStub = (phrase, locale) =>
      phrase === 'ayah atau ibu' || phrase === 'father or mother'
        ? {
            label: locale === 'en' ? 'parent' : 'orang tua',
            note: null,
            region: null,
            register: null,
          }
        : null;
    renderSidebar('anak');
    const ulId = screen.getByLabelText('member-kinship');
    expect(ulId.textContent).toContain('orang tua');
    expect(ulId.textContent).not.toContain('parent');
    cleanup();
    mocks.language = 'en';
    renderSidebar('anak');
    const ulEn = screen.getByLabelText('member-kinship');
    expect(ulEn.textContent).toContain('parent');
    expect(ulEn.textContent).not.toContain('orang tua');
  });

  it('kasus 8: relasi kind unrelated disembunyikan dari daftar', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu', 'jauh'], [], PARENT_LINK);
    renderSidebar('anak');
    const ul = screen.getByLabelText('member-kinship');
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBe(1);
    expect(ul.textContent).not.toContain('tidak ada hubungan kekerabatan');
    expect(ul.textContent).not.toContain('jauh');
  });
});
