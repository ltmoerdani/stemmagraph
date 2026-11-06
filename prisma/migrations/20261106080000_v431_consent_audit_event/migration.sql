-- Consent audit trail v431 fase 2c: one new table, additive only.
-- A row is one auditable consent decision on one member: aksi mirrors
-- the audit vocabulary in src/lib/consent/audit.ts ("grant" | "revoke"
-- | "regrant" | "scope_change"), sumber records where the decision was
-- captured ("ui" | "api"), noop marks a revoke that left no ledger row
-- behind (ADR 0015 idempotent semantics). Append-only in the
-- application domain; rows are removed only when the member is deleted
-- (FK cascade). No core consent model changes: ConsentRecord and
-- FamilyMember keep their existing columns, FamilyMember gains only
-- the Prisma relation annotation. Writes go exclusively through
-- appendAuditEvent in server/events.ts (single write gate, pola
-- events.ts P2-2 AC-3); there is no update or delete helper.

-- CreateTable
CREATE TABLE "ConsentAuditEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "aksi" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "sumber" TEXT NOT NULL,
    "noop" BOOLEAN NOT NULL DEFAULT false,
    "at" DATETIME NOT NULL,
    CONSTRAINT "ConsentAuditEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConsentAuditEvent_memberId_idx" ON "ConsentAuditEvent"("memberId");
