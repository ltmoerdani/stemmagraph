/**
 * Mount DedupReviewPanel ke store keluarga (GOAL v148-i).
 * Pola persis KinshipPanelMount (v141-i): data anggota dari useFamilyStore,
 * kandidat dedup dihitung via findDuplicatePairs dalam useMemo (pure,
 * threshold REVIEW_MIN_SCORE 60 agar zona kuat dan zona review sama-sama
 * tampil). toDedupPerson meminjam pola MemberEditModal (nama dipisah
 * spasi pertama, tanggal lahir diteruskan apa adanya).
 * Keputusan reviewer dikomunikasikan ke pemakai via prop onDecision;
 * mount tidak pernah mengeksekusi merge sendiri (ADR 0009 change review).
 * Pure UI: tanpa import server/prisma/API, tanpa efek samping.
 */

import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../store/familyStore';
import type { FamilyMember } from '../../types/family';
import {
  findDuplicatePairs,
  type DedupCandidate,
  type DedupPersonInput,
} from '../../lib/genealogy/dedup-detect';
import {
  REVIEW_MIN_SCORE,
  type ReviewerDecision,
} from '../../lib/genealogy/dedup-review-list';
import { DedupReviewPanel, type DedupReviewLocale } from './DedupReviewPanel';

interface DedupReviewMountProps {
  onDecision: (pairId: string, decision: ReviewerDecision) => void;
}

function toDedupPerson(member: FamilyMember): DedupPersonInput {
  const parts = member.name.trim().split(/\s+/);
  const firstName = parts[0] ?? '';
  const lastName = parts.slice(1).join(' ');
  return {
    id: member.id,
    firstName: firstName === '' ? undefined : firstName,
    lastName: lastName === '' ? undefined : lastName,
    birthDate: member.birthDate ? member.birthDate : undefined,
    birthPlace: member.birthPlace ? member.birthPlace : undefined,
    gender: member.gender,
  };
}

export const DedupReviewMount: React.FC<DedupReviewMountProps> = ({ onDecision }) => {
  const { i18n } = useTranslation();
  const locale: DedupReviewLocale = i18n.language?.startsWith('en') ? 'en' : 'id';
  const members = useFamilyStore((s) => s.members);

  const candidates: DedupCandidate[] = useMemo(
    () => findDuplicatePairs(members.map(toDedupPerson), { threshold: REVIEW_MIN_SCORE }),
    [members],
  );

  return <DedupReviewPanel candidates={candidates} onDecision={onDecision} locale={locale} />;
};
