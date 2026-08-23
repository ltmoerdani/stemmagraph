// Backend API server for Stemmagraph — Family Tree Platform
// Stack: Express 5 + Prisma ORM + SQLite + JWT auth + bcryptjs
// Run: npx tsx server/index.ts

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { FamilyTree, FamilyMember, FamilyRelationship, User, Notification } from '../generated/prisma/client';
import { prisma } from './db';
import {
  bootstrapAccountState,
  buildAccountActivatedNotification,
  buildAccountPendingCreatedNotification,
  canTransition,
  reviewDisableAction,
  type AccountRole,
  type AccountStatus,
} from '../src/lib/account-states';

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

    // Input validation
    if (!email || !password || !name) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'email, password, and name are required' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Password must be at least 8 characters' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email is already registered' });

    // Bootstrap rule (ADR 0002): the first account on an empty user table is
    // born active with role owner so a fresh install can administer itself.
    // Every later registration is born pending and waits for owner approval.
    const bootstrap = bootstrapAccountState(await prisma.user.count());

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: passwordHash, name, familyName, status: bootstrap.status, role: bootstrap.role },
    });

    if (bootstrap.status === 'active') {
      const token = signToken(user.id);
      return res.status(201).json({ user: toPublicUser(user), token });
    }

    // Pending registration: no token is issued. Tell the truth about the
    // account state so the UI can show a "waiting for activation" screen.
    const activeOwners = await prisma.user.findMany({
      where: { role: 'owner', status: 'active' },
      select: { id: true },
    });
    if (activeOwners.length > 0) {
      await prisma.notification.createMany({
        data: activeOwners.map((owner) =>
          buildAccountPendingCreatedNotification(owner.id, { id: user.id, email: user.email, name: user.name }),
        ),
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
    // Notify the user that their account is now usable (R-74.7).
    await prisma.notification.create({ data: buildAccountActivatedNotification(updated.id) });
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
    await prisma.notification.create({ data: buildAccountActivatedNotification(updated.id) });
    res.json({ account: formatAccount(updated) });
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

// ─── Family Trees ────────────────────────────────────────

app.get('/api/v1/trees', requireAuth, async (_req: AuthenticatedRequest, res) => {
  // Future: filter by userId when ownership is added to schema
  const trees = await prisma.familyTree.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(trees.map(t => formatTree(t)));
});

app.get('/api/v1/trees/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  const t = await prisma.familyTree.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ code: 'NOT_FOUND', message: 'Tree not found' });
  res.json(formatTree(t));
});

app.post('/api/v1/trees', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'name is required' });
  }
  const t = await prisma.familyTree.create({ data: { name, description } });
  res.status(201).json(formatTree(t));
});

app.put('/api/v1/trees/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  const { name, description } = req.body;
  const t = await prisma.familyTree.update({
    where: { id: req.params.id },
    data: { name, description },
  });
  res.json(formatTree(t));
});

app.delete('/api/v1/trees/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  await prisma.familyTree.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Family Members ──────────────────────────────────────

app.get('/api/v1/trees/:treeId/members', requireAuth, async (req: express.Request<{ treeId: string }>, res) => {
  const members = await prisma.familyMember.findMany({
    where: { treeId: req.params.treeId },
    orderBy: { generation: 'asc' },
  });
  res.json(members.map(m => formatMember(m)));
});

app.get('/api/v1/members/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  const m = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
  res.json(formatMember(m));
});

app.post('/api/v1/trees/:treeId/members', requireAuth, async (req: express.Request<{ treeId: string }>, res) => {
  const m = await prisma.familyMember.create({
    data: { ...req.body, treeId: req.params.treeId },
  });
  res.status(201).json(formatMember(m));
});

app.put('/api/v1/members/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  const m = await prisma.familyMember.update({ where: { id: req.params.id }, data: req.body });
  res.json(formatMember(m));
});

app.delete('/api/v1/members/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  await prisma.familyMember.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Relationships ───────────────────────────────────────

app.get('/api/v1/trees/:treeId/relationships', requireAuth, async (req: express.Request<{ treeId: string }>, res) => {
  const rels = await prisma.familyRelationship.findMany({ where: { treeId: req.params.treeId } });
  res.json(rels.map(r => formatRelationship(r)));
});

app.post('/api/v1/trees/:treeId/relationships', requireAuth, async (req: express.Request<{ treeId: string }>, res) => {
  const r = await prisma.familyRelationship.create({
    data: { ...req.body, treeId: req.params.treeId },
  });
  res.status(201).json(formatRelationship(r));
});

app.delete('/api/v1/relationships/:id', requireAuth, async (req: express.Request<{ id: string }>, res) => {
  await prisma.familyRelationship.delete({ where: { id: req.params.id } });
  res.status(204).send();
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
