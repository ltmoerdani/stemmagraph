// Backend API server for Stemmagraph — Family Tree Platform
// Stack: Express 5 + Prisma ORM + SQLite + JWT auth + bcryptjs
// Run: npx tsx server/index.ts

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import type { FamilyTree, FamilyMember, FamilyRelationship, User } from '../generated/prisma/client';

// ─── Config ──────────────────────────────────────────────

const app = express();
const PORT = process.env['API_PORT'] || 3001;
const JWT_SECRET = process.env['JWT_SECRET'] || 'dev-only-insecure-secret-change-me';
const JWT_EXPIRES_IN = '7d';

if (process.env['NODE_ENV'] === 'production' && JWT_SECRET === 'dev-only-insecure-secret-change-me') {
  console.error('❌ FATAL: JWT_SECRET must be set in production. Set the JWT_SECRET env variable.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db' }),
});

app.use(cors());
app.use(express.json());

// ─── Types ───────────────────────────────────────────────

interface AuthenticatedRequest extends express.Request {
  userId?: string;
}

interface PublicUser {
  id: string;
  email: string;
  name: string;
  familyName: string | null;
  avatar: string | null;
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
    createdAt: user.createdAt.toISOString(),
  };
}

/**
 * Express middleware — verifies JWT from Authorization header.
 * Attaches `userId` to request on success.
 * Returns 401 for missing/invalid tokens.
 */
function requireAuth(req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void {
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
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: 'Token expired or invalid' });
  }
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

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, password: passwordHash, name, familyName },
    });

    const token = signToken(user.id);
    res.status(201).json({ user: toPublicUser(user), token });
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

// ─── Family Trees ────────────────────────────────────────

app.get('/api/v1/trees', requireAuth, async (_req: AuthenticatedRequest, res) => {
  // Future: filter by userId when ownership is added to schema
  const trees = await prisma.familyTree.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(trees.map(t => formatTree(t)));
});

app.get('/api/v1/trees/:id', requireAuth, async (req, res) => {
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

app.put('/api/v1/trees/:id', requireAuth, async (req, res) => {
  const { name, description } = req.body;
  const t = await prisma.familyTree.update({
    where: { id: req.params.id },
    data: { name, description },
  });
  res.json(formatTree(t));
});

app.delete('/api/v1/trees/:id', requireAuth, async (req, res) => {
  await prisma.familyTree.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Family Members ──────────────────────────────────────

app.get('/api/v1/trees/:treeId/members', requireAuth, async (req, res) => {
  const members = await prisma.familyMember.findMany({
    where: { treeId: req.params.treeId },
    orderBy: { generation: 'asc' },
  });
  res.json(members.map(m => formatMember(m)));
});

app.get('/api/v1/members/:id', requireAuth, async (req, res) => {
  const m = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
  res.json(formatMember(m));
});

app.post('/api/v1/trees/:treeId/members', requireAuth, async (req, res) => {
  const m = await prisma.familyMember.create({
    data: { ...req.body, treeId: req.params.treeId },
  });
  res.status(201).json(formatMember(m));
});

app.put('/api/v1/members/:id', requireAuth, async (req, res) => {
  const m = await prisma.familyMember.update({ where: { id: req.params.id }, data: req.body });
  res.json(formatMember(m));
});

app.delete('/api/v1/members/:id', requireAuth, async (req, res) => {
  await prisma.familyMember.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Relationships ───────────────────────────────────────

app.get('/api/v1/trees/:treeId/relationships', requireAuth, async (req, res) => {
  const rels = await prisma.familyRelationship.findMany({ where: { treeId: req.params.treeId } });
  res.json(rels.map(r => formatRelationship(r)));
});

app.post('/api/v1/trees/:treeId/relationships', requireAuth, async (req, res) => {
  const r = await prisma.familyRelationship.create({
    data: { ...req.body, treeId: req.params.treeId },
  });
  res.status(201).json(formatRelationship(r));
});

app.delete('/api/v1/relationships/:id', requireAuth, async (req, res) => {
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
