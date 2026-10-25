-- v400: rotasi otomatis token ICS feed dengan grace period.
-- Additive only: dua kolom baru di FamilyTree, tanpa drop apa pun.
ALTER TABLE "FamilyTree" ADD COLUMN "icsFeedTokenPrev" TEXT;
ALTER TABLE "FamilyTree" ADD COLUMN "icsFeedRotatedAt" DATETIME;
