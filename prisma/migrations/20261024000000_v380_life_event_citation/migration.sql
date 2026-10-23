-- Tabel join LifeEventCitation (v380, ADR 0011 decision 4, fase
-- dual-read): satu baris adalah satu rujukan citation pada satu life
-- event, dengan order untuk urutan baca. Additive only: tidak ada
-- kolom atau tabel lama yang diubah atau dihapus. Kolom citationId
-- tunggal di LifeEvent DIPERTAHANKAN apa adanya sampai cutover
-- (AC6 v380, di luar goal ini).

-- CreateTable
CREATE TABLE "LifeEventCitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lifeEventId" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    CONSTRAINT "LifeEventCitation_lifeEventId_fkey" FOREIGN KEY ("lifeEventId") REFERENCES "LifeEvent" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LifeEventCitation_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "LifeEventCitation_lifeEventId_idx" ON "LifeEventCitation"("lifeEventId");

-- CreateIndex
CREATE INDEX "LifeEventCitation_citationId_idx" ON "LifeEventCitation"("citationId");
