-- P2-5 change review (ADR 0009): one new table, additive only.
-- A row holds one proposed edit (beforeJson/afterJson snapshots plus the
-- mandatory reasonNote) and never moves the live record: only the accept
-- flow writes through the existing update path. state is pending |
-- rejected | distinct; distinct is the permanent anti-re-proposal stamp
-- for the same target and the same afterJson. decidedByUserId is a plain
-- nullable id without a foreign key so the decision trail survives
-- account deletion, mirroring the event store choice (ADR 0003).

-- CreateTable
CREATE TABLE "ChangeProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "familyTreeId" TEXT NOT NULL,
    "proposerUserId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "beforeJson" TEXT NOT NULL,
    "afterJson" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'pending',
    "reasonNote" TEXT NOT NULL,
    "autoAccepted" BOOLEAN NOT NULL DEFAULT false,
    "decidedByUserId" TEXT,
    "decidedAt" DATETIME,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ChangeProposal_familyTreeId_fkey" FOREIGN KEY ("familyTreeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeProposal_proposerUserId_fkey" FOREIGN KEY ("proposerUserId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ChangeProposal_familyTreeId_state_idx" ON "ChangeProposal"("familyTreeId", "state");

-- CreateIndex
CREATE INDEX "ChangeProposal_proposerUserId_idx" ON "ChangeProposal"("proposerUserId");
