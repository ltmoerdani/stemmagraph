/**
 * @vitest-environment jsdom
 *
 * GOAL v180-ii STG INLAW PANEL DISPLAY: render label in-law dan catatan
 * alias di KinshipPanel dengan prioritas tiga lapis (alias dulu, lalu
 * in-law, lalu frasa polos) persis MemberDetailSidebarKinship. Pola mock
 * graph, render, dan asersi data-testid copy-adapt
 * KinshipPanel.phrase.test.tsx. Stub frasa dan stub alias memakai mock
 * parsial importOriginal pola alias-ui.test.tsx karena graph murni tidak
 * pernah menghasilkan frasa in-law maupun alias regional.
 *
 * v257 test-only sinkronisasi: key besan mertua ipar menantu kini ada di
 * KINSHIP_ALIASES (v253-vi dst) sehingga jalur alias menang atas jalur
 * in-law pada frasa-frasa itu; kasus terkait memakai ekspektasi
 * alias-note dual-source.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import {
  buildKinshipGraph,
  makePartnerRelation,
  type ChildLink,
  type KinshipGraph,
} from '../../lib/genealogy/kinship';
import type { RelationshipResult } from '../../lib/genealogy/kinship-calc';
import type { AliasDisplay } from '../../lib/genealogy/kinship-alias-note';
import { KinshipPanel } from './KinshipPanel';

const mocks = vi.hoisted(() => ({
  language: 'id' as 'id' | 'en',
  phraseStub: null as
    | null
    | ((result: RelationshipResult, locale: 'id' | 'en') => string),
  aliasStub: null as
    | null
    | ((phrase: string, locale: 'id' | 'en') => AliasDisplay | null),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ i18n: { language: mocks.language } }),
}));

vi.mock('../../lib/genealogy/kinship-phrase', async (importOriginal) => {
  const asli = await importOriginal<
    typeof import('../../lib/genealogy/kinship-phrase')
  >();
  return {
    ...asli,
    kinshipPhrase: (result: RelationshipResult, lang: 'id' | 'en'): string =>
      mocks.phraseStub !== null
        ? mocks.phraseStub(result, lang)
        : asli.kinshipPhrase(result, lang),
  };
});

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

function link(childId: string, parentId: string): ChildLink {
  return { childId, parentId, type: 'BIRTH' };
}

/** Satu relasi partner: dari sudut anak, pasangannya. */
function partnerGraph(): KinshipGraph {
  return buildKinshipGraph(
    ['anak', 'pasangan'],
    [makePartnerRelation('anak', 'pasangan')],
    [],
  );
}

/** Satu relasi parent-child: dari sudut Ayah, anaknya. */
function childGraph(): KinshipGraph {
  return buildKinshipGraph(['Ayah', 'Anak'], [], [link('Anak', 'Ayah')]);
}

beforeEach(() => {
  mocks.language = 'id';
  mocks.phraseStub = null;
  mocks.aliasStub = null;
});

afterEach(cleanup);

describe('KinshipPanel in-law dan alias note (v180-ii)', () => {
  it('frasa besan kini key map, alias path menang dengan span catatan dual-source', () => {
    mocks.phraseStub = () => 'besan';
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    const ul = screen.getByLabelText('kinship');
    expect(ul.textContent).toContain('harta mas kawin');
    const spans = screen.getAllByTestId('kinship-alias-note');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toContain('dua orang tua karena anak kawin');
    expect(spans[0].textContent).toContain('oldid 1312530');
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('frasa mertua kini key map, alias path menang dengan span catatan dual-source', () => {
    mocks.phraseStub = () => 'mertua';
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    const ul = screen.getByLabelText('kinship');
    expect(ul.textContent).toContain('harta mas kawin');
    const spans = screen.getAllByTestId('kinship-alias-note');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toContain(
      'KBBI VI: orang tua istri atau suami',
    );
    expect(spans[0].textContent).toContain('oldid 1463005');
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('frasa ipar kini key map, alias path menang dengan span catatan dual-source', () => {
    mocks.phraseStub = () => 'ipar';
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    const ul = screen.getByLabelText('kinship');
    expect(ul.textContent).toContain('harta mas kawin');
    const spans = screen.getAllByTestId('kinship-alias-note');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toContain('i.par dua makna');
    expect(spans[0].textContent).toContain('oldid 1463006');
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('frasa alias regional aki merender span alias note tanpa span in-law', () => {
    mocks.phraseStub = () => 'aki';
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    const ul = screen.getByLabelText('kinship');
    expect(ul.textContent).toContain('kakek nenek');
    const spans = screen.getAllByTestId('kinship-alias-note');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('istilah regional untuk kakek nenek');
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('frasa baku polos anak tanpa span alias maupun in-law', () => {
    render(<KinshipPanel graph={childGraph()} fromId="Ayah" />);
    expect(screen.getByText('(anak laki-laki atau anak perempuan)')).toBeTruthy();
    expect(screen.queryAllByTestId('kinship-alias-note')).toHaveLength(0);
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('locale en: mertua kini key map, label bridewealth property plus note dual-source', () => {
    mocks.language = 'en';
    mocks.phraseStub = () => 'mertua';
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    const ul = screen.getByLabelText('kinship');
    expect(ul.textContent).toContain('bridewealth property');
    const spans = screen.getAllByTestId('kinship-alias-note');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toContain(
      'KBBI VI: orang tua istri atau suami',
    );
    expect(spans[0].textContent).toContain('oldid 1463005');
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('frasa tak dikenali tetap dirender polos via span kinship-phrase', () => {
    mocks.phraseStub = () => 'frasa asing';
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    expect(screen.getByText('(frasa asing)')).toBeTruthy();
    expect(screen.queryAllByTestId('kinship-alias-note')).toHaveLength(0);
    expect(screen.queryAllByTestId('kinship-inlaw-note')).toHaveLength(0);
  });

  it('prioritas note di atas region bila keduanya ada (keputusan v176-ii)', () => {
    mocks.phraseStub = () => 'kakek atau nenek';
    mocks.aliasStub = () => ({
      label: 'kakek nenek',
      note: 'catatan utama',
      region: 'Jawa',
      register: 'hormat',
    });
    render(<KinshipPanel graph={partnerGraph()} fromId="anak" />);
    const spans = screen.getAllByTestId('kinship-alias-note');
    expect(spans).toHaveLength(1);
    expect(spans[0].textContent).toBe('catatan utama');
    expect(spans[0].textContent).not.toContain('Jawa');
  });
});
