-- Relationship privacy settings v445 fase 2: satu tabel baru additive
-- only, satu baris per keluarga (1:1 FamilyTree, FK cascade). Tidak ada
-- perubahan kolom tabel mana pun yang sudah ada. Tidak ada baris berarti
-- semua nilai default berlaku di application layer.
CREATE TABLE "FamilyPrivacySettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "relationshipSteps" INTEGER NOT NULL DEFAULT 2,
    "relationshipMode" TEXT NOT NULL DEFAULT 'redact-full',
    "posthumousYears" INTEGER NOT NULL DEFAULT 30,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyPrivacySettings_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "FamilyPrivacySettings_treeId_key" ON "FamilyPrivacySettings"("treeId");
