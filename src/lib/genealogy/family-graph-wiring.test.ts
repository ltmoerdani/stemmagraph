// Test wiring buildFamilyGraph untuk GOAL v172-i STG T0D Phase 2.
//
// Fokus: verifikasi pemakaian modul pure family-graph pada skenario
// nyata (multi FAMS, multi FAMC, FAMC-only, MARR ganda, remarriage,
// urutan deterministik, fixture resmi remarriage2.ged).
//
// Kasus 7 memakai testfile publik gedcom.io. Pengambilan berkas hanya
// lewat fetch + mirror GitHub dengan strip BOM; bila jaringan gagal di
// kedua sumber test di-skip dengan pesan jelas. Pemetaan INDI ke
// IndiInput memakai regex atas teks GEDCOM, tanpa import modul ../gedcom.

import { describe, expect, it } from 'vitest'
import { buildFamilyGraph, type IndiInput } from './family-graph'

const SUMBER_REMARRIAGE2 = {
  url: 'https://gedcom.io/testfiles/gedcom70/remarriage2.ged',
  mirror: 'https://raw.githubusercontent.com/FamilySearch/GEDCOM.io/master/testfiles/gedcom70/remarriage2.ged',
} as const

/** Ambil remarriage2.ged: URL utama dulu, mirror fallback bila gagal. */
async function ambilRemarriage2(): Promise<string> {
  let pesanGagal = ''
  for (const url of [SUMBER_REMARRIAGE2.url, SUMBER_REMARRIAGE2.mirror]) {
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
  throw new Error(`gagal jaringan ambil remarriage2.ged dari semua sumber (${pesanGagal})`)
}

/** Strip BOM UTF-8 bila tiga byte pertama EF BB BF. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/**
 * Peta pointer FAMS/FAMC per INDI dari teks GEDCOM lewat regex.
 * Hasil dipakai langsung sebagai IndiInput[] untuk buildFamilyGraph.
 */
function petakanIndi(teksGed: string): IndiInput[] {
  const bars = teksGed.split(/\r?\n/)
  const indis: IndiInput[] = []
  let indiAktif: IndiInput | undefined

  for (let idx = 0; idx < bars.length; idx += 1) {
    const bar = bars[idx]
    const buka = bar.match(/^0 @([^@]+)@ INDI\b/)
    if (buka) {
      indiAktif = { id: buka[1] }
      indis.push(indiAktif)
      continue
    }
    if (!indiAktif) continue
    // Baris level 0 lain menutup blok INDI aktif.
    if (/^0 /.test(bar)) {
      indiAktif = undefined
      continue
    }
    const fams = bar.match(/^1 FAMS @([^@]+)@/)
    if (fams) {
      indiAktif.fams = [...(indiAktif.fams ?? []), fams[1]]
      continue
    }
    const famc = bar.match(/^1 FAMC @([^@]+)@/)
    if (famc) {
      const pointer: NonNullable<IndiInput['famc']>[number] = { fam: famc[1] }
      // PEDI dan FAMC-STAT adalah baris level 2 tepat di bawah FAMC.
      const berikut = bars[idx + 1] ?? ''
      const pedi = berikut.match(/^2 PEDI (.+)$/)?.[1]
      const famcStat = berikut.match(/^2 FAMC-STAT (.+)$/)?.[1]
      if (pedi !== undefined) pointer.pedi = pedi.trim()
      if (famcStat !== undefined) pointer.famcStat = famcStat.trim()
      indiAktif.famc = [...(indiAktif.famc ?? []), pointer]
    }
  }
  return indis
}

describe('family-graph wiring (v172-i phase 2)', () => {
  it('kasus 1: satu INDI 3 FAMS menghasilkan 3 union terpisah tanpa overwrite', () => {
    const hasil = buildFamilyGraph([
      { id: 'I1', fams: [{ fam: 'F1', marr: '1900' }, { fam: 'F2' }, { fam: 'F3', marr: '1930' }] },
      { id: 'I2', fams: ['F1'] },
      { id: 'I3', fams: ['F2'] },
      { id: 'I4', fams: ['F3'] },
    ])

    expect(hasil.unions).toHaveLength(3)
    expect(hasil.unions.map((u) => u.fam)).toEqual(['F1', 'F2', 'F3'])
    expect(hasil.unions[0]).toMatchObject({ fam: 'F1', spouses: ['I1', 'I2'], marr: '1900' })
    expect(hasil.unions[1]).toMatchObject({ fam: 'F2', spouses: ['I1', 'I3'] })
    expect(hasil.unions[2]).toMatchObject({ fam: 'F3', spouses: ['I1', 'I4'], marr: '1930' })
    // marr F1 dan F3 tidak tertukar antar union.
    expect(hasil.unions.filter((u) => u.marr === '1900')).toHaveLength(1)
    expect(hasil.unions.filter((u) => u.marr === '1930')).toHaveLength(1)
  })

  it('kasus 2: satu INDI 2 FAMC menghasilkan 2 parentEdge, pedi dan famcStat verbatim', () => {
    const hasil = buildFamilyGraph([
      {
        id: 'I1',
        famc: [
          { fam: 'F1', pedi: 'birth', famcStat: 'challenge' },
          { fam: 'F2' },
        ],
      },
    ])

    expect(hasil.parentEdges).toHaveLength(2)
    expect(hasil.parentEdges[0]).toEqual({ child: 'I1', fam: 'F1', parents: [], pedi: 'birth', famcStat: 'challenge' })
    expect(hasil.parentEdges[1]).toEqual({ child: 'I1', fam: 'F2', parents: [] })
  })

  it('kasus 3: FAM hanya dirujuk FAMC tetap satu union dan edge, tanpa palsu', () => {
    const hasil = buildFamilyGraph([
      { id: 'I1', famc: [{ fam: 'F9', pedi: 'birth' }] },
    ])

    expect(hasil.unions).toHaveLength(1)
    expect(hasil.unions[0]).toEqual({ fam: 'F9', spouses: [] })
    expect(hasil.parentEdges).toEqual([{ child: 'I1', fam: 'F9', parents: [], pedi: 'birth' }])
    expect(hasil.personIds).toEqual(['I1'])
  })

  it('kasus 4: dua MARR pada FAM sama, marr pertama menang, tetap satu union', () => {
    const hasil = buildFamilyGraph([
      { id: 'I1', fams: [{ fam: 'F1', marr: '1955-01-01' }] },
      { id: 'I2', fams: [{ fam: 'F1', marr: '1960-02-02' }] },
    ])

    expect(hasil.unions).toHaveLength(1)
    expect(hasil.unions[0]).toEqual({ fam: 'F1', spouses: ['I1', 'I2'], marr: '1955-01-01' })
  })

  it('kasus 5: pasangan sama menikah ulang di F1 dan F3, dua union spouses sama', () => {
    const hasil = buildFamilyGraph([
      { id: 'I1', fams: ['F1', 'F3'] },
      { id: 'I2', fams: ['F1', 'F3'] },
    ])

    expect(hasil.unions).toHaveLength(2)
    expect(hasil.unions.map((u) => u.fam)).toEqual(['F1', 'F3'])
    expect(hasil.unions[0].spouses).toEqual(['I1', 'I2'])
    expect(hasil.unions[1].spouses).toEqual(['I1', 'I2'])
  })

  it('kasus 6: urutan unions deterministik mengikuti pointer pertama', () => {
    const hasil = buildFamilyGraph([
      // FAM pertama kali muncul lewat FAMC sebelum FAMS mana pun.
      { id: 'IA', famc: [{ fam: 'FC' }] },
      { id: 'IB', fams: ['FB'] },
      { id: 'IC', fams: ['FA'] },
      { id: 'ID', fams: ['FB'] },
    ])

    // Urutan kemunculan pertama: FC (IA famc), FB (IB), FA (IC).
    expect(hasil.unions.map((u) => u.fam)).toEqual(['FC', 'FB', 'FA'])
    expect(hasil.unions.map((u) => u.spouses)).toEqual([[], ['IB', 'ID'], ['IC']])
    expect(hasil.personIds).toEqual(['IA', 'IB', 'IC', 'ID'])
  })

  it('kasus 7: fixture resmi remarriage2.ged, I1 dua pasangan sama di F1 dan F3', async () => {
    let teks: string
    try {
      teks = stripBom(await ambilRemarriage2())
    } catch (err) {
      teks = ''
      console.warn(`skip: ${String(err)}`)
      return
    }

    const indis = petakanIndi(teks)
    const byId = new Map(indis.map((i) => [i.id, i]))
    expect(byId.get('I1')?.fams).toEqual(['F1', 'F2', 'F3'])

    const hasil = buildFamilyGraph(indis)
    expect(hasil.unions.length).toBeGreaterThanOrEqual(2)

    const famsI1 = hasil.unions.filter((u) => byId.get('I1')?.fams?.includes(u.fam))
    expect(famsI1.length).toBeGreaterThanOrEqual(2)
    expect(famsI1.map((u) => u.fam)).toEqual(['F1', 'F2', 'F3'])

    const f1 = hasil.unions.find((u) => u.fam === 'F1')
    const f3 = hasil.unions.find((u) => u.fam === 'F3')
    expect(f1?.spouses).toEqual(['I1', 'I2'])
    expect(f3?.spouses).toEqual(['I1', 'I2'])
    expect(f1?.fam).not.toBe(f3?.fam)
    // I3 hanya di F2, tidak mencemari F1/F3.
    expect(f1?.spouses).not.toContain('I3')
    expect(f3?.spouses).not.toContain('I3')
  })

  it('kasus 8: multi anak campuran FAMS dan FAMC, union tidak duplikat', () => {
    const hasil = buildFamilyGraph([
      // F1: pasangan tua, anak-anaknya I3 dan I4 (satu FAMC-only).
      { id: 'I1', fams: [{ fam: 'F1', marr: '1970' }] },
      { id: 'I2', fams: [{ fam: 'F1', marr: '1970' }] },
      { id: 'I3', famc: [{ fam: 'F1', pedi: 'birth' }], fams: [{ fam: 'F2', marr: '1995' }] },
      { id: 'I4', famc: [{ fam: 'F1', famcStat: 'challenge' }], fams: ['F2'] },
    ])

    // Union: F1 (I1+I2, marr 1970), F2 (I3+I4).
    const fams = hasil.unions.map((u) => u.fam)
    expect(fams).toEqual(['F1', 'F2'])
    expect(new Set(fams).size).toBe(fams.length)
    expect(hasil.unions[0]).toEqual({ fam: 'F1', spouses: ['I1', 'I2'], marr: '1970' })
    expect(hasil.unions[1]).toEqual({ fam: 'F2', spouses: ['I3', 'I4'], marr: '1995' })

    // ParentEdge per anak benar, parents dua arah ke spouses F1.
    expect(hasil.parentEdges).toHaveLength(2)
    expect(hasil.parentEdges[0]).toEqual({ child: 'I3', fam: 'F1', parents: ['I1', 'I2'], pedi: 'birth' })
    expect(hasil.parentEdges[1]).toEqual({ child: 'I4', fam: 'F1', parents: ['I1', 'I2'], famcStat: 'challenge' })
    // Setiap orang tua muncul di sisi child dan parents.
    expect(hasil.personIds).toEqual(['I1', 'I2', 'I3', 'I4'])
  })
})
