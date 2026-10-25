/**
 * @vitest-environment jsdom
 *
 * Test wiring XLSX v397 (AC4/AC5): file .xlsx yang dipilih via input
 * import dikenali dari magic bytes ZIP (PK), grid-nya dipreview lewat
 * pipeline v386 yang sama, konfirmasi memanggil adapter.createMember
 * per baris valid, dan file rusak mendapat pesan error jujur khusus
 * xlsx. Fixture xlsx dibangun deterministik via fflate zipSync.
 * Pola mock mengikuti ImportControls.csv-wiring.test.tsx.
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
import { buildXlsx, type FixtureCell } from '../../../lib/importxlsx/fixture';

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

const HEADER_CELLS: FixtureCell[] = [
  { ref: 'A1', value: 'name' },
  { ref: 'B1', value: 'nickname' },
  { ref: 'C1', value: 'marga' },
  { ref: 'D1', value: 'gender' },
  { ref: 'E1', value: 'birthDate' },
  { ref: 'F1', value: 'deathDate' },
  { ref: 'G1', value: 'birthPlace' },
  { ref: 'H1', value: 'isAlive' },
  { ref: 'I1', value: 'generation' },
  { ref: 'J1', value: 'test' },
];

/** Header J1 harus 'maritalStatus' agar kontrak 10 kolom terpenuhi. */
HEADER_CELLS[9].value = 'maritalStatus';

const ROW2_CELLS: FixtureCell[] = [
  { ref: 'A2', value: 'Andi Situmorang' },
  { ref: 'D2', value: 'M' },
  { ref: 'E2', kind: 'number', value: '44197' },
  { ref: 'H2', value: 'true' },
];

/** Uploads a File into the hidden import input via fireEvent. */
function chooseFile(file: File) {
  const input = screen.getByTestId('import-csv-input') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: [file] });
  fireEvent.change(input);
}

describe('ImportControls XLSX wiring (v397)', () => {
  beforeEach(() => {
    mocks.currentFamilyTreeId = 'tree-1';
    mocks.adapter.createMember.mockClear();
    mocks.adapter.createMember.mockImplementation(async () => ({ id: 'db-x' }));
    mocks.fetchMembers.mockClear();
  });

  afterEach(() => { cleanup(); });

  it('preview xlsx valid lalu impor saat konfirmasi (serial tanggal ikut)', async () => {
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));
    const bytes = buildXlsx([...HEADER_CELLS, ...ROW2_CELLS], 2, {
      includeSharedStrings: false,
    });
    const file = new File([bytes as BlobPart], 'keluarga.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    chooseFile(file);
    await waitFor(() =>
      expect(screen.getByTestId('import-csv-preview')).toBeTruthy(),
    );
    expect(
      screen.getByTestId('import-csv-preview').textContent,
    ).toContain('1');
    fireEvent.click(screen.getByTestId('import-csv-confirm'));
    await waitFor(() =>
      expect(mocks.adapter.createMember).toHaveBeenCalledTimes(1),
    );
    expect(mocks.adapter.createMember.mock.calls[0][1]).toMatchObject({
      name: 'Andi Situmorang',
      gender: 'male',
      birthDate: '2021-01-01',
      isAlive: true,
    });
    await waitFor(() => expect(mocks.fetchMembers).toHaveBeenCalledWith('tree-1'));
  });

  it('file xlsx rusak (bukan zip) mendapat pesan error xlsxUnreadable jujur', async () => {
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));
    const bogus = new Uint8Array([0x50, 0x4b, 1, 2, 3, 4]);
    const file = new File([bogus as BlobPart], 'rusak.xlsx', { type: 'application/octet-stream' });
    chooseFile(file);
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'import.csv.errors.xlsxUnreadable',
      ),
      { timeout: 5000 },
    );
  });

  it('CSV teks biasa tetap jalan lewat jalur CSV (regresi magic bytes)', async () => {
    render(<ImportControls />);
    fireEvent.click(screen.getByTestId('import-button'));
    const csv = [
      'name,nickname,marga,gender,birthDate,deathDate,birthPlace,isAlive,generation,maritalStatus',
      'Andi,,,M,1980-05-12,,,true,,single',
      '',
    ].join('\n');
    const file = new File([csv], 'keluarga.csv', { type: 'text/csv' });
    chooseFile(file);
    await waitFor(() =>
      expect(screen.getByTestId('import-csv-preview')).toBeTruthy(),
    );
    fireEvent.click(screen.getByTestId('import-csv-confirm'));
    await waitFor(() =>
      expect(mocks.adapter.createMember).toHaveBeenCalledTimes(1),
    );
    expect(mocks.adapter.createMember.mock.calls[0][1]).toMatchObject({
      name: 'Andi',
      birthDate: '1980-05-12',
    });
  });
});
