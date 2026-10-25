// ===== Adapter Registry & Factory =====
// Single entry point for data adapter resolution.
// Switch backends by changing VITE_DATA_ADAPTER env var:
//
//   VITE_DATA_ADAPTER=mock      # In-memory demo (default)
//   VITE_DATA_ADAPTER=rest      # Generic REST API
//   VITE_DATA_ADAPTER=supabase  # Supabase managed PostgreSQL
//
// For REST adapter, also set:
//   VITE_API_BASE_URL=http://localhost:8080/api/v1
//
// For Supabase adapter, also set:
//   VITE_SUPABASE_URL=https://xxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJhbGciOi...

import { DataAdapter, AccountAdminApi, InvitationAdminApi, ShareLinkAdminApi, ActivityFeedApi, GrowthMetricsApi, DigestApi, ChangeReviewApi, ConsentApi, CitationApi, StatsApi, DuplicateCheckApi, MergeApi, CalendarFeedApi } from './types';
import { MockAdapter } from './mock.adapter';
import { RestAdapter } from './rest.adapter';
import { SupabaseAdapter } from './supabase.adapter';

/**
 * Returns the duplicate-check surface of the active adapter (v388), or
 * null when the adapter has no server backend (mock, supabase). The UI
 * skips the warning lookup for null and behaves exactly as before v388.
 */
export function getDuplicateCheckApi(): DuplicateCheckApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

/**
 * Returns the guided-merge surface of the active adapter (v390), or
 * null when the adapter has no server backend (mock, supabase). The UI
 * hides the merge action for null and behaves exactly as before v390.
 */
export function getMergeApi(): MergeApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

/**
 * Calendar feed token surface (v394 AC5): only the REST adapter can talk
 * to the server; mock/supabase adapters return null and the panel hides
 * itself, mirroring getMergeApi.
 */
export function getCalendarFeedApi(): CalendarFeedApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

/**
 * Member photo surface (v398): only the REST adapter can talk to the
 * server; mock/supabase adapters return null and the UI hides upload
 * actions, mirroring getMergeApi.
 */
export function getMemberPhotoApi(): MemberPhotoApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Singleton ────────────────────────────────────────────

let _adapter: DataAdapter | null = null;

/**
 * Returns the configured DataAdapter singleton.
 * First call creates the adapter based on VITE_DATA_ADAPTER env var.
 * Subsequent calls return the same instance (singleton pattern).
 */
export function getAdapter(): DataAdapter {
  if (_adapter) return _adapter;

  const mode = import.meta.env.VITE_DATA_ADAPTER || 'mock';

  switch (mode) {
    case 'rest': {
      const baseUrl = import.meta.env.VITE_API_BASE_URL;
      if (!baseUrl) {
        console.warn('[Adapter] VITE_API_BASE_URL not set, falling back to mock');
        _adapter = new MockAdapter();
        return _adapter;
      }
      console.info(`[Adapter] Using REST adapter → ${baseUrl}`);
      _adapter = new RestAdapter({ baseUrl });
      return _adapter;
    }

    case 'supabase': {
      const url = import.meta.env.VITE_SUPABASE_URL;
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        console.warn('[Adapter] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set, falling back to mock');
        _adapter = new MockAdapter();
        return _adapter;
      }
      console.info(`[Adapter] Using Supabase adapter → ${url}`);
      _adapter = new SupabaseAdapter(url, key);
      return _adapter;
    }

    case 'mock':
    default:
      console.info('[Adapter] Using Mock adapter (in-memory demo)');
      _adapter = new MockAdapter();
      return _adapter;
  }
}

/**
 * Reset adapter singleton (useful for testing).
 */
export function resetAdapter(): void {
  _adapter = null;
}

// ─── Account Administration (P2-1) ────────────────────────

/**
 * Returns the account admin surface of the active adapter, or null when the
 * adapter has no server-backed accounts (mock, supabase). The UI hides the
 * notification menu and admin panel for null instead of crashing.
 */
export function getAccountAdminApi(): AccountAdminApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Invitations and tree membership (P2-3) ───────────────

/**
 * Returns the invitation and membership surface of the active adapter, or
 * null when the adapter has no server backend (mock, supabase). The UI
 * hides the invitations panel for null instead of crashing.
 */
export function getInvitationAdminApi(): InvitationAdminApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Share link management (S-05, ADR 0010) ───────────────

/**
 * Returns the share link surface of the active adapter, or null when the
 * adapter has no server backend (mock, supabase). The UI hides the share
 * links panel for null instead of crashing.
 */
export function getShareLinkAdminApi(): ShareLinkAdminApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Activity feed (P2-6) ─────────────────────────────────

/**
 * Returns the activity feed surface of the active adapter, or null when
 * the adapter has no server backend (mock, supabase): the feed reads the
 * server event store. The UI shows an honest unavailable state for null.
 */
export function getActivityFeedApi(): ActivityFeedApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Change review (P2-5) ─────────────────────────────────

/**
 * Returns the change-review surface of the active adapter, or null when
 * the adapter has no server backend (mock, supabase): the queue lives in
 * the ChangeProposal table. The UI hides every change-review surface for
 * null; the server refuses viewers with 403 on its own.
 */
export function getChangeReviewApi(): ChangeReviewApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Growth metrics (P2-8) ────────────────────────────────

/**
 * Returns the growth metrics surface of the active adapter, or null when
 * the adapter has no server backend (mock, supabase): the metrics read the
 * server event store. The UI shows an honest unavailable state for null.
 */
export function getGrowthMetricsApi(): GrowthMetricsApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Weekly digest (P2-7) ─────────────────────────────────

/**
 * Returns the digest settings surface of the active adapter, or null
 * when the adapter has no server backend (mock, supabase): the digest
 * reads the server event store. The UI shows an honest unavailable
 * state for null instead of a dead toggle.
 */
export function getDigestApi(): DigestApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Member consent ledger (S-06c) ────────────────────────

/**
 * Returns the per-member consent surface of the active adapter, or null
 * when the adapter has no server backend (mock, supabase): the ledger
 * lives in the ConsentRecord table behind the API. The UI hides the
 * consent section for null instead of crashing.
 */
export function getConsentApi(): ConsentApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

/**
 * Override adapter with a custom implementation (useful for testing).
 */
export function setAdapter(adapter: DataAdapter): void {
  _adapter = adapter;
}

// ─── Citation surface (v155-iii-a) ────────────────────────

/**
 * Returns the citation surface of the active adapter, or null when the
 * adapter has no server backend (mock, supabase): sources and citations
 * live behind the /api/v1 routes. The import UI skips citation wiring
 * for null instead of crashing.
 */
export function getCitationApi(): CitationApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Server stats (v277 fase ii) ──────────────────────────

/**
 * Returns the server stats surface of the active adapter, or null when
 * the adapter has no server backend (mock, supabase): upcoming
 * anniversaries live behind GET /api/v1/trees/:treeId/stats/... computed
 * by the server. The UI skips the section for null instead of computing
 * from the client store.
 */
export function getStatsApi(): StatsApi | null {
  const adapter = getAdapter();
  return adapter instanceof RestAdapter ? adapter : null;
}

// ─── Re-export Types ──────────────────────────────────────

export type {
  DataAdapter,
  AuthUser,
  AuthSession,
  AuthCredentials,
  RegisterInput,
  FamilyTreeRecord,
  CreateTreeInput,
  FamilyMemberRecord,
  CreateMemberInput,
  MemberRelationship,
  AccountAdminApi,
  InvitationAdminApi,
  InvitationContextInfo,
  InvitationRecord,
  InvitationState,
  InvitationTypeValue,
  InvitationChannel,
  CreatedInvitation,
  CreateInvitationInput,
  TreeMembershipRecord,
  TreeRoleValue,
  AdminAccount,
  AdminAccountStatus,
  AdminAccountRole,
  AccountStatusAction,
  AppNotification,
  NotificationsPage,
  ActivityFeedApi,
  ActivityFeedPage,
  ActivityFeedQueryOptions,
  GrowthMetricsApi,
  GrowthMetricsSnapshot,
  GrowthMetricsQueryOptions,
  GrowthWeekMetrics,
  DigestApi,
  DigestPreview,
  ChangeReviewApi,
  ChangeProposalRecord,
  CreateChangeProposalInput,
  ConsentApi,
  ConsentRecordView,
  ConsentStateView,
  ConsentMutationResult,
  ShareLinkAdminApi,
  ShareLinkRecord,
  CitationApi,
  CitationSpec,
  CitationEventType,
  StatsApi,
  UpcomingAnniversaryDto,
  MemberPhotoApi,
  MemberPhotoUploadResult,
} from './types';

export {
  AdapterError,
  AuthError,
  NotFoundError,
} from './types';
