/**
 * Panel review dedup dua kolom (pola persis v140-ii KinshipPanel).
 * Komponen presentasional pure: semua data lewat props, tanpa store,
 * API, atau import sisi server. Tanpa eksekusi merge; keputusan
 * reviewer dikomunikasikan lewat callback onDecision.
 *
 * Zonasi memakai buildDedupReviewList:
 * - zona KUAT: skor >= STRONG_THRESHOLD (80)
 * - zona REVIEW: REVIEW_MIN_SCORE (60) sampai 79
 * - di bawah 60: diabaikan
 */

import React from 'react';
import type { DedupCandidate } from '../../lib/genealogy/dedup-detect';
import {
  buildDedupReviewList,
  reviewQueueSummary,
  type ReviewerDecision,
} from '../../lib/genealogy/dedup-review-list';

export type DedupReviewLocale = 'id' | 'en';

interface DedupReviewPanelProps {
  candidates: DedupCandidate[];
  onDecision: (pairId: string, decision: ReviewerDecision) => void;
  locale: DedupReviewLocale;
}

/** Identitas pasangan deterministik: idA < idB leksikal (output detektor). */
function dedupPairId(candidate: DedupCandidate): string {
  return candidate.idA + '::' + candidate.idB;
}

const DECISION_LABELS: Record<ReviewerDecision, Record<DedupReviewLocale, string>> = {
  ACCEPT: { id: 'Terima', en: 'Accept' },
  REJECT: { id: 'Bukan orang sama', en: 'Not the same person' },
  SKIP: { id: 'Ragu', en: 'Unsure' },
};

const REASON_LABELS: Record<string, Record<DedupReviewLocale, string>> = {
  SAME_FIRST_NAME: { id: 'nama depan sama', en: 'same first name' },
  SAME_LAST_NAME: { id: 'nama belakang sama', en: 'same last name' },
  SAME_BIRTH_YEAR: { id: 'tahun lahir sama', en: 'same birth year' },
};

const SECTION_LABELS = {
  strong: { id: 'Kemiripan kuat', en: 'Strong similarity' },
  review: { id: 'Perlu ditinjau', en: 'Needs review' },
} as const;

const EMPTY_LABELS = {
  strong: {
    id: 'tidak ada kandidat kemiripan kuat',
    en: 'no strong similarity candidates',
  },
  review: {
    id: 'tidak ada kandidat yang perlu ditinjau',
    en: 'no candidates need review',
  },
} as const;

const SUMMARY_LABELS = {
  strong: { id: 'kuat', en: 'strong' },
  review: { id: 'tinjau', en: 'review' },
} as const;

function reasonLabel(reason: string, locale: DedupReviewLocale): string {
  const entry = REASON_LABELS[reason];
  return entry ? entry[locale] : reason;
}

interface CandidateColumnsProps {
  candidate: DedupCandidate;
  locale: DedupReviewLocale;
}

/** Dua kolom perbandingan satu pasangan: kiri idA, kanan idB. */
const CandidateColumns: React.FC<CandidateColumnsProps> = ({ candidate, locale }) => (
  <div className="dedup-candidate-columns">
    <div className="dedup-column" data-testid={`dedup-col-${candidate.idA}`}>
      <span className="dedup-name">{candidate.idA}</span>
    </div>
    <div className="dedup-column" data-testid={`dedup-col-${candidate.idB}`}>
      <span className="dedup-name">{candidate.idB}</span>
    </div>
    <div className="dedup-meta">
      <span className="dedup-score">
        {locale === 'en' ? 'score' : 'skor'}: {candidate.score}
      </span>
      <ul className="dedup-reasons">
        {candidate.reasons.map((reason) => (
          <li key={reason} className="dedup-reason">
            {reasonLabel(reason, locale)}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

interface CandidateRowProps {
  candidate: DedupCandidate;
  locale: DedupReviewLocale;
  onDecision: (pairId: string, decision: ReviewerDecision) => void;
}

/** Satu baris kandidat: dua kolom + tiga tombol keputusan. */
const CandidateRow: React.FC<CandidateRowProps> = ({ candidate, locale, onDecision }) => {
  const pairId = dedupPairId(candidate);
  const decisions: ReviewerDecision[] = ['ACCEPT', 'REJECT', 'SKIP'];

  return (
    <li className="dedup-candidate" data-testid={`dedup-pair-${pairId}`}>
      <CandidateColumns candidate={candidate} locale={locale} />
      <div className="dedup-actions">
        {decisions.map((decision) => (
          <button
            key={decision}
            type="button"
            data-testid={`dedup-${decision.toLowerCase()}-${pairId}`}
            onClick={() => onDecision(pairId, decision)}
          >
            {DECISION_LABELS[decision][locale]}
          </button>
        ))}
      </div>
    </li>
  );
};

/**
 * Panel review dedup: dua section (kuat, tinjau), tiap kandidat
 * dua kolom perbandingan plus tiga keputusan per pasangan.
 */
export const DedupReviewPanel: React.FC<DedupReviewPanelProps> = ({
  candidates,
  onDecision,
  locale,
}) => {
  const list = buildDedupReviewList(candidates);
  const summary = reviewQueueSummary(list);

  return (
    <section aria-label="dedup-review" className="dedup-review-panel">
      <p className="dedup-summary" data-testid="dedup-summary">
        {summary.strongCount} {SUMMARY_LABELS.strong[locale]}, {summary.reviewCount}{' '}
        {SUMMARY_LABELS.review[locale]}
      </p>

      <section aria-label="dedup-strong">
        <h3>{SECTION_LABELS.strong[locale]}</h3>
        {list.strong.length === 0 ? (
          <p className="dedup-empty" data-testid="dedup-empty-strong">
            {EMPTY_LABELS.strong[locale]}
          </p>
        ) : (
          <ul className="dedup-list">
            {list.strong.map((candidate) => (
              <CandidateRow
                key={dedupPairId(candidate)}
                candidate={candidate}
                locale={locale}
                onDecision={onDecision}
              />
            ))}
          </ul>
        )}
      </section>

      <section aria-label="dedup-review-zone">
        <h3>{SECTION_LABELS.review[locale]}</h3>
        {list.review.length === 0 ? (
          <p className="dedup-empty" data-testid="dedup-empty-review">
            {EMPTY_LABELS.review[locale]}
          </p>
        ) : (
          <ul className="dedup-list">
            {list.review.map((candidate) => (
              <CandidateRow
                key={dedupPairId(candidate)}
                candidate={candidate}
                locale={locale}
                onDecision={onDecision}
              />
            ))}
          </ul>
        )}
      </section>
    </section>
  );
};
