// Test round-trip testfile resmi level aplikasi (STG v170-i).
//
// Pola copy-adapt eksak rt-testfiles.validation.test.ts: testfile publik
// gedcom.io diunduh saat test via fetch dengan mirror fallback GitHub;
// kegagalan jaringan kedua sumber = skip (bukan fail). Fokus tiga grup
// kasus minor yang belum tercakup: FAMS berulang (remarriage2), FAMC
// ganda satu INDI, dan FAM tanpa HUSB/WIFE hanya CHIL.
//
// Semua kasus round-trip: invariant jumlah dan bentuk dipertahankan
// sebelum dan sesudah export dengan exportedAt tetap.

import { describe, expect, it } from 'vitest'
import { importIndividuals, type ImportedIndividual } from './importIndividuals'
import { importFamilies, type ImportedFamily } from './importFamilies'
import { exportGedcom70 } from './exportGedcom70'
import type { FamilyMemberRecord, MemberRelationship } from '../adapters/types'

const EXPORTED_AT_TETAP = new Date('2000-01-01T00:00:00.000Z')
const TREE_ID = 'testfile'

const SUMBER_TESTFILE = [
  {
    id: 'remarriage2',
    url: 'https://gedcom.io/testfiles/gedcom70/remarriage2.ged',
    mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/remarriage2.ged',
  },
  {
    id: 'minimal70',
    url: 'https://gedcom.io/testfiles/gedcom70/minimal70.ged',
    mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/minimal70.ged',
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

/** Kunci pasangan ortu satu FAM: dua id ortu terurut digabung '+'. */
function kunciPasangan(fam: ImportedFamily): string {
  return [fam.husband, fam.wife]
    .filter((v): v is string => typeof v === 'string')
    .sort()
    .join('+')
}

/**
 * Menyusun MemberRelationship[] dari hasil importFamilies: tiap pasangan
 * HUSB/WIFE mendapat relasi spouse dua arah, tiap CHIL mendapat relasi
 * child ke tiap orang tua yang ada di FAM. FAM tanpa ortu tetap di-skip
 * untuk relasi (anak tercakup via famcStat, bukan relasi child).
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

function roundTrip(text: string): {
  awal: { indis: ImportedIndividual[]; fams: ImportedFamily[] }
  akhir: { indis: ImportedIndividual[]; fams: ImportedFamily[] }
} {
  const awal = { indis: importIndividuals(text), fams: importFamilies(text) }
  const exported = exportGedcom70({
    members: bentukMembers(awal.indis),
    relationships: bentukRelationships(awal.fams),
    exportedAt: EXPORTED_AT_TETAP,
  })
  const akhir = { indis: importIndividuals(exported.gedcom), fams: importFamilies(exported.gedcom) }
  return { awal, akhir }
}

describe('testfile resmi GEDCOM 7 level aplikasi: remarriage2 (FAMS berulang)', () => {
  it('dua FAM satu pasangan sama terbaca dua entri FAM (kardinalitas INDI-FAMS 0:M)', async () => {
    await denganTestfile(SUMBER_TESTFILE[0], (text) => {
      const fams = importFamilies(text)
      expect(fams.length).toBeGreaterThanOrEqual(2)
      const hitung = new Map<string, number>()
      for (const fam of fams) {
        const key = kunciPasangan(fam)
        hitung.set(key, (hitung.get(key) ?? 0) + 1)
      }
      const ganda = [...hitung.entries()].filter(([, n]) => n >= 2)
      expect(ganda.length).toBeGreaterThan(0)
    })
  })

  it('round-trip: xref INDI tetap lengkap pasca export dua pernikahan', async () => {
    await denganTestfile(SUMBER_TESTFILE[0], (text) => {
      const { awal, akhir } = roundTrip(text)
      const xrefAwal = [...new Set(awal.indis.map((i) => i.xref))].sort()
      const xrefAkhir = [...new Set(akhir.indis.map((i) => i.xref))].sort()
      expect(xrefAkhir).toEqual(xrefAwal)
      expect(xrefAwal.length).toBeGreaterThan(0)
    })
  })

  it('round-trip: setiap pasangan unik tetap terwakili satu FAM', async () => {
    await denganTestfile(SUMBER_TESTFILE[0], (text) => {
      const { awal, akhir } = roundTrip(text)
      const pasanganUnik = [...new Set(awal.fams.map(kunciPasangan))].sort()
      const pasanganAkhir = [...new Set(akhir.fams.map(kunciPasangan))].sort()
      expect(pasanganAkhir).toEqual(pasanganUnik)
      expect(pasanganUnik.length).toBeGreaterThan(0)
    })
  })

  it('round-trip: karakterisasi dedup pasangan, tiap pasangan unik tetap punya relasi spouse dua arah', async () => {
    await denganTestfile(SUMBER_TESTFILE[0], (text) => {
      const { awal, akhir } = roundTrip(text)
      // Kontrak model saat ini: pasangan sama di banyak FAM terdedup jadi
      // satu relasi spouse (gap terdokumentasi, motivasi v171 fase i).
      // Invariant yang wajib terjaga: tiap pasangan unik tetap terwakili
      // relasi spouse dua arah sesudah round-trip.
      const pasanganAwal = [...new Set(awal.fams.map(kunciPasangan))]
      const relAkhir = bentukRelationships(akhir.fams)
      for (const key of pasanganAwal) {
        const [a, b] = key.split('+')
        const maju = relAkhir.some((r) => r.type === 'spouse' && r.memberId === a && r.relatedId === b)
        const mundur = relAkhir.some((r) => r.type === 'spouse' && r.memberId === b && r.relatedId === a)
        expect(maju).toBe(true)
        expect(mundur).toBe(true)
      }
    })
  })
})

describe('testfile resmi GEDCOM 7 level aplikasi: FAMC ganda satu INDI', () => {
  // GEDCOM 7: kardinalitas INDI-FAMC 0:M, satu INDI boleh menunjuk
  // dua FAM (mis. adopsi lalu keluarga kandung). famcStat wajib satu
  // entri per FAMC berpointer, urut dokumen.
  function gedFamcGanda(): string {
    return [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Anak /Tes/',
      '1 SEX M',
      '1 FAMC @F1@',
      '2 STAT CHALLENGED',
      '1 FAMC @F2@',
      '0 @I2@ INDI',
      '1 NAME Ayah /Tes/',
      '1 SEX M',
      '0 @I3@ INDI',
      '1 NAME Ibu /Tes/',
      '1 SEX F',
      '0 @I4@ INDI',
      '1 NAME Ayah Angkat /Tes/',
      '1 SEX M',
      '0 @I5@ INDI',
      '1 NAME Ibu Angkat /Tes/',
      '1 SEX F',
      '0 @F1@ FAM',
      '1 HUSB @I2@',
      '1 WIFE @I3@',
      '1 CHIL @I1@',
      '0 @F2@ FAM',
      '1 HUSB @I4@',
      '1 WIFE @I5@',
      '1 CHIL @I1@',
      '0 TRLR',
      '',
    ].join('\n')
  }

  it('dua FAMC pointer terbaca dua entri famcStat urut dokumen', () => {
    const indis = importIndividuals(gedFamcGanda())
    expect(indis).toHaveLength(5)
    expect(indis[0]!.famcStat).toHaveLength(2)
    expect(indis[0]!.famcStat?.[0]?.fam).toBe('F1')
    expect(indis[0]!.famcStat?.[1]?.fam).toBe('F2')
    expect(indis[0]!.famcStat?.[0]?.stat.value).toBe('CHALLENGED')
    expect(indis[0]!.famcStat?.[1]?.stat.value).toBeUndefined()
  })

  it('round-trip: FAMC ganda dipertahankan via CHIL dua FAM', () => {
    const text = gedFamcGanda()
    const { awal, akhir } = roundTrip(text)
    expect(awal.fams).toHaveLength(2)
    expect(akhir.fams).toHaveLength(2)
    for (const fam of akhir.fams) {
      expect(fam.children).toContain('I1')
    }
  })

  it('round-trip: xref lima INDI tetap lengkap', () => {
    const { awal, akhir } = roundTrip(gedFamcGanda())
    const xrefAwal = [...new Set(awal.indis.map((i) => i.xref))].sort()
    const xrefAkhir = [...new Set(akhir.indis.map((i) => i.xref))].sort()
    expect(xrefAwal).toEqual(['I1', 'I2', 'I3', 'I4', 'I5'])
    expect(xrefAkhir).toEqual(xrefAwal)
  })
})

describe('testfile resmi GEDCOM 7 level aplikasi: FAM tanpa HUSB/WIFE hanya CHIL', () => {
  function gedFamAnakSaja(): string {
    return [
      '0 HEAD',
      '1 GEDC',
      '2 VERS 7.0',
      '0 @I1@ INDI',
      '1 NAME Anak /Sendiri/',
      '1 SEX F',
      '0 @F1@ FAM',
      '1 CHIL @I1@',
      '0 TRLR',
      '',
    ].join('\n')
  }

  it('FAM tanpa ortu terbaca: children terisi, husband wife undefined', () => {
    const fams = importFamilies(gedFamAnakSaja())
    expect(fams).toHaveLength(1)
    expect(fams[0]!.children).toEqual(['I1'])
    expect(fams[0]!.husband).toBeUndefined()
    expect(fams[0]!.wife).toBeUndefined()
  })

  it('relasi child nihil untuk FAM tanpa ortu (anak bukan relasi ke diri sendiri)', () => {
    const fams = importFamilies(gedFamAnakSaja())
    const rel = bentukRelationships(fams)
    expect(rel.filter((r) => r.type === 'child')).toHaveLength(0)
    expect(rel.filter((r) => r.type === 'spouse')).toHaveLength(0)
  })

  it('round-trip: karakterisasi FAM tanpa ortu, INDI tetap diekspor, FAM tidak terekonstruksi', () => {
    const text = gedFamAnakSaja()
    const { awal, akhir } = roundTrip(text)
    expect(awal.fams).toHaveLength(1)
    // Batasan model terdokumentasi (exportGedcom70): relasi child
    // membutuhkan ortu tercatat, jadi FAM hanya-CHIL tidak punya jalur
    // rekonstruksi. Gap ini terekam jujur sebagai karakterisasi.
    expect(akhir.fams).toHaveLength(0)
    // Yang wajib terjaga: INDI anak tetap diekspor, tidak hilang.
    expect(akhir.indis).toHaveLength(1)
  })

  it('round-trip: karakterisasi INDI isolasi tanpa ortu tetap ada satu', () => {
    const { awal, akhir } = roundTrip(gedFamAnakSaja())
    expect(awal.indis.map((i) => i.xref)).toEqual(['I1'])
    // Serializer vendor hanya mencetak xref untuk record yang ditunjuk
    // (terdokumentasi di exportGedcom70), jadi INDI isolasi diimpor
    // ulang dengan xref fallback, jumlah INDI tetap satu.
    expect(akhir.indis).toHaveLength(1)
  })
})

describe('testfile resmi GEDCOM 7 level aplikasi: minimal70 struktur kosong', () => {
  it('minimal70 tetap round-trip aman tanpa INDI dan FAM', async () => {
    await denganTestfile(SUMBER_TESTFILE[1], (text) => {
      const { awal, akhir } = roundTrip(text)
      expect(awal.indis).toHaveLength(0)
      expect(awal.fams).toHaveLength(0)
      expect(akhir.indis).toHaveLength(0)
      expect(akhir.fams).toHaveLength(0)
    })
  })
})
