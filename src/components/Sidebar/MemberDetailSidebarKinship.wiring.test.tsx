/**
 * @vitest-environment jsdom
 *
 * Test wiring v178-i: keterikatan kontrak catatan alias regional ke konsumen
 * frasa kinship di sidebar detail anggota. Semua asersi fungsional tanpa
 * asersi layout agar tahan refactor. Pola mock persis MemberDetailSidebar.wiring.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  buildKinshipGraph,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import { listRelationships } from '../../lib/genealogy/kinship-calc';
import { kinshipPhrase } from '../../lib/genealogy/kinship-phrase';
import {
  aliasDisplay,
  aliasNoteForPhrase,
} from '../../lib/genealogy/kinship-alias-note';
import { MemberDetailSidebarKinship } from './MemberDetailSidebarKinship';
import type { FamilyMember } from '../../types/family';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  graph: null as KinshipGraph | null,
  hookMember: null as FamilyMember | null,
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

function member(id: string): FamilyMember {
  return { id } as unknown as FamilyMember;
}

const PARENT_LINK: ChildLink[] = [
  { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
  { childId: 'anak', parentId: 'nenek', type: 'BIRTH' },
  { childId: 'ortu', parentId: 'nenek', type: 'BIRTH' },
];

beforeEach(() => {
  mocks.language = 'id';
  mocks.graph = null;
  mocks.hookMember = null;
});

afterEach(cleanup);

describe('MemberDetailSidebarKinship wiring alias note (v178-i)', () => {
  it('kasus 1: member terpilih merender ul member-kinship, teks li persis kinshipPhrase id', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu', 'nenek'], [], PARENT_LINK);
    mocks.hookMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    const ul = screen.getByLabelText('member-kinship');
    const lis = ul.querySelectorAll('li');
    expect(lis.length).toBeGreaterThan(0);
    expect(ul.textContent).toContain('ayah atau ibu');
  });

  it('kasus 2: MAX_ITEMS 8 terhormat, 9 relasi hanya menghasilkan 8 li', () => {
    const links: ChildLink[] = [];
    for (let i = 1; i <= 9; i++) {
      links.push({ childId: 'anak', parentId: `ortu${i}`, type: 'BIRTH' });
    }
    mocks.graph = buildKinshipGraph(
      ['anak', ...Array.from({ length: 9 }, (_, i) => `ortu${i + 1}`)],
      [],
      links,
    );
    mocks.hookMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.querySelectorAll('li').length).toBe(8);
  });

  it('kasus 3: locale en menghasilkan kosakata en persis kinship-phrase', () => {
    mocks.language = 'en';
    mocks.graph = buildKinshipGraph(['anak', 'ortu'], [], [
      { childId: 'anak', parentId: 'ortu', type: 'BIRTH' },
    ]);
    mocks.hookMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    const ul = screen.getByLabelText('member-kinship');
    expect(ul.textContent).toContain('father or mother');
  });

  it('kasus 4: guard integrasi, frasa label baku bukan alias, aliasDisplay null untuk tiap frasa DOM', () => {
    mocks.graph = buildKinshipGraph(['anak', 'ortu', 'nenek'], [], PARENT_LINK);
    mocks.hookMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    const ul = screen.getByLabelText('member-kinship');
    const frasaDom = Array.from(ul.querySelectorAll('li')).map((li) => li.textContent ?? '');
    expect(frasaDom.length).toBeGreaterThan(0);
    for (const frasa of frasaDom) {
      expect(aliasDisplay(frasa, 'id')).toBeNull();
    }
  });

  it('kasus 5: aliasDisplay aki label baku kakek nenek plus catatan istilah regional Sunda', () => {
    const hasil = aliasDisplay('aki');
    expect(hasil).not.toBeNull();
    expect(hasil?.label).toBe('kakek nenek');
    expect(hasil?.note).toContain('istilah regional');
    expect(hasil?.region).toBe('Sunda');
    expect(hasil?.register).toBeNull();
  });

  it('kasus 6: aliasDisplay eyang istilah hormat Jawa register hormat', () => {
    const hasil = aliasDisplay('eyang');
    expect(hasil).not.toBeNull();
    expect(hasil?.note).toBe('istilah hormat (Jawa) untuk kakek nenek');
    expect(hasil?.register).toBe('hormat');
    expect(hasil?.label).toBe('kakek nenek');
  });

  it('kasus 7: aliasDisplay misan memetakan ke label baku sepupu dengan note eksplisit prioritas', () => {
    const hasil = aliasDisplay('misan');
    expect(hasil).not.toBeNull();
    expect(hasil?.label).toBe('sepupu');
    expect(hasil?.note).toBe('makna 2 Jawa: turun satu pangkat');
  });

  it('kasus 8: aliasDisplay en mengembalikan label kosakata en', () => {
    const hasil = aliasDisplay('eyang', 'en');
    expect(hasil).not.toBeNull();
    expect(hasil?.label).toBe('grandparent');
  });

  it('kasus 9: aliasNoteForPhrase label baku null, alias regional memuat arah pemetaan', () => {
    expect(aliasNoteForPhrase('kakek nenek')).toBeNull();
    expect(aliasNoteForPhrase('sepupu')).toBeNull();
    const catatan = aliasNoteForPhrase('aki');
    expect(catatan).not.toBeNull();
    expect(catatan).toContain('untuk kakek nenek');
  });

  it('kasus 10: keterikatan kontrak, kinshipPhrase langsung identik teks li DOM, dasar wiring fase ii', () => {
    const graph = buildKinshipGraph(['anak', 'ortu', 'nenek'], [], PARENT_LINK);
    mocks.graph = graph;
    mocks.hookMember = member('anak');
    render(<MemberDetailSidebarKinship />);
    const ul = screen.getByLabelText('member-kinship');
    const teksDom = Array.from(ul.querySelectorAll('li')).map((li) => li.textContent ?? '');
    const relasi = listRelationships(graph, 'anak').filter((r) => r.kind !== 'unrelated');
    const frasaDiharapkan = relasi.slice(0, 8).map((rel) => kinshipPhrase(rel, 'id'));
    expect(teksDom).toEqual(frasaDiharapkan);
    for (const frasa of frasaDiharapkan) {
      const catatan = aliasNoteForPhrase(frasa);
      expect(catatan === null || typeof catatan === 'string').toBe(true);
    }
  });
});
