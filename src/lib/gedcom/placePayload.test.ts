import { describe, expect, it } from 'vitest';
import { placePayload } from './placePayload';

const c = (...codes: number[]) => String.fromCodePoint(...codes);

describe('placePayload', () => {
  it('trim ujung', () => {
    expect(placePayload('  Surabaya  ')).toBe('Surabaya');
  });

  it('collapse spasi ganda internal jadi satu spasi', () => {
    expect(placePayload('Jakarta  Selatan')).toBe('Jakarta Selatan');
    expect(placePayload('Bandung     Barat')).toBe('Bandung Barat');
  });

  it('tab dan newline dibersihkan jadi satu spasi', () => {
    expect(placePayload('Jakarta\tSelatan')).toBe('Jakarta Selatan');
    expect(placePayload('Yogyakarta\nDKI')).toBe('Yogyakarta DKI');
    expect(placePayload('A\r\nB')).toBe('A B');
  });

  it('karakter kontrol Cc dibuang', () => {
    expect(placePayload(`Bekasi${c(0x00)}Timur`)).toBe('BekasiTimur');
    expect(placePayload(`Depok${c(0x01)}Kota`)).toBe('DepokKota');
    expect(placePayload(`Bogor${c(0x1f)}Barat`)).toBe('BogorBarat');
    expect(placePayload(`Tangerang${c(0x7f)}Selatan`)).toBe('TangerangSelatan');
  });

  it('karakter kontrol Cf (format) dibuang', () => {
    expect(placePayload(`Medan${c(0x200b)}Kota`)).toBe('MedanKota');
    expect(placePayload(`Semarang${c(0x00ad)}Timur`)).toBe('SemarangTimur');
  });

  it('@ tunggal di-escape jadi @@', () => {
    expect(placePayload('Kota@Baru')).toBe('Kota@@Baru');
  });

  it('input @@ jadi @@@@', () => {
    expect(placePayload('@@')).toBe('@@@@');
    expect(placePayload('A@@B')).toBe('A@@@@B');
  });

  it('string kosong kembalikan undefined', () => {
    expect(placePayload('')).toBeUndefined();
  });

  it('whitespace saja kembalikan undefined', () => {
    expect(placePayload('   ')).toBeUndefined();
    expect(placePayload('\t\n')).toBeUndefined();
  });

  it('unicode non-ASCII tak berubah', () => {
    expect(placePayload('Kab. Sléman')).toBe('Kab. Sléman');
    expect(placePayload('Þórhallur Syðrugøta')).toBe('Þórhallur Syðrugøta');
  });

  it('nilai normal tak berubah', () => {
    expect(placePayload('Surabaya')).toBe('Surabaya');
    expect(placePayload('Kec. Sukajadi, Kota Bandung')).toBe('Kec. Sukajadi, Kota Bandung');
  });
});
