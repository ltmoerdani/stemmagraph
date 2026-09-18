-- STG v121-i: relax PARTNER uniqueness on FamilyRelationship.
-- GEDCOM 7 allows the same couple in two FAM records (see the official
-- testfile remarriage2.ged). The old unique index rejected two PARTNER
-- rows for the same pair across different families.
-- Schema change only: drop the unique index, create a plain index on
-- the same columns. No data is deleted, no table is dropped.

-- DropIndex
DROP INDEX IF EXISTS "FamilyRelationship_memberId_relatedId_type_key";

-- CreateIndex
CREATE INDEX "FamilyRelationship_memberId_relatedId_type_idx" ON "FamilyRelationship"("memberId", "relatedId", "type");
