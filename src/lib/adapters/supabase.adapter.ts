// ===== Supabase Adapter =====
// Adapter for Supabase backend (managed PostgreSQL).
// Requires: @supabase/supabase-js (already in package.json)
//
// Env vars:
//   VITE_SUPABASE_URL      — Your Supabase project URL
//   VITE_SUPABASE_ANON_KEY — Your Supabase anon/public key
//
// Tables expected:
//   family_trees         (id, name, description, member_count, generation_count, ...)
//   family_members       (id, tree_id, name, gender, birth_date, ...)
//   family_relationships (id, tree_id, member_id, related_id, type)

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  AuthError,
} from './types';

function toCamel(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const camelKey = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camelKey] = value;
  }
  return out;
}

function toSnake(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    const snakeKey = key.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
    out[snakeKey] = value;
  }
  return out;
}

export class SupabaseAdapter implements DataAdapter {
  readonly name = 'supabase';
  readonly version = '1.0.0';
  readonly description = 'Supabase adapter (managed PostgreSQL + Auth)';

  private client: SupabaseClient;

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    this.client = createClient(supabaseUrl, supabaseAnonKey);
  }

  // ── Auth (delegates to Supabase Auth) ───────────────────

  async login({ email, password }: AuthCredentials): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw new AuthError(error.message, error.code ?? 'AUTH_ERROR', error.status);
    return {
      user: {
        id: data.user!.id,
        email: data.user!.email!,
        name: data.user!.user_metadata?.name ?? email,
        createdAt: data.user!.created_at,
      },
      token: data.session?.access_token,
      expiresAt: data.session?.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : undefined,
    };
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const { data, error } = await this.client.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          family_name: input.familyName,
        },
      },
    });
    if (error) throw new AuthError(error.message, error.code ?? 'AUTH_ERROR', error.status);
    return {
      user: {
        id: data.user!.id,
        email: data.user!.email!,
        name: input.name,
        familyName: input.familyName,
        createdAt: data.user!.created_at,
      },
      token: data.session?.access_token,
    };
  }

  async logout(): Promise<void> {
    await this.client.auth.signOut();
  }

  async getSession(): Promise<AuthSession | null> {
    const { data } = await this.client.auth.getSession();
    if (!data.session) return null;
    return {
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
        name: data.session.user.user_metadata?.name ?? '',
        createdAt: data.session.user.created_at,
      },
      token: data.session.access_token,
      expiresAt: data.session.expires_at ? new Date(data.session.expires_at * 1000).toISOString() : undefined,
    };
  }

  async refreshSession(): Promise<AuthSession | null> {
    const { data } = await this.client.auth.refreshSession();
    if (!data.session) return null;
    return {
      user: {
        id: data.session.user.id,
        email: data.session.user.email!,
        name: data.session.user.user_metadata?.name ?? '',
        createdAt: data.session.user.created_at,
      },
      token: data.session.access_token,
    };
  }

  // ── Family Trees ────────────────────────────────────────

  async listTrees(): Promise<FamilyTreeRecord[]> {
    const { data, error } = await this.client
      .from('family_trees')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw new AuthError(error.message, error.code);
    return (data ?? []).map(r => toCamel(r) as unknown as FamilyTreeRecord);
  }

  async getTree(id: string): Promise<FamilyTreeRecord | null> {
    const { data, error } = await this.client
      .from('family_trees')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new AuthError(error.message, error.code);
    }
    return toCamel(data) as unknown as FamilyTreeRecord;
  }

  async createTree(input: CreateTreeInput): Promise<FamilyTreeRecord> {
    const { data, error } = await this.client
      .from('family_trees')
      .insert(toSnake(input as unknown as Record<string, unknown>))
      .select()
      .single();
    if (error) throw new AuthError(error.message, error.code);
    return toCamel(data) as unknown as FamilyTreeRecord;
  }

  async updateTree(id: string, dataInput: Partial<FamilyTreeRecord>): Promise<FamilyTreeRecord> {
    const { data, error } = await this.client
      .from('family_trees')
      .update(toSnake(dataInput as unknown as Record<string, unknown>))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new AuthError(error.message, error.code);
    return toCamel(data) as unknown as FamilyTreeRecord;
  }

  async deleteTree(id: string): Promise<void> {
    const { error } = await this.client.from('family_trees').delete().eq('id', id);
    if (error) throw new AuthError(error.message, error.code);
  }

  // ── Family Members ──────────────────────────────────────

  async listMembers(treeId: string): Promise<FamilyMemberRecord[]> {
    const { data, error } = await this.client
      .from('family_members')
      .select('*')
      .eq('tree_id', treeId)
      .order('generation', { ascending: true });
    if (error) throw new AuthError(error.message, error.code);
    return (data ?? []).map(r => toCamel(r) as unknown as FamilyMemberRecord);
  }

  async getMember(id: string): Promise<FamilyMemberRecord | null> {
    const { data, error } = await this.client
      .from('family_members')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return null;
      throw new AuthError(error.message, error.code);
    }
    return toCamel(data) as unknown as FamilyMemberRecord;
  }

  async createMember(treeId: string, input: CreateMemberInput): Promise<FamilyMemberRecord> {
    const { data, error } = await this.client
      .from('family_members')
      .insert({ ...toSnake(input as unknown as Record<string, unknown>), tree_id: treeId })
      .select()
      .single();
    if (error) throw new AuthError(error.message, error.code);
    return toCamel(data) as unknown as FamilyMemberRecord;
  }

  async updateMember(id: string, dataInput: Partial<FamilyMemberRecord>): Promise<FamilyMemberRecord> {
    const { data, error } = await this.client
      .from('family_members')
      .update(toSnake(dataInput as unknown as Record<string, unknown>))
      .eq('id', id)
      .select()
      .single();
    if (error) throw new AuthError(error.message, error.code);
    return toCamel(data) as unknown as FamilyMemberRecord;
  }

  async deleteMember(id: string): Promise<void> {
    const { error } = await this.client.from('family_members').delete().eq('id', id);
    if (error) throw new AuthError(error.message, error.code);
  }

  // ── Relationships ───────────────────────────────────────

  async listRelationships(treeId: string): Promise<MemberRelationship[]> {
    const { data, error } = await this.client
      .from('family_relationships')
      .select('*')
      .eq('tree_id', treeId);
    if (error) throw new AuthError(error.message, error.code);
    return (data ?? []).map(r => toCamel(r) as unknown as MemberRelationship);
  }

  async createRelationship(
    treeId: string,
    memberId: string,
    relatedId: string,
    type: MemberRelationship['type'],
  ): Promise<MemberRelationship> {
    const { data, error } = await this.client
      .from('family_relationships')
      .insert({ tree_id: treeId, member_id: memberId, related_id: relatedId, type })
      .select()
      .single();
    if (error) throw new AuthError(error.message, error.code);
    return toCamel(data) as unknown as MemberRelationship;
  }

  async deleteRelationship(id: string): Promise<void> {
    const { error } = await this.client.from('family_relationships').delete().eq('id', id);
    if (error) throw new AuthError(error.message, error.code);
  }
}
