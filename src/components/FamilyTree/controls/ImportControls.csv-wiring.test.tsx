/**
 * @vitest-environment jsdom
 *
 * Test wiring CSV v386: ImportControls menampilkan panel CSV, preview
 * hasil validasi murni, konfirmasi memanggil adapter.createMember per
 * baris valid, dan ringkasan hasil jujur (sukses vs gagal).
 * Pola mock mengikuti ImportControls.undo-wiring.test.tsx; interaksi
 * file input memakai fireEvent (tanpa dependency tambahan).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from '@testing-library/react';
import { ImportControls } from './ImportControls';
import {
  CSV_TEMPLATE_HEADER,
} from '../../../lib/importcsv/validateCsv';

const mocks = vi.hoisted(() => ({
  currentFamilyTreeId: 'tree-1' as string | null,
  fetchMembers: vi.fn(async () => undefined),
  adapter: {
    listMembers: vi.fn(async () => [] as Array<{ id: string }>),
    createMember: vi.fn(async () => ({ id: 'db-x' })),
  },
}));

vi.mock('lucide-react', () => ({
  Upload: () => null,
  ChevronDown: () => null,
  FileSpreadsheet: () => null,
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

const HEADER = CSV_TEMPLATE_HEADER.join(',');

/** Uploads a File into the hidden CSV input via fireEvent. */
function chooseCsv(file: File) {
  const input = screen.getByTestId('import-csv-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);
}

describe('ImportControls CSV wiring (v386)', () => {
  beforeEach(() => {
    mocks.currentFamilyTreeId = 'tree-1';
    mocks.adapter.createMember.mockClear();
    mocks.adapter.createMember.mockImplementation(async () => ({ id: 'db-x' }));
    mocks.fetchMembers.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the template button and choose button', () => {
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));
    expect(screen.getByTestId('import-csv-template')).toBeTruthy();
    expect(screen.getByTestId('import-csv-choose')).toBeTruthy();
  });

  it('previews valid rows after choosing a CSV file, then imports on confirm', async () => {
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));

    const csv =
      HEADER +
      '\nBudi Santoso,,,,,,,true,1,married' +
      '\nAni Santoso,,Santoso,F,1998-08-03,,Bandung,true,2,single';
    chooseCsv(new File([csv], 'keluarga.csv', { type: 'text/csv' }));

    await waitFor(() => {
      expect(screen.getByTestId('import-csv-preview')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('import-csv-confirm'));

    await waitFor(() => {
      expect(mocks.adapter.createMember).toHaveBeenCalledTimes(2);
    });
    expect(mocks.adapter.createMember).toHaveBeenNthCalledWith(
      1,
      'tree-1',
      expect.objectContaining({ name: 'Budi Santoso', gender: 'other' })
    );
    expect(mocks.adapter.createMember).toHaveBeenNthCalledWith(
      2,
      'tree-1',
      expect.objectContaining({ name: 'Ani Santoso', gender: 'female' })
    );
    expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1');
    expect(screen.getByTestId('import-csv-summary')).toBeTruthy();
  });

  it('lists invalid rows and blocks confirm when nothing is valid', async () => {
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));

    chooseCsv(new File([HEADER + '\n,,,X,,,,,,,' ], 'rusak.csv', { type: 'text/csv' }));
    await waitFor(() => {
      expect(screen.getByTestId('import-csv-preview')).toBeTruthy();
    });

    const confirmBtn = screen.getByTestId(
      'import-csv-confirm'
    ) as HTMLButtonElement;
    expect(confirmBtn.disabled).toBe(true);
    expect(mocks.adapter.createMember).not.toHaveBeenCalled();
  });

  it('reports honest summary when some creates fail', async () => {
    mocks.adapter.createMember
      .mockResolvedValueOnce({ id: 'db-1' })
      .mockRejectedValueOnce(new Error('db down'));
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));

    const csv = HEADER + '\nBudi,,,,,,,true,1,' + '\nAni,,,,,,,true,2,';
    chooseCsv(new File([csv], 'keluarga.csv', { type: 'text/csv' }));
    await waitFor(() => {
      expect(screen.getByTestId('import-csv-preview')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('import-csv-confirm'));
    await waitFor(() => {
      expect(screen.getByTestId('import-csv-summary')).toBeTruthy();
    });
    // Dua create dipanggil meski satu gagal; ringkasan tampil jujur.
    expect(mocks.adapter.createMember).toHaveBeenCalledTimes(2);
    expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1');
  });
});
