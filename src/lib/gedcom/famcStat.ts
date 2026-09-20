// Modul pure FAMC-STAT passthrough GEDCOM 7 (STG v125 fase i, T0d round-trip
// fidelity).
//
// GEDCOM 7 mendefinisikan STAT sebagai substructure level +2 di bawah FAMC
// (https://gedcom.io/terms/v7/FAMC-STAT) dengan payload Enum tepat 3 nilai:
//   CHALLENGED : hubungan anak-orang tua diragukan
//   DISPROVEN  : hubungan terbukti salah
//   PROVEN     : hubungan terbukti sah
// Kardinalitas FAMC.STAT adalah {0:1} (maksimum satu per FAMC).
//
// Kontrak perilaku (gaya parseEventDate/mapGender):
//   - Murni fungsi: tanpa fs/network/db, tanpa efek samping, tanpa state.
//     Satu-satunya import adalah struct vendor gedcstruct, lapisan data yang
//     sama dipakai importIndividuals/exportGedcom70.
//   - Nilai payload di luar ketiga enum, termasuk string kosong, DIABAIKAN:
//     kembali sebagai nihil plus warning 'invalid-stat'. Nilai invalid tidak
//     pernah dipetakan ke status relasi lain (tanpa sharpen).
//   - STAT lebih dari satu pada satu FAMC: nilai yang PERTAMA dipakai,
//     sisanya warning 'duplicate-stat'.
//   - FAMC tanpa STAT kembali sebagai nihil, tanpa warning.
//   - Tidak pernah melempar error.

import { GEDCStruct } from './vendor/gedcstruct.js'

/** Nilai enum FAMC.STAT menurut spesifikasi GEDCOM 7. */
export type FamcStatValue = 'CHALLENGED' | 'DISPROVEN' | 'PROVEN'

/** Warning terstruktur dari urai FAMC.STAT. */
export interface FamcStatWarning {
  /** Tag substructure yang memicu warning ('STAT'). */
  tag: 'STAT'
  /** Kode warning: 'invalid-stat' atau 'duplicate-stat'. */
  warning: 'invalid-stat' | 'duplicate-stat'
  /** Payload mentah yang memicu warning, tanpa perubahan (kecuali trim). */
  raw: string
}

/** Hasil urai FAMC.STAT: nilai enum atau nihil, plus warning. */
export interface FamcStatResult {
  /** Nilai enum sah, atau undefined bila nihil atau invalid. */
  value: FamcStatValue | undefined
  /** Warning urai, urut baris dokumen. */
  warnings: FamcStatWarning[]
}

/** Tabel enum eksplisit; payload harus sama persis setelah trim. */
const FAMC_STAT_ENUM: Readonly<Record<string, FamcStatValue>> = {
  CHALLENGED: 'CHALLENGED',
  DISPROVEN: 'DISPROVEN',
  PROVEN: 'PROVEN',
}

/**
 * Urai substructure STAT level +2 di bawah satu struct FAMC.
 * Hanya substructure langsung FAMC yang diperiksa (kedalaman tepat +2 dari
 * INDI, level +1 dari FAMC). Nilai di luar enum diabaikan dan dicatat
 * warning; tidak pernah dipetakan ke status relasi lain.
 */
export function parseFamcStat(famc: GEDCStruct | undefined): FamcStatResult {
  const warnings: FamcStatWarning[] = []
  if (famc === undefined) return { value: undefined, warnings }

  let value: FamcStatValue | undefined = undefined
  for (const sub of famc.sub) {
    if (sub.tag !== 'STAT') continue
    const raw = typeof sub.payload === 'string' ? sub.payload.trim() : ''
    const mapped = FAMC_STAT_ENUM[raw]
    if (mapped !== undefined) {
      if (value === undefined) {
        value = mapped
      } else {
        warnings.push({ tag: 'STAT', warning: 'duplicate-stat', raw })
        break
      }
    } else {
      warnings.push({ tag: 'STAT', warning: 'invalid-stat', raw })
    }
  }

  return { value, warnings }
}

/**
 * Hasilkan lini STAT GEDCOM dari satu nilai enum.
 * Bila value undefined, kembali undefined sehingga pemanggil tidak pernah
 * menulis lini STAT; output file tanpa STAT tidak berubah apa pun.
 */
export function serializeFamcStat(
  value: FamcStatValue | undefined,
): string | undefined {
  if (value === undefined) return undefined
  if (FAMC_STAT_ENUM[value] === undefined) return undefined
  return `STAT ${value}`
}

/**
 * Pasangan struct pada sisi export: bila value tersedia, hasilkan satu
 * struct STAT dengan payload enum di bawah sup; bila nihil, kembali
 * undefined dan pemanggil tidak menambahkan substructure apa pun (tanpa
 * STAT, tanpa sub lain). Fungsi murni, tanpa efek samping selain
 * relasi induk-anak struct vendor yang jadi tujuannya.
 */
export function serializeFamcStatStruct(
  value: FamcStatValue | undefined,
  sup: GEDCStruct,
): GEDCStruct | undefined {
  if (value === undefined) return undefined
  if (FAMC_STAT_ENUM[value] === undefined) return undefined
  return new GEDCStruct('STAT', sup, undefined, value)
}
