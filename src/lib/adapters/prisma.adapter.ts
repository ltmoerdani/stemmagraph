// ===== Prisma Adapter =====
// Default production adapter using Prisma ORM.
// Supports SQLite (local dev), PostgreSQL, MySQL — just change provider in schema.
//
// Generated client path: ./generated/prisma

import { PrismaClient } from '../../../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import {
  DataAdapter,
  AuthSession,
  AuthCredentials,
  RegisterInput,
  FamilyTreeRecord,
  CreateTreeInput,
  FamilyMemberRecord,
  CreateMemberInput,
  MemberRelationship,
  AuthError,
} from './types';

export class PrismaAdapter implements DataAdapter {
  readonly name = 'prisma';
  readonly version = '1.0.0';
  readonly description = 'Prisma ORM adapter (SQLite / PostgreSQL / MySQL)';

  private prisma: PrismaClient;
  private currentUserId: string | null = null;

  constructor() {
    this.prisma = new PrismaClient({
      adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db' }),
    });
  }

  // ── Auth ────────────────────────────────────────────────

  async login({ email, password }: AuthCredentials): Promise<AuthSession> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.password !== password) {
      throw new AuthError('Email atau password salah', 'INVALID_CREDENTIALS');
    }
    this.currentUserId = user.id;
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        familyName: user.familyName ?? undefined,
        avatar: user.avatar ?? undefined,
        createdAt: user.createdAt.toISOString(),
      },
      token: `prisma-session-${user.id}`,
    };
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AuthError('Email sudah terdaftar', 'EMAIL_EXISTS');
    }
    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        password: input.password,
        name: input.name,
        familyName: input.familyName,
      },
    });
    this.currentUserId = user.id;
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        familyName: user.familyName ?? undefined,
        createdAt: user.createdAt.toISOString(),
      },
      token: `prisma-session-${user.id}`,
    };
  }

  async logout(): Promise<void> {
    this.currentUserId = null;
  }

  async getSession(): Promise<AuthSession | null> {
    if (!this.currentUserId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: this.currentUserId } });
    if (!user) return null;
    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        familyName: user.familyName ?? undefined,
        avatar: user.avatar ?? undefined,
        createdAt: user.createdAt.toISOString(),
      },
    };
  }

  async refreshSession(): Promise<AuthSession | null> {
    return this.getSession();
  }

  // ── Family Trees ────────────────────────────────────────

  async listTrees(): Promise<FamilyTreeRecord[]> {
    const trees = await this.prisma.familyTree.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return trees.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      memberCount: t.memberCount,
      generationCount: t.generationCount,
      thumbnail: t.thumbnail ?? undefined,
      createdAt: t.createdAt.toISOString(),
      lastUpdated: t.updatedAt.toISOString(),
    }));
  }

  async getTree(id: string): Promise<FamilyTreeRecord | null> {
    const t = await this.prisma.familyTree.findUnique({ where: { id } });
    if (!t) return null;
    return {
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      memberCount: t.memberCount,
      generationCount: t.generationCount,
      thumbnail: t.thumbnail ?? undefined,
      createdAt: t.createdAt.toISOString(),
      lastUpdated: t.updatedAt.toISOString(),
    };
  }

  async createTree(input: CreateTreeInput): Promise<FamilyTreeRecord> {
    const t = await this.prisma.familyTree.create({
      data: { name: input.name, description: input.description },
    });
    return {
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      memberCount: t.memberCount,
      generationCount: t.generationCount,
      createdAt: t.createdAt.toISOString(),
      lastUpdated: t.updatedAt.toISOString(),
    };
  }

  async updateTree(id: string, data: Partial<FamilyTreeRecord>): Promise<FamilyTreeRecord> {
    const t = await this.prisma.familyTree.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        memberCount: data.memberCount,
        generationCount: data.generationCount,
      },
    });
    return {
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
      memberCount: t.memberCount,
      generationCount: t.generationCount,
      thumbnail: t.thumbnail ?? undefined,
      createdAt: t.createdAt.toISOString(),
      lastUpdated: t.updatedAt.toISOString(),
    };
  }

  async deleteTree(id: string): Promise<void> {
    await this.prisma.familyTree.delete({ where: { id } });
  }

  // ── Family Members ──────────────────────────────────────

  async listMembers(treeId: string): Promise<FamilyMemberRecord[]> {
    const members = await this.prisma.familyMember.findMany({
      where: { treeId },
      orderBy: { generation: 'asc' },
    });
    return members.map((m) => ({
      id: m.id,
      treeId: m.treeId,
      name: m.name,
      nickname: m.nickname ?? undefined,
      birthDate: m.birthDate,
      deathDate: m.deathDate ?? undefined,
      birthPlace: m.birthPlace ?? undefined,
      currentLocation: m.currentLocation ?? undefined,
      profession: m.profession ?? undefined,
      education: m.education ?? undefined,
      gender: m.gender as 'male' | 'female' | 'other',
      photoUrl: m.photoUrl ?? undefined,
      email: m.email ?? undefined,
      phone: m.phone ?? undefined,
      isAlive: m.isAlive,
      generation: m.generation,
      maritalStatus: m.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed',
      notes: m.notes ?? undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  async getMember(id: string): Promise<FamilyMemberRecord | null> {
    const m = await this.prisma.familyMember.findUnique({ where: { id } });
    if (!m) return null;
    return {
      id: m.id,
      treeId: m.treeId,
      name: m.name,
      nickname: m.nickname ?? undefined,
      birthDate: m.birthDate,
      deathDate: m.deathDate ?? undefined,
      birthPlace: m.birthPlace ?? undefined,
      currentLocation: m.currentLocation ?? undefined,
      profession: m.profession ?? undefined,
      education: m.education ?? undefined,
      gender: m.gender as 'male' | 'female' | 'other',
      photoUrl: m.photoUrl ?? undefined,
      email: m.email ?? undefined,
      phone: m.phone ?? undefined,
      isAlive: m.isAlive,
      generation: m.generation,
      maritalStatus: m.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed',
      notes: m.notes ?? undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  async createMember(treeId: string, input: CreateMemberInput): Promise<FamilyMemberRecord> {
    const m = await this.prisma.familyMember.create({
      data: {
        treeId,
        name: input.name,
        nickname: input.nickname,
        gender: input.gender,
        birthDate: input.birthDate,
        birthPlace: input.birthPlace,
        isAlive: input.isAlive ?? true,
        deathDate: input.deathDate,
        generation: input.generation ?? 1,
        maritalStatus: input.maritalStatus ?? 'single',
      },
    });

    // Update tree member count
    const count = await this.prisma.familyMember.count({ where: { treeId } });
    const generations = await this.prisma.familyMember.findMany({
      where: { treeId },
      select: { generation: true },
      distinct: ['generation'],
    });
    await this.prisma.familyTree.update({
      where: { id: treeId },
      data: { memberCount: count, generationCount: generations.length },
    });

    return {
      id: m.id,
      treeId: m.treeId,
      name: m.name,
      nickname: m.nickname ?? undefined,
      birthDate: m.birthDate,
      deathDate: m.deathDate ?? undefined,
      birthPlace: m.birthPlace ?? undefined,
      currentLocation: m.currentLocation ?? undefined,
      profession: m.profession ?? undefined,
      education: m.education ?? undefined,
      gender: m.gender as 'male' | 'female' | 'other',
      photoUrl: m.photoUrl ?? undefined,
      email: m.email ?? undefined,
      phone: m.phone ?? undefined,
      isAlive: m.isAlive,
      generation: m.generation,
      maritalStatus: m.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed',
      notes: m.notes ?? undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  async updateMember(id: string, data: Partial<FamilyMemberRecord>): Promise<FamilyMemberRecord> {
    const m = await this.prisma.familyMember.update({
      where: { id },
      data: {
        name: data.name,
        nickname: data.nickname,
        birthDate: data.birthDate,
        deathDate: data.deathDate,
        birthPlace: data.birthPlace,
        currentLocation: data.currentLocation,
        profession: data.profession,
        education: data.education,
        gender: data.gender,
        photoUrl: data.photoUrl,
        email: data.email,
        phone: data.phone,
        isAlive: data.isAlive,
        generation: data.generation,
        maritalStatus: data.maritalStatus,
        notes: data.notes,
      },
    });
    return {
      id: m.id,
      treeId: m.treeId,
      name: m.name,
      nickname: m.nickname ?? undefined,
      birthDate: m.birthDate,
      deathDate: m.deathDate ?? undefined,
      birthPlace: m.birthPlace ?? undefined,
      currentLocation: m.currentLocation ?? undefined,
      profession: m.profession ?? undefined,
      education: m.education ?? undefined,
      gender: m.gender as 'male' | 'female' | 'other',
      photoUrl: m.photoUrl ?? undefined,
      email: m.email ?? undefined,
      phone: m.phone ?? undefined,
      isAlive: m.isAlive,
      generation: m.generation,
      maritalStatus: m.maritalStatus as 'single' | 'married' | 'divorced' | 'widowed',
      notes: m.notes ?? undefined,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    };
  }

  async deleteMember(id: string): Promise<void> {
    await this.prisma.familyMember.delete({ where: { id } });
  }

  // ── Relationships ───────────────────────────────────────

  async listRelationships(treeId: string): Promise<MemberRelationship[]> {
    const rels = await this.prisma.familyRelationship.findMany({
      where: { treeId },
    });
    return rels.map((r) => ({
      id: r.id,
      treeId: r.treeId,
      memberId: r.memberId,
      relatedId: r.relatedId,
      type: r.type as MemberRelationship['type'],
    }));
  }

  async createRelationship(
    treeId: string,
    memberId: string,
    relatedId: string,
    type: MemberRelationship['type'],
  ): Promise<MemberRelationship> {
    const r = await this.prisma.familyRelationship.create({
      data: { treeId, memberId, relatedId, type },
    });
    return {
      id: r.id,
      treeId: r.treeId,
      memberId: r.memberId,
      relatedId: r.relatedId,
      type: r.type as MemberRelationship['type'],
    };
  }

  async deleteRelationship(id: string): Promise<void> {
    await this.prisma.familyRelationship.delete({ where: { id } });
  }
}
