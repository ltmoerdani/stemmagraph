-- P2-1 account states: User gains status + role, new Notification table.
-- Additive columns; the legacy mapping below keeps old data working.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'member';

-- Legacy mapping (honest, documented in docs/decisions/0002):
-- every account that existed before P2-1 becomes status 'active' with the
-- default role 'member', so old installs behave exactly as before.
-- No existing account is promoted to OWNER by this migration: the
-- bootstrap OWNER rule only fires on an empty user table. Installs that
-- need an owner use scripts/seed-owner.mjs (or the next registration on
-- an empty user table).
UPDATE "User" SET "status" = 'active';

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "readAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
