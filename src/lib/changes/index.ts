// Pure change-review contracts for P2-5 (two-version pending edits).
//
// This module is intentionally free of I/O: no database, no HTTP, no React.
// It defines the three proposal states and their legal transitions, the
// single owner gate, the permanent anti-re-proposal guard, the narrow
// auto-accept policy, and the snapshot validator that keeps free text down
// to reasonNote and decisionNote. The binding design record is
// docs/decisions/0009-change-review.md.

// ─── Vocabulary ──────────────────────────────────────────
//
// A proposal is one proposed edit of one live record. Three states exist
// and no fourth: pending (waiting for the owner gate), rejected (the owner
// refused it; re-proposing different content stays allowed), and distinct
// (the owner judged the subject a different person; the exact same
// afterJson on the same target is refused forever). "Accepted" is a
// transition, never a stored state: the accept flow applies the afterJson
// to the live record through the existing update path, writes the
// CHANGE_ACCEPTED event, and consumes the proposal row in one transaction.

export const CHANGE_STATES = ['pending', 'rejected', 'distinct'] as const;
export type ChangeState = (typeof CHANGE_STATES)[number];

export function isChangeState(value: unknown): value is ChangeState {
  return typeof value === 'string' && (CHANGE_STATES as readonly string[]).includes(value);
}

/** What a proposal may target: a family member or a relationship row. */
export const CHANGE_TARGET_TYPES = ['member', 'relationship'] as const;
export type ChangeTargetType = (typeof CHANGE_TARGET_TYPES)[number];

export function isChangeTargetType(value: unknown): value is ChangeTargetType {
  return typeof value === 'string' && (CHANGE_TARGET_TYPES as readonly string[]).includes(value);
}

// ─── Note bounds ─────────────────────────────────────────
//
// reasonNote and decisionNote are the only free-text fields in the whole
// flow. Both are capped so a proposal row can never become a message board;
// the caps mirror what one sentence of intent and one sentence of verdict
// need. Empty strings are refused: a proposal without a stated reason is
// not a proposal, and a rejection without a stated verdict is not honest
// review feedback (the endpoints enforce the same rule).

export const REASON_NOTE_MAX_LENGTH = 500;
export const DECISION_NOTE_MAX_LENGTH = 300;

export type NoteValidation =
  | { ok: true; value: string }
  | { ok: false; reason: string };

/** Trims, then accepts non-empty prose within the cap. */
export function validateReasonNote(value: unknown): NoteValidation {
  if (typeof value !== 'string') return { ok: false, reason: 'reasonNote must be a string' };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: false, reason: 'reasonNote must not be empty' };
  if (trimmed.length > REASON_NOTE_MAX_LENGTH) {
    return { ok: false, reason: `reasonNote must be at most ${REASON_NOTE_MAX_LENGTH} characters` };
  }
  return { ok: true, value: trimmed };
}

/**
 * decisionNote is optional (accept and distinct carry no obligation to
 * explain), but when present it must be non-empty prose within the cap.
 * Rejection requires it; the endpoint layer enforces that, this validator
 * only guarantees no empty or oversized text enters the table.
 */
export function validateDecisionNote(value: unknown): NoteValidation {
  if (value === null || value === undefined) return { ok: true, value: '' };
  if (typeof value !== 'string') return { ok: false, reason: 'decisionNote must be a string' };
  const trimmed = value.trim();
  if (trimmed === '') return { ok: false, reason: 'decisionNote must not be empty when provided' };
  if (trimmed.length > DECISION_NOTE_MAX_LENGTH) {
    return { ok: false, reason: `decisionNote must be at most ${DECISION_NOTE_MAX_LENGTH} characters` };
  }
  return { ok: true, value: trimmed };
}

// ─── Snapshot validation ─────────────────────────────────
//
// beforeJson and afterJson hold the editable column set of the target row,
// nothing else. The lists below are the whole contract: unknown keys are
// refused, which is what keeps non-target PII out of the table (a proposal
// cannot smuggle a second person's contact data inside an extra field).
// Two keys are deliberately absent from the member list: privacyStatus is
// the per-individual consent switch (T0e) and a proposal never touches
// consent, and technical keys (id, treeId, timestamps) identify the row
// rather than describe it.

export const MEMBER_PROPOSAL_FIELDS = [
  'name',
  'nickname',
  'birthDate',
  'deathDate',
  'birthPlace',
  'currentLocation',
  'profession',
  'education',
  'gender',
  'photoUrl',
  'email',
  'phone',
  'isAlive',
  'generation',
  'maritalStatus',
  'notes',
] as const;

export const RELATIONSHIP_PROPOSAL_FIELDS = ['memberId', 'relatedId', 'type'] as const;

export type SnapshotValidation =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Checks one snapshot object against the writable field contract of the
 * target type. Values must be JSON scalars (string, number, boolean) or
 * null, the shape the existing update path already persists.
 */
export function validateTargetSnapshot(targetType: ChangeTargetType, snapshot: unknown): SnapshotValidation {
  if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) {
    return { ok: false, reason: 'snapshot must be a plain JSON object' };
  }
  const allowed = targetType === 'member' ? MEMBER_PROPOSAL_FIELDS : RELATIONSHIP_PROPOSAL_FIELDS;
  for (const [key, value] of Object.entries(snapshot)) {
    if (!(allowed as readonly string[]).includes(key)) {
      return { ok: false, reason: `field "${key}" is not part of the ${targetType} proposal contract` };
    }
    if (value !== null && typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      return { ok: false, reason: `field "${key}" must be a string, number, boolean, or null` };
    }
  }
  return { ok: true };
}

// ─── Canonical JSON ──────────────────────────────────────
//
// The anti-re-proposal guard compares afterJson content, not string bytes:
// two payloads that differ only in key order are the same proposal. Keys
// are sorted recursively, so canonicalize is stable across engines and
// safe to store as the comparison basis.

export function canonicalizeSnapshotJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalizeSnapshotJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalizeSnapshotJson((value as Record<string, unknown>)[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

// ─── The owner gate (state machine) ──────────────────────
//
// Exactly one actor may decide a pending proposal: an owner of that tree
// (installation owners included, resolved by the endpoint layer). rejected
// and distinct are terminal; nobody re-opens a decided row, not even the
// owner who decided it. A rejected target may receive a new, different
// proposal; a distinct target may not receive the same content again.

export type ChangeDecisionAction = 'accept' | 'reject' | 'distinct';

export const CHANGE_ACTIONS = ['accept', 'reject', 'distinct'] as const;

export function isChangeDecisionAction(value: unknown): value is ChangeDecisionAction {
  return typeof value === 'string' && (CHANGE_ACTIONS as readonly string[]).includes(value);
}

export const CHANGE_ALREADY_DECIDED_CODE = 'CHANGE_ALREADY_DECIDED' as const;
export const CHANGE_DECIDER_NOT_OWNER_CODE = 'CHANGE_DECIDER_NOT_OWNER' as const;

export interface ChangeDecisionInput {
  state: ChangeState;
  /** Whether the decider holds owner rights on the proposal's tree. */
  deciderIsTreeOwner: boolean;
  action: ChangeDecisionAction;
}

export type ChangeDecisionReview =
  | { allowed: true }
  | { allowed: false; code: typeof CHANGE_ALREADY_DECIDED_CODE | typeof CHANGE_DECIDER_NOT_OWNER_CODE };

/** Legal transition check for every decide endpoint. */
export function reviewChangeDecision(input: ChangeDecisionInput): ChangeDecisionReview {
  if (input.state !== 'pending') {
    return { allowed: false, code: CHANGE_ALREADY_DECIDED_CODE };
  }
  if (!input.deciderIsTreeOwner) {
    return { allowed: false, code: CHANGE_DECIDER_NOT_OWNER_CODE };
  }
  return { allowed: true };
}

// ─── Anti-re-proposal guard ──────────────────────────────
//
// distinct is a permanent lock on one (targetType, targetId, afterJson)
// triple. The caller passes the tree's distinct rows for the target; the
// guard refuses a new proposal whose canonical afterJson matches any of
// them. Rejected rows never enter the input: rejection invites a better
// proposal, distinct refuses the same one forever.

export const CHANGE_DISTINCT_BLOCKED_CODE = 'CHANGE_DISTINCT_TARGET_LOCKED' as const;

export interface DistinctProposalLike {
  targetType: ChangeTargetType;
  targetId: string;
  afterJson: string;
}

export interface NewProposalInput {
  targetType: ChangeTargetType;
  targetId: string;
  afterJson: string;
  distinctProposals: readonly DistinctProposalLike[];
}

export type NewProposalReview =
  | { allowed: true }
  | { allowed: false; code: typeof CHANGE_DISTINCT_BLOCKED_CODE };

/** Guard every propose call: refuse content the owner already marked distinct. */
export function reviewNewProposal(input: NewProposalInput): NewProposalReview {
  const canonicalAfter = canonicalizeSnapshotJson(safeParse(input.afterJson));
  for (const distinct of input.distinctProposals) {
    if (distinct.targetType !== input.targetType || distinct.targetId !== input.targetId) continue;
    const canonicalDistinct = canonicalizeSnapshotJson(safeParse(distinct.afterJson));
    if (canonicalAfter === canonicalDistinct) {
      return { allowed: false, code: CHANGE_DISTINCT_BLOCKED_CODE };
    }
  }
  return { allowed: true };
}

function safeParse(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

// ─── Auto-accept policy ──────────────────────────────────
//
// Default off, always. Auto-accept fires only when both hold: the proposer
// is an owner of that tree and the per-user opt-in flag is active. Editor
// proposals are never auto-accepted; the flag is a policy input, and v1
// ships no setting surface for it, so the server passes false and every
// proposal waits for the human gate.

export const AUTO_ACCEPT_DEFAULT = false;

export interface AutoAcceptInput {
  /** The proposer's resolved role on the target tree (owner includes installation owners). */
  proposerTreeRole: 'owner' | 'editor' | 'viewer';
  /** Per-user opt-in flag; v1 has no surface, the server passes false. */
  autoAcceptOptIn: boolean;
}

/** The single decision point: who, if anyone, skips the owner gate. */
export function reviewAutoAccept(input: AutoAcceptInput): boolean {
  if (input.proposerTreeRole !== 'owner') return false;
  return input.autoAcceptOptIn;
}
