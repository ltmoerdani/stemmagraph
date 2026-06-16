-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "familyName" TEXT,
    "avatar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FamilyTree" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "generationCount" INTEGER NOT NULL DEFAULT 0,
    "thumbnail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "birthDate" TEXT NOT NULL,
    "deathDate" TEXT,
    "birthPlace" TEXT,
    "currentLocation" TEXT,
    "profession" TEXT,
    "education" TEXT,
    "gender" TEXT NOT NULL DEFAULT 'male',
    "photoUrl" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isAlive" BOOLEAN NOT NULL DEFAULT true,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "maritalStatus" TEXT NOT NULL DEFAULT 'single',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FamilyMember_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FamilyRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "relatedId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FamilyRelationship_treeId_fkey" FOREIGN KEY ("treeId") REFERENCES "FamilyTree" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyRelationship_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FamilyRelationship_relatedId_fkey" FOREIGN KEY ("relatedId") REFERENCES "FamilyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "FamilyMember_treeId_idx" ON "FamilyMember"("treeId");

-- CreateIndex
CREATE INDEX "FamilyMember_generation_idx" ON "FamilyMember"("generation");

-- CreateIndex
CREATE INDEX "FamilyRelationship_treeId_idx" ON "FamilyRelationship"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "FamilyRelationship_memberId_relatedId_type_key" ON "FamilyRelationship"("memberId", "relatedId", "type");
