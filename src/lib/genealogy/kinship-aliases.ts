import type { KinshipKind } from './kinship-calc'

export interface AliasEntry {
  kind: KinshipKind
  depth?: number
  qualifier?: 'cak' | 'jw' | 'mk' | 'sunda' | 'jawa' | 'antr'
  note?: string
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
  aki: { kind: 'grandparent' },
  datuk: {
    kind: 'grandparent',
    note: 'homonim: makna 2 leluhur saat konteks naik jauh',
  },
  atok: {
    kind: 'grandparent',
    note: 'homonim: makna leluhur saat konteks naik jauh',
  },
  opa: { kind: 'grandparent', qualifier: 'cak' },
  oma: { kind: 'grandparent', qualifier: 'cak' },
  eyang: { kind: 'grandparent', qualifier: 'jw' },
  mbah: { kind: 'grandparent', qualifier: 'jw' },
  nini: {
    kind: 'grandparent',
    note: 'homonim: sapaan perempuan tua tidak dipakai; Jawa Kuno, Banjar, Karo, Sunda: nenek',
  },
  ninik: { kind: 'grandparent', qualifier: 'mk', note: 'KBBI VI: nenek' },
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
}

/** Normalisasi frasa: trim, lowercase, buang titik tengah, rapat spasi ganda. */
function normalize(phrase: string): string {
  return phrase
    .trim()
    .toLowerCase()
    .replace(/\u00B7/g, '')
    .replace(/\s+/g, ' ')
}

export function resolveAlias(phrase: string): AliasEntry | null {
  const key = normalize(phrase)
  const entry = KINSHIP_ALIASES[key]
  return entry === undefined ? null : entry
}

export function aliasKinds(): string[] {
  return Object.keys(KINSHIP_ALIASES).sort()
}
