-- Additive column merge journal (v391 Un-Merge via Jurnal Merge fase 1).
-- Snapshot reverse yang ditulis ATOMIK dalam transaksi merge yang sama:
-- daftar rewire per sisi asal, relasi terhapus dengan data penuh, id
-- genealogyEvent dan lifeEvent yang dipindah, id dan nama primary,
-- timestamp. NULL pada baris merged lama berarti merge pra-v391 dan
-- unmerge ditolak 422 NO_MERGE_JOURNAL. Safe on existing data.
ALTER TABLE "FamilyMember" ADD COLUMN "mergeJournal" JSON;
