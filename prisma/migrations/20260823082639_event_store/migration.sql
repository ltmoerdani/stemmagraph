-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "actorUserId" TEXT,
    "familyTreeId" TEXT,
    "payloadJson" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Event_createdAt_idx" ON "Event"("createdAt");

-- CreateIndex
CREATE INDEX "Event_type_createdAt_idx" ON "Event"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Event_actorUserId_createdAt_idx" ON "Event"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "Event_familyTreeId_createdAt_idx" ON "Event"("familyTreeId", "createdAt");
