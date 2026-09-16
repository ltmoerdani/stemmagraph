-- Consent ledger v1 (S-06b): one new table, additive only.
-- A row is one consent action on one member: action mirrors
-- ConsentAction in src/lib/consent/record.ts ("grant" | "revoke"
-- | "regrant"). Append-only in the application domain; rows are
-- removed only when the member is deleted (FK cascade).
-- No core model changes: FamilyMember gains only the Prisma relation
-- annotation, the foreign key lives on this table.

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "note" TEXT,
    "at" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConsentRecord_memberId_idx" ON "ConsentRecord"("memberId");
