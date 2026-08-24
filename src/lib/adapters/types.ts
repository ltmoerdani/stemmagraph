// ===== Data Adapter Interface =====
// Database-agnostic contract. Implement this interface for any backend.
// Current adapters: mock (in-memory), rest (generic API), supabase

import type { FeedItem } from '../feed';

// ─── Auth Types ───────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  familyName?: string;
  avatar?: string;
  /** Account state from the server (ADR 0002). Absent on adapters without accounts. */
  status?: 'pending' | 'active' | 'disabled';
  /** Installation-level role from the server. Absent on adapters without accounts. */
  role?: 'owner' | 'member';
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser;
  token?: string;
  expiresAt?: string;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  familyName?: string;
  /** Invitation token from a /register?invite= link (P2-3, optional). */
  invitationToken?: string;
}

// ─── Family Tree Types ────────────────────────────────────

export interface FamilyTreeRecord {
  id: string;
  name: string;
  description?: string;
  memberCount: number;
  generationCount: number;
  lastUpdated: string;
  createdAt: string;
  thumbnail?: string;
}

export interface CreateTreeInput {
  name: string;
  description?: string;
}

// ─── Family Member Types ──────────────────────────────────

export interface FamilyMemberRecord {
  id: string;
  treeId: string;
  name: string;
  nickname?: string;
  birthDate: string;
  deathDate?: string;
  birthPlace?: string;
  currentLocation?: string;
  profession?: string;
  education?: string;
  gender: 'male' | 'female' | 'other';
  photoUrl?: string;
  email?: string;
  phone?: string;
  isAlive: boolean;
  // Per-individual sharing consent (S-06 Wave 1). "shared" exports the
  // member in full even while living; "private" redacts them. Undefined
  // (or NULL at the database level) means not yet recorded and the
  // export privacy gate redacts living members by default.
  privacyStatus?: 'shared' | 'private';
  generation: number;
  maritalStatus: 'single' | 'married' | 'divorced' | 'widowed';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateMemberInput {
  name: string;
  nickname?: string;
  gender: 'male' | 'female' | 'other';
  birthDate: string;
  birthPlace?: string;
  isAlive?: boolean;
  deathDate?: string;
  generation?: number;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
}

export interface MemberRelationship {
  id: string;
  treeId: string;
  memberId: string;
  relatedId: string;
  type: 'spouse' | 'parent' | 'child' | 'sibling';
}

// ─── Data Adapter Interface ───────────────────────────────

export interface DataAdapter {
  /** Unique identifier for this adapter */
  readonly name: string;
  /** Semantic version of the adapter implementation */
  readonly version: string;
  /** One-line description */
  readonly description: string;

  // ── Auth ──
  login(credentials: AuthCredentials): Promise<AuthSession>;
  register(input: RegisterInput): Promise<AuthSession>;
  logout(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  refreshSession(): Promise<AuthSession | null>;

  // ── Family Trees ──
  listTrees(): Promise<FamilyTreeRecord[]>;
  getTree(id: string): Promise<FamilyTreeRecord | null>;
  createTree(input: CreateTreeInput): Promise<FamilyTreeRecord>;
  updateTree(id: string, data: Partial<FamilyTreeRecord>): Promise<FamilyTreeRecord>;
  deleteTree(id: string): Promise<void>;

  // ── Family Members ──
  listMembers(treeId: string): Promise<FamilyMemberRecord[]>;
  getMember(id: string): Promise<FamilyMemberRecord | null>;
  createMember(treeId: string, input: CreateMemberInput): Promise<FamilyMemberRecord>;
  updateMember(id: string, data: Partial<FamilyMemberRecord>): Promise<FamilyMemberRecord>;
  deleteMember(id: string): Promise<void>;

  // ── Relationships ──
  listRelationships(treeId: string): Promise<MemberRelationship[]>;
  createRelationship(treeId: string, memberId: string, relatedId: string, type: MemberRelationship['type']): Promise<MemberRelationship>;
  deleteRelationship(id: string): Promise<void>;
}

// ─── Account Administration (P2-1) ────────────────────────
// Server-backed adapters (rest) implement this surface; mock and supabase
// adapters do not, and `getAccountAdminApi` returns null for them so the UI
// can hide the admin panel and notification menu instead of crashing.

export type AdminAccountStatus = 'pending' | 'active' | 'disabled';
export type AdminAccountRole = 'owner' | 'member';
export type AccountStatusAction = 'activate' | 'disable' | 'enable';

export interface AdminAccount {
  id: string;
  email: string;
  name: string;
  familyName: string | null;
  avatar: string | null;
  role: AdminAccountRole;
  status: AdminAccountStatus;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationsPage {
  notifications: AppNotification[];
  unreadCount: number;
}

export interface AccountAdminApi {
  listNotifications(): Promise<NotificationsPage>;
  markNotificationRead(id: string): Promise<AppNotification>;
  markAllNotificationsRead(): Promise<number>;
  listAccounts(): Promise<AdminAccount[]>;
  setAccountStatus(id: string, action: AccountStatusAction): Promise<AdminAccount>;
}

// ─── Invitations and tree membership (P2-3) ───────────────
// Server-backed adapters (rest) implement this surface; mock and supabase
// adapters do not, and `getInvitationAdminApi` returns null for them so the
// UI can hide the invitations panel instead of crashing.

/** Public, PII-minimal context a registration link carries (GET /invitations/:token/info). */
export interface InvitationContextInfo {
  type: 'personal' | 'family';
  treeName: string;
  inviterName: string;
  expiresAt: string;
  remainingUses: number;
}

export type InvitationState = 'active' | 'expired' | 'exhausted' | 'revoked' | 'consumed';
export type InvitationTypeValue = 'personal' | 'family';
export type InvitationChannel = 'manual' | 'wa' | 'email';
export type TreeRoleValue = 'owner' | 'editor' | 'viewer';

/** Invitation as shown on every surface after creation: token masked. */
export interface InvitationRecord {
  id: string;
  treeId: string;
  type: InvitationTypeValue;
  grantedRole: TreeRoleValue;
  channel: string | null;
  state: InvitationState;
  failureCode: string | null;
  usedCount: number;
  maxUses: number;
  remainingUses: number;
  tokenMasked: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

/** Creation response: the only surface where the full token and URL appear. */
export interface CreatedInvitation extends InvitationRecord {
  token: string;
  url: string;
}

export interface CreateInvitationInput {
  type: InvitationTypeValue;
  grantedRole: TreeRoleValue;
  channel?: InvitationChannel;
  /** Family invitations only; the server clamps it to 1..100 (default 20). */
  maxUses?: number;
}

/** A user's membership row on one tree, with display columns for owners. */
export interface TreeMembershipRecord {
  id: string;
  treeId: string;
  userId: string;
  role: TreeRoleValue;
  email: string;
  name: string;
  userStatus: string;
  createdAt: string;
}

export interface InvitationAdminApi {
  /** Public fetch, no session needed; throws AdapterError on 404/410 dead links. */
  getInvitationInfo(token: string): Promise<InvitationContextInfo>;
  listInvitations(treeId: string): Promise<InvitationRecord[]>;
  createInvitation(treeId: string, input: CreateInvitationInput): Promise<CreatedInvitation>;
  revokeInvitation(invitationId: string): Promise<InvitationRecord>;
  listTreeMembership(treeId: string): Promise<TreeMembershipRecord[]>;
  updateTreeMembershipRole(treeId: string, membershipId: string, role: TreeRoleValue): Promise<TreeMembershipRecord>;
  removeTreeMembership(treeId: string, membershipId: string): Promise<void>;
}

// ─── Activity feed (P2-6, ADR 0006) ──────────────────────

/** One page of the activity feed plus the cursor for the next page. */
export interface ActivityFeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

/** Query options; every field is optional and re-validated server side. */
export interface ActivityFeedQueryOptions {
  /** One of the seven v1 event types; absent means no filter. */
  type?: string;
  /** Server clamps into 1..100, default 50. */
  limit?: number;
  /** Opaque cursor from a previous response's nextCursor. */
  before?: string;
}

/**
 * Server-backed activity feed surface (read-only). Only the REST adapter
 * implements it: the feed reads the server event store, which mock and
 * supabase adapters do not have. getActivityFeedApi returns null for them
 * so the UI can show an honest unavailable state instead of crashing.
 */
export interface ActivityFeedApi {
  fetchActivityFeed(options?: ActivityFeedQueryOptions): Promise<ActivityFeedPage>;
}

// ─── Growth metrics (P2-8) ────────────────────────────────
// Server-backed owner dashboard surface (read-only). Only the REST adapter
// implements it: the metrics read the server event store, which mock and
// supabase adapters do not have. getGrowthMetricsApi returns null for them
// so the UI can show an honest unavailable state instead of fake numbers.

/** One projected ISO week; rates arrive rounded to 4 decimals by the server. */
export interface GrowthWeekMetrics {
  isoWeek: string;
  startAt: string;
  endAt: string;
  e1: number;
  e2: number;
  e3: number;
  k: number;
  pakaiRate: number;
  aktivasiRate: number;
  denominator: number;
}

/** Whole response of GET /admin/metrics/growth. */
export interface GrowthMetricsSnapshot {
  weeks: GrowthWeekMetrics[];
  treesWithActiveEditorPct: number;
}

export interface GrowthMetricsQueryOptions {
  /** Server clamps into 1..26, default 12. */
  weeks?: number;
}

export interface GrowthMetricsApi {
  fetchGrowthMetrics(options?: GrowthMetricsQueryOptions): Promise<GrowthMetricsSnapshot>;
}

// ─── Error Types ──────────────────────────────────────────

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}

export class AuthError extends AdapterError {
  constructor(message: string, code = 'AUTH_ERROR', statusCode?: number) {
    super(message, code, statusCode);
    this.name = 'AuthError';
  }
}

export class NotFoundError extends AdapterError {
  constructor(message: string, code = 'NOT_FOUND') {
    super(message, code, 404);
    this.name = 'NotFoundError';
  }
}
