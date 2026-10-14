# Panduan Self-Host Stemmagraph (Docker)

Panduan ini untuk menjalankan Stemmagraph di server Anda sendiri dengan Docker. Rujukan pola penyebaran: dokumentasi Gramps Web, https://www.grampsweb.org/install_setup/deployment/ (diakses 14 Oktober 2026).

## Prasyarat

- Docker Engine dan Docker Compose v2 terpasang di host.
- Port 3000 tersedia untuk layanan aplikasi.
- Perhatikan bahwa image dibangun dengan `node:22-alpine` dan basis data memakai SQLite melalui Prisma.

## Menjalankan

```sh
docker compose up -d --build
```

Perintah itu membangun image multi-stage, lalu menjalankan migrasi (`npx prisma migrate deploy`) sebelum server hidup. Aplikasi melayani di `http://<host>:3000`. Alternatif tanpa mengetik compose langsung: `npm run docker:build` lalu `npm run docker:up`.

## Konfigurasi dan Persistensi

`docker-compose.yml` mengatur `DATABASE_URL=file:/app/data/stemmagraph.db`. Berkas basis data hidup di dalam volume bernama `stg_db` yang di-mount ke `/app/data`, jadi data tetap utuh saat kontainer dihentikan, diperbarui, atau dibangun ulang. Ubah baris `environment` di compose bila Anda perlu mengarah ke lokasi lain.

## Perubahan v178-ii: Non-root, Healthcheck, dan tini

Sejak v178-ii, kontainer berjalan sebagai user `node`, bukan root. Proses utama diawali `tini` sebagai PID 1 sehingga sinyal stop dari Docker diteruskan ke Node dan kontainer berhenti rapi. Image juga membawa HEALTHCHECK yang mengakses `http://127.0.0.1:3000/` tiap 30 detik (timeout 5 detik, start-period 30 detik, dinyatakan unhealthy setelah 3 kegagalan). Status HTTP apa pun dihitung hidup karena healthcheck ini menguji proses server merespons.

Cara verifikasi:

```sh
docker inspect --format '{{json .State.Health}}' $(docker compose ps -q app)
```

Kontainer baru berstatus `starting`, lalu menjadi `healthy` setelah permintaan pertama sukses. Bila tetap `unhealthy`, periksa log lewat `docker compose logs app`.

Kepemilikan volume: direktori `/app/data` di image dimiliki `node:node`, jadi volume `stg_db` yang baru mewarisi kepemilikan itu pada pemakaian pertama dan migrasi Prisma bisa menulis berkas SQLite. Volume bawaan pemasangan lama terlanjur dimiliki root; perbaiki sekali setelah upgrade:

```sh
docker compose down
docker run --rm -v stg_db:/data alpine chown -R node:node /data
docker compose up -d
```

## Peringatan Keamanan: HTTPS Wajib untuk Akses Publik

Menjalankan Stemmagraph di jaringan publik tanpa HTTPS TIDAK aman. Tanpa enkripsi, kredensial login dan data silsilah keluarga lewat dalam bentuk teks terbuka dan bisa disadap. Pola yang sama ditegaskan pada dokumentasi penerapan Gramps Web. Untuk akses publik, letakkan reverse proxy di depan aplikasi (misalnya Caddy atau nginx) dan terbitkan sertifikat Let's Encrypt untuk domain Anda, kemudian batasi compose agar hanya melayani di localhost atau jaringan internal sampai TLS terpasang.

## Backup

Volume `stg_db` berisi satu berkas SQLite, sehingga backup cukup dengan menyalin isinya:

```sh
docker run --rm -v stg_db:/data -v "$PWD":/backup alpine tar czf /backup/stg_db-backup.tar.gz -C /data .
```

Simpan arsip hasil perintah itu di lokasi terpisah dari server. Pulihkan dengan membongkar arsip ke volume yang sama.

## Catatan Arsitektur

Perbandingan berikut dari catatan riset 14 Oktober 2026 (sesi riset Sena atas Gramps Web dan webtrees). Gramps Web menyebarkan tiga layanan sekaligus: aplikasi, celery untuk pekerjaan latar, dan valkey sebagai perantara pesan, karena basis datanya butuh antrean tugas. Webtrees berjalan di PHP dengan MySQL dan panduannya menyebut sekitar lima langkah penyiapan basis data. Stemmagraph memakai SQLite sehingga cukup satu layanan: aplikasi dan basis data hidup di satu kontainer dengan satu volume, migrasi jalan otomatis saat mulai, dan tidak ada redis maupun celery yang perlu dioperasikan. Pilihan ini menyederhanakan self-host untuk keluarga atau instansi kecil yang mengelola sendiri servernya.
