/**
 * @vitest-environment jsdom
 *
 * GOAL v149-ii: wiring ACCEPT dedup ke buildMergeProposal di Dashboard.
 * Pola mock store mengikuti Dashboard.dedup.test.tsx (v148-ii). DedupReviewMount
 * di-mock sebagai pemicu onDecision agar kasus pairId tanpa separator '::'
 * bisa diuji langsung pada handler Dashboard. Builder dipakai versi asli
 * (dibungkus spy) supaya payload merge_person diverifikasi end to end.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { FamilyMember } from '../../../types/family';
import { Dashboard } from '../Dashboard';
import {
  MERGE_PROPOSAL_TYPE,
  buildMergeProposal,
  type MergeProposalPayload,
} from '../../../lib/genealogy/build-merge-proposal';

const { PAIR_AB, PAIR_PLAIN, mockMembers } = vi.hoisted(() => ({
  PAIR_AB: 'member-a::member-b',
  PAIR_PLAIN: 'pair-tanpa-separator',
  mockMembers: { list: [] as FamilyMember[] },
}));

vi.mock('../../../store/authStore', () => ({
  useAuthStore: (selector?: (s: unknown) => unknown) => {
    const state = {
      user: { name: 'Pengguna Uji', email: 'uji@example.com', avatar: null },
    };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/dashboardStore', () => ({
  useDashboardStore: (selector?: (s: unknown) => unknown) => {
    const state = { familyTrees: [], viewMode: 'card', setViewMode: vi.fn() };
    return selector ? selector(state) : state;
  },
}));

vi.mock('../../../store/familyStore', () => ({
  useFamilyStore: (selector: (s: unknown) => unknown) =>
    selector({ members: mockMembers.list }),
}));

vi.mock('../../../utils/routing', () => ({ navigate: vi.fn() }));

vi.mock('../../../lib/i18n', () => ({ formatDate: () => '' }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'dedupReview.open' ? 'Cek Duplikat' : key),
    i18n: { language: 'id' },
  }),
}));

vi.mock('../../FamilyTree/DedupReviewMount', () => ({
  DedupReviewMount: ({
    onDecision,
  }: {
    onDecision: (pairId: string, decision: 'ACCEPT' | 'REJECT' | 'SKIP') => void;
  }) => (
    <div>
      <button type="button" data-testid={`dedup-accept-${PAIR_AB}`} onClick={() => onDecision(PAIR_AB, 'ACCEPT')} />
      <button type="button" data-testid={`dedup-reject-${PAIR_AB}`} onClick={() => onDecision(PAIR_AB, 'REJECT')} />
      <button type="button" data-testid={`dedup-skip-${PAIR_AB}`} onClick={() => onDecision(PAIR_AB, 'SKIP')} />
      <button type="button" data-testid={`dedup-accept-${PAIR_PLAIN}`} onClick={() => onDecision(PAIR_PLAIN, 'ACCEPT')} />
    </div>
  ),
}));

vi.mock('../../../lib/genealogy/build-merge-proposal', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/genealogy/build-merge-proposal')>();
  return { ...actual, buildMergeProposal: vi.fn(actual.buildMergeProposal) };
});

const builderSpy = vi.mocked(buildMergeProposal);

// Panel dedup hanya ter-mount setelah tombol pemicu diklik (pola v148-ii).
function mountWithPanel(): void {
  render(<Dashboard />);
  fireEvent.click(screen.getByRole('button', { name: 'Cek Duplikat' }));
}

function lastLog(infoSpy: ReturnType<typeof vi.spyOn>): Record<string, unknown> {
  const raw = infoSpy.mock.calls.at(-1)?.[0];
  return JSON.parse(String(raw)) as Record<string, unknown>;
}

beforeEach(() => {
  mockMembers.list = [];
  builderSpy.mockClear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('Dashboard merge proposal wiring (v149-ii)', () => {
  it('kasus 1: ACCEPT membangun payload merge_person, survivor idA duplicate idB', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    expect(builderSpy).toHaveBeenCalledTimes(1);
    const payload = lastLog(infoSpy).payload as MergeProposalPayload;
    expect(payload.type).toBe(MERGE_PROPOSAL_TYPE);
    expect(payload.targetType).toBe('member');
    expect(payload.targetId).toBe('member-a');
    expect(payload.fields.survivorId).toBe('member-a');
    expect(payload.fields.duplicateId).toBe('member-b');
  });

  it('kasus 2: REJECT tidak memanggil builder dan tetap log lama', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-reject-${PAIR_AB}`));
    expect(builderSpy).not.toHaveBeenCalled();
    const log = lastLog(infoSpy);
    expect(log.event).toBe('dedup-decision');
    expect(log.decision).toBe('REJECT');
    expect(log.payload).toBeUndefined();
  });

  it('kasus 3: SKIP tidak memanggil builder dan tetap log lama', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-skip-${PAIR_AB}`));
    expect(builderSpy).not.toHaveBeenCalled();
    const log = lastLog(infoSpy);
    expect(log.decision).toBe('SKIP');
    expect(log.payload).toBeUndefined();
  });

  it('kasus 4: ACCEPT dengan pairId tanpa :: jatuh ke log lama tanpa throw', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    expect(() => fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_PLAIN}`))).not.toThrow();
    expect(builderSpy).not.toHaveBeenCalled();
    const log = lastLog(infoSpy);
    expect(log.pairId).toBe(PAIR_PLAIN);
    expect(log.decision).toBe('ACCEPT');
    expect(log.payload).toBeUndefined();
  });

  it('kasus 5: resourcePlan default berisi 1 birth dan 1 relationship unik', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    const payload = lastLog(infoSpy).payload as MergeProposalPayload;
    const plan = payload.fields.resourcePlan;
    expect(Object.keys(plan)).toEqual(['birth', 'relationship']);
    expect(plan.birth.constraint).toBe('KEEP_SINGLE_BIRTH');
    expect(plan.relationship.constraint).toBe('MERGE_UNIQUE_RELATIONSHIPS');
    expect(plan.birth.source).toBe('duplicate');
    expect(plan.birth.target).toBe('survivor');
    expect(plan.relationship.source).toBe('duplicate');
    expect(plan.relationship.target).toBe('survivor');
  });

  it('kasus 6: decisions terbawa ke payload sesuai keputusan reviewer', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    const payload = lastLog(infoSpy).payload as MergeProposalPayload;
    expect(payload.decisions).toHaveLength(1);
    expect(payload.decisions[0].pairId).toBe(PAIR_AB);
    expect(payload.decisions[0].decision).toBe('ACCEPT');
    // Kontrak v149-i: applyReviewerDecision hanya membawa pairId dan decision,
    // decidedAt tidak masuk payload (jejak waktu hidup di log wiring, bukan payload pure).
    expect(payload.decisions[0]).toEqual({ pairId: PAIR_AB, decision: 'ACCEPT' });
  });

  it('kasus 7: determinisme, dua panggilan sama input menghasilkan payload sama', () => {
    vi.useFakeTimers({ now: new Date('2026-09-23T01:02:03.000Z') });
    vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    const calls = vi.mocked(console.info).mock.calls;
    expect(calls).toHaveLength(2);
    const first = JSON.parse(String(calls[0][0])).payload as MergeProposalPayload;
    const second = JSON.parse(String(calls[1][0])).payload as MergeProposalPayload;
    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it('kasus 8: payload merge_person masuk console.info sebagai JSON satu baris', () => {
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    mountWithPanel();
    fireEvent.click(screen.getByTestId(`dedup-accept-${PAIR_AB}`));
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const raw = String(infoSpy.mock.calls[0][0]);
    expect(raw).not.toContain('\n');
    const log = JSON.parse(raw);
    expect(log.event).toBe('dedup-decision');
    expect(log.pairId).toBe(PAIR_AB);
    expect(log.payload.type).toBe(MERGE_PROPOSAL_TYPE);
  });
});
