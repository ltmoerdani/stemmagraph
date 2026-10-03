import { describe, expect, it } from 'vitest';
import {
  KINSHIP_ALIASES_REGIONAL,
  resolveAlias,
} from './kinship-aliases';

describe('v191-i alias regional Karo: nini (panggilan nenek)', () => {
  it('nini = grandparent di region Karo', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo.nini;
    expect(e).toBeDefined();
    expect(e.kind).toBe('grandparent');
    expect(e.region).toBe('Karo');
  });

  it('nini ribu = grandparent di region Karo (submarga Perangin-angin)', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['nini ribu'];
    expect(e).toBeDefined();
    expect(e.kind).toBe('grandparent');
  });

  it('nini bulang = grandparent di region Karo (Perangin-angin / Karo pinggil)', () => {
    const e = KINSHIP_ALIASES_REGIONAL.Karo['nini bulang'];
    expect(e).toBeDefined();
    expect(e.kind).toBe('grandparent');
  });

  it('struktur entri persis 4 field: kind depth region note', () => {
    for (const key of ['nini', 'nini ribu', 'nini bulang']) {
      const e = KINSHIP_ALIASES_REGIONAL.Karo[key];
      expect(Object.keys(e).sort()).toEqual(['depth', 'kind', 'note', 'region']);
      expect(e.depth).toBe(1);
      expect(typeof e.note).toBe('string');
      expect(e.note?.length).toBeGreaterThan(0);
    }
  });

  it('resolveAlias menyelesaikan nini ke grandparent dengan region Karo', () => {
    const r = resolveAlias('nini', 'Karo');
    expect(r).not.toBeNull();
    expect(r?.kind).toBe('grandparent');
  });

  it('resolveAlias menyelesaikan nini ribu dengan region Karo', () => { 
    const r = resolveAlias('nini ribu', 'Karo');
    expect(r).not.toBeNull();
    expect(r?.kind).toBe('grandparent');
  });

  it('resolveAlias menyelesaikan nini bulang dengan region Karo', () => {
    const r = resolveAlias('nini bulang', 'Karo');
    expect(r).not.toBeNull();
    expect(r?.kind).toBe('grandparent');
  });

  it('tanpa region: nini tetap resolve ke entri map utama multi-region (bukan entri Karo)', () => {
    const r = resolveAlias('nini');
    expect(r).not.toBeNull();
    expect(r?.kind).toBe('grandparent');
    expect(r?.note).not.toContain('EMPAT jangkar');
  });

  it('negatif: tanpa region, nini ribu nihil', () => {
    const r = resolveAlias('nini ribu');
    expect(r).toBeNull();
  });

  it('negatif: tanpa region, nini bulang nihil', () => {
    const r = resolveAlias('nini bulang');
    expect(r).toBeNull();
  });

  it('negatif: nini tudung TIDAK menjadi entri (asimetri: tudung nihil makna kakek)', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['nini tudung']).toBeUndefined();
    expect(resolveAlias('nini tudung', 'Karo')).toBeNull();
  });

  it('puang kalimbubu nihil sbg key terpisah (v222-i: varian komposit terdokumentasi di note kalimbubu), resolve penuh lewat kalimbubu', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo['puang kalimbubu']).toBeUndefined();
    expect(resolveAlias('puang kalimbubu', 'Karo')).toBeNull();
    expect(resolveAlias('kalimbubu', 'Karo')?.note).toContain('puang kalimbubu');
  });

  it('guard homonim topi tetap nihil di blok Karo', () => {
    expect(KINSHIP_ALIASES_REGIONAL.Karo.topi).toBeUndefined();
  });

  it('entri lama blok Karo tetap utuh (kaka impal kempu bibi)', () => { 
    expect(KINSHIP_ALIASES_REGIONAL.Karo.kaka).toBeDefined();
    expect(KINSHIP_ALIASES_REGIONAL.Karo.impal).toBeDefined();
    expect(KINSHIP_ALIASES_REGIONAL.Karo.kempu).toBeDefined();
    expect(KINSHIP_ALIASES_REGIONAL.Karo.bibi).toBeDefined();
  });
});
