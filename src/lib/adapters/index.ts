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

import { DataAdapter } from './types';
import { MockAdapter } from './mock.adapter';
import { RestAdapter } from './rest.adapter';
import { SupabaseAdapter } from './supabase.adapter';
import { PrismaAdapter } from './prisma.adapter';

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

/**
 * Override adapter with a custom implementation (useful for testing).
 */
export function setAdapter(adapter: DataAdapter): void {
  _adapter = adapter;
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
} from './types';

export {
  AdapterError,
  AuthError,
  NotFoundError,
} from './types';
