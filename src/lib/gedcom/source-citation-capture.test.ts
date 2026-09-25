// Characterization tests untuk capture sitasi event-level GEDCOM 7 (v151-i/ii).
//
// Kontrak yang didokumentasikan APA ADANYA sejak v151-ii (commit d2c632c):
// jalur import importIndividuals/importFamilies menyimpan sitasi SOUR
// event-level di citations[] (ParsedCitation dari citation.ts). Payload
// diteruskan verbatim tanpa normalisasi, disiplin yang sama dengan RESN
// dan noAssertions:
//   - sourcePointer: '@<xref>@' untuk pointer terdaftar, '@VOID@' untuk
//     pointer ke record tak terdaftar (vendor men-null-kan payload di
//     fixPtrs), payload non-pointer diteruskan apa adanya.
//   - page/quay/note: payload string sub-struktur PAGE/QUAY/NOTE di bawah
//     SOUR masing-masing, verbatim; undefined bila absen. NOTE yang
//     digantung langsung di bawah event (bukan di bawah SOUR) tidak
//     masuk citations.
//   - Urutan file dipertahankan per event, dan wiring menggabungkan BIRT
//     lalu DEAT (MARR lalu DIV) pada satu record.
//   - SOUR tanpa sub-struktur tetap masuk daftar, pointer saja.
//
// Pola test: parser teks langsung ke fungsi pure, fixture inline string
// GEDCOM 7. Purity: no DB, no env, no network, never throws.
import { describe, it, expect } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'

function ged(lines: string[]): string {
  return ['0 HEAD', '1 GEDC', '2 VERS 7.0', ...lines, '0 TRLR'].join('\n')
}

/** Key set hasil import INDI apa adanya sejak v151-ii: citations ikut. */
const INDI_KEYS = [
  'birthDate',
  'birthPlace',
  'citations',
  'deathDate',
  'deathPlace',
  'name',
  'noAssertions',
  'resn',
  'sex',
  'xref',
]

/** Key set hasil import FAM apa adanya sejak v151-ii: citations ikut. */
const FAM_KEYS = [
  'childLinks',
  'children',
  'citations',
  'divorceDate',
  'husband',
  'marriageDate',
  'marriagePlace',
  'noAssertions',
  'resn',
  'wife',
  'xref',
]

describe('source citation capture (v151-i)', () => {
  it('2 SOUR di bawah 1 BIRT tersimpan verbatim di citations: PAGE dan QUAY ikut', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 NAME Budi',
        '1 BIRT',
        '2 DATE 12 JAN 1900',
        '2 PLAC Surabaya',
        '2 SOUR @S1@',
        '3 PAGE halaman 12',
        '3 QUAY 3',
        '2 SOUR @S2@',
        '3 PAGE entri atas',
        '3 QUAY 1',
        '0 @S1@ SOUR',
        '1 TITL Akta kelahiran 1900',
        '0 @S2@ SOUR',
        '1 TITL Register gereja',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].name).toBe('Budi')
    expect(indis[0].birthDate).toEqual({
      dateKind: 'EXACT',
      year: 1900,
      month: 1,
      day: 12,
      originalDateString: '12 JAN 1900',
    })
    expect(indis[0].birthPlace).toBe('Surabaya')
    expect(indis[0].citations).toEqual([
      { sourcePointer: '@S1@', page: 'halaman 12', quay: '3' },
      { sourcePointer: '@S2@', page: 'entri atas', quay: '1' },
    ])
    expect(Object.keys(indis[0]).sort()).toEqual(INDI_KEYS)
  })

  it('NOTE di bawah SOUR DEAT masuk citations.note verbatim; NOTE event-level tidak ikut', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 DEAT',
        '2 DATE 2 FEB 1950',
        '2 PLAC Jakarta',
        '2 SOUR @S1@',
        '3 NOTE dimakamkan di tanah keluarga',
        '2 NOTE catatan langsung di event kematian',
        '0 @S1@ SOUR',
        '1 TITL Surat kematian',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].deathDate).toMatchObject({
      year: 1950,
      originalDateString: '2 FEB 1950',
    })
    expect(indis[0].deathPlace).toBe('Jakarta')
    // NOTE di bawah SOUR tersimpan verbatim; toEqual penuh mengunci bahwa
    // NOTE yang digantung langsung di bawah DEAT tidak menyusup ke daftar.
    expect(indis[0].citations).toEqual([
      {
        sourcePointer: '@S1@',
        note: 'dimakamkan di tanah keluarga',
      },
    ])
    // NOTE event-level bukan NO: jalur no-assertion tidak menyentuhnya.
    expect(indis[0].noAssertions).toEqual([])
  })

  it('MARR level FAM: SOUR dengan PAGE, QUAY, dan NOTE tercapture di family.citations', () => {
    const fams = importFamilies(
      ged([
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 MARR',
        '2 DATE 20 JUN 1925',
        '2 PLAC Bandung',
        '2 SOUR @S1@',
        '3 PAGE nomor 44',
        '3 QUAY 2',
        '3 NOTE tercatat di buku gereja',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
        '0 @S1@ SOUR',
      ]),
    )
    expect(fams).toHaveLength(1)
    expect(fams[0].husband).toBe('I1')
    expect(fams[0].wife).toBe('I2')
    expect(fams[0].marriageDate).toMatchObject({
      year: 1925,
      originalDateString: '20 JUN 1925',
    })
    expect(fams[0].marriagePlace).toBe('Bandung')
    expect(fams[0].noAssertions).toEqual([])
    expect(fams[0].citations).toEqual([
      {
        sourcePointer: '@S1@',
        page: 'nomor 44',
        quay: '2',
        note: 'tercatat di buku gereja',
      },
    ])
    expect(Object.keys(fams[0]).sort()).toEqual(FAM_KEYS)
  })

  it('QUAY non-standar diteruskan apa adanya tanpa normalisasi', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
        '3 QUAY tinggi sekali',
        '0 @S1@ SOUR',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].citations).toEqual([
      { sourcePointer: '@S1@', quay: 'tinggi sekali' },
    ])
  })

  it('satu individu BIRT dan DEAT multi-SOUR: urutan file dipertahankan, BIRT dulu lalu DEAT', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
        '2 SOUR @S2@',
        '1 DEAT',
        '2 SOUR @S3@',
        '0 @S1@ SOUR',
        '0 @S2@ SOUR',
        '0 @S3@ SOUR',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].citations).toEqual([
      { sourcePointer: '@S1@' },
      { sourcePointer: '@S2@' },
      { sourcePointer: '@S3@' },
    ])
  })

  it('SOUR tanpa sub-struktur tetap masuk daftar dengan pointer saja', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 DATE 3 MAR 1901',
        '2 SOUR @S1@',
        '0 @S1@ SOUR',
        '1 TITL Arsip paroki',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].citations).toEqual([{ sourcePointer: '@S1@' }])
  })

  it('pointer ke record tak terdaftar menghasilkan @VOID@', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 DEAT',
        '2 SOUR @S9@',
        '3 PAGE halaman hantu',
      ]),
    )
    expect(indis).toHaveLength(1)
    // Vendor men-null-kan payload pointer yang gagal diresolusi; helper
    // citation memetakannya ke '@VOID@'. Sub-struktur tetap ikut verbatim.
    expect(indis[0].citations).toEqual([
      { sourcePointer: '@VOID@', page: 'halaman hantu' },
    ])
  })

  it('MARR dan DIV pada satu FAM: SOUR berbeda per event, MARR dulu lalu DIV', () => {
    const fams = importFamilies(
      ged([
        '0 @F1@ FAM',
        '1 HUSB @I1@',
        '1 WIFE @I2@',
        '1 MARR',
        '2 DATE 20 JUN 1925',
        '2 SOUR @S1@',
        '3 PAGE hlm 7',
        '1 DIV',
        '2 DATE 5 OCT 1940',
        '2 SOUR @S2@',
        '3 QUAY 0',
        '0 @I1@ INDI',
        '0 @I2@ INDI',
        '0 @S1@ SOUR',
        '0 @S2@ SOUR',
      ]),
    )
    expect(fams).toHaveLength(1)
    expect(fams[0].marriageDate).toMatchObject({ year: 1925 })
    expect(fams[0].divorceDate).toMatchObject({ year: 1940 })
    expect(fams[0].citations).toEqual([
      { sourcePointer: '@S1@', page: 'hlm 7' },
      { sourcePointer: '@S2@', quay: '0' },
    ])
  })

  it('kasus negative: event tanpa SOUR menghasilkan citations kosong dan serialized bersih token sitasi', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 NAME Siti',
        '1 BIRT',
        '2 DATE 1 APR 1930',
        '2 PLAC Semarang',
        '1 DEAT',
        '2 DATE 6 MAY 2000',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].birthDate).toMatchObject({ year: 1930 })
    expect(indis[0].deathDate).toMatchObject({ year: 2000 })
    expect(indis[0].citations).toEqual([])
    expect(Object.keys(indis[0]).sort()).toEqual(INDI_KEYS)
    const serialized = JSON.stringify(indis[0])
    for (const token of ['SOUR', 'PAGE', 'QUAY', 'S1']) {
      expect(serialized).not.toContain(token)
    }
  })
})
