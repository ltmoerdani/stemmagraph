import { describe, it, expect } from 'vitest';
import { assessImportPrivacy } from './importPrivacyGate';

describe('assessImportPrivacy', () => {
  it('kasus 1: DEAT ada (string) berarti bukan living', () => {
    const result = assessImportPrivacy({ id: 'I1', deathDate: '1902-03-10' });
    expect(result).toEqual({ id: 'I1', livingSuggested: false });
  });

  it('kasus 2: DEAT ada (objek) berarti bukan living', () => {
    const result = assessImportPrivacy({ id: 'I2', deathDate: { date: '1950-01-01' } });
    expect(result.livingSuggested).toBe(false);
  });

  it('kasus 3: birthDate kosong (undefined) tanpa DEAT berarti living true', () => {
    const result = assessImportPrivacy({ id: 'I3' });
    expect(result).toEqual({ id: 'I3', livingSuggested: true });
  });

  it('kasus 4: birthDate null tanpa DEAT berarti living true (safe default)', () => {
    const result = assessImportPrivacy({ id: 'I4', birthDate: null });
    expect(result.livingSuggested).toBe(true);
  });

  it('kasus 5: birthDate tua ada tanpa DEAT tetap living, tidak menalar usia', () => {
    const result = assessImportPrivacy({ id: 'I5', birthDate: '1820-05-01' });
    expect(result.livingSuggested).toBe(true);
  });

  it('kasus 6: birthDate modern ada tanpa DEAT tetap living', () => {
    const result = assessImportPrivacy({ id: 'I6', birthDate: '1995-11-20' });
    expect(result.livingSuggested).toBe(true);
  });

  it('kasus 7: override param living true menang atas DEAT', () => {
    const result = assessImportPrivacy(
      { id: 'I7', deathDate: '1888-08-08' },
      { livingOverride: true },
    );
    expect(result.livingSuggested).toBe(true);
  });

  it('kasus 8: override param living false memaksa bukan living', () => {
    const result = assessImportPrivacy(
      { id: 'I8' },
      { livingOverride: false },
    );
    expect(result.livingSuggested).toBe(false);
  });

  it('kasus 9: batch campuran menghasilkan penilaian per individu', () => {
    const batch = [
      { id: 'B1', deathDate: '1931-02-02' },
      { id: 'B2' },
      { id: 'B3', birthDate: '1970-01-01' },
    ];
    const results = batch.map((individual) => assessImportPrivacy(individual));
    expect(results).toEqual([
      { id: 'B1', livingSuggested: false },
      { id: 'B2', livingSuggested: true },
      { id: 'B3', livingSuggested: true },
    ]);
  });

  it('kasus 10: RESN CONFIDENTIAL lolos utuh, input tidak dimutasi', () => {
    const individual = { id: 'I10', resn: 'CONFIDENTIAL' };
    const result = assessImportPrivacy(individual);
    expect(result).toEqual({ id: 'I10', livingSuggested: true });
    expect(individual.resn).toBe('CONFIDENTIAL');
  });

  it('kasus 11: RESN PRIVACY dan LOCKED lolos utuh, penilaian normal', () => {
    const privacy = assessImportPrivacy({ id: 'I11a', resn: 'PRIVACY', deathDate: '1940-04-04' });
    const locked = assessImportPrivacy({ id: 'I11b', resn: 'LOCKED' });
    expect(privacy).toEqual({ id: 'I11a', livingSuggested: false });
    expect(locked).toEqual({ id: 'I11b', livingSuggested: true });
  });

  it('kasus 12: id unik dipertahankan apa adanya di hasil', () => {
    const result = assessImportPrivacy({ id: '@I1234567@', deathDate: '1900-01-01' });
    expect(result.id).toBe('@I1234567@');
  });

  it('kasus 13: round-trip deterministik, dua panggilan hasil identik', () => {
    const individual = { id: 'I13', birthDate: '1960-06-06', resn: 'PRIVACY' };
    const first = assessImportPrivacy(individual);
    const second = assessImportPrivacy(individual);
    expect(first).toEqual(second);
    expect(first).toEqual({ id: 'I13', livingSuggested: true });
  });

  it('kasus 14: deathDate string kosong dianggap tidak ada, living true', () => {
    const result = assessImportPrivacy({ id: 'I14', deathDate: '', birthDate: '1980-02-02' });
    expect(result.livingSuggested).toBe(true);
  });
});
