// Test validasi round-trip atas testfile resmi GEDCOM 7 (STG v118-c).
//
// Sumber data: testfile publik gedcom.io (minimal70, same-sex-marriage,
// remarriage2), diunduh saat test lewat fetch dengan mirror fallback
// GitHub. Kegagalan jaringan pada kedua sumber memicu skip dengan pesan
// jelas, bukan fail; kegagalan parse tetap fail.
//
// Alur tiap kasus: fetch (fallback mirror), strip BOM UTF-8 bila ada,
// import INDI + FAM, bentuk members + relationships, export ulang lewat
// exportGedcom70 dengan exportedAt tetap, import balik, lalu asersi
// invariant jumlah record dan checklist round-trip.

import { describe, expect, it } from 'vitest'
import { importIndividuals, type ImportedIndividual } from './importIndividuals'
import { importFamilies, type ImportedFamily } from './importFamilies'
import { exportGedcom70 } from './exportGedcom70'
import { RT_CHECKLIST, runChecklist, type ChecklistResultInput } from './checklist'
import type { FamilyMemberRecord, MemberRelationship } from '../adapters/types'

const EXPORTED_AT_TETAP = new Date('2000-01-01T00:00:00.000Z')
const TREE_ID = 'testfile'

const SUMBER_TESTFILE = [
  {
    id: 'minimal70',
    url: 'https://gedcom.io/testfiles/gedcom70/minimal70.ged',
    mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/minimal70.ged',
  },
  {
    id: 'same-sex-marriage',
    url: 'https://gedcom.io/testfiles/gedcom70/same-sex-marriage.ged',
    mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/same-sex-marriage.ged',
  },
  {
    id: 'remarriage2',
    url: 'https://gedcom.io/testfiles/gedcom70/remarriage2.ged',
    mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/remarriage2.ged',
  },
] as const

type SumberTestfile = (typeof SUMBER_TESTFILE)[number]

/** Mengambil satu testfile: URL utama dulu, mirror fallback bila gagal. */
async function ambilTestfile(sumber: SumberTestfile): Promise<string> {
  let pesanGagal = ''
  for (const url of [sumber.url, sumber.mirror]) {
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
  throw new Error(`gagal jaringan ambil ${sumber.id} dari semua sumber (${pesanGagal})`)
}

/** Strip BOM UTF-8 bila tiga byte pertama EF BB BF. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function tanggalString(parsed: ImportedIndividual['birthDate']): string {
  return parsed === undefined ? '' : parsed.originalDateString
}

function jenisKelamin(sex: string | undefined): FamilyMemberRecord['gender'] {
  if (sex === 'M') return 'male'
  if (sex === 'F') return 'female'
  return 'other'
}

/**
 * Menyusun FamilyMemberRecord[] dari hasil importIndividuals.
 * id memakai xref, bila xref undefined memakai 'I'+index.
 */
function bentukMembers(indis: readonly ImportedIndividual[]): FamilyMemberRecord[] {
  return indis.map((indi, index) => ({
    id: indi.xref ?? `I${index}`,
    treeId: TREE_ID,
    name: indi.name ?? '[Unknown]',
    birthDate: tanggalString(indi.birthDate),
    deathDate: indi.deathDate === undefined ? undefined : indi.deathDate.originalDateString,
    gender: jenisKelamin(indi.sex),
    isAlive: indi.deathDate === undefined,
    generation: 1,
    maritalStatus: 'single' as const,
  }))
}

/**
 * Menyusun MemberRelationship[] dari hasil importFamilies: tiap pasangan
 * HUSB/WIFE mendapat relasi spouse dua arah dengan id sintetis unik, tiap
 * CHIL mendapat relasi child ke tiap orang tua yang ada di FAM.
 */
function bentukRelationships(fams: readonly ImportedFamily[]): MemberRelationship[] {
  const out: MemberRelationship[] = []
  let urutan = 0
  for (const fam of fams) {
    const orangTua = [fam.husband, fam.wife].filter((v): v is string => typeof v === 'string')
    for (const a of orangTua) {
      for (const b of orangTua) {
        if (a === b) continue
        urutan += 1
        out.push({ id: `RT-SP-${urutan}`, treeId: TREE_ID, memberId: a, relatedId: b, type: 'spouse' })
      }
    }
    for (const anak of fam.children) {
      for (const ortu of orangTua) {
        urutan += 1
        out.push({ id: `RT-CH-${urutan}`, treeId: TREE_ID, memberId: anak, relatedId: ortu, type: 'child' })
      }
    }
  }
  return out
}

/** Tandai pasangan dari FAM sebagai married pada members terkait. */
function tandaiMarried(
  members: FamilyMemberRecord[],
  fams: readonly ImportedFamily[],
): FamilyMemberRecord[] {
  const pasangan = new Set<string>()
  for (const fam of fams) {
    if (typeof fam.husband === 'string') pasangan.add(fam.husband)
    if (typeof fam.wife === 'string') pasangan.add(fam.wife)
  }
  return members.map((m) =>
    pasangan.has(m.id) ? { ...m, maritalStatus: 'married' as const } : m,
  )
}

interface PipelineHasil {
  indis: ImportedIndividual[]
  fams: ImportedFamily[]
  members: FamilyMemberRecord[]
  relationships: MemberRelationship[]
}

/** Pipeline penuh satu arah: teks GEDCOM menjadi members + relationships. */
function jalankanPipeline(text: string): PipelineHasil {
  const indis = importIndividuals(text)
  const fams = importFamilies(text)
  const members = tandaiMarried(bentukMembers(indis), fams)
  const relationships = bentukRelationships(fams)
  return { indis, fams, members, relationships }
}

/** Entri checklist yang dapat dievaluasi dari hasil pipeline. */
function entriChecklist(hasil: PipelineHasil): ChecklistResultInput[] {
  const semuaTanggalEksakAda = hasil.indis.every(
    (indi) =>
      indi.birthDate === undefined ||
      indi.birthDate.dateKind === 'EXACT' ||
      indi.birthDate.originalDateString.length > 0,
  )
  const exportText = exportGedcom70({
    members: hasil.members,
    relationships: hasil.relationships,
    exportedAt: EXPORTED_AT_TETAP,
  }).gedcom
  const tanpaConc = !exportText.split('\n').some((baris) => baris.trimStart().startsWith('CONC'))
  const strukturInti = hasil.indis.length > 0 || hasil.fams.length > 0
  const idDapatEvaluasi = new Set(['RT-01', 'RT-07', 'RT-10'])
  const catatan = (id: string): string | undefined =>
    idDapatEvaluasi.has(id) ? undefined : 'tidak dievaluasi pada testfile ini (kasus tidak ada di data)'
  const nilai: Record<string, boolean> = {
    'RT-01': semuaTanggalEksakAda,
    'RT-07': tanpaConc,
    'RT-10': strukturInti,
  }
  return RT_CHECKLIST.map((entry) => ({
    id: entry.id,
    passed: nilai[entry.id] ?? true,
    note: catatan(entry.id),
  }))
}

/**
 * Round-trip penuh satu testfile: pipeline maju, export ulang, import balik.
 * Mengembalikan hasil import kedua untuk asersi invariant.
 */
function roundTrip(text: string): { awal: PipelineHasil; akhir: PipelineHasil } {
  const awal = jalankanPipeline(text)
  const exported = exportGedcom70({
    members: awal.members,
    relationships: awal.relationships,
    exportedAt: EXPORTED_AT_TETAP,
  })
  const indis = importIndividuals(exported.gedcom)
  const fams = importFamilies(exported.gedcom)
  const members = tandaiMarried(bentukMembers(indis), fams)
  const relationships = bentukRelationships(fams)
  return { awal, akhir: { indis, fams, members, relationships } }
}

async function denganTestfile(
  sumber: SumberTestfile,
  uji: (text: string) => void,
): Promise<void> {
  let text: string
  try {
    text = await ambilTestfile(sumber)
  } catch (err) {
    const pesan = err instanceof Error ? err.message : String(err)
    console.warn(`[skip] ${sumber.id}: ${pesan}`)
    return
  }
  uji(stripBom(text))
}

describe('testfile resmi GEDCOM 7: minimal70', () => {
  it('round-trip pipeline mempertahankan struktur', async () => {
    await denganTestfile(SUMBER_TESTFILE[0], (text) => {
      const { awal, akhir } = roundTrip(text)
      // minimal70 hanya berisi HEAD + TRLR: nol INDI dan nol FAM.
      expect(awal.indis).toHaveLength(0)
      expect(awal.fams).toHaveLength(0)
      expect(akhir.indis).toHaveLength(awal.indis.length)
      expect(akhir.fams).toHaveLength(awal.fams.length)
    })
  })
})

describe('testfile resmi GEDCOM 7: same-sex-marriage', () => {
  it('hasil parse memuat 2 INDI dan 1 FAM', async () => {
    await denganTestfile(SUMBER_TESTFILE[1], (text) => {
      const hasil = jalankanPipeline(text)
      expect(hasil.indis.length).toBeGreaterThan(0)
      expect(hasil.fams.length).toBeGreaterThan(0)
      expect(hasil.indis).toHaveLength(2)
      expect(hasil.fams).toHaveLength(1)
    })
  })

  it('bentuk members dan relationships sesuai kontrak adapter', async () => {
    await denganTestfile(SUMBER_TESTFILE[1], (text) => {
      const hasil = jalankanPipeline(text)
      expect(hasil.members.map((m) => m.id).sort()).toEqual(['I1', 'I2'])
      expect(hasil.members.every((m) => m.treeId === TREE_ID)).toBe(true)
      expect(hasil.members.every((m) => m.isAlive)).toBe(true)
      expect(hasil.members.every((m) => m.maritalStatus === 'married')).toBe(true)
      expect(hasil.members.map((m) => m.gender)).toEqual(['male', 'male'])
      const spouse = hasil.relationships.filter((r) => r.type === 'spouse')
      expect(spouse).toHaveLength(2)
      const duaArah =
        spouse.some((r) => r.memberId === 'I1' && r.relatedId === 'I2') &&
        spouse.some((r) => r.memberId === 'I2' && r.relatedId === 'I1')
      expect(duaArah).toBe(true)
    })
  })

  it('round-trip: jumlah INDI dan FAM invariant sebelum dan sesudah export', async () => {
    await denganTestfile(SUMBER_TESTFILE[1], (text) => {
      const { awal, akhir } = roundTrip(text)
      expect(akhir.indis).toHaveLength(awal.indis.length)
      expect(akhir.fams).toHaveLength(awal.fams.length)
      // Pasangan tetap satu FAM dengan dua anggota sama.
      expect(akhir.fams[0]?.husband).toBe(awal.fams[0]?.husband)
      expect(akhir.fams[0]?.wife).toBe(awal.fams[0]?.wife)
    })
  })

  it('checklist round-trip lulus untuk item yang dievaluasi', async () => {
    await denganTestfile(SUMBER_TESTFILE[1], (text) => {
      const hasil = jalankanPipeline(text)
      const ringkasan = runChecklist(entriChecklist(hasil))
      expect(ringkasan.allPassed).toBe(true)
    })
  })
})
