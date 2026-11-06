/**
 * Test dedikasi v424 fase 2a AC2 + AC3: semantik idempoten penarikan
 * consent di POST /api/v1/members/:memberId/consent dan jalur self.
 *
 * Kontrak: POST revoke atas state tanpa grant aktif (belum pernah grant
 * ATAU sudah revoked) = 200 sukses dengan bentuk respons utuh (record,
 * granted, privacyStatus), TANPA baris ledger baru dan TANPA perubahan
 * privacyStatus (ADR 0015, GDPR Art 7, RFC 9110 9.2.2).
 *
 * Pola persis consent-self-read-api.test.ts (v409): prisma di-mock penuh
 * lewat vi.hoisted, server express asli di port ephemeral, JWT dev secret,
 * fetch native. Kontrak AC3: toStrictEqual, structuredClone, deepFreeze.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), update: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn(), findMany: vi.fn() },
  consentRecord: { findMany: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

const USER_ID = 'u-owner';
const TREE_ID = 'tree-1';
const MEMBER_ID = 'm-consent';

function authHeader(): string {
  return `Bearer ${jwt.sign({ sub: USER_ID }, JWT_SECRET)}`;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.getOwnPropertyNames(value as Record<string, unknown>)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
    Object.freeze(value);
  }
  return value;
}

interface Res { status: number; json: Record<string, unknown> }
async function postConsent(body: unknown): Promise<Res> {
  const res = await fetch(`${BASE}/api/v1/members/${MEMBER_ID}/consent`, {
    method: 'POST',
    headers: { authorization: authHeader(), 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as Record<string, unknown> };
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'owner@keluarga.id', status: 'active', role: 'owner' });
  prismaMock.treeMember.findUnique.mockResolvedValue(null);
  prismaMock.treeMember.findMany.mockResolvedValue([]);
  prismaMock.familyMember.findUnique.mockResolvedValue({
    id: MEMBER_ID,
    treeId: TREE_ID,
    email: null,
    name: 'Anggota Consent',
    isAlive: true,
    privacyStatus: 'private',
  });
  prismaMock.familyTree.findUnique.mockResolvedValue({
    id: TREE_ID,
    name: 'Pohon Keluarga',
    ownerId: USER_ID,
  });
  prismaMock.consentRecord.findMany.mockResolvedValue([]);
  prismaMock.consentRecord.create.mockResolvedValue({});
  prismaMock.familyMember.update.mockResolvedValue({ id: MEMBER_ID, privacyStatus: 'shared' });
});

beforeAll(async () => {
  const port = 39500 + (process.pid % 600);
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

const GRANT_ROW = {
  id: 'rec-1',
  memberId: MEMBER_ID,
  action: 'grant',
  scope: 'share',
  note: null,
  at: new Date('2026-10-01T00:00:00Z'),
};
const REVOKE_ROW = {
  id: 'rec-2',
  memberId: MEMBER_ID,
  action: 'revoke',
  scope: 'share',
  note: null,
  at: new Date('2026-10-02T00:00:00Z'),
};

const EMPTY_PRIVATE = { privacyStatus: 'private' };

const REGRANT_ROW = {
  id: 'rec-3',
  memberId: MEMBER_ID,
  action: 'regrant',
  scope: 'share',
  note: null,
  at: new Date('2026-10-03T00:00:00Z'),
};

describe('GET /api/v1/members/:memberId/consent: status menaati revocation (v424 AC2)', () => {
  async function getConsent(): Promise<Res> {
    const res = await fetch(`${BASE}/api/v1/members/${MEMBER_ID}/consent`, {
      headers: { authorization: authHeader() },
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  it('granted false pasca revoke (grant lalu revoke)', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW, REVOKE_ROW]);
    const r = await getConsent();
    expect(r.status).toBe(200);
    expect(r.json.granted).toBe(false);
    const records = r.json.records as Array<{ action: string }>;
    expect(records.map((x) => x.action)).toStrictEqual(['grant', 'revoke']);
  });

  it('revoke-then-regrant: granted kembali true', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW, REVOKE_ROW, REGRANT_ROW]);
    const r = await getConsent();
    expect(r.status).toBe(200);
    expect(r.json.granted).toBe(true);
    const records = r.json.records as Array<{ action: string }>;
    expect(records.map((x) => x.action)).toStrictEqual(['grant', 'revoke', 'regrant']);
  });

  it('ledger kosong: granted false dengan records kosong', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    const r = await getConsent();
    expect(r.status).toBe(200);
    expect(r.json).toStrictEqual({ records: [], granted: false });
  });
});

describe('POST /api/v1/members/:memberId/consent: no-op revoke idempoten (v424 AC2)', () => {
  it('revoke atas ledger nihil: 200, record null, granted false, tanpa tulis ledger tanpa update member', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    const r = await postConsent({ action: 'revoke', scope: 'share' });
    expect(r.status).toBe(200);
    expect(r.json).toStrictEqual({
      record: null,
      granted: false,
      privacyStatus: 'private',
    });
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('revoke atas state sudah revoked (revoke ulang): 200 sukses tanpa baris ledger baru, record terakhir dipertahankan', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW, REVOKE_ROW]);
    const r = await postConsent({ action: 'revoke', scope: 'share' });
    expect(r.status).toBe(200);
    expect(r.json).toStrictEqual({
      record: {
        id: 'rec-2',
        memberId: MEMBER_ID,
        action: 'revoke',
        scope: 'share',
        at: '2026-10-02T00:00:00.000Z',
      },
      granted: false,
      privacyStatus: 'private',
    });
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });

  it('revoke dua kali berturut: pertama 201 jalur normal, kedua 200 no-op sukses tanpa baris ledger baru', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW]);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        consentRecord: {
          findMany: vi.fn().mockResolvedValue([GRANT_ROW]),
          create: vi.fn().mockResolvedValue({}),
        },
        familyMember: { update: vi.fn().mockResolvedValue({ id: MEMBER_ID, privacyStatus: 'private' }) },
      }),
    );
    const first = await postConsent({ action: 'revoke', scope: 'share' });
    expect(first.status).toBe(201);
    expect(first.json.granted).toBe(false);
    // State kini revoked: revoke ulang = no-op sukses idempoten, respons
    // semantik setara (granted false, privacyStatus private) tanpa tulis baru.
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW, REVOKE_ROW]);
    prismaMock.$transaction.mockClear();
    const second = await postConsent({ action: 'revoke', scope: 'share' });
    expect(second.status).toBe(200);
    expect(second.json.granted).toBe(false);
    expect(second.json.privacyStatus).toBe('private');
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('revoke sukses tidak mengubah privacyStatus member (tetap private semula)', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW, REVOKE_ROW]);
    const r = await postConsent({ action: 'revoke', scope: 'share' });
    expect(r.status).toBe(200);
    expect(r.json.privacyStatus).toBe('private');
    expect(prismaMock.familyMember.update).not.toHaveBeenCalled();
  });

  it('body invalid pada state no-op tetap 400 VALIDATION_ERROR (validasi createRecord berjalan sebelum cek no-op)', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    const r = await postConsent({ action: 'revoke', scope: '   ' });
    expect(r.status).toBe(400);
    expect(r.json.code).toBe('CONSENT_SCOPE_REQUIRED');
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
  });

  it('grant atas ledger nihil tetap jalur normal 201: cek no-op tidak mengubah aksi grant', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        consentRecord: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({}) },
        familyMember: { update: vi.fn().mockResolvedValue(EMPTY_PRIVATE) },
      }),
    );
    const r = await postConsent({ action: 'grant', scope: 'share' });
    expect(r.status).toBe(201);
    expect(r.json.granted).toBe(true);
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe('kontrak beku AC3 (structuredClone plus deepFreeze)', () => {
  it('ledger input beku: replay no-op tidak memutasi rows, respons toStrictEqual bentuk utuh', async () => {
    const rows = deepFreeze([
      structuredClone(GRANT_ROW),
      structuredClone(REVOKE_ROW),
    ]);
    const rowsBaseline = structuredClone(rows);
    prismaMock.consentRecord.findMany.mockResolvedValue(rows);
    const r = await postConsent({ action: 'revoke', scope: 'share' });
    expect(r.status, JSON.stringify(r.json)).toBe(200);
    expect(prismaMock.consentRecord.findMany).toHaveBeenCalledWith({
      where: { memberId: MEMBER_ID },
      orderBy: { at: 'asc' },
    });
    expect(rows).toStrictEqual(rowsBaseline);
    expect(r.json).toStrictEqual({
      record: {
        id: 'rec-2',
        memberId: MEMBER_ID,
        action: 'revoke',
        scope: 'share',
        at: '2026-10-02T00:00:00.000Z',
      },
      granted: false,
      privacyStatus: 'private',
    });
  });
});

describe('POST /api/v1/members/:memberId/consent/self: no-op revoke idempoten jalur self', () => {
  async function postSelfConsent(body: unknown): Promise<Res> {
    const res = await fetch(`${BASE}/api/v1/members/${MEMBER_ID}/consent/self`, {
      method: 'POST',
      headers: { authorization: authHeader(), 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: (await res.json()) as Record<string, unknown> };
  }

  beforeEach(() => {
    // Jalur self: email viewer cocok dengan email member.
    prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID, email: 'self@keluarga.id' });
    prismaMock.familyMember.findUnique.mockResolvedValue({
      id: MEMBER_ID,
      treeId: TREE_ID,
      email: 'self@keluarga.id',
      name: 'Anggota Self',
      isAlive: true,
      privacyStatus: 'private',
    });
  });

  it('self revoke atas ledger nihil: 200 record null granted false, tanpa tulis ledger', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([]);
    const r = await postSelfConsent({ action: 'revoke', scope: 'share' });
    expect(r.status).toBe(200);
    expect(r.json).toStrictEqual({
      record: null,
      granted: false,
      privacyStatus: 'private',
    });
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
  });

  it('self revoke ulang atas state revoked: 200 sukses, semantik identik jalur owner', async () => {
    prismaMock.consentRecord.findMany.mockResolvedValue([GRANT_ROW, REVOKE_ROW]);
    const r = await postSelfConsent({ action: 'revoke', scope: 'share' });
    expect(r.status).toBe(200);
    expect(r.json).toStrictEqual({
      record: {
        id: 'rec-2',
        memberId: MEMBER_ID,
        action: 'revoke',
        scope: 'share',
        at: '2026-10-02T00:00:00.000Z',
      },
      granted: false,
      privacyStatus: 'private',
    });
    expect(prismaMock.consentRecord.create).not.toHaveBeenCalled();
  });
});
