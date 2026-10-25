-- v394 ICS feed kalender keluarga (fase 1): token subscribe pribadi tree.
-- Null = feed mati (belum dibuat atau sudah di-revoke). Unique index supaya
-- satu token hanya pernah milik satu tree (unguessable efektif).
ALTER TABLE "FamilyTree" ADD COLUMN "icsFeedToken" TEXT;
CREATE UNIQUE INDEX "FamilyTree_icsFeedToken_key" ON "FamilyTree"("icsFeedToken");