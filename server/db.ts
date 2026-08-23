// Shared Prisma client for the API server (P2-2 AC-3).
//
// One client instance for the whole server so the event-store helper and
// the route handlers share a single connection pool instead of opening
// parallel SQLite connections.

import { PrismaClient } from '../generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env['DATABASE_URL'] || 'file:./prisma/dev.db' }),
});
