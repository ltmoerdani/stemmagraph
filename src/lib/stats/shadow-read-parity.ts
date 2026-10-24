/**
 * Harness shadow-read parity (v384, GAP 0.6 fase cutover ADR 0011):
 * menjalankan compute legacy vs compute entity (compute*FromEvents)
 * atas data tree yang sama lalu menyusun laporan diff deterministik
 * ber-fingerprint. Menjadi alat bukti paritas berjalan: fingerprint
 * sha256 yang stabil dipakai sebagai penanda rekam jejak per tree
 * sesuai kontrak cutover di ADR 0011.
 *
 * Kontrak:
 *   - Input per modul: rekaman legacy (bentuk persis modul stats
 *     existing) dan baris LifeEvent ringkas EntityEventInput.
 *   - Perbandingan memakai compare*CenturyParity modul parity v380
 *     apa adanya; modul ini TIDAK mengubah signature modul mana pun.
 *   - Fingerprint per modul menutup input data DAN hasil perbandingan
 *     (match, diffs): dua pemeriksaan dengan data atau hasil berbeda
 *     tidak pernah berbagi fingerprint; pemeriksaan ulang data sama
 *     menghasilkan fingerprint identik.
 *   - Output: per modul (match, diffs, fingerprint) plus ringkasan
 *     allMatch dan fingerprint gabungan. Deterministik: nihil
 *     randomness, nihil jam sistem, nihil I/O (sha256 murni fungsi).
 */

import { createHash } from 'node:crypto'
import {
  compareBirthsCenturyParity,
  compareDeathsCenturyParity,
  compareWeddingsCenturyParity,
  compareDivorcesCenturyParity,
  type CenturyParityResult,
  type EntityEventInput,
} from './event-entity-parity'
import type { BirthRecord } from './births-by-century'
import type { DeathRecord } from './deaths-by-century'
import type { WeddingRecord } from './weddings-by-century'
import type { DivorceRecord } from './divorces-by-century'

/** Laporan satu modul abad. */
export interface ShadowReadModuleReport {
  module: string
  match: boolean
  diffs: string[]
  fingerprint: string
}

/** Laporan shadow-read lengkap empat modul abad. */
export interface ShadowReadReport {
  allMatch: boolean
  modules: ShadowReadModuleReport[]
  fingerprint: string
}

/** Input shadow-read: pasangan legacy vs entity per modul. */
export interface ShadowReadInput {
  birthsLegacy: readonly BirthRecord[]
  birthsEntity: readonly EntityEventInput[]
  deathsLegacy: readonly DeathRecord[]
  deathsEntity: readonly EntityEventInput[]
  weddingsLegacy: readonly WeddingRecord[]
  weddingsEntity: readonly EntityEventInput[]
  divorcesLegacy: readonly DivorceRecord[]
  divorcesEntity: readonly EntityEventInput[]
}

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => val)
}

function fingerprintOf(name: string, legacy: unknown, entity: unknown, result: CenturyParityResult): string {
  const material = stableStringify({
    module: name,
    legacy,
    entity,
    match: result.match,
    diffs: result.diffs,
  })
  return createHash('sha256').update(material).digest('hex')
}

function moduleReport(name: string, legacy: unknown, entity: unknown, result: CenturyParityResult): ShadowReadModuleReport {
  return { module: name, match: result.match, diffs: result.diffs, fingerprint: fingerprintOf(name, legacy, entity, result) }
}

/**
 * Jalankan perbandingan empat modul abad. Urutan modul kunun: births,
 * deaths, weddings, divorces; fingerprint gabungan dihitung atas
 * rangkaian fingerprint per modul sehingga stabil antar pemanggilan
 * dengan input sama dan selalu berubah saat input atau hasil berubah.
 */
export function runShadowReadParity(input: ShadowReadInput): ShadowReadReport {
  const modules = [
    moduleReport('births-by-century', input.birthsLegacy, input.birthsEntity, compareBirthsCenturyParity(input.birthsLegacy, input.birthsEntity)),
    moduleReport('deaths-by-century', input.deathsLegacy, input.deathsEntity, compareDeathsCenturyParity(input.deathsLegacy, input.deathsEntity)),
    moduleReport('weddings-by-century', input.weddingsLegacy, input.weddingsEntity, compareWeddingsCenturyParity(input.weddingsLegacy, input.weddingsEntity)),
    moduleReport('divorces-by-century', input.divorcesLegacy, input.divorcesEntity, compareDivorcesCenturyParity(input.divorcesLegacy, input.divorcesEntity)),
  ]
  const allMatch = modules.every((m) => m.match)
  const fingerprint = createHash('sha256').update(modules.map((m) => m.fingerprint).join('')).digest('hex')
  return { allMatch, modules, fingerprint }
}
