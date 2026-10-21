# KONTRAK V348-STG-OCCUPATION-INHERITANCE FASE I (2026-10-22, PM Ardi)

Repo: /home/zeroclaw/projects/stemmagraph. Cabang kerja: improve/stg-v348-occupation-inheritance DARI origin/develop 630f963.

## Jangkar (terverifikasi first-hand)
- webtrees Statistic.php getOccupationInheritance() baris 1240 sampai 1243: delegasi OccupationInheritanceRepository::occupationInheritance(), SankeyFlowsPayload parent ke anak (tab Overview, Sankey parent -> child occupation).
- Doc comment jangkar: hanya anak yang ayah ATAU ibunya punya occupation tercatat yang masuk; shown-flow count adaptif kepadatan pohon.
- Feasibility first-hand schema origin/develop: FamilyMember.profession String? (schema baris 121), FamilyRelationship memberId + relatedId + type (baris 156 sampai 170). Modul pure pola v329 parental-age-first-child: eksekutor server yang menyusun record, modul murni transformasi.
- Anti-dup BERSIH: git grep occupation-inheritance / profession nihil di src/lib/stats/, server/index.ts hanya passthrough field, nihil di GOAL_HISTORY dan drafts. top-occupations v333 beda substansi (top-N per individu, bukan flow parent ke anak).

## Deliverable: modul PURE src/lib/stats/occupation-inheritance.ts + test vitest

1. Input: computeOccupationInheritance(records), satu entri PER ANAK:
   { childId: string, childProfession: string | null, fatherProfession: string | null, motherProfession: string | null }
2. Semantik: satu anak menghasilkan SATU flow untuk SETIAP parent yang profession-nya valid non-kosong. Anak tanpa profession valid tetap DIBUANG (mengikuti jangkar: flow butuh dua ujung). Anak tanpa parent berprofesi = tidak berkontribusi.
3. Normalisasi label profesi pola v333: trim, lowercase, collapse whitespace beruntun jadi satu spasi. Profession null, string kosong, atau whitespace saja = tidak valid.
4. childProfession dan parentProfession identik setelah normalisasi TETAP SAH (misal farmer ke farmer): flow like-to-like dihitung, konsisten semantik Sankey.
5. Output:
   - flows: array { from: string, to: string, count: number } dari parent profession ke child profession, urut count DESC lalu tie from ASC lalu to ASC;
   - totalFlows: jumlah count semua flows;
   - childrenWithFlow: jumlah anak unik yang menyumbang minimal satu flow;
   - childrenExcluded: jumlah anak yang dibuang (tanpa profession valid ATAU tanpa parent berprofesi valid).
6. Parser strict ber-index, prefiks 'occupation-inheritance'. WAJIB throw Error ber-index (bukan filter diam): records bukan array; entri bukan objek; childId bukan string; childId string kosong; childProfession tipe salah (bukan string dan bukan null); fatherProfession tipe salah; motherProfession tipe salah.
7. childId duplikat antar entri SAH (dua entri = dua anak berbeda dengan id beda; id sama dianggap entri independen, dihitung keduanya, konsisten v344 v346 v347).
8. Deterministik: akumulasi di Map lalu sort (count DESC, from ASC, to ASC). Nihil randomness, nihil jam sistem, nihil I/O di jalur data.
9. PURE: dilarang import server/, prisma, fetch, fs, path. PURE CORE: nihil kode komersial.

## Test vitest: minimal 15 kasus, wajib mencakup
- Flow dasar father dan mother, count agregat multi-anak.
- Urutan input diacak, output identik.
- Sort count DESC dengan tie from lalu to.
- Anak tanpa profession dibuang (childrenExcluded).
- Anak dengan profession tapi parent nihil profesi dibuang.
- Father saja, mother saja, dua-duanya (dua flow dari satu anak).
- Profession null, string kosong, whitespace saja: tidak valid.
- Normalisasi collapse whitespace dan case-fold.
- Like-to-like (farmer ke farmer) tetap dihitung.
- Input kosong (flows [], totalFlows 0, kedua penghitung 0).
- Lima bentuk throw ber-index (records bukan array, entri bukan objek, childId kosong, childProfession tipe salah, fatherProfession tipe salah).
- childId duplikat dihitung keduanya.

## Gates QA (semua wajib rc 0 / lulus)
- npm ci rc 0.
- vitest dedikasi src/lib/stats/occupation-inheritance.test.ts lulus penuh.
- npm run build rc 0. npx tsc --noEmit rc 0.
- npx eslint kedua file rc 0. Em dash 0 di seluruh berkas.
- Scope TEPAT 3 berkas vs 630f963: kontrak ini + modul + test. Lockfile NIHIL berubah.

## PROSES WAJIB
- Kerjakan di cabang improve/stg-v348-occupation-inheritance (kontrak sudah terkomit sebagai komit pertama).
- Commit granular, push ke cabang yang sama.
- DILARANG merge ke develop/main/staging, DILARANG merge cabang lain. Merge dilakukan PM setelah QA.
- Lapor akhir: repo, file diubah, output gates, nama cabang, tip commit.
