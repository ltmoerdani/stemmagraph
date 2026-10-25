# Keamanan Kanal ICS Feed (v394 + v396)

## Model ancaman

URL feed ICS berisi token akses pribadi per tree sebagai query param
(`calendar.ics?token=...`). Token ini setara kredensial: siapa pun yang
memegang URL dapat membaca seluruh reminder keluarga (birthday, wedding,
haul anggota). Vektor kebocoran yang ditutup dokumen ini:

1. Referer leak: URL feed dibuka atau dirender (mis. preview link) lalu
   browser mengirim URL penuh sebagai header Referer saat memuat resource
   pihak ketiga dari halaman tersebut.
2. URL tersalin ke tempat publik (chat, dokumen) tanpa kesadaran pemilik.

Referensi: CWE-598 (Use of GET Request Method With Sensitive Query Strings).

## Mitigasi berlapis

| Lapisan | Mekanisme | Status |
|---|---|---|
| Token unguessable | 256-bit CSPRNG per tree (pola invitation token ADR 0004) | v394 |
| Anti-enumerasi | Token salah/kosong/null dibalas 404 (bukan 401) agar token valid tidak terkonfirmasi | v394 |
| Rotasi dan revoke manual | POST calendar-token/rotate mematikan token lama langsung; DELETE calendar-token mematikan feed | v394 |
| Referrer-Policy header | no-referrer pada semua respons route ICS termasuk 401/403/404 | v396 |
| Meta referrer dokumen | no-referrer di index.html, lapisan kedua untuk navigasi/resource SPA | v396 |

Defence in depth: tidak ada satu lapisan yang diandalkan sendirian. Token
tetap berfungsi meski salah satu lapisan gagal.

## Panduan rotate manual (owner tree)

1. Buka Dashboard, panel langganan kalender (ikon kalender pada card tree
   untuk owner dan editor).
2. Klik Rotate: token lama langsung mati, URL baru tampil penuh satu kali.
3. Salin URL baru dan perbarui di aplikasi kalender (Google Calendar From
   URL, Apple Calendar, Outlook subscribe from web).
4. Ulangi kapan saja bila URL pernah tersebar ke pihak yang tidak
   diinginkan. Revoke mematikan feed tanpa menghasilkan token baru.

Batasan yang diketahui: Google Calendar From URL dirancang untuk kalender
publik (batas 400 kalender per akun); feed ini aman dipakai karena URL
inguessable, tetapi rotasi berkala tetap dianjurkan sebagai higiene.

## Non-goals

Tanpa OAuth kalender, tanpa rotasi otomatis terjadwal (kandidat v397 bila
muncul kebutuhan nyata), tanpa webcal:// khusus.
