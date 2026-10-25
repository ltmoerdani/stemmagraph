# Keamanan Kanal ICS Feed (v394 + v396 + v400)

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
| Rotasi dan revoke manual | POST calendar-token/rotate menurunkan token lama ke prev (grace 7 hari); DELETE calendar-token mematikan kedua token sekaligus | v394, grace v400 |
| Rotasi otomatis 90 hari | Tree dengan token aktif berumur lebih dari 90 hari dirotasi senyap oleh scheduler per jam; URL lama tetap hidup selama grace 7 hari lalu mati sendiri | v400 |
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

## Rotasi otomatis 90 hari dengan grace 7 hari (v400)

Sejak v400 URL feed punya umur maksimum. Setiap tree dengan token aktif
berumur lebih dari 90 hari dirotasi otomatis oleh scheduler yang berjalan
per jam di server (pola scheduler digest v387). Umur dihitung dari rotasi
terakhir; tree yang belum pernah dirotasi memakai tanggal dibuatnya tree.
Pass idempoten: dipanggil berulang pada jam yang sama menghasilkan
keputusan yang sama, tanpa rotasi ganda.

Mekanisme rotasinya sama dengan rotate manual: token lama turun ke
kolom prev, token baru menggantikan, dan momen rotasi dicatat. URL lama
masih dijawab selama grace 7 hari sejak rotasi supaya subscriber kalender
sempat memakai URL baru, lalu mati sendiri tanpa intervensi. Revoke manual
mematikan token aktif dan token prev sekaligus, sehingga feed benar-benar
mati saat diminta. Tanpa notifikasi ke owner saat rotasi (non-goal v400).

## Non-goals

Tanpa OAuth kalender, tanpa webcal:// khusus, tanpa notifikasi email/wa
saat rotasi otomatis.
