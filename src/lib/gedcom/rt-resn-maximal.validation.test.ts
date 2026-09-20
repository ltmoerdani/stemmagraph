// Test validasi RESN multi-nilai end-to-end atas testfile resmi GEDCOM 7
// maximal70.ged (STG v132-i).
//
// Sumber data: testfile publik gedcom.io (maximal70), diunduh saat test
// lewat fetch dengan mirror fallback GitHub, pola yang sama dengan
// rt-testfiles.validation.test.ts. Kegagalan jaringan pada kedua sumber
// memicu skip dengan pesan jelas; test tidak gagal karena jaringan.
// Kegagalan asersi tetap fail.
//
// Yang dibuktikan: RESN bernilai ganda pada FAM @F1@ dan INDI @I1@
// ('CONFIDENTIAL, LOCKED') lolos verbatim dari parser import, lalu termap
// ke privacyStatus 'private' lewat applyResnToPrivacyStatus sampai ke
// hasil buildImportPlan. RESN nihil tidak melempar dan berujung tanpa
// status pada rencana import.

import { describe, expect, it } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'
import { buildImportPlan } from './importPlan'
import { applyResnToPrivacyStatus } from './resn-import'

const SUMBER_MAXIMAL = {
  id: 'maximal70',
  url: 'https://gedcom.io/testfiles/gedcom70/maximal70.ged',
  mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/maximal70.ged',
} as const

/** Mengambil testfile: URL utama dulu, mirror fallback bila gagal. */
async function ambilTestfile(): Promise<string> {
  let pesanGagal = ''
  for (const url of [SUMBER_MAXIMAL.url, SUMBER_MAXIMAL.mirror]) {
    try {
      const res = await fetch(url)
      if (res.status !== 200) {
        pesanGagal += `${url}: HTTP ${res.status}; `
        continue
      }
      return await res.text()
    } catch (err) {
      pesanGagal += `${url}: ${String(err)}; `
    }
  }
  throw new Error(`gagal jaringan ambil ${SUMBER_MAXIMAL.id} dari semua sumber (${pesanGagal})`)
}

/** Strip BOM UTF-8 bila tiga byte pertama EF BB BF. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

// Satu unduhan dipakai bersama semua kasus: fixture ratusan baris,
// fetch berulang hanya memperlambat tanpa menambah cakupan.
let teksFixture: Promise<string> | undefined
function ambilMaximal70(): Promise<string> {
  teksFixture ??= ambilTestfile().then(stripBom)
  return teksFixture
}

/** Jalankan uji bila fixture berhasil diambil; selain itu skip dengan pesan. */
async function denganFixture(uji: (text: string) => void): Promise<void> {
  let text: string
  try {
    text = await ambilMaximal70()
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err)
    console.warn(`[skip] ${SUMBER_MAXIMAL.id}: ${pesan}`)
    return
  }
  uji(text)
}

describe('testfile resmi GEDCOM 7: maximal70 RESN multi-nilai', () => {
  it('FAM @F1@ terparse dengan RESN verbatim CONFIDENTIAL, LOCKED', async () => {
    await denganFixture((text) => {
      const fams = importFamilies(text)
      const f1 = fams.find((fam) => fam.xref === 'F1')
      expect(f1).toBeDefined()
      expect(f1?.resn).toBe('CONFIDENTIAL, LOCKED')
    })
  })

  it('INDI @I1@ terparse dengan RESN verbatim CONFIDENTIAL, LOCKED', async () => {
    await denganFixture((text) => {
      const indis = importIndividuals(text)
      const i1 = indis.find((indi) => indi.xref === 'I1')
      expect(i1).toBeDefined()
      expect(i1?.resn).toBe('CONFIDENTIAL, LOCKED')
    })
  })

  it('applyResnToPrivacyStatus mengenali multi-nilai CONFIDENTIAL, LOCKED', () => {
    expect(applyResnToPrivacyStatus('CONFIDENTIAL, LOCKED')).toBe('private')
  })

  it('applyResnToPrivacyStatus mengenali satu nilai PRIVACY', () => {
    expect(applyResnToPrivacyStatus('PRIVACY')).toBe('private')
  })

  it('buildImportPlan memberi privacyStatus private untuk I1', async () => {
    await denganFixture((text) => {
      const indis = importIndividuals(text)
      const fams = importFamilies(text)
      const plan = buildImportPlan(indis, fams)
      const i1 = plan.members.find((member) => member.xref === 'I1')
      expect(i1).toBeDefined()
      expect(i1?.privacyStatus).toBe('private')
    })
  })

  it('RESN nihil tidak melempar dan menghasilkan tanpa status', async () => {
    await denganFixture((text) => {
      expect(() => applyResnToPrivacyStatus(null)).not.toThrow()
      expect(applyResnToPrivacyStatus(null)).toBeNull()
      expect(applyResnToPrivacyStatus(undefined)).toBeNull()
      expect(applyResnToPrivacyStatus('')).toBeNull()
      // Pada rencana import, hasil null dipetakan ke undefined: member
      // tanpa RESN tidak punya privacyStatus, tidak ada nilai fabrikasi.
      const indis = importIndividuals(text)
      const tanpaResn = indis.find((indi) => indi.resn === undefined)
      if (tanpaResn === undefined) throw new Error('fixture tidak punya INDI tanpa RESN')
      const plan = buildImportPlan([tanpaResn], [])
      const member = plan.members.find((m) => m.xref === tanpaResn.xref)
      expect(member).toBeDefined()
      expect(member?.privacyStatus).toBeUndefined()
    })
  })
})
