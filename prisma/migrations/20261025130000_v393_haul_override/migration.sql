-- Additive column haul override date (v393 Override Tanggal Haul Manual
-- fase 2 reminder). Tanggal haul (peringatan wafat tahunan) yang
-- ditetapkan keluarga; banyak tradisi haul tidak jatuh tepat pada
-- tanggal wafat. Format YYYY-MM-DD sebagai string. NULL = fallback ke
-- deathDate. Safe on existing data.
ALTER TABLE "FamilyMember" ADD COLUMN "haulOverrideDate" TEXT;
