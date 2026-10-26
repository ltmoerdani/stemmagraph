/**
 * Test dedikasi v408 AC4: route POST /api/v1/members/:memberId/consent/self.
 *
 * Cakupan: self grant 201 (ledger row + privacyStatus shared), self revoke
 * lalu regrant konsisten ledger, non-self 403 SELF_ONLY anti-enumerasi,
 * email kosong kedua sisi 403, member nihil 404, validasi body 400.
 *
 * Pola persis src/server/calendar-ics-api.test.ts (v394) dan
 * haul-override-api.test.ts (v393): prisma di-mock penuh lewat vi.hoisted,
 * server express asli di port ephemeral, JWT dev secret, fetch native.
 * safeEmitConsentEvent di-mock agar emit terpantau tanpa infrastruktur.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), update: vi.fn() },
  treeMember: { findMany: vi.fn() },
  consentRecord: { findMany: vi.fn(), create: vi.fn() },
  notification: { createMany: vi.fn() },
  event: { create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const emitMock = vi.hoisted(() => vi.fn());
vi.mock('../../src/lib/events/consent-wiring', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/lib/events/consent-wiring')>();
  return { ...actual, safeEmitConsentEvent: emitMock };
});

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

const USER_ID = 'u-1';
const TREE_ID = 'tree-1';
const MEMBER_ID = 'm-self';

const MEMBER_SELF = {
  id: MEMBER_ID,
  treeId: TREE_ID,
  email: 'self@keluarga.id',
  name: 'Anggota Self',
  isAlive: true,
  privacyStatus: null,
};

function authHeader(): string {
  return `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  emitMock.mockResolvedValue({ ok: true });
  prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'self@keluarga.id', status: 'active' });
  prismaMock.familyMember.findUnique.mockResolvedValue(MEMBER_SELF);
  prismaMock.familyMember.update.mockImplementation(async (args: { data: { privacyStatus: string } }) => ({ ...MEMBER_SELF, privacyStatus: args.data.privacyStatus }));
  prismaMock.treeMember.findMany.mockResolvedValue([{ user: { id: 'u-owner', status: 'active' } }]);
  prismaMock.consentRecord.findMany.mockResolvedValue([]);
  prismaMock.consentRecord.create.mockResolvedValue({});
  prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => fn({
    consentRecord: { findMany: prismaMock.consentRecord.findMany, create: prismaMock.consentRecord.create },
    familyMember: { update: prismaMock.familyMember.update },
  }));
});

beforeAll(async () => {
  const port = 38700 + (process.pid % 600);
  BASE = `http://127.0.0.1:${port}`;
  process.env['API_PORT'] = String(port);
  const proto = (express as unknown as { application: { listen: (...a: unknown[]) => import('node:http').Server } }).application;
  const origListen = proto.listen;
  proto.listen = function (this: unknown, ...a: unknown[]) {
    serverHandle = origListen.apply(this, a);
    return serverHandle;
  } as typeof proto.listen;
  await import('../../server/index');
  const deadline = Date.now() + 8000;
  for (;;) {
    try { await fetch(`${BASE}/`); break; }
    catch {
      if (Date.now() > deadline) throw new Error('server test tidak siap dalam 8 detik');
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}, 30000);

afterAll(async () => {
  await new Promise<void>((resolve) => {
    if (!serverHandle) return resolve();
    serverHandle.close(() => resolve());
  });
});

async function postSelf(body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}/api/v1/members/${MEMBER_ID}/consent/self`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: authHeader() },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as any };
}

describe('POST /api/v1/members/:memberId/consent/self (v408)', () => {
  it('self grant: 201, ledger row ditulis, privacyStatus shared, emit actorId subjek', async () => {
    const r = await postSelf({ action: 'grant', scope: 'share' });
    expect(r.status).toBe(201);
    expect(r.json.granted).toBe(true);
    expect(r.json.privacyStatus).toBe('shared');
    expect(prismaMock.consentRecord.create).toHaveBeenCalledTimes(1);
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock.mock.calls[0][0].actorId).toBe(USER_ID);
    expect(emitMock.mock.calls[0][0].treeId).toBe(TREE_ID);
  });

  it('revoke setelah grant lalu regrant: transisi ledger konsisten reducer', async () => {
    const first = await postSelf({ action: 'grant', scope: 'share' });
    expect(first.status).toBe(201);
    prismaMock.consentRecord.findMany.mockResolvedValue([
      { id: 'rec-1', memberId: MEMBER_ID, action: 'grant', scope: 'share', note: null, at: new Date() },
    ]);
    const revoke = await postSelf({ action: 'revoke', scope: 'share' });
    expect(revoke.status).toBe(201);
    expect(revoke.json.granted).toBe(false);
    expect(revoke.json.privacyStatus).toBe('private');
    prismaMock.consentRecord.findMany.mockResolvedValue([
      { id: 'rec-1', memberId: MEMBER_ID, action: 'grant', scope: 'share', note: null, at: new Date(Date.now() - 60000) },
      { id: 'rec-2', memberId: MEMBER_ID, action: 'revoke', scope: 'share', note: null, at: new Date(Date.now() - 30000) },
    ]);
    const regrant = await postSelf({ action: 'regrant', scope: 'share' });
    expect(regrant.status).toBe(201);
    expect(regrant.json.granted).toBe(true);
  });

  it('non-self: 403 SELF_ONLY tanpa membedakan alasan', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: 'orang-lain@keluarga.id' });
    const r = await postSelf({ action: 'grant', scope: 'share' });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('SELF_ONLY');
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
  });

  it('email user kosong: 403 SELF_ONLY', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ email: null });
    const r = await postSelf({ action: 'grant', scope: 'share' });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('SELF_ONLY');
  });

  it('email member nihil: 403 SELF_ONLY (bukan 500)', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue({ ...MEMBER_SELF, email: null });
    const r = await postSelf({ action: 'grant', scope: 'share' });
    expect(r.status).toBe(403);
    expect(r.json.code).toBe('SELF_ONLY');
  });

  it('member nihil: 404 NOT_FOUND', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const r = await postSelf({ action: 'grant', scope: 'share' });
    expect(r.status).toBe(404);
    expect(r.json.code).toBe('NOT_FOUND');
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
  });

  it('body tanpa action: 400 (parseConsentBody jalur owner sama)', async () => {
    const r = await postSelf({ scope: 'share' });
    expect(r.status).toBe(400);
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
  });
});
