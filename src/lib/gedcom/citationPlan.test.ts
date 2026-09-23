// Test builder rencana sitasi (v155-i): buildCitationPlanFromRecords di atas
// record GEDCStruct mentah hasil parse vendor (GEDCStruct.fromString dengan
// dialect g7ConfGEDC), pola yang sama dengan famcStat.test.ts.
//
// Kontrak yang dikunci: eventKind eksplisit per entry (BIRT vs DEAT pada
// individu sama terbedakan, MARR vs DIV pada family sama terbedakan), event
// tanpa SOUR terlewat otomatis (citationsOf return kosong), payload
// sourcePointer/page/quay/note verbatim byte-identical, multi SOUR per event
// jadi multi entry, input kosong hasil kosong, urutan file dipertahankan,
// memberId dari record INDI dan relationId dari record FAM.
//
// Purity: no DB, no env, no network, never throws.
import { describe, it, expect } from 'vitest'
import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js'
import { buildCitationPlanFromRecords } from './citationPlan'

/** Urai teks GEDCOM menjadi record top-level. */
function parse(gedcom: string): GEDCStruct[] {
  return GEDCStruct.fromString(gedcom, g7ConfGEDC)
}

/** Pisah record INDI dan FAM dari satu hasil parse. */
function split(records: GEDCStruct[]): {
  indi: GEDCStruct[]
  fam: GEDCStruct[]
} {
  return {
    indi: records.filter((r) => r.tag === 'INDI'),
    fam: records.filter((r) => r.tag === 'FAM'),
  }
}

/** Dokumen GEDCOM 7 minimal dengan HEAD dan TRLR. */
function doc(body: string[]): string {
  return ['0 HEAD', '1 GEDC', '2 VERS 7.0', ...body, '0 TRLR'].join('\n')
}

describe('buildCitationPlanFromRecords', () => {
  it('kosong: input kosong hasil kosong', () => {
    expect(buildCitationPlanFromRecords([], [])).toEqual([])
  })

  it('dokumen tanpa sitasi menghasilkan plan kosong', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 DATE 1 JAN 1970',
        '0 @F1@ FAM',
        '1 MARR',
        '2 DATE 1975',
      ]),
    )
    const { indi, fam } = split(records)
    expect(buildCitationPlanFromRecords(indi, fam)).toEqual([])
  })

  it('BIRT vs DEAT terbedakan pada individu sama, memberId terisi', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
        '3 PAGE h. 12',
        '1 DEAT',
        '2 SOUR @S2@',
        '3 PAGE h. 40',
        '0 @S1@ SOUR',
        '0 @S2@ SOUR',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(2)
    expect(plan[0]).toMatchObject({
      memberId: 'I1',
      relationId: undefined,
      eventKind: 'BIRT',
      sourcePointer: '@S1@',
      page: 'h. 12',
    })
    expect(plan[1]).toMatchObject({
      memberId: 'I1',
      relationId: undefined,
      eventKind: 'DEAT',
      sourcePointer: '@S2@',
      page: 'h. 40',
    })
    expect(plan[0].page).not.toBe(plan[1].page)
  })

  it('MARR vs DIV terbedakan pada family sama, relationId terisi', () => {
    const records = parse(
      doc([
        '0 @F1@ FAM',
        '1 MARR',
        '2 SOUR @S3@',
        '1 DIV',
        '2 SOUR @S4@',
        '0 @S3@ SOUR',
        '0 @S4@ SOUR',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(2)
    expect(plan[0]).toMatchObject({
      memberId: undefined,
      relationId: 'F1',
      eventKind: 'MARR',
      sourcePointer: '@S3@',
    })
    expect(plan[1]).toMatchObject({
      memberId: undefined,
      relationId: 'F1',
      eventKind: 'DIV',
      sourcePointer: '@S4@',
    })
  })

  it('event tanpa SOUR terlewat: BIRT tanpa SOUR di antara dua event bersitasi', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 DATE 1 JAN 1970',
        '1 DEAT',
        '2 SOUR @S1@',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(1)
    expect(plan[0]).toMatchObject({ memberId: 'I1', eventKind: 'DEAT' })
  })

  it('page/quay/note verbatim byte-identical termasuk karakter spasi dan kapitalisasi', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S9@',
        '3 PAGE  entri  ganda spasi  ',
        '3 QUAY 3',
        '3 NOTE Catatan: tetap apa adanya, tanpa ubah',
        '0 @S9@ SOUR',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(1)
    expect(plan[0].page).toBe('entri  ganda spasi  ')
    expect(plan[0].quay).toBe('3')
    expect(plan[0].note).toBe('Catatan: tetap apa adanya, tanpa ubah')
  })

  it('multi SOUR per event menjadi multi entry, urutan file dipertahankan', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
        '3 PAGE pertama',
        '2 SOUR @S2@',
        '3 PAGE kedua',
        '2 SOUR @S3@',
        '0 @S1@ SOUR',
        '0 @S2@ SOUR',
        '0 @S3@ SOUR',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan.map((e) => e.sourcePointer)).toEqual(['@S1@', '@S2@', '@S3@'])
    expect(plan.map((e) => e.page)).toEqual(['pertama', 'kedua', undefined])
  })

  it('determinisme urutan file: INDI sebelum FAM, urutan sub record dipertahankan', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 DEAT',
        '2 SOUR @S1@',
        '0 @I2@ INDI',
        '1 BIRT',
        '2 SOUR @S2@',
        '0 @F1@ FAM',
        '1 DIV',
        '2 SOUR @S3@',
        '0 @S1@ SOUR',
        '0 @S2@ SOUR',
        '0 @S3@ SOUR',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(
      plan.map((e) => [e.eventKind, e.sourcePointer].join(' ')),
    ).toEqual(['DEAT @S1@', 'BIRT @S2@', 'DIV @S3@'])
  })

  it('pointer ke record tak terdaftar jadi @VOID@ dan diteruskan apa adanya', () => {
    const records = parse(
      doc(['0 @I1@ INDI', '1 BIRT', '2 SOUR @NOPE@']),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(1)
    expect(plan[0].sourcePointer).toBe('@VOID@')
  })

  it('payload non-pointer pada SOUR diteruskan apa adanya', () => {
    const records = parse(
      doc(['0 @I1@ INDI', '1 BIRT', '2 SOUR bukan pointer']),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(1)
    expect(plan[0].sourcePointer).toBe('bukan pointer')
  })

  it('record non-INDI/non-FAM diabaikan, hanya tag relevan yang dipindai', () => {
    const records = parse(
      doc([
        '0 @S1@ SOUR',
        '1 TITL Akta',
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
      ]),
    )
    const indi = records.filter((r) => r.tag === 'INDI')
    const fam = records.filter((r) => r.tag === 'FAM')
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan).toHaveLength(1)
    expect(plan[0].memberId).toBe('I1')
  })

  it('gabungan INDI dan FAM sekaligus: urutan INDI dulu lalu FAM', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
        '0 @F1@ FAM',
        '1 MARR',
        '2 SOUR @S2@',
      ]),
    )
    const { indi, fam } = split(records)
    const plan = buildCitationPlanFromRecords(indi, fam)
    expect(plan.map((e) => e.eventKind)).toEqual(['BIRT', 'MARR'])
    expect(plan[0].memberId).toBe('I1')
    expect(plan[0].relationId).toBeUndefined()
    expect(plan[1].memberId).toBeUndefined()
    expect(plan[1].relationId).toBe('F1')
  })

  it('dipanggil dua kali pada input sama hasil identik (determinisme)', () => {
    const records = parse(
      doc([
        '0 @I1@ INDI',
        '1 BIRT',
        '2 SOUR @S1@',
        '1 DEAT',
        '2 SOUR @S2@',
        '0 @F1@ FAM',
        '1 MARR',
        '2 SOUR @S3@',
        '1 DIV',
        '2 SOUR @S4@',
      ]),
    )
    const { indi, fam } = split(records)
    const a = buildCitationPlanFromRecords(indi, fam)
    const b = buildCitationPlanFromRecords(indi, fam)
    expect(a).toEqual(b)
    expect(a).toHaveLength(4)
  })
})
