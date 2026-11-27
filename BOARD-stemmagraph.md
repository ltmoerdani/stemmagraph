# BOARD - Stemmagraph

## Item Eksekusi
| ID | Item | Sumber | Status | Branch | Putaran QA | QA | Evaluasi vs GOAL |
|---|---|---|---|---|---|---|---|
| S-01 | Bongkar konstruksi SaaS (isPremium, paywall, /upgrade, Upgrade/*) | Vision / S-01 | Complete | improve/s01-saas-dismantle | 1 | Pass | Terverifikasi PM 26 Nov: trace komersial nihil di src/+server/, dir Upgrade nihil, route /upgrade nihil di origin/develop |
| S-02 | CI guard anti-komersial | Vision / S-02 | Complete | develop | 1 | Pass | Terverifikasi PM 26 Nov: .github/workflows/pure-core.yml + scripts/guard-pure-core.mjs aktif di origin/develop |
| S-03 | ADR pure-core | Vision / S-03 | Complete | develop | 1 | Pass | Terverifikasi PM 26 Nov: ADR 0016 commit d98fcac + docs/decisions/0016-pure-core-architecture.md di origin/develop |
| v466 | ASSO apply wiring (tutup TODO v418 applyAdapter, round-trip asosiasi) | PM derivasi VISION gap 2 / evidence Sena wake-347 | In Progress | improve/stg-v466-asso-apply-wiring | 0 | - | Dispatch ulang 26 Nov 11:0x (sesi pertama putus pra-eksekusi, branch nihil di origin; develop sudah 3204cd5, mirror github disinkron); fullstack in-flight |

## Permintaan Riset
| ID | Topik | Status | Catatan |
|---|---|---|---|
| R-01 | GEDCOM 7 + GEDZIP dan consent/privasi living persons | Complete | Terserap v417-v418 import pipeline, evidence notes Sena |
| R-02 | GEDCOM 7 ASSO/ROLE enumset resmi (15 nilai) + struktur ASSO di gedcom.io | Complete | Sena 26 Nov: gedcom.io/terms/v7 ASSO, ROLE, enumset-ROLE (akses 26 Nov 2026); kasus uji tambahan AC2 v466: ASSO @VOID@ + PHRASE round-trip, ASSO subordinate ke event tetap di event sama |

## Log Supervisi
- 2026-11-21 15:15:11: Siklus supervisi AIA dimulai, verifikasi agen dan board paralel tiga project.
- 2026-11-26 08:45: Siklus supervisi: verdict S-01/S-02/S-03 Complete first-hand di origin/develop (fa3178a); BOARD dikoreksi dari status stale. R-01 ditutup Complete.
- 2026-11-26 09:05: Goal mandiri turun dari VISION gap 2: v466 ASSO apply wiring (TODO v418 applyAdapter tidak menulis kolom associations Json, import apply membuang ASSO, round-trip bocor). Dispatch fullstack branch improve/stg-v466-asso-apply-wiring dari develop fa3178a. Evidence pendukung: spec GEDCOM 7.0.18 ASSO/ROLE (Sena wake-347).
- 2026-11-26 09:10: Kanal Telegram ke Pak bermasalah di sesi ini (send_message_to_peer gagal parameter target 2x, escalate_to_human gagal chat_id kosong). Dicatat, kerja lanjut otonom sesuai mandat, tanpa standby.
- 2026-11-26 11:0x wake-348: Verifikasi first-hand: sesi dispatch v466 pertama putus tanpa jejak (branch nihil lokal + origin). Github mirror develop sinkron manual via fullstack redispatch (fa3178a -> 3204cd5, terverifikasi). Redispatch v466 sync ke fullstack: AC diperjelas first-hand (applyImportPlan sudah meneruskan associations baris 94-95, pola cast prisma.adapter.ts baris 269, kolom Json? baris 158; scope tepat applyAdapter.ts + test). Fullstack in-flight, polling origin.
- 2026-11-26 11:0x: Riset Sena masuk (R-02): enumset ROLE 15 nilai first-hand gedcom.io; tiga kasus uji tambahan dari contoh resmi spec untuk AC2 v466 (ASSO @VOID@ + PHRASE, ASSO di event tetap di event sama, ASSO + ROLE enum dua arah). Akan diverifikasi di QA R1 v466.
- 2026-11-27 08:5x WIB wake-358: Redispatch v467 unit media (GEDZIP media round-trip) sync ke fullstack di branch existing origin improve/stg-v467-gedzip-media-roundtrip (tip f2c26ba WIP harness dari 0c3934c): instruksi merge origin/develop (tip 35939a9d berisi unit A OBJE gate) ke branch dulu, lalu AC media round-trip: export zip entry media nama persis payload tanpa percent-escape, media tanpa kompres, guard OBJE tanpa FILE dan FILE tanpa FORM sebelum zip dibangun, collision gedcom.ged di-rename, import validasi entry hilang error terukur, round-trip test hash byte-identik, gates penuh. Dasar AC: evidence Sena wake358b spek Chapter 4 GEDZIP + term FILE/OBJE (salvase PM dari transkrip delegate ke notes PM). Slot STG 1 dari 1, fullstack in-flight. Kanal Telegram sesi ini nihil tool kirim tersedia (pola down 09:10), kerja otonom lanjut. main dan staging nihil disentuh, em dash 0.

## v467 unit B1 (turunan baris baru wake-359)

| ID | Item | Sumber | Status | Branch | Putaran QA | QA | Evaluasi vs GOAL |

| ID | Item | Sumber | Status | Branch | Putaran QA | QA | Evaluasi vs GOAL |
|---|---|---|---|---|---|---|---|
| v467-B1 | Harness round-trip GEDZIP media (test-only): packageGedzip lalu importGedzip byte-identik + scanObjeGate sah/tolak | Turunan PM wake-359 dari v467 pasca unit A OBJE gate (pola scope kecil + branch segar terbukti) | complete | develop (merged f7e56d3, origin+github sinkron) | 1 | passed (PM) | QA PM first-hand wake-359: vitest targeted 6 pass, regresi direktori gedcom 78 file hijau pada run konfirmasi (2 fail run pertama terverifikasi flaky resource contention: lulus terisolasi 17/17, lulus di develop, dan run penuh kedua hijau), tsc 0, eslint targeted exit 0, em dash 0, guard pure-core bersih, impl nihil disentuh, lockfile nihil. Anchor dikoreksi executor benar: ExportGedzipInput butuh input aplikasi penuh, test pakai packageGedzip langsung (jalur internal sama dengan exportGedzip), scanObjeGate return array error dengan kode stabil. Executor improver mekanik satu putaran 448860a (redispatch kedua; percobaan pertama qa mati tanpa jejak 22 menit, fullstack pagi ini nihil mendarat). Merge no-ff f7e56d3 ke origin + github develop sinkron, branch dihapus lokal + origin. |

- [2026-11-27 10:0x-11:2x] Wake-359 PM: dua sesi fullstack pertama (ZRT + STG) mati tanpa jejak tanpa sentuhan repo (reflog nol aktivitas sejak dispatch, pola zai degraded pagi ini). Jalur substantif berbeda: redispatch pola dikte penuh + kontrak WIP menit ke-5 + branch segar ke executor darurat (qa untuk ZRT mendarat, qa untuk STG mati, improver mekanik untuk STG mendarat). Dua unit merged satu wake: ZRT v438-B1 (48bc463) dan STG v467-B1 (f7e56d3, origin+github sinkron). Kanal Telegram nihil tool sesi (lanjutan sejak 24 Nov), laporan kanonik BOARD + GOAL + STATE. Em dash 0.
