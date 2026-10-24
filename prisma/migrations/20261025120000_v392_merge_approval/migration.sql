-- Additive table merge approval (v392 Approval Workflow Merge Berisiko fase 1).
-- Satu baris = satu permintaan persetujuan merge berisiko tinggi dibuat route
-- merge saat assessMergeRisk menyatakan NEEDS_APPROVAL. Merge baru dieksekusi
-- setelah role owner/editor lain (decider berbeda dari requester) menyetujui.
-- Safe on existing data; no backfill required.
CREATE TABLE "MergeApproval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "primaryId" TEXT NOT NULL,
    "duplicateId" TEXT NOT NULL,
    "reasons" JSON NOT NULL,
    "planStats" JSON NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requesterId" TEXT NOT NULL,
    "deciderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "MergeApproval_treeId_status_idx" ON "MergeApproval"("treeId", "status");

-- AddForeignKey
ALTER TABLE "MergeApproval" ADD CONSTRAINT "MergeApproval_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree"("id") ON DELETE CASCADE ON UPDATE CASCADE;
