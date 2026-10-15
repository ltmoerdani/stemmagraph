# Diagnostik flaky folder genealogy, kontrak v255 fase i (test-only)

Tanggal: 15 Okt 2026. Penulis artefak: eksekutor fullstack (run json) plus klasifikasi PM (README ini, salvase ambang 75 menit tercapai 13:19, eksekutor diam tanpa README dan tanah push).

## Ringkasan

Fail flaky teramati: `family-graph-wiring.test.ts`, kasus 7 (fixture resmi remarriage2.ged, I1 dua pasangan sama di F1 dan F3), simptom `STACK_TRACE_ERROR` (rejection task belakangan tanpa stack berguna), hanya di bawah paralelisme berkas penuh.

## Hipotesis

- (a) shared state antar berkas: TERELIMINASI. Enam run shuffle seed 11/22/33/44/55/66 (paralel penuh) SEMUA hijau 1948/1948; fail hanya muncul pada satu seed tertentu, bukan pola kontaminasi lintas berkas yang konsisten.
- (b) urutan eksekusi: TERELIMINASI DATA. Run seed 101/202/404/505/606 semua hijau 1948/1948; hanya seed 707 gagal 1 test (kasus 7). Urutan per se bukan penyebab cukup; pencetusnya beban waktu.
- (c) timeout/load: TERPILIH. Kasus 7 adalah satu-satunya kasus di berkas itu yang melakukan fetch jaringan (remarriage2.ged dari sumber resmi plus mirror) tanpa batas waktu eksplisit, memakai timeout default 5 detik vitest. Di bawah paralelisme berkas penuh, fetch bisa melampaui 5 detik sehingga rejection belakangan muncul sebagai STACK_TRACE_ERROR. Bukti: run-file-seed-707 (berkas itu saja, 8 kasus) hijau; run-seed-707-nofp (--no-file-parallelism) hijau 1948/1948; reproduksi gagal konsisten hanya di seed 707 paralel penuh.

## Perbaikan terkecil (komit d79b383)

Test-only di `src/lib/genealogy/family-graph-wiring.test.ts`, 3 ins 3 del: timeout eksplisit 30 detik pada `it` kasus 7 plus `AbortSignal.timeout(15000)` per percobaan fetch di `ambilRemarriage2()`. Dual-source tetap. Nihil kode produksi tersentuh, nihil test dinonaktifkan.

## Verifikasi pasca perbaikan

- verify-seed-707: 1948/1948 hijau.
- verify-seed-808: 1948/1948 hijau.

## Inventaris artefak

- flaky-seed11..66.json: reproduksi awal 6 run shuffle seed (semua hijau saat run awal, karakter nondeterministik).
- run-seed-101..606.json: 5 run seed tambahan (semua hijau).
- run-seed-707.json: REPRODUKSI GAGAL, kasus 7 STACK_TRACE_ERROR (bukti utama).
- run-seed-707-nofp.json: seed 707 tanpa paralelisme berkas, hijau (eliminasi a, dukung c).
- run-file-seed-707.json: berkas tunggal seed 707, hijau 8/8 (dukung c).
- verify-seed-707.json plus verify-seed-808.json: verifikasi pasca perbaikan, hijau.
- tmp/run-seed*.log: log mentah run.

Catatan: folder `.qa-archive/` di-exclude via `.git/info/exclude`, komit artefak memakai `git add -f` sesuai kontrak (AC 1).
