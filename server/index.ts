// Backend API server for Stemmagraph — Family Tree Platform
// Stack: Express 5 + Prisma ORM + SQLite + JWT auth + bcryptjs
// Run: npx tsx server/index.ts

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { FamilyTree, FamilyMember, FamilyRelationship, User, Notification, Event, Invitation, TreeMember } from '../generated/prisma/client';
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
  buildInvitationCreatedEvent,
  buildInvitationRevokedEvent,
  buildInvitationUsedEvent,
  isEventType,
  projectAccountActivatedNotification,
  projectPendingCreatedNotifications,
} from '../src/lib/events';
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
import { appendEvent } from './events';
import {
  ACCOUNT_EVENT_TYPES,
  encodeFeedCursor,
  parseActivityFeedQuery,
  parseStoredEventRow,
  projectEventToFeedItem,
  type FeedItem,
} from '../src/lib/feed';

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
      if (source !== null) items.push(projectEventToFeedItem(source));
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

// ─── Family Trees (per-tree scoped, P2-3 AC-6) ────────────
//
// Every route below is guarded by the ADR 0002 matrix through
// guardTreeAction: read needs any tree role, writes need editor or owner,
// destructive writes and administration need owner. Violations answer
// 403 FORBIDDEN_TREE; unknown trees answer 404.

app.get('/api/v1/trees', requireAuth, async (_req: AuthenticatedRequest, res) => {
  try {
    // An active installation owner sees every tree (ADR 0002); everyone
    // else sees exactly the trees they hold a TreeMember row on.
    const user = await prisma.user.findUnique({ where: { id: _req.userId! }, select: { role: true } });
    if (user !== null && user.role === 'owner') {
      const trees = await prisma.familyTree.findMany({ orderBy: { createdAt: 'desc' } });
      return res.json(trees.map((t) => formatTree(t)));
    }
    const memberships = await prisma.treeMember.findMany({
      where: { userId: _req.userId! },
      select: { treeId: true },
    });
    const trees = await prisma.familyTree.findMany({
      where: { id: { in: memberships.map((m) => m.treeId) } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(trees.map((t) => formatTree(t)));
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
    res.json(formatTree(t));
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
    res.status(201).json(formatTree(t));
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
    res.json(formatTree(t));
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
    const members = await prisma.familyMember.findMany({
      where: { treeId: req.params.treeId },
      orderBy: { generation: 'asc' },
    });
    res.json(members.map((m) => formatMember(m)));
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

app.get('/api/v1/members/:id', requireAuth, async (req: AuthenticatedRequest<{ id: string }>, res) => {
  try {
    const m = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
    if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
    const guard = await guardTreeAction(req.userId!, m.treeId, 'view_tree');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    res.json(formatMember(m));
  } catch (e) {
    res.status(500).json({ code: 'MEMBER_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/trees/:treeId/members', requireAuth, async (req: AuthenticatedRequest<{ treeId: string }>, res) => {
  try {
    const guard = await guardTreeAction(req.userId!, req.params.treeId, 'create_member');
    if (!guard.ok) return res.status(guard.statusCode).json({ code: guard.code, message: guard.message });
    const m = await prisma.familyMember.create({
      data: { ...req.body, treeId: req.params.treeId },
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

// ─── Formatters ──────────────────────────────────────────

function formatTree(t: FamilyTree) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    memberCount: t.memberCount,
    generationCount: t.generationCount,
    thumbnail: t.thumbnail,
    lastUpdated: t.updatedAt?.toISOString?.() ?? t.updatedAt,
    createdAt: t.createdAt?.toISOString?.() ?? t.createdAt,
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

app.listen(PORT, () => {
  console.log(`🚀 API server running at http://localhost:${PORT}/api/v1`);
  console.log(`   Auth: JWT (7d expiry), bcrypt (12 rounds)`);
  console.log(`   Demo login: demo@familytree.app / demo123`);
});
