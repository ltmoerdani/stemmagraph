// Backend API server for Family Tree Platform
// Uses Prisma ORM + SQLite — exposes REST API for frontend
// Run: npx tsx server/index.ts

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const app = express();
const PORT = process.env['API_PORT'] || 3001;

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db' }),
});

app.use(cors());
app.use(express.json());

// ─── Auth ────────────────────────────────────────────────

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ code: 'INVALID_CREDENTIALS', message: 'Email atau password salah' });
    }
    res.json({
      user: { id: user.id, email: user.email, name: user.name, familyName: user.familyName, avatar: user.avatar, createdAt: user.createdAt.toISOString() },
      token: `session-${user.id}`,
    });
  } catch (e) {
    res.status(500).json({ code: 'AUTH_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, familyName } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ code: 'EMAIL_EXISTS', message: 'Email sudah terdaftar' });

    const user = await prisma.user.create({ data: { email, password, name, familyName } });
    res.json({
      user: { id: user.id, email: user.email, name: user.name, familyName: user.familyName, avatar: user.avatar, createdAt: user.createdAt.toISOString() },
      token: `session-${user.id}`,
    });
  } catch (e) {
    res.status(500).json({ code: 'AUTH_ERROR', message: (e as Error).message });
  }
});

app.post('/api/v1/auth/logout', (_req, res) => res.status(204).send());
app.get('/api/v1/auth/session', (_req, res) => res.json(null));

// ─── Family Trees ────────────────────────────────────────

app.get('/api/v1/trees', async (_req, res) => {
  const trees = await prisma.familyTree.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(trees.map(t => formatTree(t)));
});

app.get('/api/v1/trees/:id', async (req, res) => {
  const t = await prisma.familyTree.findUnique({ where: { id: req.params.id } });
  if (!t) return res.status(404).json({ code: 'NOT_FOUND', message: 'Tree not found' });
  res.json(formatTree(t));
});

app.post('/api/v1/trees', async (req, res) => {
  const t = await prisma.familyTree.create({ data: { name: req.body.name, description: req.body.description } });
  res.status(201).json(formatTree(t));
});

app.put('/api/v1/trees/:id', async (req, res) => {
  const t = await prisma.familyTree.update({ where: { id: req.params.id }, data: req.body });
  res.json(formatTree(t));
});

app.delete('/api/v1/trees/:id', async (req, res) => {
  await prisma.familyTree.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Family Members ──────────────────────────────────────

app.get('/api/v1/trees/:treeId/members', async (req, res) => {
  const members = await prisma.familyMember.findMany({
    where: { treeId: req.params.treeId },
    orderBy: { generation: 'asc' },
  });
  res.json(members.map(m => formatMember(m)));
});

app.get('/api/v1/members/:id', async (req, res) => {
  const m = await prisma.familyMember.findUnique({ where: { id: req.params.id } });
  if (!m) return res.status(404).json({ code: 'NOT_FOUND', message: 'Member not found' });
  res.json(formatMember(m));
});

app.post('/api/v1/trees/:treeId/members', async (req, res) => {
  const m = await prisma.familyMember.create({
    data: { ...req.body, treeId: req.params.treeId },
  });
  res.status(201).json(formatMember(m));
});

app.put('/api/v1/members/:id', async (req, res) => {
  const m = await prisma.familyMember.update({ where: { id: req.params.id }, data: req.body });
  res.json(formatMember(m));
});

app.delete('/api/v1/members/:id', async (req, res) => {
  await prisma.familyMember.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Relationships ───────────────────────────────────────

app.get('/api/v1/trees/:treeId/relationships', async (req, res) => {
  const rels = await prisma.familyRelationship.findMany({ where: { treeId: req.params.treeId } });
  res.json(rels.map(r => formatRelationship(r)));
});

app.post('/api/v1/trees/:treeId/relationships', async (req, res) => {
  const r = await prisma.familyRelationship.create({
    data: { ...req.body, treeId: req.params.treeId },
  });
  res.status(201).json(formatRelationship(r));
});

app.delete('/api/v1/relationships/:id', async (req, res) => {
  await prisma.familyRelationship.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

// ─── Formatters ──────────────────────────────────────────

function formatTree(t: any) {
  return { id: t.id, name: t.name, description: t.description, memberCount: t.memberCount, generationCount: t.generationCount, thumbnail: t.thumbnail, lastUpdated: t.updatedAt?.toISOString?.() ?? t.updatedAt, createdAt: t.createdAt?.toISOString?.() ?? t.createdAt };
}

function formatMember(m: any) {
  return { id: m.id, treeId: m.treeId, name: m.name, nickname: m.nickname, birthDate: m.birthDate, deathDate: m.deathDate, birthPlace: m.birthPlace, currentLocation: m.currentLocation, profession: m.profession, education: m.education, gender: m.gender, photoUrl: m.photoUrl, email: m.email, phone: m.phone, isAlive: m.isAlive, generation: m.generation, maritalStatus: m.maritalStatus, notes: m.notes, createdAt: m.createdAt?.toISOString?.() ?? m.createdAt, updatedAt: m.updatedAt?.toISOString?.() ?? m.updatedAt };
}

function formatRelationship(r: any) {
  return { id: r.id, treeId: r.treeId, memberId: r.memberId, relatedId: r.relatedId, type: r.type };
}

// ─── Start ───────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 API server running at http://localhost:${PORT}/api/v1`);
  console.log(`   Demo login: demo@familytree.app / demo123`);
});
