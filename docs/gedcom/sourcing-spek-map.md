# Peta Spek Sourcing GEDCOM 7 untuk Model Data Stemmagraph

Dokumen ini memetakan struktur sourcing GEDCOM 7.0 ke model data Stemmagraph, mencakup SOURCE_RECORD, SOURCE_CITATION, QUAY, dan PLAC beserta dua edge kasus spek dan aturan parity round-trip. Peta ini menjadi acuan desain skema entitas Source/Citation sebelum implementasi parser import dan export dimulai.

## AC1: Pemetaan SOURCE_RECORD

SOURCE_RECORD (tag `SOUR` pada level record) membawa metadata satu sumber genealogi. Tabel berikut merinci substructure yang diizinkan beserta kardinalitasnya sesuai spek GEDCOM 7.

| Substructure | Kardinalitas | Keterangan |
|---|---|---|
| ABBR | {0:1} | Nama singkat sumber |
| AUTH | {0:1} | Pembuat sumber |
| PUBL | {0:1} | Keterangan publikasi |
| TEXT | {0:1} | Kutipan teks dari sumber |
| TITL | {0:1} | Judul sumber |
| DATA | {0:1} | Data yang diambil dari sumber |
| REPO | {0:M} | Arsip tempat sumber disimpan |
| EXID | {0:M} | Identifier eksternal |
| NOTE | {0:M} | Catatan lokal |
| SNOTE | {0:M} | Shared note |
| OBJE | {0:M} | Objek multimedia |
| UID | {0:M} | Identifier unik stabil |
| CHAN | {0:1} | Timestamp perubahan terakhir |
| CREA | {0:1} | Timestamp pembuatan record |

Sumber: https://gedcom.io/terms/v7/record-SOUR.html

## AC2: Pemetaan SOURCE_CITATION

SOURCE_CITATION (tag `SOUR` bersarang di dalam record atau event lain) menautkan data klaim ke sumbernya. Payload citation berupa pointer ke sebuah SOURCE_RECORD.

| Substructure | Kardinalitas | Keterangan |
|---|---|---|
| PAGE | {0:1} | Lokasi rujukan di dalam sumber, misalnya halaman atau entri |
| QUAY | {0:1} | Peringkat keandalan data dari citation ini |
| SOUR-DATA | {0:1} | Detail data yang diperoleh dari sumber pada citation ini |
| SOUR-EVEN | {0:1} | Event yang dicatat sumber tersebut |
| NOTE | {0:M} | Catatan lokal pada citation |
| OBJE | {0:M} | Objek multimedia pada citation |
| SNOTE | {0:M} | Shared note pada citation |

Untuk citation tanpa SOURCE_RECORD, spek menyediakan pola voidPtr: payload pointer dibiarkan kosong dan informasi lokasi dituliskan lewat PAGE. Rekomendasi spek tetap menyarankan setiap citation menunjuk sebuah SOURCE_RECORD, sehingga pola voidPtr plus PAGE hanya untuk data lama atau kasus khusus.

Sumber: https://gedcom.io/terms/v7/SOUR.html

## AC3: QUAY sebagai Enum 0-3

Nilai QUAY mengikuti enumset-QUAY berupa empat angka pilihan: 0, 1, 2, 3. Maknanya adalah peringkat kredibilitas (credibility ranking) yang dipakai untuk urutan tampilan di antarmuka. Pembaca tetap melakukan evaluasi sumbernya sendiri; nilai ini hanya penunjuk awal.

| Nilai | Makna |
|---|---|
| 0 | Bukti tidak dapat dipercaya, estimasi bisa salah |
| 1 | Keandalan dipertanyakan |
| 2 | Bukti tidak langsung |
| 3 | Bukti langsung dan jelas |

Sumber: https://gedcom.io/terms/v7/QUAY.html dan https://gedcom.io/types/enumset-QUAY.html

## AC4: Pemetaan PLAC

Payload PLAC berupa daftar yurisdiksi yang dipisah koma, terurut dari wilayah terkecil ke terbesar (contoh: kelurahan, kota, provinsi, negara). Aturan pemetaannya sebagai berikut.

| Substructure | Kardinalitas | Keterangan |
|---|---|---|
| FORM | {0:1} | Menentukan tipe setiap elemen dalam daftar yurisdiksi |
| TRAN | {0:M} | Terjemahan nama tempat ke bahasa lain |
| MAP | {0:1} | Koordinat (latitude dan longitude) |

Nama wilayah yang mengandung koma dilarang karena akan merusak parsing daftar yurisdiksi. Spek juga mencatat deprecation: penggunaan EXID pada PLAC tanpa TYPE sudah tidak disarankan.

Sumber: https://gedcom.io/terms/v7/PLAC.html

## AC5: Dua Edge Kasus Spek

### Nesting NOTE berisi SOURCE_CITATION

NOTE boleh berisi SOURCE_CITATION, dan citation itu sendiri boleh berisi NOTE lagi, sehingga kedalaman nesting berpotensi tak berbatas secara spek. Strategi parser kami memberi batas depth eksplisit lewat konstanta `MAX_CITATION_DEPTH`; nilainya ditentukan saat implementasi.

### Keterbatasan model sourcing

Spek record-SOUR memperingatkan bahwa model sourcing GEDCOM diketahui insufficient untuk sebagian use case. Implikasinya untuk desain skema Stemmagraph: entitas Source dan Citation memakai superset kolom di atas struktur GEDCOM dengan nullability longgar, agar data yang tidak tercakup model tetap bisa ditampung tanpa migrasi besar.

## AC6: Aturan Parity Round-Trip

Field berikut wajib lolos parity round-trip per field (nilai identik sebelum export dan sesudah import):

- AUTH
- TITL
- PAGE
- QUAY
- MAP
- isi PLAC
- urutan REPO/CALN

Aturan validasi import:

1. Citation tanpa SOURCE_RECORD tetap sah selama memakai pola voidPtr plus PAGE.
2. PLAC tanpa FORM tetap sah selama urutan yurisdisinya lowest-to-highest.

## References

Semua URL diakses 2026-11-27, pembacaan first-hand oleh Sena.

- https://gedcom.io/terms/v7/record-SOUR.html
- https://gedcom.io/terms/v7/SOUR.html
- https://gedcom.io/terms/v7/QUAY.html
- https://gedcom.io/types/enumset-QUAY.html
- https://gedcom.io/terms/v7/PLAC.html
