// ===== Data Adapter Interface =====
// Database-agnostic contract. Implement this interface for any backend.
// Current adapters: mock (in-memory), rest (generic API), supabase

// ─── Auth Types ───────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  familyName?: string;
  avatar?: string;
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
