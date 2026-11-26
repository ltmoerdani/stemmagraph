import { describe, it, expect } from 'vitest';
import {
  parseTagLine,
  formatTagLine,
  parseGedcomDocument,
} from './tagLinePayload';

describe('tagLinePayload: payload kosong dan delimiter spasi (STG v465 unit B)', () => {
  it("baris '1 SOUR' tanpa payload sah dengan payload undefined", () => {
    const parsed = parseTagLine('1 SOUR');
    expect(parsed).not.toBeNull();
    expect(parsed?.level).toBe(1);
    expect(parsed?.tag).toBe('SOUR');
    expect(parsed?.payload).toBeUndefined();
  });

  it("baris '1 SOUR  ' spasi ekor adalah delimiter plus payload kosong", () => {
    const parsed = parseTagLine('1 SOUR  ');
    expect(parsed).not.toBeNull();
    expect(parsed?.level).toBe(1);
    expect(parsed?.tag).toBe('SOUR');
    expect(parsed?.payload).toBeUndefined();
  });

  it("baris '1  SOUR' spasi ganda lenient, dicoalesce satu delimiter", () => {
    const parsed = parseTagLine('1  SOUR');
    expect(parsed).not.toBeNull();
    expect(parsed?.level).toBe(1);
    expect(parsed?.tag).toBe('SOUR');
    expect(parsed?.payload).toBeUndefined();
  });

  it('spasi di dalam payload dipertahankan, hanya delimiter yang coalesce', () => {
    const parsed = parseTagLine('1 NOTE  dua  spasi');
    expect(parsed).not.toBeNull();
    expect(parsed?.tag).toBe('NOTE');
    expect(parsed?.payload).toBe('dua  spasi');
  });

  it('baris level saja tanpa tag pulang null, tanpa error', () => {
    expect(parseTagLine('1')).toBeNull();
    expect(parseTagLine('bukan baris gedcom')).toBeNull();
    expect(parseTagLine('')).toBeNull();
  });

  it('roundtrip baris tag tanpa payload tidak merusak struktur', () => {
    expect(formatTagLine(parseTagLine('1 SOUR') ?? fail())).toBe('1 SOUR');
    expect(formatTagLine(parseTagLine('1 SOUR  ') ?? fail())).toBe('1 SOUR');
    expect(formatTagLine(parseTagLine('1  SOUR') ?? fail())).toBe('1 SOUR');
    expect(formatTagLine(parseTagLine('0 @I1@ INDI') ?? fail())).toBe(
      '0 @I1@ INDI',
    );
  });

  it('regresi: dokumen kecil HEAD + satu individu + TRLR roundtrip identik', () => {
    const doc = [
      '0 HEAD',
      '1 SOUR',
      '2 NAME test',
      '0 @I1@ INDI',
      '1 NAME /Test/',
      '1 SEX M',
      '0 TRLR',
    ].join('\n');
    const parsed = parseGedcomDocument(doc);
    expect(parsed).toHaveLength(7);
    expect(parsed[0]).toEqual({
      level: 0,
      xref: undefined,
      tag: 'HEAD',
      payload: undefined,
    });
    expect(parsed[1]?.tag).toBe('SOUR');
    expect(parsed[1]?.payload).toBeUndefined();
    expect(parsed[2]?.payload).toBe('test');
    expect(parsed[3]).toEqual({
      level: 0,
      xref: 'I1',
      tag: 'INDI',
      payload: undefined,
    });
    const exported = parsed.map(formatTagLine).join('\n');
    expect(exported).toBe(doc);
  });
});
