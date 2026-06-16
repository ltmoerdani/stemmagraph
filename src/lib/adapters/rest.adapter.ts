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
  AdapterError,
} from './types';

interface RestAdapterOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  /** Called on 401 — return a new token (or null to force re-login) */
  onTokenRefresh?: () => Promise<string | null>;
}

export class RestAdapter implements DataAdapter {
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
    const session = await this.request<AuthSession>('POST', '/auth/login', credentials);
    this.token = session.token ?? null;
    return session;
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const session = await this.request<AuthSession>('POST', '/auth/register', input);
    this.token = session.token ?? null;
    return session;
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
}
