import type { KinshipKind } from './kinship-calc'

export interface AliasEntry {
  kind: KinshipKind
  depth?: number
  qualifier?: 'cak' | 'jw' | 'mk' | 'sunda' | 'jawa' | 'antr' | 'cn'
  note?: string
  region?: string
  register?: 'hormat' | 'netral'
}

/**
 * Alias kekerabatan KBBI edisi III (mirror kbbi.web.id, akses 2026-09-25).
 * Sumber: notes 390 sampai 401. Jangan tambah atau kurangi lema tanpa revisi notes.
 */
export const KINSHIP_ALIASES: Record<string, AliasEntry> = {
  anak: { kind: 'child' },
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
    note: 'padanan tidak langsung, sumber definisi bukan lema',
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
  opa: { kind: 'grandparent', qualifier: 'cak', region: 'Betawi' },
  oma: { kind: 'grandparent', qualifier: 'cak', region: 'Betawi' },
  eyang: { kind: 'grandparent', qualifier: 'jw', region: 'Jawa', register: 'hormat' },
  mbah: { kind: 'grandparent', qualifier: 'jw', region: 'Jawa' },
  embah: { kind: 'grandparent', qualifier: 'jw', region: 'Jawa' },
  engkong: { kind: 'grandparent', qualifier: 'cn', region: 'Tionghoa' },
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
  engkoh: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'cak',
    note: 'Wiktionary ID label cak, TANPA kategori maskulin; sumber definisi eksplisit (notes/427)',
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
  uda: {
    kind: 'sibling',
    depth: 1,
    qualifier: 'sunda',
    note: 'Wiktionary ID: blok sinonim lintas bahasa (notes/427)',
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
  bapa: {
    kind: 'parent',
    depth: 1,
    region: 'Karo',
    note: 'bapa = ayah dalam kekerabatan Karo, cakupan ayah kandung, saudara ayah, laki-laki semarga selevel, dan suami saudara ibu, Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL legenda D, evidence notes/444 dan notes/445',
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
  permen: {
    kind: 'sibling-child',
    depth: 1,
    region: 'Karo',
    note: 'permen = menantu perempuan dalam kekerabatan Karo, istri anak maupun istri anak saudara, Sembiring 1991 The Bible Translator + Pandiangan 2024 JJETL legenda W, evidence notes/444 dan notes/445',
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
      note: 'lae Toba = ipar laki-laki (zwager, brother-in-law), sapaan affine; DUA SUMBER: kamusbatak www /indonesia/lae.html glosa ipar akses 3 Okt 2026 plus Meerwaldt 1904 baris 8029 entri lema Lae zwager (salinan Harvard archive.org, terkonfirmasi first-hand), referensi notes/2026-10-03-evidence-tuuk-vol2-seg5-10-namboru-lae-tulang-ngelingkah.md',
    },
    pariban: {
      kind: 'cousin',
      depth: 1,
      region: 'Toba',
      note: 'pariban Toba = sepupu silang cross-cousin, anak kakak beradik laki perempuan berbeda marga, kawin ideal dicatat adat Toba; TIGA SUMBER: Wati 2017 Syiar Hukum Unisba DOI 10.29313/sh.v15i1.2216 plus Situngkir Putrijanji 2026 JIM DOI 10.38035/jim.v5i1.1942 plus Vergouwen 1964 Springer DOI 10.1007/978-94-015-1035-6, arah matrilateral vs patrilateral tidak dipaksakan di enum, dicatat di komentar per Vergouwen',
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
