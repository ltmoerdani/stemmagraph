# event-backfill-io

Lapisan eksekusi IO untuk backfill payload event ke format v2. Modul ini
jembatan antara perencana pure `planBackfillBatch` (event-backfill-plan.ts)
dan database via Prisma. Semua keputusan kripto ada di lapisan pure; modul
ini hanya query, transaksi, dan pelaporan progres.

## Pemakaian dari script admin

```ts
import {
  getDekByKeyId,
  getOrCreateDek,
} from '@/lib/crypto/family-key-store';
import { runBackfillIo } from '@/lib/crypto/event-backfill-io';

const summary = await runBackfillIo({
  prisma,
  // Tidak diisi berarti default 200, clamp maksimum 999.
  chunkSize: 200,
  // DEK spesifik per keyId untuk baris v1 dan hasil enkripsi ulang.
  resolveDek: (keyId) => getDekByKeyId(treeId, keyId),
  // Kunci aktif tree untuk baris legacy tanpa keyId. Dibungkus try/catch
  // supaya kegagalan store kunci tidak menggagalkan run, cukup balik null
  // dan baris tercatat tree_missing di errorDetails.
  resolveTreeKey: (treeId) => {
    try {
      return getOrCreateDek(treeId);
    } catch {
      return null;
    }
  },
  // Opsional: progres tiap selesai satu chunk.
  onProgress: (s) => {
    console.log(
      `total=${s.totalRows} encrypted=${s.encrypted} skipped=${s.skipped} errors=${s.errors}`,
    );
  },
});

console.log(JSON.stringify(summary.errorDetails, null, 2));
```

Catatan wiring `resolveDek`: signature modul meminta `(keyId) => Buffer | null`
sehingga treeId perlu diambil dari konteks baris. Bila backfill dijalankan
per tree, pasang treeId lewat closure seperti contoh di atas dan jalankan
runBackfillIo sekali per tree. `getDekByKeyId` sudah balik null, bukan throw,
untuk kunci yang tidak ada.

## Chunk

- Default 200 baris per chunk, clamp maksimum 999.
- Query kandidat memakai cursor pagination: `orderBy id asc`, `cursor` id
  terakhir chunk sebelumnya, `take chunkSize`, bukan skip/offset, aman untuk
  data yang berubah selama run.
- Semua chunk Event diproses lebih dulu, lalu semua chunk LifeEvent, dengan
  satu summary gabungan.
- Kandidat: `payloadJson` yang tidak dimulai `v2:`, jadi run ulang bersifat
  idempoten.

## Transaksi dan retry

- Update satu chunk dikirim sebagai SATU `prisma.$transaction(arrayUpdates,
  { timeout: 30000, maxWait: 5000 })`.
- Error P2034 write conflict di-retry manual maksimal 3 kali dengan chunk
  yang sama.
- Kegagalan final satu chunk tidak menggagalkan run: seluruh rowId chunk itu
  masuk `errorDetails` dengan reason pendek maksimal 120 karakter tanpa isi
  payload dan tanpa materi kunci, lalu run lanjut ke chunk berikutnya.
- `onProgress` dipanggil tiap selesai chunk dengan salinan summary berjalan.

## Alasan error di errorDetails

- `tree_missing`: treeId null atau kosong, atau resolveTreeKey balik null.
- `memberId_missing`: payload Event valid tapi field memberId bukan string
  non-empty, atau kolom memberId LifeEvent kosong.
- `legacy_invalid_json`: payload legacy Event gagal JSON.parse.
- `dek_missing`: resolveDek balik null untuk keyId baris.
- `envelope_corrupt`: envelope v1 gagal didekripsi atau formatnya rusak.
- `tx_error_<KODE>`: transaksi chunk gagal permanen.

## Keamanan

Tidak ada payload, ciphertext, maupun materi kunci yang masuk log atau
errorDetails, hanya kode alasan dan rowId. File ini satu-satunya titik IO
pada alur backfill; planBackfillBatch tetap pure dan mudah dites terpisah.
