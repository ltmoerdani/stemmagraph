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
