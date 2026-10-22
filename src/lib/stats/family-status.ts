/**
 * Family status (v354 fase i): modul PURE untuk breakdown marital
 * status living individuals sebagai empat slice donut chart, pilar
 * statistik pohon VISION-stemmagraph. Jangkar: wt_statistic.php
 * getFamilyStatusData (baris 267) yang mendelegasikan
 * familyRepository::classifyLivingIndividuals. Rujukan pola, bukan
 * salinan kode. Tanpa import apa pun, tanpa I/O, tanpa Date.now,
 * tanpa random: murni transformasi array entri.
 *
 * Kontrak:
 *   computeFamilyStatus(entries) menghitung distribusi marital status
 *   dari entri yang sudah membawa maritalStatus hasil klasifikasi
 *   upstream (precedence jangkar webtrees: current > divorced >
 *   widowed > single). Output SELALU tepat empat entri dengan urutan
 *   tetap Married, Single, Widowed, Divorced, tanpa clamping, dan
 *   total penjumlahan value empat entri tersebut. Array kosong
 *   menghasilkan total 0 dengan empat entri bernilai 0.
 *
 * Keputusan desain PM: properti class PHP jangkar tidak direplikasi
 * karena terikat presentasi, diganti kind TypeScript padanan
 * semantiknya (konsisten keputusan v353).
 *
 * Parsing strict pola v338-v353 (prefiks family-status): input bukan
 * array, entri bukan objek ber-index, maritalStatus bukan string,
 * atau nilai tidak termasuk empat kanonik (married, single, widowed,
 * divorced) setelah trim dan lowercase DILEMPAR Error ber-prefiks,
 * bukan difilter diam-diam.
 */

export type FamilyStatusKind = 'married' | 'single' | 'widowed' | 'divorced'

export interface FamilyStatusResult {
  total: number
  classes: Array<{ label: string; value: number; kind: FamilyStatusKind }>
}

const ERROR_PREFIX = 'family-status:'

/** Urutan output tetap, mirror jangkar webtrees yang memancarkan
 * empat bucket dengan ?? 0. */
const CANONICAL_ORDER: Array<{ kind: FamilyStatusKind; label: string }> = [
  { kind: 'married', label: 'Married' },
  { kind: 'single', label: 'Single' },
  { kind: 'widowed', label: 'Widowed' },
  { kind: 'divorced', label: 'Divorced' },
]

function isIndexableObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Normalisasi nilai kanonik: trim lalu lowercase. Mengembalikan null
 * bila nilai bukan salah satu dari empat kind resmi.
 */
function toKind(normalized: string): FamilyStatusKind | null {
  switch (normalized) {
    case 'married':
      return 'married'
    case 'single':
      return 'single'
    case 'widowed':
      return 'widowed'
    case 'divorced':
      return 'divorced'
    default:
      return null
  }
}

/**
 * Hitung breakdown marital status living individuals untuk donut
 * chart. Pure dan deterministik: tidak ada mutasi input, tidak ada
 * akses jaringan atau waktu.
 */
export function computeFamilyStatus(entries: unknown): FamilyStatusResult {
  if (!Array.isArray(entries)) {
    throw new Error(`${ERROR_PREFIX} input harus array entri`)
  }

  const counts: Record<FamilyStatusKind, number> = {
    married: 0,
    single: 0,
    widowed: 0,
    divorced: 0,
  }

  for (const raw of entries) {
    if (!isIndexableObject(raw)) {
      throw new Error(`${ERROR_PREFIX} entri harus objek ber-index`)
    }
    const status = raw['maritalStatus']
    if (typeof status !== 'string') {
      throw new Error(`${ERROR_PREFIX} field maritalStatus harus string`)
    }
    const kind = toKind(status.trim().toLowerCase())
    if (kind === null) {
      throw new Error(`${ERROR_PREFIX} nilai maritalStatus tidak kanonik: ${status}`)
    }
    counts[kind] += 1
  }

  const classes = CANONICAL_ORDER.map((canonical) => ({
    label: canonical.label,
    value: counts[canonical.kind],
    kind: canonical.kind,
  }))
  const total = classes.reduce((acc, entry) => acc + entry.value, 0)

  return { total, classes }
}
