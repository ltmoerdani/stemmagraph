// ===== REST API Adapter =====
// Generic REST adapter for any backend (MySQL, PostgreSQL, SQLite, etc.)
// that exposes a standard REST API.
//
// Expected API endpoints (configurable via constructor):
//   POST   /auth/login
//   POST   /auth/register
//   POST   /auth/logout
//   GET    /auth/session
//   GET    /trees
//   GET    /trees/:id
//   POST   /trees
//   PUT    /trees/:id
//   DELETE /trees/:id
//   GET    /trees/:id/members
//   GET    /members/:id
//   POST   /trees/:id/members
//   PUT    /members/:id
//   DELETE /members/:id
//   GET    /trees/:id/relationships
//   POST   /trees/:id/relationships
//   DELETE /relationships/:id

import {
  DataAdapter,
  AuthSession,
  AuthCredentials,
  RegisterInput,
  FamilyTreeRecord,
  CreateTreeInput,
  FamilyMemberRecord,
  CreateMemberInput,
  MemberRelationship,
  AccountAdminApi,
  AdminAccount,
  AccountStatusAction,
  AppNotification,
  NotificationsPage,
  InvitationAdminApi,
  ShareLinkRecord,
  InvitationContextInfo,
  InvitationRecord,
  CreatedInvitation,
  CreateInvitationInput,
  TreeMembershipRecord,
  TreeRoleValue,
  ActivityFeedApi,
  ActivityFeedPage,
  ActivityFeedQueryOptions,
  GrowthMetricsApi,
  GrowthMetricsSnapshot,
  GrowthMetricsQueryOptions,
  DigestApi,
  DigestPreview,
  ChangeReviewApi,
  ChangeProposalPage,
  ChangeProposalRecord,
  CreateChangeProposalInput,
  ConsentApi,
  ConsentSelfApi,
  ConsentStateView,
  ConsentMutationResult,
  SelfConsentOverview,
  CitationApi,
  CitationSpec,
  CitationEventType,
  StatsApi,
  UpcomingAnniversaryDto,
  GenerationsCountDto,
  FamilySizeStatsDto,
  PlaceDistributionDto,
  MergeApi,
  MergeMemberResult,
  MergeApprovalRecord,
  MergeApprovalDecision,
  MergeRiskReasonView,
  CalendarFeedApi,
  AdapterError,
  AuthError,
  MemberPhotoApi,
  MemberPhotoUploadResult,
} from './types';
import type { DuplicateCandidateDto } from './types';
import type { FeedItem } from '../feed';

/**
 * P2-1 (ADR 0002): server error codes that describe an unusable account
 * state rather than bad credentials. Login surfaces them as AuthError.
 */
const ACCOUNT_STATE_ERROR_CODES = new Set(['ACCOUNT_PENDING', 'ACCOUNT_DISABLED']);

interface RestAdapterOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  /** Called on 401: return a new token (or null to force re-login) */
  onTokenRefresh?: () => Promise<string | null>;
}

export class RestAdapter implements DataAdapter, AccountAdminApi, InvitationAdminApi, ActivityFeedApi, GrowthMetricsApi, DigestApi, ChangeReviewApi, ConsentApi, ConsentSelfApi, CitationApi, StatsApi, DuplicateCheckApi, MergeApi, CalendarFeedApi, MemberPhotoApi {
  readonly name = 'rest';
  readonly version = '1.0.0';
  readonly description = 'Generic REST API adapter (MySQL / PostgreSQL / etc.)';

  private token: string | null = null;
  private options: RestAdapterOptions;

  constructor(options: RestAdapterOptions) {
    this.options = {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    };
  }

  // ── HTTP Helpers ────────────────────────────────────────

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.options.baseUrl}${path}`;
    const headers: Record<string, string> = { ...this.options.headers };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Auto-refresh token on 401
    if (res.status === 401 && this.options.onTokenRefresh) {
      const newToken = await this.options.onTokenRefresh();
      if (newToken) {
        this.token = newToken;
        headers['Authorization'] = `Bearer ${newToken}`;
        const retry = await fetch(url, {
          method,
          headers,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (!retry.ok) {
          const err = await retry.json().catch(() => ({}));
          throw new AdapterError(err.message || retry.statusText, err.code || 'API_ERROR', retry.status);
        }
        return retry.json();
      }
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new AdapterError(err.message || res.statusText, err.code || 'API_ERROR', res.status);
    }

    // Handle 204 No Content
    if (res.status === 204) return undefined as T;
    return res.json();
  }

  // ── Auth ────────────────────────────────────────────────

  async login(credentials: AuthCredentials): Promise<AuthSession> {
    try {
      const session = await this.request<AuthSession>('POST', '/auth/login', credentials);
      this.token = session.token ?? null;
      return session;
    } catch (e) {
      // P2-1: a pending or disabled account is a typed auth state, not a
      // generic API failure. request() only knows AdapterError, so rethrow
      // the state codes as AuthError for the login screen to branch on.
      if (e instanceof AdapterError && ACCOUNT_STATE_ERROR_CODES.has(e.code)) {
        throw new AuthError(e.message, e.code, e.statusCode);
      }
      throw e;
    }
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const body = await this.request<AuthSession & { message?: string }>('POST', '/auth/register', input);
    // P2-1: a later registration is born pending and gets no token. The
    // server answers 202 with the user and an honest message; surface that
    // as a typed error so the auth store can show the waiting screen
    // instead of pretending the user signed in.
    if (!body.token && body.user?.status === 'pending') {
      throw new AuthError(
        body.message ?? 'Account created, waiting for activation',
        'ACCOUNT_PENDING',
        202,
      );
    }
    this.token = body.token ?? null;
    return body;
  }

  async logout(): Promise<void> {
    await this.request<void>('POST', '/auth/logout');
    this.token = null;
  }

  async getSession(): Promise<AuthSession | null> {
    try {
      return await this.request<AuthSession>('GET', '/auth/session');
    } catch {
      return null;
    }
  }

  async refreshSession(): Promise<AuthSession | null> {
    if (this.options.onTokenRefresh) {
      const newToken = await this.options.onTokenRefresh();
      if (newToken) {
        this.token = newToken;
        return this.getSession();
      }
    }
    return null;
  }

  // ── Family Trees ────────────────────────────────────────

  async listTrees(): Promise<FamilyTreeRecord[]> {
    return this.request<FamilyTreeRecord[]>('GET', '/trees');
  }

  async getTree(id: string): Promise<FamilyTreeRecord | null> {
    try {
      return await this.request<FamilyTreeRecord>('GET', `/trees/${id}`);
    } catch (e) {
      if (e instanceof AdapterError && e.statusCode === 404) return null;
      throw e;
    }
  }

  async createTree(input: CreateTreeInput): Promise<FamilyTreeRecord> {
    return this.request<FamilyTreeRecord>('POST', '/trees', input);
  }

  async updateTree(id: string, data: Partial<FamilyTreeRecord>): Promise<FamilyTreeRecord> {
    return this.request<FamilyTreeRecord>('PUT', `/trees/${id}`, data);
  }

  async deleteTree(id: string): Promise<void> {
    await this.request<void>('DELETE', `/trees/${id}`);
  }

  // ── Family Members ──────────────────────────────────────

  async listMembers(treeId: string): Promise<FamilyMemberRecord[]> {
    return this.request<FamilyMemberRecord[]>('GET', `/trees/${treeId}/members`);
  }

  async getMember(id: string): Promise<FamilyMemberRecord | null> {
    try {
      return await this.request<FamilyMemberRecord>('GET', `/members/${id}`);
    } catch (e) {
      if (e instanceof AdapterError && e.statusCode === 404) return null;
      throw e;
    }
  }

  async createMember(treeId: string, input: CreateMemberInput): Promise<FamilyMemberRecord> {
    return this.request<FamilyMemberRecord>('POST', `/trees/${treeId}/members`, input);
  }

  async updateMember(id: string, data: Partial<FamilyMemberRecord>): Promise<FamilyMemberRecord> {
    return this.request<FamilyMemberRecord>('PUT', `/members/${id}`, data);
  }

  async deleteMember(id: string): Promise<void> {
    await this.request<void>('DELETE', `/members/${id}`);
  }

  // ── Relationships ───────────────────────────────────────

  async listRelationships(treeId: string): Promise<MemberRelationship[]> {
    return this.request<MemberRelationship[]>('GET', `/trees/${treeId}/relationships`);
  }

  async createRelationship(
    treeId: string,
    memberId: string,
    relatedId: string,
    type: MemberRelationship['type'],
  ): Promise<MemberRelationship> {
    return this.request<MemberRelationship>('POST', `/trees/${treeId}/relationships`, {
      memberId,
      relatedId,
      type,
    });
  }

  async deleteRelationship(id: string): Promise<void> {
    await this.request<void>('DELETE', `/relationships/${id}`);
  }

  // ── Account Administration (P2-1) ───────────────────────
  // Mirrors server/index.ts: notifications belong to the caller; account
  // management is owner-gated server side. The adapter only routes calls.

  async listNotifications(): Promise<NotificationsPage> {
    const body = await this.request<{ notifications: AppNotification[]; unreadCount: number }>(
      'GET',
      '/notifications',
    );
    return {
      notifications: body.notifications ?? [],
      unreadCount: body.unreadCount ?? 0,
    };
  }

  async markNotificationRead(id: string): Promise<AppNotification> {
    const body = await this.request<{ notification: AppNotification }>(
      'POST',
      `/notifications/${id}/read`,
    );
    return body.notification;
  }

  async markAllNotificationsRead(): Promise<number> {
    const body = await this.request<{ updated: number }>('POST', '/notifications/read-all');
    return body.updated ?? 0;
  }

  async listAccounts(): Promise<AdminAccount[]> {
    const body = await this.request<{ accounts: AdminAccount[] }>('GET', '/admin/accounts');
    return body.accounts ?? [];
  }

  async setAccountStatus(id: string, action: AccountStatusAction): Promise<AdminAccount> {
    const body = await this.request<{ account: AdminAccount }>(
      'POST',
      `/admin/accounts/${id}/${action}`,
    );
    return body.account;
  }

  // ── Invitations and tree membership (P2-3) ──────────────
  // Pure routing: every authorization decision lives in the server
  // (FORBIDDEN_TREE, TREE_LAST_OWNER_GUARD, INVITATION_* codes).

  async getInvitationInfo(token: string): Promise<InvitationContextInfo> {
    // Public endpoint; works with or without a session token.
    return this.request<InvitationContextInfo>('GET', `/invitations/${token}/info`);
  }

  async listInvitations(treeId: string): Promise<InvitationRecord[]> {
    const body = await this.request<{ invitations: InvitationRecord[] }>(
      'GET',
      `/trees/${treeId}/invitations`,
    );
    return body.invitations ?? [];
  }

  async createInvitation(treeId: string, input: CreateInvitationInput): Promise<CreatedInvitation> {
    const body = await this.request<{ invitation: CreatedInvitation }>(
      'POST',
      `/trees/${treeId}/invitations`,
      input,
    );
    return body.invitation;
  }

  async revokeInvitation(invitationId: string): Promise<InvitationRecord> {
    const body = await this.request<{ invitation: InvitationRecord }>(
      'POST',
      `/invitations/${invitationId}/revoke`,
    );
    return body.invitation;
  }

  // ── Share link management (S-05) ─────────────────────────
  // Pure routing: the server decides owner-only access and answers
  // FORBIDDEN_TREE / SHARE_LINK_* codes; the panel renders them verbatim.

  async listShareLinks(treeId: string): Promise<ShareLinkRecord[]> {
    const body = await this.request<{ shareLinks: ShareLinkRecord[] }>(
      'GET',
      `/trees/${treeId}/share-links`,
    );
    return body.shareLinks ?? [];
  }

  async revokeShareLink(linkId: string): Promise<ShareLinkRecord> {
    const body = await this.request<{ shareLink: ShareLinkRecord }>(
      'POST',
      `/share-links/${linkId}/revoke`,
    );
    return body.shareLink;
  }

  async listTreeMembership(treeId: string): Promise<TreeMembershipRecord[]> {
    const body = await this.request<{ members: TreeMembershipRecord[] }>(
      'GET',
      `/trees/${treeId}/membership`,
    );
    return body.members ?? [];
  }

  async updateTreeMembershipRole(
    treeId: string,
    membershipId: string,
    role: TreeRoleValue,
  ): Promise<TreeMembershipRecord> {
    const body = await this.request<{ membership: TreeMembershipRecord }>(
      'PUT',
      `/trees/${treeId}/membership/${membershipId}`,
      { role },
    );
    return body.membership;
  }

  async removeTreeMembership(treeId: string, membershipId: string): Promise<void> {
    await this.request<void>('DELETE', `/trees/${treeId}/membership/${membershipId}`);
  }

  // ── Activity feed (P2-6, ADR 0006) ─────────────────────
  // Read-only projection of the server event store. The server validates
  // ?type= against the event vocabulary, clamps ?limit= into 1..100
  // and treats ?before= as an opaque keyset cursor, so this method only
  // forwards what the caller picked in the UI.

  async fetchActivityFeed(options: ActivityFeedQueryOptions = {}): Promise<ActivityFeedPage> {
    const params = new URLSearchParams();
    if (options.type !== undefined && options.type !== '') params.set('type', options.type);
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.before !== undefined && options.before !== '') params.set('before', options.before);
    const query = params.toString();
    const body = await this.request<{ items: FeedItem[]; nextCursor: string | null }>(
      'GET',
      `/activity-feed${query === '' ? '' : `?${query}`}`,
    );
    return { items: body.items ?? [], nextCursor: body.nextCursor ?? null };
  }

  // ── Growth metrics (P2-8, ADR 0007) ────────────────────
  // Read-only owner dashboard. The server parses ?weeks= (integer, clamped
  // into 1..26, default 12), projects stored events server-side, and rounds
  // rates to 4 decimals, so the adapter only forwards the requested span.

  async fetchGrowthMetrics(options: GrowthMetricsQueryOptions = {}): Promise<GrowthMetricsSnapshot> {
    const params = new URLSearchParams();
    if (options.weeks !== undefined) params.set('weeks', String(options.weeks));
    const query = params.toString();
    return this.request<GrowthMetricsSnapshot>(
      'GET',
      `/admin/metrics/growth${query === '' ? '' : `?${query}`}`,
    );
  }

  // ── Upcoming anniversaries (v277 fase ii) ──────────────
  // Read-only routing to the server v275 endpoint. The server computes
  // everything (jendela days default 30, rentang 1..365) and returns
  // ready entries, so the adapter only forwards the optional query.
  // Network errors and non-OK responses propagate via this.request
  // without a local catch.

  async listUpcomingAnniversaries(treeId: string, days?: number): Promise<UpcomingAnniversaryDto[]> {
    const query = days === undefined ? '' : `?days=${encodeURIComponent(String(days))}`;
    return this.request<UpcomingAnniversaryDto[]>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/stats/anniversaries/upcoming${query}`,
    );
  }

  // ── Generations count (v285 fase iii) ──────────────────
  // Read-only routing to the server v284 aggregate endpoint. The server
  // computes the generation depth, so the adapter only carries the tree
  // id. Network errors and non-OK responses propagate via this.request
  // without a local catch.

  async getGenerationsCount(treeId: string): Promise<GenerationsCountDto> {
    return this.request<GenerationsCountDto>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/stats/generations`,
    );
  }

  // ── Family size stats (v289 fase iii) ──────────────────
  // Read-only routing to the server v288 aggregate endpoint. The server
  // computes the family size distribution, so the adapter only carries
  // the tree id. Network errors and non-OK responses propagate via
  // this.request without a local catch.

  async getFamilySizeStats(treeId: string): Promise<FamilySizeStatsDto> {
    return this.request<FamilySizeStatsDto>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/stats/family-size`,
    );
  }

  // Read-only routing ke endpoint agregat server v302. Server menghitung
  // peringkat oldest living, adapter hanya membawa tree id. Error jaringan
  // dan respons non-OK naik via this.request tanpa penangkap lokal,
  // pola persis getFamilySizeStats.

  async getOldestLiving(treeId: string): Promise<OldestLivingEntryDto[]> {
    return this.request<OldestLivingEntryDto[]>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/stats/oldest-living`,
    );
  }

  // Read-only routing ke endpoint peta sebaran place (v399). Server
  // mengagregasi sel 2 desimal murni {lat,lng,count}, adapter hanya
  // membawa tree id. Error jaringan dan respons non-OK naik via
  // this.request tanpa penangkap lokal, pola persis getOldestLiving.
  async getPlaceDistribution(treeId: string): Promise<PlaceDistributionDto> {
    return this.request<PlaceDistributionDto>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/places/distribution`,
    );
  }

  // ── Weekly digest (P2-7, ADR 0008) ─────────────────────
  // Pure routing: the server renders the preview from stored events and
  // guards the preferences column per caller. The adapter sends one
  // boolean and gets one boolean back.

  async fetchWeeklyDigestPreview(): Promise<DigestPreview> {
    return this.request<DigestPreview>('GET', '/digest/weekly');
  }

  async updateDigestPreferences(optIn: boolean): Promise<{ optIn: boolean }> {
    return this.request<{ optIn: boolean }>('PUT', '/digest/preferences', { optIn });
  }

  // ── Change review (P2-5, ADR 0009) ─────────────────────
  // Pure routing again: roles, the distinct fence and the accept
  // transaction all live in the server. The adapter carries the field
  // slice in and the formatted proposal out.

  async listChangeProposals(treeId: string): Promise<ChangeProposalPage> {
    return this.request<ChangeProposalPage>('GET', `/trees/${treeId}/change-proposals`);
  }

  async createChangeProposal(
    treeId: string,
    input: CreateChangeProposalInput,
  ): Promise<ChangeProposalRecord> {
    const body = await this.request<{ proposal: ChangeProposalRecord }>(
      'POST',
      `/trees/${treeId}/change-proposals`,
      input,
    );
    return body.proposal;
  }

  async acceptChangeProposal(proposalId: string): Promise<{ accepted: string }> {
    return this.request<{ accepted: string }>('POST', `/change-proposals/${proposalId}/accept`);
  }

  async rejectChangeProposal(proposalId: string, decisionNote: string): Promise<ChangeProposalRecord> {
    const body = await this.request<{ proposal: ChangeProposalRecord }>(
      'POST',
      `/change-proposals/${proposalId}/reject`,
      { decisionNote },
    );
    return body.proposal;
  }

  async distinctChangeProposal(proposalId: string, decisionNote?: string): Promise<ChangeProposalRecord> {
    const body = await this.request<{ proposal: ChangeProposalRecord }>(
      'POST',
      `/change-proposals/${proposalId}/distinct`,
      decisionNote === undefined || decisionNote === '' ? {} : { decisionNote },
    );
    return body.proposal;
  }

  // ── Duplicate check on member entry (v388) ─────────────
  // Non-blocking warning surface: one GET per submission attempt.
  async checkDuplicateCandidates(
    treeId: string,
    params: { name: string; birthDate?: string; marga?: string },
  ): Promise<{ candidates: DuplicateCandidateDto[] }> {
    const query = new URLSearchParams();
    query.set('name', params.name);
    if (params.birthDate) query.set('birthDate', params.birthDate);
    if (params.marga) query.set('marga', params.marga);
    return this.request<{ candidates: DuplicateCandidateDto[] }>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/members/duplicates?${query.toString()}`
    );
  }

  // ── Guided member merge (v390 fase 1) ──────────────────
  // One POST per execution; server holds the transaction. Errors come
  // back as 4xx { code, message } and are surfaced to the dialog inline.
  // v392: the server answers 202 NEEDS_APPROVAL when the merge is risky;
  // request() passes 2xx through, so the union result branches here and
  // the dialog shows the queued-for-approval state instead of silence.
  async mergeMember(
    treeId: string,
    duplicateId: string,
    params: { targetId: string; confirmName: string },
  ): Promise<MergeMemberResult> {
    const body = await this.request<{ merged: boolean; primaryId: string; approvalId?: string; status?: string; reasons?: MergeRiskReasonView[] }>(
      'POST',
      `/trees/${encodeURIComponent(treeId)}/members/${encodeURIComponent(duplicateId)}/merge`,
      { targetId: params.targetId, confirmName: params.confirmName },
    );
    if (body.merged) {
      return { merged: true, primaryId: body.primaryId };
    }
    return {
      merged: false,
      needsApproval: true,
      approvalId: body.approvalId ?? '',
      reasons: Array.isArray(body.reasons) ? body.reasons : [],
    };
  }

  // ── Un-merge from journal (v391 fase 1) ────────────────
  // One POST per execution; server reverses exactly from the merge
  // journal inside one transaction. 422 { code, message } when the
  // member is not merged, the merge predates the journal, or current
  // data no longer matches the journal.
  async unmergeMember(
    treeId: string,
    duplicateId: string,
  ): Promise<{ unmerged: boolean; duplicateId: string }> {
    return this.request<{ unmerged: boolean; duplicateId: string }>(
      'POST',
      `/trees/${encodeURIComponent(treeId)}/members/${encodeURIComponent(duplicateId)}/unmerge`,
    );
  }

  // ── Merge approvals (v392 AC6) ─────────────────────────
  // Queue listing for the Dashboard panel plus the approve/reject
  // decision calls; guard lives server-side (owner/editor other than
  // the requester), the panel only renders outcomes honestly.
  async listMergeApprovals(treeId: string, params?: { status?: string }): Promise<MergeApprovalRecord[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set('status', params.status);
    const qs = query.toString();
    const body = await this.request<{ approvals: MergeApprovalRecord[] }>(
      'GET',
      `/trees/${encodeURIComponent(treeId)}/merge-approvals${qs ? `?${qs}` : ''}`,
    );
    return Array.isArray(body.approvals) ? body.approvals : [];
  }

  async decideMergeApproval(
    treeId: string,
    approvalId: string,
    action: 'approve' | 'reject',
  ): Promise<MergeApprovalDecision> {
    return this.request<MergeApprovalDecision>(
      'POST',
      `/trees/${encodeURIComponent(treeId)}/merge-approvals/${encodeURIComponent(approvalId)}/${action}`,
    );
  }

  // ── Calendar feed token (v394 AC4/AC5) ─────────────────
  // Guard lives server-side (owner/editor); rotate returns the full token
  // exactly once, revoke sets the column null so the feed answers 404.
  async rotateCalendarToken(treeId: string): Promise<{ token: string }> {
    return this.request<{ token: string }>(
      'POST',
      `/trees/${encodeURIComponent(treeId)}/calendar-token/rotate`,
    );
  }

  async revokeCalendarToken(treeId: string): Promise<{ revoked: boolean }> {
    return this.request<{ revoked: boolean }>(
      'DELETE',
      `/trees/${encodeURIComponent(treeId)}/calendar-token`,
    );
  }

  // -- Member photo (v398 fase 1) --------------------------
  // Unggah multipart FormData (hindari limit express.json global), hapus
  // via DELETE, dan muat byte berotorisasi untuk object URL (elemen img
  // tidak bisa membawa header Authorization). Strip EXIF terjadi di
  // client sebelum bytes sampai di sini (AC2, canvas toBlob).
  async uploadMemberPhoto(
    memberId: string,
    bytes: Uint8Array,
    mime: 'image/jpeg' | 'image/png' | 'image/webp',
  ): Promise<MemberPhotoUploadResult> {
    const form = new FormData();
    form.append('photo', new Blob([bytes as BlobPart], { type: mime }), 'photo');
    const url = `${this.options.baseUrl}/members/${encodeURIComponent(memberId)}/photo`;
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    let res = await fetch(url, { method: 'POST', headers, body: form });
    if (res.status === 401 && this.options.onTokenRefresh) {
      const newToken = await this.options.onTokenRefresh();
      if (newToken) {
        this.token = newToken;
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, { method: 'POST', headers, body: form });
      }
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new AdapterError(err.message || res.statusText, err.code || 'API_ERROR', res.status);
    }
    return res.json();
  }

  async deleteMemberPhoto(memberId: string): Promise<{ ok: boolean; member: FamilyMemberRecord }> {
    return this.request<{ ok: boolean; member: FamilyMemberRecord }>(
      'DELETE',
      `/members/${encodeURIComponent(memberId)}/photo`,
    );
  }

  async fetchMemberPhoto(memberId: string): Promise<Uint8Array> {
    const url = `${this.options.baseUrl}/members/${encodeURIComponent(memberId)}/photo`;
    const headers: Record<string, string> = {};
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    let res = await fetch(url, { method: 'GET', headers });
    if (res.status === 401 && this.options.onTokenRefresh) {
      const newToken = await this.options.onTokenRefresh();
      if (newToken) {
        this.token = newToken;
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(url, { method: 'GET', headers });
      }
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new AdapterError(err.message || res.statusText, err.code || 'API_ERROR', res.status);
    }
    return new Uint8Array(await res.arrayBuffer());
  }

  // ── Member consent ledger (S-06c) ───────────────────────
  // Pure routing: the server replays the append-only ledger through the
  // pure reducer and guards tree access; invalid transitions come back as
  // 409 CONSENT_* codes that the modal renders inline.

  async getConsent(memberId: string): Promise<ConsentStateView> {
    const body = await this.request<ConsentStateView>('GET', `/members/${memberId}/consent`);
    return { records: body.records ?? [], granted: body.granted ?? false };
  }

  async postConsent(
    memberId: string,
    action: ConsentMutationResult['record']['action'],
    scope: string,
    note?: string,
  ): Promise<ConsentMutationResult> {
    const body = await this.request<ConsentMutationResult>('POST', `/members/${memberId}/consent`, {
      action,
      scope,
      ...(note === undefined ? {} : { note }),
    });
    return body;
  }

  // ── Consent self-service (v409) ────────────────────────
  // Subject data surface: pure routing ke route /consent/self v408-v409.
  // Bentuk respons dipagari minimal valid sama seperti jalur owner.

  async listSelfConsent(): Promise<SelfConsentOverview> {
    const body = await this.request<SelfConsentOverview>('GET', '/consent/self/members');
    return { members: Array.isArray(body.members) ? body.members : [] };
  }

  async getSelfConsent(memberId: string): Promise<ConsentStateView> {
    const body = await this.request<ConsentStateView>('GET', `/members/${memberId}/consent/self`);
    return { records: body.records ?? [], granted: body.granted ?? false };
  }

  async postSelfConsent(
    memberId: string,
    action: ConsentMutationResult['record']['action'],
    scope: string,
    note?: string,
  ): Promise<ConsentMutationResult> {
    const body = await this.request<ConsentMutationResult>('POST', `/members/${memberId}/consent/self`, {
      action,
      scope,
      ...(note === undefined ? {} : { note }),
    });
    return body;
  }

  // ── Citation surface (v155-iii-a) ───────────────────────
  // Pure routing ke route /api/v1 di belakang CitationApplyIO: pointer
  // dan spec diteruskan verbatim, bentuk return dipagari minimal valid,
  // dan kegagalan jaringan tidak pernah naik ke pemanggil.

  async upsertSource(treeId: string, pointer: string): Promise<string> {
    try {
      const body = await this.request<{ id: string }>('PUT', `/trees/${treeId}/sources/upsert`, { pointer });
      return typeof body?.id === 'string' ? body.id : '';
    } catch {
      return '';
    }
  }

  async upsertCitation(treeId: string, spec: CitationSpec): Promise<string | void> {
    try {
      const body = await this.request<{ id?: string }>('PUT', `/trees/${treeId}/citations/upsert`, spec);
      return typeof body?.id === 'string' ? body.id : undefined;
    } catch {
      return undefined;
    }
  }

  async upsertLifeEvent(
    treeId: string,
    memberId: string,
    eventType: CitationEventType,
    partnerMemberId?: string,
    citationId?: string,
  ): Promise<string> {
    try {
      const body = await this.request<{ id: string }>('PUT', `/trees/${treeId}/life-events/upsert`, {
        memberId,
        eventType,
        ...(partnerMemberId === undefined ? {} : { partnerMemberId }),
        ...(citationId === undefined ? {} : { citationId }),
      });
      return typeof body?.id === 'string' ? body.id : '';
    } catch {
      return '';
    }
  }
}
