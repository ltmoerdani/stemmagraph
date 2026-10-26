-- v405: ASSO asosiasi antar individu fase 1 (round-trip GEDCOM 7).
-- Additive only: satu kolom JSON baru di FamilyMember, tanpa drop apa pun.
ALTER TABLE "FamilyMember" ADD COLUMN "associations" JSON;
