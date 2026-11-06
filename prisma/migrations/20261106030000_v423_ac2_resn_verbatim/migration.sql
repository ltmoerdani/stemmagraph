-- GOAL v423 AC2: enforcement RESN (privacy restriction).
-- Additive only: satu kolom verbatim pada FamilyMember, tanpa drop atau
-- ubah kolom lain. SQLite dialect. NULL berarti tidak ada RESN tercatat
-- (perilaku lama seluruhnya tetap).

-- AlterTable
ALTER TABLE "FamilyMember" ADD COLUMN "resnVerbatim" TEXT;
