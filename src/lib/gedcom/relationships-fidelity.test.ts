// Test karakterisasi fidelitas relasi non-inti GEDCOM 7 (GOAL v159 fase i).
// BUKAN spesifikasi keinginan: tiap kasus mengunci perilaku parser vendor
// (GEDCStruct.fromString dengan g7ConfGEDC) SAAT INI terhadap FAMC-STAT,
// CHIL-PEDI, dan ADOP/ADOP-FAMC, dengan komentar status aktual
// (utuh / sebagian / hilang / diabaikan).
// Sumber enumset terverifikasi 25 Sep (spec 7.0.18):
// FAMC-STAT = CHALLENGED | DISPROVEN | PROVEN; PEDI = ADOPTED | BIRTH |
// FOSTER | SEALING | OTHER; ADOP = HUSB | WIFE | BOTH; ADOP-FAMC 0:1 pointer.
import { describe, expect, it } from 'vitest';
import { GEDCStruct, g7ConfGEDC } from './vendor/gedcstruct.js';

const QUIET = () => {};

function parse(ged: string): GEDCStruct[] {
  return GEDCStruct.fromString(ged, g7ConfGEDC, QUIET);
}

const HEAD = '0 HEAD\n1 GEDC\n2 VERS 7.0\n';

function sub(record: GEDCStruct, tag: string): GEDCStruct | undefined {
  return record.sub.find((s) => s.tag === tag);
}

function subSub(record: GEDCStruct, parent: string, tag: string): GEDCStruct | undefined {
  const p = sub(record, parent);
  return p ? p.sub.find((s) => s.tag === tag) : undefined;
}

describe('karakterisasi parser GEDCOM 7: relasi non-inti (v159-i)', () => {
  it('kasus 1: FAMC STAT 3 nilai resmi terbaca utuh sebagai payload string', () => {
    // Aktual: parser vendor menyimpan baris STAT sebagai substructure dengan payload string.
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n2 STAT PROVEN\n0 @F1@ FAM\n1 CHIL @I1@\n0 TRLR\n';
    const recs = parse(ged);
    const indi = recs.find((r) => r.tag === 'INDI');
    expect(indi).toBeDefined();
    const famc = sub(indi!, 'FAMC');
    expect(famc).toBeDefined();
    const stat = sub(famc!, 'STAT');
    expect(stat?.payload).toBe('PROVEN');
  });

  it('kasus 2: FAMC STAT CHALLENGED dan DISPROVEN juga terbaca utuh', () => {
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n2 STAT CHALLENGED\n0 @F2@ INDI\n1 FAMC @F1@\n2 STAT DISPROVEN\n0 @F1@ FAM\n1 CHIL @I1@\n0 TRLR\n';
    const recs = parse(ged);
    const indis = recs.filter((r) => r.tag === 'INDI');
    expect(indis).toHaveLength(2);
    const s1 = subSub(indis[0]!, 'FAMC', 'STAT');
    const s2 = subSub(indis[1]!, 'FAMC', 'STAT');
    expect(s1?.payload).toBe('CHALLENGED');
    expect(s2?.payload).toBe('DISPROVEN');
  });

  it('kasus 3: FAMC STAT nilai tak dikenal (FOO) tetap tersimpan (parser vendor tanpa validasi enum)', () => {
    // Aktual: GEDCStruct vendor tidak memvalidasi enumset; nilai FOO tersimpan apa adanya.
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n2 STAT FOO\n0 @F1@ FAM\n1 CHIL @I1@\n0 TRLR\n';
    const recs = parse(ged);
    const indi = recs.find((r) => r.tag === 'INDI');
    const stat = subSub(indi!, 'FAMC', 'STAT');
    expect(stat?.payload).toBe('FOO');
  });

  it('kasus 4: FAMC STAT phrase (_PHRASE) tersimpan utuh termasuk underscore', () => {
    // Aktual: phrase GEDCOM 7 ditulis dengan leading underscore, parser menyimpan teks apa adanya.
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n2 STAT _kira-kira\n0 @F1@ FAM\n1 CHIL @I1@\n0 TRLR\n';
    const recs = parse(ged);
    const indi = recs.find((r) => r.tag === 'INDI');
    const stat = subSub(indi!, 'FAMC', 'STAT');
    expect(stat?.payload).toBe('_kira-kira');
  });

  it('kasus 5: CHIL PEDI 5 nilai resmi terbaca utuh di sisi FAM', () => {
    // Aktual: PEDI ditempatkan di bawah CHIL dalam record FAM dan tersimpan sebagai payload string.
    const pedis = ['ADOPTED', 'BIRTH', 'FOSTER', 'SEALING', 'OTHER'];
    const famLines = pedis.map((p, i) => `0 @F${i}@ FAM\n1 CHIL @I${i}@\n2 PEDI ${p}\n`).join('');
    const indiLines = pedis.map((_, i) => `0 @I${i}@ INDI\n1 FAMC @F${i}@\n`).join('');
    const ged = HEAD + famLines + indiLines + '0 TRLR\n';
    const recs = parse(ged);
    const fams = recs.filter((r) => r.tag === 'FAM');
    expect(fams).toHaveLength(5);
    pedis.forEach((p, i) => {
      const chil = sub(fams[i]!, 'CHIL');
      const pedi = sub(chil!, 'PEDI');
      expect(pedi?.payload).toBe(p);
    });
  });

  it('kasus 6: CHIL PEDI tak dikenal dan phrase tersimpan apa adanya (tanpa validasi enum)', () => {
    const ged = HEAD + '0 @F1@ FAM\n1 CHIL @I1@\n2 PEDI FOO\n0 @F2@ FAM\n1 CHIL @I2@\n2 PEDI _dianggap\n0 @I1@ INDI\n1 FAMC @F1@\n0 @I2@ INDI\n1 FAMC @F2@\n0 TRLR\n';
    const recs = parse(ged);
    const fams = recs.filter((r) => r.tag === 'FAM');
    expect(sub(sub(fams[0]!, 'CHIL')!, 'PEDI')?.payload).toBe('FOO');
    expect(sub(sub(fams[1]!, 'CHIL')!, 'PEDI')?.payload).toBe('_dianggap');
  });

  it('kasus 7: ADOP dengan FAMC pointer dan sub ADOP HUSB/WIFE/BOTH tersimpan di INDI', () => {
    // Aktual: struktur ADOP-FAMC adalah 1 ADOP berisi 1 FAMC pointer; parser
    // menyimpannya sebagai substructure dengan payload pointer ter-resolve atau
    // struktur, keduanya tetap dapat dilalui lewat tag.
    const ged = HEAD + '0 @I1@ INDI\n1 ADOP\n2 FAMC @F1@\n3 ADOP BOTH\n0 @F1@ FAM\n1 CHIL @I1@\n0 TRLR\n';
    const recs = parse(ged);
    const indi = recs.find((r) => r.tag === 'INDI');
    const adop = sub(indi!, 'ADOP');
    expect(adop).toBeDefined();
    const famcInAdop = sub(adop!, 'FAMC');
    expect(famcInAdop).toBeDefined();
    const adopVal = sub(famcInAdop!, 'ADOP');
    expect(adopVal?.payload).toBe('BOTH');
  });

  it('kasus 8: satu INDI dengan dua FAMC pointer (dua keluarga) keduanya terbaca', () => {
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n1 FAMC @F2@\n0 @F1@ FAM\n1 CHIL @I1@\n0 @F2@ FAM\n1 CHIL @I1@\n0 TRLR\n';
    const recs = parse(ged);
    const indi = recs.find((r) => r.tag === 'INDI');
    const famcs = indi!.sub.filter((s) => s.tag === 'FAMC');
    expect(famcs).toHaveLength(2);
  });

  it('kasus 9: round-trip parse lalu serialize mempertahankan baris STAT dan PEDI byte-identik', () => {
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n2 STAT PROVEN\n0 @F1@ FAM\n1 CHIL @I1@\n2 PEDI ADOPTED\n0 TRLR\n';
    const recs = parse(ged);
    const out = (recs as unknown as { toString(newline?: string): string }).toString();
    const statLine = out.split('\n').find((l) => l.includes('STAT'));
    const pediLine = out.split('\n').find((l) => l.includes('PEDI'));
    // Aktual: serialisasi vendor mempertahankan konten baris STAT/PEDI persis.
    expect(statLine?.trim()).toBe('2 STAT PROVEN');
    expect(pediLine?.trim()).toBe('2 PEDI ADOPTED');
  });

  it('kasus 10: dua arah STAT (sisi INDI) dan PEDI (sisi FAM) terbaca bersamaan dalam satu dokumen', () => {
    const ged = HEAD + '0 @I1@ INDI\n1 FAMC @F1@\n2 STAT DISPROVEN\n0 @F1@ FAM\n1 CHIL @I1@\n2 PEDI FOSTER\n0 TRLR\n';
    const recs = parse(ged);
    const indi = recs.find((r) => r.tag === 'INDI');
    const fam = recs.find((r) => r.tag === 'FAM');
    expect(subSub(indi!, 'FAMC', 'STAT')?.payload).toBe('DISPROVEN');
    expect(sub(sub(fam!, 'CHIL')!, 'PEDI')?.payload).toBe('FOSTER');
  });
});
