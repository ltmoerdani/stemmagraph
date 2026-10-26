/**
 * @vitest-environment jsdom
 *
 * Test wiring v404 AC4: dropdown tema poster di ExportControls.
 * Pilihan default/batik/songket harus mengubah argumen options.palette
 * yang dikirim ke renderPosterPdf, default tanpa sentuhan mengirim
 * palette gading S-10, dan pilihan tidak mengubah argumen paper.
 * Pola mock mengikuti ExportControls.json-wiring.test.tsx (v402).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ExportControls } from './ExportControls';
import {
  DEFAULT_POSTER_PALETTE,
  BATIK_POSTER_PALETTE,
  SONGKET_POSTER_PALETTE,
} from '../../../lib/poster/theme';
import { resolvePaper } from '../../../lib/poster/geometry';

const mocks = vi.hoisted(() => ({
  currentFamilyTreeId: 'tree-1' as string | null,
  renderPosterPdf: vi.fn(),
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
  renderPosterPdf: mocks.renderPosterPdf,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
      members: [
        { id: 'm1', name: 'A', generation: 1, parentIds: [], childrenIds: ['m2'] },
        { id: 'm2', name: 'B', generation: 2, parentIds: ['m1'], childrenIds: [] },
      ],
    }),
}));

vi.mock('../../../lib/adapters', () => ({
  getAdapter: () => mocks.adapter,
}));

/** Pilih tema pada dropdown lalu klik tombol export poster. */
function pickThemeAndExport(theme: string) {
  const select = screen.getByTestId('poster-theme-kind') as HTMLSelectElement;
  fireEvent.change(select, { target: { value: theme } });
  fireEvent.click(screen.getByTestId('poster-export-button'));
}

/** Options.palette yang terkirim ke renderPosterPdf pada panggilan pertama. */
function sentPalette(): unknown {
  const [, options] = mocks.renderPosterPdf.mock.calls[0] as [unknown, unknown];
  return (options as { palette?: unknown }).palette;
}

describe('ExportControls poster theme wiring (v404 AC4)', () => {
  beforeEach(() => {
    mocks.currentFamilyTreeId = 'tree-1';
    mocks.renderPosterPdf.mockReset();
    mocks.renderPosterPdf.mockResolvedValue({
      pdfBytes: new Uint8Array([0x25, 0x50, 0x44, 0x46]),
      warnings: [],
    });
    mocks.adapter.getTree.mockClear();
    vi.stubGlobal('fetch', vi.fn());
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(() => 'blob:mock-url'),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    cleanup();
  });

  it('renders the theme dropdown with default preselected', () => {
    render(<ExportControls />);
    fireEvent.click(screen.getByLabelText('Export family tree'));
    const select = screen.getByTestId('poster-theme-kind') as HTMLSelectElement;
    expect(select).toBeTruthy();
    expect(select.value).toBe('default');
    const options = Array.from(select.options).map((o) => o.value);
    expect(options).toEqual(['default', 'batik', 'songket']);
  });

  it('sends the default ivory palette when untouched', async () => {
    render(<ExportControls />);
    fireEvent.click(screen.getByLabelText('Export family tree'));
    fireEvent.click(screen.getByTestId('poster-export-button'));
    await waitFor(() => {
      expect(mocks.renderPosterPdf).toHaveBeenCalledTimes(1);
    });
    expect(sentPalette()).toEqual(DEFAULT_POSTER_PALETTE);
  });

  it('switching to batik changes the renderPosterPdf palette argument', async () => {
    render(<ExportControls />);
    fireEvent.click(screen.getByLabelText('Export family tree'));
    pickThemeAndExport('batik');
    await waitFor(() => {
      expect(mocks.renderPosterPdf).toHaveBeenCalledTimes(1);
    });
    expect(sentPalette()).toEqual(BATIK_POSTER_PALETTE);
    expect(sentPalette()).not.toEqual(DEFAULT_POSTER_PALETTE);
  });

  it('switching to songket changes the renderPosterPdf palette argument', async () => {
    render(<ExportControls />);
    fireEvent.click(screen.getByLabelText('Export family tree'));
    pickThemeAndExport('songket');
    await waitFor(() => {
      expect(mocks.renderPosterPdf).toHaveBeenCalledTimes(1);
    });
    expect(sentPalette()).toEqual(SONGKET_POSTER_PALETTE);
  });

  it('theme choice does not alter the resolved paper argument', async () => {
    render(<ExportControls />);
    fireEvent.click(screen.getByLabelText('Export family tree'));
    pickThemeAndExport('batik');
    await waitFor(() => {
      expect(mocks.renderPosterPdf).toHaveBeenCalledTimes(1);
    });
    const [spec] = mocks.renderPosterPdf.mock.calls[0] as [
      { paper?: unknown },
      unknown,
    ];
    expect(spec.paper).toEqual(resolvePaper('a1'));
  });
});
