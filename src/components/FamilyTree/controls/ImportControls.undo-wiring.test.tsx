/**
 * @vitest-environment jsdom
 *
 * Test wiring undo v377: ImportControls menampilkan tombol undo pasca
 * import sukses, mengeksekusi plan lewat executeUndoPlan dengan io
 * adapter, dan melaporkan hasilnya jujur. Semua modul lib di-mock penuh
 * (pola file test sitasi); asersi fungsional tanpa class layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ImportControls } from './ImportControls';

const mocks = vi.hoisted(() => ({
  currentFamilyTreeId: 'tree-1' as string | null,
  fetchMembers: vi.fn(async () => undefined),
  members: [] as Array<{ id: string }>,
  buildImportPlan: vi.fn((..._args: unknown[]) => ({
    members: [{ id: 'p1', name: 'A' }],
    relationships: [] as unknown[],
  })),
  applyImportPlan: vi.fn((..._args: unknown[]) => undefined as unknown),
  buildUndoPlan: vi.fn((..._args: unknown[]) => undefined as unknown),
  executeUndoPlan: vi.fn((..._args: unknown[]) => undefined as unknown),
  adapter: {
    listMembers: vi.fn(async () => [] as Array<{ id: string }>),
    createMember: vi.fn(async () => ({ id: 'db-x' })),
    createRelationship: vi.fn(async () => ({})),
    listRelationships: vi.fn(async () => [] as unknown[]),
    deleteRelationship: vi.fn(async () => undefined),
    deleteMember: vi.fn(async () => undefined),
  },
}));

vi.mock('lucide-react', () => ({
  Upload: () => null,
  ChevronDown: () => null,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts === undefined ? key : `${key}:${JSON.stringify(opts)}`,
  }),
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
  getAdapter: () => mocks.adapter,
  getCitationApi: () => null,
}));

vi.mock('../../../lib/gedcom/importPipeline', () => ({
  extractGedcom: () => ({ text: '0 HEAD\n1 GEDC\n0 TRLR' }),
}));

vi.mock('../../../lib/gedcom/vendor/gedcstruct.js', () => ({
  GEDCStruct: { fromString: () => [] },
  g7ConfGEDC: {},
}));

vi.mock('../../../lib/gedcom/citationPlan', () => ({
  buildCitationPlanFromRecords: () => [],
}));

vi.mock('../../../lib/gedcom/citationApply', () => ({
  applyCitationPlan: vi.fn(async () => ({
    createdSources: [],
    createdCitations: [],
    skippedCitations: [],
    failedSources: [],
    failedCitations: [],
  })),
}));

vi.mock('../../../lib/gedcom/importIndividuals', () => ({
  importIndividuals: () => [{ xref: 'I1', name: 'A' }],
}));

vi.mock('../../../lib/gedcom/importFamilies', () => ({
  importFamilies: () => [],
}));

vi.mock('../../../lib/gedcom/importPlan', () => ({
  buildImportPlan: (individuals: unknown[], families: unknown[]) =>
    mocks.buildImportPlan(individuals, families),
}));

vi.mock('../../../lib/gedcom/applyImportPlan', () => ({
  applyImportPlan: (...args: unknown[]) => mocks.applyImportPlan(...args),
}));

vi.mock('../../../lib/gedcom/importUndoPlan', () => ({
  buildUndoPlan: (...args: unknown[]) => mocks.buildUndoPlan(...args),
}));

vi.mock('../../../lib/gedcom/executeUndoPlan', () => ({
  executeUndoPlan: (...args: unknown[]) => mocks.executeUndoPlan(...args),
}));

const GED_FILE = new File([new Uint8Array([1, 2, 3])], 'u.ged', {
  type: 'text/plain',
});

function chooseFile() {
  const input = screen.getByTestId('import-file-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [GED_FILE], configurable: true });
  fireEvent.change(input);
}

async function importViaInput() {
  render(<ImportControls />);
  fireEvent.click(screen.getByTestId('import-button'));
  chooseFile();
  await waitFor(() => {
    expect(mocks.fetchMembers).toHaveBeenCalled();
  });
}

function okReport() {
  return {
    invalidInput: false,
    deletedMemberIds: ['db-1', 'db-2'],
    removedRelationIds: ['rel-1'],
    failedMembers: [],
    failedRelations: [],
  };
}

beforeEach(() => {
  mocks.currentFamilyTreeId = 'tree-1';
  mocks.fetchMembers = vi.fn(async () => undefined);
  mocks.members = [{ id: 'old-1' }];
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
    createdRelations: 1,
    skippedRelations: [],
  }));
  mocks.buildUndoPlan.mockReset();
  mocks.buildUndoPlan.mockImplementation(() => ({
    memberIdsToDelete: ['db-1', 'db-2'],
    relationCountToReverse: 1,
    safe: true,
    conflicts: [],
  }));
  mocks.executeUndoPlan.mockReset();
  mocks.executeUndoPlan.mockImplementation(async () => okReport());
  mocks.adapter.listMembers.mockReset();
  mocks.adapter.listMembers.mockImplementation(async () => mocks.members);
  mocks.adapter.createMember.mockReset();
  mocks.adapter.createMember.mockImplementation(async () => ({ id: 'db-x' }));
  mocks.adapter.createRelationship.mockReset();
  mocks.adapter.createRelationship.mockImplementation(async () => ({}));
  mocks.adapter.listRelationships.mockReset();
  mocks.adapter.listRelationships.mockImplementation(async () => []);
  mocks.adapter.deleteRelationship.mockReset();
  mocks.adapter.deleteRelationship.mockImplementation(async () => undefined);
  mocks.adapter.deleteMember.mockReset();
  mocks.adapter.deleteMember.mockImplementation(async () => undefined);
});

afterEach(cleanup);

describe('ImportControls wiring undo v377', () => {
  it('kasus 1: tombol undo tampil pasca import sukses dengan plan aman berkarya', async () => {
    await importViaInput();
    // Snapshot pra-import diambil sebelum applyImportPlan.
    expect(mocks.adapter.listMembers).toHaveBeenCalledWith('tree-1');
    expect(mocks.buildUndoPlan).toHaveBeenCalledWith({
      report: await mocks.applyImportPlan.mock.results[0].value,
      existingIds: ['old-1'],
    });
    expect(screen.getByTestId('import-undo-button')).toBeTruthy();
  });

  it('kasus 2: klik undo memanggil executeUndoPlan dengan plan + io adapter, ringkasan done tampil, tree di-refresh', async () => {
    await importViaInput();
    fireEvent.click(screen.getByTestId('import-undo-button'));
    await waitFor(() => {
      expect(screen.getByTestId('import-undo-summary')).toBeTruthy();
    });
    expect(mocks.executeUndoPlan).toHaveBeenCalledTimes(1);
    const [plan, treeId, io] = mocks.executeUndoPlan.mock.calls[0] as unknown as [
      { memberIdsToDelete: string[] },
      string,
      {
        listRelationships: (t: string) => Promise<unknown>;
        deleteRelationship: (id: string) => Promise<void>;
        deleteMember: (id: string) => Promise<void>;
      },
    ];
    expect(plan.memberIdsToDelete).toEqual(['db-1', 'db-2']);
    expect(treeId).toBe('tree-1');
    // io tersuntik dari adapter nyata: verifikasi delegasi per fungsi.
    await io.listRelationships('tree-9');
    await io.deleteRelationship('rel-7');
    await io.deleteMember('mem-7');
    expect(mocks.adapter.listRelationships).toHaveBeenCalledWith('tree-9');
    expect(mocks.adapter.deleteRelationship).toHaveBeenCalledWith('rel-7');
    expect(mocks.adapter.deleteMember).toHaveBeenCalledWith('mem-7');
    expect(screen.getByTestId('import-undo-summary').textContent).toContain(
      'import.undo.done:{"members":2,"relations":1}',
    );
    expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1');
    // Plan dikosongkan setelah eksekusi: tombol tidak tampil lagi.
    expect(screen.queryByTestId('import-undo-button')).toBeNull();
  });

  it('kasus 3: klik ganda diblok saat undo berjalan, tombol disabled dan executor sekali', async () => {
    let resolveUndo!: (r: ReturnType<typeof okReport>) => void;
    mocks.executeUndoPlan.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveUndo = res;
        }),
    );
    await importViaInput();
    const button = screen.getByTestId('import-undo-button');
    fireEvent.click(button);
    await waitFor(() => {
      expect(mocks.executeUndoPlan).toHaveBeenCalledTimes(1);
    });
    expect((screen.getByTestId('import-undo-button') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByTestId('import-undo-button'));
    expect(mocks.executeUndoPlan).toHaveBeenCalledTimes(1);
    resolveUndo(okReport());
    await waitFor(() => {
      expect(screen.getByTestId('import-undo-summary')).toBeTruthy();
    });
  });

  it('kasus 4: plan konflik existing-tree tanpa tombol, pesan unsafe dengan jumlah konflik', async () => {
    mocks.buildUndoPlan.mockImplementation(() => ({
      memberIdsToDelete: [],
      relationCountToReverse: 1,
      safe: false,
      conflicts: [
        { id: 'old-1', detail: 'conflict' },
        { id: 'old-2', detail: 'conflict' },
      ],
    }));
    await importViaInput();
    expect(screen.queryByTestId('import-undo-button')).toBeNull();
    const unsafe = screen.getByTestId('import-undo-unsafe');
    expect(unsafe.textContent).toContain('import.undo.unsafe:{"count":2}');
    expect(mocks.executeUndoPlan).not.toHaveBeenCalled();
  });

  it('kasus 5: import tanpa karya (plan kosong) tanpa tombol dan tanpa pesan unsafe', async () => {
    mocks.buildUndoPlan.mockImplementation(() => ({
      memberIdsToDelete: [],
      relationCountToReverse: 0,
      safe: true,
      conflicts: [],
    }));
    await importViaInput();
    expect(screen.queryByTestId('import-undo-button')).toBeNull();
    expect(screen.queryByTestId('import-undo-unsafe')).toBeNull();
    // Summary import tetap tampil.
    expect(screen.getByTestId('import-summary')).toBeTruthy();
  });

  it('kasus 6: import baru me-reset undo import sebelumnya', async () => {
    await importViaInput();
    expect(screen.getByTestId('import-undo-button')).toBeTruthy();
    // Import kedua: tanpa karya, plan baru kosong.
    mocks.buildUndoPlan.mockImplementation(() => ({
      memberIdsToDelete: [],
      relationCountToReverse: 0,
      safe: true,
      conflicts: [],
    }));
    chooseFile();
    await waitFor(() => {
      expect(mocks.applyImportPlan).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(mocks.fetchMembers).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByTestId('import-undo-button')).toBeNull();
    expect(screen.queryByTestId('import-undo-unsafe')).toBeNull();
    expect(mocks.executeUndoPlan).not.toHaveBeenCalled();
  });

  it('kasus 7: undo dengan kegagalan per entri menampilkan pesan gagal jujur', async () => {
    mocks.executeUndoPlan.mockImplementation(async () => ({
      invalidInput: false,
      deletedMemberIds: ['db-1'],
      removedRelationIds: [],
      failedMembers: [{ id: 'db-2', error: 'boom' }],
      failedRelations: [],
    }));
    await importViaInput();
    fireEvent.click(screen.getByTestId('import-undo-button'));
    await waitFor(() => {
      expect(screen.getByTestId('import-undo-summary')).toBeTruthy();
    });
    expect(screen.getByTestId('import-undo-summary').textContent).toContain(
      'import.undo.failed',
    );
  });
});
