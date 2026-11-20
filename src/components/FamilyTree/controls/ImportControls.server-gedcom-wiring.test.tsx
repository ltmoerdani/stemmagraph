/**
 * @vitest-environment jsdom
 *
 * Test wiring server GEDCOM v461 unit 5: ImportControls merutekan file
 * ke alur server (preview, apply, undo) saat getGedcomImportApi
 * mengembalikan adapter REST, dan ke alur lokal saat null. Pola file
 * ImportControls.undo-wiring.test.tsx: modul lib di-mock penuh via
 * vi.hoisted, plus mock global fetch untuk membuktikan alur mana yang
 * menyentuh jaringan. Asersi fungsional tanpa class layout.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ImportControls } from './ImportControls';

const mocks = vi.hoisted(() => {
  // Tiruan AdapterError: komponen memetakan error.code ke kunci i18n
  // import.gedcom.server.errors.<code> lewat instanceof check, jadi
  // class di mock modul dan di error test harus satu referensi.
  class AdapterError extends Error {
    constructor(
      message: string,
      public readonly code: string,
      public readonly statusCode?: number,
    ) {
      super(message);
      this.name = 'AdapterError';
    }
  }
  return {
    AdapterError,
    currentFamilyTreeId: 'tree-1' as string | null,
    fetchMembers: vi.fn(async () => undefined),
    fetch: vi.fn(async () => {
      throw new Error('fetch global harus tidak dipanggil di test ini');
    }),
    restApi: {
      gedcomPreview: vi.fn(async (..._args: unknown[]) => undefined as unknown),
      gedcomApply: vi.fn(async (..._args: unknown[]) => undefined as unknown),
      gedcomUndo: vi.fn(async (..._args: unknown[]) => undefined as unknown),
    },
    gedcomApi: null as null | Record<string, (...args: unknown[]) => Promise<unknown>>,
    adapter: {
      listMembers: vi.fn(async () => [] as Array<{ id: string }>),
      createMember: vi.fn(async () => ({ id: 'db-x' })),
      createRelationship: vi.fn(async () => ({})),
      listRelationships: vi.fn(async () => [] as unknown[]),
      deleteRelationship: vi.fn(async () => undefined),
      deleteMember: vi.fn(async () => undefined),
    },
    buildImportPlan: vi.fn((..._args: unknown[]) => ({
      members: [{ id: 'p1', name: 'A' }],
      relationships: [] as unknown[],
    })),
    applyImportPlan: vi.fn(async (..._args: unknown[]) => ({
      createdMembers: [
        { xref: '@I1@', id: 'db-1' },
        { xref: '@I2@', id: 'db-2' },
      ],
      duplicateXrefs: [],
      failedMembers: [],
      createdRelations: 1,
      skippedRelations: [],
    })),
    buildUndoPlan: vi.fn((..._args: unknown[]) => ({
      memberIdsToDelete: ['db-1', 'db-2'],
      relationCountToReverse: 1,
      safe: true,
      conflicts: [],
    })),
    executeUndoPlan: vi.fn(async (..._args: unknown[]) => ({
      invalidInput: false,
      deletedMemberIds: ['db-1', 'db-2'],
      removedRelationIds: ['rel-1'],
      failedMembers: [],
      failedRelations: [],
    })),
  };
});

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
  getGedcomImportApi: () => mocks.gedcomApi,
  AdapterError: mocks.AdapterError,
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

function okPreview() {
  return {
    summary: { total: 3, new: 2, matchCandidate: 1, skipped: 0, livingAffected: 1 },
    plan: [{ action: 'create', xref: '@I1@', name: 'A' }],
    planTotal: 1,
    planTruncated: false,
    parseWarningCount: 0,
    gateRejects: [],
  };
}

function okApply() {
  return {
    applied: {
      createdMembers: [
        { xref: '@I1@', id: 'db-1' },
        { xref: '@I2@', id: 'db-2' },
      ],
      createdRelations: 1,
      skippedRelations: [],
      failedMembers: [],
    },
    undo: { token: 'token-1', expiresAt: '2026-11-20T10:00:00Z' },
  };
}

function okUndo() {
  return { restored: 3 };
}

async function serverImportUntilUndoOffered() {
  render(<ImportControls />);
  fireEvent.click(screen.getByTestId('import-button'));
  chooseFile();
  await waitFor(() => {
    expect(mocks.restApi.gedcomPreview).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(screen.getByTestId('import-server-preview')).toBeTruthy();
  });
  fireEvent.click(screen.getByTestId('import-server-apply'));
  await waitFor(() => {
    expect(mocks.restApi.gedcomApply).toHaveBeenCalledTimes(1);
  });
  await waitFor(() => {
    expect(screen.getByTestId('import-server-apply-result')).toBeTruthy();
  });
}

beforeEach(() => {
  mocks.currentFamilyTreeId = 'tree-1';
  mocks.fetchMembers = vi.fn(async () => undefined);
  mocks.gedcomApi = mocks.restApi as unknown as Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  mocks.restApi.gedcomPreview.mockReset();
  mocks.restApi.gedcomPreview.mockImplementation(async () => okPreview());
  mocks.restApi.gedcomApply.mockReset();
  mocks.restApi.gedcomApply.mockImplementation(async () => okApply());
  mocks.restApi.gedcomUndo.mockReset();
  mocks.restApi.gedcomUndo.mockImplementation(async () => okUndo());
  mocks.adapter.listMembers.mockReset();
  mocks.adapter.listMembers.mockImplementation(async () => [{ id: 'old-1' }]);
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
  mocks.executeUndoPlan.mockImplementation(async () => ({
    invalidInput: false,
    deletedMemberIds: ['db-1', 'db-2'],
    removedRelationIds: ['rel-1'],
    failedMembers: [],
    failedRelations: [],
  }));
  vi.stubGlobal('fetch', mocks.fetch);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ImportControls wiring server gedcom v461', () => {
  it('kasus a: rest path memanggil gedcomPreview lalu gedcomApply lalu menawarkan undo dengan token', async () => {
    await serverImportUntilUndoOffered();
    // Preview: tree id, bytes isi file, dan nama file diteruskan utuh.
    const previewArgs = mocks.restApi.gedcomPreview.mock.calls[0] as unknown as [
      string,
      Uint8Array,
      string,
    ];
    expect(previewArgs[0]).toBe('tree-1');
    expect(previewArgs[1]).toHaveLength(3);
    expect(previewArgs[2]).toBe('u.ged');
    // Apply: klik tombol apply di panel preview meneruskan argumen sama.
    const applyArgs = mocks.restApi.gedcomApply.mock.calls[0] as unknown as [
      string,
      Uint8Array,
      string,
    ];
    expect(applyArgs[0]).toBe('tree-1');
    expect(applyArgs[2]).toBe('u.ged');
    // Undo ditawarkan di panel hasil apply; klik meneruskan token apply.
    fireEvent.click(screen.getByTestId('import-server-undo'));
    await waitFor(() => {
      expect(mocks.restApi.gedcomUndo).toHaveBeenCalledTimes(1);
    });
    expect(mocks.restApi.gedcomUndo.mock.calls[0]).toEqual(['tree-1', 'token-1']);
    await waitFor(() => {
      expect(screen.getByTestId('import-server-undo-result')).toBeTruthy();
    });
    // Hasil apply dikosongkan setelah undo sukses.
    expect(screen.queryByTestId('import-server-apply-result')).toBeNull();
    // Alur rest ini berjalan tanpa satu pun fetch global: semua akses
    // server lewat adapter yang di-mock.
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('kasus b: null path tidak memanggil fetch sama sekali, alur lokal lama jalan', async () => {
    // Adapter tanpa server: getGedcomImportApi memberi null sehingga
    // file dirutekan ke importFile alur lokal lama.
    mocks.gedcomApi = null;
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));
    chooseFile();
    await waitFor(() => {
      expect(mocks.applyImportPlan).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1');
    });
    // Server path tidak disentuh, jaringan global juga tidak.
    expect(mocks.restApi.gedcomPreview).not.toHaveBeenCalled();
    expect(mocks.restApi.gedcomApply).not.toHaveBeenCalled();
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it('kasus d: progress server menampilkan elemen status aria-live polite', async () => {
    // Status (aria-live) dirender bersama isi section server; setelah
    // preview selesai, statusKey previewDone tampil di elemen aria-live.
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));
    chooseFile();
    await waitFor(() => {
      expect(screen.getByTestId('import-server-preview')).toBeTruthy();
    });
    const status = screen.getByTestId('import-server-status');
    expect(status.getAttribute('aria-live')).toBe('polite');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent).toBe('import.gedcom.server.previewDone');
    // Status yang sama terpakai saat apply berjalan (progress).
    let resolveApply!: (v: unknown) => void;
    mocks.restApi.gedcomApply.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveApply = res;
        }),
    );
    fireEvent.click(screen.getByTestId('import-server-apply'));
    await waitFor(() => {
      expect((screen.getByTestId('import-server-apply') as HTMLButtonElement).disabled).toBe(true);
    });
    resolveApply(okApply());
    await waitFor(() => {
      expect(screen.getByTestId('import-server-apply-result')).toBeTruthy();
    });
  });

  it('kasus c: undo 410 UNDO_EXPIRED menampilkan pesan i18n spesifik', async () => {
    await serverImportUntilUndoOffered();
    mocks.restApi.gedcomUndo.mockImplementationOnce(async () => {
      throw new mocks.AdapterError('undo window passed', 'UNDO_EXPIRED', 410);
    });
    fireEvent.click(screen.getByTestId('import-server-undo'));
    await waitFor(() => {
      expect(screen.getByTestId('import-server-error')).toBeTruthy();
    });
    const err = screen.getByTestId('import-server-error');
    // Komponen memetakan code AdapterError langsung ke kunci locale.
    expect(err.textContent).toBe('import.gedcom.server.errors.UNDO_EXPIRED');
    expect(err.getAttribute('role')).toBe('alert');
    // Panel hasil apply tetap tampil: undo gagal, token masih layak
    // dipertahankan di UI untuk percobaan berikutnya.
    expect(screen.getByTestId('import-server-apply-result')).toBeTruthy();
  });
});
