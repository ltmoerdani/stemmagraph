/**
 * Bank leksikon: pencatatan lema yang belum tercatat di kamus baku,
 * lengkap dengan jangkar kutipan sumber.
 *
 * Pure function: tanpa react, zustand, prisma, atau server.
 *
 * Catatan sumber: teks sumber primer (Tuuk, Junghuhn, notes 551) tidak ada
 * di repo. Pada data awal, hanya "den stam van een' boom" yang tertulis
 * verbatim di kontrak v243i. Kutipan Junghuhn dan notes 551 adalah ringkasan
 * dari kontrak dan perlu diganti kutipan asli saat teks sumber tersedia.
 */

export interface LeksikonSource {
  /** Karya rujukan, misalnya nama pengarang dan tahun. */
  karya: string;
  /** Lokasi di karya: volume, byte, halaman, atau nomor catatan. */
  lokasi: string;
  /** Kutipan dari karya. */
  kutipan: string;
}

export interface LeksikonEntry {
  lemma: string;
  makna?: string;
  alias?: string[];
  dictionaryRecorded: boolean;
  sources: LeksikonSource[];
  /** Catatan marga atau submarga terkait lema tutur. */
  margaNote?: string;
}

export type AddEntryResult =
  | { ok: true; entry: LeksikonEntry; merged: boolean }
  | { ok: false; error: 'duplicate-lemma'; lemma: string };

/** Trim, lowercase, rapatkan spasi ganda. */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

function namesOf(entry: LeksikonEntry): string[] {
  return [entry.lemma, ...(entry.alias ?? [])].map(normalizeQuery);
}

function cloneEntry(entry: LeksikonEntry): LeksikonEntry {
  return {
    ...entry,
    alias: entry.alias ? [...entry.alias] : undefined,
    sources: entry.sources.map((s) => ({ ...s })),
  };
}

const SEED: LeksikonEntry[] = [
  {
    lemma: 'Batang',
    makna: 'Istilah botanik untuk batang, dipakai juga bagi cabang sungai.',
    dictionaryRecorded: false,
    sources: [
      {
        karya: 'Tuuk, vol 2',
        lokasi: 'byte 445197, hlm sekitar 113',
        kutipan: "den stam van een' boom",
      },
      {
        karya: 'Junghuhn 1847, vol 2',
        lokasi: 'byte 435544',
        kutipan: 'penamaan Batang oleh Batak dibedakan dari Hauptzufluss',
      },
    ],
  },
  {
    lemma: 'Kali Lumut',
    alias: ['Eik Simawangon'],
    dictionaryRecorded: false,
    sources: [
      {
        karya: 'notes 551',
        lokasi: 'footnote Dolok-Eik, hlm 95-96',
        kutipan: 'Dolok-Eik',
      },
    ],
  },
  {
    lemma: 'bengkila',
    makna: 'paman; suami dari saudara bapak (afinal ayah-berbagi).',
    dictionaryRecorded: false,
    sources: [
      {
        karya: 'KamusLengkap Karo-Indonesia',
        lokasi: 'halaman lema bengkila, sesi 264 6 Okt 2026',
        kutipan: 'paman; suami dari saudara bapak',
      },
      {
        karya: 'Jamparing, Rambe 2025, DOI 10.57235/jamparing.v3i1.4771',
        lokasi: 'teks lengkap, baris 173-174',
        kutipan:
          "Kaden are Bulang (grandfather), Nini (grandmother), Bapa (father), Nande (mother), Bengkila (the husband of the father's sister)",
      },
      {
        karya: 'Noviani 2025, PIPSI, DOI 10.26737/jpipsi.v10i1.6574',
        lokasi: 'teks lengkap, baris 547',
        kutipan: 'with greetings such as uncle, aunt, bengkila.',
      },
    ],
  },
  {
    lemma: 'silih',
    makna: 'saudara laki-laki dari istri (afinal sisi istri).',
    dictionaryRecorded: false,
    sources: [
      {
        karya: 'KamusLengkap Karo-Indonesia',
        lokasi: 'halaman lema silih, sesi 264 6 Okt 2026',
        kutipan: 'saudara laki-laki dari istri',
      },
      {
        karya: 'Ginting 2017, OSF, DOI 10.31227/osf.io/mz6kh_v1',
        lokasi: 'teks lengkap, baris 596-598',
        kutipan: 'Laki-laki atau saudara dari istri, dan sebaliknya.',
      },
    ],
  },
  {
    lemma: 'empung',
    makna: 'kakek buyut; dalam istilah Karo Jahe disebut Nono.',
    dictionaryRecorded: false,
    sources: [
      {
        karya: 'Tuuk 1861, vol 2 Bijvoegsel',
        lokasi: 'hlm 543, leaf 557, baris 72119',
        kutipan: 'voeg in : (empung)',
      },
      {
        karya: 'Limbeng 2010, jlimbeng.blogspot.com',
        lokasi: 'tabel perkade-kaden',
        kutipan: 'Empung (Karo Jahe: Nono, kakek buyut)',
      },
    ],
  },
  {
    lemma: 'nini ribu',
    makna: 'panggilan terhadap nenek yang bermarga submarga Perangin-angin (pola tutur nini plus beru disingkat)',
    dictionaryRecorded: false,
    margaNote: 'Perangin-angin',
    sources: [
      {
        karya: 'KamusKaro.net Kamus Bahasa Karo Online',
        lokasi: 'halaman lema nini-ribu (www.kamuskaro.net/indonesia/nini-ribu.html)',
        kutipan:
          'nini ribu adalah: panggilan terhadap nenek yang bermarga submarga perangin-angin',
      },
      {
        karya: 'Limbeng, SEKILAS ADAT BUDAYA KARO',
        lokasi: 'blog jlimbeng.blogspot.com posting 22 Maret 2010, bagian sapaan butir 2',
        kutipan: 'Beru Perangin-angin dipanggil Nini Ribu',
      },
    ],
  },
];

let bank: LeksikonEntry[] = SEED.map(cloneEntry);

/** Kembalikan bank ke data awal (dipakai test). */
export function resetLeksikonBank(): void {
  bank = SEED.map(cloneEntry);
}

/** Salinan dalam seluruh bank (read-only bagi pemanggil), dipakai modul bridge. */
export function getLeksikonBank(): LeksikonEntry[] {
  return bank.map(cloneEntry);
}

/** Resolve lewat lemma atau anggota alias, dua arah. */
export function lookupLeksikon(query: string): LeksikonEntry | undefined {
  const q = normalizeQuery(query);
  if (q === '') return undefined;
  const hit = bank.find((e) => namesOf(e).includes(q));
  return hit ? cloneEntry(hit) : undefined;
}

/**
 * Tambah entri. Bila lemma baru sudah dipakai entri lain, entri diterima
 * hanya jika alias-nya menghubungkan ke entri itu; hasilnya digabung
 * sebagai alias baru. Selain itu ditolak sebagai duplikat.
 */
export function addEntry(entry: LeksikonEntry): AddEntryResult {
  const lemmaKey = normalizeQuery(entry.lemma);
  const aliasKeys = (entry.alias ?? []).map(normalizeQuery);
  const clash = bank.find((e) => namesOf(e).includes(lemmaKey));

  if (!clash) {
    const added = cloneEntry(entry);
    bank.push(added);
    return { ok: true, entry: cloneEntry(added), merged: false };
  }

  const clashNames = namesOf(clash);
  const connected = aliasKeys.some((a) => clashNames.includes(a));
  if (!connected) {
    return { ok: false, error: 'duplicate-lemma', lemma: entry.lemma };
  }

  const known = new Set(clashNames);
  const merged: string[] = [...(clash.alias ?? [])];
  for (const name of [entry.lemma, ...(entry.alias ?? [])]) {
    const key = normalizeQuery(name);
    if (!known.has(key)) {
      known.add(key);
      merged.push(name.trim());
    }
  }
  clash.alias = merged.length > 0 ? merged : undefined;
  return { ok: true, entry: cloneEntry(clash), merged: true };
}

/**
 * Kumpulkan marga unik dari seluruh bank sebagai saran pengisian
 * margaNote. Nilai di-trim, kosong dibuang, dedup case-insensitive
 * dengan bentuk kanonik dari entri pertama yang menang, hasil diurut
 * alfabetis dengan localeCompare.
 * Parameter opsional hanya untuk keterujian; tanpa argumen membaca bank.
 */
export function suggestMargaValues(
  entries: LeksikonEntry[] = getLeksikonBank(),
): string[] {
  const canonical = new Map<string, string>();
  for (const entry of entries) {
    const note = entry.margaNote?.trim();
    if (!note) continue;
    const key = note.toLowerCase();
    if (!canonical.has(key)) canonical.set(key, note);
  }
  return [...canonical.values()].sort((a, b) => a.localeCompare(b));
}
