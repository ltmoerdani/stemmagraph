-- CreateTable
CREATE TABLE "TreeMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'viewer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TreeMember_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TreeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "treeId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "grantedRole" TEXT NOT NULL DEFAULT 'viewer',
    "maxUses" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "lastUsedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invitation_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "TreeMember_userId_idx" ON "TreeMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TreeMember_treeId_userId_key" ON "TreeMember"("treeId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_token_key" ON "Invitation"("token");

-- CreateIndex
CREATE INDEX "Invitation_treeId_idx" ON "Invitation"("treeId");

-- CreateIndex
CREATE INDEX "Invitation_createdById_idx" ON "Invitation"("createdById");
