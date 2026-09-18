// Test checklist round-trip GEDCOM 7 (STG v118-b).
// Cakupan: struktur entri RT_CHECKLIST dan perilaku pure runChecklist().
import { describe, expect, it } from 'vitest';
import {
  RT_CHECKLIST,
  runChecklist,
  type ChecklistResultInput,
} from './checklist';

describe('struktur entri RT_CHECKLIST', () => {
  it('memuat 11 entri checklist', () => {
    expect(RT_CHECKLIST).toHaveLength(11);
  });

  it('id unik dan berformat RT-XX', () => {
    const ids = RT_CHECKLIST.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^RT-\d{2}$/);
    }
  });

  it('setiap entri punya area, requirement, specQuote non-kosong', () => {
    for (const entry of RT_CHECKLIST) {
      expect(entry.area.trim().length).toBeGreaterThan(0);
      expect(entry.requirement.trim().length).toBeGreaterThan(0);
      expect(entry.specQuote.trim().length).toBeGreaterThan(0);
    }
  });

  it('setiap specUrl URL valid ber-https di domain gedcom.io', () => {
    for (const entry of RT_CHECKLIST) {
      const parsed = new URL(entry.specUrl);
      expect(parsed.protocol).toBe('https:');
      expect(parsed.hostname).toBe('gedcom.io');
      expect(parsed.pathname).toContain('FamilySearchGEDCOMi7');
    }
  });

  it('mencakup area DATE, SEX, CONT-CONC, XREF, FAM', () => {
    const areas = new Set(RT_CHECKLIST.map((entry) => entry.area));
    expect(areas.has('DATE')).toBe(true);
    expect(areas.has('SEX')).toBe(true);
    expect(areas.has('CONT-CONC')).toBe(true);
    expect(areas.has('XREF')).toBe(true);
    expect(areas.has('FAM')).toBe(true);
  });
});

describe('runChecklist', () => {
  const allPass: ChecklistResultInput[] = RT_CHECKLIST.map((entry) => ({
    id: entry.id,
    passed: true,
  }));

  it('lulus penuh saat semua entri pass', () => {
    const summary = runChecklist(allPass);
    expect(summary.allPassed).toBe(true);
    expect(summary.passedTotal).toBe(11);
    expect(summary.total).toBe(11);
    for (const area of summary.areas) {
      expect(area.failedIds).toEqual([]);
      expect(area.passed).toBe(area.total);
    }
  });

  it('menandai gagal per area saat satu entri gagal', () => {
    const results: ChecklistResultInput[] = allPass.map((result) =>
      result.id === 'RT-02' ? { ...result, passed: false } : result,
    );
    const summary = runChecklist(results);
    expect(summary.allPassed).toBe(false);
    const dateArea = summary.areas.find((area) => area.area === 'DATE');
    expect(dateArea?.failedIds).toEqual(['RT-02']);
    const sexArea = summary.areas.find((area) => area.area === 'SEX');
    expect(sexArea?.failedIds).toEqual([]);
  });

  it('mengelompokkan beberapa kegagalan dalam satu area tanpa bocor ke area lain', () => {
    const failing = new Set(['RT-01', 'RT-03', 'RT-04']);
    const results: ChecklistResultInput[] = allPass.map((result) => ({
      ...result,
      passed: !failing.has(result.id),
    }));
    const summary = runChecklist(results);
    const dateArea = summary.areas.find((area) => area.area === 'DATE');
    expect(dateArea?.passed).toBe(1);
    expect(dateArea?.failedIds).toEqual(['RT-01', 'RT-03', 'RT-04']);
    expect(summary.passedTotal).toBe(8);
  });

  it('menghitung entri tanpa hasil evaluasi sebagai gagal', () => {
    const results: ChecklistResultInput[] = allPass.slice(0, 10);
    const summary = runChecklist(results);
    expect(summary.allPassed).toBe(false);
    expect(summary.passedTotal).toBe(10);
    const famArea = summary.areas.find((area) => area.area === 'FAM');
    expect(famArea?.failedIds).toEqual(['RT-11']);
  });

  it('tidak melempar exception pada input kosong', () => {
    expect(() => runChecklist([])).not.toThrow();
    const summary = runChecklist([]);
    expect(summary.allPassed).toBe(false);
    expect(summary.passedTotal).toBe(0);
    expect(summary.total).toBe(11);
  });

  it('tidak melempar exception pada id tak dikenal dan passed non-boolean', () => {
    const weird: ChecklistResultInput[] = [
      { id: 'RT-01', passed: true },
      { id: 'TIDAK-ADA', passed: true },
      { id: 'RT-05', passed: false },
    ];
    expect(() => runChecklist(weird)).not.toThrow();
    const summary = runChecklist(weird);
    expect(summary.passedTotal).toBe(1);
  });

  it('pure: hasil identik saat dipanggil ulang dengan input sama', () => {
    const first = runChecklist(allPass);
    const second = runChecklist(allPass);
    expect(second).toEqual(first);
  });

  it('pure: tidak memutasi array input', () => {
    const results: ChecklistResultInput[] = allPass.map((result) => ({ ...result }));
    const snapshot = JSON.parse(JSON.stringify(results)) as ChecklistResultInput[];
    runChecklist(results);
    expect(results).toEqual(snapshot);
  });
});
