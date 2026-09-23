// Characterization tests untuk capture sitasi event-level GEDCOM 7 (v151-i).
//
// Kontrak yang didokumentasikan APA ADANYA (bukan keinginan): jalur import
// importIndividuals/importFamilies saat ini MEMBUANG baris SOUR, NOTE, dan
// SNOTE di bawah event (BIRT/DEAT/MARR). Tidak ada field sitasi di
// ImportedIndividual maupun ImportedFamily. Tes di bawah membuktikan
// absensi itu secara eksplisit (key set + serialized scan) sekaligus
// memastikan field event yang memang dipetakan (DATE/PLAC) tetap benar.
//
// Kontras disiplin verbatim yang SUDAH ada: RESN (baris 50) dan NO (baris
// 85, via noLinesOf) diteruskan byte-exact tanpa normalisasi, sementara
// payload sitasi dibuang utuh. Asimetri ini ikut dikunci di sini.
//
// Pola test: gabungan gaya no-assertion.test.ts dan
// no-assertion-import-wiring.test.ts: parser teks langsung ke fungsi pure,
// fixture inline string GEDCOM 7. Purity: no DB, no env, no network,
// never throws.
import { describe, it, expect } from 'vitest'
import { importIndividuals } from './importIndividuals'
import { importFamilies } from './importFamilies'

function ged(lines: string[]): string {
  return ['0 HEAD', '1 GEDC', '2 VERS 7.0', ...lines, '0 TRLR'].join('\n')
}

/** Key set hasil import INDI apa adanya hari ini: tanpa field sitasi. */
const INDI_KEYS = [
  'birthDate',
  'birthPlace',
  'deathDate',
  'deathPlace',
  'name',
  'noAssertions',
  'resn',
  'sex',
  'xref',
]

describe('source citation capture (v151-i)', () => {
  it('2 SOUR pointer di bawah 1 BIRT dengan PAGE dan QUAY tersub tidak tersimpan', () => {
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
    // Event yang memang dipetakan tetap benar meski sitasi dibuang.
    expect(indis[0].name).toBe('Budi')
    expect(indis[0].birthDate).toEqual({
      dateKind: 'EXACT',
      year: 1900,
      month: 1,
      day: 12,
      originalDateString: '12 JAN 1900',
    })
    expect(indis[0].birthPlace).toBe('Surabaya')
    // Absensi eksplisit: tidak ada field sitasi baru di hasil import.
    expect(Object.keys(indis[0]).sort()).toEqual(INDI_KEYS)
    const serialized = JSON.stringify(indis[0])
    for (const token of ['S1', 'S2', 'PAGE', 'QUAY', 'SOUR', 'halaman 12']) {
      expect(serialized).not.toContain(token)
    }
  })

  it('2 NOTE di bawah 1 DEAT tidak tersimpan dan tidak menyusup ke noAssertions', () => {
    const indis = importIndividuals(
      ged([
        '0 @I1@ INDI',
        '1 DEAT',
        '2 DATE 2 FEB 1950',
        '2 PLAC Jakarta',
        '2 NOTE meninggal karena sakit',
        '2 NOTE dimakamkan di tanah keluarga',
      ]),
    )
    expect(indis).toHaveLength(1)
    expect(indis[0].deathDate).toMatchObject({
      year: 1950,
      originalDateString: '2 FEB 1950',
    })
    expect(indis[0].deathPlace).toBe('Jakarta')
    // NOTE event-level bukan NO: jalur no-assertion tidak menyentuhnya.
    expect(indis[0].noAssertions).toEqual([])
    const serialized = JSON.stringify(indis[0])
    expect(serialized).not.toContain('meninggal karena sakit')
    expect(serialized).not.toContain('dimakamkan di tanah keluarga')
    expect(Object.keys(indis[0]).sort()).toEqual(INDI_KEYS)
  })

  it('MARR level FAM: SOUR dengan PAGE, QUAY, dan NOTE tidak tersimpan', () => {
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
        '2 NOTE pernikahan tercatat gereja',
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
    expect(Object.keys(fams[0]).sort()).toEqual([
      'children',
      'divorceDate',
      'husband',
      'marriageDate',
      'marriagePlace',
      'noAssertions',
      'resn',
      'wife',
      'xref',
    ])
    const serialized = JSON.stringify(fams[0])
    for (const token of ['S1', 'nomor 44', 'QUAY', 'tercatat gereja']) {
      expect(serialized).not.toContain(token)
    }
  })
})
