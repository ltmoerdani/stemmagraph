-- V116-II: normalisasi gender M/F/X/U plus kolom tanggal GEDCOM.
-- Tanpa DELETE, tanpa DROP, tabel lain tidak disentuh.

ALTER TABLE "FamilyMember" ADD COLUMN "birthDateGed" TEXT;
ALTER TABLE "FamilyMember" ADD COLUMN "deathDateGed" TEXT;

UPDATE "FamilyMember"
SET gender = CASE lower(gender)
  WHEN 'male' THEN 'M'
  WHEN 'female' THEN 'F'
  WHEN 'other' THEN 'X'
  ELSE 'U'
END;
