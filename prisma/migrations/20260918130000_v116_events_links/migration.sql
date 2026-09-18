-- V116-III-B: event genealogis per member + tautan anak ke orang tua.
-- Additive only: dua tabel baru, tanpa DROP, tanpa ubah kolom existing.
-- type divalidasi di level aplikasi (makeEvent / mapPediToRelationship),
-- bukan constraint database.

-- CreateTable
CREATE TABLE "GenealogyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dateGed" TEXT,
    "place" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GenealogyEvent_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilyLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "childId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    CONSTRAINT "FamilyLink_childId_fkey" FOREIGN KEY ("childId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyLink_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "GenealogyEvent_memberId_idx" ON "GenealogyEvent"("memberId");

-- CreateIndex
CREATE INDEX "FamilyLink_childId_idx" ON "FamilyLink"("childId");

-- CreateIndex
CREATE INDEX "FamilyLink_parentId_idx" ON "FamilyLink"("parentId");
