# ADR 0013: Erasure flow fase I sebagai pure library

## Status

Proposed (2026-09-17). Bagian S-09b-i di cabang `improve/stg-s09b-i-erasure`.

## Konteks

Visi 0.8 menempatkan privacy sebagai pilar produk: keluarga memegang kendali penuh atas data orang hidup di dalam graf. Dua regulasi menegaskan kewajiban itu. UU PDP 27/2022 memberi subjek data hak penghapusan, GDPR Art. 17 menamainya right to erasure, dan keduanya menuntut pemenuhan dalam 30 hari sejak permintaan diterima.

Saat ini consent ledger (S-06a, src/lib/consent) mencatat pemberian dan pencabutan persetujuan, dan ADR 0012 membuat setiap keputusan consent masuk ke event store sebagai fakta audit. Yang belum ada adalah mekanisme untuk permintaan yang lebih dalam: menghapus jejak identitas orang hidup dari graf sambil menjaga kegunaan graf bagi keluarga lain.

Pelajaran S-09a menunjukkan risiko utama task sebelumnya ada di lapisan wiring: integration test yang butuh app.listen memblokir dan memperlambat umpan balik. Fase erasure ini sengaja dipisah supaya logika inti bisa diverifikasi cepat tanpa menyentuh server.

## Keputusan

Fase I menghasilkan pure library di src/lib/consent/erasure.ts, tanpa import eksternal dan tanpa IO, satu pola dengan modul consent lain:

- State machine `ErasureRequest`: REQUESTED lalu COMPLETED atau CANCELLED. Dua status terakhir bersifat final; pelanggaran transisi melempar `ErasureError`, pemisahan dari Error biasa mengikuti pola `ConsentLedgerError` agar endpoint fase II bisa memetakan kode respons berbeda.
- `createErasureRequest` menghitung `dueAt` tepat 30 hari setelah `requestedAt`. `assertErasureDeadline` menolak dueAt yang melampaui tenggat, sehingga penundaan melampaui janji regulasi tidak pernah bisa tersimpan.
- `isErasureDue` menandai permintaan yang melewati tenggat; tepat pada dueAt masih dihitung dalam tenggat.
- `computeErasurePlan` menyusun rencana redaksi untuk orang hidup: nama dan tanggal hidup diredaksi, foto dihapus, relasi tetap dipertahankan sebagai graf anonim. Argumen `ErasureMemberFacts` membolehkan pemanggil menyatakan field yang tidak ada; default kosong dianggap semua field ada (konservatif).

Fase II (wiring endpoint, task terpisah) yang akan memetakan state machine ke endpoint, mengeksekusi plan ke storage, dan menghubungkan ke event store. Fase II wajib menjaga dua larangan: nol perubahan schema.prisma sampai keputusan penyimpanan jelas, dan integration test tanpa app.listen.

Konsisten dengan ADR 0012: permintaan erasure yang selesai nantinya layak menjadi fakta audit tersendiri di event store, tetapi vocabulary-nya tidak dibuka di fase ini supaya kontraknya matang dulu di lapisan pure.

## Konsekuensi

Logika keputusan erasure kini bisa dites cepat (22 kasus vitest, milidetik per run) dan dipakai ulang oleh endpoint, CLI, maupun job background tanpa duplikasi aturan. Harga yang dibayar: fase II tetap harus dibangun sebelum ada nilai produk nyata, dan plan hasil `computeErasurePlan` baru berupa kontrak, belum eksekusi. Karena deadline 30 hari dan daftar aksinya terkunci di satu modul, perubahan regulasi cukup menyentuh satu file.
