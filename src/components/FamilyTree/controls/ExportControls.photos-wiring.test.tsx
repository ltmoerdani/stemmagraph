/**
 * @vitest-environment jsdom
 *
 * Test wiring v403 AC5: ExportControls mendapat aksi Export Foto ZIP.
 * Tombol memicu fetch GET /api/v1/trees/:id/export/photos dengan
 * credentials include, mode mengikuti state privacy existing (clean
 * default, full hanya setelah checkbox konfirmasi), respons 200
 * diunduh sebagai blob dengan filename dari header Content-Disposition,
 * non-200 menampilkan pesan error tanpa crash. Pola mock mengikuti
 * ExportControls.json-wiring (v402).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { ExportControls } from './ExportControls';

const mocks = vi.hoisted(() => ({
  currentFamilyTreeId: 'tree-1' as string | null,
  fetchMock: vi.fn(),
  createObjectURL: vi.fn(() => 'blob:mock-url'),
  revokeObjectURL: vi.fn(),
  anchorClick: vi.fn(),
  adapter: {
    getTree: vi.fn(async () => ({ id: 'tree-1', name: 'Keluarga Besar' })),
  },
}));

vi.mock('lucide-react', () => ({
  Download: () => null,
  FileArchive: () => null,
  FileImage: () => null,
  FileJson: () => null,
  FileText: () => null,
  Presentation: () => null,
  Printer: () => null,
  ChevronDown: () => null,
}));

vi.mock('html2canvas', () => ({
  default: vi.fn(async () => ({
    toDataURL: () => 'data:image/png;base64,aaa',
    width: 10,
    height: 10,
  })),
}));

vi.mock('jspdf', () => ({
  default: class {
    addImage() {}
    save() {}
  },
}));

vi.mock('../../../lib/poster/renderer', () => ({
  renderPosterPdf: vi.fn(async () => ({ pdfBytes: new Uint8Array(), warnings: [] })),
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
      records: unknown[];
      relationships: unknown[];
      members: unknown[];
    }) => unknown,
  ) =>
    selector({
      currentFamilyTreeId: mocks.currentFamilyTreeId,
      records: [],
      relationships: [],
      members: [],
    }),
}));

vi.mock('../../../lib/adapters', () => ({
  getAdapter: () => mocks.adapter,
}));

/** Stub Response minimal: hanya bagian yang dibaca exportAsPhotoZip. */
function stubResponse(
  status: number,
  headers: Record<string, string> = {}
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    blob: async () =>
      new Blob(['PK\u0003\u0004stub'], { type: 'application/zip' }),
  };
}

function openExportMenu() {
  fireEvent.click(screen.getByLabelText('Export family tree'));
}

/** Selects the full privacy mode then confirms the archive checkbox. */
function unlockFullArchive(container: HTMLElement) {
  const fullRadio = container.querySelector<HTMLInputElement>(
    'input[name="export-privacy-mode"][value="full"]'
  );
  expect(fullRadio).toBeTruthy();
  fireEvent.click(fullRadio!);
  const confirm = container.querySelector<HTMLInputElement>(
    'input[type="checkbox"]'
  );
  expect(confirm).toBeTruthy();
  fireEvent.click(confirm!);
}

describe('ExportControls photo ZIP wiring (v403)', () => {
  beforeEach(() => {
    mocks.currentFamilyTreeId = 'tree-1';
    mocks.fetchMock.mockReset();
    mocks.adapter.getTree.mockClear();
    mocks.createObjectURL.mockClear();
    mocks.revokeObjectURL.mockClear();
    vi.stubGlobal('fetch', mocks.fetchMock);
    Object.defineProperty(URL, 'createObjectURL', {
      value: mocks.createObjectURL,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: mocks.revokeObjectURL,
      configurable: true,
      writable: true,
    });
    mocks.anchorClick.mockClear();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      mocks.anchorClick
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('shows the Export Photo ZIP button and downloads via blob using the header filename', async () => {
    mocks.fetchMock.mockResolvedValueOnce(
      stubResponse(200, {
        'content-disposition':
          'attachment; filename="tree-20261026-photos.zip"',
      })
    );
    const { container } = render(<ExportControls />);
    openExportMenu();

    const button = screen.getByTestId('export-photos-button');
    expect(button).toBeTruthy();
    expect(button.textContent).toContain('export.photosButton');
    fireEvent.click(button);

    await waitFor(() => {
      expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url, init] = mocks.fetchMock.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/v1/trees/tree-1/export/photos');
    expect(init.credentials).toBe('include');

    await waitFor(() => {
      expect(mocks.createObjectURL).toHaveBeenCalledTimes(1);
    });
    const blob = mocks.createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toContain('application/zip');
    const anchor = mocks.anchorClick.mock
      .instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe('tree-20261026-photos.zip');
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    // Sukses menutup dropdown; error line tidak tampil.
    expect(screen.queryByTestId('export-photos-button')).toBeNull();
    expect(
      container.querySelector('[data-testid="export-photos-error"]')
    ).toBeNull();
  });

  it('sends mode=full only after the full archive checkbox is confirmed', async () => {
    mocks.fetchMock.mockResolvedValueOnce(stubResponse(200));
    const { container } = render(<ExportControls />);
    openExportMenu();
    unlockFullArchive(container);

    fireEvent.click(screen.getByTestId('export-photos-button'));

    await waitFor(() => {
      expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url] = mocks.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/trees/tree-1/export/photos?mode=full');

    await waitFor(() => {
      expect(mocks.createObjectURL).toHaveBeenCalledTimes(1);
    });
  });

  it('clean mode keeps the query string free of mode', async () => {
    mocks.fetchMock.mockResolvedValueOnce(stubResponse(200));
    render(<ExportControls />);
    openExportMenu();

    fireEvent.click(screen.getByTestId('export-photos-button'));

    await waitFor(() => {
      expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    });
    const [url] = mocks.fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/trees/tree-1/export/photos');
  });

  it('shows the error line on non-200 without crashing', async () => {
    mocks.fetchMock.mockResolvedValueOnce(stubResponse(422));
    const { container } = render(<ExportControls />);
    openExportMenu();

    fireEvent.click(screen.getByTestId('export-photos-button'));

    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="export-photos-error"]')
      ).toBeTruthy();
    });
    // Dropdown tetap terbuka supaya pesan terlihat.
    expect(screen.queryByTestId('export-photos-button')).toBeTruthy();
    expect(mocks.createObjectURL).not.toHaveBeenCalled();
  });

  it('disables the photo button while an export is in flight', async () => {
    let resolveFetch: (v: unknown) => void = () => {};
    mocks.fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );
    render(<ExportControls />);
    openExportMenu();

    fireEvent.click(screen.getByTestId('export-photos-button'));

    await waitFor(() => {
      expect(mocks.fetchMock).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(
        (screen.getByTestId('export-photos-button') as HTMLButtonElement)
          .disabled
      ).toBe(true);
    });
    resolveFetch(stubResponse(200));
    await waitFor(() => {
      expect(mocks.createObjectURL).toHaveBeenCalledTimes(1);
    });
  });
});
