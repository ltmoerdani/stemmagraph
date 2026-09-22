/**
 * @vitest-environment jsdom
 *
 * GOAL v147 fase ii: panel review dedup dua kolom.
 * Komponen pure props-driven, tak perlu mock store/API.
 * Zonasi mengikuti dedup-review-list: kuat >= 80, review 60..79,
 * di bawah 60 diabaikan.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { DedupCandidate } from '../../lib/genealogy/dedup-detect';
import { DedupReviewPanel, dedupPairId } from './DedupReviewPanel';

afterEach(cleanup);

function candidate(
  idA: string,
  idB: string,
  score: number,
  reasons: string[] = ['SAME_FIRST_NAME'],
): DedupCandidate {
  return { idA, idB, score, reasons };
}

const REVIEWER_DECISIONS = ['ACCEPT', 'REJECT', 'SKIP'] as const;

/** Paritas label tombol keputusan: tiga keputusan terpasang di dua bahasa. */
function expectDecisionButtons(pairId: string, locale: 'id' | 'en'): void {
  const labels: Record<(typeof REVIEWER_DECISIONS)[number], Record<'id' | 'en', string>> = {
    ACCEPT: { id: 'Terima', en: 'Accept' },
    REJECT: { id: 'Bukan orang sama', en: 'Not the same person' },
    SKIP: { id: 'Ragu', en: 'Unsure' },
  };
  for (const decision of REVIEWER_DECISIONS) {
    const button = screen.getByTestId('dedup-' + decision.toLowerCase() + '-' + pairId);
    expect(button.textContent).toBe(labels[decision][locale]);
  }
}

describe('DedupReviewPanel zonasi', () => {
  it('kandidat skor 85 masuk zona kuat, bukan zona review', () => {
    render(
      <DedupReviewPanel
        candidates={[candidate('P1', 'P2', 85)]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    expect(screen.getByTestId('dedup-pair-P1::P2').closest('section')).toBe(
      screen.getByLabelText('dedup-strong'),
    );
  });

  it('kandidat skor 70 masuk zona review, bukan zona kuat', () => {
    render(
      <DedupReviewPanel
        candidates={[candidate('P3', 'P4', 70)]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    expect(screen.getByTestId('dedup-pair-P3::P4').closest('section')).toBe(
      screen.getByLabelText('dedup-review-zone'),
    );
  });

  it('kandidat skor 50 diabaikan: tidak dirender di zona mana pun', () => {
    render(
      <DedupReviewPanel
        candidates={[candidate('P5', 'P6', 50)]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    expect(screen.queryByTestId('dedup-pair-P5::P6')).toBeNull();
    expect(screen.getByTestId('dedup-empty-strong').textContent).toContain(
      'tidak ada kandidat kemiripan kuat',
    );
    expect(screen.getByTestId('dedup-empty-review').textContent).toContain(
      'tidak ada kandidat yang perlu ditinjau',
    );
  });

  it('batas: skor 79 di zona review, skor 80 di zona kuat', () => {
    render(
      <DedupReviewPanel
        candidates={[candidate('A1', 'B1', 79), candidate('A2', 'B2', 80)]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    expect(screen.getByTestId('dedup-pair-A1::B1').closest('section')).toBe(
      screen.getByLabelText('dedup-review-zone'),
    );
    expect(screen.getByTestId('dedup-pair-A2::B2').closest('section')).toBe(
      screen.getByLabelText('dedup-strong'),
    );
  });
});

describe('DedupReviewPanel render dua kolom', () => {
  it('tiap pasangan render dua kolom idA dan idB plus skor', () => {
    render(
      <DedupReviewPanel
        candidates={[candidate('M1', 'M2', 90, ['SAME_FIRST_NAME', 'SAME_LAST_NAME'])]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    expect(screen.getByTestId('dedup-col-M1').textContent).toContain('M1');
    expect(screen.getByTestId('dedup-col-M2').textContent).toContain('M2');
    expect(screen.getByTestId('dedup-pair-M1::M2').textContent).toContain('skor: 90');
  });

  it('reasons kandidat dirender sebagai teks zona id', () => {
    render(
      <DedupReviewPanel
        candidates={[
          candidate('M3', 'M4', 100, [
            'SAME_FIRST_NAME',
            'SAME_LAST_NAME',
            'SAME_BIRTH_YEAR',
          ]),
        ]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    const row = screen.getByTestId('dedup-pair-M3::M4');
    expect(row.textContent).toContain('nama depan sama');
    expect(row.textContent).toContain('nama belakang sama');
    expect(row.textContent).toContain('tahun lahir sama');
  });
});

describe('DedupReviewPanel keputusan', () => {
  it.each(REVIEWER_DECISIONS)(
    'klik tombol %s memanggil onDecision(pairId, %s)',
    (decision) => {
      const onDecision = vi.fn();
      render(
        <DedupReviewPanel
          candidates={[candidate('X1', 'X2', 85)]}
          onDecision={onDecision}
          locale="id"
        />,
      );
      fireEvent.click(
        screen.getByTestId('dedup-' + decision.toLowerCase() + '-X1::X2'),
      );
      expect(onDecision).toHaveBeenCalledTimes(1);
      expect(onDecision).toHaveBeenCalledWith('X1::X2', decision);
    },
  );
});

describe('DedupReviewPanel i18n dan empty state', () => {
  it('empty state dua bahasa saat candidates kosong (id)', () => {
    render(<DedupReviewPanel candidates={[]} onDecision={vi.fn()} locale="id" />);
    expect(screen.getByTestId('dedup-empty-strong').textContent).toBe(
      'tidak ada kandidat kemiripan kuat',
    );
    expect(screen.getByTestId('dedup-empty-review').textContent).toBe(
      'tidak ada kandidat yang perlu ditinjau',
    );
  });

  it('empty state dua bahasa saat candidates kosong (en)', () => {
    render(<DedupReviewPanel candidates={[]} onDecision={vi.fn()} locale="en" />);
    expect(screen.getByTestId('dedup-empty-strong').textContent).toBe(
      'no strong similarity candidates',
    );
    expect(screen.getByTestId('dedup-empty-review').textContent).toBe(
      'no candidates need review',
    );
  });

  it('label i18n parity: heading zona dan tiga tombol keputusan id vs en', () => {
    const { unmount } = render(
      <DedupReviewPanel
        candidates={[candidate('L1', 'L2', 65)]}
        onDecision={vi.fn()}
        locale="id"
      />,
    );
    expect(screen.getByText('Kemiripan kuat')).toBeTruthy();
    expect(screen.getByText('Perlu ditinjau')).toBeTruthy();
    expectDecisionButtons(dedupPairId(candidate('L1', 'L2', 65)), 'id');
    unmount();

    render(
      <DedupReviewPanel
        candidates={[candidate('L1', 'L2', 65)]}
        onDecision={vi.fn()}
        locale="en"
      />,
    );
    expect(screen.getByText('Strong similarity')).toBeTruthy();
    expect(screen.getByText('Needs review')).toBeTruthy();
    expectDecisionButtons(dedupPairId(candidate('L1', 'L2', 65)), 'en');
  });
});
