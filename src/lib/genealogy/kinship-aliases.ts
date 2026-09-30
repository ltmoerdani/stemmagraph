import type { KinshipKind } from './kinship-calc'

export interface AliasEntry {
  kind: KinshipKind
  depth?: number
  qualifier?: 'cak' | 'jw' | 'mk' | 'sunda' | 'jawa' | 'antr'
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
    eda: {
      kind: 'sibling',
      depth: 1,
      region: 'Karo',
      note: 'eda Karo = dual makna affine: istri saudara laki-laki dan saudara perempuan dari suami, plus jejak kolonial 1861; TIGA SUMBER lintas era: KBBI VI e.da 1 Bt dua makna istri dari saudara laki-laki dan saudara perempuan dari suami (notes/447) plus OCR Kamus Karo 2001 hlm 64 panggilan terhadap istri abang bercontoh kalimat (notes/447) plus van der Tuuk 1861 vol 0 glosa Belanda broeder\'s vrouw, schoonzuster, plus anak perempuan saudari ayah, plus bentuk vokatif eda (notes/475, segmen byte 205000 sampai 249999, HTTP Range first-hand)',
    },
  },
  Toba: {
    butet: {
      kind: 'child',
      depth: 1,
      region: 'Toba',
      note: 'butet Toba = panggilan sayang anak perempuan (bungsu), register netral kelembagaan; DUA SUMBER daring independen: Wikikamus bahasa Indonesia revisi 1166752 (butet = panggilan sayang untuk anak perempuan) plus BatakKeren 23 Januari 2025 (anak perempuan bungsu); penguat Barus 2017 glosarium; referensi notes/2026-09-29-evidence-stg-v192-butet-tongat-rebu',
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
