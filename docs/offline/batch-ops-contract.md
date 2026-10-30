# Kontrak Batch Ops Outbox (v112, slice 2A)

Status: interface-only. Dokumen ini mengikat bentuk endpoint untuk konsumsi
outbox batch, tanpa implementasi server. Eksekusi server menyusul di goal
terpisah. Sumber tipe TypeScript: `src/lib/offline/contract.ts`.

## 1. Tujuan

Mendefinisikan kontrak endpoint batch ops outbox agar klien (modul offline:
outbox, flush, reconnect) dan server punya kesepakatan bentuk request,
respons, dan semantik error sebelum implementasi. Status dokumen:
interface-only, tanpa implementasi server. Eksekusi server menyusul di goal
terpisah.

## 2. Endpoint

```
POST /api/trees/:treeId/members/batch
Idempotency-Key: <UUID RFC 9562>
```

Header `Idempotency-Key` wajib, berisi UUID v4 (RFC 9562). Satu key mewakili
satu batch, nilainya sama dengan `batchKey` di modul outbox klien
(`beginBatch()` menghasilkan `crypto.randomUUID()`).

## 3. Request Body

```json
{
  "ops": [
    { "kind": "member.add", "memberId": "m-101", "data": { "name": "Aria", "birth": "1970-04-12" } },
    { "kind": "member.update", "memberId": "m-102", "data": { "name": "Bimo" } },
    { "kind": "member.remove", "memberId": "m-103" }
  ]
}
```

`kind` terbatas pada `member.add`, `member.update`, `member.remove` (tipe
`OutboxOpKind`). Field `data` opsional, tidak dikirim untuk `member.remove`.

## 4. Semantik Error

Body error mengikuti RFC 9457 `application/problem+json`.

| Status | Konstanta | Kasus |
| ------ | --------- | ----- |
| 400 | `BATCH_ERR_MISSING_KEY` | Header `Idempotency-Key` hilang atau kosong |
| 422 | `BATCH_ERR_KEY_REUSE` | Key dipakai ulang untuk payload berbeda (fingerprint tidak cocok) |
| 409 | `BATCH_ERR_CONCURRENT` | Ada request lain dengan key sama yang masih outstanding |

Contoh problem+json per kasus:

400, header hilang:

```json
{
  "type": "https://stemmagraph.example/problems/missing-idempotency-key",
  "title": "Idempotency-Key header missing",
  "status": 400,
  "detail": "Header Idempotency-Key wajib diisi UUID RFC 9562."
}
```

422, key dipakai ulang untuk payload berbeda:

```json
{
  "type": "https://stemmagraph.example/problems/idempotency-key-reuse",
  "title": "Idempotency-Key reused with different payload",
  "status": 422,
  "detail": "Key ini sudah tercatat untuk fingerprint payload lain."
}
```

409, request concurrent outstanding:

```json
{
  "type": "https://stemmagraph.example/problems/idempotency-key-concurrent",
  "title": "Request with this key is still in progress",
  "status": 409,
  "detail": "Tunggu request sebelumnya selesai sebelum mengirim ulang."
}
```

### Aturan Retry

Hanya kegagalan transport (exception jaringan, request tak pernah sampai ke
aplikasi) yang di-retry klien. Semua jawaban HTTP, termasuk 4xx dan 5xx, adalah
jawaban final dan tidak di-retry. Preseden: Workbox background sync, `fetchDidFail`
hanya terpicu exception jaringan, bukan status response.

## 5. Replay Semantics

Request yang sudah selesai lalu dikirim ulang dengan key sama dan fingerprint
payload sama dijawab ulang dengan respons asli yang tersimpan. Bentuk respons:

```json
{ "applied": 3, "replay": true }
```

`applied` = jumlah op yang diterapkan pada eksekusi asli. `replay: true`
menandakan jawaban lama untuk key yang sudah selesai (semantik draft-08 IETF,
https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/).
Eksekusi baru mengembalikan `replay: false`.

## 6. Ordering dan At-least-once

Klien mengirim batch secara berurutan per `createdAt` (modul `flush.ts`),
satu batch konfirmasi sukses baru lanjut batch berikutnya. Di jaringan tidak
stabil, pengiriman ulang membuat sifat pengiriman menjadi at-least-once.
Duplikasi akibat kirim ulang dicegah server lewat `Idempotency-Key`, sehingga
efek bersih di server setara exactly-once.

## 7. Conflict Resolution

Server adalah pemutus konflik akhir. Penerapan op tetap memakai LWW existing
plus revision, mengikuti pola `putTreeLww` di `src/lib/offline/idb.ts`
(LWW berbasis `savedAt` + slot backup satu generasi). Klien tidak melakukan
resolusi konflik sendiri; jawaban server final untuk batch tersebut.

## Referensi

- Draft IETF idempotency key header: https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/
  (terakhir dicek 30 Okt 2026, masih -08, belum ada -09)
- RFC 9457 (problem details), RFC 9562 (UUID)
