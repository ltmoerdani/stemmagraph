-- Additive column: GEDCOM 7 SEX payload verbatim (v262, kontrak sex-fidelity).
-- Safe on existing data; no backfill required.
ALTER TABLE "FamilyMember" ADD COLUMN "sexGed" TEXT;
