// Pure view-logic for the P2-1 admin and notification surfaces.
//
// Same ground rules as the rest of src/lib/account-states: no I/O, no
// React, no i18next import. Components feed these helpers plain data and
// get back decisions (which buttons to render, whether the admin panel
// is visible, which resource key describes a notification), which keeps
// the logic unit-testable under the node-only vitest environment.

import {
  ACCOUNT_STATUS_TRANSITIONS,
  type AccountStatus,
  type AccountRole,
} from './index';
import type { AccountStatusAction } from '../adapters/types';

// ─── Admin action derivation ─────────────────────────────
//
// The state machine (ACCOUNT_STATUS_TRANSITIONS) already defines the
// legal targets per source status. This table only names the endpoint:
// reaching 'active' from a pending account is "activate", while
// restoring a disabled account is "enable" (ADR 0002).
const TARGET_ACTION: Readonly<
  Record<AccountStatus, Partial<Record<AccountStatus, AccountStatusAction>>>
> = {
  pending: { active: 'activate', disabled: 'disable' },
  active: { disabled: 'disable' },
  disabled: { active: 'enable' },
};

/**
 * Actions the admin panel may offer for an account in the given status,
 * derived from the shared state machine so UI and server cannot drift.
 * Table gaps fall through silently here but fail the exact-array unit
 * tests, so the two cannot drift apart unnoticed.
 */
export function actionsForStatus(from: AccountStatus): AccountStatusAction[] {
  const actions: AccountStatusAction[] = [];
  for (const to of ACCOUNT_STATUS_TRANSITIONS[from]) {
    const action = TARGET_ACTION[from][to];
    if (action !== undefined) actions.push(action);
  }
  return actions;
}

// ─── Admin visibility gate (AC-5d) ───────────────────────

/** Minimal shape the gate needs; AuthUser satisfies it. */
export interface GateUser {
  role?: AccountRole | undefined;
  status?: AccountStatus | undefined;
}

/**
 * True only for an ACTIVE OWNER. This mirrors requireOwner on the server:
 * the admin entry point is hidden from members, pending owners, and
 * disabled owners alike. The server still re-checks on every call, so the
 * gate here is UX honesty, not the security boundary.
 */
export function isAdminUser(user: GateUser | null | undefined): boolean {
  return user?.role === 'owner' && user?.status === 'active';
}

// ─── Notification descriptions ───────────────────────────

/** i18n resource key plus the interpolation values it needs. */
export interface NotificationDescription {
  key: string;
  values: Record<string, string>;
}

interface UnknownRecord {
  [key: string]: unknown;
}

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null ? (value as UnknownRecord) : null;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * Maps a stored notification to a resource key under notifications.items
 * plus its interpolation values. Unknown or malformed payloads fall back
 * to a generic line that still names the raw type, so new server-side
 * types render instead of crashing the menu.
 */
export function describeNotification(type: string, payload: unknown): NotificationDescription {
  const record = asRecord(payload);
  switch (type) {
    case 'ACCOUNT_PENDING_CREATED':
      return {
        key: 'notifications.items.pendingCreated',
        values: {
          name: asString(record?.name, '?'),
          email: asString(record?.email, '?'),
        },
      };
    case 'ACCOUNT_ACTIVATED':
      return { key: 'notifications.items.activated', values: {} };
    default:
      return { key: 'notifications.items.unknown', values: { type } };
  }
}
