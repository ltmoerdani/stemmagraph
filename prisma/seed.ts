// Seed script — demo data for local development
// Run: npx prisma db seed

import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db' }),
});

async function main() {
  console.log('🌱 Seeding database...');

  // ── Demo User ───────────────────────────────────────────
  const user = await prisma.user.upsert({
    where: { email: 'demo@familytree.app' },
    update: {},
    create: {
      email: 'demo@familytree.app',
      password: 'demo123',
      name: 'Demo User',
      familyName: 'Wijaya',
    },
  });
  console.log(`  ✓ User: ${user.email}`);

  // ── Demo Tree ───────────────────────────────────────────
  const tree = await prisma.familyTree.upsert({
    where: { id: 'wijaya-family' },
    update: {},
    create: {
      id: 'wijaya-family',
      name: 'Keluarga Besar Wijaya',
      description: 'Pohon keluarga besar marga Wijaya dari Yogyakarta',
      memberCount: 0,
      generationCount: 0,
    },
  });

  // ── Members ─────────────────────────────────────────────
  const membersData = [
    { id: '1', name: 'Budi Wijaya', birthDate: '1945-03-15', deathDate: '2018-08-20', birthPlace: 'Yogyakarta', currentLocation: 'Jakarta', profession: 'Pensiunan Guru', education: 'S1 Pendidikan', gender: 'male', isAlive: false, generation: 1, maritalStatus: 'married', photoUrl: 'https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '2', name: 'Siti Wijaya', birthDate: '1948-07-22', deathDate: '2020-12-10', birthPlace: 'Yogyakarta', currentLocation: 'Jakarta', profession: 'Ibu Rumah Tangga', gender: 'female', isAlive: false, generation: 1, maritalStatus: 'married', photoUrl: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '3', name: 'Andi Wijaya', nickname: 'Pak Andi', birthDate: '1970-05-15', birthPlace: 'Jakarta', currentLocation: 'Jakarta Selatan', profession: 'Pengusaha', education: 'S1 Ekonomi', gender: 'male', isAlive: true, generation: 2, maritalStatus: 'married', email: 'andi.wijaya@email.com', phone: '+62812345678', photoUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '4', name: 'Sari Handayani', birthDate: '1975-09-08', birthPlace: 'Bandung', currentLocation: 'Surabaya', profession: 'Dokter', education: 'S1 Kedokteran', gender: 'female', isAlive: true, generation: 2, maritalStatus: 'married', email: 'sari.handayani@email.com', phone: '+62812345679', photoUrl: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '5', name: 'Dedi Wijaya', birthDate: '1968-11-30', birthPlace: 'Jakarta', currentLocation: 'Surabaya', profession: 'Insinyur', education: 'S1 Teknik', gender: 'male', isAlive: true, generation: 2, maritalStatus: 'married', photoUrl: 'https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '6', name: 'Rudi Wijaya', birthDate: '1998-03-12', birthPlace: 'Jakarta', currentLocation: 'Jakarta', profession: 'Software Engineer', education: 'S1 Informatika', gender: 'male', isAlive: true, generation: 3, maritalStatus: 'single', email: 'rudi.wijaya@email.com', phone: '+62812345680', photoUrl: 'https://images.pexels.com/photos/1043471/pexels-photo-1043471.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '7', name: 'Maya Wijaya', birthDate: '2000-07-18', birthPlace: 'Jakarta', currentLocation: 'Jakarta', profession: 'Mahasiswa', education: 'S1 Psikologi', gender: 'female', isAlive: true, generation: 3, maritalStatus: 'single', email: 'maya.wijaya@email.com', phone: '+62812345681', photoUrl: 'https://images.pexels.com/photos/1065084/pexels-photo-1065084.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '8', name: 'Arif Wijaya', birthDate: '1992-01-25', birthPlace: 'Surabaya', currentLocation: 'Surabaya', profession: 'Dokter Gigi', education: 'S1 Kedokteran Gigi', gender: 'male', isAlive: true, generation: 3, maritalStatus: 'married', photoUrl: 'https://images.pexels.com/photos/1043474/pexels-photo-1043474.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '9', name: 'Lia Wijaya', birthDate: '1995-06-14', birthPlace: 'Surabaya', currentLocation: 'Bandung', profession: 'Desainer', education: 'S1 Desain', gender: 'female', isAlive: true, generation: 3, maritalStatus: 'single', photoUrl: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '10', name: 'Kenzo Wijaya', birthDate: '1997-09-03', birthPlace: 'Surabaya', currentLocation: 'Surabaya', profession: 'Fotografer', education: 'S1 Seni Rupa', gender: 'male', isAlive: true, generation: 3, maritalStatus: 'single', photoUrl: 'https://images.pexels.com/photos/1040880/pexels-photo-1040880.jpeg?auto=compress&cs=tinysrgb&w=150' },
    { id: '11', name: 'Aira Wijaya', birthDate: '1999-12-20', birthPlace: 'Surabaya', currentLocation: 'Jakarta', profession: 'Content Creator', education: 'S1 Komunikasi', gender: 'female', isAlive: true, generation: 3, maritalStatus: 'single', photoUrl: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=150' },
  ];

  for (const m of membersData) {
    await prisma.familyMember.upsert({
      where: { id: m.id },
      update: {},
      create: { ...m, treeId: tree.id },
    });
  }
  console.log(`  ✓ ${membersData.length} family members`);

  // ── Relationships ───────────────────────────────────────
  const rels = [
    { id: 'rel-1', memberId: '1', relatedId: '2', type: 'spouse' },
    { id: 'rel-2', memberId: '2', relatedId: '1', type: 'spouse' },
    { id: 'rel-3', memberId: '1', relatedId: '3', type: 'parent' },
    { id: 'rel-4', memberId: '2', relatedId: '3', type: 'parent' },
    { id: 'rel-5', memberId: '1', relatedId: '5', type: 'parent' },
    { id: 'rel-6', memberId: '2', relatedId: '5', type: 'parent' },
    { id: 'rel-7', memberId: '5', relatedId: '4', type: 'spouse' },
    { id: 'rel-8', memberId: '4', relatedId: '5', type: 'spouse' },
    { id: 'rel-9', memberId: '3', relatedId: '6', type: 'parent' },
    { id: 'rel-10', memberId: '3', relatedId: '7', type: 'parent' },
    { id: 'rel-11', memberId: '5', relatedId: '8', type: 'parent' },
    { id: 'rel-12', memberId: '4', relatedId: '8', type: 'parent' },
    { id: 'rel-13', memberId: '5', relatedId: '9', type: 'parent' },
    { id: 'rel-14', memberId: '4', relatedId: '9', type: 'parent' },
    { id: 'rel-15', memberId: '5', relatedId: '10', type: 'parent' },
    { id: 'rel-16', memberId: '4', relatedId: '10', type: 'parent' },
    { id: 'rel-17', memberId: '5', relatedId: '11', type: 'parent' },
    { id: 'rel-18', memberId: '4', relatedId: '11', type: 'parent' },
  ];

  for (const r of rels) {
    await prisma.familyRelationship.upsert({
      where: { id: r.id },
      update: {},
      create: { ...r, treeId: tree.id },
    });
  }
  console.log(`  ✓ ${rels.length} relationships`);

  // ── Update Tree Stats ───────────────────────────────────
  const memberCount = await prisma.familyMember.count({ where: { treeId: tree.id } });
  const generations = await prisma.familyMember.findMany({
    where: { treeId: tree.id },
    select: { generation: true },
    distinct: ['generation'],
  });
  await prisma.familyTree.update({
    where: { id: tree.id },
    data: { memberCount, generationCount: generations.length },
  });
  console.log(`  ✓ Tree stats updated: ${memberCount} members, ${generations.length} generations`);
  console.log('\n✅ Seed complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
