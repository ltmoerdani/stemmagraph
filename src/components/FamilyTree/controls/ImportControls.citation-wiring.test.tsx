/**
 * @vitest-environment jsdom
 *
 * Test wiring sitasi v155-iii-b: ImportControls memanggil rantai sitasi
 * (parse GEDCStruct + buildCitationPlanFromRecords + applyCitationPlan
 * via getCitationApi) pasca applyImportPlan. Semua modul lib di-mock
 * penuh; fokus pada wiring dan alur data antar fase, bukan isi parser.
 * Asersi fungsional saja, tanpa asersi class layout agar tahan refactor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ImportControls } from './ImportControls';

interface CitationApiStub {
  upsertSource: ReturnType<typeof vi.fn>;
  upsertCitation: ReturnType<typeof vi.fn>;
}

const mocks = vi.hoisted(() => ({
  currentFamilyTreeId: 'tree-1' as string | null,
  fetchMembers: vi.fn(async () => undefined),
  records: [] as Array<{ tag?: string }>,
  citationEntries: [] as unknown[],
  buildCitationPlanFromRecords: vi.fn(() => [] as unknown[]),
  families: [] as Array<{
    xref: string;
    husband: string | undefined;
    wife: string | undefined;
    children: string[];
  }>,
  buildImportPlan: vi.fn(() => ({
    members: [{ id: 'p1', name: 'A' }],
    relationships: [] as unknown[],
  })),
  applyImportPlan: vi.fn(),
  citationApi: null as CitationApiStub | null,
  applyCitationPlan: vi.fn(async () => ({
    createdSources: ['S1'],
    createdCitations: [{ id: 'cit-1' }],
    skippedCitations: [],
    failedSources: [],
    failedCitations: [],
  })),
  gedcomFromString: vi.fn(() => [] as Array<{ tag?: string }>),
}));

vi.mock('lucide-react', () => ({
  Upload: () => null,
  ChevronDown: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (
    selector: (s: {
      currentFamilyTreeId: string | null;
      fetchMembers: (treeId: string) => Promise<void>;
    }) => unknown,
  ) =>
    selector({
      currentFamilyTreeId: mocks.currentFamilyTreeId,
      fetchMembers: mocks.fetchMembers,
    }),
}));

vi.mock('../../../lib/adapters', () => ({
  getAdapter: () => ({
    createMember: vi.fn(async () => ({ id: 'db-x' })),
    createRelationship: vi.fn(async () => ({})),
  }),
  getCitationApi: (): CitationApiStub | null => mocks.citationApi,
}));

vi.mock('../../../lib/gedcom/importPipeline', () => ({
  extractGedcom: () => ({ text: '0 HEAD\n1 GEDC\n0 TRLR' }),
}));

vi.mock('../../../lib/gedcom/vendor/gedcstruct.js', () => ({
  GEDCStruct: { fromString: (...args: unknown[]) => mocks.gedcomFromString(...args) },
  g7ConfGEDC: {},
}));

vi.mock('../../../lib/gedcom/citationPlan', () => ({
  buildCitationPlanFromRecords: (indi: unknown[], fam: unknown[]) =>
    mocks.buildCitationPlanFromRecords(indi, fam),
}));

vi.mock('../../../lib/gedcom/citationApply', () => ({
  applyCitationPlan: (...args: unknown[]) => mocks.applyCitationPlan(...args),
}));

vi.mock('../../../lib/gedcom/importIndividuals', () => ({
  importIndividuals: () => [{ xref: 'I1', name: 'A' }],
}));

vi.mock('../../../lib/gedcom/importFamilies', () => ({
  importFamilies: () => mocks.families,
}));

vi.mock('../../../lib/gedcom/importPlan', () => ({
  buildImportPlan: (individuals: unknown[], families: unknown[]) =>
    mocks.buildImportPlan(individuals, families),
}));

vi.mock('../../../lib/gedcom/applyImportPlan', () => ({
  applyImportPlan: (...args: unknown[]) => mocks.applyImportPlan(...args),
}));

const GED_FILE = new File([new Uint8Array([1, 2, 3])], 'u.ged', {
  type: 'text/plain',
});

function stubApi(): CitationApiStub {
  return {
    upsertSource: vi.fn(async () => ({ id: 'src-x' })),
    upsertCitation: vi.fn(async () => ({ id: 'cit-x' })),
  };
}

function openPanelAndChooseFile() {
  fireEvent.click(screen.getByTestId('import-button'));
  const input = screen.getByTestId('import-file-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [GED_FILE] });
  fireEvent.change(input);
}

async function importViaInput() {
  render(<ImportControls />);
  openPanelAndChooseFile();
  await waitFor(() => {
    expect(mocks.fetchMembers).toHaveBeenCalled();
  });
}

beforeEach(() => {
  mocks.currentFamilyTreeId = 'tree-1';
  mocks.fetchMembers = vi.fn(async () => undefined);
  mocks.records = [];
  mocks.citationEntries = [];
  mocks.citationApi = null;
  mocks.gedcomFromString.mockReset();
  mocks.gedcomFromString.mockImplementation(() => []);
  mocks.buildCitationPlanFromRecords.mockReset();
  mocks.buildCitationPlanFromRecords.mockImplementation(() => []);
  mocks.buildImportPlan.mockReset();
  mocks.buildImportPlan.mockImplementation(() => ({
    members: [{ id: 'p1', name: 'A' }],
    relationships: [],
  }));
  mocks.applyImportPlan.mockReset();
  mocks.applyImportPlan.mockImplementation(async () => ({
    createdMembers: [
      { xref: '@I1@', id: 'db-1' },
      { xref: '@I2@', id: 'db-2' },
    ],
    duplicateXrefs: [],
    failedMembers: [],
    createdRelations: 0,
    skippedRelations: [],
  }));
  mocks.applyCitationPlan.mockReset();
  mocks.applyCitationPlan.mockImplementation(async () => ({
    createdSources: ['S1'],
    createdCitations: [{ id: 'cit-1' }],
    skippedCitations: [],
    failedSources: [],
    failedCitations: [],
  }));
  mocks.families = [
    { xref: 'F1', husband: 'I1', wife: 'I2', children: [] },
  ];
});

afterEach(cleanup);

describe('ImportControls wiring sitasi v155-iii-b', () => {
  it('kasus 1: getCitationApi null (mock/supabase), fase sitasi dilewati, import tetap sukses', async () => {
    mocks.citationApi = null;
    await importViaInput();
    expect(mocks.applyCitationPlan).not.toHaveBeenCalled();
    expect(screen.getByTestId('import-summary')).toBeTruthy();
    expect(screen.queryByTestId('import-citation-summary')).toBeNull();
  });

  it('kasus 2: api ada, applyCitationPlan dipanggil sekali dengan entries + resolver + io', async () => {
    mocks.citationApi = stubApi();
    mocks.gedcomFromString.mockImplementation(() => [{ tag: 'INDI' }, { tag: 'FAM' }]);
    mocks.buildCitationPlanFromRecords.mockImplementation(() => [
      { memberId: '@I1@', relationId: undefined, eventKind: 'BIRT', sourcePointer: '@S1@' },
    ]);
    await importViaInput();
    expect(mocks.applyCitationPlan).toHaveBeenCalledTimes(1);
    const [entries, resolveMember, resolveRelation, io] =
      mocks.applyCitationPlan.mock.calls[0] as [
        unknown[],
        (x: string) => string | undefined,
        (x: string) => [string, string] | undefined,
        { upsertSource: unknown; upsertCitation: unknown },
      ];
    expect(entries).toEqual([
      { memberId: '@I1@', relationId: undefined, eventKind: 'BIRT', sourcePointer: '@S1@' },
    ]);
    expect(resolveMember('@I1@')).toBe('db-1');
    expect(resolveMember('I2')).toBe('db-2');
    expect(resolveRelation('F1')).toEqual(['db-1', 'db-2']);
    expect(io.upsertSource).toBeDefined();
    expect(io.upsertCitation).toBeDefined();
  });

  it('kasus 3: resolveMember strip @ dua sisi; xref tanpa @ tetap cocok', async () => {
    mocks.citationApi = stubApi();
    await importViaInput();
    const [, resolveMember] = mocks.applyCitationPlan.mock.calls[0] as [
      unknown[],
      (x: string) => string | undefined,
    ];
    expect(resolveMember('@I1@')).toBe('db-1');
    expect(resolveMember('I2')).toBe('db-2');
  });

  it('kasus 4: resolveRelation FAM nihil/anggota nihil mengembalikan undefined tanpa lempar', async () => {
    mocks.citationApi = stubApi();
    mocks.families = [];
    await importViaInput();
    const [, , resolveRelation] = mocks.applyCitationPlan.mock.calls[0] as [
      unknown[],
      unknown,
      (x: string) => [string, string] | undefined,
    ];
    expect(resolveRelation('F1')).toBeUndefined();
    expect(resolveRelation('@F9@')).toBeUndefined();
  });

  it('kasus 5: summary sitasi merender jumlah createdCitations dari report apply', async () => {
    mocks.citationApi = stubApi();
    mocks.applyCitationPlan.mockImplementation(async () => ({
      createdSources: ['S1'],
      createdCitations: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }],
      skippedCitations: [],
      failedSources: [],
      failedCitations: [],
    }));
    await importViaInput();
    const summary = screen.getByTestId('import-citation-summary');
    expect(summary.textContent).toContain('Citations created: 3');
  });

  it('kasus 6: parse sitasi lempar, citationEntries jatuh ke [], import tetap sukses', async () => {
    mocks.citationApi = stubApi();
    mocks.gedcomFromString.mockImplementation(() => {
      throw new Error('vendor parse boom');
    });
    await importViaInput();
    expect(mocks.applyCitationPlan).toHaveBeenCalledTimes(1);
    const [entries] = mocks.applyCitationPlan.mock.calls[0] as [unknown[]];
    expect(entries).toEqual([]);
    expect(screen.getByTestId('import-summary')).toBeTruthy();
  });

  it('kasus 7: applyCitationPlan menolak, error generic tampil, fetchMembers terlewat', async () => {
    mocks.citationApi = stubApi();
    mocks.applyCitationPlan.mockImplementation(async () => {
      throw new Error('io down');
    });
    render(<ImportControls />);
    openPanelAndChooseFile();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('import.errors.generic');
    });
    expect(mocks.fetchMembers).not.toHaveBeenCalled();
    // setReport terjadi sebelum fase sitasi: summary import tetap tampil
    // (member sukses dibuat) disertai error generic untuk kegagalan sitasi.
    expect(screen.getByTestId('import-summary')).toBeTruthy();
    expect(screen.queryByTestId('import-citation-summary')).toBeNull();
  });

  it('kasus 8: tanpa tree id, seluruh rantai termasuk sitasi tidak jalan', async () => {
    mocks.currentFamilyTreeId = null;
    render(<ImportControls />);
    openPanelAndChooseFile();
    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('import.errors.noTree');
    });
    expect(mocks.applyCitationPlan).not.toHaveBeenCalled();
    expect(mocks.fetchMembers).not.toHaveBeenCalled();
  });
});
