# RESN Export Privacy Parity (v135-ii)

## Arti flag

`exportPrivacyParity` adalah opsi boolean opsional pada `ExportGedcom70Input` (dan otomatis pada `ExportGedzipInput`) dengan nilai default `false`.

- `false` atau tidak diisi: perilaku ekspor sama persis dengan kondisi merged v135. Byte output identik, sudah dibuktikan test byte-identity.
- `true`: nilai RESN level PRIVACY ikut dibuang dari output. Penanda pembatasan privasi tidak ikut dalam arsip yang dibagikan, sesuai semangat spesifikasi GEDCOM tentang penghapusan data.
- CONFIDENTIAL selalu dibuang apa pun nilai flag, karena rantai penghapusan data tidak boleh bocor ke hasil ekspor. LOCKED selalu lolos karena menandai data yang tidak boleh diubah, bukan data yang disembunyikan.

Implementasi mendelegasikan normalisasi enum, precedence event atas record, dan pembuangan CONFIDENTIAL ke modul `resn-export-filter.ts` (`resolveExportResn` dan `filterResnForExport`). Flag hanya menyaring tambahan pada hasil yang sudah ternormalisasi, tanpa menduplikasi logika enum.

## Rekomendasi spec g7:enumset-RESN

Enumset RESN pada GEDCOM 7 mendefinisikan nilai pembatasan akses: CONFIDENTIAL, LOCKED, PRIVACY (lihat katalog struktur RESN, g7:enumset-RESN). Nilai-nilai itu sah tertulis di berkas, tetapi penerima arsip tidak selalu berhak melihat penandanya. Rekomendasi kami:

1. Pembuat arsip untuk dibagikan (share-ready) mengaktifkan flag ini supaya PRIVACY tidak tercetak, sesuai paragraf 1.6 Removing data: penghapusan strukturnya benar-benar dilakukan, bukan sekadar disembunyikan di tampilan.
2. Arsip privat (private archive) mempertahankan perilaku lama dengan flag nonaktif, supaya penerima arsip privat tetap melihat penanda pembatasan RESN.
3. Aplikasi penerima dilarang mengasumsikan ketiadaan tag RESN berarti data bebas pembatasan; ketiadaan tag bisa berarti penandanya sengaja dihapus saat ekspor.

## Rujukan

Spesifikasi FamilySearch GEDCOM 7.0, bagian 1.6 Removing data:
https://gedcom.io/specifications/FamilySearchGEDCOMv7.html

Bagian tersebut mengatur cara yang benar menghapus data dari berkas GEDCOM, termasuk struktur RESN dan arti penghapusannya bagi rantai distribusi data.
