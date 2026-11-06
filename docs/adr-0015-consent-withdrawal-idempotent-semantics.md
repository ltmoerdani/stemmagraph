# ADR 0015: Semantik idempoten penarikan consent (v424 fase 2a AC4)

Tanggal: 2026-11-06. Status: diterima. Mengimplementasikan GOAL v424 fase 2a
(consent withdrawal idempotent semantics).

## Konteks

Ledger consent (S-06a) bersifat append-only dengan reducer pure: revoke atas
state tanpa grant aktif adalah transisi ilegal yang melempar
`ConsentLedgerError` dan endpoint memetakannya ke 409
`CONSENT_INVALID_TRANSITION`. Aturan ini benar untuk menjaga kebersihan
ledger, tetapi terlalu keras untuk permukaan API penarikan consent.

Dua masalah konkret:

1. Subjek data yang menekan tombol penarikan dua kali (double click,
   retry jaringan, replay request) menerima 409 di pemanggilan kedua,
   padahal hasil akhir yang diinginkan sudah tercapai di pemanggilan
   pertama. Kegagalan semu ini merusak pengalaman dan memicu retry tak
   berujung dari klien.
2. GDPR Art. 7 ayat 3: subjek data berhak menarik persetujuannya sewaktu
   waktu, dan penarikan harus semudah pemberian. Grant atas ledger nihil
   berjalan mulus, sementara revoke atas kondisi yang belum pernah grant
   (anggota baru diimpor tanpa consent, atau data historis pra-ledger)
   menabrak 409. Jalur penarikan lebih keras daripada jalur pemberian.

Preseden internasional: RFC 9110 bagian 9.2.2 mencatat bahwa DELETE atas
resource yang sudah tidak ada lazim dijawab sukses (204/200) atau 404,
dan semantik idempoten mengharuskan efek sekunder satu request identik
untuk N request identik. Mengikuti tradisi idempoten HTTP, no-op DELETE
atas resource yang sudah hilang dijawab sukses.

## Keputusan

1. POST revoke (jalur owner `/api/v1/members/:memberId/consent` maupun
   jalur self `/api/v1/members/:memberId/consent/self`) atas state tanpa
   grant aktif adalah no-op sukses: 200 dengan bentuk respons utuh
   `(record, granted, privacyStatus)`, tanpa baris ledger baru dan tanpa
   perubahan privacyStatus. Deteksi memakai helper pure
   `isIdempotentNoOpRevoke(action, state)` di
   `src/lib/consent/dispatch.ts`: true bila action revoke dan state tidak
   granted (belum pernah grant ATAU sudah revoked).
2. Bentuk respons no-op: `record` berisi record ledger terakhir yang
   membentuk state sekarang (stabil antar pemanggilan ulang, bukan record
   semu ber-timestamp baru), null bila ledger kosong; `granted` false;
   `privacyStatus` dibaca apa adanya dari member tanpa penulisan.
3. Pemetaan error dilakukan di adapter (server/index.ts), tidak di
   reducer. Reducer pure `record.ts` tetap menolak revoke tanpa grant
   sebagai transisi ilegal di dalam transaksi; aturan ledger internal
   tidak berubah. Yang berubah hanya respons API ketika permintaan
   pasti no-op.
4. Urutan cek di endpoint: validasi body (`parseConsentBody`, 400) dan
   `createRecord` (400) berjalan lebih dulu, lalu replay ledger
   (`replayConsentState`) untuk cek no-op. Akibatnya body invalid tetap
   400 meski state sedang no-op, dan ledger korup tetap 409 (garansi
   S-06e dipertahankan). Jalur normal (grant, regrant, revoke atas
   grant aktif) tidak tersentuh dan tetap 201 via transaksi.
5. Jalur self tidak boleh lebih keras dari jalur owner: semantik no-op
   yang persis sama, supaya penarikan consent oleh subjek data sama
   mudahnya dengan oleh pengelola (GDPR Art. 7 ayat 3).
6. Tanpa endpoint baru, tanpa perubahan wire format respons jalur
   normal. Klien lama yang tidak tahu semantik baru tetap kompatibel:
   409 hanya berubah menjadi 200 pada kasus yang sebelumnya pasti gagal.

## Konsekuensi

- Retry klien aman: revoke ulang atas state yang sama menghasilkan
  respons semantik identik, tanpa efek samping ledger maupun
  privacyStatus.
- Ledger tidak pernah berisi baris no-op; setiap baris tetap mewakili
  transisi nyata, jadi replay historis dan audit tetap bersih.
- Anti-enumerasi tidak terdampak: cek no-op berjalan setelah guard role
  dan guard self yang sudah 404/403 identik untuk member nihil.
- Event emission tidak dipicu untuk no-op (tidak ada baris ledger, tidak
  ada notifikasi owner palsu). Audit hanya untuk keputusan nyata.
- Test kontrak (AC2 + AC3) di `src/server/consent-revoke-idempotent-api.test.ts`
  memakai pola toStrictEqual + structuredClone + deepFreeze yang sama
  dengan test API consent sebelumnya.

## Rujukan

- GDPR (Regulation (EU) 2016/679) Art. 7 ayat 3: kondisi penarikan
  persetujuan; penarikan harus sama mudahnya dengan pemberian.
- RFC 9110 (HTTP Semantics) bagian 9.2.2: idempotent methods, DELETE
  atas resource sudah hilang lazim dijawab sukses.
- ADR terkait: semantik ledger S-06a/S-06b/S-06e (reducer pure, pemetaan
  409, transaksi replay-dalam-tx) tidak diubah oleh ADR ini.
