-- Additive columns merge audit (v390 Merge Anggota Terpandu fase 1).
-- Baris anggota duplikat tidak pernah dihapus: mergedIntoId menunjuk
-- primary, mergedAt mencatat waktu merge. NULL = belum di-merge.
-- Safe on existing data; no backfill required.
ALTER TABLE "FamilyMember" ADD COLUMN "mergedIntoId" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN "mergedAt" DATETIME;
