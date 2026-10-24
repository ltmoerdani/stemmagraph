/**
 * Unit tests modul pure duplicateDetector (v388 AC1).
 *
 * AC5 GOAL v388: exact, normalisasi, typo dekat ambang, di bawah ambang,
 * urutan skor turun, input kosong, guardrail nama pendek (fuzzy saja
 * tanpa sinyal sekunder tidak tampil; dengan marga sama tampil), inisial
 * bertitik tidak dihitung token penuh.
 */
import { describe, expect, it } from 'vitest';
import {
  DUPLICATE_THRESHOLD,
  findDuplicateCandidates,
} from './duplicateDetector';

const base = {
  name: 'Andi Sitompul',
  marga: 'Sitompul',
  birthDate: '1980-05-10',
  gender: 'M',
};

describe('duplicateDetector (v388)', () => {
  it('nama exact memberi skor di atas ambang plus sinyal sekunder', () => {
    const out = findDuplicateCandidates(base, [
      { id: 'm1', name: 'Andi Sitompul', marga: 'Sitompul', birthDate: '1980-05-10' },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons).toContain('EXACT_NAME');
    expect(out[0]!.score).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it('nama normalized sama meski beda kapital dan spasi', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'andi  sitompul' },
      [{ id: 'm1', name: 'Andi Sitompul' }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons).toContain('NORMALIZED_NAME');
  });

  it('typo dekat ambang tampil saat gabungan sinyal sekunder cukup', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'Andi Sitompulx', marga: 'Sitompul', birthDate: '1980-05-10', gender: 'M' },
      [{ id: 'm1', name: 'Andi Sitompul', marga: 'Sitompul', birthDate: '1980-05-10', gender: 'M' }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons).toContain('FUZZY_NAME');
  });

  it('skor di bawah ambang tidak tampil', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'Budi Santoso', marga: 'Santoso' },
      [{ id: 'm1', name: 'Andi Sitompul', marga: 'Sitompul' }],
    );
    expect(out).toHaveLength(0);
  });

  it('hasil urut skor turun, tie-break memberId naik', () => {
    const out = findDuplicateCandidates(base, [
      { id: 'm2', name: 'Andi Sitompul', marga: 'Sitompul' },
      { id: 'm1', name: 'Andi Sitompul', marga: 'Sitompul' },
      { id: 'm3', name: 'Andi Sitompul', birthDate: '1980-05-10' },
    ]);
    expect(out.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score);
    }
  });

  it('input kosong mengembalikan array kosong tanpa error', () => {
    expect(findDuplicateCandidates(base, [])).toEqual([]);
  });

  it('GUARDRAIL: nama pendek fuzzy saja tanpa sinyal sekunder tidak tampil', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'Andi', marga: '', birthDate: null },
      [{ id: 'm1', name: 'Andes', marga: null, birthDate: null }],
    );
    expect(out).toHaveLength(0);
  });

  it('GUARDRAIL: nama pendek fuzzy dengan marga sama plus tahun lahir tampil', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'Andi', marga: 'Sitompul', birthDate: '1980-05-10' },
      [{ id: 'm1', name: 'Anda', marga: 'Sitompul', birthDate: '1980-05-10' }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons).toContain('SAME_MARGA');
  });

  it('GUARDRAIL: inisial bertitik A. vs Andi tidak dihitung token penuh', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'A. Sitompul', marga: '', birthDate: null, gender: null },
      [{ id: 'm1', name: 'Andi Sitompul', marga: null, birthDate: null, gender: null }],
    );
    expect(out).toHaveLength(0);
  });

  it('tahun lahir tumpang tindih jadi sinyal sekunder pada typo nama', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'Andi Sitompol', birthDate: '1980-01-01', marga: '', gender: 'M' },
      [{ id: 'm1', name: 'Andi Sitompul', birthDate: '1983-07-07', marga: null, gender: 'M' }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons).toContain('BIRTH_YEAR_OVERLAP');
  });

  it('nickname sama menambah skor pada gabungan sinyal', () => {
    const out = findDuplicateCandidates(
      { ...base, name: 'Andi', nickname: 'Bang Andi', marga: 'Sitompul', birthDate: '1980-05-10', gender: null },
      [{ id: 'm1', name: 'Anda', nickname: 'Bang Andi', marga: 'Sitompul', birthDate: '1980-05-10', gender: null }],
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.reasons).toContain('SAME_NICKNAME');
  });
});
