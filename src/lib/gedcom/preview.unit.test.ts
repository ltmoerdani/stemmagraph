// Unit test v417 fase 1 (AC4): walker entri gate line-aware, pilah
// IncomingRecord, validasi unggahan multipart, dan pemetaan ringkasan
// preview. Tanpa DB, tanpa server, tanpa filesystem.
import { describe, expect, it } from 'vitest';
import { zipSync } from 'fflate';
import { gateEntriesFromGedcom } from './previewGateEntries';
import { incomingRecordsFromGedcom } from './previewIncoming';
import { buildPreviewSummary } from './previewSummary';
import { looksLikeGedcom, parseGedcomUpload } from './previewUpload';
import type { MergePlan, MergePlanEntry } from './importMergePlan';

const GEDCOM_DUA_INDI = [
  '0 HEAD',
  '1 GEDC',
  '2 VERS 7.0',
  '1 CHAR UTF-8',
  '0 @I1@ INDI',
  '1 NAME Nama Pertama',
  '0 @I2@ INDI',
  '1 NAME Nama Kedua',
  '1 SEX F',
  '0 TRLR',
].join('\n');

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

/** Builder multipart minimal per RFC 2045, deterministik untuk test. */
function multipartBody(fileName: string | null, bytes: Uint8Array, fieldName = 'file'): { raw: Uint8Array; contentType: string } {
  const boundary = 'rakatestboundary7351';
  const head =
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${fieldName}"` +
    (fileName !== null ? `; filename="${fileName}"` : '') +
    (fileName !== null ? `\r\nContent-Type: application/octet-stream` : '') +
    `\r\n\r\n`;
  const tail = `\r\n--${boundary}--\r\n`;
  const raw = new Uint8Array(enc(head).length + bytes.length + enc(tail).length);
  raw.set(enc(head), 0);
  raw.set(bytes, enc(head).length);
  raw.set(enc(tail), enc(head).length + bytes.length);
  return { raw, contentType: `multipart/form-data; boundary=${boundary}` };
}

function mergePlanOf(entries: Array<Partial<MergePlanEntry>>): MergePlan {
  const full: MergePlanEntry[] = entries.map((e) => ({
    source: 'INDI',
    incomingXref: 'I1',
    newInternalId: '@M1@',
    status: 'NEW',
    extensionPayloads: [],
    ...e,
  }));
  return { entries: full, xrefMap: {}, skipped: [] };
}

describe('gateEntriesFromGedcom (line-aware)', () => {
  it('memetakan HEAD, sub struktur, dan record dengan nomor baris nyata', () => {
    const entries = gateEntriesFromGedcom(GEDCOM_DUA_INDI);
    const head = entries.find((e) => e.tag === 'HEAD');
    expect(head?.line).toBe(1);
    expect(head?.superstructureUri).toBe('');
    const gedc = entries.find((e) => e.tag === 'GEDC');
    expect(gedc?.line).toBe(2);
    expect(gedc?.superstructureUri).toContain('HEAD');
    const vers = entries.find((e) => e.tag === 'VERS');
    expect(vers?.line).toBe(3);
    const name1 = entries.filter((e) => e.tag === 'NAME');
    expect(name1.map((e) => e.line)).toEqual([6, 8]);
    const indi = entries.filter((e) => e.tag === 'INDI');
    expect(indi.map((e) => e.line)).toEqual([5, 7]);
  });

  it('baris xref @I1@ INDI tetap terbaca tag INDI, bukan xref', () => {
    const entries = gateEntriesFromGedcom('0 @I1@ INDI\n1 NAME X');
    expect(entries[0]?.tag).toBe('INDI');
  });

  it('anak dari induk tak dikenal tidak menghasilkan reject berantai', () => {
    // BOGUS bukan struktur GEDCOM 7; CONTINUATION di bawahnya tak dilaporkan.
    const entries = gateEntriesFromGedcom('0 HEAD\n1 BOGUS\n2 ALSONOT');
    const tags = entries.map((e) => e.tag);
    expect(tags).toContain('HEAD');
    expect(tags).toContain('BOGUS');
    expect(tags).not.toContain('ALSONOT');
  });
});

describe('incomingRecordsFromGedcom', () => {
  it('memilah INDI dan FAM level 0, abaikan HEAD dan TRLR', () => {
    const text = GEDCOM_DUA_INDI + '\n0 @F1@ FAM\n1 HUSB @I1@';
    const records = incomingRecordsFromGedcom(text);
    expect(records.map((r) => r.source)).toEqual(['INDI', 'INDI', 'FAM']);
    expect(records.map((r) => r.xref)).toEqual(['I1', 'I2', 'F1']);
  });

  it('identitas durable ikut terekstrak dari baris record (UID, EXID+TYPE, REFN)', () => {
    const text = [
      '0 HEAD',
      '0 @I1@ INDI',
      '1 NAME A',
      '1 UID UID-9',
      '1 EXID EX-1',
      '2 TYPE FamilySearch ID',
      '1 REFN R-7',
      '0 TRLR',
    ].join('\n');
    const records = incomingRecordsFromGedcom(text);
    expect(records).toHaveLength(1);
    expect(records[0]?.uid).toBe('UID-9');
    expect(records[0]?.refn).toBe('R-7');
    expect(records[0]?.exids).toEqual([{ value: 'EX-1', type: 'FamilySearch ID' }]);
  });

  it('record tanpa identitas durable tetap menghasilkan exids kosong', () => {
    const records = incomingRecordsFromGedcom(GEDCOM_DUA_INDI);
    expect(records[0]?.exids).toEqual([]);
    expect(records[0]?.uid).toBeUndefined();
    expect(records[0]?.refn).toBeUndefined();
  });
});

describe('parseGedcomUpload', () => {
  it('file .ged sah: nama dan byte utuh dikembalikan', () => {
    const { raw, contentType } = multipartBody('silsilah.ged', enc(GEDCOM_DUA_INDI));
    const result = parseGedcomUpload(raw, contentType);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fileName).toBe('silsilah.ged');
      expect(new TextDecoder().decode(result.bytes)).toBe(GEDCOM_DUA_INDI);
    }
  });

  it('file .gdz sah diterima dengan nama lengkap', () => {
    const zip = zipSync({ 'gedcom.ged': enc(GEDCOM_DUA_INDI) });
    const { raw, contentType } = multipartBody('arsip.gdz', zip);
    const result = parseGedcomUpload(raw, contentType);
    expect(result.ok).toBe(true);
  });

  it('tanpa part file: NO_FILE', () => {
    const { raw, contentType } = multipartBody(null, enc('x'), 'catatan');
    const result = parseGedcomUpload(raw, contentType);
    expect(result).toEqual({ ok: false, reason: 'NO_FILE' });
  });

  it('ekstensi selain .ged/.gdz: BAD_EXTENSION', () => {
    const { raw, contentType } = multipartBody('gambar.png', enc('x'));
    const result = parseGedcomUpload(raw, contentType);
    expect(result).toEqual({ ok: false, reason: 'BAD_EXTENSION' });
  });
});

describe('looksLikeGedcom', () => {
  it('dokumen dengan HEAD level 0 lolos', () => {
    expect(looksLikeGedcom(GEDCOM_DUA_INDI)).toBe(true);
  });

  it('isi acak tanpa HEAD ditolak', () => {
    expect(looksLikeGedcom('ini bukan gedcom, cuma teks')).toBe(false);
  });
});

describe('buildPreviewSummary (pemetaan ringkasan AC2)', () => {
  it('menghitung NEW, MATCH_CANDIDATE, SKIPPED, gateReject, livingAffected', () => {
    const plan = mergePlanOf([
      { status: 'NEW' },
      { status: 'NEW' },
      { status: 'MATCH_CANDIDATE' },
      { status: 'SKIPPED', skipReason: 'invalid-record' },
    ]);
    expect(buildPreviewSummary(plan, 3, 2)).toEqual({
      total: 4,
      new: 2,
      matchCandidate: 1,
      skipped: 1,
      gateRejectCount: 3,
      livingAffected: 2,
    });
  });

  it('plan kosong: semua nol, tidak pernah melempar', () => {
    expect(buildPreviewSummary(mergePlanOf([]), 0, 0)).toEqual({
      total: 0,
      new: 0,
      matchCandidate: 0,
      skipped: 0,
      gateRejectCount: 0,
      livingAffected: 0,
    });
  });
});
