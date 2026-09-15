// Pure invitation and tree-membership logic for P2-3 (ADR 0004).
//
// This module is intentionally free of I/O: no database, no HTTP, no React,
// and no Node built-ins, so the browser bundle may import it safely. The
// token generator is the one exception to "no I/O" and lives in ./token
// (node:crypto); the server imports it separately, which keeps this file
// usable from the UI. The binding design record is
// docs/decisions/0004-invitations-and-tree-membership.md.

// ─── Vocabulary ──────────────────────────────────────────

export const INVITATION_TYPES = ['personal', 'family'] as const;
export type InvitationType = (typeof INVITATION_TYPES)[number];

export function isInvitationType(value: unknown): value is InvitationType {
  return typeof value === 'string' && (INVITATION_TYPES as readonly string[]).includes(value);
}

/** Roles a membership row can hold on one tree (ADR 0002 matrix). */
export const TREE_ROLES = ['owner', 'editor', 'viewer'] as const;
export type TreeRole = (typeof TREE_ROLES)[number];

export function isTreeRole(value: unknown): value is TreeRole {
  return typeof value === 'string' && (TREE_ROLES as readonly string[]).includes(value);
}

/**
 * Roles an invitation may grant. A personal invitation always grants
 * viewer (ADR 0004); editor is only reachable through a family invitation.
 */
export function isValidGrantedRole(type: InvitationType, role: unknown): role is TreeRole {
  if (!isTreeRole(role)) return false;
  if (role === 'owner') return false;
  return type === 'family' || role === 'viewer';
}

// ─── Policy constants (single source of truth) ───────────
//
// The server consumes these constants instead of repeating the numbers, so
// the ADR text and the running code cannot drift apart (ADR 0004).

/** Time to live per invitation type, in hours: personal 48h, family 7d. */
export const INVITATION_TTL_HOURS: Readonly<Record<InvitationType, number>> = {
  personal: 48,
  family: 168,
};

/** Default max uses of a family invitation when the owner sends none. */
export const FAMILY_DEFAULT_MAX_USES = 20;

/** Inclusive clamp bounds for a family invitation's max uses. */
export const FAMILY_MAX_USES_MIN = 1;
export const FAMILY_MAX_USES_MAX = 100;

/** A personal invitation is single use by definition (ADR 0004). */
export const PERSONAL_MAX_USES = 1;

/** Entropy floor for tokens (bits). The generator exceeds it; see ./token. */
export const TOKEN_MIN_ENTROPY_BITS = 128;

export function clampMaxUses(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : FAMILY_DEFAULT_MAX_USES;
  return Math.min(FAMILY_MAX_USES_MAX, Math.max(FAMILY_MAX_USES_MIN, n));
}

/** Effective max uses for a new invitation of the given type. */
export function initialMaxUses(type: InvitationType, requested?: unknown): number {
  return type === 'personal' ? PERSONAL_MAX_USES : clampMaxUses(requested);
}

/** Expiry stamp for a new invitation: now plus the type's TTL. */
export function computeExpiresAt(type: InvitationType, now: Date): Date {
  return new Date(now.getTime() + INVITATION_TTL_HOURS[type] * 3_600_000);
}

/** Uses still available, floored at zero so dead rows never read negative. */
export function remainingUses(invitation: InvitationLike): number {
  return Math.max(0, invitation.maxUses - invitation.usedCount);
}

// ─── State machine ───────────────────────────────────────
//
// invitationState derives the lifecycle state from the row on every read;
// there is no cached status column to fall out of sync (ADR 0004).
// Precedence is fixed: revoked beats everything, then expired (inclusive:
// at exactly expiresAt the invitation is already expired), then
// exhausted/consumed, and only then active.

export const INVITATION_STATES = ['active', 'expired', 'exhausted', 'revoked', 'consumed'] as const;
export type InvitationState = (typeof INVITATION_STATES)[number];

/** The subset of an Invitation row the state machine needs. */
export interface InvitationLike {
  type: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date;
  revokedAt: Date | null;
}

export function invitationState(invitation: InvitationLike, now: Date): InvitationState {
  if (invitation.revokedAt !== null) return 'revoked';
  if (now.getTime() >= invitation.expiresAt.getTime()) return 'expired';
  if (invitation.type === 'personal') {
    return invitation.usedCount >= PERSONAL_MAX_USES ? 'consumed' : 'active';
  }
  return invitation.usedCount >= invitation.maxUses ? 'exhausted' : 'active';
}

/** Honest codes for dead states on public surfaces; null means usable. */
export function invitationFailureCode(
  state: InvitationState,
): 'INVITATION_EXPIRED' | 'INVITATION_REVOKED' | 'INVITATION_EXHAUSTED' | null {
  if (state === 'expired') return 'INVITATION_EXPIRED';
  if (state === 'revoked') return 'INVITATION_REVOKED';
  if (state === 'exhausted' || state === 'consumed') return 'INVITATION_EXHAUSTED';
  return null;
}

// ─── Public context and the anti-PII validator ───────────
//
// The public /info surface and the audit payloads share one rule: technical
// ids and the inviter's display name are allowed; contact data of the
// recipient (phone, messaging handles, email) is refused. The design keeps
// no column for a recipient phone number at all, and this validator keeps
// one from sneaking in through a payload key (ADR 0004, Law 27/2022
// Articles 31 and 33).

export interface InvitationContext {
  type: InvitationType;
  treeName: string;
  inviterName: string;
  expiresAt: string;
  remainingUses: number;
}

export function buildInvitationContext(input: {
  invitation: InvitationLike;
  treeName: string;
  inviterName: string;
  now: Date;
}): InvitationContext {
  return {
    type: input.invitation.type as InvitationType,
    treeName: input.treeName,
    inviterName: input.inviterName,
    expiresAt: input.invitation.expiresAt.toISOString(),
    remainingUses: remainingUses(input.invitation),
  };
}

const FORBIDDEN_INVITATION_KEYS = [
  'phone',
  'phonenumber',
  'number',
  'wa',
  'whatsapp',
  'nomor',
  'email',
  'recipient',
  'recipientphone',
  'recipientemail',
  'penerima',
  'contact',
  'contactdetail',
] as const;

const KNOWN_INVITATION_KEYS = [
  'type',
  'invitationtype',
  'treeid',
  'treename',
  'tree',
  'inviteruserid',
  'invitername',
  'expiresat',
  'maxuses',
  'usedcount',
  'remaininguses',
  'invitationid',
  'channel',
  'grantedrole',
  'role',
  'state',
] as const;

export type InvitationPayloadValidation =
  | { ok: true }
  | { ok: false; reason: string };

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[\s_-]/g, '');
}

/**
 * Checks an invitation-shaped payload object against the P2-3 contract.
 *
 * Refused: recipient contact keys (see FORBIDDEN_INVITATION_KEYS), unknown
 * keys outside the documented contract, and empty values (empty string,
 * null, undefined). The inviter's technical userId and display name pass.
 */
export function validateInvitationPayload(payload: unknown): InvitationPayloadValidation {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { ok: false, reason: 'payload must be a plain object' };
  }
  for (const [key, value] of Object.entries(payload)) {
    const normalized = normalizeKey(key);
    if ((FORBIDDEN_INVITATION_KEYS as readonly string[]).includes(normalized)) {
      return { ok: false, reason: `payload key "${key}" is refused: recipient contact data must not travel with an invitation` };
    }
    if (!(KNOWN_INVITATION_KEYS as readonly string[]).includes(normalized)) {
      return { ok: false, reason: `payload key "${key}" is not part of the P2-3 contract` };
    }
    if (typeof value !== 'string' && typeof value !== 'number') {
      return { ok: false, reason: `payload key "${key}" must be a non-empty string or number` };
    }
    if (typeof value === 'string' && value === '') {
      return { ok: false, reason: `payload key "${key}" must not be empty` };
    }
  }
  return { ok: true };
}

/**
 * Masked token for every surface after creation. The full token is shown
 * exactly once, in the creation response (ADR 0004).
 */
export function maskInvitationToken(token: string): string {
  if (token.length <= 8) return '****';
  return `${token.slice(0, 4)}****${token.slice(-4)}`;
}

// ─── Tree permission matrix (ADR 0002) ───────────────────
//
// canPerformTreeAction is the single source the server consults, so the
// matrix columns Owner, Editor, Viewer are enforced facts, not prose.
// "Propose change" and "Review proposed change" land with P2-5 and are
// deliberately absent here.

export const TREE_ACTIONS = [
  'view_tree',
  'create_member',
  'edit_member',
  'delete_member',
  'create_relationship',
  'delete_relationship',
  'update_tree',
  'delete_tree',
  'manage_invitations',
  'manage_membership',
] as const;
export type TreeAction = (typeof TREE_ACTIONS)[number];

export const TREE_ACTION_MATRIX: Readonly<Record<TreeAction, readonly TreeRole[]>> = {
  view_tree: ['owner', 'editor', 'viewer'],
  create_member: ['owner', 'editor'],
  edit_member: ['owner', 'editor'],
  delete_member: ['owner'],
  create_relationship: ['owner', 'editor'],
  delete_relationship: ['owner'],
  update_tree: ['owner'],
  delete_tree: ['owner'],
  manage_invitations: ['owner'],
  manage_membership: ['owner'],
};

export function canPerformTreeAction(role: TreeRole, action: TreeAction): boolean {
  return TREE_ACTION_MATRIX[action].includes(role);
}

// ─── TREE_LAST_OWNER_GUARD ───────────────────────────────
//
// A tree must never lose its last active tree owner: that tree would be
// unfixable through the application (ADR 0004). Demoting or removing the
// membership of the only active account holding tree role owner is refused
// before the write. An account-level disable of the same person is not
// guarded here: the membership row survives and is restored by enabling
// the account.

export const TREE_LAST_OWNER_GUARD_CODE = 'TREE_LAST_OWNER_GUARD' as const;

export interface TreeMembershipChangeInput {
  targetTreeRole: TreeRole;
  /** Next role, or null when the membership row is being removed. */
  nextTreeRole: TreeRole | null;
  /** Active accounts holding tree role owner in this tree, excluding the target. */
  otherActiveTreeOwnerCount: number;
}

export type TreeMembershipChangeDecision =
  | { allowed: true }
  | { allowed: false; code: typeof TREE_LAST_OWNER_GUARD_CODE };

export function reviewTreeMembershipChange(input: TreeMembershipChangeInput): TreeMembershipChangeDecision {
  const losesTreeOwner = input.targetTreeRole === 'owner' && input.nextTreeRole !== 'owner';
  if (losesTreeOwner && input.otherActiveTreeOwnerCount <= 0) {
    return { allowed: false, code: TREE_LAST_OWNER_GUARD_CODE };
  }
  return { allowed: true };
}
