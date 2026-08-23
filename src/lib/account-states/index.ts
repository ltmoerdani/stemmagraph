// Pure account-state logic for P2-1 (Account States and Owner Activation Gate).
//
// This module is intentionally free of I/O: no database, no HTTP, no React.
// The server (`server/index.ts`) and the test suite both consume it, so the
// state machine, the last-owner guard, and the notification payload shapes
// have exactly one source of truth. The binding design record is
// docs/decisions/0002-roles-and-account-states.md.

// ─── Account status and role domain ──────────────────────

export const ACCOUNT_STATUSES = ['pending', 'active', 'disabled'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const ACCOUNT_ROLES = ['owner', 'member'] as const;
export type AccountRole = (typeof ACCOUNT_ROLES)[number];

export function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && (ACCOUNT_STATUSES as readonly string[]).includes(value);
}

export function isAccountRole(value: unknown): value is AccountRole {
  return typeof value === 'string' && (ACCOUNT_ROLES as readonly string[]).includes(value);
}

// ─── State machine ───────────────────────────────────────
//
// Legal transitions and who may execute them (all require an ACTIVE owner):
//   pending  -> active    activate (approve a waiting registration)
//   pending  -> disabled  disable  (reject a registration outright)
//   active   -> disabled  disable
//   disabled -> active    enable   (restore a previously disabled account)
// Everything else is refused, including no-op transitions, so callers get a
// loud signal instead of silently writing the same state back.

export const ACCOUNT_STATUS_TRANSITIONS: Readonly<
  Record<AccountStatus, readonly AccountStatus[]>
> = {
  pending: ['active', 'disabled'],
  active: ['disabled'],
  disabled: ['active'],
};

export function canTransition(from: AccountStatus, to: AccountStatus): boolean {
  if (from === to) return false;
  const targets = ACCOUNT_STATUS_TRANSITIONS[from];
  return targets !== undefined && targets.includes(to);
}

// ─── Bootstrap rule ──────────────────────────────────────
//
// The first account on an empty user table is born ACTIVE with role OWNER so
// a fresh install can administer itself. Every later registration is born
// PENDING with role MEMBER and waits for owner activation (ADR 0002).

export interface BootstrapOutcome {
  status: AccountStatus;
  role: AccountRole;
  isFirstUser: boolean;
}

export function bootstrapAccountState(existingUserCount: number): BootstrapOutcome {
  if (existingUserCount <= 0) {
    return { status: 'active', role: 'owner', isFirstUser: true };
  }
  return { status: 'pending', role: 'member', isFirstUser: false };
}

// ─── Last-owner guard (R-73.5) ───────────────────────────

export const SELF_DISABLE_CODE = 'SELF_DISABLE_FORBIDDEN' as const;
export const LAST_OWNER_GUARD_CODE = 'LAST_OWNER_GUARD' as const;

export interface OwnerGuardInput {
  /** The active owner performing the action. */
  actorId: string;
  /** The account being disabled. */
  targetId: string;
  targetRole: AccountRole;
  targetStatus: AccountStatus;
  /** Active owners other than the target. */
  otherActiveOwnerCount: number;
}

export type OwnerGuardDecision =
  | { allowed: true }
  | { allowed: false; code: typeof SELF_DISABLE_CODE | typeof LAST_OWNER_GUARD_CODE };

/**
 * Reviews a DISABLE action before it is applied.
 *
 * Rules, in order:
 *   1. An owner may never disable their own account. There is no scenario
 *      where this is needed, and doing it by mistake locks out the admin
 *      surface, so it is refused outright.
 *   2. Disabling the only active owner is refused: the installation would
 *      be left without anyone able to administer accounts.
 *
 * Disabling a pending or disabled account never trips rule 2 because the
 * guard protects the last ACTIVE owner specifically.
 */
export function reviewDisableAction(input: OwnerGuardInput): OwnerGuardDecision {
  if (input.actorId === input.targetId) {
    return { allowed: false, code: SELF_DISABLE_CODE };
  }
  const targetIsActiveOwner = input.targetRole === 'owner' && input.targetStatus === 'active';
  if (targetIsActiveOwner && input.otherActiveOwnerCount <= 0) {
    return { allowed: false, code: LAST_OWNER_GUARD_CODE };
  }
  return { allowed: true };
}

// ─── Notification builders (R-73.3, R-74.7) ──────────────

export const ACCOUNT_NOTIFICATION_TYPES = [
  'ACCOUNT_PENDING_CREATED',
  'ACCOUNT_ACTIVATED',
] as const;
export type AccountNotificationType = (typeof ACCOUNT_NOTIFICATION_TYPES)[number];

/** Shape handed to the persistence layer; id/readAt/createdAt are set by the store. */
export interface AccountNotificationDraft {
  userId: string;
  type: AccountNotificationType;
  payloadJson: string;
}

export interface PendingAccountSubject {
  id: string;
  email: string;
  name: string;
}

/**
 * Notifies one active owner that a registration is waiting for activation.
 * The caller fans this out to every active owner.
 */
export function buildAccountPendingCreatedNotification(
  ownerUserId: string,
  pendingUser: PendingAccountSubject,
): AccountNotificationDraft {
  return {
    userId: ownerUserId,
    type: 'ACCOUNT_PENDING_CREATED',
    payloadJson: JSON.stringify({
      pendingUserId: pendingUser.id,
      email: pendingUser.email,
      name: pendingUser.name,
    }),
  };
}

/** Notifies the activated user that their account is now usable. */
export function buildAccountActivatedNotification(userId: string): AccountNotificationDraft {
  return {
    userId,
    type: 'ACCOUNT_ACTIVATED',
    payloadJson: JSON.stringify({}),
  };
}
