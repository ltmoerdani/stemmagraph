/**
 * @vitest-environment jsdom
 *
 * GOAL v148-i: mount DedupReviewPanel ke store keluarga.
 * useFamilyStore di-mock via vi.mock dengan state fixture sehingga
 * komponen diuji sebagai pure bridge store ke panel. Pola render
 * mengikuti DedupReviewPanel.test.tsx (fixture kandidat deterministik)
 * dan react-i18next di-mock minimal untuk memilih locale id/en.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import { DedupReviewMount } from '../DedupReviewMount';

const { mockState, setLanguage, decisionsSpy } = vi.hoisted(() => ({
  mockState: { members: [] as FamilyMember[] },
  setLanguage: vi.fn(),
  decisionsSpy: vi.fn(),
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector: (s: { members: FamilyMember[] }) => unknown) =>
    selector(mockState),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { get language() { return setLanguage(); } },
  }),
}));

function member(partial: Partial<FamilyMember> & { id: string; name: string }): FamilyMember {
  return {
    birthDate: '',
    gender: 'male',
    ...partial,
  } as FamilyMember;
}

beforeEach(() => {
  mockState.members = [];
  setLanguage.mockReturnValue('id');
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const A = 'member-a';
const B = 'member-b';
const C = 'member-c';

function seedStrongAndReview(): void {
  // a+b: nama depan + belakang + tahun lahir sama => 100 (zona kuat)
  // b+c: nama depan sama + tahun lahir sama => 65 (zona review)
  mockState.members = [
    member({ id: A, name: 'Budi Santoso', birthDate: '1970-01-01' }),
    member({ id: B, name: 'Budi Santoso', birthDate: '1970-06-15' }),
    member({ id: C, name: 'Budi Wijaya', birthDate: '1970-03-03' }),
  ];
}

describe('DedupReviewMount', () => {
  it('kasus 1: menghitung kandidat dari members store dan merender panel dua zona', () => {
    seedStrongAndReview();
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    expect(screen.getByTestId('dedup-summary').textContent).toBe('1 kuat, 2 tinjau');
    expect(screen.getByTestId(`dedup-pair-${A}::${B}`)).toBeTruthy();
    expect(screen.getByTestId(`dedup-pair-${B}::${C}`)).toBeTruthy();
    expect(screen.getByTestId(`dedup-pair-${A}::${C}`)).toBeTruthy();
  });

  it('kasus 2: kandidat di bawah 60 tidak muncul (threshold REVIEW_MIN_SCORE)', () => {
    mockState.members = [
      member({ id: A, name: 'Budi Santoso', birthDate: '1970-01-01' }),
      member({ id: C, name: 'Andi Wijaya', birthDate: '1985-03-03' }),
    ];
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    expect(screen.getByTestId('dedup-empty-strong')).toBeTruthy();
    expect(screen.getByTestId('dedup-empty-review')).toBeTruthy();
    expect(screen.queryByTestId(`dedup-pair-${A}::${C}`)).toBeNull();
  });

  it('kasus 3: store kosong menghasilkan dua empty state tanpa error', () => {
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    expect(screen.getByTestId('dedup-empty-strong')).toBeTruthy();
    expect(screen.getByTestId('dedup-empty-review')).toBeTruthy();
  });

  it('kasus 4: onDecision diteruskan ke panel (klik tombol Terima)', async () => {
    const { fireEvent } = await import('@testing-library/react');
    mockState.members = [
      member({ id: A, name: 'Budi Santoso', birthDate: '1970-01-01' }),
      member({ id: B, name: 'Budi Santoso', birthDate: '1970-06-15' }),
    ];
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    fireEvent.click(screen.getByTestId(`dedup-accept-${A}::${B}`));
    expect(decisionsSpy).toHaveBeenCalledTimes(1);
    expect(decisionsSpy).toHaveBeenCalledWith(`${A}::${B}`, 'ACCEPT');
  });

  it('kasus 5: tiga tombol keputusan tersedia per pasangan', () => {
    mockState.members = [
      member({ id: A, name: 'Budi Santoso', birthDate: '1970-01-01' }),
      member({ id: B, name: 'Budi Santoso', birthDate: '1970-06-15' }),
    ];
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    for (const d of ['accept', 'reject', 'skip']) {
      expect(screen.getByTestId(`dedup-${d}-${A}::${B}`)).toBeTruthy();
    }
  });

  it('kasus 6: locale en merender label bahasa Inggris', () => {
    setLanguage.mockReturnValue('en-US');
    seedStrongAndReview();
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    expect(screen.getByTestId('dedup-summary').textContent).toBe('1 strong, 2 review');
    expect(screen.getByText('Strong similarity')).toBeTruthy();
  });

  it('kasus 7: pemetaan nama dua kata memakai pola toDedupPerson (nama belakang gabungan)', () => {
    // Dira + Budi: hanya nama depan sama + tahun lahir beda => 45, di bawah 60.
    // Dira Santoso + Budi Santoso: nama depan beda + belakang sama => 35.
    // Pasangan Dira 1970 / Dira 1970 dengan nama belakang sama = 100.
    mockState.members = [
      member({ id: A, name: 'Dira Kusuma', birthDate: '1970-01-01' }),
      member({ id: B, name: 'Dira Kusuma', birthDate: '1970-07-07' }),
      member({ id: C, name: 'Budi Santoso', birthDate: '1980-01-01' }),
    ];
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    expect(screen.getByTestId(`dedup-pair-${A}::${B}`)).toBeTruthy();
    expect(screen.getByTestId('dedup-summary').textContent).toBe('1 kuat, 0 tinjau');
  });

  it('kasus 8: anggota tanpa nama tidak dipasangkan (hasAnyName)', () => {
    mockState.members = [
      member({ id: A, name: '   ', birthDate: '1970-01-01' }),
      member({ id: B, name: '   ', birthDate: '1970-01-01' }),
    ];
    render(<DedupReviewMount onDecision={decisionsSpy} />);
    expect(screen.getByTestId('dedup-empty-strong')).toBeTruthy();
    expect(screen.getByTestId('dedup-empty-review')).toBeTruthy();
  });
});
