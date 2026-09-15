// GAP #4 verification: public share link endpoints against a real
// server/index.ts process on a throwaway SQLite database (prisma/dev.db
// is never touched). Run: npx tsx scripts/verify-share-link.ts
//
// What this proves:
//   - GET /api/v1/share/:token            public payload, redact living
//   - GET /api/v1/share/:token            password mode (required/invalid/correct)
//   - GET /api/v1/share/:token            404 unknown, 410 revoked
//   - GET /api/v1/share/:token/og-image   SVG with title, generic for password
//   - GET /api/v1/share/:token/preview    OG meta tags, escaped titles
//   - rate limiting                       429 + Retry-After after the budget
// Dev-only: spawns a server, intentionally NOT part of run-verify-all.mjs.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import bcrypt from 'bcryptjs';

const PORT = 3996;
const BASE = `http://localhost:${PORT}/api/v1`;

let pass = 0;
let fail = 0;

function check(desc: string, ok: boolean, got?: string): void {
  if (ok) {
    pass++;
    console.log(`PASS: ${desc}`);
  } else {
    fail++;
    console.log(`FAIL: ${desc}`);
    if (got !== undefined) console.log(`  got: ${got.slice(0, 300)}`);
  }
}

interface ShareResponse {
  status: number;
  headers: Headers;
  body: string;
}

async function get(path: string, headers: Record<string, string> = {}): Promise<ShareResponse> {
  const res = await fetch(`${BASE}${path}`, { headers });
  return { status: res.status, headers: res.headers, body: await res.text() };
}

async function main(): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), 'share-link-'));
  const dbUrl = `file:${join(work, 'share.db')}`;

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });

  const seed = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
  const tree = await seed.familyTree.create({
    data: { id: 'tree-1', name: 'Keluarga <Santoso> & Co', description: 'Tiga generasi Santoso', generationCount: 3 },
  });
  const mk = async (id: string, name: string, isAlive: boolean, deathDate: string | null, privacyStatus: string | null) =>
    seed.familyMember.create({
      data: { id, treeId: tree.id, name, nickname: null, birthDate: '1930-01-01', deathDate, birthPlace: null, profession: null, education: null, gender: 'male', isAlive, privacyStatus, generation: 1 },
    });
  // m1 deceased full, m2 living shared full, m3 living NULL redact,
  // m4 living private redact, m5 isAlive=false but no death date:
  // ambiguous, the gate treats it as living and redacts (AC #3).
  await mk('m1', 'Buyut Soehadi', false, '1987-05-04', null);
  await mk('m2', 'Siti Aminah', true, null, 'shared');
  await mk('m3', 'Bambang Santoso', true, null, null);
  await mk('m4', 'Citra Santoso', true, null, 'private');
  await mk('m5', 'Dewi Ambigu', false, null, null);
  await seed.familyMember.update({ where: { id: 'm1' }, data: { email: 'secret@example.com', notes: 'private note' } });
  await seed.familyRelationship.create({ data: { treeId: tree.id, memberId: 'm1', relatedId: 'm2', type: 'spouse' } });
  await seed.familyRelationship.create({ data: { treeId: tree.id, memberId: 'm1', relatedId: 'm3', type: 'parent' } });

  const passwordHash = await bcrypt.hash('share-secret-1', 10);
  await seed.treeShareLink.create({ data: { treeId: tree.id, token: 'tok-public-1', mode: 'public' } });
  await seed.treeShareLink.create({ data: { treeId: tree.id, token: 'tok-pass-1', mode: 'password', passwordHash } });
  await seed.treeShareLink.create({ data: { treeId: tree.id, token: 'tok-dead-1', mode: 'public', revokedAt: new Date() } });
  await seed.$disconnect();

  const server = spawn('npx', ['tsx', 'server/index.ts'], {
    env: { ...process.env, API_PORT: String(PORT), DATABASE_URL: dbUrl },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (c) => process.stderr.write(c));

  let up = false;
  for (let i = 0; i < 40 && !up; i++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const probe = await fetch(`${BASE}/auth/session`);
      if (probe.status === 401) up = true;
    } catch {
      // not up yet
    }
  }
  if (!up) {
    server.kill('SIGTERM');
    throw new Error('verify server did not come up');
  }

  try {
    // 1. Public payload with living redaction (AC #1, #3).
    const pub = await get('/share/tok-public-1');
    check('public link answers 200', pub.status === 200, `${pub.status} ${pub.body.slice(0, 120)}`);
    const parsed = JSON.parse(pub.body) as {
      link: { mode: string };
      payload: {
        tree: { name: string; memberCount: number; generationCount: number };
        summary: { total: number; visible: number; redacted: number };
        members: Array<Record<string, unknown>>;
        relationships: unknown[];
      };
    };
    check('link mode echoed', parsed.link?.mode === 'public', JSON.stringify(parsed.link));
    check('tree name present', parsed.payload?.tree?.name === 'Keluarga <Santoso> & Co', pub.body.slice(0, 200));
    check('summary 2 visible / 3 redacted', parsed.payload?.summary?.total === 5 && parsed.payload?.summary?.visible === 2 && parsed.payload?.summary?.redacted === 3, JSON.stringify(parsed.payload?.summary));
    const redacted = parsed.payload.members.filter((m) => m.visible === false);
    check('redacted members carry only id/generation/visible', redacted.length === 3 && redacted.every((m) => Object.keys(m).sort().join(',') === 'generation,id,visible'), JSON.stringify(redacted));
    const visible = parsed.payload.members.filter((m) => m.visible === true);
    check('visible members carry name', visible.length === 2 && visible.every((m) => typeof m.name === 'string'), JSON.stringify(visible.map((m) => m.name)));
    check('contact fields never leave the server', !/[":,]email|"notes"|"currentLocation"|"maritalStatus"|secret@example\.com/.test(pub.body), 'email or notes found');
    check('relationships keep topology', parsed.payload.relationships.length === 2, JSON.stringify(parsed.payload.relationships));

    // 2. lastUsedAt stamped (AC #5 consistency with the table).
    const db = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
    const stamped = await db.treeShareLink.findUnique({ where: { token: 'tok-public-1' }, select: { lastUsedAt: true } });
    check('lastUsedAt stamped on use', stamped?.lastUsedAt instanceof Date, JSON.stringify(stamped));
    await db.$disconnect();

    // 3. Password mode (AC #1).
    const need = await get('/share/tok-pass-1');
    check('password link without header answers 401 REQUIRED', need.status === 401 && need.body.includes('SHARE_PASSWORD_REQUIRED'), `${need.status} ${need.body}`);
    const wrong = await get('/share/tok-pass-1', { 'x-share-password': 'wrong-password' });
    check('wrong password answers 401 INVALID', wrong.status === 401 && wrong.body.includes('SHARE_PASSWORD_INVALID'), `${wrong.status} ${wrong.body}`);
    const right = await get('/share/tok-pass-1', { 'x-share-password': 'share-secret-1' });
    const rightParsed = JSON.parse(right.body) as { link: { mode: string }; payload: { summary: { redacted: number } } };
    check('correct password answers 200', right.status === 200 && rightParsed.link.mode === 'password', `${right.status} ${right.body.slice(0, 120)}`);
    check('password link applies the same redaction', rightParsed.payload.summary.redacted === 3, JSON.stringify(rightParsed.payload?.summary));
    // 4. Unknown and revoked tokens.
    const unknown = await get('/share/tok-missing');
    check('unknown token answers 404', unknown.status === 404 && unknown.body.includes('SHARE_NOT_FOUND'), `${unknown.status} ${unknown.body}`);
    const revoked = await get('/share/tok-dead-1');
    check('revoked link answers 410', revoked.status === 410 && revoked.body.includes('SHARE_REVOKED'), `${revoked.status} ${revoked.body}`);

    // 5. OG image (AC #2): title for public, generic for password, escaped.
    const og = await get('/share/tok-public-1/og-image');
    check('og-image answers 200 svg', og.status === 200 && (og.headers.get('content-type') ?? '').includes('image/svg+xml'), `${og.status} ${og.headers.get('content-type')}`);
    check('og-image shows the tree title escaped', og.body.includes('&lt;Santoso&gt;') && og.body.includes('&amp;') && !og.body.includes('<Santoso>'), og.body.slice(0, 200));
    const ogPass = await get('/share/tok-pass-1/og-image');
    check('password og-image stays generic', ogPass.status === 200 && ogPass.body.includes('A shared family tree') && !ogPass.body.includes('Santoso'), ogPass.body.slice(0, 200));

    // 6. Preview HTML with OG meta tags.
    const preview = await get('/share/tok-public-1/preview');
    check('preview answers html with og:title', preview.status === 200 && preview.body.includes('property="og:title"') && preview.body.includes('Keluarga &lt;Santoso&gt; &amp; Co'), preview.body.slice(0, 250));
    check('preview links the og-image route', preview.body.includes('/api/v1/share/tok-public-1/og-image'), preview.body.slice(0, 250));
    const previewPass = await get('/share/tok-pass-1/preview');
    check('password preview stays generic', previewPass.status === 200 && previewPass.body.includes('A shared family tree') && !previewPass.body.includes('Santoso'), previewPass.body.slice(0, 250));

    // 7. Rate limiting (AC #4): burn the read budget, expect 429 + Retry-After.
    let limited = false;
    let retryAfter = '';
    for (let i = 0; i < 40 && !limited; i++) {
      const hit = await get('/share/tok-public-1');
      if (hit.status === 429) {
        limited = true;
        retryAfter = hit.headers.get('retry-after') ?? '';
      }
    }
    check('read budget ends in 429 with Retry-After', limited && retryAfter !== '' && Number(retryAfter) > 0, `limited=${limited} retry-after=${retryAfter}`);
    const ogStill = await get('/share/tok-public-1/og-image');
    check('og budget independent of read budget', ogStill.status === 200, `${ogStill.status}`);
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 300));
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
