// Backend API server for Stemmagraph — Family Tree Platform
// Stack: Express 5 + Prisma ORM + SQLite + JWT auth + bcryptjs
// Run: npx tsx server/index.ts

import express from 'express';
import { createHash } from 'node:crypto';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { ChangeProposal, FamilyTree, FamilyMember, FamilyRelationship, User, Notification, Event, Invitation, TreeMember } from '../generated/prisma/client';
import { prisma } from './db';
import {
  bootstrapAccountState,
  canTransition,
  reviewDisableAction,
  type AccountRole,
  type AccountStatus,
} from '../src/lib/account-states';
import {
  buildAccountActivatedEvent,
  buildAccountDisabledEvent,
  buildAccountEnabledEvent,
  buildAccountPendingCreatedEvent,
  buildChangeAcceptedEvent,
  buildChangeProposedEvent,
  buildChangeRejectedEvent,
  buildInvitationCreatedEvent,
  buildInvitationRevokedEvent,
  buildInvitationUsedEvent,
  isEventType,
  projectAccountActivatedNotification,
  projectChangeNotifications,
  projectPendingCreatedNotifications,
} from '../src/lib/events';
import { safeEmitConsentEvent, type ConsentEventSink } from '../src/lib/events/consent-wiring';
import {
  buildInvitationContext,
  canPerformTreeAction,
  computeExpiresAt,
  initialMaxUses,
  invitationFailureCode,
  invitationState,
  isInvitationType,
  isTreeRole,
  isValidGrantedRole,
  maskInvitationToken,
  remainingUses,
  reviewTreeMembershipChange,
  type InvitationType,
  type TreeAction,
  type TreeRole,
} from '../src/lib/invitations';
import { generateInvitationToken } from '../src/lib/invitations/token';
import {
  parseConsentBody,
  replayConsentState,
  targetPrivacyStatus,
} from '../src/lib/consent/dispatch';
import { applyRecord, createRecord, ConsentLedgerError, type ConsentRecord } from '../src/lib/consent/record';
import { resolveViewerRelation } from '../src/lib/privacy/viewer-relation';
import { applyMemberVisibility } from '../src/lib/privacy/member-redaction';
import { computeLivingStats } from '../src/lib/stats/living-stats';
import { computeUpcomingBirthdays } from '../src/lib/stats/upcoming-birthdays';
import { computeUpcomingAnniversaries } from '../src/lib/stats/upcoming-anniversaries';
import { computeCitationCoverage } from '../src/lib/stats/citation-coverage';
import { computeGenerations } from '../src/lib/stats/generations';
import { computeFamilySizeStats } from '../src/lib/stats/family-size-stats';
import { computeOldestLiving } from '../src/lib/stats/oldest-living';
import { computeMarriageMonths, type MarriagePairInput } from '../src/lib/stats/marriage-months';
import {
  computeBirthsByCenturyFromEvents,
  computeDeathsByCenturyFromEvents,
  computeDivorcesByCenturyFromEvents,
  computeWeddingsByCenturyFromEvents,
  type EntityEventInput,
} from '../src/lib/stats/event-entity-reads';
import { computeBirthsByCentury } from '../src/lib/stats/births-by-century';
import { computeDeathsByCentury } from '../src/lib/stats/deaths-by-century';
import { computeWeddingsByCentury } from '../src/lib/stats/weddings-by-century';
import { computeDivorcesByCentury } from '../src/lib/stats/divorces-by-century';
import { isoDateFromPartial } from '../src/lib/stats/event-entity-parity';
import { resolveReadSource } from '../src/lib/stats/read-source';
import { computeChildrenPerFamilyDistribution } from '../src/lib/stats/children-per-family';
import { computeGenerationDepth, computePedigreeCompleteness } from '../src/lib/genealogy/tree-health';
import type { FamilyGraph, ParentEdge } from '../src/lib/genealogy/family-graph';
import { createErasureExpressAdapter } from '../src/server/consent/erasure-express-adapter';
import { createWithdrawalExpressAdapter } from '../src/server/consent/withdrawal-express-adapter';
import { createErasurePurgeScheduler } from '../src/server/consent/erasure-purge-scheduler-wiring';
import { createConsentNotificationScheduler } from '../src/server/consent/consent-notification-scheduler-wiring';
import { appendEvent } from './events';
import {
  ACCOUNT_EVENT_TYPES,
  encodeFeedCursor,
  isFeedRenderedEventType,
  parseActivityFeedQuery,
  parseStoredEventRow,
  projectEventToFeedItem,
  type FeedItem,
} from '../src/lib/feed';
import {
  computeGrowthMetrics,
  GROWTH_METRIC_EVENT_TYPES,
  parseGrowthMetricsQuery,
  roundGrowthMetric,
} from '../src/lib/metrics/kfactor';
import { buildDigestForUser, runWeeklyDigestPass, startDigestScheduler } from './digest';
import { mailerDisabled } from '../src/lib/digest/mailer';
import { weeklyWindow } from '../src/lib/digest/window';

// ─── Config ──────────────────────────────────────────────

const app = express();
const PORT = process.env['API_PORT'] || 3001;
const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-only-insecure-secret-change-me';
const JWT_EXPIRES_IN = '7d';

if (process.env['NODE_ENV'] === 'production' && JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.error('❌ FATAL: JWT_SECRET must be set in production. Set the JWT_SECRET env variable.');
  process.exit(1);
}

app.use(cors());
app.use(express.json());

// ─── Types ───────────────────────────────────────────────

interface AuthenticatedRequest<P = Record<string, string>> extends express.Request<P> {
  userId?: string;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  familyName: string | null;
  avatar: string | null;
  status: AccountStatus;
  role: AccountRole;
  createdAt: string;
}

// ─── Auth Helpers ────────────────────────────────────────

function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    familyName: user.familyName,
    avatar: user.avatar,
    status: user.status as AccountStatus,
    role: user.role as AccountRole,
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Express middleware — verifies JWT from Authorization header.
 * Attaches `userId` to request on success.
 *
 * Per-request account state check (P2-1): JWTs are stateless with 7 day
 * expiry, so the token alone cannot prove the account is still usable.
 * Every request re-reads the account from the database:
 *   - disabled -> 401 ACCOUNT_DISABLED (this is what "disable cuts all
 *     sessions" means in practice: every outstanding token stops working
 *     on its next request)
 *   - pending  -> 403 ACCOUNT_PENDING
 */
async function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Missing or invalid Authorization header' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    if (typeof payload.sub !== 'string') {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Invalid token payload' });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      res.status(401).json({ code: 'UNAUTHORIZED', message: 'Account no longer exists' });
      return;
    }
    if (user.status === 'disabled') {
      res.status(401).json({ code: 'ACCOUNT_DISABLED', message: 'This account has been disabled' });
      return;
    }
    if (user.status === 'pending') {
      res.status(403).json({ code: 'ACCOUNT_PENDING', message: 'This account is waiting for activation by an owner' });
      return;
    }
    req.userId = user.id;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token expired or invalid' });
  }
}

/**
 * Admin gate (P2-1): the caller must hold role 'owner' AND status 'active'.
 * Runs after requireAuth; re-reads the account so the check is per-request
 * honest even if a role changed mid-session.
 */
async function requireOwner(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: req.userId! },
    select: { role: true, status: true },
  });
  if (!user || user.role !== 'owner' || user.status !== 'active') {
    res.status(403).json({ code: 'OWNER_REQUIRED', message: 'This action requires an active owner account' });
    return;
  }
  next();
}

// ─── Auth Routes ─────────────────────────────────────────

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, familyName } = req.body;
    const invitationToken =
      typeof req.body?.invitationToken === 'string' && req.body.invitationToken !== ''
        ? req.body.invitationToken.trim()
        : undefined;

    // Input validation
    if (!email || !password || !name) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'email, password, and name are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' });
    }

    // Invitation gate (P2-3, fail-closed): when a registration carries an
    // invitation token, a dead or unknown token blocks account creation
    // outright. The account is only created for a live invitation, so a
    // rejected link can never mint a session or a membership row.
    let invitation: Invitation | null = null;
    if (invitationToken !== undefined) {
      invitation = await prisma.invitation.findUnique({ where: { token: invitationToken } });
      if (!invitation) {
        // Unknown token: no invitation row exists, so there is no fact to
        // append; the honest answer is 404 and no account is created.
        return res.status(404).json({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' });
      }
      const failureCode = invitationFailureCode(invitationState(invitation, new Date()));
      if (failureCode !== null) {
        const messages: Record<string, string> = {
          INVITATION_EXPIRED: 'This invitation link has expired',
          INVITATION_REVOKED: 'This invitation link has been revoked',
          INVITATION_EXHAUSTED: 'This invitation link has no uses left',
        };
        // Audit the failed attempt (P2-2 funnel): no actor account exists,
        // subjectUserId stays null because no account was created.
        const usedEvent = buildInvitationUsedEvent({
          actorUserId: null,
          familyTreeId: invitation.treeId,
          invitationId: invitation.id,
          invitationType: invitation.type as InvitationType,
          result: 'failure',
          reason: failureCode,
          subjectUserId: null,
        });
        await appendEvent(usedEvent.type, usedEvent.actorUserId, usedEvent.familyTreeId, usedEvent.payload);
        return res.status(410).json({ code: failureCode, message: messages[failureCode] });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email is already registered' });

    // Bootstrap rule (ADR 0002): the first account on an empty user table is
    // born active with role owner so a fresh install can administer itself.
    // Every later registration is born pending and waits for owner approval.
    // Precedence note (P2-3): an invitation row cannot exist on an empty
    // user table (its creator is a foreign key, cascading on delete), so a
    // live invitationToken implies user count >= 1 and the bootstrap path
    // below stays reserved for the no-token first account. The first
    // account is therefore still born active owner, invitation or not.
    const bootstrap = bootstrapAccountState(await prisma.user.count());

    const passwordHash = await bcrypt.hash(password, 12);

    if (bootstrap.status === 'active') {
      const user = await prisma.user.create({
        data: { email, password: passwordHash, name, familyName, status: bootstrap.status, role: bootstrap.role },
      });
      const token = signToken(user.id);
      return res.status(201).json({ user: toPublicUser(user), token });
    }

    // Pending registration, possibly consuming a live invitation (P2-3).
    // The three writes are one unit: account, use increment, membership.
    const now = new Date();
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { email, password: passwordHash, name, familyName, status: bootstrap.status, role: bootstrap.role },
      });
      if (invitation !== null) {
        await tx.invitation.update({
          where: { id: invitation.id },
          data: { usedCount: { increment: 1 }, lastUsedAt: now },
        });
        await tx.treeMember.create({
          data: { treeId: invitation.treeId, userId: created.id, role: invitation.grantedRole },
        });
      }
      return created;
    });

    if (invitation !== null) {
      // Audit the successful use first (P2-2 funnel): the actor is the new
      // account itself; a personal invitation is consumed here (single use).
      const usedEvent = buildInvitationUsedEvent({
        actorUserId: user.id,
        familyTreeId: invitation.treeId,
        invitationId: invitation.id,
        invitationType: invitation.type as InvitationType,
        result: 'success',
        subjectUserId: user.id,
      });
      await appendEvent(usedEvent.type, usedEvent.actorUserId, usedEvent.familyTreeId, usedEvent.payload);
    }

    // No token is issued. Tell the truth about the account state so the UI
    // can show a "waiting for activation" screen. Audit fact first (P2-2):
    // the event is written before any projection.
    const event = buildAccountPendingCreatedEvent(user.id);
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);

    // In-app notifications are a projection of the emitted event (P2-1
    // behavior unchanged: one notification per active owner).
    const activeOwners = await prisma.user.findMany({
      where: { role: 'owner', status: 'active' },
      select: { id: true },
    });
    if (activeOwners.length > 0) {
      await prisma.notification.createMany({
        data: projectPendingCreatedNotifications(event, activeOwners, {
          id: user.id,
          email: user.email,
          name: user.name,
        }),
      });
    }
    res.status(202).json({
      user: toPublicUser(user),
      message: 'Account created. It is waiting for activation by an owner before you can sign in.',
    });
  } catch (e) {
    res.status(500).json({ code: 'AUTH_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
    }

    // Account state gate (P2-1): pending accounts never receive a token;
    // disabled accounts are refused outright.
    if (user.status === 'pending') {
      return res.status(403).json({ code: 'ACCOUNT_PENDING', message: 'This account is waiting for activation by an owner' });
    }
    if (user.status === 'disabled') {
      return res.status(403).json({ code: 'ACCOUNT_DISABLED', message: 'This account has been disabled' });
    }

    const token = signToken(user.id);
    res.json({ user: toPublicUser(user), token });
  } catch (e) {
    res.status(500).json({ code: 'AUTH_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/auth/session', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId! } });
    if (!user) return res.status(404).json({ code: 'NOT_FOUND', message: 'User not found' });
    res.json({ user: toPublicUser(user) });
  } catch (e) {
    res.status(500).json({ code: 'AUTH_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/auth/logout', (_req, res) => res.status(204).send());

// ─── Admin: Account Management (P2-1) ────────────────────
// All routes require an active owner. The state machine and the
// last-owner guard live in src/lib/account-states (pure, unit tested).

function formatAccount(user: User) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    familyName: user.familyName,
    avatar: user.avatar,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
  };
}

app.get('/api/v1/admin/accounts', requireAuth, requireOwner, async (_req: AuthenticatedRequest, res) => {
  try {
    const users = await prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ accounts: users.map(formatAccount) });
  } catch (e) {
    res.status(500).json({ code: 'ADMIN_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/admin/accounts/:id/activate', requireAuth, requireOwner, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ code: 'NOT_FOUND', message: 'Account not found' });
    if (!canTransition(target.status as AccountStatus, 'active')) {
      return res.status(409).json({ code: 'INVALID_TRANSITION', message: `Cannot activate an account in status '${target.status}'` });
    }

    const updated = await prisma.user.update({ where: { id: target.id }, data: { status: 'active' } });
    // Fact first, then the projection: notify the user that their account
    // is now usable (R-74.7) with a row derived from the emitted event.
    const event = buildAccountActivatedEvent(req.userId!, updated.id);
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    await prisma.notification.create({ data: projectAccountActivatedNotification(event) });
    res.json({ account: formatAccount(updated) });
  } catch (e) {
    res.status(500).json({ code: 'ADMIN_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/admin/accounts/:id/disable', requireAuth, requireOwner, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ code: 'NOT_FOUND', message: 'Account not found' });
    if (!canTransition(target.status as AccountStatus, 'disabled')) {
      return res.status(409).json({ code: 'INVALID_TRANSITION', message: `Cannot disable an account in status '${target.status}'` });
    }

    // Last-owner guard (R-73.5) + self-disable refusal, pure logic.
    const otherActiveOwnerCount = await prisma.user.count({
      where: { role: 'owner', status: 'active', id: { not: target.id } },
    });
    const decision = reviewDisableAction({
      actorId: req.userId!,
      targetId: target.id,
      targetRole: target.role as AccountRole,
      targetStatus: target.status as AccountStatus,
      otherActiveOwnerCount,
    });
    if (!decision.allowed) {
      const message =
        decision.code === 'LAST_OWNER_GUARD'
          ? 'Cannot disable the last active owner. Promote another owner first.'
          : 'You cannot disable your own account.';
      return res.status(403).json({ code: decision.code, message });
    }

    const updated = await prisma.user.update({ where: { id: target.id }, data: { status: 'disabled' } });
    // Fact only: P2-1 sends no notification on disable, and that external
    // behavior stays unchanged; the audit event is still recorded.
    const event = buildAccountDisabledEvent(req.userId!, updated.id);
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    res.json({ account: formatAccount(updated) });
  } catch (e) {
    res.status(500).json({ code: 'ADMIN_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/admin/accounts/:id/enable', requireAuth, requireOwner, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) return res.status(404).json({ code: 'NOT_FOUND', message: 'Account not found' });
    if (target.status !== 'disabled') {
      return res.status(409).json({ code: 'INVALID_TRANSITION', message: `Cannot enable an account in status '${target.status}'` });
    }

    const updated = await prisma.user.update({ where: { id: target.id }, data: { status: 'active' } });
    // Fact first, then the projection: enabling reuses the P2-1 activated
    // notification, now derived from the emitted event.
    const event = buildAccountEnabledEvent(req.userId!, updated.id);
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    await prisma.notification.create({ data: projectAccountActivatedNotification(event) });
    res.json({ account: formatAccount(updated) });
  } catch (e) {
    res.status(500).json({ code: 'ADMIN_ERROR', message: (e as Error).message });
  }
});

// ─── Event store (read-only, P2-2) ───────────────────────
// Append-only audit surface for owners: the 50 most recent events, with an
// optional exact type filter. There is deliberately no UI, no update
// endpoint, and no delete endpoint.

function formatEvent(e: Event) {
  let payload: unknown = null;
  try {
    payload = JSON.parse(e.payloadJson);
  } catch {
    payload = null;
  }
  return {
    type: e.type,
    actorUserId: e.actorUserId,
    familyTreeId: e.familyTreeId,
    createdAt: e.createdAt,
    payload,
  };
}

app.get('/api/v1/admin/events', requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const requestedType = req.query['type'];
    if (requestedType !== undefined && (typeof requestedType !== 'string' || !isEventType(requestedType))) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Unknown event type filter' });
    }
    const events = await prisma.event.findMany({
      where: requestedType !== undefined ? { type: requestedType } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ events: events.map(formatEvent) });
  } catch (e) {
    res.status(500).json({ code: 'ADMIN_ERROR', message: (e as Error).message });
  }
});

// ─── Notifications (in-app, P2-1) ────────────────────────
// Delivery stays inside this server: no email, no external push.
// Known types: ACCOUNT_PENDING_CREATED, ACCOUNT_ACTIVATED.

function formatNotification(n: Notification) {
  let payload: unknown = null;
  try {
    payload = JSON.parse(n.payloadJson);
  } catch {
    payload = null;
  }
  return {
    id: n.id,
    type: n.type,
    payload,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  };
}

app.get('/api/v1/notifications', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: { userId: req.userId! },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.notification.count({ where: { userId: req.userId!, readAt: null } }),
    ]);
    res.json({ notifications: notifications.map(formatNotification), unreadCount });
  } catch (e) {
    res.status(500).json({ code: 'NOTIFICATION_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/notifications/:id/read', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    // Ownership is part of the lookup: one account can never mark or even
    // probe another account's notifications.
    const notification = await prisma.notification.findFirst({
      where: { id: req.params.id, userId: req.userId! },
    });
    if (!notification) return res.status(404).json({ code: 'NOT_FOUND', message: 'Notification not found' });

    const updated = await prisma.notification.update({
      where: { id: notification.id },
      // Keep the original readAt when already read (idempotent).
      data: { readAt: notification.readAt ?? new Date() },
    });
    res.json({ notification: formatNotification(updated) });
  } catch (e) {
    res.status(500).json({ code: 'NOTIFICATION_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/notifications/read-all', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.userId!, readAt: null },
      data: { readAt: new Date() },
    });
    res.json({ updated: result.count });
  } catch (e) {
    res.status(500).json({ code: 'NOTIFICATION_ERROR', message: (e as Error).message });
  }
});

// ─── Activity feed (P2-6, ADR 0006) ──────────────────────
//
// READ-ONLY application layer over the P2-2 event store. This handler
// appends nothing, writes no table, and never widens the event
// vocabulary: it only filters, projects and pages stored events. The
// pure decisions live in src/lib/feed (query parsing, cursor codec,
// visibility rules, minimization projector); the SQL below mirrors
// isEventVisibleInFeed: trees the caller is a TreeMember of (any role
// may read, per the ADR 0002 matrix) plus account events that concern
// the caller (payload subjectUserId or envelope actorUserId). Account
// events about other people stay out of everyone's feed.

app.get('/api/v1/activity-feed', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = parseActivityFeedQuery({
      type: req.query['type'],
      limit: req.query['limit'],
      before: req.query['before'],
    });
    if (!parsed.ok) {
      return res.status(400).json({ code: parsed.code, message: parsed.message });
    }

    const memberships = await prisma.treeMember.findMany({
      where: { userId: req.userId! },
      select: { treeId: true },
    });
    const treeIds = memberships.map((membership) => membership.treeId);

    // Keyset pagination on (createdAt, id): the next page is strictly
    // older than the cursor tuple, so re-reading a cursor is idempotent.
    // Empty objects keep the AND list flat without importing Prisma types.
    const cursorClause =
      parsed.before !== null
        ? {
            OR: [
              { createdAt: { lt: new Date(parsed.before.createdAt) } },
              { AND: [{ createdAt: new Date(parsed.before.createdAt) }, { id: { lt: parsed.before.id } }] },
            ],
          }
        : {};
    const typeClause = parsed.typeFilter !== null ? { type: { in: parsed.typeFilter } } : {};

    const events = await prisma.event.findMany({
      where: {
        AND: [
          {
            OR: [
              { familyTreeId: { in: treeIds } },
              {
                AND: [
                  { type: { in: [...ACCOUNT_EVENT_TYPES] } },
                  {
                    OR: [
                      { actorUserId: req.userId! },
                      // Account payloads carry exactly one key
                      // (subjectUserId), so a quoted id match inside
                      // payloadJson can only hit that subject.
                      { payloadJson: { contains: `"${req.userId}"` } },
                    ],
                  },
                ],
              },
            ],
          },
          cursorClause,
          typeClause,
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: parsed.limit + 1,
    });

    const page = events.slice(0, parsed.limit);
    const items: FeedItem[] = [];
    for (const row of page) {
      const source = parseStoredEventRow(row);
      // P2-5 fence: CHANGE_* rows share the tree scope but stay out of
      // the feed until the deferred feed-item decision (ADR 0009).
      if (source !== null && isFeedRenderedEventType(source.envelope.type)) {
        items.push(projectEventToFeedItem(source));
      }
    }
    const lastRow = page[page.length - 1];
    const nextCursor =
      events.length > parsed.limit && lastRow !== undefined
        ? encodeFeedCursor({ id: lastRow.id, createdAt: lastRow.createdAt.toISOString() })
        : null;
    res.json({ items, nextCursor });
  } catch (e) {
    res.status(500).json({ code: 'FEED_ERROR', message: (e as Error).message });
  }
});

// ─── Growth metrics (P2-8, ADR 0007) ─────────────────────
//
// READ-ONLY owner dashboard over the P2-2 event store plus TreeMember and
// User rows. This handler appends nothing and writes no table: it projects
// stored events into weekly buckets (pure logic in src/lib/metrics/kfactor)
// and counts trees with an active editor from live membership rows, not
// from events. The funnel stays labeled an inference until the product has
// its own data, and none of these numbers ever reach an export surface.

app.get('/api/v1/admin/metrics/growth', requireAuth, requireOwner, async (req: AuthenticatedRequest, res) => {
  try {
    const parsedQuery = parseGrowthMetricsQuery({ weeks: req.query['weeks'] });
    if (!parsedQuery.ok) {
      return res.status(400).json({ code: parsedQuery.code, message: parsedQuery.message });
    }

    // Full history of the five metric types: the k-factor denominator needs
    // every activation ever recorded, not just the requested window.
    const rows = await prisma.event.findMany({
      where: { type: { in: [...GROWTH_METRIC_EVENT_TYPES] } },
      orderBy: { createdAt: 'asc' },
      select: { type: true, payloadJson: true, createdAt: true },
    });
    const metrics = computeGrowthMetrics(rows, { weeks: parsedQuery.weeks, now: new Date() });
    if (!metrics.ok) {
      return res.status(400).json({ code: metrics.code, message: metrics.message });
    }

    // Serialization boundary: rates keep exact fractions in the module and
    // round to 4 decimals only here, in the response.
    const weeks = metrics.weeks.map((week) => ({
      ...week,
      k: roundGrowthMetric(week.k),
      pakaiRate: roundGrowthMetric(week.pakaiRate),
      aktivasiRate: roundGrowthMetric(week.aktivasiRate),
    }));

    const [memberships, activeUsers] = await Promise.all([
      prisma.treeMember.findMany({ select: { treeId: true, userId: true, role: true } }),
      prisma.user.findMany({ where: { status: 'active' }, select: { id: true } }),
    ]);
    const activeUserIds = new Set(activeUsers.map((user) => user.id));
    const treesWithMembers = new Set(memberships.map((membership) => membership.treeId));
    const treesWithActiveEditor = new Set(
      memberships
        .filter((membership) => membership.role === 'editor' && activeUserIds.has(membership.userId))
        .map((membership) => membership.treeId),
    );
    const treesWithActiveEditorPct =
      treesWithMembers.size === 0
        ? 0
        : Math.round((100 * treesWithActiveEditor.size) / treesWithMembers.size) / 100;

    res.json({ weeks, treesWithActiveEditorPct });
  } catch (e) {
    res.status(500).json({ code: 'METRICS_ERROR', message: (e as Error).message });
  }
});

// ─── Weekly digest (P2-7, ADR 0008) ──────────────────────
//
// GET /digest/weekly is the PREVIEW: it renders the digest the caller
// would receive for the last complete ISO week, even when the caller has
// not opted in (you can look before you switch on). PUT
// /digest/preferences flips only the caller's own digestOptIn column,
// one boolean, nothing else. Both are read-or-own-row surfaces behind
// requireAuth.
//
// POST /admin/digest/send is the owner's manual trigger and fails
// closed: without SMTP_URL there is no mailer and the endpoint answers
// 503 instead of pretending a send happened.

app.get('/api/v1/digest/weekly', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { id: true, name: true, digestOptIn: true },
    });
    if (user === null) {
      return res.status(401).json({ code: 'UNAUTHORIZED', message: 'Account not found' });
    }
    const window = weeklyWindow(new Date());
    const [memberships, events, trees] = await Promise.all([
      prisma.treeMember.findMany({ where: { userId: user.id }, select: { treeId: true } }),
      prisma.event.findMany({
        where: { createdAt: { gte: window.startAt, lt: window.endAt } },
        orderBy: { createdAt: 'asc' },
        select: { id: true, type: true, actorUserId: true, familyTreeId: true, createdAt: true },
      }),
      prisma.familyTree.findMany({ select: { id: true, name: true } }),
    ]);
    const actorIds = [
      ...new Set(events.map((event) => event.actorUserId).filter((id): id is string => id !== null)),
    ];
    const actors =
      actorIds.length === 0
        ? []
        : await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
    const digest = await buildDigestForUser(
      { id: user.id, name: user.name },
      window,
      events,
      trees,
      actors,
      memberships.map((membership) => membership.treeId),
    );
    res.json({
      window: { startAt: window.startAt.toISOString(), endAt: window.endAt.toISOString() },
      optIn: user.digestOptIn,
      empty: digest.empty,
      subject: digest.empty ? null : digest.subject,
      body: digest.empty ? null : digest.body,
    });
  } catch (e) {
    res.status(500).json({ code: 'DIGEST_PREVIEW_ERROR', message: (e as Error).message });
  }
});

app.put('/api/v1/digest/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const body = req.body as { optIn?: unknown } | null | undefined;
    if (typeof body !== 'object' || body === null || typeof body.optIn !== 'boolean') {
      return res.status(400).json({
        code: 'DIGEST_PREF_INVALID',
        message: 'Body must be a JSON object with a boolean optIn field',
      });
    }
    // Only the caller's own row, only the consent column: one boolean in,
    // one boolean out, no other column can move through this endpoint.
    const user = await prisma.user.update({
      where: { id: req.userId! },
      data: { digestOptIn: body.optIn },
      select: { digestOptIn: true },
    });
    res.json({ optIn: user.digestOptIn });
  } catch (e) {
    res.status(500).json({ code: 'DIGEST_PREF_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/admin/digest/send', requireAuth, requireOwner, async (_req: AuthenticatedRequest, res) => {
  try {
    if (mailerDisabled()) {
      return res
        .status(503)
        .json({ code: 'DIGEST_MAIL_DISABLED', message: 'SMTP_URL is not set; the digest mailer is disabled' });
    }
    const summary = await runWeeklyDigestPass();
    res.json(summary);
  } catch (e) {
    res.status(500).json({ code: 'DIGEST_SEND_ERROR', message: (e as Error).message });
  }
});

// ─── Tree membership helpers (P2-3, ADR 0002 + 0004) ──────

/**
 * Resolves the caller's role on one tree. A TreeMember row is the source
 * of truth; an installation owner (requireAuth already guarantees the
 * account is active) may administer any tree per ADR 0002. Null means the
 * caller holds no role on this tree.
 */
async function resolveTreeRole(userId: string, treeId: string): Promise<TreeRole | null> {
  const membership = await prisma.treeMember.findUnique({
    where: { treeId_userId: { treeId, userId } },
  });
  if (membership) return membership.role as TreeRole;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user !== null && user.role === 'owner' ? 'owner' : null;
}

type TreeGuard =
  | { ok: true; role: TreeRole }
  | { ok: false; statusCode: number; code: string; message: string };

/**
 * One guard for every tree-scoped route: 404 when the tree does not exist,
 * 403 FORBIDDEN_TREE when the caller's role cannot perform the action
 * (matrix in src/lib/invitations, ADR 0002).
 */
async function guardTreeAction(userId: string, treeId: string, action: TreeAction): Promise<TreeGuard> {
  const tree = await prisma.familyTree.findUnique({ where: { id: treeId }, select: { id: true } });
  if (!tree) return { ok: false, statusCode: 404, code: 'NOT_FOUND', message: 'Tree not found' };
  const role = await resolveTreeRole(userId, treeId);
  if (role === null || !canPerformTreeAction(role, action)) {
    return {
      ok: false,
      statusCode: 403,
      code: 'FORBIDDEN_TREE',
      message: `Your role on this tree does not allow this action (${action})`,
    };
  }
  return { ok: true, role };
}

// ─── Invitations (P2-3, ADR 0004) ────────────────────────
//
// The full token is returned exactly once, in the creation response; every
// later surface (list, revoke) shows the masked form. The public info
// endpoint is deliberately unauthenticated: a registrant holding only the
// link must see what they are accepting, with no other PII.

const INVITATION_CHANNELS = ['manual', 'wa', 'email'] as const;

/** Base URL for invitation links; the UI route is /register?invite=... */
function invitationBaseUrl(): string {
  return (process.env['PUBLIC_APP_URL'] || 'http://localhost:5173').replace(/\/+$/, '');
}

function formatInvitationSummary(invitation: Invitation, now: Date) {
  const state = invitationState(invitation, now);
  return {
    id: invitation.id,
    treeId: invitation.treeId,
    type: invitation.type,
    grantedRole: invitation.grantedRole,
    channel: invitation.channel,
    state,
    failureCode: invitationFailureCode(state),
    usedCount: invitation.usedCount,
    maxUses: invitation.maxUses,
    remainingUses: remainingUses(invitation),
    tokenMasked: maskInvitationToken(invitation.token),
    expiresAt: invitation.expiresAt.toISOString(),
    revokedAt: invitation.revokedAt ? invitation.revokedAt.toISOString() : null,
    lastUsedAt: invitation.lastUsedAt ? invitation.lastUsedAt.toISOString() : null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

app.post('/api/v1/trees/:treeId/invitations', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    // Tree owner or installation owner; manage_invitations is owner-only in
    // the ADR 0002 matrix.
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'manage_invitations');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });

    const { type, grantedRole, channel, maxUses } = req.body ?? {};
    if (!isInvitationType(type)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'type must be "personal" or "family"' });
    }
    if (!isValidGrantedRole(type, grantedRole)) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'grantedRole must be "viewer", or "editor" for family invitations; owner cannot be granted',
      });
    }
    if (maxUses !== undefined && type === 'personal') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'maxUses applies to family invitations only; a personal invitation is single use' });
    }
    let channelValue: string = 'manual';
    if (channel !== undefined) {
      if (typeof channel !== 'string' || !(INVITATION_CHANNELS as readonly string[]).includes(channel)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'channel must be "manual", "wa", or "email"' });
      }
      channelValue = channel;
    }

    const now = new Date();
    const invitation = await prisma.invitation.create({
      data: {
        token: generateInvitationToken(),
        type,
        treeId: req.params.treeId,
        createdById: req.userId!,
        grantedRole,
        maxUses: initialMaxUses(type, maxUses),
        channel: channelValue,
        expiresAt: computeExpiresAt(type, now),
      },
    });
    // Audit fact first (P2-2 funnel); familyTreeId rides the envelope.
    const event = buildInvitationCreatedEvent({
      actorUserId: req.userId!,
      familyTreeId: invitation.treeId,
      invitationId: invitation.id,
      invitationType: type,
      channel: channelValue,
      grantedRole,
      expiresAt: invitation.expiresAt,
      maxUses: invitation.maxUses,
    });
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);

    // The one and only surface where the full token appears.
    res.status(201).json({
      invitation: {
        ...formatInvitationSummary(invitation, now),
        token: invitation.token,
        url: `${invitationBaseUrl()}/register?invite=${invitation.token}`,
      },
    });
  } catch (e) {
    res.status(500).json({ code: 'INVITATION_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/trees/:treeId/invitations', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'manage_invitations');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const now = new Date();
    const invitations = await prisma.invitation.findMany({
      where: { treeId: req.params.treeId },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ invitations: invitations.map((invitation) => formatInvitationSummary(invitation, now)) });
  } catch (e) {
    res.status(500).json({ code: 'INVITATION_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/invitations/:id/revoke', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({ where: { id: req.params.id } });
    if (!invitation) return res.status(404).json({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' });
    const guard = await guardTreeAction(req.userId!, invitation.treeId, 'manage_invitations');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    if (invitation.revokedAt !== null) {
      return res.status(409).json({ code: 'INVITATION_ALREADY_REVOKED', message: 'This invitation has already been revoked' });
    }

    const now = new Date();
    const updated = await prisma.invitation.update({ where: { id: invitation.id }, data: { revokedAt: now } });
    const event = buildInvitationRevokedEvent({
      actorUserId: req.userId!,
      familyTreeId: updated.treeId,
      invitationId: updated.id,
      invitationType: updated.type as InvitationType,
    });
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    res.json({ invitation: formatInvitationSummary(updated, now) });
  } catch (e) {
    res.status(500).json({ code: 'INVITATION_ERROR', message: (e as Error).message });
  }
});

/**
 * Public, unauthenticated context for a registration link: what tree, who
 * invites, how long the link lives, how many uses remain. No other PII.
 * Honest dead-state codes: 404 unknown token, 410 expired/revoked/exhausted.
 */
app.get('/api/v1/invitations/:token/info', async (req: express.Request<{ token: string }>, res) => {
  try {
    const invitation = await prisma.invitation.findUnique({
      where: { token: req.params.token },
      include: { tree: { select: { name: true } }, createdBy: { select: { name: true } } },
    });
    if (!invitation) return res.status(404).json({ code: 'INVITATION_NOT_FOUND', message: 'Invitation not found' });
    const now = new Date();
    const failureCode = invitationFailureCode(invitationState(invitation, now));
    if (failureCode !== null) {
      const messages: Record<string, string> = {
        INVITATION_EXPIRED: 'This invitation link has expired',
        INVITATION_REVOKED: 'This invitation link has been revoked',
        INVITATION_EXHAUSTED: 'This invitation link has no uses left',
      };
      return res.status(410).json({ code: failureCode, message: messages[failureCode] });
    }
    res.json(
      buildInvitationContext({
        invitation,
        treeName: invitation.tree.name,
        inviterName: invitation.createdBy.name,
        now,
      }),
    );
  } catch (e) {
    res.status(500).json({ code: 'INVITATION_ERROR', message: (e as Error).message });
  }
});

// ─── Change review (P2-5, ADR 0009) ──────────────────────
//
// Two-version pending edits with one accept gate. Editors and owners
// propose; only owners of that tree decide. Proposals freeze the current
// record into beforeJson and the desired record into afterJson; the live
// row moves only inside the accept transaction, which consumes the
// proposal row in the same commit (the fact that a proposal was accepted
// lives on in the event store, and the content lives on in the record).
// Rejected and distinct are terminal; distinct permanently refuses the
// same afterJson on the same target (410 CHANGE_DISTINCT_TARGET_LOCKED
// on re-submission, 410 CHANGE_TARGET_GONE when the record itself was
// deleted meanwhile). The pure rules live in src/lib/changes; this
// section only enforces roles per tree and persists.

import {
  AUTO_ACCEPT_DEFAULT,
  MEMBER_PROPOSAL_FIELDS,
  RELATIONSHIP_PROPOSAL_FIELDS,
  canonicalizeSnapshotJson,
  isChangeTargetType,
  reviewAutoAccept,
  reviewChangeDecision,
  reviewNewProposal,
  validateReasonNote,
  validateDecisionNote,
  validateTargetSnapshot,
  type ChangeTargetType,
} from '../src/lib/changes';

type ChangeGuard =
  | { ok: true; role: TreeRole }
  | { ok: false; statusCode: number; code: string; message: string };

/** Owner-only gate for every decide endpoint; viewers and editors read 403. */
async function guardTreeOwner(userId: string, treeId: string): Promise<ChangeGuard> {
  const tree = await prisma.familyTree.findUnique({ where: { id: treeId }, select: { id: true } });
  if (!tree) return { ok: false, statusCode: 404, code: 'NOT_FOUND', message: 'Tree not found' };
  const role = await resolveTreeRole(userId, treeId);
  if (role !== 'owner') {
    return { ok: false, statusCode: 403, code: 'FORBIDDEN_TREE', message: 'Only the owner of this tree can decide proposals' };
  }
  return { ok: true, role };
}

function formatChangeProposal(proposal: ChangeProposal) {
  return {
    id: proposal.id,
    treeId: proposal.familyTreeId,
    proposerUserId: proposal.proposerUserId,
    targetType: proposal.targetType,
    targetId: proposal.targetId,
    before: JSON.parse(proposal.beforeJson) as unknown,
    after: JSON.parse(proposal.afterJson) as unknown,
    state: proposal.state,
    reasonNote: proposal.reasonNote,
    autoAccepted: proposal.autoAccepted,
    decidedByUserId: proposal.decidedByUserId,
    decidedAt: proposal.decidedAt ? proposal.decidedAt.toISOString() : null,
    decisionNote: proposal.decisionNote,
    createdAt: proposal.createdAt.toISOString(),
    updatedAt: proposal.updatedAt.toISOString(),
  };
}

/** The live row's proposal-field slice, frozen at propose time. */
function snapshotLiveRecord(targetType: ChangeTargetType, record: FamilyMember | FamilyRelationship): string {
  const fields = targetType === 'relationship' ? RELATIONSHIP_PROPOSAL_FIELDS : MEMBER_PROPOSAL_FIELDS;
  const snapshot: Record<string, unknown> = {};
  for (const field of fields) {
    snapshot[field] = (record as Record<string, unknown>)[field];
  }
  return canonicalizeSnapshotJson(snapshot);
}

/** Loads the live target row and checks it belongs to the tree. */
async function loadLiveTarget(
  targetType: ChangeTargetType,
  targetId: string,
  treeId: string,
): Promise<FamilyMember | FamilyRelationship | null> {
  if (targetType === 'member') {
    const member = await prisma.familyMember.findUnique({ where: { id: targetId } });
    return member !== null && member.treeId === treeId ? member : null;
  }
  const relationship = await prisma.familyRelationship.findUnique({ where: { id: targetId } });
  return relationship !== null && relationship.treeId === treeId ? relationship : null;
}

/** Active tree owners: the audience a new proposal must notify. */
async function activeTreeOwnerIds(treeId: string, excludeUserId: string): Promise<{ id: string }[]> {
  const owners = await prisma.treeMember.findMany({
    where: { treeId, role: 'owner' },
    select: { user: { select: { id: true, status: true } } },
  });
  return owners
    .map((owner) => owner.user)
    .filter((user) => user.status === 'active' && user.id !== excludeUserId)
    .map((user) => ({ id: user.id }));
}

/**
 * S-09a-ii: binds the pure consent wiring to the real infrastructure.
 * appendEvent stays the only writer of the Event table and the
 * Notification createMany stays the only projection write, so this sink
 * adds no new store, it just routes the drafts through the same gates
 * every other event type uses.
 */
const consentEventSink: ConsentEventSink = {
  appendEvent: (envelope) =>
    appendEvent(envelope.type, envelope.actorUserId, envelope.familyTreeId, envelope.payload),
  createNotifications: async (drafts) =>
    prisma.notification.createMany({
      data: drafts.map((d) => ({ userId: d.userId, type: d.type, payloadJson: d.payloadJson })),
    }),
};

/** Applies afterJson to the live row through the existing update path. */
async function applyProposalToLiveRecord(
  targetType: ChangeTargetType,
  targetId: string,
  afterJson: string,
): Promise<{ ok: true } | { ok: false; statusCode: number; code: string; message: string }> {
  const data = JSON.parse(afterJson) as Record<string, unknown>;
  try {
    if (targetType === 'member') {
      await prisma.familyMember.update({ where: { id: targetId }, data });
    } else {
      await prisma.familyRelationship.update({ where: { id: targetId }, data });
    }
    return { ok: true };
  } catch (e) {
    const message = (e as { code?: string }).code;
    if (message === 'P2025') {
      return { ok: false, statusCode: 410, code: 'CHANGE_TARGET_GONE', message: 'The record this proposal edits no longer exists' };
    }
    if (message === 'P2002') {
      return { ok: false, statusCode: 409, code: 'CHANGE_APPLY_CONFLICT', message: 'Applying this proposal would duplicate an existing relationship' };
    }
    throw e;
  }
}

app.post('/api/v1/trees/:treeId/change-proposals', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const { targetType, targetId, afterJson, reasonNote } = req.body ?? {};
    // Proposing needs the same write rights a direct edit needs: editor
    // or owner on this tree, per the ADR 0002 matrix.
    const action = targetType === 'relationship' ? 'create_relationship' : 'edit_member';
    const guard = await guardTreeAction(req.userId!, req.params.treeId, action);
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });

    if (!isChangeTargetType(targetType)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'targetType must be "member" or "relationship"' });
    }
    const reason = validateReasonNote(reasonNote);
    if (!reason.ok) return res.status(400).json({ code: 'VALIDATION_ERROR', message: reason.reason });
    const snapshotCheck = validateTargetSnapshot(targetType, afterJson);
    if (!snapshotCheck.ok) return res.status(400).json({ code: 'CHANGE_PAYLOAD_INVALID', message: snapshotCheck.reason });

    const live = await loadLiveTarget(targetType, targetId, req.params.treeId);
    if (!live) {
      return res.status(404).json({ code: 'CHANGE_TARGET_NOT_FOUND', message: 'Target record not found in this tree' });
    }

    // The permanent fence first: content the owner marked distinct on this
    // exact target is refused with 410, before any row is written.
    const distinctRows = await prisma.changeProposal.findMany({
      where: { familyTreeId: req.params.treeId, targetType, targetId, state: 'distinct' },
      select: { targetType: true, targetId: true, afterJson: true },
    });
    const reproposal = reviewNewProposal({
      targetType,
      targetId,
      afterJson: canonicalizeSnapshotJson(afterJson),
      distinctProposals: distinctRows.map((row) => ({
        targetType: row.targetType as ChangeTargetType,
        targetId: row.targetId,
        afterJson: row.afterJson,
      })),
    });
    if (!reproposal.allowed) {
      return res.status(410).json({
        code: reproposal.code,
        message: 'The owner marked this exact content as a different person or record; it cannot be proposed again',
      });
    }

    const beforeJson = snapshotLiveRecord(targetType, live);
    const canonicalAfter = canonicalizeSnapshotJson(afterJson);

    // Narrow auto-accept policy (ADR 0009): default off, editors never.
    const autoAccept = reviewAutoAccept({
      proposerTreeRole: guard.role,
      autoAcceptOptIn: AUTO_ACCEPT_DEFAULT,
    });

    if (autoAccept) {
      const applied = await applyProposalToLiveRecord(targetType, targetId, canonicalAfter);
      if (!applied.ok) return res.status(applied.statusCode).json({ code: applied.code, message: applied.message });
      const proposal = await prisma.changeProposal.create({
        data: {
          familyTreeId: req.params.treeId,
          proposerUserId: req.userId!,
          targetType,
          targetId,
          beforeJson,
          afterJson: canonicalAfter,
          state: 'pending',
          reasonNote: reason.value,
          autoAccepted: true,
          decidedByUserId: req.userId!,
          decidedAt: new Date(),
        },
      });
      await prisma.changeProposal.delete({ where: { id: proposal.id } });
      const event = buildChangeAcceptedEvent({
        actorUserId: req.userId!,
        familyTreeId: req.params.treeId,
        proposalId: proposal.id,
        targetType,
      });
      await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
      return res.status(201).json({ proposal: { ...formatChangeProposal(proposal), state: 'accepted' }, autoAccepted: true });
    }

    const proposal = await prisma.changeProposal.create({
      data: {
        familyTreeId: req.params.treeId,
        proposerUserId: req.userId!,
        targetType,
        targetId,
        beforeJson,
        afterJson: canonicalAfter,
        state: 'pending',
        reasonNote: reason.value,
      },
    });
    // Fact first, then the projection: notify the tree's active owners.
    const event = buildChangeProposedEvent({
      actorUserId: req.userId!,
      familyTreeId: req.params.treeId,
      proposalId: proposal.id,
      targetType,
    });
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    const owners = await activeTreeOwnerIds(req.params.treeId, req.userId!);
    const drafts = projectChangeNotifications(event, { treeOwners: owners, proposerUserId: req.userId! });
    if (drafts.length > 0) {
      await prisma.notification.createMany({ data: drafts });
    }
    res.status(201).json({ proposal: formatChangeProposal(proposal) });
  } catch (e) {
    res.status(500).json({ code: 'CHANGE_PROPOSAL_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/trees/:treeId/change-proposals', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    // Viewing the queue needs membership; the shape of the answer encodes
    // the role: owners review everything, editors track their own, viewers
    // get an honest 403 because there is nothing for them to act on.
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    if (guard.role === 'viewer') {
      return res.status(403).json({ code: 'FORBIDDEN_TREE', message: 'Viewers cannot list change proposals' });
    }
    const where =
      guard.role === 'owner'
        ? { familyTreeId: req.params.treeId }
        : { familyTreeId: req.params.treeId, proposerUserId: req.userId! };
    const proposals = await prisma.changeProposal.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ role: guard.role, proposals: proposals.map(formatChangeProposal) });
  } catch (e) {
    res.status(500).json({ code: 'CHANGE_PROPOSAL_ERROR', message: (e as Error).message });
  }
});

/** Shared pre-flight for the three decide endpoints. */
async function loadDecidableProposal(
  proposalId: string,
): Promise<{ proposal: ChangeProposal } | { statusCode: number; code: string; message: string }> {
  const proposal = await prisma.changeProposal.findUnique({ where: { id: proposalId } });
  if (!proposal) {
    return { statusCode: 404, code: 'CHANGE_PROPOSAL_NOT_FOUND', message: 'Proposal not found (accepted proposals are consumed and no longer listed)' };
  }
  return { proposal };
}

app.post('/api/v1/change-proposals/:id/accept', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const loaded = await loadDecidableProposal(req.params.id);
    if (!('proposal' in loaded)) {
      return res.status(loaded.statusCode).json({ code: loaded.code, message: loaded.message });
    }
    const proposal = loaded.proposal;
    const guard = await guardTreeOwner(req.userId!, proposal.familyTreeId);
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });

    const review = reviewChangeDecision({ state: proposal.state as 'pending' | 'rejected' | 'distinct', deciderIsTreeOwner: guard.ok, action: 'accept' });
    if (!review.allowed) {
      return res.status(409).json({ code: review.code, message: 'This proposal has already been decided and is closed' });
    }

    // Consume the row and apply the content in one commit: the updateMany
    // carries the state precondition, so two racing owners cannot both
    // accept (exactly one wins the row, the loser reads a clean 404).
    const consumed = await prisma.changeProposal.deleteMany({ where: { id: proposal.id, state: 'pending' } });
    if (consumed.count === 0) {
      return res.status(409).json({ code: 'CHANGE_ALREADY_DECIDED', message: 'This proposal has already been decided and is closed' });
    }
    const applied = await applyProposalToLiveRecord(proposal.targetType as ChangeTargetType, proposal.targetId, proposal.afterJson);
    if (!applied.ok) {
      // The gate stays honest: the row is gone, the live record did not
      // move, and the caller learns exactly which one failed.
      return res.status(applied.statusCode).json({ code: applied.code, message: applied.message });
    }

    const event = buildChangeAcceptedEvent({
      actorUserId: req.userId!,
      familyTreeId: proposal.familyTreeId,
      proposalId: proposal.id,
      targetType: proposal.targetType as ChangeTargetType,
    });
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    const drafts = projectChangeNotifications(event, {
      treeOwners: [],
      proposerUserId: proposal.proposerUserId,
    });
    if (drafts.length > 0) {
      await prisma.notification.createMany({ data: drafts });
    }
    res.json({ accepted: proposal.id });
  } catch (e) {
    res.status(500).json({ code: 'CHANGE_PROPOSAL_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/change-proposals/:id/reject', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const loaded = await loadDecidableProposal(req.params.id);
    if (!('proposal' in loaded)) {
      return res.status(loaded.statusCode).json({ code: loaded.code, message: loaded.message });
    }
    const proposal = loaded.proposal;
    const guard = await guardTreeOwner(req.userId!, proposal.familyTreeId);
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });

    const { decisionNote } = req.body ?? {};
    const note = validateDecisionNote(decisionNote);
    if (!note.ok) return res.status(400).json({ code: 'VALIDATION_ERROR', message: note.reason });
    if (note.value === '') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'decisionNote is required when rejecting a proposal' });
    }

    const review = reviewChangeDecision({ state: proposal.state as 'pending' | 'rejected' | 'distinct', deciderIsTreeOwner: guard.ok, action: 'reject' });
    if (!review.allowed) {
      return res.status(409).json({ code: review.code, message: 'This proposal has already been decided and is closed' });
    }

    const updated = await prisma.changeProposal.updateMany({
      where: { id: proposal.id, state: 'pending' },
      data: { state: 'rejected', decidedByUserId: req.userId!, decidedAt: new Date(), decisionNote: note.value },
    });
    if (updated.count === 0) {
      return res.status(409).json({ code: 'CHANGE_ALREADY_DECIDED', message: 'This proposal has already been decided and is closed' });
    }

    const event = buildChangeRejectedEvent({
      actorUserId: req.userId!,
      familyTreeId: proposal.familyTreeId,
      proposalId: proposal.id,
      targetType: proposal.targetType as ChangeTargetType,
    });
    await appendEvent(event.type, event.actorUserId, event.familyTreeId, event.payload);
    const drafts = projectChangeNotifications(event, {
      treeOwners: [],
      proposerUserId: proposal.proposerUserId,
    });
    if (drafts.length > 0) {
      await prisma.notification.createMany({ data: drafts });
    }
    const decided = await prisma.changeProposal.findUnique({ where: { id: proposal.id } });
    res.json({ proposal: decided === null ? null : formatChangeProposal(decided) });
  } catch (e) {
    res.status(500).json({ code: 'CHANGE_PROPOSAL_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/change-proposals/:id/distinct', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const loaded = await loadDecidableProposal(req.params.id);
    if (!('proposal' in loaded)) {
      return res.status(loaded.statusCode).json({ code: loaded.code, message: loaded.message });
    }
    const proposal = loaded.proposal;
    const guard = await guardTreeOwner(req.userId!, proposal.familyTreeId);
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });

    // A distinct verdict is its own explanation; a note may refine it but
    // the state itself is the permanent message to future proposers.
    const { decisionNote } = req.body ?? {};
    const note = validateDecisionNote(decisionNote);
    if (!note.ok) return res.status(400).json({ code: 'VALIDATION_ERROR', message: note.reason });

    const review = reviewChangeDecision({ state: proposal.state as 'pending' | 'rejected' | 'distinct', deciderIsTreeOwner: guard.ok, action: 'distinct' });
    if (!review.allowed) {
      return res.status(409).json({ code: review.code, message: 'This proposal has already been decided and is closed' });
    }

    const updated = await prisma.changeProposal.updateMany({
      where: { id: proposal.id, state: 'pending' },
      data: { state: 'distinct', decidedByUserId: req.userId!, decidedAt: new Date(), decisionNote: note.value === '' ? null : note.value },
    });
    if (updated.count === 0) {
      return res.status(409).json({ code: 'CHANGE_ALREADY_DECIDED', message: 'This proposal has already been decided and is closed' });
    }
    // No event: the vocabulary ships exactly three change facts and
    // "marked distinct" is a table-level fence, not an audited transition.
    const decided = await prisma.changeProposal.findUnique({ where: { id: proposal.id } });
    res.json({ proposal: decided === null ? null : formatChangeProposal(decided) });
  } catch (e) {
    res.status(500).json({ code: 'CHANGE_PROPOSAL_ERROR', message: (e as Error).message });
  }
});

// ─── Family Trees (per-tree scoped, P2-3 AC-6) ────────────
//
// Every route below is guarded by the ADR 0002 matrix through
// guardTreeAction: read needs any tree role, writes need editor or owner,
// destructive writes and administration need owner. Violations answer
// 403 FORBIDDEN_TREE; unknown trees answer 404.

app.get('/api/v1/trees', requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    // An active installation owner sees every tree (ADR 0002); everyone
    // else sees exactly the trees they hold a TreeMember row on. Either
    // way each row carries the caller's role on that tree (P2-5).
    const user = await prisma.user.findUnique({ where: { id: _req.userId! }, select: { role: true } });
    const memberships = await prisma.treeMember.findMany({
      where: { userId: _req.userId! },
      select: { treeId: true, role: true },
    });
    const roleByTree = new Map(memberships.map((m) => [m.treeId, m.role as TreeRole]));
    const fallback: TreeRole | null = user !== null && user.role === 'owner' ? 'owner' : null;
    if (user !== null && user.role === 'owner') {
      const trees = await prisma.familyTree.findMany({ orderBy: { createdAt: 'desc' } });
      return res.json(trees.map((t) => formatTree(t, roleByTree.get(t.id) ?? fallback)));
    }
    const trees = await prisma.familyTree.findMany({
      where: { id: { in: memberships.map((m) => m.treeId) } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trees.map((t) => formatTree(t, roleByTree.get(t.id) ?? fallback)));
  } catch (e) {
    res.status(500).json({ code: 'TREE_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/trees/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.id, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const t = await prisma.familyTree.findUnique({ where: { id: req.params.id } });
    if (!t) return res.status(404).json({ code: 'NOT_FOUND', message: 'Tree not found' });
    res.json(formatTree(t, guard.role));
  } catch (e) {
    res.status(500).json({ code: 'TREE_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/trees', requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { name, description } = req.body ?? {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name is required' });
    }
    // The creator is born tree owner: one transaction, two rows, so a tree
    // without an owner row can never exist (ADR 0004).
    const t = await prisma.$transaction(async (tx) => {
      const tree = await tx.familyTree.create({ data: { name, description } });
      await tx.treeMember.create({ data: { treeId: tree.id, userId: req.userId!, role: 'owner' } });
      return tree;
    });
    res.status(201).json(formatTree(t, 'owner'));
  } catch (e) {
    res.status(500).json({ code: 'TREE_ERROR', message: (e as Error).message });
  }
});

app.put('/api/v1/trees/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.id, 'update_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const { name, description } = req.body ?? {};
    const t = await prisma.familyTree.update({
      where: { id: req.params.id },
      data: { name, description },
    });
    // update_tree is owner-only in the matrix, so the caller's role here
    // is always owner.
    res.json(formatTree(t, 'owner'));
  } catch (e) {
    res.status(500).json({ code: 'TREE_ERROR', message: (e as Error).message });
  }
});

app.delete('/api/v1/trees/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.id, 'delete_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    await prisma.familyTree.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ code: 'TREE_ERROR', message: (e as Error).message });
  }
});

// ─── Tree membership management (P2-3 AC-6) ───────────────
//
// Owner-only surface: who holds which role on one tree. Role changes and
// removals pass TREE_LAST_OWNER_GUARD: a tree must never lose its only
// active owner account, otherwise it could not be administered anymore.

function formatTreeMembership(membership: TreeMember, user: { id: string; email: string; name: string; status: string }) {
  return {
    id: membership.id,
    treeId: membership.treeId,
    userId: membership.userId,
    role: membership.role,
    email: user.email,
    name: user.name,
    userStatus: user.status,
    createdAt: membership.createdAt.toISOString(),
  };
}

app.get('/api/v1/trees/:treeId/membership', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'manage_membership');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rows = await prisma.treeMember.findMany({
      where: { treeId: req.params.treeId },
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, email: true, name: true, status: true } } },
    });
    res.json({ members: rows.map((row) => formatTreeMembership(row, row.user)) });
  } catch (e) {
    res.status(500).json({ code: 'MEMBERSHIP_ERROR', message: (e as Error).message });
  }
});

app.put(
  '/api/v1/trees/:treeId/membership/:memberId',
  requireAuth,
  async (req: AuthenticatedRequest<{ treeId: string; memberId: string }>, res) => {
    try {
      const guard = await guardTreeAction(req.userId!, req.params.treeId, 'manage_membership');
      if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
      const { role } = req.body ?? {};
      if (!isTreeRole(role)) {
        return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'role must be "owner", "editor", or "viewer"' });
      }
      const membership = await prisma.treeMember.findUnique({ where: { id: req.params.memberId } });
      if (!membership || membership.treeId !== req.params.treeId) {
        return res.status(404).json({ code: 'MEMBERSHIP_NOT_FOUND', message: 'Tree membership not found' });
      }
      const otherActiveTreeOwnerCount = await prisma.treeMember.count({
        where: {
          treeId: req.params.treeId,
          role: 'owner',
          id: { not: membership.id },
          user: { status: 'active' },
        },
      });
      const decision = reviewTreeMembershipChange({
        targetTreeRole: membership.role as TreeRole,
        nextTreeRole: role,
        otherActiveTreeOwnerCount,
      });
      if (!decision.allowed) {
        return res.status(409).json({
          code: decision.code,
          message: 'Cannot demote the last active owner of this tree. Promote another member first.',
        });
      }
      const updated = await prisma.treeMember.update({
        where: { id: membership.id },
        data: { role },
        include: { user: { select: { id: true, email: true, name: true, status: true } } },
      });
      res.json({ membership: formatTreeMembership(updated, updated.user) });
    } catch (e) {
      res.status(500).json({ code: 'MEMBERSHIP_ERROR', message: (e as Error).message });
    }
  },
);

app.delete(
  '/api/v1/trees/:treeId/membership/:memberId',
  requireAuth,
  async (req: AuthenticatedRequest<{ treeId: string; memberId: string }>, res) => {
    try {
      const guard = await guardTreeAction(req.userId!, req.params.treeId, 'manage_membership');
      if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
      const membership = await prisma.treeMember.findUnique({ where: { id: req.params.memberId } });
      if (!membership || membership.treeId !== req.params.treeId) {
        return res.status(404).json({ code: 'MEMBERSHIP_NOT_FOUND', message: 'Tree membership not found' });
      }
      const otherActiveTreeOwnerCount = await prisma.treeMember.count({
        where: {
          treeId: req.params.treeId,
          role: 'owner',
          id: { not: membership.id },
          user: { status: 'active' },
        },
      });
      const decision = reviewTreeMembershipChange({
        targetTreeRole: membership.role as TreeRole,
        nextTreeRole: null,
        otherActiveTreeOwnerCount,
      });
      if (!decision.allowed) {
        return res.status(409).json({
          code: decision.code,
          message: 'Cannot remove the last active owner of this tree. Promote another member first.',
        });
      }
      await prisma.treeMember.delete({ where: { id: membership.id } });
      res.status(204).send();
    } catch (e) {
      res.status(500).json({ code: 'MEMBERSHIP_ERROR', message: (e as Error).message });
    }
  },
);

// ─── Family Members (per-tree scoped, P2-3 AC-6) ──────────

app.get('/api/v1/trees/:treeId/members', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    // Privacy read wiring v261-i: redaksi berbasis relasi viewer (gap 3).
    // Viewer diidentifikasi lewat email User vs FamilyMember.email;
    // relasi viewer-target dari tabel FamilyRelationship.
    const [members, relationships, viewer] = await Promise.all([
      prisma.familyMember.findMany({ where: { treeId: req.params.treeId }, orderBy: { generation: 'asc' } }),
      prisma.familyRelationship.findMany({ where: { treeId: req.params.treeId } }),
      prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } }),
    ]);
    const viewerRelationInput = {
      viewerEmail: viewer?.email ?? null,
      members: members.map((m) => ({ id: m.id, email: m.email })),
      relationships: relationships.map((r) => ({ memberId: r.memberId, relatedId: r.relatedId, type: r.type })),
    };
    const visible = members
      .map((m) => {
        const relation = resolveViewerRelation({ ...viewerRelationInput, targetMemberId: m.id });
        const minimal = {
          id: m.id,
          treeId: m.treeId,
          name: m.name,
          isAlive: m.isAlive,
          privacyStatus: m.privacyStatus,
          generation: m.generation,
          gender: m.gender,
        };
        const decision = applyMemberVisibility(minimal, relation);
        if (decision === null) return null;
        // 'full' mengembalikan objek input apa adanya (referensi sama):
        // respons utuh memakai formatMember penuh sesuai kontrak.
        return decision === minimal ? formatMember(m) : decision;
      })
      .filter((m) => m !== null);
    res.json(visible);
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

// ─── Living stats (v268 fase ii, read-only aggregate) ─────
//
// GET /api/v1/trees/:treeId/stats/living returns ONLY aggregate numbers
// computed by the pure module src/lib/stats/living-stats.ts (v267 fase i).
// No per-member fields (id, name, birthDate) are exposed in the body:
// this implements gap 3 privacy for the stats surface. Read-only: no
// writes, no schema change, no new dependency.

// v272 fase i (stats hardening): challenge header khusus route ini.
// RFC 9110 mewajibkan 401 membawa WWW-Authenticate. requireAuth global
// sengaja tidak diubah supaya semua route lain tetap baseline; wrapper
// lokal ini hanya memantau res.status(401) pada jalur stats/living dan
// menambah header, body { code, message } pola repo tetap utuh.
function requireAuthStatsLiving(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const originalStatus = res.status.bind(res);
  res.status = function statusWithChallenge(code: number) {
    if (code === 401) res.set('WWW-Authenticate', 'Bearer');
    return originalStatus(code);
  } as typeof res.status;
  requireAuth(req as AuthenticatedRequest, res, next);
}

app.get('/api/v1/trees/:treeId/stats/living', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const members = await prisma.familyMember.findMany({
      where: { treeId: req.params.treeId },
      select: { birthDate: true, deathDate: true, isAlive: true, generation: true },
    });
    const stats = computeLivingStats(
      members.map((m) => ({ birthDate: m.birthDate, deathDate: m.deathDate, isAlive: m.isAlive, generation: m.generation })),
    );
    const rawLang = req.query['lang'];
    const lang = (typeof rawLang === 'string' && rawLang.length > 0 ? rawLang : (req.headers['accept-language'] ?? '')).toLowerCase();
    const avgLifespanLabel = lang.startsWith('en') ? 'Average age at death' : 'Rata-rata umur saat meninggal';
    // v272 fase i: agregat non-PII, cache private dengan revalidasi 304.
    // no-cache memaksa revalidasi tiap request; tanpa public, tanpa
    // s-maxage, tanpa max-age positif.
    res.set('Cache-Control', 'private, no-cache');
    // v272 fase i: ETag strong dari hash payload (node:crypto, bawaan Node).
    // Express 5.2.1 pada repo ini terbukti tidak mengonversi If-None-Match
    // menjadi 304 (verifikasi empiris tmp_debug_304), jadi perbandingan
    // dilakukan eksplisit di sini: payload sama dijawab 304 tanpa body,
    // sesuai RFC 9110 dan AC kontrak v272.
    const body = JSON.stringify({ ...stats, avgLifespanLabel });
    const etag = `"${createHash('sha256').update(body).digest('hex')}"`;
    res.set('ETag', etag);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => t.trim() === etag)) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'LIVING_STATS_ERROR', message: (e as Error).message });
  }
});

// ─── Upcoming birthdays (v273 fase i, read-only) ─────────
//
// GET /api/v1/trees/:treeId/stats/birthdays/upcoming returns the next
// birthdays among living members, computed by the pure module
// src/lib/stats/upcoming-birthdays.ts. Pola persis route stats/living:
// guardTreeAction untuk 403 non-anggota (tanpa WWW-Authenticate),
// requireAuthStatsLiving supaya 401 jalur ini membawa challenge Bearer.
// Query days opsional default 30, rentang sah 1 sampai 365 inklusif;
// di luar rentang atau non-integer dijawab 422 body { code, message }.
app.get('/api/v1/trees/:treeId/stats/birthdays/upcoming', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rawDays = req.query['days'];
    const days = rawDays === undefined ? 30 : Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(422).json({ code: 'INVALID_DAYS', message: 'days must be an integer between 1 and 365' });
    }
    const members = await prisma.familyMember.findMany({
      where: { treeId: req.params.treeId, isAlive: true },
      select: { id: true, name: true, birthDate: true },
    });
    const entries = computeUpcomingBirthdays(
      members.map((m) => ({ personId: m.id, displayName: m.name, birthDate: m.birthDate })),
      new Date(),
      days,
    );
    // v273 fase i: cache private dengan revalidasi 304, ETag weak dari
    // hash payload, If-None-Match cocok (dengan atau tanpa prefix W/,
    // perbandingan weak) dijawab 304 tanpa body sesuai RFC 9110.
    const body = JSON.stringify(entries);
    const etag = `W/"${createHash('sha256').update(body).digest('hex')}"`;
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', etag);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      return candidate === etag || candidate === etag.slice(2);
    })) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'BIRTHDAYS_ERROR', message: (e as Error).message });
  }
});

// ─── Upcoming wedding anniversaries (v275 fase i, read-only) ─────────
//
// GET /api/v1/trees/:treeId/stats/anniversaries/upcoming returns the next
// wedding anniversaries among living couples, computed by the pure module
// src/lib/stats/upcoming-anniversaries.ts. Pola persis route birthdays:
// guardTreeAction untuk 403 non-anggota (tanpa WWW-Authenticate),
// requireAuthStatsLiving supaya 401 jalur ini membawa challenge Bearer.
// Query days opsional default 30, rentang sah 1 sampai 365 inklusif;
// di luar rentang atau non-integer dijawab 422 body { code, message }.
// Sumber data LifeEvent MARRIAGE (LifeEvent belum punya relasi member di
// schema): dua query terpisah, events dengan include date lalu
// familyMember by ids; tanpa relasi prisma baru.
app.get('/api/v1/trees/:treeId/stats/anniversaries/upcoming', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rawDays = req.query['days'];
    const days = rawDays === undefined ? 30 : Number(rawDays);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return res.status(422).json({ code: 'INVALID_DAYS', message: 'days must be an integer between 1 and 365' });
    }
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId, eventType: 'MARRIAGE', partnerMemberId: { not: null } },
      include: { date: true },
    });
    const idSet = new Set<string>();
    for (const ev of events) {
      if (ev.memberId) idSet.add(ev.memberId);
      if (ev.partnerMemberId) idSet.add(ev.partnerMemberId);
    }
    const members = idSet.size === 0
      ? []
      : await prisma.familyMember.findMany({ where: { id: { in: Array.from(idSet) } }, select: { id: true, name: true, isAlive: true } });
    const byId = new Map(members.map((m) => [m.id, m]));
    const pairs = new Map<string, { pairId: string; partnerNames: [string, string]; marriageDate: string }>();
    for (const ev of events) {
      if (!ev.partnerMemberId) continue;
      const date = ev.date;
      if (!date || date.dateKind !== 'EXACT') continue;
      if (date.yearStart === null || date.monthStart === null || date.dayStart === null) continue;
      const a = byId.get(ev.memberId);
      const b = byId.get(ev.partnerMemberId);
      if (!a || !a.isAlive || !b || !b.isAlive) continue;
      const marriageDate = `${String(date.yearStart).padStart(4, '0')}-${String(date.monthStart).padStart(2, '0')}-${String(date.dayStart).padStart(2, '0')}`;
      const pairId = [ev.memberId, ev.partnerMemberId].sort().join(':');
      const partnerNames: [string, string] = pairId.split(':')[0] === ev.memberId ? [a.name, b.name] : [b.name, a.name];
      if (!pairs.has(pairId)) pairs.set(pairId, { pairId, partnerNames, marriageDate });
    }
    const entries = computeUpcomingAnniversaries(Array.from(pairs.values()), new Date(), days);
    // v275 fase i: cache private dengan revalidasi 304, ETag weak dari
    // hash payload, If-None-Match cocok (dengan atau tanpa prefix W/,
    // perbandingan weak) dijawab 304 tanpa body sesuai RFC 9110.
    const body = JSON.stringify(entries);
    const etag = `W/"${createHash('sha256').update(body).digest('hex')}"`;
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', etag);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      return candidate === etag || candidate === etag.slice(2);
    })) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'ANNIVERSARIES_ERROR', message: (e as Error).message });
  }
});

// ─── Citation coverage (v281 fase ii, read-only aggregate) ───────────
//
// GET /api/v1/trees/:treeId/stats/citation-coverage returns the percentage
// of individuals covered by a citation, computed by the pure module
// src/lib/stats/citation-coverage.ts (v279). Pola persis route anniversaries:
// guardTreeAction untuk 403 non-anggota (tanpa WWW-Authenticate),
// requireAuthStatsLiving supaya 401 jalur ini membawa challenge Bearer.
// Sumber data dua query select minimal: familyMember (id saja) dan lifeEvent
// (memberId, citationId saja), tanpa relasi prisma baru, tanpa kolom baru.
// Cache private dengan revalidasi 304, ETag weak dari hash payload.
// Addendum v281: respons 304 menyertakan ulang header ETag dan Cache-Control
// (header setara 200 per RFC 9111); pencocokan If-None-Match pada nilai hex,
// prefix W/ dari klien diabaikan.
app.get('/api/v1/trees/:treeId/stats/citation-coverage', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const members = await prisma.familyMember.findMany({
      where: { treeId: req.params.treeId },
      select: { id: true },
    });
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId },
      select: { memberId: true, citationId: true },
    });
    const coverage = computeCitationCoverage(members, events);
    const body = JSON.stringify({ coverage });
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `W/"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // Header ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'CITATION_COVERAGE_ERROR', message: (e as Error).message });
  }
});

// ─── Generations (v284 fase ii, read-only aggregate) ──────────────────────
//
// GET /api/v1/trees/:treeId/stats/generations returns the number of
// generations, computed by the pure module src/lib/stats/generations.ts
// (v282). Pola persis route citation-coverage (v281): guardTreeAction
// untuk 403 non-anggota (tanpa WWW-Authenticate), requireAuthStatsLiving
// supaya 401 jalur ini membawa challenge Bearer. Sumber data satu query
// select minimal: familyRelationship (memberId, relatedId, type saja).
// Semantik relasi (kontrak v284): type 'parent' berarti memberId orang
// tua dari relatedId (edge childId relatedId, parentId memberId), type
// 'child' kebalikannya, type lain diabaikan. Respons agregat non-PII
// hanya { generationCount }, tanpa depthByMember atau field per anggota.
// Cache private dengan revalidasi 304, ETag STRONG dari hash body.
// Addendum RFC 9111: 304 mengulang header ETag dan Cache-Control.
app.get('/api/v1/trees/:treeId/stats/generations', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rels = await prisma.familyRelationship.findMany({
      where: { treeId: req.params.treeId },
      select: { memberId: true, relatedId: true, type: true },
    });
    const edges: { childId: string; parentId: string }[] = [];
    for (const r of rels) {
      if (r.type === 'parent') {
        edges.push({ childId: r.relatedId, parentId: r.memberId });
      } else if (r.type === 'child') {
        edges.push({ childId: r.memberId, parentId: r.relatedId });
      }
    }
    const { generationCount } = computeGenerations(edges);
    const body = JSON.stringify({ generationCount });
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // Header ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'GENERATIONS_ERROR', message: (e as Error).message });
  }
});

// ─── Family Size (v288 fase ii, read-only aggregate) ──────────────────────
//
// GET /api/v1/trees/:treeId/stats/family-size mengembalikan agregat
// ukuran keluarga dari modul pure src/lib/stats/family-size-stats.ts
// (v287). Pola persis route generations (v284): guardTreeAction untuk
// 403 non-anggota (tanpa WWW-Authenticate), requireAuthStatsLiving
// supaya 401 jalur ini membawa challenge Bearer. Sumber data satu query
// select minimal: familyRelationship (memberId, relatedId, type saja).
// Semantik pembentukan keluarga (kontrak kukuh v288): type 'parent'
// berarti memberId orang tua dari relatedId, type 'child' kebalikannya,
// keduanya mengisi childToParents (anak ke set ortu ternormalisasi
// sorted), type lain diabaikan. Family key A: tiap set ortu unik satu
// keluarga, childIds diisi anak yang berbagi set itu. Family key B:
// tiap pasangan spouse sorted pair yang tidak muncul sebagai key A
// manapun jadi keluarga tanpa anak (childIds kosong). Unit keluarga
// dikirim ke computeFamilySizeStats; null modul (nihil keluarga)
// direpresentasikan familyCount 0, average dan median null, max 0,
// distribution nol semua (keputusan PM v288). Respons agregat non-PII
// tanpa field individu. Cache private dengan revalidasi 304, ETag
// STRONG dari hash body, 304 mengulang ETag dan Cache-Control per
// addendum RFC 9111 (pola v281 v284).
function buildFamilyUnits(rels: { memberId: string; relatedId: string; type: string }[]): { childIds: string[] }[] {
  // childToParents: anak ke set ortu ternormalisasi (dedupe, lalu sorted
  // saat membentuk key).
  const childToParents = new Map<string, Set<string>>();
  for (const r of rels) {
    if (r.type === 'parent') {
      const set = childToParents.get(r.relatedId) ?? new Set<string>();
      set.add(r.memberId);
      childToParents.set(r.relatedId, set);
    } else if (r.type === 'child') {
      const set = childToParents.get(r.memberId) ?? new Set<string>();
      set.add(r.relatedId);
      childToParents.set(r.memberId, set);
    }
  }
  // Family key A: tiap set ortu unik satu keluarga, childIds = anak
  // yang berbagi set ortu itu.
  const familyA = new Map<string, string[]>();
  for (const [childId, parents] of childToParents) {
    const key = [...parents].sort().join('|');
    const bucket = familyA.get(key);
    if (bucket) bucket.push(childId);
    else familyA.set(key, [childId]);
  }
  const units: { childIds: string[] }[] = [...familyA.values()].map((childIds) => ({ childIds }));
  // Family key B: pasangan spouse sorted pair yang tidak sama dengan
  // key A manapun, childIds kosong. Key yang sudah dipakai (A maupun B)
  // dicatat supaya baris spouse ganda tidak menciptakan unit kembar.
  const seenKeys = new Set(familyA.keys());
  for (const r of rels) {
    if (r.type !== 'spouse') continue;
    const pair = [r.memberId, r.relatedId].sort().join('|');
    if (!seenKeys.has(pair)) {
      seenKeys.add(pair);
      units.push({ childIds: [] });
    }
  }
  return units;
}

app.get('/api/v1/trees/:treeId/stats/family-size', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rels = await prisma.familyRelationship.findMany({
      where: { treeId: req.params.treeId },
      select: { memberId: true, relatedId: true, type: true },
    });
    const stats = computeFamilySizeStats(buildFamilyUnits(rels));
    const payload = stats ?? {
      average: null,
      median: null,
      max: 0,
      distribution: { zero: 0, oneToTwo: 0, threeToFour: 0, fivePlus: 0 },
      familyCount: 0,
      excludedCount: 0,
    };
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // Header ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'FAMILY_SIZE_ERROR', message: (e as Error).message });
  }
});

// ─── Oldest living (v302 fase ii, read-only ranked list) ─────────────
//
// GET /api/v1/trees/:treeId/stats/oldest-living mengembalikan peringkat
// anggota hidup tertua dari modul pure src/lib/stats/oldest-living.ts
// (v301 fase i, TIDAK diubah). Pola persis route stats/living dan
// family-size: guardTreeAction 'view_tree' untuk 403 non-anggota (tanpa
// WWW-Authenticate), requireAuthStatsLiving supaya 401 jalur ini
// membawa challenge Bearer. Select minimal: id, birthDate, isAlive,
// privacyStatus, tanpa relasi. Filter server sebelum modul: isAlive
// true DAN privacyStatus tidak sama dengan 'private' (gap 3, konsisten
// src/lib/privacy/exportPrivacyGate.ts: private = redact), sehingga
// anggota privat tidak bocor meski paling tua. Query topN integer 1
// sampai 50, default 10; non-integer atau di luar rentang dijawab 400
// { code: 'INVALID_TOP_N' }. Output { results: [{ id, ageYears }] }
// tanpa name, birthDate, atau field PII lain; id eksplisit diizinkan
// untuk join sisi klien yang berotorisasi (keputusan kontrak v302).
// Cache private no-cache, ETag strong sha256 body, If-None-Match cocok
// dijawab 304 eksplisit (pola v288).
app.get('/api/v1/trees/:treeId/stats/oldest-living', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rawTopN = req.query['topN'];
    const topN = rawTopN === undefined ? 10 : Number(rawTopN);
    if (!Number.isInteger(topN) || topN < 1 || topN > 50) {
      return res.status(400).json({ code: 'INVALID_TOP_N', message: 'topN must be an integer between 1 and 50' });
    }
    const members = await prisma.familyMember.findMany({
      where: { treeId: req.params.treeId },
      select: { id: true, birthDate: true, isAlive: true, privacyStatus: true },
    });
    const kandidat = members
      .filter((m) => m.isAlive && m.privacyStatus !== 'private')
      .map((m) => ({ id: m.id, birthDate: m.birthDate, isAlive: m.isAlive }));
    const results = computeOldestLiving(kandidat, topN);
    const body = JSON.stringify({ results });
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'OLDEST_LIVING_API_ERROR', message: (e as Error).message });
  }
});

// ─── Stats By-Century dari LifeEvent (v383, read-only aggregate) ──────────
//
// GET /api/v1/trees/:treeId/stats/births-by-century, deaths-by-century,
// weddings-by-century, divorces-by-century: empat agregasi abad kini
// dilayani dari baris LifeEvent via modul pure event-entity-reads
// (v381 v382, TIDAK diubah), memotong sumber kebenaran API ke entity
// sesuai fase wiring GAP 0.6 ADR 0011. Pola persis route marriage-months
// (v291): requireAuthStatsLiving supaya 401 membawa challenge Bearer,
// guardTreeAction view_tree untuk 403 non-anggota (tanpa
// WWW-Authenticate). Sumber data satu query lifeEvent per eventType
// (BIRTH DEATH MARRIAGE DIVORCE) include date, pemetaan EntityEventInput
// tanpa N+1 dan tanpa relasi prisma baru. Respons agregat non-PII dari
// compute*ByCenturyFromEvents. Cache private dengan revalidasi 304, ETag
// STRONG dari hash body, 304 mengulang ETag dan Cache-Control per RFC 9111.
//
// v384 cutover: env STATS_READ_SOURCE (entity | legacy, default entity)
// memilih jalur agregasi. legacy menjalankan compute legacy existing
// atas rekaman yang dipetakan dari baris LifeEvent yang sama
// (isoDateFromPartial hanya EXACT lengkap, familyId pola parity),
// menjadi jalur rollback instan tanpa redeploy (restart cukup).
// Path dan kontrak respons tidak berubah di kedua jalur.

// GET /api/v1/trees/:treeId/stats/births-by-century dari LifeEvent BIRTH.
app.get('/api/v1/trees/:treeId/stats/births-by-century', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId, eventType: 'BIRTH' },
      include: { date: true },
    });
    const rows: EntityEventInput[] = events.map((ev) => ({
      subjectId: ev.memberId,
      partnerSubjectId: ev.partnerMemberId,
      dateKind: ev.date?.dateKind ?? null,
      yearStart: ev.date?.yearStart ?? null,
      monthStart: ev.date?.monthStart ?? null,
      dayStart: ev.date?.dayStart ?? null,
    }));
    const payload = resolveReadSource(process.env['STATS_READ_SOURCE']) === 'legacy'
      ? computeBirthsByCentury(events.map((ev) => ({
          personId: ev.memberId,
          birthDate: isoDateFromPartial(ev.date?.dateKind ?? null, ev.date?.yearStart ?? null, ev.date?.monthStart ?? null, ev.date?.dayStart ?? null),
        })))
      : computeBirthsByCenturyFromEvents(rows);
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'BIRTHS_BY_CENTURY_ERROR', message: (e as Error).message });
  }
});

// GET /api/v1/trees/:treeId/stats/deaths-by-century dari LifeEvent DEATH.
app.get('/api/v1/trees/:treeId/stats/deaths-by-century', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId, eventType: 'DEATH' },
      include: { date: true },
    });
    const rows: EntityEventInput[] = events.map((ev) => ({
      subjectId: ev.memberId,
      partnerSubjectId: ev.partnerMemberId,
      dateKind: ev.date?.dateKind ?? null,
      yearStart: ev.date?.yearStart ?? null,
      monthStart: ev.date?.monthStart ?? null,
      dayStart: ev.date?.dayStart ?? null,
    }));
    const payload = resolveReadSource(process.env['STATS_READ_SOURCE']) === 'legacy'
      ? computeDeathsByCentury(events.map((ev) => ({
          personId: ev.memberId,
          deathDate: isoDateFromPartial(ev.date?.dateKind ?? null, ev.date?.yearStart ?? null, ev.date?.monthStart ?? null, ev.date?.dayStart ?? null),
        })))
      : computeDeathsByCenturyFromEvents(rows);
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'DEATHS_BY_CENTURY_ERROR', message: (e as Error).message });
  }
});

// GET /api/v1/trees/:treeId/stats/weddings-by-century dari LifeEvent MARRIAGE
// berpasangan (partnerMemberId not null, pola anniversaries v275).
app.get('/api/v1/trees/:treeId/stats/weddings-by-century', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId, eventType: 'MARRIAGE', partnerMemberId: { not: null } },
      include: { date: true },
    });
    const rows: EntityEventInput[] = events.map((ev) => ({
      subjectId: ev.memberId,
      partnerSubjectId: ev.partnerMemberId,
      dateKind: ev.date?.dateKind ?? null,
      yearStart: ev.date?.yearStart ?? null,
      monthStart: ev.date?.monthStart ?? null,
      dayStart: ev.date?.dayStart ?? null,
    }));
    const payload = resolveReadSource(process.env['STATS_READ_SOURCE']) === 'legacy'
      ? computeWeddingsByCentury(events.map((ev) => ({
          familyId: ev.partnerMemberId ? `${ev.memberId}<${ev.partnerMemberId}>` : ev.memberId,
          marriageDate: isoDateFromPartial(ev.date?.dateKind ?? null, ev.date?.yearStart ?? null, ev.date?.monthStart ?? null, ev.date?.dayStart ?? null),
        })))
      : computeWeddingsByCenturyFromEvents(rows);
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'WEDDINGS_BY_CENTURY_ERROR', message: (e as Error).message });
  }
});

// GET /api/v1/trees/:treeId/stats/divorces-by-century dari LifeEvent DIVORCE
// berpasangan (partnerMemberId not null).
app.get('/api/v1/trees/:treeId/stats/divorces-by-century', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId, eventType: 'DIVORCE', partnerMemberId: { not: null } },
      include: { date: true },
    });
    const rows: EntityEventInput[] = events.map((ev) => ({
      subjectId: ev.memberId,
      partnerSubjectId: ev.partnerMemberId,
      dateKind: ev.date?.dateKind ?? null,
      yearStart: ev.date?.yearStart ?? null,
      monthStart: ev.date?.monthStart ?? null,
      dayStart: ev.date?.dayStart ?? null,
    }));
    const payload = resolveReadSource(process.env['STATS_READ_SOURCE']) === 'legacy'
      ? computeDivorcesByCentury(events.map((ev) => ({
          familyId: ev.partnerMemberId ? `${ev.memberId}<${ev.partnerMemberId}>` : ev.memberId,
          divorceDate: isoDateFromPartial(ev.date?.dateKind ?? null, ev.date?.yearStart ?? null, ev.date?.monthStart ?? null, ev.date?.dayStart ?? null),
        })))
      : computeDivorcesByCenturyFromEvents(rows);
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'DIVORCES_BY_CENTURY_ERROR', message: (e as Error).message });
  }
});

// ─── Marriage Months (v291 fase ii, read-only aggregate) ───────────────────
//
// GET /api/v1/trees/:treeId/stats/marriage-months mengembalikan distribusi
// bulan pernikahan pertama per orang dari modul pure
// src/lib/stats/marriage-months.ts (v283, TIDAK diubah). Pola persis route
// family-size (v288): guardTreeAction untuk 403 non-anggota (tanpa
// WWW-Authenticate), requireAuthStatsLiving supaya 401 jalur ini membawa
// challenge Bearer. Sumber data satu query lifeEvent MARRIAGE berpasangan
// (pola route anniversaries v275): partnerMemberId not null, include date.
// Pemetaan per event ke MarriagePairInput TANPA filter dateKind di server
// (modul yang memfilter monthStart): pairId spouse sorted pair, dateKind dan
// yearStart monthStart dayStart dari PartialDate, boleh null. Respons JSON:
// countsByMonth (12 key GEDCOM JAN..DEC), marriageCount, excludedCount.
// Agregat non-PII tanpa field individu. Cache private dengan revalidasi
// 304, ETag STRONG dari hash body, 304 mengulang ETag dan Cache-Control
// per addendum RFC 9111 (pola v288 v281 v284).
app.get('/api/v1/trees/:treeId/stats/marriage-months', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const events = await prisma.lifeEvent.findMany({
      where: { treeId: req.params.treeId, eventType: 'MARRIAGE', partnerMemberId: { not: null } },
      include: { date: true },
    });
    const pairs: MarriagePairInput[] = events.map((ev) => {
      const sortedPair = [ev.memberId, ev.partnerMemberId as string].sort();
      return {
        pairId: sortedPair.join(':'),
        spouseAId: sortedPair[0],
        spouseBId: sortedPair[1],
        dateKind: ev.date?.dateKind ?? '',
        yearStart: ev.date?.yearStart ?? null,
        monthStart: ev.date?.monthStart ?? null,
        dayStart: ev.date?.dayStart ?? null,
      };
    });
    const payload = computeMarriageMonths(pairs);
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // Header ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'MARRIAGE_MONTHS_ERROR', message: (e as Error).message });
  }
});

// ─── Tree Health (v293 fase ii, read-only aggregate) ───────────────────────
//
// GET /api/v1/trees/:treeId/stats/tree-health mengembalikan kedalaman
// generasi dan kelengkapan pedigree dari modul pure
// src/lib/genealogy/tree-health.ts (v292, TIDAK diubah). Pola persis
// route marriage-months (v291): requireAuthStatsLiving supaya 401
// jalur ini membawa challenge Bearer, guardTreeAction view_tree untuk
// 403 non-anggota (tanpa WWW-Authenticate). Data dua query: familyMember
// select id dan familyRelationship select memberId relatedId type, keduanya
// difilter treeId. Pemetaan graph server-side inline: baris type 'parent'
// dikelompokkan per anak (relatedId = child, memberId daftar parents),
// baris spouse diabaikan karena kedua fungsi health hanya membaca
// parentEdges; unions kosong dan personIds dari daftar member id.
// Respons agregat { rootId, maxGenerations, generationDepth,
// pedigreeCompleteness } tanpa field individu. Cache private dengan
// revalidasi 304, ETag STRONG dari hash body, 304 mengulang ETag dan
// Cache-Control per RFC 9111 (pola v288 v291).
app.get('/api/v1/trees/:treeId/stats/tree-health', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rootId = req.query['rootId'];
    if (typeof rootId !== 'string' || rootId.length === 0) {
      return res.status(400).json({ code: 'TREE_HEALTH_ROOT_REQUIRED', message: 'Query param rootId wajib diisi' });
    }
    let maxGenerations = 8;
    const rawMaxGen = req.query['maxGenerations'];
    if (rawMaxGen !== undefined) {
      const parsed = Number(rawMaxGen);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 20) {
        return res.status(400).json({ code: 'TREE_HEALTH_MAXGEN_INVALID', message: 'maxGenerations harus integer 1 sampai 20' });
      }
      maxGenerations = parsed;
    }
    const [members, relationships] = await Promise.all([
      prisma.familyMember.findMany({ where: { treeId: req.params.treeId }, select: { id: true } }),
      prisma.familyRelationship.findMany({
        where: { treeId: req.params.treeId },
        select: { memberId: true, relatedId: true, type: true },
      }),
    ]);
    const personIds = members.map((m) => m.id);
    if (!personIds.includes(rootId)) {
      return res.status(404).json({ code: 'ROOT_NOT_FOUND', message: 'Root tidak ditemukan di tree ini' });
    }
    const parentEdges: ParentEdge[] = [];
    const parentsByChild = new Map<string, string[]>();
    for (const rel of relationships) {
      if (rel.type !== 'parent') continue;
      const list = parentsByChild.get(rel.relatedId) ?? [];
      list.push(rel.memberId);
      parentsByChild.set(rel.relatedId, list);
    }
    for (const [child, parents] of parentsByChild) {
      parentEdges.push({ child, fam: child, parents, pedi: 'birth' });
    }
    const graph: FamilyGraph = { personIds, unions: [], parentEdges };
    const payload = {
      rootId,
      maxGenerations,
      generationDepth: computeGenerationDepth(graph, rootId),
      pedigreeCompleteness: computePedigreeCompleteness(graph, rootId, maxGenerations),
    };
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // Header ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'TREE_HEALTH_ERROR', message: (e as Error).message });
  }
});

// Children per family (v306 fase ii, distribusi agregat).
//
// GET /api/v1/trees/:treeId/stats/children-per-family mengembalikan
// distribusi jumlah anak per keluarga dari modul pure
// src/lib/stats/children-per-family.ts (v297 fase i, TIDAK diubah).
// Keluarga dibentuk lewat helper existing buildFamilyUnits (TIDAK
// diubah), select minimal pola family-size. Output
// { distribution: [{ children, familyCount }], familyCount, average }
// tanpa field PII apa pun (tidak ada id anggota, nama, tanggal).
// Tree kosong menghasilkan payload nol langsung dari modul. Endpoint
// tree-wide tanpa query param sehingga tidak ada kasus 400.
// Cache private no-cache, ETag strong sha256 body, If-None-Match cocok
// dijawab 304 eksplisit (pola family-size dan v288).
app.get('/api/v1/trees/:treeId/stats/children-per-family', requireAuthStatsLiving, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rels = await prisma.familyRelationship.findMany({
      where: { treeId: req.params.treeId },
      select: { memberId: true, relatedId: true, type: true },
    });
    const payload = computeChildrenPerFamilyDistribution(buildFamilyUnits(rels));
    const body = JSON.stringify(payload);
    const etagHex = createHash('sha256').update(body).digest('hex');
    res.set('Cache-Control', 'private, no-cache');
    res.set('ETag', `"${etagHex}"`);
    const inm = req.headers['if-none-match'];
    if (inm && inm.split(',').some((t) => {
      const candidate = t.trim();
      const candidateHex = (candidate.startsWith('W/') ? candidate.slice(2) : candidate).replaceAll('"', '');
      return candidateHex === etagHex;
    })) {
      // Header ETag dan Cache-Control sudah diset sebelum cabang ini sehingga
      // 304 membawa ulang keduanya, setara 200 per RFC 9111.
      return res.status(304).end();
    }
    res.set('Content-Type', 'application/json; charset=utf-8');
    return res.send(body);
  } catch (e) {
    res.status(500).json({ code: 'CHILDREN_PER_FAMILY_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/members/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const m = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
    if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    const guard = await guardTreeAction(req.userId!, m.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    // Privacy read wiring v261-i: hidden direspons 404 bentuk identik
    // dengan member nihil (anti-enumerasi); self dan deceased lolos penuh
    // lewat urutan aturan v260-i.
    const [viewer, relationships] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.userId! }, select: { email: true } }),
      prisma.familyRelationship.findMany({ where: { treeId: m.treeId } }),
    ]);
    const treeMembers = await prisma.familyMember.findMany({
      where: { treeId: m.treeId },
      select: { id: true, email: true },
    });
    const relation = resolveViewerRelation({
      viewerEmail: viewer?.email ?? null,
      members: treeMembers.map((tm) => ({ id: tm.id, email: tm.email })),
      relationships: relationships.map((r) => ({ memberId: r.memberId, relatedId: r.relatedId, type: r.type })),
      targetMemberId: m.id,
    });
    const minimal = {
      id: m.id,
      treeId: m.treeId,
      name: m.name,
      isAlive: m.isAlive,
      privacyStatus: m.privacyStatus,
      generation: m.generation,
      gender: m.gender,
    };
    const decision = applyMemberVisibility(minimal, relation);
    if (decision === null) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    // 'full' mengembalikan objek input apa adanya (referensi sama):
    // respons utuh memakai formatMember penuh sesuai kontrak.
    res.json(decision === minimal ? formatMember(m) : decision);
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/trees/:treeId/members', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'create_member');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const m = await prisma.familyMember.create({
      data: { ...req.body, treeId: req.params.treeId, sexGed: req.body?.sexGed ?? null },
    });
    res.status(201).json(formatMember(m));
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

app.put('/api/v1/members/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const existing = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    const guard = await guardTreeAction(req.userId!, existing.treeId, 'edit_member');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const m = await prisma.familyMember.update({ where: { id: req.params.id }, data: req.body });
    res.json(formatMember(m));
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

app.delete('/api/v1/members/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const existing = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    const guard = await guardTreeAction(req.userId!, existing.treeId, 'delete_member');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    await prisma.familyMember.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

// ─── Consent ledger (per-member, S-06b-B, reducer pure di src/lib/consent) ───────────

app.get('/api/v1/members/:memberId/consent', requireAuth, async (req: AuthenticatedRequest<{ memberId: string }>, res) => {
  try {
    const m = await prisma.familyMember.findUnique({ where: { id: req.params.memberId } });
    if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    const guard = await guardTreeAction(req.userId!, m.treeId, 'manage_invitations');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rows = await prisma.consentRecord.findMany({
      where: { memberId: req.params.memberId },
      orderBy: { at: 'asc' },
    });
    const state = replayConsentState(rows);
    res.json({ records: state.records, granted: state.granted });
  } catch (e) {
    // S-06e: only an illegal ledger is a 409; broken infrastructure must
    // not masquerade as a domain conflict (matches sibling endpoints).
    if (e instanceof ConsentLedgerError) {
      return res.status(409).json({ code: 'CONSENT_INVALID_TRANSITION', message: e.message });
    }
    res.status(500).json({ code: 'CONSENT_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/members/:memberId/consent', requireAuth, async (req: AuthenticatedRequest<{ memberId: string }>, res) => {
  try {
    const parsed = parseConsentBody(req.body ?? {});
    if (!parsed.ok) return res.status(400).json({ code: parsed.code, message: parsed.message });
    const m = await prisma.familyMember.findUnique({ where: { id: req.params.memberId } });
    if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    const guard = await guardTreeAction(req.userId!, m.treeId, 'manage_invitations');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const now = new Date();
    const at = now.toISOString();
    // createRecord is pure input validation (note length, known action);
    // running it before the transaction keeps its failures a 400 without
    // duplicating any reducer logic.
    let record: ConsentRecord;
    try {
      record = createRecord(req.params.memberId, parsed.action, parsed.scope, at, parsed.note);
    } catch (e) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: (e as Error).message });
    }
    // S-06e: ledger read, replay, and reducer validation happen INSIDE the
    // transaction, so validating state and writing the record commit or
    // roll back as one unit. This closes the race window where two
    // concurrent POSTs could both pass an out-of-transaction check and
    // then both write (double revoke, grant after revoke, ...).
    // The pure reducer (src/lib/consent) stays the single source of truth;
    // nothing is re-implemented here.
    const updated = await prisma.$transaction(async (tx) => {
      const rows = await tx.consentRecord.findMany({
        where: { memberId: req.params.memberId },
        orderBy: { at: 'asc' },
      });
      const state = replayConsentState(rows);
      const next = applyRecord(state, record);
      await tx.consentRecord.create({
        data: {
          id: record.id,
          memberId: record.memberId,
          action: record.action,
          scope: record.scope,
          note: record.note,
          at: now,
        },
      });
      const member = await tx.familyMember.update({
        where: { id: req.params.memberId },
        data: { privacyStatus: targetPrivacyStatus(parsed.action) },
      });
      return { member, granted: next.granted, last: next.records[next.records.length - 1] };
    });
    // S-09a-ii: the ledger row is committed, so the audit fact and the
    // owner notifications are emitted here. Emission failures are
    // contained by the catch below and must never fail the POST: the
    // consent decision is already recorded in the ledger, and the
    // member-facing contract answers 201 on the strength of that row.
    // The owner lookup is inside the same guarded block: a failing
    // audience query is an emission failure, not a consent failure.
    try {
      const owners = await activeTreeOwnerIds(m.treeId, req.userId!);
      const emitResult = await safeEmitConsentEvent(
        { record, treeId: m.treeId, actorId: req.userId!, owners },
        consentEventSink,
      );
      if (!emitResult.ok) {
        // Logged for operations, swallowed for the caller: the ledger row
        // is the source of truth and the audit store is downstream.
        console.error('consent event emission failed (ledger row kept):', emitResult.error);
      }
    } catch (emitError) {
      console.error('consent event emission failed (ledger row kept):', emitError);
    }
    res.status(201).json({
      record: updated.last,
      granted: updated.granted,
      privacyStatus: updated.member.privacyStatus,
    });
  } catch (e) {
    // S-06e: a reducer rejection is a domain conflict (409); anything else
    // is an infrastructure failure and answers 500 like sibling endpoints.
    if (e instanceof ConsentLedgerError) {
      return res.status(409).json({ code: 'CONSENT_INVALID_TRANSITION', message: e.message });
    }
    res.status(500).json({ code: 'CONSENT_ERROR', message: (e as Error).message });
  }
});

// ─── Erasure (S-09b-vi-ii-b, wiring adapter Express ke server hidup) ───────────

createErasureExpressAdapter({ app, prisma });

createWithdrawalExpressAdapter({ app, prisma });

createErasurePurgeScheduler({ prisma });
createConsentNotificationScheduler({ prisma });

// ─── Relationships (per-tree scoped, P2-3 AC-6) ───────────

app.get('/api/v1/trees/:treeId/relationships', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const rels = await prisma.familyRelationship.findMany({ where: { treeId: req.params.treeId } });
    res.json(rels.map((r) => formatRelationship(r)));
  } catch (e) {
    res.status(500).json({ code: 'RELATIONSHIP_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/trees/:treeId/relationships', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'create_relationship');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const r = await prisma.familyRelationship.create({
      data: { ...req.body, treeId: req.params.treeId },
    });
    res.status(201).json(formatRelationship(r));
  } catch (e) {
    res.status(500).json({ code: 'RELATIONSHIP_ERROR', message: (e as Error).message });
  }
});

app.delete('/api/v1/relationships/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const existing = await prisma.familyRelationship.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ code: 'NOT_FOUND', message: 'Relationship not found' });
    const guard = await guardTreeAction(req.userId!, existing.treeId, 'delete_relationship');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    await prisma.familyRelationship.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ code: 'RELATIONSHIP_ERROR', message: (e as Error).message });
  }
});

// ─── Public share links (GAP #4, ADR 0010) ───────────────
//
// Read-only public access to one tree through a TreeShareLink row.
// Three surfaces share one resolver: the JSON payload, the dynamic OG
// image, and a minimal preview page with Open Graph meta tags. Every
// surface is rate limited (fixed window per IP+token, ADR 0010) before
// any database work, so hammering dies at the brake. The payload comes
// only from buildPublicTreePayload, which routes every member through
// the phase 1 export privacy gate: living members, and members whose
// life or consent status is NULL or ambiguous, are treated as living
// and redacted; contact fields are dropped for everyone.
//
// Management endpoints (S-05): LIST and REVOKE for the tree owner,
// backed by the pure helpers in src/lib/share/manage.ts. The public
// resolver consults the same resolveShareAccess gate, so a revoked
// link stops being served on all three surfaces at once.

import { FixedWindowRateLimiter } from '../src/lib/share/rate-limit';
import { buildPublicTreePayload } from '../src/lib/share/public-tree';
import { verifySharePassword } from '../src/lib/share/password';
import { buildShareOgImageSvg, escapeXmlText } from '../src/lib/share/og-image';
import { buildOgImageResponse, resolveOgFormat } from '../src/lib/share/og-raster';
import {
  SHARE_ACCESS_HTTP,
  buildShareLinkList,
  formatShareLinkSummary,
  resolveShareAccess,
  type ShareAccessError,
} from '../src/lib/share/manage';

// Password guessing gets the tightest budget; plain reads and OG fetches
// are courtesy brakes against hammering, not quotas.
const shareReadLimiter = new FixedWindowRateLimiter({ limit: 30, windowMs: 60_000 });
const shareOgLimiter = new FixedWindowRateLimiter({ limit: 60, windowMs: 60_000 });
const sharePasswordLimiter = new FixedWindowRateLimiter({ limit: 10, windowMs: 60_000 });

function shareRateKey(req: express.Request<{ token: string }>, purpose: string): string {
  return `${req.ip ?? 'unknown'}|${req.params.token}|${purpose}`;
}

function sendShareRateLimited(res: express.Response, retryAfterSeconds: number): express.Response {
  res.set('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ code: 'SHARE_RATE_LIMITED', message: 'Too many requests; retry later' });
}

// The exact member columns the public builder may see. Selecting this
// list (and nothing else) is the second fence after the builder itself:
// notes, email, phone, and location can never reach the response even
// by accident.
const SHARE_MEMBER_SELECT = {
  id: true,
  name: true,
  nickname: true,
  birthDate: true,
  deathDate: true,
  birthPlace: true,
  profession: true,
  education: true,
  gender: true,
  sexGed: true,
  isAlive: true,
  privacyStatus: true,
  generation: true,
} as const;

type ShareLinkRow = {
  id: string;
  treeId: string;
  mode: string;
  passwordHash: string | null;
  revokedAt: Date | null;
};

type ShareFailure = { error: ShareAccessError };

/**
 * Resolves one share token into the link row plus the raw tree data the
 * public builder consumes. Unknown token and unknown tree answer the
 * same 404 so probing tokens learns nothing about tree ids; a revoked
 * link answers 410 on every public surface (S-05).
 */
async function loadShareContext(token: string): Promise<
  ShareFailure
  | {
      link: ShareLinkRow;
      tree: { name: string; description: string | null; generationCount: number };
      members: Array<{ id: string; name: string; nickname: string | null; birthDate: string | null; deathDate: string | null; birthPlace: string | null; profession: string | null; education: string | null; gender: string | null; isAlive: boolean; privacyStatus: string | null; generation: number }>;
      relationships: Array<{ memberId: string; relatedId: string; type: string }>;
    }
> {
  const link = await prisma.treeShareLink.findUnique({
    where: { token },
    select: { id: true, treeId: true, mode: true, passwordHash: true, revokedAt: true },
  });
  const tree = link
    ? await prisma.familyTree.findUnique({
        where: { id: link.treeId },
        select: { name: true, description: true, generationCount: true },
      })
    : null;
  const access = resolveShareAccess(link, tree);
  if ('error' in access) return access;

  const members = await prisma.familyMember.findMany({
    where: { treeId: access.link.treeId },
    select: SHARE_MEMBER_SELECT,
  });
  const relationships = await prisma.familyRelationship.findMany({
    where: { treeId: access.link.treeId },
    select: { memberId: true, relatedId: true, type: true },
  });
  return { link: access.link as ShareLinkRow, tree: access.tree, members, relationships };
}

function shareFailureResponse(res: express.Response, failure: ShareFailure): express.Response {
  return res
    .status(SHARE_ACCESS_HTTP[failure.error])
    .json({ code: failure.error, message: failure.error === 'SHARE_REVOKED' ? 'This share link has been revoked' : 'Share link not found' });
}

app.get('/api/v1/share/:token', async (req: express.Request<{ token: string }>, res) => {
  const read = shareReadLimiter.check(shareRateKey(req, 'read'));
  if (!read.allowed) return sendShareRateLimited(res, read.retryAfterSeconds);

  try {
    const context = await loadShareContext(req.params.token);
    if ('error' in context) return shareFailureResponse(res, context);
    const { link, tree, members, relationships } = context;

    if (link.mode === 'password') {
      const attempt = sharePasswordLimiter.check(shareRateKey(req, 'password'));
      if (!attempt.allowed) return sendShareRateLimited(res, attempt.retryAfterSeconds);
      const header = req.header('x-share-password');
      if (header === undefined || header === '') {
        return res.status(401).json({ code: 'SHARE_PASSWORD_REQUIRED', message: 'This share link requires a password' });
      }
      const ok = link.passwordHash !== null && await verifySharePassword(header, link.passwordHash);
      if (!ok) {
        return res.status(401).json({ code: 'SHARE_PASSWORD_INVALID', message: 'Incorrect share password' });
      }
    }

    await prisma.treeShareLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    res.json({
      link: { mode: link.mode },
      payload: buildPublicTreePayload(
        { name: tree.name, description: tree.description, generationCount: tree.generationCount },
        members,
        relationships,
      ),
    });
  } catch (e) {
    res.status(500).json({ code: 'SHARE_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/share/:token/og-image', async (req: express.Request<{ token: string }>, res) => {
  const og = shareOgLimiter.check(shareRateKey(req, 'og'));
  if (!og.allowed) return sendShareRateLimited(res, og.retryAfterSeconds);

  // ADR 0010 raster upgrade: SHARE_OG_FORMAT=png swaps the v1 SVG
  // response for a rasterized PNG of the same builder output. Default
  // (unset or any other value) is byte-identical to v1.
  const ogFormat = resolveOgFormat(process.env.SHARE_OG_FORMAT);

  try {
    const context = await loadShareContext(req.params.token);
    if ('error' in context) return shareFailureResponse(res, context);

    // A password link keeps its tree name out of crawler previews: the
    // OG route cannot demand a request header, so it renders the generic
    // title instead of leaking the name (ADR 0010).
    const isPublic = context.link.mode !== 'password';
    const svg = buildShareOgImageSvg({
      title: isPublic ? context.tree.name : 'A shared family tree',
      subtitle: 'Stemmagraph',
    });
    const image = await buildOgImageResponse(svg, ogFormat);
    res.set('Content-Type', image.contentType);
    res.set('Cache-Control', 'public, max-age=300');
    return res.send(image.body);
  } catch (e) {
    res.status(500).json({ code: 'SHARE_ERROR', message: (e as Error).message });
  }
});

// Minimal preview document for crawlers and manual QA: Open Graph and
// Twitter meta tags plus a plain-text fallback. Same generic-title rule
// as the OG image for password links.
app.get('/api/v1/share/:token/preview', async (req: express.Request<{ token: string }>, res) => {
  const og = shareOgLimiter.check(shareRateKey(req, 'preview'));
  if (!og.allowed) return sendShareRateLimited(res, og.retryAfterSeconds);

  try {
    const context = await loadShareContext(req.params.token);
    if ('error' in context) return shareFailureResponse(res, context);
    const isPublic = context.link.mode !== 'password';
    const title = isPublic ? context.tree.name : 'A shared family tree';
    const description = isPublic && context.tree.description
      ? context.tree.description
      : 'A family tree shared on Stemmagraph.';
    const origin = `${req.protocol}://${req.get('host') ?? ''}`;
    const imageUrl = `${origin}/api/v1/share/${encodeURIComponent(req.params.token)}/og-image`;

    const html = [
      '<!doctype html>',
      '<html lang="en">',
      '<head>',
      '<meta charset="utf-8">',
      `<title>${escapeXmlText(title)}</title>`,
      `<meta property="og:type" content="website">`,
      `<meta property="og:title" content="${escapeXmlText(title)}">`,
      `<meta property="og:description" content="${escapeXmlText(description)}">`,
      `<meta property="og:image" content="${escapeXmlText(imageUrl)}">`,
      `<meta name="twitter:card" content="summary_large_image">`,
      `<meta name="twitter:title" content="${escapeXmlText(title)}">`,
      `<meta name="twitter:description" content="${escapeXmlText(description)}">`,
      `<meta name="twitter:image" content="${escapeXmlText(imageUrl)}">`,
      '</head>',
      '<body>',
      `<h1>${escapeXmlText(title)}</h1>`,
      `<p>${escapeXmlText(description)}</p>`,
      '</body>',
      '</html>',
    ].join('');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300');
    res.send(html);
  } catch (e) {
    res.status(500).json({ code: 'SHARE_ERROR', message: (e as Error).message });
  }
});

// ─── Share link management (S-05, ADR 0010) ──────────────
//
// Owner-only surface over the same rows the public resolver reads.
// Every token leaves these endpoints masked (prefix + suffix, the
// ADR 0004 comment discipline at the invitation section): the full
// token was shown once at creation and is never reconstructed here.
// Revocation is a soft stamp, so an old link stays explainable; the
// public gate above answers 410 for any stamped row.

app.get('/api/v1/trees/:treeId/share-links', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'manage_share_links');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const links = await prisma.treeShareLink.findMany({
      where: { treeId: req.params.treeId },
      orderBy: { createdAt: 'desc' },
    });
    // buildShareLinkList re-filters by treeId and masks every token; the
    // select above already scopes to the tree, this is the second fence.
    res.json({ shareLinks: buildShareLinkList(links, req.params.treeId) });
  } catch (e) {
    res.status(500).json({ code: 'SHARE_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/share-links/:id/revoke', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const link = await prisma.treeShareLink.findUnique({ where: { id: req.params.id } });
    if (!link) return res.status(404).json({ code: 'SHARE_LINK_NOT_FOUND', message: 'Share link not found' });
    const guard = await guardTreeAction(req.userId!, link.treeId, 'manage_share_links');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    if (link.revokedAt !== null) {
      return res.status(409).json({ code: 'SHARE_LINK_ALREADY_REVOKED', message: 'This share link has already been revoked' });
    }
    // Soft revoke: the stamp flips state everywhere at once; no delete.
    const updated = await prisma.treeShareLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
    });
    res.json({ shareLink: formatShareLinkSummary(updated) });
  } catch (e) {
    res.status(500).json({ code: 'SHARE_ERROR', message: (e as Error).message });
  }
});

// ─── Formatters ──────────────────────────────────────────

function formatTree(t: FamilyTree, viewerRole?: TreeRole | null) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    memberCount: t.memberCount,
    generationCount: t.generationCount,
    thumbnail: t.thumbnail,
    lastUpdated: t.updatedAt?.toISOString?.() ?? t.updatedAt,
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
    // The caller's role on this tree (P2-5): the UI uses it to offer the
    // change-review surfaces to owners and editors and none to viewers.
    role: viewerRole ?? null,
  };
}

function formatMember(m: FamilyMember) {
  return {
    id: m.id,
    treeId: m.treeId,
    name: m.name,
    nickname: m.nickname,
    birthDate: m.birthDate,
    deathDate: m.deathDate,
    birthPlace: m.birthPlace,
    currentLocation: m.currentLocation,
    profession: m.profession,
    education: m.education,
    gender: m.gender,
    sexGed: m.sexGed,
    photoUrl: m.photoUrl,
    email: m.email,
    phone: m.phone,
    isAlive: m.isAlive,
    generation: m.generation,
    maritalStatus: m.maritalStatus,
    notes: m.notes,
    createdAt: m.createdAt?.toISOString?.() ?? m.createdAt,
    updatedAt: m.updatedAt?.toISOString?.() ?? m.updatedAt,
  };
}

function formatRelationship(r: FamilyRelationship) {
  return {
    id: r.id,
    treeId: r.treeId,
    memberId: r.memberId,
    relatedId: r.relatedId,
    type: r.type,
  };
}

// ─── Start ───────────────────────────────────────────────

// P2-7: the hourly digest check exists only when a mailer is configured.
startDigestScheduler();

app.listen(PORT, () => {
  console.log(`🚀 API server running at http://localhost:${PORT}/api/v1`);
  console.log(`   Auth: JWT (7d expiry), bcrypt (12 rounds)`);
  console.log(`   Demo login: demo@familytree.app / demo123`);
});
