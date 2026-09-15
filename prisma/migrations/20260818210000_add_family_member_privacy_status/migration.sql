-- S-06 Privacy Filter Ekspor Wave 1: per-individual sharing consent.
-- Additive only: one nullable column, no other column touched.
-- Domain values (application layer): 'shared' | 'private'.
-- NULL means the preference has not been recorded yet; the export
-- privacy gate treats NULL on a living member as redact (safe default).

ALTER TABLE "FamilyMember" ADD COLUMN "privacyStatus" TEXT;
