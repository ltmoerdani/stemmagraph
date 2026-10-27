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
  /** The caller's role on this tree (P2-5): null on adapters without one. */
  role?: TreeRoleValue | null;
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
  marga?: string;
  birthDate: string;
  deathDate?: string;
  /** GEDCOM-aligned optional columns (v116-ii): JSON of GenealogicalDate. */
  birthDateGed?: string;
  deathDateGed?: string;
  birthPlace?: string;
  currentLocation?: string;
  profession?: string;
  education?: string;
  gender: 'male' | 'female' | 'other';
  /** GEDCOM 7 SEX payload verbatim (v262): M/F/X/U atau nilai non-enum dari sumber. */
  sexGed?: string;
  /** ASSO asosiasi antar individu hasil import GEDCOM (v405), verbatim; undefined bila nihil. */
  associations?: unknown[];
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
  marga?: string;
  gender: 'male' | 'female' | 'other';
  /** GEDCOM 7 SEX payload verbatim (v262), opsional; fallback tetap dari gender. */
  sexGed?: string;
  birthDate: string;
  birthPlace?: string;
  isAlive?: boolean;
  deathDate?: string;
  generation?: number;
  maritalStatus?: 'single' | 'married' | 'divorced' | 'widowed';
  privacyStatus?: 'shared' | 'private';
  /** ASSO asosiasi verbatim hasil import GEDCOM (v405); undefined bila nihil. */
  associations?: unknown[];
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

// ─── Share link management (S-05, ADR 0010) ──────────────

/**
 * One row of the owner's share link list. The token only ever appears
 * masked (tokenMasked); the server never sends the full value.
 */
export interface ShareLinkRecord {
  id: string;
  treeId: string;
  mode: string;
  state: 'active' | 'revoked';
  tokenMasked: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

/**
 * Server-backed share link surface (owner only). Only the REST adapter
 * implements it; getShareLinkAdminApi returns null for the others so
 * the panel shows an honest unavailable state.
 */
export interface ShareLinkAdminApi {
  listShareLinks(treeId: string): Promise<ShareLinkRecord[]>;
  revokeShareLink(linkId: string): Promise<ShareLinkRecord>;
}

// ─── Activity feed (P2-6, ADR 0006) ──────────────────────

/** One page of the activity feed plus the cursor for the next page. */
export interface ActivityFeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

/** Query options; every field is optional and re-validated server side. */
export interface ActivityFeedQueryOptions {
  /** One of the event types in the vocabulary; absent means no filter. */
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

// ─── Weekly digest (P2-7, ADR 0008) ───────────────────────
// Server-backed user settings surface. Only the REST adapter implements
// it: the digest reads the server event store, which mock and supabase
// adapters do not have. getDigestApi returns null for them so the UI can
// hide the digest panel instead of crashing or faking a toggle.

/** Preview of the digest the caller would receive for the last complete ISO week. */
export interface DigestPreview {
  window: { startAt: string; endAt: string };
  /** Current consent switch; the preview renders even when false. */
  optIn: boolean;
  /** True when nothing happened on the caller's trees last week. */
  empty: boolean;
  subject: string | null;
  body: string | null;
}

export interface DigestApi {
  /** GET /digest/weekly: look before you switch on. */
  fetchWeeklyDigestPreview(): Promise<DigestPreview>;
  /** PUT /digest/preferences: flips only the caller's own optIn column. */
  updateDigestPreferences(optIn: boolean): Promise<{ optIn: boolean }>;
}

// ─── Change review (P2-5, ADR 0009) ──────────────────────

export type ChangeTargetTypeValue = 'member' | 'relationship';
export type ChangeProposalState = 'pending' | 'rejected' | 'distinct';

/**
 * One proposal as the server formats it: before/after are the frozen
 * proposal-field slices (never ids-only and never the full record), and
 * an accepted proposal is consumed, so it stops appearing here.
 */
export interface ChangeProposalRecord {
  id: string;
  treeId: string;
  proposerUserId: string;
  targetType: ChangeTargetTypeValue;
  targetId: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  state: ChangeProposalState;
  reasonNote: string;
  autoAccepted: boolean;
  decidedByUserId: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateChangeProposalInput {
  targetType: ChangeTargetTypeValue;
  targetId: string;
  /** Proposal-field slice only; the server re-validates the contract. */
  afterJson: Record<string, unknown>;
  /** 3..500 chars, required so the owner never reviews a mute edit. */
  reasonNote: string;
}

/** The caller's role comes back with the list: owner sees all, editor own. */
export interface ChangeProposalPage {
  role: TreeRoleValue;
  proposals: ChangeProposalRecord[];
}

/**
 * Server-backed change-review surface. Only the REST adapter implements
 * it: the queue lives in the ChangeProposal table behind the API. The UI
 * hides every change-review surface for null (mock, supabase) instead of
 * crashing, and viewers are refused by the server with 403 anyway.
 */
export interface ChangeReviewApi {
  listChangeProposals(treeId: string): Promise<ChangeProposalPage>;
  createChangeProposal(treeId: string, input: CreateChangeProposalInput): Promise<ChangeProposalRecord>;
  acceptChangeProposal(proposalId: string): Promise<{ accepted: string }>;
  rejectChangeProposal(proposalId: string, decisionNote: string): Promise<ChangeProposalRecord>;
  distinctChangeProposal(proposalId: string, decisionNote?: string): Promise<ChangeProposalRecord>;
}

// ─── Member consent ledger (S-06c) ──────────────────────
// Read-write per-member surface. Only the REST adapter implements it: the
// append-only ledger lives in the ConsentRecord table behind the API. The
// UI renders the history read-only and offers Grant/Revoke actions; mock
// and supabase adapters get null from getConsentApi and hide the section.

/** One ledger row as the server returns it (chronological ascending). */
export interface ConsentRecordView {
  id: string;
  memberId: string;
  action: 'grant' | 'revoke' | 'regrant';
  scope: string;
  note: string | null;
  at: string;
}

/** Whole GET response: replayed rows plus the current granted flag. */
export interface ConsentStateView {
  records: ConsentRecordView[];
  granted: boolean;
}

/** Whole 201 response of a successful POST. */
export interface ConsentMutationResult {
  record: ConsentRecordView;
  granted: boolean;
  privacyStatus: 'shared' | 'private';
}

export interface ConsentApi {
  /** GET /members/:memberId/consent: replayed ledger, oldest first. */
  getConsent(memberId: string): Promise<ConsentStateView>;
  /** POST /members/:memberId/consent: append one grant/revoke/regrant row. */
  postConsent(memberId: string, action: ConsentRecordView['action'], scope: string, note?: string): Promise<ConsentMutationResult>;
}

/** One row of the self-service overview (v409 AC1): members matching the
 *  logged-in user email, with current consent state per member. */
export interface SelfConsentEntry {
  memberId: string;
  treeId: string;
  treeName: string;
  granted: boolean;
  lastAction: ConsentRecordView['action'] | null;
  lastAt: string | null;
}

/** Whole GET /consent/self/members response (v409 AC1). */
export interface SelfConsentOverview {
  members: SelfConsentEntry[];
}

/** Self-service consent surface (v409 AC3). Only the REST adapter
 *  implements it: the subject data routes go behind /api/v1 like the owner
 *  surface. Mock and supabase adapters get null from getConsentSelfApi and
 *  the panel hides. */
export interface ConsentSelfApi {
  /** GET /consent/self/members: list of self members plus consent state. */
  listSelfConsent(): Promise<SelfConsentOverview>;
  /** GET /members/:memberId/consent/self: replayed ledger, oldest first. */
  getSelfConsent(memberId: string): Promise<ConsentStateView>;
  /** GET /members/:memberId/consent/self/events (v411): full ledger rows, oldest first. */
  getSelfConsentEvents(memberId: string): Promise<{ records: ConsentRecordView[] }>;
  /** POST /members/:memberId/consent/self: append one grant/revoke/regrant row as the data subject. */
  postSelfConsent(memberId: string, action: ConsentRecordView['action'], scope: string, note?: string): Promise<ConsentMutationResult>;
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

// ─── Citation surface (v155-iii-a) ────────────────────────
// Server-backed citation surface for the GEDCOM import pipeline. Only the
// REST adapter implements it; mock and supabase adapters get null from
// getCitationApi so the import UI skips citation wiring instead of
// crashing. Kontraknya mengikuti CitationApplyIO di citationApply.ts.

/** Jenis event pemilik sitasi, selaras dengan kosakata event GEDCOM. */
export type CitationEventType = 'BIRTH' | 'DEATH' | 'MARRIAGE' | 'DIVORCE';

/** Satu spesifikasi sitasi yang dikirim ke server saat upsert. */
export interface CitationSpec {
  sourceId: string;
  sourcePointer: string;
  page: string | undefined;
  quay: string | undefined;
  note: string | undefined;
  eventType: CitationEventType;
  memberId: string;
  partnerMemberId: string | undefined;
}

/**
 * Permukaan sitasi ala AccountAdminApi: API berdiri sendiri, tidak
 * menambah apa pun ke DataAdapter. Implementasi tidak pernah melempar
 * pada kegagalan jaringan; pemanggil menerima bentuk kosong yang valid.
 */
export interface CitationApi {
  /** Upsert satu sumber dan kembalikan id-nya; pointer diteruskan verbatim. */
  upsertSource(treeId: string, pointer: string): Promise<string>;
  /** Upsert satu sitasi; id dikembalikan, void saat server melewatkannya. */
  upsertCitation(treeId: string, spec: CitationSpec): Promise<string | void>;
  /** Upsert LifeEvent minimal agar sitasi punya event pemilik. */
  upsertLifeEvent(
    treeId: string,
    memberId: string,
    eventType: CitationEventType,
    partnerMemberId?: string,
    citationId?: string,
  ): Promise<string>;
}

// ─── Upcoming anniversaries (v277 fase ii) ────────────────
// Server-backed read-only surface for upcoming wedding anniversaries.
// Data lives behind GET /api/v1/trees/:treeId/stats/anniversaries/upcoming
// (server v275). Only the REST adapter implements it; mock and supabase
// adapters get null from getStatsApi so the sidebar skips the section
// instead of computing from client store. DTO didefinisikan lokal;
// berkas ini dilarang meng-import tipe dari src/lib/stats.

/** Satu baris peringatan pernikahan dari server, sudah jadi dan terurut. */
export interface UpcomingAnniversaryDto {
  /** Id pasangan stabil, dua memberId terurut leksikal dipisah titik dua. */
  pairId: string;
  /** Nama kedua pasangan, urutan mengikuti pasangan pada server. */
  partnerNames: [string, string];
  /** Tanggal pernikahan asli, format YYYY-MM-DD. */
  marriageDate: string;
  /** Peringatan berikutnya terdekat, format YYYY-MM-DD. */
  nextAnniversary: string;
  /** Hari menuju peringatan berikutnya, 0 berarti hari ini. */
  daysUntil: number;
  /** Jumlah tahun pernikahan yang dirayakan. */
  yearsMarried: number;
}

/**
 * Agregat jumlah generasi satu pohon dari endpoint stats/generations
 * server v284. Non-PII: respons hanya memuat satu angka.
 */
export interface GenerationsCountDto {
  /** Jumlah generasi pada pohon, 0 bila belum ada relasi keluarga. */
  generationCount: number;
}

/**
 * Agregat ukuran keluarga satu pohon dari endpoint stats/family-size
 * server v288. Non-PII: hanya angka agregat dan bucket distribusi.
 */
export interface FamilySizeStatsDto {
  average: number | null;
  median: number | null;
  max: number;
  distribution: {
    zero: number;
    oneToTwo: number;
    threeToFour: number;
    fivePlus: number;
  };
  familyCount: number;
  excludedCount: number;
}

/**
 * Permukaan statistik server ala ActivityFeedApi: API berdiri sendiri,
 * tidak menambah apa pun ke DataAdapter. Implementasi membiarkan error
 * jaringan atau respons non-OK naik ke pemanggil tanpa penangkap.
 */
export interface StatsApi {
  /** Ambil daftar peringatan pernikakan mendatang; days opsional, default server 30. */
  listUpcomingAnniversaries(treeId: string, days?: number): Promise<UpcomingAnniversaryDto[]>;
  /** Ambil agregat jumlah generasi pohon; read-only, respons non-PII satu angka. */
  getGenerationsCount(treeId: string): Promise<GenerationsCountDto>;
  /** Ambil agregat ukuran keluarga pohon; read-only, non-PII, average dan median null bila nihil keluarga. */
  getFamilySizeStats(treeId: string): Promise<FamilySizeStatsDto>;
  /** Ambil peringkat anggota hidup tertua pohon; read-only, non-PII: id dan ageYears tanpa nama. */
  getOldestLiving(treeId: string): Promise<OldestLivingEntryDto[]>;
  /** Ambil titik agregat peta sebaran place (v399); read-only, non-PII murni lat/lng/count. */
  getPlaceDistribution(treeId: string): Promise<PlaceDistributionDto>;
  /** Ambil agregat sebaran negara/wilayah (v413); read-only, non-PII, lolos suppression k=3 di server. */
  getFamilyDistribution(treeId: string): Promise<FamilyDistributionDto>;
}

/**
 * Titik agregat peta sebaran place (v399). Non-PII: pembulatan 2
 * desimal, tanpa nama place, tanpa identitas anggota.
 */
export interface PlaceDistributionPointDto {
  lat: number;
  lng: number;
  count: number;
}

/**
 * Payload route places/distribution (v399): titik agregat murni plus
 * dua hitungan audit non-identitas.
 */
export interface PlaceDistributionDto {
  points: PlaceDistributionPointDto[];
  totalPlaced: number;
  excludedNoCoords: number;
}

// ─── Family distribution (v413 fase 1) ───────────────────
// Agregat sebaran anggota per negara dan wilayah admin dari endpoint
// stats/distribution server v413. Non-PII: hanya nama negara dan
// wilayah hasil generalisasi dua level plus hitungan yang lolos
// suppression k-anonymity k = 3 di server; tanpa koordinat, tanpa
// nama place presisi, tanpa identitas anggota.

/** Baris wilayah admin di bawah satu negara, count sudah lolos ambang k. */
export interface FamilyDistributionRegionDto {
  /** Nama wilayah hasil token sebelum negara, lowercase. */
  region: string;
  /** Jumlah anggota pada wilayah ini setelah suppression. */
  count: number;
}

/** Baris negara beserta wilayah-wilayahnya yang lolos ambang k. */
export interface FamilyDistributionCountryDto {
  /** Nama negara hasil token terakhir setelah koma, lowercase. */
  country: string;
  /** Jumlah anggota pada negara ini setelah suppression. */
  count: number;
  /** Wilayah pada negara ini yang count-nya memenuhi ambang k. */
  regions: FamilyDistributionRegionDto[];
}

/**
 * Payload route stats/distribution (v413): hierarki negara lalu wilayah
 * plus dua hitungan audit agregat yang boleh tampil tanpa suppression.
 */
export interface FamilyDistributionDto {
  countries: FamilyDistributionCountryDto[];
  totalWithPlace: number;
  excludedNoPlace: number;
}

/** Kandidat duplikat anggota existing untuk satu calon anggota baru (v388). */
export interface DuplicateCandidateDto {
  memberId: string;
  score: number;
  reasons: string[];
}

/**
 * Permukaan cek duplikat saat entri anggota (v388): API berdiri sendiri
 * ala StatsApi, read-only. Adapter tanpa server (mock, supabase) lewat
 * getDuplicateCheckApi mendapat null dan UI melompati pemeriksaan.
 */
export interface DuplicateCheckApi {
  /** Bandingkan satu calon anggota dengan anggota existing tree; name wajib, birthDate dan marga opsional. */
  checkDuplicateCandidates(
    treeId: string,
    params: { name: string; birthDate?: string; marga?: string },
  ): Promise<{ candidates: DuplicateCandidateDto[] }>;
}

/**
 * Permukaan merge anggota terpandu (v390 fase 1): satu POST per eksekusi
 * dengan konfirmasi nama primary. Adapter tanpa server (mock, supabase)
 * lewat getMergeApi mendapat null dan UI menyembunyikan aksi merge.
 */
export interface MergeApi {
  /** Gabungkan anggota duplikat (duplicateId) ke primary; confirmName wajib cocok nama primary. */
  mergeMember(
    treeId: string,
    duplicateId: string,
    params: { targetId: string; confirmName: string },
  ): Promise<MergeMemberResult>;
  /** Balikkan merge dari jurnal (v391); 422 bila belum merged, tanpa jurnal, atau state tak cocok. */
  unmergeMember(treeId: string, duplicateId: string): Promise<{ unmerged: boolean; duplicateId: string }>;
  /** Daftar approval merge tree (v392 AC6); status opsional untuk saring PENDING. */
  listMergeApprovals(treeId: string, params?: { status?: string }): Promise<MergeApprovalRecord[]>;
  /** Putuskan approval: approve mengeksekusi merge, reject nihil eksekusi. */
  decideMergeApproval(
    treeId: string,
    approvalId: string,
    action: 'approve' | 'reject',
  ): Promise<MergeApprovalDecision>;
}

/** Hasil merge v392: 200 merged langsung, atau 202 antrian persetujuan berisi reasons. */
export type MergeMemberResult =
  | { merged: true; primaryId: string }
  | { merged: false; needsApproval: true; approvalId: string; reasons: MergeRiskReasonView[] };

/** Satu alasan merge berisiko (v392), tampil di dialog dan panel approval. */
export interface MergeRiskReasonView {
  code: 'RELATION_REWIRE' | 'RELATION_DELETE' | 'FACTS_MOVED' | 'GENERATION_BOTH_CONNECTED';
  actual: number;
  threshold: number;
}

/** Baris approval merge (v392 AC6) dari GET merge-approvals. */
export interface MergeApprovalRecord {
  id: string;
  treeId: string;
  primaryId: string;
  duplicateId: string;
  reasons: MergeRiskReasonView[];
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED';
  requesterId: string;
  deciderId: string | null;
  createdAt: string;
  decidedAt: string | null;
  expiresAt: string;
}

/** Hasil keputusan approval (approve = EXECUTED, reject = REJECTED). */
export interface MergeApprovalDecision {
  approvalId: string;
  status: 'EXECUTED' | 'REJECTED';
  deciderId: string;
  decidedAt: string;
  primaryId?: string;
}

/** Permukaan token feed ICS kalender keluarga (v394 AC5). */
export interface CalendarFeedApi {
  /** Buat token baru (token lama mati); token penuh hanya ada di respons ini. */
  rotateCalendarToken(treeId: string): Promise<{ token: string }>;
  /** Cabut token feed (set null); feed menjawab 404 setelah revoke. */
  revokeCalendarToken(treeId: string): Promise<{ revoked: boolean }>;
}

/** Hasil unggah foto anggota (v398). */
export interface MemberPhotoUploadResult {
  ok: boolean;
  photoUrl: string;
  member: FamilyMemberRecord;
}

/** Permukaan foto anggota (v398): unggah dan hapus foto profil. */
export interface MemberPhotoApi {
  /**
   * Unggah foto anggota. bytes WAJIB hasil re-encode canvas (AC2: strip
   * metadata EXIF termasuk GPS terjadi di client sebelum kirim).
   */
  uploadMemberPhoto(memberId: string, bytes: Uint8Array, mime: 'image/jpeg' | 'image/png' | 'image/webp'): Promise<MemberPhotoUploadResult>;
  /** Hapus foto anggota (file fisik + kolom photoUrl dikosongkan). */
  deleteMemberPhoto(memberId: string): Promise<{ ok: boolean; member: FamilyMemberRecord }>;
  /**
   * Muat byte foto berotorisasi untuk dirender via object URL (elemen img
   * tidak bisa membawa header Authorization, sehingga sajian berotorisasi
   * dilakukan lewat fetch + blob).
   */
  fetchMemberPhoto(memberId: string): Promise<Uint8Array>;
}

// --- Member comments (v416) -------------------------------
// Read-write comment surface on one member. Only the REST adapter
// implements it: comments live in the Comment table behind the API. Mock
// and supabase adapters get null from getCommentApi and the comment
// section hides instead of crashing.

/** One comment row as the server returns it. */
export interface CommentItem {
  id: string;
  memberId: string;
  userId: string;
  userName?: string;
  body: string;
  createdAt: string;
}

/** Paginated comment surface for one member, cursor style. */
export interface CommentApi {
  /** GET /members/:memberId/comments: one page plus nextCursor. */
  listComments(memberId: string, after?: string): Promise<{ comments: CommentItem[]; nextCursor: string | null }>;
  /** POST /members/:memberId/comments: append one comment. */
  postComment(memberId: string, body: string): Promise<{ comment: CommentItem }>;
  /** DELETE /comments/:commentId: remove one comment. */
  deleteComment(commentId: string): Promise<void>;
}
