-- v415: Komentar Profil Fase 1 (Pilar 2 kolaborasi keluarga).
-- Additive only: satu tabel baru Comment, tanpa drop atau ubah kolom lain.
-- SQLite dialect. FK cascade: komentar mengikuti anggota saat anggota
-- dihapus, dan mengikuti akun user saat akun dihapus.

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Comment_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Comment_memberId_createdAt_idx" ON "Comment"("memberId", "createdAt");
CREATE INDEX "Comment_treeId_idx" ON "Comment"("treeId");
