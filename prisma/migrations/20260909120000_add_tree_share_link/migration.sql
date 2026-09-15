-- Share links v1 (ADR 0010): one new table, additive only.
-- A row is one public read-only link to one tree: mode "public" or
-- "password" (password kept as a bcrypt hash in passwordHash, never
-- plaintext). revokedAt is a stamp so a revoked link stays explainable.
-- No core model changes: FamilyTree gains only the Prisma relation
-- annotation, the foreign key lives on this table.

-- CreateTable
CREATE TABLE "TreeShareLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'public',
    "passwordHash" TEXT,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreeShareLink_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "TreeShareLink_token_key" ON "TreeShareLink"("token");

-- CreateIndex
CREATE INDEX "TreeShareLink_treeId_idx" ON "TreeShareLink"("treeId");
