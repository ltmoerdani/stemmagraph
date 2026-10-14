import type { KinshipKind } from './kinship-calc'

export interface AliasEntry {
  kind: KinshipKind
  depth?: number
  qualifier?: 'cak' | 'jw' | 'mk' | 'sunda' | 'jawa' | 'antr' | 'cn' | 'minangkabau' | 'hokkien'
  note?: string
  region?: string
  register?: 'hormat' | 'netral'
}

/**
 * Alias kekerabatan KBBI edisi III (mirror kbbi.web.id, akses 2026-09-25).
 * Sumber: notes 390 sampai 401. Jangan tambah atau kurangi lema tanpa revisi notes.
 */
export const KINSHIP_ALIASES: Record<string, AliasEntry> = {
  adinda: {
    kind: 'sibling',
    depth: 1,
    region: 'hor',
    register: 'hormat',
    note: 'adinda Gorontalo hor = sapaan hormat akrab kepada adik (padanan feminin kanda kakanda gugus hor), etimologi adik plus -nda; kind sibling depth 1 pola ayunda kanda, gugus hor non-regresi; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/adinda akses 13 Okt 2026 HTTP 200 (a.din.da n hor sapaan akrab kepada adik, satu lema nihil homograf bernomor, gugus hor) plus Wiktionary ID oldid 1109917 via URL id.wiktionary.org/w/index.php?title=adinda&oldid=1109917 (blok Bahasa Indonesia Nomina: hormat adik mengandung pengertian lebih hormat dan ramah, etimologi adik plus -nda, kategori Turunan kata adik, rujukan R:KBBI Daring, flag rfv impor dari KBBI dicatat jujur pola preseden); GUARD HOMOGRAF ADIKANDA tidak dipetakan: nihil di KBBI VI dan nihil di Wiktionary ID TIDAK jadi key, ejaan ber titik a.din.da TIDAK dipakai sbg key pola budhe se.du.lur man.tu; GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan, nihil blok bahasa lain di oldid sama; referensi kontrak gelombang dua belas dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  anak: { kind: 'child' },
  ananda: {
    kind: 'child',
    note: 'ananda hor = anak, kata sapaan hormat kepada anak orang lain, pola anak (entri anak pembanding langsung, kind child tanpa depth tanpa region); GUARD MAKNA SAPAAN HORMAT: makna sapaan hormat ananda TIDAK dipetakan sbg key lain (bukan sibling, bukan parent, bukan key terpisah), satu makna relasi anak sesuai KBBI an.an.da n hor; anti-dup PM terverifikasi: lemma ananda nihil di map sebelum gelombang ini; referensi kontrak v253xxxvii gelombang 19 dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },
  cucu: { kind: 'grandchild' },
  cicit: { kind: 'descendant', depth: 3 },
  buyut: {
    kind: 'descendant',
    depth: 3,
    note: 'dua arah: naik 3 berarti ancestor pangkat 3, konteks wajib',
  },
  piut: { kind: 'descendant', depth: 4 },
  canggah: {
    kind: 'descendant',
    depth: 4,
    note: 'jangkar resmi KBBI VI: canggah2 = piut, cucu dari cucu',
  },
  anggas: {
    kind: 'descendant',
    depth: 5,
    note: 'jangkar KBBI VI anggas1: generasi keenam atau keturunan kelima; homonim anggas2 karang buatan dan anggas3 tali perut tidak dipakai',
  },
  kakek: { kind: 'grandparent' },
  nenek: { kind: 'grandparent' },
  aki: { kind: 'grandparent', region: 'Sunda' },
  datuk: {
    kind: 'grandparent',
    region: 'Melayu',
    note: 'homonim: makna 2 leluhur saat konteks naik jauh',
  },
  atok: {
    kind: 'grandparent',
    region: 'Melayu',
    note: 'homonim: makna leluhur saat konteks naik jauh',
  },
  atuk: {
    kind: 'grandparent',
    depth: 1,
    qualifier: 'cak',
    region: 'Kupang',
    note: 'KBBI VI a.tuk1 cak kp datuk; homonim a.tuk2 Btk atap daun nipah atau sagu tidak dipetakan; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id/entri/atuk URL entri diakses 12 Okt 2026 plus Wiktionary ID revid 1141273 via api.php (blok ms Kepri kakek, konsisten cak kp); referensi pola andung dan inyik gugus grandparent regional, kontrak drafts/kontrak-v253xviii-stg-atuk-tunggal-2026-10-11.md',
  },
  opa: { kind: 'grandparent', qualifier: 'cak', region: 'Betawi' },
  oma: { kind: 'grandparent', qualifier: 'cak', region: 'Betawi' },
  eyang: { kind: 'grandparent', qualifier: 'jw', region: 'Jawa', register: 'hormat' },
  mbah: { kind: 'grandparent', qualifier: 'jw', region: 'Jawa' },
  embah: { kind: 'grandparent', qualifier: 'jw', region: 'Jawa' },
  simbah: {
    kind: 'grandparent',
    qualifier: 'jw',
    region: 'Jawa',
    note: 'simbah = embah, sapaan kakek nenek; KBBI VI nihil label register sehingga tanpa register (pola jujur); konvergensi makna dengan key embah dan mbah yang sudah live, tetap jadi key sendiri karena lema resmi berbeda (pola makcik paklik); ejaan resmi KBBI ber titik sim.bah TIDAK dipakai sbg key (pola budhe dari bu.de); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/simbah akses 13 Okt 2026 HTTP 200 (sim.bah3 n Jw embah, homograf bernomor tiga lema) plus Wiktionary ID oldid 1238922 via URL id.wiktionary.org/w/index.php?title=simbah&oldid=1238922 akses 13 Okt 2026 (blok Bahasa Indonesia Nomina embah, rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur, revisi SwarabaktiBot 17 Jan 2026); GUARD HOMOGRAF KBBI: sim.bah1 a basah dan sim.bah2 v Mk menyimbah TIDAK dipetakan karena bukan relasi kekerabatan; GUARD TURUNAN Wiktionary (bersimbah menyimbah menyimbahkan tersimbah simbahkan dsb) TIDAK dipetakan, morfen dasar terikat bukan lema relasi; GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan: blok English, Jawa, Malagasy, zh BUKAN blok bahasa Indonesia; referensi kontrak gelombang sebelas dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  engkong: { kind: 'grandparent', qualifier: 'cn', region: 'Tionghoa' },
  akong: {
    kind: 'grandparent',
    qualifier: 'hokkien',
    region: 'Tionghoa',
    note: 'KBBI VI resmi a.kong n Hokkien kakek contoh kondisi akong memang sudah renta (akses 13 Okt 2026); Wiktionary EN oldid 91156570 blok Amis dan Kangean grandfather etimologi Hokkien a-kong konsisten kakek dua jalur, blok Kangean menyatakan paternal dan maternal; sinonim akong di blok Bahasa Indonesia Peranakan Wiktionary ID entri engkong oldid 1459478 saling menguatkan gugus Sinitic; homonim dicatat jujur TIDAK dipetakan: blok Rejang kelenteng dan blok Chungli Ao verba kering, keduanya bahasa lain bukan Indonesia; key engkong Tionghoa cn sudah live sebelumnya dan tetap terpisah; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id/entri/akong plus Wiktionary EN oldid 91156570',
  },
  andung: {
    kind: 'grandparent',
    depth: 1,
    qualifier: 'mk',
    region: 'Melayu/Minangkabau',
    note: 'andung Melayu/Minangkabau = nenek, padanan feminin gugus grandparent regional (inyik ninik), pola inyik; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/andung akses 10 Okt 2026 (an.dung Mk n nenek, SATU lema relasi, verifikasi first-hand Raka HTTP 200) plus Wiktionary ID revid 1299035 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1299035 (bahasa Indonesia nomina nenek; flag rfv impor dari KBBI tercatat jujur; rujukan R:KBBI Daring; revid dicatat sebagai referensi silang); GUARD HOMONIM: andung Bakumpai (bahasa bkr Wiktionary, nama pohon) TIDAK dipetakan, kasus negatif eksplisit di testfile; makna Melayu Deli/Langkat Wiktionary terjemahan nenek masuk note sebagai penguat, BUKAN kind terpisah; register nihil label KBBI sehingga tanpa register; referensi kontrak v253-xii dan Log Supervisi BOARD-stemmagraph 10 Okt 2026',
  },
  inyik: { kind: 'grandparent', qualifier: 'mk', region: 'Melayu/Minangkabau', register: 'hormat' },
  nini: {
    kind: 'grandparent',
    region: 'Jawa Kuno, Banjar, Karo, Sunda',
    note: 'homonim: sapaan perempuan tua tidak dipakai; Jawa Kuno, Banjar, Karo, Sunda: nenek',
  },
  ninik: {
    kind: 'grandparent',
    qualifier: 'mk',
    region: 'Melayu/Minangkabau',
    register: 'hormat',
    note: 'KBBI VI: nenek',
  },
  poyang: { kind: 'ancestor', depth: 4, note: 'makna 2 Mk: orang tua kakek atau nenek' },
  moyang: { kind: 'ancestor', note: 'homonim pangkat: jarak 2 berarti grandparent' },
  pupu: { kind: 'ancestor', note: 'homonim: kata dasar sepupu bukan kind cousin' },
  sepupu: { kind: 'cousin' },
  misan: {
    kind: 'cousin',
    qualifier: 'sunda',
    note: 'makna 2 Jawa: turun satu pangkat',
  },
  'sepupu kedua': {
    kind: 'cousin',
    note: 'label baku nasional sepupu, pasangan alias regional misan (keputusan leksikon PM)',
  },
  keponakan: { kind: 'sibling-child' },
  kemenakan: { kind: 'sibling-child' },
  kemanakan: { kind: 'sibling-child' },
  'nenek moyang': { kind: 'ancestor' },
  'kakek moyang': { kind: 'ancestor' },
  'datuk nenek': { kind: 'ancestor' },
  'datuk poyang': { kind: 'ancestor' },
  leluhur: { kind: 'ancestor' },
  karuhun: { kind: 'ancestor' },
  kumpi: {
    kind: 'ancestor',
    region: 'Jakarta',
    note: 'KBBI VI kum.pi1: moyang laki-laki atau perempuan (gender-netral); DUA JANGKAR: KBBI VI entri kumpi kbbi.kemendikdasmen.go.id/entri/kumpi plus tesaurus resmi Badan Bahasa klaster TUA (berpasangan buyut, notes/527); homonim kum.pi2 karung daun nipah wadah terasi tidak dipetakan; pola moyang: tanpa depth eksplisit',
  },
  onyang: {
    kind: 'ancestor',
    note: 'KBBI VI: ark moyang (arkais); DUA JANGKAR INSTITUSIONAL: KBBI VI entri onyang kbbi.kemendikdasmen.go.id/entri/onyang plus tesaurus resmi Badan Bahasa klaster TUA (notes/526 527); status jujur: nihil sumber akademik independen ketiga (Wiktionary impor KBBI bukan independen, Glosbe 404, OpenAlex nihil konteks Sunda), pola perlakuan inyik',
  },
  indu: { kind: 'ancestor' },
  opo: { kind: 'ancestor' },
  umbu: { kind: 'ancestor' },
  zatua: { kind: 'ancestor' },
  pitarah: { kind: 'ancestor' },
  dansanak: {
    kind: 'sibling',
    note: 'KBBI edisi III daring kbbi.web.id kolom Memuat lema kandung; Mk dan kl bentuk tidak baku pengalih, TODO verbatim belum terverifikasi',
  },
  'dansa-dansi': {
    kind: 'sibling',
    note: 'KBBI edisi III daring kbbi.web.id kolom Memuat lema kandung; Mk dan kl bentuk tidak baku pengalih, TODO verbatim belum terverifikasi',
  },
  'buyut ri': {
    kind: 'ancestor',
    depth: 4,
    region: 'Ri',
    note: 'KBBI VI buyut2 makna 1 Ri: generasi keempat di atas ego, sumber notes/417 akses 2026-09-27',
  },
  'buyut jw': {
    kind: 'ancestor',
    depth: 3,
    region: 'Jw',
    note: 'KBBI VI buyut2 makna 2 Jw: orang tua dari nenek atau kakek, gen 3, sumber notes/417',
  },
  kakang: {
    kind: 'sibling',
    depth: 1,
    region: 'Jawa',
    note: 'KBBI edisi III: kakak; Wiktionary ID etimologi Jawa Kuno kaka-ng, 6 rujukan kamus 1870 sampai 2006 (notes/427)',
  },
  kanda: {
    kind: 'sibling',
    depth: 1,
    region: 'Jawa/Sunda',
    note: 'Wiktionary ID: sinonim dinda, kutipan Wikisource (notes/427)',
  },
  kak: {
    kind: 'sibling',
    depth: 1,
    region: 'kp',
    note: 'kependekan kakak; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/kak akses 13 Okt 2026 (kak1 n sapaan saudara tua; kak kp kakak saudara tua) plus Wiktionary ID (nomina kependekan kakak, rujukan R:KBBI Daring, templat rfv dicatat jujur, status verifikasi komunitas belum final); makna kak1 sapaan serta makna pronomina dan onomatope TIDAK dipetakan; referensi kontrak drafts/kontrak-stg-v253xxiii-kak-2026-10-13.md',
  },
  akak: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'kakak, register cak, TANPA penanda gender; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/akak akses 13 Okt 2026 (a.kak n cak kakak, ejaan ber titik a.kak TIDAK dipakai sbg key, pola budhe dari bu.de) plus Wiktionary ID (blok bahasa Indonesia: a cak kakak, nihil flag rfv); GUARD HOMONIM ANTARBAHASA: blok kjc Karo di halaman Wiktionary sama (akak = akar bagian tumbuhan) TIDAK dipetakan, blok knl Keninjal (kakak perempuan) TIDAK diikuti sbg key feminin karena KBBI nihil penanda gender, konsisten kak v253xxiii; referensi kontrak drafts/kontrak-stg-v253xxiv-akak-2026-10-13.md',
  },
  bang: {
    kind: 'sibling',
    depth: 1,
    note: 'kata sapaan kepada kakak laki-laki; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bang akses 13 Okt 2026 (bang2 n kata sapaan kepada kakak laki-laki; bang kp abang) plus Wiktionary ID (blok bahasa Indonesia: Nomina azan; abang; kakak laki-laki, kutipan 2012, nihil flag rfv); makna azan bang1 dan onomatope bang3 TIDAK dipetakan; referensi kontrak drafts/kontrak-stg-v253xxiv-bang-bung-2026-10-13.md',
  },
  bung: {
    kind: 'sibling',
    depth: 1,
    note: 'kata sapaan akrab kepada seorang laki-laki; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bung akses 13 Okt 2026 (bung1 n kata sapaan akrab kepada seorang laki-laki, padanan abang) plus Wiktionary ID (blok bahasa Indonesia: Nomina abang panggilan akrab, templat rfv dicatat jujur, oldid 1112635); makna onomatope bung2, bu.ng tali picu belantik, dan bung4 Kei TIDAK dipetakan; referensi kontrak drafts/kontrak-stg-v253xxiv-bang-bung-2026-10-13.md',
  },
  kangmas: {
    kind: 'sibling',
    depth: 1,
    region: 'Jawa',
    note: 'Wiktionary ID: sinonim dua arah dengan mas (notes/427)',
  },
  mas: {
    kind: 'sibling',
    depth: 1,
    region: 'Jawa',
    note: 'Wiktionary ID: sinonim feminin mbak di blok sama, homonim sapaan umum (notes/427)',
  },
  kakanda: {
    kind: 'sibling',
    depth: 1,
    region: 'Jawa',
    register: 'hormat',
    note: 'Wiktionary ID: etimologi kakak plus morfem -nda (notes/427)',
  },
  raka: {
    kind: 'sibling',
    depth: 1,
    region: 'Jawa',
    note: 'raka Jawa = kakak laki-laki; makna 1 KBBI kakak laki-laki (Jw) yang dipetakan; ' +
      'DUA SUMBER: KBBI III mirror kbbi.web.id/raka akses 14 Okt 2026 HTTP 200 (ra-ka1 n 1 Jw kakak laki-laki; 2 sebutan kepada mahasiswa senior pada masa perploncoan) plus Wiktionary ID via api.php id.wiktionary.org (blok Bahasa Indonesia nomina kakak laki-laki plus sebutan mahasiswa senior masa perploncoan, blok adj retak homograf, rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur pola preseden); ' +
      'GUARD: makna 2 sebutan mahasiswa senior perploncoan TIDAK jadi key terpisah karena sebutan pergaulan bukan relasi kekerabatan; homograf adj retak TIDAK dipetakan; raka2 dan ejaan ber titik ra-ka TIDAK dibuat sbg key; blok turunan nihil konten tidak dipetakan; referensi kontrak v253xxxv dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },
  engkoh: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'Wiktionary ID label cak, TANPA kategori maskulin; sumber definisi eksplisit (notes/427)',
  },
  etek: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'minangkabau',
    region: 'Minangkabau',
    note: 'etek Minangkabau = adik perempuan ayah atau adik perempuan ibu (bibi), pasangan femenin gugus paman Minangkabau (mamak bako), kind parent-sibling depth 1 pola bako; qualifier minangkabau konsisten pola live bako mamak (koreksi PM atas kontrak v253-x yang menulis mk, dicatat jujur di Log Supervisi 11 Okt); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/etek akses 11 Okt 2026 (e.tek n Mk adik perempuan ayah atau adik perempuan ibu; bibi; makcik; entri tunggal nihil homograf bernomor) plus Wiktionary ID revids 1134648 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1134648 (bagian Minangkabau, definisi identik adik perempuan ayah atau ibu); GUARD SINONIM KBBI (bibi, makcik) TIDAK dipetakan sbg key, hanya glosa; GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan: etek bahasa Simalungun adj kecil, etek bahasa Tao n otak; flag rfv Wiktionary tercatat jujur di note; referensi kontrak v253-x dan Log Supervisi BOARD-stemmagraph 11 Okt 2026',
  },
  pakde: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'pakde Jawa = sapaan kakak laki-laki ibu atau ayah (paman senioritas kakak), akronim bapak gede; DUA SUMBER: KBBI edisi III mirror kbbi.web.id/pakde akses 9 Okt 2026 (pak·de akronim bapak gede, sapaan kepada kakak laki-laki ibu atau ayah; uak) plus Wiktionary ID oldid 1231552 (nomina akr bapak gede, definisi identik, merujuk jangkar resmi KBBI VI kbbi.kemendikdasmen.go.id/entri/pakde); pembeda dari paman umum pada senioritas kakak; sinonim uak TIDAK dipetakan (lema sendiri KBBI VI etimologi Jawa Kuno uwa netral gender, risiko redundansi silang ala AC-44), pakcik tidak berentri KBBI VI; homonim pakde Kankanaey di Wiktionary EN (upacara kurban) TIDAK dipetakan, guard testfile; referensi kontrak v253-ii dan Log Supervisi BOARD-stemmagraph 9 Okt 2026',
  },
  paklik: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'paklik Jawa = sapaan adik laki-laki ibu atau ayah (paman junioritas adik), akronim bapak cilik; kind parent-sibling depth 1 pola pakde, pasangan senioritas kakak-adik dalam gugus paman (paman, mamak, emang, mang, bako); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/paklik akses 11 Okt 2026 (pak.lik n Jw akr DUA makna: (1) bapak cilik; (2) sapaan adik laki-laki ibu atau ayah; paman) plus Wiktionary ID revid 1040734 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1040734 (bagian bahasa Indonesia: akronim bapak cilik, sapaan kepada adik laki-laki ibu atau ayah; paman); GUARD MAKNA: makna 1 KBBI bapak cilik DIPISAHKAN dari makna 2 dan TIDAK dipetakan sbg relasi, yang dipetakan HANYA makna 2 sapaan adik laki-laki ibu atau ayah; Wiktionary menggabungkan kedua makna dalam satu baris, TIDAK diikuti; GUARD HOMONIM: bagian bahasa Jawa di halaman Wiktionary sama (Adik laki-laki bapak, paman) BUKAN blok bahasa Indonesia, TIDAK dipetakan; referensi kontrak v253-xiv dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  pakdhe: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'pakdhe Jawa Tengger = sapaan kakak laki-laki orang tua (paman senioritas kakak), varian ejaan pakde; kind parent-sibling depth 1 pola pakde paklik; DUA SUMBER: Wiktionary ID revid 1286612 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1286612 akses 12 Okt 2026 (blok bahasa Tengger tes, nomina kakak laki-laki orang tua, contoh Pakdhe mau tekan endi) plus KBBI VI kbbi.kemendikdasmen.go.id/entri/pakdhe akses 12 Okt 2026 (ENTRI NIHIL, dicatat jujur, pola jangkar makcik v253-xv dan nyak mbok v253-xvii); mirror KBBI III kbbi.web.id/pakdhe juga nihil; varian pakde tetap lema KBBI terpisah live, tidak difusi, keduanya key eksplisit; homonim nihil; referensi kontrak V253-XX bank lemma pakdhe budhe ponakan dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  budhe: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'budhe Jawa = sapaan kakak perempuan ibu atau ayah (bibi senioritas kakak), akronim ibu gede, varian ejaan bu.de resmi; kind parent-sibling depth 1 pasangan femenin pakde; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bude akses 12 Okt 2026 HTTP 200 (bu.de n Jw DUA makna: (1) ibu gede; kakak perempuan ibu atau ayah; (2) kata sapaan kepada kakak perempuan ibu atau ayah) plus Wiktionary ID revid 1165956 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1165956 (blok bahasa Indonesia: akronim ibu gede; kakak perempuan ibu atau ayah plus panggilan untuk kakak perempuan ibu atau ayah, rujukan R:KBBI Daring, flag rfv impor tercatat jujur pola pakde); key dibuat pada ejaan budhe sesuai kontrak PM, halaman budhe nihil di KBBI VI dan mirror III, ejaan bu.de tetap TIDAK dibuat sbg key (varian ortografik, dibahas note), GUARD MAKNA 2 KBBI sapaan tidak dipetakan terpisah karena kind sama depth sama hanya note saja; GUARD HOMONIM ANTARBAHASA: blok nia Nias di halaman Wiktionary bude (canda, kelakar) TIDAK dipetakan; referensi kontrak V253-XX bank lemma pakdhe budhe ponakan dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  bude: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'bude Jawa = sapaan atau panggilan kepada kakak perempuan ibu atau ayah (bibi senioritas kakak, padanan senior budhe pola pakde paklik); kind parent-sibling depth 1 pola budhe; ejaan resmi KBBI ber titik bu.de TIDAK dipakai sbg key pola budhe dari bu.de; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bude akses 13 Okt 2026 HTTP 200 (bu.de n Jw DUA makna: ibu gede; kakak perempuan ibu atau ayah plus kata sapaan kepada kakak perempuan ibu atau ayah) plus Wiktionary ID revid 1165956 via URL id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1165956 (blok Bahasa Indonesia: akronim ibu gede; kakak perempuan ibu atau ayah plus panggilan untuk kakak perempuan ibu atau ayah, rujukan R:KBBI Daring, flag rfv impor dari KBBI dicatat jujur pola preseden); GUARD MAKNA 1 KBBI ibu gede TIDAK dipetakan sbg relasi terpisah, yang dipetakan makna kakak perempuan ibu atau ayah; GUARD HOMONIM Nias blok nia canda kelakar TIDAK dipetakan; referensi kontrak gelombang tiga belas dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  bulik: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'bulik Jawa = sapaan atau panggilan kepada adik perempuan ibu atau ayah (bibi junioritas adik, padanan feminin paklik), etimologi kependekan ibu cilik; ejaan resmi KBBI ber titik bu.lik TIDAK dipakai sbg key (pola budhe dari bu.de); kind parent-sibling depth 1 pola paklik, pasangan feminin gugus paman Jawa (pakde paklik pakdhe budhe bulik); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bulik akses 13 Okt 2026 HTTP 200 (bu.lik n Jw akr kata sapaan atau panggilan kepada adik perempuan ibu atau ayah; ibu cilik, tunggal nihil homograf bernomor) plus Wiktionary EN revid 91711298 via URL api.php en.wiktionary.org/w/api.php?action=query&prop=revisions&titles=bulik&rvprop=ids|content (blok Javanese: noun aunt, parent\'s younger sister, etimologi shortening of ibu cilik, rujukan R:Horne 1974 hal 98, see also budhe paklik konsisten gugus); GUARD MAKNA: glosa KBBI ibu cilik makna sama etimologis TIDAK dipetakan terpisah; GUARD HOMONIM ANTARBAHASA Wiktionary EN sama TIDAK dipetakan: blok Cebuano (udang prawn Melicertus latisulcatus dan Marsupenaeus japonicus), blok Hungarian (bentukan nomina dari buli pesta), blok Polish (informal hoki es face-off); halaman id.wiktionary.org/wiki/bulik hanya blok Banjar verba pulang revid 1166238 BUKAN blok Indonesia dan BUKAN blok Jawa, TIDAK dipetakan dan dicatat jujur; referensi kontrak drafts/kontrak-stg-v253xxv-bulik-2026-10-13.md dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  ponakan: {
    kind: 'sibling-child',
    qualifier: 'cak',
    note: 'ponakan = kemenakan, label cak; kind sibling-child pola keponakan kemenakan kemanakan tanpa depth; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/ponakan akses 12 Okt 2026 HTTP 200 (po.nak.an n cak kemenakan, tunggal nihil homograf bernomor) plus Wiktionary ID revid 1462863 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1462863 (blok bahasa Indonesia cak kemenakan, rujukan R:KBBI Daring, flag rfv impor tercatat jujur pola pakde); GUARD HOMONIM ANTARBAHASA TIDAK dipetakan: blok bew Bekasi (keponakan, JAWA SERENTAK konvergen makna) dan blok mui-plm Palembang (keponakan, kemenakan) di halaman Wiktionary sama BUKAN blok bahasa Indonesia; blok tes Tengger verba di halaman sama juga bukan blok Indonesia; sinonim resmi kemenakan tetap key tersendiri live tanpa difusi; referensi kontrak V253-XX bank lemma pakdhe budhe ponakan dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  amak: {
    kind: 'parent',
    depth: 1,
    qualifier: 'minangkabau',
    region: 'Minangkabau',
    note: 'amak Minangkabau = ibu, padanan feminin gugus parent Minangkabau (mamak bako etek); qualifier minangkabau konsisten pola live bako mamak etek (koreksi PM atas kontrak v253-xi yang menulis mk); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/amak akses 10 Okt 2026 (a.mak1 n Mk ibu, SATU lema relasi) plus Wiktionary ID revid 1471283 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1471283 (bahasa min panggilan ibu kandung plus wanita sebaya ibu, penguat register sapaan masuk note); GUARD HOMOGRAF KBBI TIDAK dipetakan: a.mak2 n Ach alat perahu bukan relasi kekerabatan; API Wiktionary menolak oldid sitasi sehingga wajib api.php revids; referensi kontrak v253-xi dan Log Supervisi BOARD-stemmagraph 10 Okt 2026',
  },
  nyak: {
    kind: 'parent',
    depth: 1,
    region: 'Jambi',
    note: 'nyak Jambi = ibu, label Jk tercatat di note karena jk nihil di union qualifier (pola makcik register akr); semantik tunggal ibu; ' +
      'DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/nyak akses 12 Okt 2026 HTTP 200 (nyak n Jk ibu, nihil homonim) plus Wiktionary ID revid 1347330 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1347330 (blok bahasa Indonesia nomina emak; ibu, konvergen; rujukan R:KBBI Daring); ' +
      'GUARD HOMOGRAF TIDAK dipetakan: nyak pronomina kge (saya) dan ljp (saya; aku) serta verba osi (terimalah) di halaman Wiktionary sama BUKAN relasi kekerabatan, kasus negatif eksplisit di testfile; referensi kontrak v253-xvii dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  mbok: {
    kind: 'parent',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'mbok Jawa = ibu, semantik utama makna relasi lema mbok1 n Jw; dua makna sapaan lain lema sama (sapaan ragam krama ngoko untuk perempuan; sapaan wanita tua yang kedudukan sosialnya lebih rendah) HANYA note TIDAK dipetakan; ' +
      'DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/mbok akses 12 Okt 2026 HTTP 200 (mbok1 n Jw tiga makna, makna relasi ibu; mbok2 n Bl sapaan) plus Wiktionary ID revid 1220974 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1220974 (blok bahasa Indonesia identik KBBI, konteks Bali pada blok kedua; rujukan R:KBBI Daring; flag rfv impor tercatat jujur); ' +
      'GUARD HOMOGRAF TIDAK dipetakan: mbok2 Bl sapaan perempuan lebih tua di Bali bukan makna relasi ibu, kasus negatif eksplisit; GUARD HOMONIM ANTARBAHASA: blok ban Wiktionary sama (kakak perempuan) TIDAK dipetakan; ragam simbok embok dan sinonim mbok ajeng hanya note; referensi kontrak v253-xvii dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  nyokap: {
    kind: 'parent',
    depth: 1,
    qualifier: 'cak',
    note: 'nyokap = ibu ragam cak prokem Jakarta; TANPA region; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/nyokap akses 12 Okt 2026 HTTP 200 (nyo.kap n cak ibu) plus Wiktionary ID revid 1231051 via URL id.wiktionary.org/w/index.php?title=nyokap&oldid=1231051 (nomina prokem istilah Jakarta untuk ibu, antonim bokap, hipernim bonyok); GUARD turunan kenyokapan TIDAK dipetakan; sinonim ibu bunda TIDAK dibuat key (ibu ayah bapak mama bunda memang sengaja nihil di map, preseden tetap); referensi kontrak V253-XXI gelombang dua dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  bokap: {
    kind: 'parent',
    depth: 1,
    qualifier: 'cak',
    note: 'bokap = ayah ragam cak prokem Jakarta; TANPA region; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bokap akses 12 Okt 2026 HTTP 200 (bo.kap n cak ayah) plus Wiktionary ID revid 1466248 via URL id.wiktionary.org/w/index.php?title=bokap&oldid=1466248 (prokem istilah Jakarta untuk ayah; label kategori adjektiva di Wiktionary adalah keanehan leksikografis, dicatat jujur, tidak mengubah semantik nomina referent orang); GUARD turunan kebokapan TIDAK dipetakan; referensi kontrak V253-XXI gelombang dua dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  makcik: {
    kind: 'parent-sibling',
    depth: 1,
    note: 'makcik Indonesia umum register akr = mak kecil; bibi, kind parent-sibling depth 1 TANPA qualifier TANPA region pola tante pakde; register akr tidak masuk union interface sehingga tercatat di note saja; DUA SUMBER: KBBI III daring mirror kbbi.web.id/makcik akses 12 Okt 2026 (mak.cik n mak kecil; bibi, tunggal nihil homograf bernomor) plus Wiktionary ID revid 1217714 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1217714 (blok bahasa Indonesia nomina mak kecil; bibi, konvergen, templat rfv impor dari KBBI dicatat sbg catatan bukan penghalang pola pakde); JANGKAR KBBI EDISI III dicatat jujur: entri nihil di KBBI VI, jangkar edisi III tercantum di header testfile; GUARD HOMONIM ANTARBAHASA TIDAK dipetakan: blok jax Melayu Jambi di halaman Wiktionary sama (adik perempuan dari bapak, tag rfv) BUKAN blok bahasa Indonesia; key pakcik TETAP tidak dibuat, assertion negatif kontrak pakde tetap utuh; glosa makcik pada entri etek dan bibi Karo adalah GLOS saja tidak diubah; referensi kontrak v253-xv dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  mamak: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'minangkabau',
    region: 'Minangkabau',
    note: 'paman Minangkabau = saudara ibu laki-laki (maternal uncle), padanan paman maskulin Minangkabau; glosa paman, register Mk; kind parent-sibling depth 1 konsisten gugus paman (emang dan mang nihil entri di tip per verifikasi Raka 10 Okt 2026, preseden pakde dan tulang); DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/mamak akses 10 Okt 2026 (verifikasi first-hand PM; percobaan akses server Raka terhalang halaman BatasSehari, dicatat jujur) plus Wiktionary ID revids 1467750 (nomina makna 1 saudara ibu laki-laki; flag rfv impor dari KBBI tercatat jujur; bagian min mengonfirmasi paman atau saudara laki-laki dari ibu); GUARD MAKNA: makna 4 KBBI (n Bt ibu) TIDAK dipetakan karena makna ibu bukan relasi paman, makna 2 (ark, mak tua) dan makna 3 (kl, sapaan raja kepada pegawai kerajaan tua) bukan kekerabatan; homonim bagian bahasa lain Wiktionary (bjn empuk, mqg ibu, pse paman, jax ibu kandung, min paman dan ibu aneuk jamee) TIDAK dipetakan; qualifier minangkabau ditambahkan ke union interface di berkas ini sesuai kontrak, region Minangkabau pola inyik; referensi kontrak v253-vii dan Log Supervisi BOARD-stemmagraph 10 Okt 2026',
  },
  paman: {
    kind: 'parent-sibling',
    depth: 1,
    note: 'paman = saudara laki-laki ayah atau ibu, cakupan netral urutan lahir ikut KBBI VI; disparitas Wiktionary ketat adik laki-laki dicatat di note dan TIDAK diadopsi; sapaan hormat makna 2 tidak dipetakan; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id/entri/paman akses 12 Okt 2026 plus Wiktionary ID revid 1462935',
  },
  bibi: {
    kind: 'parent-sibling',
    depth: 1,
    note: 'bibi = adik atau kakak perempuan ayah atau ibu; homograf resmi KBBI VI bi.bi2 Bg alat pancing, bi.bi3 Bt mangga mentah, bi.bi4 Bt masa padi TIDAK dipetakan; 3 makna sapaan non-kekerabatan tidak dipetakan; DUA SUMBER: KBBI VI akses 12 Okt 2026 plus Wiktionary ID revid 1312636',
  },
  acik: {
    kind: 'sibling',
    depth: 1,
    note: 'acik ark = panggilan untuk perempuan yang lebih tua, seperti kakak perempuan; bibi (ark); kind sibling depth 1 TANPA region pola makcik, KBBI menandai ark umum tanpa label daerah, kata arkais dicatat di note sbg register dan tidak masuk union interface; DUA SUMBER: KBBI III mirror kbbi.web.id/acik akses 14 Okt 2026 HTTP 200 (acik ark n panggilan untuk perempuan yang lebih tua, seperti kakak perempuan; bibi, satu lema nihil homograf ber nomor) plus Wiktionary ID pageid 112664 blok bahasa Indonesia identik (arkais, panggilan untuk perempuan yang lebih tua seperti kakak perempuan; bibi, rujukan R:KBBI Daring, flag rfv impor dari KBBI dicatat jujur pola makcik pakde); GUARD ANTARBAHASA TIDAK dipetakan: blok ljp Lampung (adik perempuan) dan blok ms Rokan Hilir (saudara perempuan dari ayah) di halaman Wiktionary sama BUKAN blok bahasa Indonesia, dua-duanya dijaga testfile dedikasi; GUARD TURUNAN: aci-acikan TIDAK dibuat key; GUARD NON-DIFUSI: makna bibi TIDAK difusi ke key bibi, dua key tetap terpisah pola ponakan-kemenakan; GUARD HOMOGRAF: satu lema nihil homograf ber nomor, tidak ada ejaan bertitik; referensi kontrak drafts/kontrak-stg-v253xxviii-acik-2026-10-14.md dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },
  uda: {
    kind: 'sibling',
    depth: 1,
    note: 'uda = kakak laki-laki; abang (sapaan), key global netral pola makcik paman; kind sibling depth 1 TANPA qualifier TANPA region; menggantikan entri lama v184-i bervalen sunda notes/427 karena riset ulang sumber resmi menunjukkan lema umum tanpa label daerah; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/uda akses 14 Okt 2026 HTTP 200 (u.da2 n Mk kakak laki-laki; abang, homograf bernomor dua lema) plus Wiktionary ID oldid 1309472 via URL id.wiktionary.org/w/index.php?title=uda&oldid=1309472 (blok Bahasa Indonesia nomina: panggilan untuk laki-laki muda, kakak laki-laki; sinonim kakak abang bang dan jv mas, rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur pola makcik pakde); GUARD HOMOGRAF KBBI: u.da1 a ark Jk kp muda (pak uda, mak uda) TIDAK dipetakan karena bukan relasi kekerabatan, komposit pak uda tetap key regional Karo terpisah; GUARD HOMONIM ANTARBAHASA Wiktionary TIDAK dipetakan: blok ljp Lampung, btm Batak Toba, kxd Kelabit, min Minangkabau, bts Simalungun di halaman sama BUKAN blok bahasa Indonesia; GUARD SINONIM: abang bang dan mas TIDAK dipetakan sbg key dari uda, hanya glosa; GUARD RAGAM: udo (ragam dari uda, KBBI VI plus Wiktionary blok id) TIDAK dibuat key, dijaga assertion negatif; GUARD LIHAT: pemuda TIDAK dipetakan; referensi kontrak kontrak-stg-v253xl-uda-2026-10-14 dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },

  uwa: {
    kind: 'parent-sibling',
    depth: 1,
    note: 'uwa = kakak dari ayah atau ibu, netral gender; senioritas kakak hanya di note karena union KinshipKind tidak memiliki kind senioritas (pola pakde); unya kind senioritas (pola pakdhe); etimologi Jawa Kuno tercatat di note pakde, uwa pinjaman Jawa varian wa wak uwak; TANPA qualifier TANPA region key global pola makcik paman; DUA SUMBER: Wiktionary ID revid 1244411 via URL id.wiktionary.org/w/index.php?title=uwa&oldid=1244411 (blok Indonesia nomina dua makna: sapaan kepada kakak dari ayah atau ibu PLUS sapaan kepada orang yang lebih tua yang bukan kerabat; etimologi pinjaman Jawa uwa varian wa wak uwak dari Jawa Kuno) plus Wikisastra jv revid 158484 via jv.wiktionary.org/w/index.php?title=uwa&oldid=158484 (uwa 1 sedulure tuwa bapa utawa biyung = kakak sedulur bapak atau ibu); GUARD KBBI VI kbbi.kemendikdasmen.go.id/entri/uwa akses 12 Okt 2026: DUA lema BUKAN kekerabatan TIDAK dipetakan (u.wa1 n Ri sapaan santun pada teman sebaya; u.wa2 n Mee rumput atau lumut ujung pagar), pola jangkar pakdhe dicatat jujur; GUARD MAKNA 2 Wiktionary (sapaan orang lebih tua bukan kerabat) tidak dipetakan karena bukan relasi kekerabatan; GUARD HOMONIM ANTARBAHASA TIDAK dipetakan: blok bahasa lain di halaman Wiktionary sama (Betawi, Banjar, Hausa, dll) BUKAN blok bahasa Indonesia; varian uak uwak TETAP ditahan nihil, guard existing kinship-aliases-pakde.test.ts baris 45-48 tidak diubah; referensi kontrak V253-XXI gelombang dua dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  wak: {
    kind: 'parent-sibling',
    depth: 1,
    note: 'wak = kakak dari ayah atau ibu (padanan uwak), Jambi dan Banyuwangi; senioritas kakak cukup di note karena union KinshipKind tidak punya kind senioritas (pola uwa pakde); DUA SUMBER: KBBI III mirror kbbi.web.id/wak akses 14 Okt 2026 HTTP 200 (wak1 n kp uwak, kiasan uwak, satu lema nihil homograf ber nomor) plus Wiktionary ID pageid 47385 tiga blok daerah ber-rujukan (jax kakak dari orang tua baik paman maupun bibi dgn turunan wakmuk wakendek wakning waktam waktih rujukan Kamus Bahasa Jambi; mui-plm lebih tua dari orang tua; osi uwak rujukan Ali 2002 Kamus Bahasa Daerah Using-Indonesia Banyuwangi), blok id nihil dicatat jujur pola preseden bako (blok daerah tetap sah bila ber-rujukan terbitan resmi); GUARD POLISEMI: wak2 suara itik dan katak (tiruan bunyi) TIDAK dipetakan karena bukan relasi kekerabatan; GUARD TURUNAN blok jax: wakmuk wakendek wakning waktam waktih TIDAK dipetakan, morfen terikat bukan lema relasi; GUARD VARIAN EJAAN: uwak dan uak TETAP DITAHAN nihil sbg key (uwak lema KBBI sendiri sudah diwakili uwa live, uak tanpa entri resmi), guard existing kinship-aliases-pakde.test.ts tidak berubah arti; GUARD HOMONIM ANTARBAHASA Wiktionary: blok bahasa lain di halaman sama TIDAK dipetakan; referensi kontrak drafts/kontrak-stg-v253xxxix-wak-2026-10-14.md dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },
  om: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'om2 n cak = kakak atau adik laki-laki ayah atau ibu plus sapaan laki-laki agak tua; sapaan tidak dipetakan; homograf om1 p Hindu dan OM n sing orkes melayu plus blok nl dan sv di halaman Wiktionary sama TIDAK dipetakan; DUA SUMBER: KBBI VI akses 12 Okt 2026 plus Wiktionary ID revid 1122680',
  },
  pakcik: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'pakcik akr bapak kecil, sapaan adik laki-laki bapak atau ibu, paman; alias konsolidasi ke makna paman; makna ke-3 Prm pembina pramuka siaga putra TIDAK dipetakan; DUA SUMBER: KBBI VI akses 12 Okt 2026 plus Wiktionary ID revid 1122958',
  },
  bako: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'minangkabau',
    region: 'Minangkabau',
    note: 'bako Minangkabau = keluarga dari pihak ayah (paternal side), paman sisi ayah, pasangan maskulen sisi ayah bagi gugus paman (emang mang pakde mamak tulang), kind parent-sibling depth 1 pola mamak; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/bako akses 11 Okt 2026 (ba.ko1 n Mk keluarga dari pihak ayah) plus Wiktionary ID revids 1345690 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1345690 (bagian bahasa Minangkabau, halaman nihil bagian Bahasa Indonesia, nomina keluarga pihak ayah, kalimat contoh Minang sabalun manikah awak paralu batamu jo bako); GUARD HOMOGRAF KBBI TIDAK dipetakan: ba.ko2 tonggak kayu penyangga panggar, ba.ko3 Ka kulit delima hitam, ba.ko4 Sbw sambal ikan bakar, ba.ko5 Jw tembakau kering, semua bukan relasi kekerabatan; GUARD HOMONIM ANTARBAHASA TIDAK dipetakan: bako bahasa Sunda dan bako bahasa Using sama-sama tembakau; sumber ketiga opsional skripsi UNAND eprint 469753 TIDAK dikutip karena kutipan verbatim gagal diverifikasi saat eksekusi (host etd.unand.ac.id nihil terjawab), dicatat jujur; Wiktionary Minangkabau min.wiktionary entri bako pronomina TIDAK dipakai sbg sumber (jebakan sitasi tercatat kontrak); referensi kontrak v253-ix dan Log Supervisi BOARD-stemmagraph 11 Okt 2026',
  },
  koko: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'Wiktionary ID label cak, ragam kokoh tidak dimasukkan (notes/427)',
  },
  aa: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'sunda',
    register: 'netral',
    note: 'KBBI VI + dua Wiktionary: basa budak (notes/427)',
  },
  aang: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'sunda',
    register: 'netral',
    note: 'Wiktionary ID saja: basa budak (notes/427)',
  },
  kaka: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'sunda',
    note: 'Wiktionary ID: 8 bagian bahasa termasuk su brebes dan Lontara di mak (notes/427)',
  },
  akang: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'sunda',
    register: 'hormat',
    note: 'KBBI VI + EN + ID tiga sumber: aksara Sunda, contoh kalimat, {{Su}} di bagian id (notes/427)',
  },
  kang: {
    kind: 'sibling',
    depth: 1,
    region: 'Tengger',
    note: 'Wiktionary ID: nihil su, jangkar tes Tengger plus audio (notes/427)',
  },
  uni: {
    kind: 'sibling',
    depth: 1,
    region: 'Mk',
    note: 'KBBI VI: kakak perempuan, Mk (Makassar), evidence notes/2026-09-28-evidence-stg-v184ii',
  },
  cici: {
    kind: 'sibling',
    depth: 1,
    region: 'Cn',
    note: 'KBBI VI makna 3 padanan taci (Cn), 4 makna homonim butiran jagung selaput paruh, pencocokan exact-key aman, evidence notes/2026-09-28-evidence-stg-v184ii',
  },
  taci: {
    kind: 'sibling',
    depth: 1,
    region: 'Cn',
    note: 'KBBI VI: kakak perempuan Cn (Cina), bentuk tidak baku ci, evidence notes/2026-09-28-evidence-stg-v184ii',
  },
  tante: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'tante = adik atau kakak perempuan ayah atau ibu (bibi), label cak, fusi dua arah usia dalam SATU lema; kind parent-sibling depth 1 pola etek pakde, alias fusi menerima keduanya sesuai makna 1 KBBI; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/tante akses 11 Okt 2026 (tan.te n cak DUA makna: adik atau kakak perempuan ayah atau ibu; bibi; plus kata sapaan kepada wanita yang agak tua) plus Wiktionary ID revid 1327416 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1327416 (bagian bahasa Indonesia nomina makna tunggal bibi, etimologi dari bahasa Belanda; verifikasi first-hand PM via api.php revids); GUARD MAKNA 2 KBBI: kata sapaan kepada wanita yang agak tua TIDAK dipetakan (bukan relasi kekerabatan), kasus negatif eksplisit testfile; GUARD HOMONIM ANTARBAHASA TIDAK dipetakan: blok bts (saudara perempuan dari ibu, Simalungun) dan blok bbc (saudara perempuan ibu, Toba) di halaman Wiktionary sama BUKAN blok bahasa Indonesia; GUARD GENERALISASI: dilarang mapping tante ke bibi tanpa komponen usia, bibi Karo tetap live sbg key regional terpisah di KINSHIP_ALIASES_REGIONAL Karo, wajib tidak tertukar; glosa makna 1 KBBI memuat sinonim bibi sebagai glosa BUKAN key; referensi kontrak v253-xiii dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  teteh: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'sunda',
    region: 'Sunda',
    note: 'teteh Sunda = panggilan kakak perempuan (sibling senioritas perempuan), pola akak/kangmas sisi femenin; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/teteh akses 11 Okt 2026 (te.teh1 n Sd panggilan kakak perempuan, homograf bernomor) plus Wiktionary ID revids 1455452 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1455452 (bagian Bahasa Indonesia nomina panggilan kakak perempuan; bagian Bahasa Jawa adj dua makna dipakai sbg jangkar guard); GUARD HOMOGRAF KBBI TIDAK dipetakan: te.teh2 a Jw sudah jelas ucapannya bisa mahir, bukan kekerabatan, kasus negatif testfile; GUARD VARIAN: tete (Sasak) tidak dipetakan; referensi kontrak v253-x dan Log Supervisi BOARD-stemmagraph 11 Okt 2026',
  },
  mbak: {
    kind: 'sibling',
    depth: 1,
    note: 'KBBI VI sapaan perempuan lebih tua Jw + perempuan muda umum, guard homonim sapaan umum di test, evidence notes/2026-2026-09-28-evidence-stg-v184ii',
  },
  mbakyu: {
    kind: 'sibling',
    depth: 1,
    region: 'Jw',
    note: 'KBBI VI: mbak, Jw, evidence notes/2026-09-28-evidence-stg-v184ii',
  },
  embak: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'KBBI VI: sapaan kakak perempuan lebih tua, cak (cakapan), evidence notes/2026-09-28-evidence-stg-v184-ii',
  },
  empok: {
    kind: 'sibling',
    depth: 1,
    region: 'Jambi',
    note: 'empok Jambi = kakak perempuan, label Jk tercatat di note karena jk nihil di union qualifier (pola nyak makcik); makna 1 KBBI kakak perempuan yang dipetakan; ' +
      'DUA SUMBER: KBBI III mirror kbbi.web.id/empok akses 13 Okt 2026 HTTP 200 (em-pok Jk n dua makna: 1 kakak perempuan; 2 kata sapaan untuk orang perempuan yang lebih tua; sub-lema em-pok-em-pok n orang perempuan dewasa) plus Wiktionary ID pageid 108772 via URL api.php id.wiktionary.org (blok Bahasa Indonesia nomina kakak perempuan plus sapaan untuk orang perempuan yang lebih tua, rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur pola preseden); ' +
      'GUARD: makna 2 sapaan untuk orang perempuan yang lebih tua TIDAK jadi key terpisah karena sapaan umum bukan relasi kekerabatan; sub-lema majemuk empok-empok TIDAK dipetakan; sinonim Wiktionary (mbak kakak teteh neng uni inang) TIDAK dipetakan sbg key baru; ragam embok (blok ban Wiktionary) dan mpok (blok bew) TIDAK dipetakan sbg key, embok hanya note di testfile klaster-ibu; ejaan ber titik em.pok TIDAK dipakai sbg key pola budhe bu.de; referensi kontrak v253xxxiv dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  ayunda: {
    kind: 'sibling',
    depth: 1,
    region: 'hor',
    register: 'hormat',
    note: 'KBBI VI: sapaan kakak perempuan, hor (Gorontalo), makna 2 kakanda hor juga, satu gugus hor, evidence notes/2026-09-28-evidence-stg-v84ii',
  },
  agi: {
    kind: 'sibling',
    depth: 1,
    region: 'Karo',
    note: 'Wiktionary btx noun younger sibling + Kamus Bahasa Karo-Indonesia 2001 hlm 12/20/180 glosa adik, dua sumber, evidence notes/437',
  },
  turang: {
    kind: 'sibling',
    depth: 1,
    region: 'Karo',
    note: 'Kamus Bahasa Karo-Indonesia 2001 hlm 238 lema saudara dan hlm 245, multi-sense panggilan sayang tercatat hlm 14/35, pencocokan exact-key aman, evidence notes/434 dan 435',
  },
  dik: { kind: 'sibling', depth: 1, note: 'KBBI VI: kependekan adik, kata sapaan saudara teman lebih muda, satu makna nihil homonim, evidence notes/2026-09-28-evidence-stg-klaster-adik-pm' },
  sedulur: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'jw',
    region: 'Jawa',
    note: 'sedulur = saudara atau satu keluarga, biasanya dalam bahasa Jawa; ejaan resmi KBBI ber titik se.du.lur TIDAK dipakai sbg key (pola budhe dari bu.de); homonim sufiks -sedulur-an persaudaraan cukup dicatat di note ini tanpa menjadi key; kind sibling depth 1 pola dansanak, gugus sibling Jawa non-regresi; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/sedulur akses 13 Okt 2026 HTTP 200 (se.du.lur n saudara atau satu keluarga biasanya dalam bahasa Jawa, SATU lema nihil homograf bernomor, jangkar dulur dilema) plus Wiktionary ID oldid 1245233 via URL id.wiktionary.org/w/index.php?title=sedulur&oldid=1245233 akses 13 Okt 2026 (blok Bahasa Jawa Nomina Surabaya saudara, contoh kabeh kui sedulur semuanya bersaudara, kategori WikiTutur Jawa Surabaya, entri jv revid 1245233 SwarabaktiBot pemutakhiran tata letak); GUARD MAKNA: varian sadulur BUKAN entri KBVI nihil arti resmi TIDAK dipetakan (bukti negatif usulan entri), sufiks -sedulur-an TIDAK dipetakan; GUARD HOMONIM ANTARBAHASA Wiktionary EN sama TIDAK dipetakan: blok English (sinonim relative kin), blok jv baku, blok Kurdish, blok Malay BUKAN blok bahasa Indonesia, tidak ada blok bahasa Indonesia di halaman id.wiktionary sama; referensi kontrak gelombang sembilan dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  sembuyak: {
    kind: 'sibling',
    depth: 1,
    region: 'Karo',
    note: 'kelompok kekerabatan Karo: sembuyak segalur keluarga inti satu keturunan merga, relasi antar anggota dipetakan kind sibling, Kamus Bahasa Karo-Indonesia 2001 + Wikipedia Suku Karo, evidence notes/440',
  },
  senina: {
    kind: 'sibling',
    depth: 1,
    region: 'Karo',
    note: 'kelompok kekerabatan Karo: senina semarga lingkup sub merga silima, relasi antar anggota dipetakan kind sibling, Kamus Bahasa Karo-Indonesia 2001 + Wikipedia Rakut Sitelu, evidence notes/440',
  },
  nande: {
    kind: 'sibling',
    depth: 1,
    region: 'Karo',
    note: 'nande = ibu dalam kekerabatan Karo (sembuyak nande = ibu bersaudara kandung), relasi antar anggota kelompok dipetakan kind sibling, Kamus Karo Online + Wikipedia Rakut Sitelu, evidence notes/442',
  },
  ucu: {
    kind: 'sibling',
    depth: 1,
    note: 'ucu = bungsu, alias sibling dgn penanda kelahiran bungsu (posisi termuda di antara bersaudara), pola senioritas etek teteh sisi penanda usia; jangkar KBBI VI berpenanda ark, register ark nihil padanan di union interface sehingga tercatat di note saja (pola makcik register akr); ' +
      'DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/ucu akses 11 Okt 2026 (u.cu n ark bungsu, SATU lema nihil homograf bernomor, verifikasi first-hand Raka HTTP 200) plus Wiktionary ID revid 1297573 via URL api.php id.wiktionary.org/w/api.php?action=query&prop=revisions&revids=1297573 (blok bahasa Indonesia n arkais bungsu definisi konvergen, rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur sbg catatan bukan penghalang pola makcik); ' +
      'GUARD BLOK ms Kepri TIDAK dipetakan: blok ms (kepri) bungsu di halaman Wiktionary sama BUKAN blok bahasa Indonesia, kasus negatif eksplisit di testfile; glosa bungsu TIDAK dipetakan sbg key tunggal (resolveAlias bungsu tetap nihil, frasa bungsu hidup hanya sbg komposit di kinship-age-axis); referensi kontrak v253-xvi dan Log Supervisi BOARD-stemmagraph 12 Okt 2026',
  },
  bapa: {
    kind: 'parent',
    depth: 1,
    region: 'Karo',
    note: 'bapa = ayah dalam kekerabatan Karo, cakupan ayah kandung, saudara ayah, laki-laki semarga selevel, dan suami saudara ibu, Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL legenda D, evidence notes/444 dan notes/445',
  },
  besan: {
    kind: 'property',
    note: 'KBBI VI dua makna: orang tua dari menantu dan hubungan dua orang tua karena anak kawin; homonim be.san2 masakan khas Betawi sayur bersantan tidak dipetakan; bentuk tidak baku bisan cukup dicatat di note ini; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id (akses 9 Okt 2026) plus Wiktionary ID oldid 1312530',
  },
  biras: {
    kind: 'property',
    note: 'biras = pertalian persaudaraan karena kawin dengan dua orang bersaudara (hubungan antara kedua orang yang menikahi dua orang bersaudara, gugus affine besan mertua ipar mantu), pola besan kind property tanpa depth; GUARD MAKNA UMUM: makna umum mertua dan ipar TIDAK dipetakan sbg key lain (bukan parent, bukan sibling, bukan property lain), satu makna persaudaraan sekawin sesuai KBBI bi.ras n; anti-dup PM terverifikasi: lemma biras nihil di map sebelum gelombang ini; referensi kontrak v253xxxvii gelombang 19 dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },
  mama: {
    kind: 'parent-sibling',
    depth: 1,
    region: 'Karo',
    note: 'mama = saudara ibu dalam kekerabatan Karo sekaligus ayah mertua pada pusat kawin preferensial, Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL legenda J, evidence notes/444 dan notes/445',
  },
  mami: {
    kind: 'parent-sibling',
    depth: 1,
    region: 'Karo',
    note: 'mami = istri mama (istri saudara ibu) dalam kekerabatan Karo, Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL legenda O, evidence notes/444 dan notes/445',
  },
  emang: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'sunda',
    note: 'paman Sunda; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/emang akses 10 Okt 2026 (e.mang n Sd paman, tunggal nihil homograf bernomor) plus Wiktionary ID oldid 1322355 (bagian Bahasa Sunda nomina tatakrama, basa budak paman, sinonim amang; bagian Bahasa Indonesia hanya adverbia memang tidak dipakai); kind parent-sibling depth 1 konsisten gugus pakde mamak tulang; nihil homonim kekerabatan lain, guard testfile; referensi kontrak v253-viii dan Log Supervisi BOARD-stemmagraph 11 Okt 2026',
  },
  engku: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'mk',
    region: 'Melayu',
    note: 'engku Melayu = paman; mamak dari pihak ibu, kind parent-sibling depth 1 pola bako mamak; qualifier mk dan region Melayu konsisten pola alias live inyik; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/engku akses 13 Okt 2026 (eng.ku2 n Mk tiga makna: paman; mamak (dari pihak ibu); kata sapaan kepada kakek (datuk); sebutan untuk laki-laki dewasa sebaya tidak dikenal; angku) plus Wiktionary ID pageid 108851 via api.php id.wiktionary.org/w/api.php (blok Bahasa Indonesia nomina paman; mamak (dari pihak ibu), rujukan R:KBBI Daring, flag rfv impor dari KBBI tercatat jujur pola preseden etek bude akak); GUARD POLISEMI KBBI: makna 2 kata sapaan kakek (datuk) TIDAK dipetakan sbg key terpisah, makna 3 laki-laki dewasa sebaya tidak dikenal plus varian angku TIDAK dipetakan (angku nihil di map, jangan turunkan), eng.ku1 sapaan keluarga raja atau orang dihormati TIDAK dipetakan; GUARD HOMONIM: nihil homograf bernomor kekerabatan lain, pasangan eng.ku1 vs eng.ku2 bukan homonim kekerabatan; anti-dup: engkoh sibling cak dan engkong grandparent cn entri lain di berkas sama tanpa disentuh; referensi kontrak v253xxxiii dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  mandeh: {
    kind: 'parent',
    depth: 1,
    qualifier: 'minangkabau',
    region: 'Minangkabau',
    note: 'mandeh Minangkabau = mak; ibu, pola amak (kind parent depth 1 qualifier minangkabau region Minangkabau konsisten amak mamak etek); GUARD VARIAN: mandeh TIDAK menimpa makde, amak, maq deh varian lain, ketiganya entri atau ketiadaan tetap apa adanya, makde nihil di map tetap nihil; anti-dup PM terverifikasi: lemma mandeh nihil di map sebelum gelombang ini; referensi kontrak v253xxxvii gelombang 19 dan Log Supervisi BOARD-stemmagraph 14 Okt 2026',
  },
  mang: {
    kind: 'parent-sibling',
    depth: 1,
    qualifier: 'sunda',
    note: 'paman Sunda kependekan emang; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/mang akses 10 Okt 2026 (makna 1 n Sd kp emang, paman KERABATAN) plus Wiktionary ID oldid 1404703 (bagian Bahasa Indonesia nomina akr emang, paman, rujukan resmi KBBI VI, templat rfv dicatat sbg catatan bukan penghalang pola pakde); GUARD HOMONIM: makna 2 KBBI n Sd kata sapaan kepada laki-laki usianya kurang lebih sebaya paman TIDAK dipetakan (homonim sapaan bukan relasi kekerabatan), ditulis eksplisit di note ini dan dikunci testfile; kata depan mang tidak berentri; referensi kontrak v253-viii dan Log Supervisi BOARD-stemmagraph 11 Okt 2026',
  },
  mantu: {
    kind: 'property',
    note: 'KBBI VI resmi man.tu dua kelas kata: n menantu; v cak mengawinkan anak, mengadakan pesta perkawinan anak; Wiktionary ID revid 1462853 id: n menantu plus v cak mengawinkan anak, etimologi Jawa Kuno mantu rujukan Zoetmulder; GUARD POLISEMI: makna verba cak mengawinkan anak TIDAK dipetakan sbg relasi kekerabatan, hanya nomina; GUARD HOMONIM ANTARBAHASA tidak dipetakan: blok mui-plm menantu, blok bew menantu, blok jv menantu, blok tes istri atau suami dari anak kita; ejaan resmi KBBI ber titik man.tu TIDAK dipakai sbg key pola budhe dari bu.de; bentuk tidak baku minantu tetap dicatat di note entri menantu; alias gugus affine Jawa dari menantu, konsisten semenda mertua besan ipar; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id/entri/mantu akses 13 Okt 2026 plus Wiktionary ID oldid 1462853 (riset-069 first-hand 13 Okt); referensi kontrak v253xxix dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
  menantu: {
    kind: 'property',
    note: 'KBBI VI: istri atau suami dari anak kita; etimologi Jawa Kuno mantu konsisten dengan entri mantu; bentuk tidak baku minantu cukup dicatat di note ini; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id plus Wiktionary ID oldid 1350531',
  },
  mertua: {
    kind: 'property',
    note: 'KBBI VI: orang tua istri atau suami; ragam mentua dicatat di note ini; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id plus Wiktionary ID oldid 1463005',
  },
  ipar: {
    kind: 'property',
    note: 'KBBI VI resmi kemendikdasmen i.par dua makna: saudara suami atau istri serta suami atau istri dari saudara; Wiktionary ID oldid 1463006 blok Indonesia nomina dengan kutipan 1950, templat rfv dicatat jujur di note ini dan tidak mengubah pemetaan; kind property konsisten gugus affine baku besan mertua menantu; key sanak DITOLAK dan tidak dipetakan; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id (akses 13 Okt 2026) plus Wiktionary ID oldid 1463006',
  },
  permen: {
    kind: 'sibling-child',
    depth: 1,
    region: 'Karo',
    note: 'permen = menantu perempuan dalam kekerabatan Karo, istri anak maupun istri anak saudara, Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL legenda W, evidence notes/444 dan notes/445',
  },
  semenda: {
    kind: 'property',
    note: 'KBBI VI se.men.da dua makna keduanya affine: pertalian keluarga karena perkawinan dengan anggota suatu kaum misalnya orang yang kawin dengan saudara atau kemenakan istri atau suami, dan kerabat karena hubungan perkawinan; bentuk tidak baku semanda sumanda cukup dicatat di note ini tanpa menjadi key; Wiktionary ID oldid 1126638 definisi konsisten dengan frasa jika dipandang dari kaum itu, templat rfv dicatat jujur dan tidak mengubah pemetaan; kind property konsisten gugus affine baku besan mertua menantu ipar; nihil homonim kekerabatan lain; DUA SUMBER: KBBI VI kbbi.kemendikdasmen.go.id/entri/semenda (akses 13 Okt 2026) plus Wiktionary ID oldid 1126638',
  },
  yayu: {
    kind: 'sibling',
    depth: 1,
    note: 'yayu = kakak perempuan tanpa label wilayah; makna 1 KBBI kakak perempuan yang dipetakan; etimologi bahasa Jawa dicatat di note tanpa qualifier karena nihil di union qualifier; ' +
      'DUA SUMBER: KBBI III mirror kbbi.web.id/yayu akses 13 Okt 2026 HTTP 200 (ya-yu n dua makna: kakak perempuan; panggilan kepada wanita) plus Wiktionary ID pageid 41392 via URL api.php id.wiktionary.org (blok Bahasa Indonesia nomina kakak perempuan; panggilan kepada wanita, etimologi bahasa Jawa); ' +
      'GUARD: makna 2 panggilan kepada wanita umum TIDAK jadi key terpisah karena sapaan umum bukan relasi kekerabatan; sinonim Wiktionary TIDAK dipetakan sbg key baru; homonim nihil terverifikasi kedua sumber; ejaan ber titik ya.yu TIDAK dipakai sbg key pola budhe bu.de; referensi kontrak v253xxxiv dan Log Supervisi BOARD-stemmagraph 13 Okt 2026',
  },
}

/**
 * Alias kekerabatan regional: map region ke map key ke AliasEntry.
 * Regional TIDAK menambah key map utama KINSHIP_ALIASES sehingga aliasKinds tetap.
 * Karo kaka: dua sumber, Wiktionary ID entri btx dengan audio penutur
 * LL-Q33012 btx HaidirAndiNovianto-kaka.wav plus Kamus Bahasa Karo Indonesia 2001
 * OCR hlm 61 97 105 110, referensi notes/446.
 */
export const KINSHIP_ALIASES_REGIONAL: Record<string, Record<string, AliasEntry>> = {
  Karo: {
    kaka: {
      kind: 'sibling',
      depth: 1,
      region: 'Karo',
      note: 'kaka Karo = kakak; dua sumber: Wiktionary ID entri btx dengan audio penutur LL-Q33012 btx HaidirAndiNovianto-kaka.wav plus Kamus Bahasa Karo Indonesia 2001 OCR hlm 61 97 105 110, referensi notes/446',
    },
    impal: {
      kind: 'cousin',
      region: 'Karo',
      note: 'impal Karo = sepupu silang, anak paman atau anak mama; dua sumber: Kamus Bahasa Karo Indonesia 2001 OCR hlm 82 panggilan anak paman plus Sembiring 1991 Biblical Kinship Terms sepupu silang, referensi notes/447',
    },
    kalimbubu: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'kalimbubu Karo = pihak pemberi perempuan (wife givers) dalam Rakut Sitelu, resiprokal dengan anak beru pihak pengambil perempuan (wife takers), simpul affinal pernikahan tanpa garis darah; kalimbubu pihak pemberi sangat dihormati; varian komposit puang kalimbubu = kalimbubu of the kalimbubu terdokumentasi di note ini tanpa entri key terpisah; LIMA SUMBER: Woollams 1996 A Grammar of Karo Batak Pacific Linguistics C-130 hdl 1885/145878 baris 220-224 (terms kalimbubu dan anak beru reciprocal relationship rendered approximately wife givers and wife takers, koreksi Singarimbun 1975:111 terjemahan misleading) plus Singarimbun 1975 Kinship Descent and Alliance among the Karo Batak UC Press DOI 10.2307/jj.13167910.12 bab Anakberu-Kalimbubu Relations plus Meiliana 2020 LITERA UNY 19(1) DOI 10.21831/ltr.v19i1.30478 baris 181-184 (pihak Kalimbubu pemberi perempuan sangat dihormati) plus Wahyuni 2023 Puteri Hijau Unimed 8(2) DOI 10.24114/ph.v8i2.47936 (struktur kalimbubu anak beru disaksikan senina) plus Simbolika Barus-Sitepu 2023 DOI 10.31289/simbolika.v9i2.10139 (Mehamat Man Kalimbubu); arah reciprocity: kalimbubu adalah pemberi, anak beru adalah pengambil',
    },
    kempu: {
      kind: 'grandchild',
      depth: 1,
      region: 'Karo',
      note: 'kempu Karo = cucu; tiga sumber: Kamus Bahasa Karo Indonesia 2001 OCR hlm 108 glosa cucu dengan contoh kalimat, Wiktionary ID entri btx makna cucu contoh sama, Sembiring 1991 Biblical Kinship Terms cucu, referensi notes/448',
    },
    bibi: {
      kind: 'parent-sibling',
      depth: 1,
      region: 'Karo',
      note: 'bibi Karo = saudara ibu atau saudara ayah (Sembiring 1991 mencakup juga ibu mertua); dua sumber dokumen: Kamus Bahasa Karo Indonesia 2001 OCR hlm 36 entri bercontoh plus Sembiring 1991, wajib namespace terpisah dari homograf Indonesia karena tidak ada di map utama, referensi notes/448',
    },
    nini: {
      kind: 'grandparent',
      depth: 1,
      region: 'Karo',
      note: 'nini Karo = panggilan nenek; EMPAT jangkar: Sembiring 1991 plus OCR Kamus Karo 2001 15 halaman plus KBVI ni.ni plus KamusKaro lema nini; guard homonim topi (sampai 4 makna non-kekerabatan), referensi notes/450',
    },
    'nini ribu': {
      kind: 'grandparent',
      depth: 1,
      region: 'Karo',
      note: 'nini ribu = panggilan nenek submarga Perangin-angin; DUA SUMBER: OCR Kamus Karo 2001 hlm 166 192 plus KamusKaro gloss cocok panggilan nenek, referensi notes/450',
    },
    'nini bulang': {
      kind: 'grandparent',
      depth: 1,
      region: 'Karo',
      note: 'nini bulang = panggilan nenek Perangin-angin dan Karo pinggil; DUA SUMBER: Pandiangan 2024 plus KamusKaro lema bulang (topi, kakek); asimetri tudung terbukti sehingga nini tudung TIDAK menjadi entri, referensi notes/450',
    },
    'bapa tua': {
      kind: 'parent',
      depth: 1,
      region: 'Karo',
      note: 'bapa tua Karo = saudara ayah yang lebih tua; DUA SUMBER literatur: Sembiring 1991 The Bible Translator plus Pandiangan 2024 JJETL; bukti negatif dua katalog online: KamusKaro bapa-tua 404 dan KamusLengkap bapa-tua 404; kandidat terpisah dari pak tua, larangan gabung tanpa sumber ketiga; penguat makna tua dari lema tua Karo (abang yang tertua, KamusKaro); referensi notes/454 dan notes/451',
    },
    'bapa nguda': {
      kind: 'parent',
      depth: 1,
      region: 'Karo',
      note: 'bapa nguda Karo = komposit bapa plus nguda; SATU SUMBER literatur: Sembiring 1991; bukti negatif dua katalog online: KamusKaro bapa-nguda 404 dan KamusLengkap bapa-nguda 404; penguat makna tua dari lema tua Karo (abang yang tertua, KamusKaro); referensi notes/454',
    },
    'pak tua': {
      kind: 'parent',
      depth: 1,
      region: 'Karo',
      note: 'pak tua Karo = konsep mirip bapa tua dengan register berbeda; SATU SUMBER: Pandiangan 2024; larangan gabung dengan bapa tua tanpa sumber penyatu; bukti negatif online: lema pak 404 di KamusKaro dan pak-tua 404 di dua katalog; penguat makna tua dari lema tua Karo (abang yang tertua, KamusKaro); referensi notes/451',
    },
    'pak uda': {
      kind: 'parent',
      depth: 1,
      region: 'Karo',
      note: 'pak uda Karo = komposit pak plus uda; SATU SUMBER: Pandiangan 2024; penguat makna tua dari lema tua Karo (abang yang tertua, KamusKaro); referensi notes/449',
    },
    perkembaren: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'perkembaren Karo = bagian mas kawin yang diserahkan kepada anak beru dari keluarga ayah pengantin perempuan, istilah adat kawin sirembah kulau; lemma polos tidak dipetakan di luar konteks adat kawin; TIGA SUMBER: pemudamergasilima.id artikel 3 Jul 2023 rujukan Buku Mutiara Hijau Budaya Karo 2012 (Perkembaren ialah bagian mas kawin yang diserahkan kepada anak beru dari keluarga ayah pengantin perempuan) plus Taushiah UISU 12(2) 2022 DOI 10.30743/taushiah.v12i2.6370 (Sirembah Kulau dan Perkembaren setara bibi dari ayah atau turang ayah) plus Language Literacy UISU 6(2) 2022 DOI 10.30743/ll.v6i2.5974 Sample 10 (perkembaren a part of dowry given to anak beru); DISPARITAS dicatat jujur: PMS menempatkan perkembaren sebagai bagian mas kawin, Taushiah menempatkannya sebagai istilah kekerabatan (bibi dari ayah atau turang ayah), entri ini mengikuti penempatan PMS bagian mas kawin dengan kind pernikahan pada konteks sirembah kulau',
    },
    sukut: {
      kind: 'sibling',
      depth: 1,
      region: 'Karo',
      note: 'sukut Karo = kutub ketiga rakut sitelu (tuan rumah upacara), relasi antar anggota dipetakan kind sibling; DUA SUMBER jurnal: Lubis 2018 Jurnal Sosiologi Agama UIN Suka DOI 10.14421/jsa.2017.112-06 plus Tarigan 2017 Dewa Ruci ISI Surakarta DOI 10.33153/dewaruci.v12i1.2515; referensi notes/459',
    },
    diberu: {
      kind: 'partner',
      depth: 1,
      region: 'Karo',
      note: 'diberu Karo = perempuan, lazim sebutan suami kepada istri secara kolokial; TIGA SUMBER buku via Open Library Search Inside: Singarimbun 1975 indeks hlm 282 entri 27 silangen W diberu colloquial plus Steedly 2013 Rifle Reports glosarium hlm 426 DIBERU K woman plus Katoppo 1980 Compassionate and Free hlm 102 diberu tukur the bought woman; referensi notes/464',
    },
    turangku: {
      kind: 'partner',
      depth: 1,
      region: 'Karo',
      note: 'turangku Karo = relasi pragmatik rebu avoidance lintas gender ego (WBW, HZH, WMBD, HFZS/SWM), pasangan tidak boleh bicara langsung; EMPAT SUMBER buku via Open Library Search Inside: Singarimbun 1975 hlm 282 entri 21 turangku WBW HZH WMBD HFZS plus Kipp 1993 hlm 326 HZH pragmatik rebu avoidance berlaku lintas gender ego plus Rae Breath Becomes the Wind hlm 324 WBW tidak bicara langsung plus Iwabuchi 1994 hlm 320 WBW WMBD SWM; referensi notes/464 dan notes/2026-09-30-evidence-stg-sepemeren-turangku-searchinside-recovery.md',
    },
    batangna: {
      kind: 'child',
      depth: 1,
      region: 'Karo',
      note: 'batangna Karo = dual makna: literal batang/trunk pohon dan makna khusus bagian utama mas kawin sinonim unjuken; makna literal TIGA SUMBER buku via Open Library Search Inside: Singarimbun 1975 payment also called batangna or unjuken, batangna means trunk plus Neumann 1910 Berita si Mehoeli koran Batak-Karo sabap arah boewahna itandai batangna, jejak korpus Karo tertua plus van der Tuuk 1864 Tobasche spraakkunst batangna makna literal batang harambir; makna khusus bagian utama mas kawin sinonim unjuken SATU SUMBER Singarimbun 1975; referensi notes/468',
    },
    unjuken: {
      kind: 'property',
      depth: 0,
      region: 'Karo',
      note: 'unjuken Karo = aset mas kawin, masuk leksikon kind property, sinonim makna khusus batangna; DUA SUMBER: Singarimbun 1975 Kinship, descent, and alliance among the Karo Batak (judul resmi via OpenLibrary OL1779270W) payment also called batangna or unjuken untuk makna aset mas kawin, plus Joustra 1926 Kamus Karo lema oendjoek bentuk ejaan lama, status nice-to-have belum terverifikasi full-text; depth 0 karena frasa kind property tidak bergantung depth',
    },
    sepemeren: {
      kind: 'cousin',
      depth: 1,
      region: 'Karo',
      note: 'sepemeren Karo = anak perempuan dari kakak perempuan kandung ibu (MZD, anak perempuan dari saudari perempuan ibu), setara sepupu; frasa pemakaian turang sepemeren; DUA SUMBER buku via Open Library Search Inside: Singarimbun 1975 Kinship, descent, and alliance among the Karo Batak label diagram impal sepemeren dua kali di halaman kerabat samping plus kalimat pemakaian 1961 nine were related as turang sepemeren because their mothers were clan sisters plus Iwabuchi 1994 The people of the Alas Valley pemeRen equivalent to sepemeren (rujukan Singarimbun 1975: 202-3) plus tabel lurang sepemeren MZD; referensi notes/466',
    },
    singerana: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'singerana Karo = Anak Beru yang berbicara, juru bicara pihak anak beru (pihak pengambil perempuan) dalam prosesi adat pernikahan Karo, dituntut berkomunikasi dengan bahasa santun (mehamat); peran adat dalam Rakut Sitelu, key anak beru depth 1 tidak berubah, singerana adalah entri peran tersendiri dan bukan pengganti anak beru; TRI-SOURCE: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 439 (yang dominan berbicara pada saat prosesi adat berjalan adalah Anak Beru Singerana, Anak Beru yang berbicara) dan baris 935-937 (Anak Beru Singerana dituntut dapat berkomunikasi dengan bahasa santun mehamat) dan baris 3338 tabel istilah no 76 (Singerana: yang berbicara, juru bicara) plus Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 254 (Anak Beru Singerana: who is appointed/determined/suspended from an Anak Beru Tua) plus Tarigan 2020 NICCT EAI/EUDL DOI 10.4108/eai.20-9-2019.2296621 baris 173 (anakberu singerana of the bride family, arah tindak tutur ngerana, ejaan varian anakberu tanpa spasi dicatat jujur); arah peran: singerana bagian dari pihak anak beru pengambil perempuan, bukan pihak kalimbubu pemberi perempuan',
    },
    eda: {
      kind: 'sibling',
      depth: 1,
      region: 'Karo',
      note: 'eda Karo = dual makna affine: istri saudara laki-laki dan saudara perempuan dari suami, plus jejak kolonial 1861; TIGA SUMBER lintas era: KBBI VI e.da 1 Bt dua makna istri dari saudara laki-laki dan saudara perempuan dari suami (notes/447) plus OCR Kamus Karo 2001 hlm 64 panggilan terhadap istri abang bercontoh kalimat (notes/447) plus van der Tuuk 1861 vol 0 glosa Belanda broeder\'s vrouw, schoonzuster, plus anak perempuan saudari ayah, plus bentuk vokatif eda (notes/475, segmen byte 205000 sampai 249999, HTTP Range first-hand)',
    },
    lemirat: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'lemirat Karo = praktik levirat, janda mati suami jatuh ke saudara lelaki mendiang umumnya yang bungsu, tanpa bayar ulang mas kawin; DUA SUMBER lintas era: van der Tuuk 1861 vol 0 glosa Belanda eene vrouw tot zich nemen door het afsterven van haren man zonder voor haar te betalen, tiga unsur wanita diambil karena suami mati plus tanpa bayar ulang plus dianggap warisan regtens menurut hukum adat, plus bentuk transitif tercatat (notes/475, segmen byte 265000 sampai 309999, HTTP Range first-hand) plus Joustra 1926 monografi adat hlm 32 janda vervalt aan een zijner broeders den jongsten meestal dengan perluasan ke keponakan dan anggota marga lain bila tidak ada serta kewajiban nafkah bila enggan menikah (notes/476, Batakspiegel page 32, snippet kontrol adat)',
    },
    ngalih: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'ngalih Karo = kawin menduda levirate, laki-laki mengawini janda istri saudara laki-laki yang telah meninggal, entri di dalam lema kawin kamuskaro; DUA SUMBER independen: kamuskaro.com lema kawin (ngalih = mengawini janda saudara yang telah meninggal, akses 1 Okt 2026, pola sama dengan ngerbani) plus Singarimbun 1975 Kinship Descent and Alliance among the Karo Batak UC Press DOI 10.2307/jj.13167910 bab Marriage DOI 10.2307/jj.13167910.14 konteks levirate dan pernikahan ulang janda Karo (terverifikasi Crossref 1 Okt 2026), penguat kolonial opsional Joustra 1907 Karo-Bataksch woordenboek DOI Brill 10.1163/9789004599130 terverifikasi Crossref 2 Okt 2026 kandidat glosa menunggu akses fulltext',
    },
    ngerbani: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'ngerbani Karo = kawin ganda dua wanita kakak beradik dikawini satu pria (sororal polygyny), entri muncul di dalam lema kawin kamuskaro; DUA SUMBER independen: kamuskaro.com lema kawin (ngerbani = dua wanita kakak beradik dikawini satu pria, akses 1 Okt 2026) plus Singarimbun 1975 Kinship Descent and Alliance among the Karo Batak UC Press DOI 10.2307/jj.13167910 bab Marriage DOI 10.2307/jj.13167910.14 (sororal polygyny Karo), penguat akademik Murdock 1949 Social Structure h418-428 teorema preferential sororal polygyny plus van den Berghe 1979 Human Family Systems h282 co-wives bersaudara plus Kipp 1990 OL1873773M konteks Karo polygyny era kolonial',
    },
    'anak beru': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'anak beru Karo = pihak pengambil perempuan (penerima perempuan untuk diperistri) dalam Rakut Sitelu, resiprokal dengan kalimbubu pemberi perempuan, simpul affinal pernikahan tanpa garis darah; Anak Beru disebut pula hakim moral; EMPAT SUMBER: Meiliana 2020 LITERA UNY 19(1) DOI 10.21831/ltr.v19i1.30478 CC BY-SA baris 168-171 teks ekstraksi (pihak pengambil perempuan atau penerima perempuan untuk diperistri, hakim moral) plus Wahyuni 2023 Puteri Hijau Unimed 8(2) DOI 10.24114/ph.v8i2.47936 (struktur kalimbubu, anak beru; disaksikan senina, Anak Beru dan Kalimbubu) plus Woollams 1996 A Grammar of Karo Batak Pacific Linguistics C-130 hdl 1885/145878 baris 220-224 (kalimbubu dan anak beru reciprocal, wife givers dan wife takers) plus Singarimbun 1975 Kinship Descent and Alliance among the Karo Batak UC Press DOI 10.2307/jj.13167910 (bab Anakberu-Kalimbubu); arah reciprocity: anak beru adalah pengambil, kalimbubu adalah pemberi',
    },
    'anak beru menteri': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'anak beru menteri Karo = anak beru dari anak beru, komposit anak beru fase ii, berperan sebagai dukungan dan pemberi saran dalam landan (musyawarah adat); tutur siwaluh mencantumkan anak beru menteri terpisah dari anak beru; kind pernikahan depth 1 mengikuti pola komposit anak beru; DUA SUMBER: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 1403 (Anak Beru dari Anak Beru) dan baris 1407-1410 (dukungan dan pemberi saran dalam landan) plus Charismo Habeahan baris 80 (tutur siwaluh meliputi Kalimbubu, Puang Kalimbubu, Puang ni puang, Senina, Sembuyak, anak beru, anak beru menteri, anak beru singukuri); arah posisi: tetap pihak anak beru pengambil perempuan, key anak beru depth 1 tidak berubah',
    },
    'kalimbubu simada dareh': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'kalimbubu simada dareh Karo = kalimbubu pemberi perempuan di jalur ayah yang sekaligus sedarah dengan ego, dareh berarti darah, sebutan hanya dipakai untuk perempuan; kind pernikahan depth 1 mengikuti kalimbubu dasar sebagai simpul affinal pemberi wanita; DUA SUMBER: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 2095-2096 dan 3212-3213 (pemberi wanita terhadap generasi ayah atau pihak clan marga dari ibu kandung ego) plus Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 196 (Kalimbubu Simada Dareh only available for women, Merga dari jalur ayah pihak perempuan, from her father\'s lineage); arah pemberi: pemberi wanita jalur ayah, pihak pengambil tetap anak beru',
    },
    'kalimbubu singalo bere-bere': {
      kind: 'pernikahan',
      depth: 2,
      region: 'Karo',
      note: 'kalimbubu singalo bere-bere Karo = paman pengantin (saudara laki-laki ibu pengantin), kategori kalimbubu dalam upacara adat pernikahan; komposit tiga kata, key kalimbubu depth 1 tidak berubah; TIGA SUMBER: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 882, 1044, 1613 (Kalimbubu singalo bere-bere, paman pengantin) plus Wahyuni 2023 Puteri Hijau Unimed 8(2) DOI 10.24114/ph.v8i2.47936 baris 205 (Kalimbubu Singalo Bere-bere) plus korpus notes/oa/oa1-unimed.txt',
    },
    'kalimbubu singalo perbibin': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'kalimbubu singalo perbibin Karo = kakak perempuan dari ibu pengantin wanita (sister of the bride\'s mother), sisereh pihak kalimbubu; komposit tiga kata, key kalimbubu depth 1 tidak berubah; variasi ejaan perbibin/perbibin sah satu kanonik; EMPAT SUMBER: JAMPARING Rambe et al. 2025 DOI 10.57235/jamparing.v3i1.4771 baris 211 verbatim plus Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 1503 dan 1510 verbatim plus Tarigan 2019 EUDL NICCT DOI 10.4108/eai.20-9-2019.2296621 baris 87-88 verbatim plus penguat Language Literacy UISU 6(2) 2022 DOI 10.30743/ll.v6i2.5974 daftar istilah gantang tumba memuat singalo perbibin (abstrak dan kesimpulan, tanpa glos); arah posisi: pihak kalimbubu pemberi wanita, key depth 1 mengikuti kalimbubu dasar',
    },
    'kalimbubu singalo perkempun': {
      kind: 'pernikahan',
      depth: 2,
      region: 'Karo',
      note: 'kalimbubu singalo perkempun Karo = adik laki-laki dari ibu pengantin wanita, kategori kalimbubu dalam upacara adat pernikahan; komposit tiga kata, key kalimbubu depth 1 tidak berubah; DUA SUMBER: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 883, 1503-1508, 1613 (perkempun, adik dari ibu pengantin wanita) plus Wahyuni 2023 Puteri Hijau Unimed 8(2) DOI 10.24114/ph.v8i2.47936 baris 208 dan 221 (pinggan untuk tegun singalo perkempun)',
    },
    'kalimbubu singalo perninin': {
      kind: 'pernikahan',
      depth: 2,
      region: 'Karo',
      note: 'kalimbubu singalo perninin Karo = kalimbubu penerima pengalon perninin, pengalon keempat dalam urutan pengalon pernikahan Karo yang besarannya setengah dari pengalon perkempun; komposit tiga kata mengikuti pola komposit singalo; EMPAT SUMBER: karokab.blogspot.com Pengalon Pada Perkawinan Adat Suku Karo 10 Agu 2022 verbatim "Yang ke empat adalah Pengalon Perninin. Pengalon perninin ini besarnya setengah dari pengalon perkempun. Yang menerima adalah kalimbubu singalo perninin." URL https://karokab.blogspot.com/2022/08/pengalon-pada-perkawinan-adat-suku-karo.html plus karogaul.com Mengapa Kalimbubu Mendapat Giliran Terakhir Menari/Berbicara Dalam Ritual Karo Des 2023 Juara R Ginting verbatim "Singalo Perkempun (B) adalah ibu dari nomor 2 dan nomor 4. Sementara Singalo Perninin (A) adalah ibu dari nomor 1 dan nomor 3." URL https://www.karogaul.com/2023/12/mengapa-kalimbubu-mendapat-giliran.html plus pemudamergasilima.id Istilah-Istilah Suku Karo Dalam Perkawinan 3 Jul 2023 sumber Buku Mutiara Hijau Budaya Karo 2012 ed. Sarjani Tarigan verbatim "Perninin: ialah bagian mas kawin yang diserahkan kepada serupa dengan nomor 8." URL https://www.pemudamergasilima.id/2023/07/istilah-karo-dalam-perkawinan-anak.html plus Taushiah UISU 12(2) 2022 DOI 10.30743/taushiah.v12i2.6370 dua verbatim "Kalimbubu Singalo Perninin" (daftar golongan adat pihak perempuan, rundian uang hantaran); DISPARITAS PENEMPATAN PIHAK: karokab menempatkan kalimbubu singalo perninin pada kelompok pengantin perempuan, karogaul menyebut Singalo Perninin sebagai ibu (nenek) dari nomor 1 dan 3 yang terbaca pihak ayah, pemudamergasilima ambigu karena hanya mendefinisikan perninin sebagai bagian mas kawin; keputusan PM: kind pernikahan depth 2 mengikuti pola komposit singalo, arah nenek dicatat di note ini tanpa hardcode region',
    },
    'kalimbubu singalo ulu emas': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'kalimbubu singalo ulu emas Karo = kalimbubu pihak mempelai pria, saudara laki-laki ibu si empo, sierkimbang bapa si empo atau simupus si empo per JAMPARING 2025 baris 214, padanan pihak mempelai pria dari singalo bere-bere dan singalo perkempun; ulu emas berarti kepala emas, upeti adat ke paman; kind pernikahan depth 1 karena sierkimbang bapa sejajar ayah bagi mempelai pria; variasi ejaan si ngalo ulu emas pada Ginting dan Tarigan cukup dicatat di note tanpa key terpisah; TIGA SUMBER: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 2123 dan 2145 plus Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 214 plus Tarigan 2019 EUDL NICCT DOI 10.4108/eai.20-9-2019.2296621 baris 81',
    },
    'kalimbubu siperdemui': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Karo',
      note: 'kalimbubu siperdemui Karo = kalimbubu pernikahan dari pihak sukut, sembuyak, dan senina, sebutan paman berdasarkan kekerabatan dari pihak perempuan yang dinikahi; kind pernikahan depth 1 mengikuti kalimbubu dasar sebagai simpul affinal; DUA SUMBER: Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 2098 dan 3213-3214 (siperdemui paman berdasarkan kekerabatan dari pihak perempuan yang dinikahi) plus Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 198-199 (all kalimbubu by marriage of the sukut, sembuyak and senina); DISPARITAS SUMBER: Ginting menyamakan Si Er Pedemui dengan si Erkimbang sedangkan JAMPARING memisahkan Sierkimbang (istri) dan Siperdemui; entri erkimbang terpisah sengaja tidak dibuat mengikuti sumber yang memisahkan',
    },
    'puang kalimbubu': {
      kind: 'pernikahan',
      depth: 2,
      region: 'Karo',
      note: 'puang kalimbubu Karo = kalimbubu dari kalimbubu, lapis kedua pemberi perempuan dalam Rakut Sitelu; v226-i membalik keputusan v222-i yang hanya mendokumentasikan varian ini di note kalimbubu; TIGA SUMBER: Woollams 1996 A Grammar of Karo Batak Pacific Linguistics C-130 hdl 1885/145878 baris 11015-11016 (the puang kalimbubu are the kalimbubu of the kalimbubu, our mother\'s maternal uncles) plus Ginting 2017 OSF Preprints DOI 10.31227/osf.io/mz6kh_v1 baris 801, 1428, 1491 (mberkat sinuan mengawini putri puang kalimbubu) plus Wahyuni 2023 Puteri Hijau Unimed 8(2) DOI 10.24114/ph.v8i2.47936 baris 207-208, 213 (tegun puang kalimbubu)',
    },
    'puang ni puang': {
      kind: 'pernikahan',
      depth: 2,
      region: 'Karo',
      note: 'puang ni puang Karo = kalimbubu dari puang kalimbubu, tier ketiga pemberi perempuan dalam tutur siwaluh setelah kalimbubu dan puang kalimbubu; kind pernikahan depth 2 konsisten pola puang kalimbubu depth 2; TIGA SUMBER: Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 188 (Kalimbubu of Puang Kalimbubu) dan baris 184 (tiers Kalimbubu, Puang Kalimbubu, Puang Ni Puang) plus Charismo Habeahan baris 78-80 (tutur siwaluh: Kalimbubu, Puang Kalimbubu, Puang ni puang, Senina, Sembuyak, anak beru, anak beru menteri, anak beru singukuri) plus Tarigan 2020 EUDL DOI 10.4108/eai.20-9-2019.2296621 baris 80-88 (puang ni puang means the kalimbubu of puang kalimbubu of groom\'s family)',
    },
    'mehamat man kalimbubu': {
      kind: 'pernikahan',
      depth: 2,
      region: 'Karo',
      note: 'mehamat man kalimbubu Karo = sikap hormat kepada kalimbubu, formula komposit tiga kata dalam adat Rakut Sitelu; kalimbubu adalah pemberi perempuan, sangat dihormati sebagai pembawa berkat dan disebut Dibata Ni Idah (Tuhan yang terlihat); komposit ini tidak mengubah key kalimbubu depth 1, dan komponen formula lain (metenget ersenina, metami man anak beru) tidak didaftarkan di entri ini; DUA SUMBER UTAMA: Rambe et al. 2025 JAMPARING 3(1) DOI 10.57235/jamparing.v3i1.4771 baris 343-350 (mehamat man kalimbubu means respect for the kalimbubu, pemberi perempuan, pembawa berkat, Dibata Ni Idah) plus Barus dan Sitepu 2023 SIMBOLIKA 9(2) hlm 80-90 DOI 10.31289/simbolika.v9i2.10139 (gaya komunikasi mehamat man kalimbubu umumnya nonverbal memakai benda bermakna; status jujur: full text diblokir Cloudflare 403 di ojs.uma.ac.id, sitasi berbasis abstrak terverifikasi Crossref); PENGUAT: Pane 2025 JERUMI 3(1) DOI 10.57235/jerumi.v3i1.6375 baris 70-74 (kalimbubu pemberi dara sangat dihormati disebut dibata ni idah, anak beru penerima dara)',
    },
  },
  Toba: {
    amangboru: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Toba',
      note: 'amangboru Toba = suami dari saudara perempuan ayah (father sister husband, FBH), simpul affinal satu pernikahan: ego terhubung lewat ikatan kawin saudari ayah, tanpa garis darah; sumber: van der Tuuk 1861 Bataksch-Nederduitsch woordenboek vol 2 h631 plus Bruner 1974 Indonesian Homecoming h38 plus Iwabuchi 1994 h320 plus Bibliografi 1974 h506 plus Museum Barbier-Muller 2002 h382 plus Nainggolan 2014 GSTF Journal on Education DOI 10.7603/s40742-014-0003-9 plus detikcom 14 Jun 2023',
    },
    butet: {
      kind: 'child',
      depth: 1,
      region: 'Toba',
      note: 'butet Toba = panggilan sayang anak perempuan (bungsu), register netral kelembagaan; DUA SUMBER daring independen: Wikikamus bahasa Indonesia revisi 1166752 (butet = panggilan sayang untuk anak perempuan) plus BatakKeren 23 Januari 2025 (anak perempuan bungsu); penguat Barus 2017 glosarium; referensi notes/2026-09-29-evidence-stg-v192-butet-tongat-rebu',
    },
    namboru: {
      kind: 'parent-sibling',
      depth: 1,
      region: 'Toba',
      note: 'namboru Toba = saudara perempuan ayah (father sister, FZ), sapaan hormat; EMPAT SUMBER: kamusbatak www /indonesia/namboru.html glosa saudari ayah plus contoh kalimat native akses 3 Okt 2026 plus van der Tuuk 1861 vol 2 baris 43749 glosa vader zuster plus Tuuk vol 1 salinan Michigan baris 43993 glosa sama plus Meerwaldt 1904 baris 8343 entri lema Namboru tante zuster van iemands vader, referensi notes/2026-10-03-evidence-tuuk-vol2-seg5-10-namboru-lae-tulang-ngelingkah.md',
    },
    lae: {
      kind: 'sibling',
      depth: 1,
      region: 'Toba',
      note: 'Dual-source makna inti: KBBI VI makna 1 (suami dari saudara perempuan, saudara laki-laki istri, konteks Batak) sejalan Wiktionary EN Toba Batak brother-in-law (wife\'s brother or sister\'s husband) yang mengutip Warneck 1906 hal. 108. Wiktionary EN oldid 92350735 menambah pembatas register: lae juga sapaan untuk laki-laki dari klan lain dipakai penutur laki-laki (used by male speakers), konsisten dengan status sapaan affine entri ini tanpa mengubah kind maupun enum. Susunan sumber: kamusbatak (glosa ipar) sumber 1, Wiktionary EN oldid 92350735 sumber 2 tersier per 8 Okt 2026, Meerwaldt 1904 entri Lae zwager (IA batakschetaal00jhme leaf 176, akses 9 Okt 2026) sumber 3, primer Warneck p. 108 [tidak terverifikasi langsung, resolver KB Den Haag gagal diakses].',
    },
    pariban: {
      kind: 'cousin',
      depth: 1,
      region: 'Toba',
      note: 'pariban Toba = sepupu silang cross-cousin, anak kakak beradik laki perempuan berbeda marga, kawin ideal dicatat adat Toba; TIGA SUMBER: Wati 2017 Syiar Hukum Unisba DOI 10.29313/sh.v15i1.2216 plus Situngkir Putrijanji 2026 JIM DOI 10.38035/jim.v5i1.1942 plus Vergouwen 1964 Springer DOI 10.1007/978-94-015-1035-6, arah matrilateral vs patrilateral tidak dipaksakan di enum, dicatat di komentar per Vergouwen',
    },
    parumaen: {
      kind: 'property',
      depth: 1,
      region: 'Toba',
      note: 'parumaen Toba = menantu perempuan, istri dari anak laki-laki sendiri, resiprokal kategori pemberian istri Dalihan Na Tolu: pihak pemberi istri hula-hula berhadapan dengan pihak penerima istri boru, menantu perempuan posisinya di sisi anak boru; kind property depth 1; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/parumaen (pa.ru.ma.en n Bt menantu perempuan, akses 10 Okt 2026) plus Wikipedia ID Partuturan Toba oldid 28958723 lembar partuturan; non-regresi hula-hula pemberi gadis dan boru penerima istri tetap utuh',
    },
    pahompu: {
      kind: 'grandchild',
      depth: 2,
      region: 'Toba',
      note: 'pahompu Toba = cucu (grandchild), panggilan untuk anak dari anak laki-laki maupun perempuan, gender netral; kind grandchild depth 2 mengikuti preseden relasi dua generasi dua arah seperti ompung suhut grandparent depth 2; DUA SUMBER: bahasabataktoba.com entri pahompu glosa cucu (akses 3 Okt 2026) plus Wikikamus bahasa Indonesia lema pahompu Nomina panggilan untuk cucu oldid 1327552 contoh boan pahompu i tu huta dah; penguat Pasaribu dkk 2025 Jurnal Tambusai 9(1) frasa paebathon pahompu; van der Tuuk 1861 nihil lema pahompu dan KBBI nihil dicatat jujur; arah semantik dijaga test negatif: bukan anak langsung (butet child) dan bukan kakek nenek (ompung suhut grandparent)',
    },
    haha: {
      kind: 'sibling',
      depth: 1,
      region: 'Toba',
      note: 'haha Toba = kakak laki-laki (elder brother), sapaan sibling; DUA SUMBER: Stap 1912 Nederlandsch-Tobasche woordenlijst (aps8659.0001.001 umich.edu) glosa oudere broeder haha plus Vergouwen 1964 (socialorganisati0000verg) cross-sibling elder dahahang dan anggi the younger; homonim haha tawa (Indonesia) dijaga test negatif; non-regresi anggi Simalungun',
    },
    'hula-hula': {
      kind: 'pernikahan',
      depth: 1,
      region: 'Toba',
      note: 'hula-hula Toba = kelompok kekerabatan pemberi gadis (wife-givers) dalam perkawinan adat Batak, pasangan kategori boru sebagai pihak penerima istri dalam sistem Dalihan Na Tolu; kind pernikahan depth 1 mengikuti boru (kategori relasi affinal pemberian istri); TIGA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/hula-hula (hula-hula1 n Bt kelompok kekerabatan pemberi gadis dalam perkawinan adat Batak, akses 9 Okt 2026) plus Wikipedia ID Pernikahan adat Batak Toba oldid 29331041 peran ritus hula-hula sebagai pihak pemberi istri plus Wikipedia ID Dalihan Na Tolu oldid 28663463 somba marhulahula kelompok pemberi istri sumber hagabeon; penguat akademik Vergouwen 1964 DOI 10.1007/978-94-015-1035-6; homonim hula-hula2 tarian Hawaii (domain total berbeda) dicatat dan TIDAK dipetakan; kanon bentuk terhubung tanpa titik sesuai KBBI, varian hulahula tanpa strip tidak dijadikan key; non-regresi boru kind pernikahan tetap utuh',
    },
    tulang: {
      kind: 'parent-sibling',
      depth: 1,
      region: 'Toba',
      note: 'tulang Toba = saudara laki-laki ibu (maternal uncle, MB), sapaan hormat kepada paman dari pihak ibu; DUA SUMBER: Wiktionary lema tulang bagian Toba Batak glosa maternal uncle plus KBBI VI lema tulang2 Bt saudara laki-laki dari ibu; cakupan makna MB saja, sense mertua ditahan karena single-source dan belum dimasukkan; homonim anatomi holi (tulang = bone) dicatat dan tidak dipetakan; referensi notes/2026-10-03-evidence-tuuk-vol2-seg5-10-namboru-lae-tulang-ngelingkah.md',
    },
    boru: {
      kind: 'pernikahan',
      depth: 1,
      region: 'Toba',
      note: 'boru Toba = anak boru, kelompok penerima istri (wife-takers) dalam sistem Dalihan Na Tolu, kategori relasi affinal pemberian istri dari hula-hula ke pihak boru; cakupan makna: kategori relasi pemberian istri, glosa Tuuk dochter (putri) dan schoonzuster (ipar perempuan) dicatat di note ini tanpa dipetakan ke enum terpisah; TIGA SUMBER eksternal: Vergouwen 1964 The Social Organisation and Customary Law of the Toba-Batak of Northern Sumatra (anak boru, boru parsadaan, boru sihabolonan, boru gomgoman) plus Bruner 1974 (boru group pria dan wanita, in-marrying boru families) plus Barbier-Mueller 2011 (nama Boru X pada genealogi perempuan); plus rujukan kamus van der Tuuk 1861 vol 2 glosa dochter bruid schoonzuster namora dan notes/504 notes/505',
    },
    'ompung suhut': {
      kind: 'grandparent',
      depth: 2,
      region: 'Toba',
      note: 'ompung suhut Toba = kakek nenek dari sisi ayah (grandparent paternal), komposit ompung plus suhut; TIGA JANGKAR independen: kamusbatak.org entri Ompung suhut kakek dari ayah kamus Toba modern (akses 1 Okt 2026) plus Purbawidya 2019 BRIN ISSN 2252-3758 DOI 10.24164/pw.v8i2.309 suhut komponen bersama dalihan na tolu Angkola-Mandailing plus Asketik 2024 IAIN Kediri ISSN 2579-7050 DOI 10.30762/asketik.v8i1.1433 frasa literal sitolu Suhut Sitolu Harajaon konteks dalihan na tolu Toba, penguat kolonial tertua van der Tuuk 1861 vol 0 hlm 438 dan 455 dua titik (suhut tuan rumah penyelenggara pesta, notes/479), referensi notes/479',
    },
    opung: {
      kind: 'grandparent',
      region: 'Toba',
      note: 'opung Toba = kakek; DUA SUMBER: KBBI VI resmi kbbi.kemendikdasmen.go.id/entri/opung akses 9 Okt 2026 (o.pung n Bt kakek, satu lema nihil homograf bernomor) plus Wiktionary ID lema Ompung oldid 1133439 (kakek nenek, orang yang dituakan); disparitas ejaan ompung (dobel m) vs kanon opung mengikuti KBBI keputusan PM; komposit ompung suhut depth 2 entri terpisah JANGAN disentuh; register nihil label KBBI, depth implisit satu generasi pola kakek; referensi kontrak v253-iii dan Log Supervisi BOARD-stemmagraph 9 Okt 2026',
    },
    iboto: {
      kind: 'sibling',
      depth: 1,
      region: 'Toba',
      note: 'iboto Toba = saudara lawan jenis cross-sibling, kakak atau adik beda gender dalam pasangan laki perempuan, sapaan vokatif umum; ENAM SUMBER: Wiktionary EN lema iboto bagian Toba Batak glosa sister of a man oldid 91176215 plus kamusbatak www entri iboto 12 makna cross-sibling akses 2 Okt 2026 plus Meerwaldt 1904 h58 glosa saudara lawan jenis plus bentuk klitik ito itong plus Vergouwen 1964 glosa cross-sibling mutually iboto plus Holle lists vol 9 ANU 1986 daftar kins Samosir plus Dammerboer 1879 Alkitab Angkola korpus native Markus 10, referensi notes/500 dan notes/501',
    },
    'dongan sa-': {
      kind: 'sibling',
      depth: 1,
      region: 'Toba',
      register: 'netral',
      note: 'dongan sa- Toba = kolektif kawan se-perut, se-pusar, se-kandungan (buikgenoot), bloedverwant saudara serumah kandungan, prefiks sa- berarti satu; kind sibling depth 1 register netral; TIGA SUMBER: Stap 1912 Nederlandsch-Tobasche woordenlijst hlm 85 dua entri (Bloedverwant: dongan sapoesok saboetoeha saboltok; marga: dongan samarga saboltok sapoesok saboetoeha, tondong untuk marga beda) plus Holle lists vol 9 ANU 1986 hlm 354 butir 53-62 (poesok pusar, boetoeha perut, tali pusar) plus Tuuk 1897 Kawi-Balineesch-Nederlandsch hlm 853 glosa buikgenoot pembanding Batak; homonim guard: dongan polos tetap null (terkunci negatif di test boru) dan bukan istilah pertemanan umum; tondong belum entri; referensi notes/517 dan notes/518',
    },
  },
  Simalungun: {
    anggi: {
      kind: 'sibling',
      depth: 1,
      region: 'Simalungun',
      note: 'anggi Simalungun = adik kandung gender-netral (little brother or sister), sapaan antar saudara beda lahir, layer bahasa Simalungun terpisah eksplisit dari observasi internal Toba; DUA SUMBER: Wiktionary EN lema anggi bagian Simalungun Batak glosa little brother or sister oldid 84794146 plus Kamus Bahasa Simalungun-Indonesia 2015 hlm 1 Balai Bahasa Sumatra Utara, referensi reports/draft-goal-v216i-stg-anggi-2026-10-03',
    },
    abang: {
      kind: 'sibling',
      depth: 1,
      region: 'Simalungun',
      note: 'abang Simalungun = kakak laki-laki (elder brother), register sapaan hormat; SINGLE ANCHOR terverifikasi: Kamus Bahasa Simalungun-Indonesia 2015 Balai Bahasa Sumut hlm 1 entri abang [abaG] n abang marabang v berabang memanggil abang (ekstraksi PM dari PDF archive, tmp_kamus_hlm1.txt); Wiktionary EN section Simalungun Batak TIDAK dihitung sumber kedua karena mengutip kamus 2015 yang sama (Reference Zufri Hidayat et al. 2015, verifikasi API W1703); homonim KBBI: abang2 Jawa, abang3 Lay, abang5 Ldy (guard di test)',
    },
  },
  Langkat: {
    nondong: {
      kind: 'grandparent',
      depth: 1,
      region: 'Langkat',
      note: 'nondong Langkat = kakek (grandparent), istilah leksikon kekerabatan Langkat Malay; DUA SUMBER eksternal dual-anchor diikat region langkat sesuai keputusan W061x (sumber berformat <source>:<nama>, bahasa mengikuti anchor pertama); kontrol negatif resmi: KBBI nihil lema nondong (verifikasi Sena 8 Okt 2026 09:4x, kbbi resmi jalur kemendikdasmen), homograf langkat lain tidak ikut terindeks sbg alias (dikunci kasus negatif di testfile); non-duplikat terverifikasi grep rc nihil di kinship-aliases dan leksikon-bank (PM first-hand 8 Okt 2026); referensi draft Sena draft-stg-v252ix dan Log Supervisi BOARD-stemmagraph 8 Okt 2026',
    },
    bulang: {
      kind: 'grandparent',
      depth: 1,
      region: 'Karo-Langkat',
      note: 'bulang Karo-Langkat = panggilan kakek (grandfather), istilah suku Karo di Langkat dan sekitarnya; DUA SUMBER: Wikipedia ID Orat Tutur oldid 27551096 (Bulang, Laki, Bayak, Bolang: panggilan kepada kakek; halaman sama menegaskan Nondong = panggilan nenek Langkat) plus Woollams 1996 baris 319 (grandfather eastern nini bularJ, lowlands western in Langkat bolarJ, satu lema ortografi bularJ bolarJ bulang bolang, bolang cukup dicatat sbg ortografi sama tidak jadi key); homonim KBBI bulang1 domain lain TERVERIFIKASI (kain dililit kepala, perhiasan emas pengantin, tali pengikat taji ayam sabung, kbbi.web.id 200 OK, sidebar homograf bulang2) dan korpus Karo akademik Woollams baris 4892 to wear a bulang headdress, makna headgear atau taji TIDAK dipetakan ke set kekerabatan (guard homonim di testfile pola om1 om2 dan uak1 uak2); saringan internal: key standalone bulang nihil di kinship-aliases sebelum entri, komposit live nini bulang JANGAN disentuh; varian laki dan bayak DITAHAN risiko homonim umum nihil kontrol; referensi kontrak v252-x dan Log Supervisi BOARD-stemmagraph 8 Okt 2026',
    },
  },
}

/** Normalisasi frasa: trim, lowercase, buang titik tengah, rapat spasi ganda. */
function normalize(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/\u00B7/g, '')
    .replace(/\s+/g, ' ')
}

export function resolveAlias(phrase: string, region?: string): AliasEntry | null {
  const key = normalize(phrase)
  if (region !== undefined) {
    const regional = KINSHIP_ALIASES_REGIONAL[region]
    const regionalEntry = regional === undefined ? undefined : regional[key]
    if (regionalEntry !== undefined) {
      return regionalEntry
    }
  }
  const entry = KINSHIP_ALIASES[key]
  return entry === undefined ? null : entry
}

export function aliasKinds(): string[] {
  return Object.keys(KINSHIP_ALIASES).sort()
}
