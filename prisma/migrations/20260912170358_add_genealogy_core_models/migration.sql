-- CreateTable
CREATE TABLE "PartialDate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "dateKind" TEXT NOT NULL,
    "yearStart" INTEGER,
    "monthStart" INTEGER,
    "dayStart" INTEGER,
    "yearEnd" INTEGER,
    "monthEnd" INTEGER,
    "dayEnd" INTEGER,
    "originalDateString" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Place" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "publisher" TEXT,
    "repositoryRef" TEXT,
    "url" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "qualifier" TEXT,
    "transcription" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'secondary',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Citation_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LifeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "treeId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "partnerMemberId" TEXT,
    "eventType" TEXT NOT NULL,
    "dateId" TEXT,
    "placeId" TEXT,
    "citationId" TEXT,
    "detail" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LifeEvent_dateId_fkey" FOREIGN KEY ("dateId") REFERENCES "PartialDate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LifeEvent_placeId_fkey" FOREIGN KEY ("placeId") REFERENCES "Place" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LifeEvent_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Place_treeId_idx" ON "Place"("treeId");

-- CreateIndex
CREATE UNIQUE INDEX "Place_treeId_normalizedName_key" ON "Place"("treeId", "normalizedName");

-- CreateIndex
CREATE INDEX "Source_treeId_idx" ON "Source"("treeId");

-- CreateIndex
CREATE INDEX "Citation_sourceId_idx" ON "Citation"("sourceId");

-- CreateIndex
CREATE INDEX "LifeEvent_treeId_memberId_idx" ON "LifeEvent"("treeId", "memberId");

-- CreateIndex
CREATE INDEX "LifeEvent_eventType_idx" ON "LifeEvent"("eventType");
