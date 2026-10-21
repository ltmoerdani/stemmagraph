# KONTRAK V335-STG-BIRTHS-BY-ZODIAC (FASE I PURE MODULE)

Tanggal kukuh: 2026-10-21 (PM Ardi, wake-103). Project: Stemmagraph. Item pipeline fill antre serial di belakang v334.

## JANGKAR TERVERIFIKASI FIRST-HAND

wt_statistic.php baris 402: getBirthsByZodiacSign() delegasi ke ZodiacLabels::translateKeys(eventRepository->getBirthsByZodiacSign()). Doc comment: grouped by zodiac sign keyed locale-translated label, view merender map label => count. Kunci kanonik English di EventRepository.

## ANTI-DUP

Grep zodiac di src/ dan server/ NIHIL. GOAL.md dan GOAL_HISTORY.md nihil entri zodiac. Beda substantif dari semua modul stats hidup (bulan kelahiran belum dimodelkan apa pun di src/lib/stats).

## DESAIN KUKUH

Satu modul pure computeBirthsByZodiac + satu testfile. Nama berkas: birth-zodiac.ts dan birth-zodiac.test.ts di src/lib/stats/.

Input: array entri pola modul v331 v333: { birthDate?: { date?: string } } diperluas birthDate.year, birthDate.month, birthDate.day (integer). Parser strict: entri bukan objek throw Error, birthDate bukan objek throw, birthDate.date bukan string throw, month di luar 1-12 throw, day di luar rentang bulan throw (pakai aturan hari maksimum per bulan, kabisat Gregorian untuk Februari), tanggal tanpa year month day lengkap dihitung excluded.

Output deterministik: { items: Array<{ label: string; count: number }>; totalDated: number; excludedEmpty: number }. items HANYA tanda ber-count > 0, urut count desc tie alphabetical asc (label lowercase). totalDated = jumlah entri bertanggal valid masuk hitung. excludedEmpty = entri tanpa tanggal lengkap.

Batas rasi (Western tropical, keputusan desain internal kontrak, bukan standar lembaga; kalibrasi opsional untuk Sena: tidak ada standar genealogi resmi): Aries 3/21-4/19, Taurus 4/20-5/20, Gemini 5/21-6/20, Cancer 6/21-7/22, Leo 7/23-8/22, Virgo 8/23-9/22, Libra 9/23-10/22, Scorpio 10/23-11/21, Sagittarius 11/22-12/21, Capricorn 12/22-1/19, Aquarius 1/20-2/18, Pisces 2/19-3/20. Label kunci kanonik English Title Case tetap di kontrak ini (tanpa locale translate, itu urusan view).

26 Februari dan 29 Februari kabisat = Pisces (rentang 2/19-3/20 menampung). Tahun bebas rentang (tidak ada cutoff).

## TEST VITEST MINIMAL 16 KASUS

1. Boundary bawah dan atas setiap rasi (pilih representatif: 3/21 Aries, 3/20 Pisces, 12/22 Capricorn, 1/19 Capricorn, 1/20 Aquarius, 2/18 Aquarius, 2/19 Pisces, 11/22 Sagittarius, 11/21 Scorpio).
2. 29 Februari kabisat = Pisces, 29 Februari non-kabisat throw.
3. Count agregat beberapa entri, urutan count desc tie alphabetical asc.
4. excludedEmpty untuk tanggal parsial, totalDated tepat.
5. Throw: input bukan array, entri bukan objek, month 0, month 13, day 32, day 30 April, birthDate.date bukan string.
6. Input kosong: items [], totalDated 0, excludedEmpty 0.
7. Label lowercase di output.

## GATES (MIRROR V331 V333)

1. Scope ADD-ONLY tepat 2 berkas baru di src/lib/stats/. Tidak menyentuh berkas lain, lockfile nihil berubah.
2. npm ci; vitest dedikasi lulus penuh; npm run build rc 0; npx tsc --noEmit rc 0; eslint rc 0 pada berkas baru.
3. Em dash 0 di kedua berkas.
4. PURE CORE: nihil kode komersial.
5. Komit granular di cabang existing, push origin tiap komit, komit WIP menit 5 sampai 10.
6. DILARANG merge sendiri ke develop. DILARANG menyentuh main staging.
