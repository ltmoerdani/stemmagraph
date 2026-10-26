# Panduan Restore Backup Self-Host (v407)

Dokumen operator untuk memulihkan database Stemmagraph dari file backup
otomatis. Semua perintah dijalankan di mesin host yang menjalankan
`docker compose`.

## Cara kerja backup

Sejak v406 server membuat backup SQLite otomatis lewat API bawaan
better-sqlite3 (online, aman saat aplikasi berjalan). File muncul di
folder backup dengan nama `stemmagraph-backup-YYYYMMDDTHHMMSSZ.db`.
Sejak v407 retensi otomatis menjaga jumlah file tetap terkendali.

## Variabel lingkungan

| Variabel | Default | Arti |
|---|---|---|
| `BACKUP_DIR` | `data/backups` | Folder tujuan file backup, dibaca runner dan route daftar dari satu sumber yang sama |
| `BACKUP_INTERVAL_HOURS` | `24` | Jarak antar backup otomatis |
| `BACKUP_KEEP` | `14` | Jumlah file backup yang disimpan, file tertua dihapus melewatinya |
| `BACKUP_ON_BOOT` | `false` | Bila `true`, satu backup dijalankan saat server menyala |

## Trigger manual

Butuh JWT akun owner (role owner, status active):

```bash
curl -X POST http://localhost:3000/api/v1/backups \
  -H "Authorization: Bearer $JWT"
```

Daftar file backup yang tersedia:

```bash
curl http://localhost:3000/api/v1/backups \
  -H "Authorization: Bearer $JWT"
```

## Verifikasi file backup sebelum dipakai

```bash
npx tsx scripts/verify-restore.mjs
```

Skrip ini membuat database uji sementara, mem-backup via kode produksi,
lalu membuka kembali file hasil dan memastikan isinya identik. Keluaran
`LULUS` berarti jalur backup-restore sehat.

## Langkah restore ke volume Docker

1. Hentikan aplikasi:

```bash
docker compose stop app
```

2. Temukan lokasi volume data:

```bash
docker volume inspect stg_db
```

3. Salin file backup ke volume sebagai database utama. Ganti path Mountpoint
   dan nama file backup sesuai keadaan. Contoh:

```bash
sudo cp /var/lib/docker/volumes/stg_db/_data/stemmagraph.db /var/lib/docker/volumes/stg_db/_data/stemmagraph.db.pra-restore
sudo cp data/backups/stemmagraph-backup-20261026T084031Z.db /var/lib/docker/volumes/stg_db/_data/stemmagraph.db
```

Catatan: compose memetakan `DATABASE_URL=file:/app/data/stemmagraph.db`
sehingga nama file utama harus persis `stemmagraph.db`.

4. Nyalakan lagi dan verifikasi:

```bash
docker compose start app
curl -f http://localhost:3000/ && echo OK
```

5. Simpan file `.pra-restore` sampai aplikasi terverifikasi sehat, lalu hapus.

## Restore tanpa Docker (self-host proses langsung)

1. Stop proses server.
2. Salin file backup menimpa path yang ditunjuk `DATABASE_URL`
   (misal `file:./prisma/dev.db` berarti file `prisma/dev.db`).
3. Jalankan `npx prisma migrate deploy` bila memulihkan ke versi kode lebih baru.
4. Start server dan cek endpoint health.

## Batasan

- Backup bersifat lokal di mesin host (non-goal fase ini: offsite/S3).
- Enkripsi backup belum termasuk (non-goal).
- Tidak ada UI restore di aplikasi; operasi restore dilakukan via shell operator.
