// Weekly digest pass and scheduler for P2-7 (ADR 0008).
//
// Application layer over the event store in the P2-6 discipline: this
// module READS Event rows and never writes them. The only write is
// User.digestLastSentAt, advanced per recipient only after a real send
// succeeds (a dry-run success advances nothing, so a rehearsal never
// blocks the real email later). An empty digest skips the recipient
// without advancing the timestamp either: the honest empty state.
//
// The scheduler is an hourly setInterval that exists ONLY when SMTP_URL
// is set. No SMTP, no timer: an installation without a mailer never
// wakes up to discover it cannot send.

import { prisma } from './db';
import { isEventType } from '../src/lib/events';
import {
  buildWeeklyDigest,
  type DigestActorRef,
  type DigestSourceEvent,
  type DigestTreeRef,
  type WeeklyDigestBuild,
} from '../src/lib/digest/builder';
import { shouldSendDigest, weeklyWindow, type WeeklyWindow } from '../src/lib/digest/window';
import { mailerDisabled, sendDigestEmail } from '../src/lib/digest/mailer';

const HOUR_MS = 3_600_000;

export interface DigestRunSummary {
  /** Recipients whose digest was actually built (guard passed). */
  readonly attempted: number;
  /** Emails accepted by the transport (including dry-run sends). */
  readonly sent: number;
  /** Guard-blocked recipients plus honest empty digests. */
  readonly skipped: number;
  /** Build or send errors; each is caught per recipient. */
  readonly failed: number;
}

interface DigestEventRow {
  readonly id: string;
  readonly type: string;
  readonly actorUserId: string | null;
  readonly familyTreeId: string | null;
  readonly createdAt: Date;
}

/**
 * Builds one recipient's digest from live rows. Shared by the hourly
 * pass and the GET /digest/weekly preview so both surfaces agree on
 * what the email would say. Read-only.
 */
export async function buildDigestForUser(
  recipient: { id: string; name: string },
  window: WeeklyWindow,
  events: readonly DigestEventRow[],
  trees: readonly DigestTreeRef[],
  actors: readonly DigestActorRef[],
  membershipTreeIds: readonly string[],
): Promise<WeeklyDigestBuild> {
  const sources: DigestSourceEvent[] = [];
  for (const row of events) {
    if (!isEventType(row.type)) continue; // honest skip, never a crash
    sources.push({
      id: row.id,
      type: row.type,
      actorUserId: row.actorUserId,
      familyTreeId: row.familyTreeId,
      createdAt: row.createdAt,
    });
  }
  return buildWeeklyDigest({
    recipient,
    events: sources,
    membershipTreeIds,
    trees,
    actors,
    window,
  });
}

/** Loads the window-wide rows every recipient shares (read-only). */
async function loadWindowRows(window: WeeklyWindow): Promise<{
  events: DigestEventRow[];
  trees: DigestTreeRef[];
  actors: DigestActorRef[];
  memberships: { userId: string; treeId: string }[];
}> {
  const [events, trees, memberships] = await Promise.all([
    prisma.event.findMany({
      where: { createdAt: { gte: window.startAt, lt: window.endAt } },
      orderBy: { createdAt: 'asc' },
      select: { id: true, type: true, actorUserId: true, familyTreeId: true, createdAt: true },
    }),
    prisma.familyTree.findMany({ select: { id: true, name: true } }),
    prisma.treeMember.findMany({ select: { userId: true, treeId: true } }),
  ]);
  const actorIds = [
    ...new Set(events.map((event) => event.actorUserId).filter((id): id is string => id !== null)),
  ];
  const actors =
    actorIds.length === 0
      ? []
      : await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  return { events, trees, actors, memberships };
}

/**
 * One full pass over every active opted-in recipient. The once per ISO
 * week guard runs first (skipped when already served); empty digests
 * skip without advancing the timestamp; successful real sends advance
 * it; every recipient is isolated in try/catch so one broken row never
 * stops the others.
 */
export async function runWeeklyDigestPass(now: Date = new Date()): Promise<DigestRunSummary> {
  const window = weeklyWindow(now);
  const users = await prisma.user.findMany({
    where: { status: 'active', digestOptIn: true },
    select: { id: true, name: true, email: true, digestLastSentAt: true },
  });
  const { events, trees, actors, memberships } = await loadWindowRows(window);

  let attempted = 0;
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of users) {
    if (!shouldSendDigest(user.digestLastSentAt, window.startAt)) {
      skipped += 1;
      continue;
    }
    attempted += 1;
    try {
      const membershipTreeIds = memberships
        .filter((membership) => membership.userId === user.id)
        .map((membership) => membership.treeId);
      const built = await buildDigestForUser(
        { id: user.id, name: user.name },
        window,
        events,
        trees,
        actors,
        membershipTreeIds,
      );
      if (built.empty) {
        skipped += 1;
        continue;
      }
      const result = await sendDigestEmail({ to: user.email, subject: built.subject, body: built.body });
      if (result.ok) {
        sent += 1;
        // Dry-run is a rehearsal: it counts as a send in the summary but
        // must not advance the guard, or the real email would be blocked.
        if (!result.dryRun) {
          await prisma.user.update({
            where: { id: user.id },
            data: { digestLastSentAt: now },
          });
        }
      } else {
        failed += 1;
        console.error(`[digest] send failed for user ${user.id}: ${result.error}`);
      }
    } catch (e) {
      failed += 1;
      console.error(`[digest] recipient ${user.id} failed:`, (e as Error).message);
    }
  }
  return { attempted, sent, skipped, failed };
}

/**
 * Starts the hourly digest check. Returns null (and starts nothing)
 * when SMTP_URL is unset: the scheduler exists only on installations
 * that actually configured a mailer.
 */
export function startDigestScheduler(): NodeJS.Timeout | null {
  if (mailerDisabled()) {
    console.log('[digest] SMTP_URL not set: weekly digest scheduler stays off');
    return null;
  }
  const timer = setInterval(() => {
    void runWeeklyDigestPass().catch((e) => {
      console.error('[digest] weekly pass failed:', (e as Error).message);
    });
  }, HOUR_MS);
  console.log('[digest] weekly digest scheduler running (hourly check, last complete ISO week)');
  return timer;
}
