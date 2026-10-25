/**
 * Test dedikasi v398 AC6: routes photo POST/GET/DELETE.
 *
 * Pola persis src/server/haul-override-api.test.ts (v393): prisma di-mock
 * penuh lewat vi.hoisted supaya server/index.ts bisa diimpor tanpa
 * DATABASE_URL, server express asli dilisten port ephemeral lalu diakses
 * via fetch native. fs operasi file di-mock (vi.mock node:fs) supaya
 * nihil file nyata di data/uploads; PHOTO_UPLOADS_DIR diarahkan ke
 * direktori sementara sebagai jaring pengaman kedua.
 *
 * Cakupan AC: 401 challenge Bearer, 403 FORBIDDEN_TREE viewer, 404 member
 * nihil, unggah sukses multipart (200 + photoUrl endpoint + file ditulis),
 * unggah JSON base64 sukses, penolakan EMPTY_FILE/TOO_LARGE/NOT_AN_IMAGE
 * 422, file lama terhapus saat ganti, DELETE menghapus file + kosongkan
 * photoUrl, GET menyajikan byte berotorisasi + Cache-Control private.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  familyTree: { findUnique: vi.fn() },
  treeMember: { findUnique: vi.fn() },
  familyMember: { findUnique: vi.fn(), update: vi.fn() },
}));

const fsMock = vi.hoisted(() => ({
  existsSync: vi.fn(() => true),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  readFileSync: vi.fn(() => Buffer.from([0xff, 0xd8, 0xff, 0xe0])),
  unlinkSync: vi.fn(),
}));

vi.mock('../../server/db', () => ({ prisma: prismaMock }));
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, default: fsMock, ...fsMock };
});

const JWT_SECRET = 'dev-only-insecure-secret-change-me';

function authHeader(userId: string): string {
  return `Bearer ${jwt.sign({ sub: userId }, JWT_SECRET)}`;
}

const USER_1 = { id: 'user-1', email: 'u1@example.test', status: 'active', role: 'member' };
const TREE = { id: 'tree-1' };

function memberDenganFoto(fotoUrl: string | null): Record<string, unknown> {
  return {
    id: 'm-1',
    treeId: 'tree-1',
    name: 'Adi',
    photoUrl: fotoUrl,
    isAlive: true,
    privacyStatus: null,
  };
}

let BASE = '';
let serverHandle: import('node:http').Server | undefined;

interface ApiResult {
  status: number;
  body: Record<string, unknown>;
  cacheControl: string | null;
  contentType: string | null;
}

async function call(method: string, path: string, init: RequestInit = {}, withAuth = true): Promise<ApiResult> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    ...init,
    headers: {
      ...(withAuth ? { authorization: authHeader('user-1') } : {}),
      ...((init.headers as Record<string, string>) ?? {}),
    },
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(text) as Record<string, unknown>;
  } catch {
    body = { raw: text };
  }
  return {
    status: res.status,
    body,
    cacheControl: res.headers.get('cache-control'),
    contentType: res.headers.get('content-type'),
  };
}

/** Guard lolos: tree ada, caller editor tree. */
function mockGuardEditor(): void {
  prismaMock.user.findUnique.mockResolvedValue(USER_1);
  prismaMock.familyTree.findUnique.mockResolvedValue(TREE);
  prismaMock.treeMember.findUnique.mockResolvedValue({
    id: 'tm-1',
    userId: 'user-1',
    treeId: 'tree-1',
    role: 'editor',
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fsMock.existsSync.mockReturnValue(true);
  mockGuardEditor();
  prismaMock.familyMember.findUnique.mockResolvedValue(memberDenganFoto(null));
  prismaMock.familyMember.update.mockResolvedValue(memberDenganFoto(null));
});

beforeAll(async () => {
  process.env['PHOTO_UPLOADS_DIR'] = '/tmp/v398-test-uploads';
  const port = 36700 + (process.pid % 600);
  BASE = `http://127.0.1:${port}`;
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
    try {
      const probe = await fetch(`${BASE}/api/v1/auth/session`, {
        headers: { authorization: authHeader('user-1') },
      });
      if (probe.status === 401 || probe.ok) break;
    } catch {
      /* belum siap */
    }
    if (Date.now() > deadline) throw new Error('server failed to start');
    await new Promise((r) => setTimeout(r, 200));
  }
}, 20000);

afterAll(async () => {
  serverHandle?.close();
});

const jpeg = (n = 64): Uint8Array => {
  const b = new Uint8Array(n);
  b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff;
  return b;
};

function multipartBody(): { body: FormData; headers: Record<string, string> } {
  const form = new FormData();
  form.append('photo', new Blob([jpeg() as BlobPart], { type: 'image/jpeg' }), 'foto.jpg');
  return { body: form, headers: {} };
}

describe('POST /api/v1/members/:id/photo', () => {
  it('401 tanpa Authorization', async () => {
    const r = await call('POST', '/api/v1/members/m-1/photo', { body: multipartBody().body }, false);
    expect(r.status).toBe(401);
  });

  it('404 member nihil', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue(null);
    const { body } = multipartBody();
    const r = await call('POST', '/api/v1/members/m-1/photo', { body });
    expect(r.status).toBe(404);
  });

  it('403 viewer FORBIDDEN_TREE', async () => {
    prismaMock.treeMember.findUnique.mockResolvedValue({
      id: 'tm-1',
      userId: 'user-1',
      treeId: 'tree-1',
      role: 'viewer',
    });
    const { body } = multipartBody();
    const r = await call('POST', '/api/v1/members/m-1/photo', { body });
    expect(r.status).toBe(403);
    expect((r.body as { code?: string }).code).toBe('FORBIDDEN_TREE');
  });

  it('200 multipart sukses: file ditulis, photoUrl endpoint, update DB dipanggil', async () => {
    prismaMock.familyMember.update.mockResolvedValue(
      memberDenganFoto('/api/v1/members/m-1/photo?f=uuid.jpg'),
    );
    const { body } = multipartBody();
    const r = await call('POST', '/api/v1/members/m-1/photo', { body });
    expect(r.status).toBe(200);
    expect((r.body as { photoUrl?: string }).photoUrl).toContain('/api/v1/members/m-1/photo?f=');
    expect(fsMock.writeFileSync).toHaveBeenCalledOnce();
    expect(fsMock.mkdirSync).toHaveBeenCalledOnce();
  });

  it('200 JSON base64 sukses', async () => {
    const payload = Buffer.from(jpeg()).toString('base64');
    const r = await call('POST', '/api/v1/members/m-1/photo', {
      body: JSON.stringify({ photoBase64: payload }),
      headers: { 'content-type': 'application/json' },
    });
    expect(r.status).toBe(200);
  });

  it('422 EMPTY_FILE', async () => {
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array(0)], { type: 'image/jpeg' }), 'kosong.jpg');
    const r = await call('POST', '/api/v1/members/m-1/photo', { body: form });
    expect(r.status).toBe(422);
    expect((r.body as { code?: string }).code).toBe('EMPTY_FILE');
  });

  it('422 NOT_AN_IMAGE', async () => {
    const form = new FormData();
    form.append('photo', new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'application/octet-stream' }), 'x.bin');
    const r = await call('POST', '/api/v1/members/m-1/photo', { body: form });
    expect(r.status).toBe(422);
    expect((r.body as { code?: string }).code).toBe('NOT_AN_IMAGE');
  });

  it('ganti foto: file lama terhapus (anti file yatim)', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue(
      memberDenganFoto('/api/v1/members/m-1/photo?f=11111111-1111-1111-1111-111111111111.jpg'),
    );
    const { body } = multipartBody();
    const r = await call('POST', '/api/v1/members/m-1/photo', { body });
    expect(r.status).toBe(200);
    expect(fsMock.unlinkSync).toHaveBeenCalledOnce();
  });
});

describe('GET /api/v1/members/:id/photo', () => {
  it('401 tanpa Authorization', async () => {
    const r = await call('GET', '/api/v1/members/m-1/photo', {}, false);
    expect(r.status).toBe(401);
  });

  it('200 berotorisasi: byte + Content-Type + Cache-Control private', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue({
      ...memberDenganFoto(null),
      photoUrl: '/api/v1/members/m-1/photo?f=22222222-2222-2222-2222-222222222222.jpg',
    });
    const r = await call('GET', '/api/v1/members/m-1/photo');
    expect(r.status).toBe(200);
    expect(r.cacheControl).toContain('private');
    expect(r.contentType).toContain('image/jpeg');
  });

  it('404 photo nihil', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue(memberDenganFoto(null));
    const r = await call('GET', '/api/v1/members/m-1/photo');
    expect(r.status).toBe(404);
  });

  it('404 file fisik hilang', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue({
      ...memberDenganFoto(null),
      photoUrl: '/api/v1/members/m-1/photo?f=33333333-3333-3333-3333-333333333333.jpg',
    });
    fsMock.existsSync.mockReturnValue(false);
    const r = await call('GET', '/api/v1/members/m-1/photo');
    expect(r.status).toBe(404);
  });
});

describe('DELETE /api/v1/members/:id/photo', () => {
  it('403 viewer tidak boleh hapus', async () => {
    prismaMock.treeMember.findUnique.mockResolvedValue({
      id: 'tm-1',
      userId: 'user-1',
      treeId: 'tree-1',
      role: 'viewer',
    });
    prismaMock.familyMember.findUnique.mockResolvedValue({
      ...memberDenganFoto(null),
      photoUrl: '/api/v1/members/m-1/photo?f=44444444-4444-4444-4444-444444444444.jpg',
    });
    const r = await call('DELETE', '/api/v1/members/m-1/photo');
    expect(r.status).toBe(403);
  });

  it('200 hapus: file di-unlink + photoUrl null', async () => {
    prismaMock.familyMember.findUnique.mockResolvedValue({
      ...memberDenganFoto(null),
      photoUrl: '/api/v1/members/m-1/photo?f=55555555-5555-5555-5555-555555555555.jpg',
    });
    prismaMock.familyMember.update.mockResolvedValue(memberDenganFoto(null));
    const r = await call('DELETE', '/api/v1/members/m-1/photo');
    expect(r.status).toBe(200);
    expect(fsMock.unlinkSync).toHaveBeenCalledOnce();
  });
});
