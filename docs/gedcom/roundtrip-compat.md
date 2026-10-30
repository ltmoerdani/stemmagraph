# Kompatibilitas Round-Trip GEDCOM (GOAL v115 AC2)

Dokumen ini merangkum daftar pengecualian sah (tidak dianggap kehilangan data material) saat melakukan round-trip GEDCOM (import ke model internal lalu export kembali ke GEDCOM 7.0).

## Daftar Pengecualian Sah

1. _UID (Unique Identifier spesifik software pihak ketiga)
2. CHAN / CHANGE_DATE (Timestamp perubahan riwayat)
3. Custom tags berawalan underscore
4. REFN + TYPE (Reference number eksternal dan tipenya)
5. RIN vs EXID (Record ID vs External ID)
6. Header file SUBM / DEST / COPR

Pengecualian di atas merupakan metadata ekstensi vendor atau administratif yang berada di luar model data silsilah inti (core genealogy model) Stemmagraph.
