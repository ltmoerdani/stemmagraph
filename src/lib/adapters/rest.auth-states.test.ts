import { describe, it, expect, vi, afterEach } from 'vitest';
import { RestAdapter } from './rest.adapter';
import { AdapterError, AuthError } from './types';

/**
 * P2-1, AC-5c support: the login screen branches on AuthError codes
 * (ACCOUNT_PENDING / ACCOUNT_DISABLED) to show the honest state panel
 * instead of a bare "login failed". These tests pin the RestAdapter
 * mapping so a server 401/403 with a state code always arrives as a
 * typed AuthError, while unrelated failures keep their generic shape.
 */

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const makeAdapter = () => new RestAdapter({ baseUrl: 'http://stub.test' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('RestAdapter login account-state errors', () => {
  it('rethrows a 403 ACCOUNT_PENDING as a typed AuthError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(403, { code: 'ACCOUNT_PENDING', message: 'This account is waiting for activation by an owner' }),
      ),
    );
    const err = await makeAdapter().login({ email: 'a@b.c', password: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect(err).toBeInstanceOf(AdapterError);
    expect((err as AuthError).code).toBe('ACCOUNT_PENDING');
    expect((err as AuthError).message).toContain('waiting for activation');
  });

  it('rethrows a 401 ACCOUNT_DISABLED as a typed AuthError', async () => {
    // requireAuth answers 401 when a disabled account presents an old
    // token; the login endpoint itself uses 403. Both must map the same.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(401, { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled' }),
      ),
    );
    const err = await makeAdapter().login({ email: 'a@b.c', password: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('ACCOUNT_DISABLED');
    expect((err as AuthError).statusCode).toBe(401);
  });

  it('keeps a 401 INVALID_CREDENTIALS as a generic AdapterError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' }),
      ),
    );
    const err = await makeAdapter().login({ email: 'a@b.c', password: 'x' }).catch((e) => e);
    expect(err).toBeInstanceOf(AdapterError);
    expect(err).not.toBeInstanceOf(AuthError);
    expect((err as AdapterError).code).toBe('INVALID_CREDENTIALS');
  });
});

describe('RestAdapter register pending account', () => {
  it('answers a 202 without token as AuthError ACCOUNT_PENDING', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(202, {
          user: { id: 'u2', email: 'b@b.c', name: 'Bo', createdAt: '2026-01-01T00:00:00Z', status: 'pending' },
          message: 'Account created, waiting for activation',
        }),
      ),
    );
    const err = await makeAdapter().register({ email: 'b@b.c', password: 'x', name: 'Bo' }).catch((e) => e);
    expect(err).toBeInstanceOf(AuthError);
    expect((err as AuthError).code).toBe('ACCOUNT_PENDING');
    expect((err as AuthError).statusCode).toBe(202);
  });

  it('returns the session when the server hands back a token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        json(201, {
          user: { id: 'u1', email: 'owner@b.c', name: 'Ow', createdAt: '2026-01-01T00:00:00Z', status: 'active', role: 'owner' },
          token: 'tok-1',
        }),
      ),
    );
    const session = await makeAdapter().register({ email: 'owner@b.c', password: 'x', name: 'Ow' });
    expect(session.token).toBe('tok-1');
    expect(session.user.status).toBe('active');
  });
});
