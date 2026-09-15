#!/usr/bin/env node
// Owner seed for existing installs (P2-1, referenced by ADR 0002).
//
// Why this exists: the P2-1 migration maps legacy accounts to status 'active'
// with role 'member' and never promotes anyone to owner, because the bootstrap
// OWNER rule only fires on an empty user table. An installation that already
// has accounts therefore ends up with no owner at all. This script closes that
// gap in one line.
//
// Run from the repo root (the runner is tsx because the generated Prisma
// client is TypeScript):
//
//   npx tsx scripts/seed-owner.mjs admin@example.com
//   npx tsx scripts/seed-owner.mjs new@example.com --password secret123 --name Alice
//
// Behavior:
//   - Existing account: promoted to role 'owner' + status 'active'.
//   - Unknown account: created as an active owner. Requires --password
//     (8+ characters); --name is optional and falls back to the email prefix.

import bcrypt from 'bcryptjs';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) {
        flags[key] = true;
      } else {
        flags[key] = next;
        i++;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const { positional, flags } = parseArgs(process.argv.slice(2));
const email = positional[0];

if (!email || typeof flags.help !== 'undefined') {
  console.error('Usage: npx tsx scripts/seed-owner.mjs <email> [--password <pw>] [--name <name>]');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db',
  }),
});

async function main() {
  const otherActiveOwners = await prisma.user.count({
    where: { role: 'owner', status: 'active', email: { not: email } },
  });
  if (otherActiveOwners > 0) {
    console.log(`Note: ${otherActiveOwners} other active owner(s) already exist.`);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: 'owner', status: 'active' },
    });
    console.log(`Promoted existing account ${updated.email} (was ${existing.role}/${existing.status}) to owner/active.`);
    return;
  }

  const password = typeof flags.password === 'string' ? flags.password : '';
  if (password.length < 8) {
    console.error('Refusing to create a new owner: --password with at least 8 characters is required for a new account.');
    process.exit(1);
  }

  const name = typeof flags.name === 'string' && flags.name ? flags.name : email.split('@')[0];
  const passwordHash = await bcrypt.hash(password, 12);
  const created = await prisma.user.create({
    data: { email, password: passwordHash, name, role: 'owner', status: 'active' },
  });
  console.log(`Created new active owner ${created.email}.`);
}

main()
  .catch((error) => {
    console.error('seed-owner failed:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
