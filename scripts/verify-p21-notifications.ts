// P2-1 AC-4 verification: notification endpoints wired through RestAdapter.
// Run: npx tsx scripts/verify-p21-notifications.ts
//
// What this proves (against a real server/index.ts process on a throwaway
// SQLite database; prisma/dev.db is never touched):
//   - GET  /api/v1/notifications          own rows only, newest first, cap 50
//   - POST /api/v1/notifications/:id/read one row, idempotent, ownership scoped
//   - POST /api/v1/notifications/read-all every unread row of the caller
// All calls go through the RestAdapter class (the same code the UI will
// use), not through raw fetch, so the adapter parsing and error mapping are
// exercised too. Dev-only: intentionally NOT part of run-verify-all.mjs
// because it spawns a server and takes ~20 seconds.
import { spawn, spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RestAdapter } from '../src/lib/adapters/rest.adapter';
import { AdapterError, AuthError } from '../src/lib/adapters/types';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const PORT = 3997;
const BASE = `http://localhost:${PORT}/api/v1`;

let pass = 0;
let fail = 0;

function check(desc: string, actual: string, ok: boolean, hint: string): void {
  if (ok) {
    pass++;
    console.log(`PASS: ${desc}`);
  } else {
    fail++;
    console.log(`FAIL: ${desc}`);
    console.log(`  hint: ${hint}`);
    console.log(`  got: ${actual.slice(0, 300)}`);
  }
}

async function expectAdapterError(
  desc: string,
  fn: () => Promise<unknown>,
  wantStatus: number,
): Promise<void> {
  try {
    await fn();
    check(desc, 'no error thrown', false, `expected AdapterError with statusCode ${wantStatus}`);
  } catch (e) {
    const status = e instanceof AdapterError ? e.statusCode : undefined;
    const code = e instanceof AdapterError ? e.code : 'not-an-AdapterError';
    check(desc, `${status} ${code}`, status === wantStatus, `statusCode ${wantStatus}`);
  }
}

/**
 * The dev server closes idle keep-alive sockets after ~5s. The seeding phase
 * below pauses HTTP traffic for longer than that, so the next request can
 * hit a socket the server just closed (UND_ERR_SOCKET). That is a transport
 * race, not an API failure: retry once on a fresh connection, same as the
 * session smoke script does.
 */
async function stable<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    const cause = (e as { cause?: { code?: string } }).cause;
    if (e instanceof TypeError && /fetch failed/i.test(e.message) && cause?.code === 'UND_ERR_SOCKET') {
      await new Promise((r) => setTimeout(r, 250));
      return fn();
    }
    throw e;
  }
}

async function main(): Promise<void> {
  const work = mkdtempSync(join(tmpdir(), 'p21-notif-'));
  const dbUrl = `file:${join(work, 'notif.db')}`;

  // 1. Fresh database with the P2-1 migration applied.
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: 'pipe',
  });

  // 2. Real server process on the throwaway database.
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
    throw new Error(`verify server did not come up on port ${PORT}`);
  }

  try {
    const adapter = (email: string) => new RestAdapter({ baseUrl: BASE });

    // ── Bootstrap owner and three pending members ──────────
    const owner = adapter('owner');
    const reg0 = await owner.register({ email: 'owner@x.com', password: 'password123', name: 'Owner' });
    check('bootstrap register gives active owner', `${reg0.user.role}/${reg0.user.status}`, reg0.user.role === 'owner' && reg0.user.status === 'active', 'owner/active');
    check('bootstrap register issues token', typeof reg0.token, typeof reg0.token === 'string', 'token string');

    // Later registrations are born pending: the adapter must surface the
    // honest 202 as a typed error, never store a token.
    const memberEmails = ['m1@x.com', 'm2@x.com', 'm3@x.com'];
    for (const email of memberEmails) {
      try {
        await adapter(email).register({ email, password: 'password123', name: email.split('@')[0]! });
        check(`register ${email} raises ACCOUNT_PENDING`, 'no error thrown', false, 'AuthError expected');
      } catch (e) {
        const ok = e instanceof AuthError && e.code === 'ACCOUNT_PENDING' && e.statusCode === 202;
        check(`register ${email} raises ACCOUNT_PENDING`, `${(e as AdapterError).code} ${(e as AdapterError).statusCode}`, ok, 'AuthError ACCOUNT_PENDING 202');
        check(`register ${email} honest message`, (e as Error).message, (e as Error).message.includes('waiting for activation'), 'message mentions waiting');
      }
    }

    // ── GET /notifications: own rows, newest first ─────────
    const page1 = await owner.listNotifications();
    check('owner sees 3 pending-created rows', `${page1.notifications.length}`, page1.notifications.length === 3, '3 rows');
    check('owner unreadCount is 3', `${page1.unreadCount}`, page1.unreadCount === 3, '3');
    check('all rows are ACCOUNT_PENDING_CREATED', page1.notifications.map((n) => n.type).join(','), page1.notifications.every((n) => n.type === 'ACCOUNT_PENDING_CREATED'), 'type');
    const payloadEmails = page1.notifications.map((n) => String((n.payload as Record<string, unknown>)?.['email'] ?? ''));
    check('newest first: m3 on top, m1 last', `${payloadEmails[0]} ... ${payloadEmails[2]}`, payloadEmails[0] === 'm3@x.com' && payloadEmails[2] === 'm1@x.com', 'm3 first, m1 last');
    check('rows are unread with valid timestamps', `${page1.notifications[0]!.readAt}`, page1.notifications.every((n) => n.readAt === null) && !Number.isNaN(Date.parse(page1.notifications[0]!.createdAt)), 'readAt null, createdAt parses');

    // ── POST /notifications/:id/read ───────────────────────
    const first = page1.notifications[0]!;
    const marked = await owner.markNotificationRead(first.id);
    check('mark read sets readAt', `${marked.readAt !== null}`, marked.readAt !== null && !Number.isNaN(Date.parse(marked.readAt!)), 'readAt set');
    const page2 = await owner.listNotifications();
    check('unreadCount drops to 2', `${page2.unreadCount}`, page2.unreadCount === 2, '2');
    const remarked = await owner.markNotificationRead(first.id);
    check('mark read is idempotent', `${remarked.readAt}`, remarked.readAt === marked.readAt, 'readAt unchanged');

    // ── Ownership: one account cannot touch another's rows ─
    const accounts = await owner.listAccounts();
    const m1 = accounts.find((a) => a.email === 'm1@x.com');
    check('owner lists accounts incl. m1 pending', m1 ? m1.status : 'missing', m1?.status === 'pending', 'pending');
    const activated = await owner.setAccountStatus(m1!.id, 'activate');
    check('activate m1 -> active', activated.status, activated.status === 'active', 'active');

    const m1Adapter = adapter('m1');
    await m1Adapter.login({ email: 'm1@x.com', password: 'password123' });
    const m1Page = await m1Adapter.listNotifications();
    check('m1 sees ACCOUNT_ACTIVATED', m1Page.notifications.map((n) => n.type).join(','), m1Page.notifications.length === 1 && m1Page.notifications[0]!.type === 'ACCOUNT_ACTIVATED', '1 row ACCOUNT_ACTIVATED');
    check('m1 unreadCount is 1', `${m1Page.unreadCount}`, m1Page.unreadCount === 1, '1');
    await expectAdapterError('cross-account mark read -> 404', () => owner.markNotificationRead(m1Page.notifications[0]!.id), 404);

    // ── POST /notifications/read-all ───────────────────────
    const updated = await owner.markAllNotificationsRead();
    check('read-all updates the 2 remaining rows', `${updated}`, updated === 2, '2');
    const page3 = await owner.listNotifications();
    check('owner unreadCount is 0 after read-all', `${page3.unreadCount}`, page3.unreadCount === 0, '0');
    const m1Updated = await m1Adapter.markAllNotificationsRead();
    check('m1 read-all scoped to own rows', `${m1Updated}`, m1Updated === 1, '1');

    // ── Cap 50: seed 60 future-dated rows for the owner ────
    const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: dbUrl }) });
    const ownerRow = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@x.com' } });
    const base = Date.now();
    await prisma.notification.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        id: `seed-${String(i + 1).padStart(2, '0')}`,
        userId: ownerRow.id,
        type: 'VERIFY_SEED',
        payloadJson: JSON.stringify({ seq: i + 1 }),
        createdAt: new Date(base + (i + 1) * 1000),
      })),
    });
    await prisma.$disconnect();

    const page4 = await stable(() => owner.listNotifications());
    check('list is capped at 50', `${page4.notifications.length}`, page4.notifications.length === 50, '50');
    check('newest seeded row is first', page4.notifications[0]!.id, page4.notifications[0]!.id === 'seed-60', 'seed-60');
    check('oldest kept row is seed-11', page4.notifications[49]!.id, page4.notifications[49]!.id === 'seed-11', 'seed-11');
    check('unreadCount counts all 60 unread', `${page4.unreadCount}`, page4.unreadCount === 60, '60');
    const bulkUpdated = await stable(() => owner.markAllNotificationsRead());
    check('read-all clears all 60', `${bulkUpdated}`, bulkUpdated === 60, '60');
  } finally {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 500));
    rmSync(work, { recursive: true, force: true });
  }

  console.log(`\nP2-1 notifications wiring: ${pass} assertions passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

void main();
