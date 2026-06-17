// ===== Mock Adapter =====
// In-memory adapter for local development, demo, and testing.
// No external dependencies required. Data is lost on page refresh
// unless configured with persistence (Zustand persist middleware).

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
  NotFoundError,
} from './types';

// ─── Mock Database ────────────────────────────────────────

const db: {
  users: Map<string, { password: string; user: AuthSession['user'] }>;
  trees: Map<string, FamilyTreeRecord>;
  members: Map<string, FamilyMemberRecord>;
  relationships: Map<string, MemberRelationship>;
  currentSession: AuthSession | null;
} = {
  users: new Map(),
  trees: new Map(),
  members: new Map(),
  relationships: new Map(),
  currentSession: null,
};

// ─── Seed Demo User ───────────────────────────────────────

db.users.set('demo@familytree.app', {
  password: 'demo123',
  user: {
    id: 'user-demo-001',
    email: 'demo@familytree.app',
    name: 'Demo User',
    familyName: 'Wijaya',
    avatar: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150',
    createdAt: '2024-01-01T00:00:00Z',
  },
});

// ─── Seed Demo Tree ───────────────────────────────────────

db.trees.set('wijaya-family', {
  id: 'wijaya-family',
  name: 'The Wijaya Family',
  description: 'Extended family tree of the Wijaya clan from Yogyakarta',
  memberCount: 11,
  generationCount: 3,
  lastUpdated: '2024-01-15T10:30:00Z',
  createdAt: '2023-06-15T08:00:00Z',
});

// ─── Seed Mock Members ────────────────────────────────────

const seedMembers: FamilyMemberRecord[] = [
  {
    id: '1', treeId: 'wijaya-family', name: 'Budi Wijaya',
    birthDate: '1945-03-15', deathDate: '2018-08-20', birthPlace: 'Yogyakarta',
    currentLocation: 'Jakarta', profession: 'Retired Teacher', education: "Bachelor's in Education",
    gender: 'male', isAlive: false, generation: 1, maritalStatus: 'married',
    photoUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '2', treeId: 'wijaya-family', name: 'Siti Wijaya',
    birthDate: '1948-07-22', deathDate: '2020-12-10', birthPlace: 'Yogyakarta',
    currentLocation: 'Jakarta', profession: 'Homemaker',
    gender: 'female', isAlive: false, generation: 1, maritalStatus: 'married',
    photoUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '3', treeId: 'wijaya-family', name: 'Andi Wijaya',
    nickname: 'Mr. Andi', birthDate: '1970-05-15', birthPlace: 'Jakarta',
    currentLocation: 'South Jakarta', profession: 'Entrepreneur', education: "Bachelor's in Economics",
    gender: 'male', isAlive: true, generation: 2, maritalStatus: 'married',
    email: 'andi.wijaya@email.com', phone: '+62812345678',
    photoUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '4', treeId: 'wijaya-family', name: 'Sari Handayani',
    birthDate: '1975-09-08', birthPlace: 'Bandung', currentLocation: 'Surabaya',
    profession: 'Doctor', education: "Bachelor's in Medicine",
    gender: 'female', isAlive: true, generation: 2, maritalStatus: 'married',
    email: 'sari.handayani@email.com', phone: '+62812345679',
    photoUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '5', treeId: 'wijaya-family', name: 'Dedi Wijaya',
    birthDate: '1968-11-30', birthPlace: 'Jakarta', currentLocation: 'Surabaya',
    profession: 'Engineer', education: "Bachelor's in Engineering",
    gender: 'male', isAlive: true, generation: 2, maritalStatus: 'married',
    photoUrl: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '6', treeId: 'wijaya-family', name: 'Rudi Wijaya',
    birthDate: '1998-03-12', birthPlace: 'Jakarta', currentLocation: 'Jakarta',
    profession: 'Software Engineer', education: "Bachelor's in Computer Science",
    gender: 'male', isAlive: true, generation: 3, maritalStatus: 'single',
    email: 'rudi.wijaya@email.com', phone: '+62812345680',
    photoUrl: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '7', treeId: 'wijaya-family', name: 'Maya Wijaya',
    birthDate: '2000-07-18', birthPlace: 'Jakarta', currentLocation: 'Jakarta',
    profession: 'University Student', education: "Bachelor's in Psychology",
    gender: 'female', isAlive: true, generation: 3, maritalStatus: 'single',
    email: 'maya.wijaya@email.com', phone: '+62812345681',
    photoUrl: 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '8', treeId: 'wijaya-family', name: 'Arif Wijaya',
    birthDate: '1992-01-25', birthPlace: 'Surabaya', currentLocation: 'Surabaya',
    profession: 'Dentist', education: "Bachelor's in Dentistry",
    gender: 'male', isAlive: true, generation: 3, maritalStatus: 'married',
    photoUrl: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '9', treeId: 'wijaya-family', name: 'Lia Wijaya',
    birthDate: '1995-06-14', birthPlace: 'Surabaya', currentLocation: 'Bandung',
    profession: 'Designer', education: "Bachelor's in Design",
    gender: 'female', isAlive: true, generation: 3, maritalStatus: 'single',
    photoUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '10', treeId: 'wijaya-family', name: 'Kenzo Wijaya',
    birthDate: '1997-09-03', birthPlace: 'Surabaya', currentLocation: 'Surabaya',
    profession: 'Photographer', education: "Bachelor's in Fine Arts",
    gender: 'male', isAlive: true, generation: 3, maritalStatus: 'single',
    photoUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
  {
    id: '11', treeId: 'wijaya-family', name: 'Aira Wijaya',
    birthDate: '1999-12-20', birthPlace: 'Surabaya', currentLocation: 'Jakarta',
    profession: 'Content Creator', education: "Bachelor's in Communications",
    gender: 'female', isAlive: true, generation: 3, maritalStatus: 'single',
    photoUrl: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=150',
  },
];

seedMembers.forEach(m => db.members.set(m.id, m));

// ─── Seed Relationships ───────────────────────────────────

const seedRelationships: MemberRelationship[] = [
  { id: 'rel-1', treeId: 'wijaya-family', memberId: '1', relatedId: '2', type: 'spouse' },
  { id: 'rel-2', treeId: 'wijaya-family', memberId: '2', relatedId: '1', type: 'spouse' },
  { id: 'rel-3', treeId: 'wijaya-family', memberId: '1', relatedId: '3', type: 'parent' },
  { id: 'rel-4', treeId: 'wijaya-family', memberId: '2', relatedId: '3', type: 'parent' },
  { id: 'rel-5', treeId: 'wijaya-family', memberId: '1', relatedId: '5', type: 'parent' },
  { id: 'rel-6', treeId: 'wijaya-family', memberId: '2', relatedId: '5', type: 'parent' },
  { id: 'rel-7', treeId: 'wijaya-family', memberId: '5', relatedId: '4', type: 'spouse' },
  { id: 'rel-8', treeId: 'wijaya-family', memberId: '4', relatedId: '5', type: 'spouse' },
  { id: 'rel-9', treeId: 'wijaya-family', memberId: '3', relatedId: '6', type: 'parent' },
  { id: 'rel-10', treeId: 'wijaya-family', memberId: '3', relatedId: '7', type: 'parent' },
  { id: 'rel-11', treeId: 'wijaya-family', memberId: '5', relatedId: '8', type: 'parent' },
  { id: 'rel-12', treeId: 'wijaya-family', memberId: '4', relatedId: '8', type: 'parent' },
  { id: 'rel-13', treeId: 'wijaya-family', memberId: '5', relatedId: '9', type: 'parent' },
  { id: 'rel-14', treeId: 'wijaya-family', memberId: '4', relatedId: '9', type: 'parent' },
  { id: 'rel-15', treeId: 'wijaya-family', memberId: '5', relatedId: '10', type: 'parent' },
  { id: 'rel-16', treeId: 'wijaya-family', memberId: '4', relatedId: '10', type: 'parent' },
  { id: 'rel-17', treeId: 'wijaya-family', memberId: '5', relatedId: '11', type: 'parent' },
  { id: 'rel-18', treeId: 'wijaya-family', memberId: '4', relatedId: '11', type: 'parent' },
];

seedRelationships.forEach(r => db.relationships.set(r.id, r));

// ─── Adapter Implementation ───────────────────────────────

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export class MockAdapter implements DataAdapter {
  readonly name = 'mock';
  readonly version = '1.0.0';
  readonly description = 'In-memory mock adapter for local development & testing';

  // ── Auth ────────────────────────────────────────────────

  async login({ email, password }: AuthCredentials): Promise<AuthSession> {
    await delay(300);
    const record = db.users.get(email.toLowerCase());
    if (!record || record.password !== password) {
      throw new AuthError('Invalid email or password', 'INVALID_CREDENTIALS');
    }
    const session: AuthSession = { user: record.user, token: `mock-token-${uid()}` };
    db.currentSession = session;
    return session;
  }

  async register(input: RegisterInput): Promise<AuthSession> {
    await delay(300);
    const email = input.email.toLowerCase();
    if (db.users.has(email)) {
      throw new AuthError('Email is already registered', 'EMAIL_EXISTS');
    }
    const user = {
      id: `user-${uid()}`,
      email,
      name: input.name,
      familyName: input.familyName,
      createdAt: new Date().toISOString(),
    };
    db.users.set(email, { password: input.password, user });
    const session: AuthSession = { user, token: `mock-token-${uid()}` };
    db.currentSession = session;
    return session;
  }

  async logout(): Promise<void> {
    db.currentSession = null;
  }

  async getSession(): Promise<AuthSession | null> {
    return db.currentSession;
  }

  async refreshSession(): Promise<AuthSession | null> {
    return db.currentSession;
  }

  // ── Family Trees ────────────────────────────────────────

  async listTrees(): Promise<FamilyTreeRecord[]> {
    await delay(100);
    return Array.from(db.trees.values());
  }

  async getTree(id: string): Promise<FamilyTreeRecord | null> {
    await delay(50);
    return db.trees.get(id) ?? null;
  }

  async createTree(input: CreateTreeInput): Promise<FamilyTreeRecord> {
    await delay(200);
    const tree: FamilyTreeRecord = {
      id: `tree-${uid()}`,
      name: input.name,
      description: input.description,
      memberCount: 0,
      generationCount: 0,
      lastUpdated: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.trees.set(tree.id, tree);
    return tree;
  }

  async updateTree(id: string, data: Partial<FamilyTreeRecord>): Promise<FamilyTreeRecord> {
    await delay(100);
    const existing = db.trees.get(id);
    if (!existing) throw new NotFoundError(`Tree "${id}" not found`);
    const updated = { ...existing, ...data, lastUpdated: new Date().toISOString() };
    db.trees.set(id, updated);
    return updated;
  }

  async deleteTree(id: string): Promise<void> {
    await delay(100);
    if (!db.trees.has(id)) throw new NotFoundError(`Tree "${id}" not found`);
    db.trees.delete(id);
    // Cascade: delete related members and relationships
    for (const [mid, m] of db.members) {
      if (m.treeId === id) db.members.delete(mid);
    }
    for (const [rid, r] of db.relationships) {
      if (r.treeId === id) db.relationships.delete(rid);
    }
  }

  // ── Family Members ──────────────────────────────────────

  async listMembers(treeId: string): Promise<FamilyMemberRecord[]> {
    await delay(100);
    return Array.from(db.members.values()).filter(m => m.treeId === treeId);
  }

  async getMember(id: string): Promise<FamilyMemberRecord | null> {
    await delay(50);
    return db.members.get(id) ?? null;
  }

  async createMember(treeId: string, input: CreateMemberInput): Promise<FamilyMemberRecord> {
    await delay(200);
    if (!db.trees.has(treeId)) throw new NotFoundError(`Tree "${treeId}" not found`);
    const member: FamilyMemberRecord = {
      id: `member-${uid()}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.members.set(member.id, member);

    // Update tree member count
    const tree = db.trees.get(treeId)!;
    const treeMembers = Array.from(db.members.values()).filter(m => m.treeId === treeId);
    db.trees.set(treeId, { ...tree, memberCount: treeMembers.length, lastUpdated: new Date().toISOString() });

    return member;
  }

  async updateMember(id: string, data: Partial<FamilyMemberRecord>): Promise<FamilyMemberRecord> {
    await delay(100);
    const existing = db.members.get(id);
    if (!existing) throw new NotFoundError(`Member "${id}" not found`);
    const updated = { ...existing, ...data, updatedAt: new Date().toISOString() };
    db.members.set(id, updated);
    return updated;
  }

  async deleteMember(id: string): Promise<void> {
    await delay(100);
    const member = db.members.get(id);
    if (!member) throw new NotFoundError(`Member "${id}" not found`);
    db.members.delete(id);
    // Clean up orphaned relationships
    for (const [rid, r] of db.relationships) {
      if (r.memberId === id || r.relatedId === id) db.relationships.delete(rid);
    }
    // Update tree member count
    const tree = db.trees.get(member.treeId);
    if (tree) {
      const treeMembers = Array.from(db.members.values()).filter(m => m.treeId === member.treeId);
      db.trees.set(member.treeId, { ...tree, memberCount: treeMembers.length, lastUpdated: new Date().toISOString() });
    }
  }

  // ── Relationships ───────────────────────────────────────

  async listRelationships(treeId: string): Promise<MemberRelationship[]> {
    await delay(50);
    return Array.from(db.relationships.values()).filter(r => r.treeId === treeId);
  }

  async createRelationship(
    treeId: string,
    memberId: string,
    relatedId: string,
    type: MemberRelationship['type'],
  ): Promise<MemberRelationship> {
    await delay(100);
    const rel: MemberRelationship = {
      id: `rel-${uid()}`,
      treeId,
      memberId,
      relatedId,
      type,
    };
    db.relationships.set(rel.id, rel);
    return rel;
  }

  async deleteRelationship(id: string): Promise<void> {
    await delay(50);
    db.relationships.delete(id);
  }
}
