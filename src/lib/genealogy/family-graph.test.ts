import { describe, expect, it } from 'vitest';
import { buildFamilyGraph, type IndiInput } from './family-graph';

describe('buildFamilyGraph', () => {
  it('mengembalikan graph kosong untuk input kosong', () => {
    const graph = buildFamilyGraph([]);
    expect(graph.personIds).toEqual([]);
    expect(graph.unions).toEqual([]);
    expect(graph.parentEdges).toEqual([]);
  });

  it('remarriage: 2 FAMS pada satu INDI menghasilkan 2 node pernikahan tanpa data hilang', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', fams: ['@F1@', '@F2@'] },
      { id: '@I2@', fams: ['@F1@'] },
      { id: '@I3@', fams: ['@F2@'] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.unions).toHaveLength(2);
    const f1 = graph.unions.find((u) => u.fam === '@F1@');
    const f2 = graph.unions.find((u) => u.fam === '@F2@');
    expect(f1).toBeDefined();
    expect(f2).toBeDefined();
    expect(f1?.spouses).toEqual(['@I1@', '@I2@']);
    expect(f2?.spouses).toEqual(['@I1@', '@I3@']);
  });

  it('MARR pada satu FAM tidak menimpa node pernikahan lain', () => {
    const indis: IndiInput[] = [
      {
        id: '@I1@',
        fams: [
          { fam: '@F1@', marr: '1830-05-01' },
          { fam: '@F2@' },
        ],
      },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.unions).toHaveLength(2);
    const f1 = graph.unions.find((u) => u.fam === '@F1@');
    const f2 = graph.unions.find((u) => u.fam === '@F2@');
    expect(f1?.marr).toBe('1830-05-01');
    expect(f2?.marr).toBeUndefined();
  });

  it('2 FAMC pada satu INDI menghasilkan 2 edge ortu terpisah tanpa overwrite', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', famc: [{ fam: '@F1@' }, { fam: '@F2@' }] },
      { id: '@I2@', fams: ['@F1@'] },
      { id: '@I3@', fams: ['@F2@'] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.parentEdges).toHaveLength(2);
    const e1 = graph.parentEdges.find((e) => e.fam === '@F1@');
    const e2 = graph.parentEdges.find((e) => e.fam === '@F2@');
    expect(e1?.child).toBe('@I1@');
    expect(e1?.parents).toEqual(['@I2@']);
    expect(e2?.child).toBe('@I1@');
    expect(e2?.parents).toEqual(['@I3@']);
  });

  it('PEDI adopted dibawa verbatim ke metadata edge', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', famc: [{ fam: '@F1@', pedi: 'adopted' }] },
      { id: '@I2@', fams: ['@F1@'] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.parentEdges).toHaveLength(1);
    expect(graph.parentEdges[0]?.pedi).toBe('adopted');
  });

  it('FAMC-STAT challenged, disproven, proven dibawa verbatim', () => {
    const indis: IndiInput[] = [
      {
        id: '@I1@',
        famc: [
          { fam: '@F1@', famcStat: 'CHALLENGED' },
          { fam: '@F2@', famcStat: 'DISPROVEN' },
          { fam: '@F3@', famcStat: 'PROVEN' },
        ],
      },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.parentEdges).toHaveLength(3);
    expect(graph.parentEdges[0]?.famcStat).toBe('CHALLENGED');
    expect(graph.parentEdges[1]?.famcStat).toBe('DISPROVEN');
    expect(graph.parentEdges[2]?.famcStat).toBe('PROVEN');
  });

  it('FAM tanpa ortu legal tetap jadi node pernikahan tanpa edge ortu', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', fams: ['@F1@'] },
      { id: '@I2@', fams: ['@F1@'] },
      { id: '@I3@', famc: [{ fam: '@F1@' }] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.unions).toHaveLength(1);
    expect(graph.unions[0]?.fam).toBe('@F1@');
    expect(graph.unions[0]?.spouses).toEqual(['@I1@', '@I2@']);
    expect(graph.parentEdges).toHaveLength(1);
    expect(graph.parentEdges[0]?.pedi).toBeUndefined();
    expect(graph.parentEdges[0]?.famcStat).toBeUndefined();
  });

  it('kombinasi: remarriage plus anak dari pernikahan pertama', () => {
    const indis: IndiInput[] = [
      {
        id: '@I1@',
        fams: [
          { fam: '@F1@', marr: '1900' },
          { fam: '@F2@', marr: '1910' },
        ],
        famc: [],
      },
      { id: '@I2@', fams: ['@F1@'] },
      { id: '@I3@', fams: ['@F2@'] },
      { id: '@I4@', famc: [{ fam: '@F1@', pedi: 'birth', famcStat: 'PROVEN' }] },
      { id: '@I5@', famc: [{ fam: '@F2@', pedi: 'adopted' }] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.unions).toHaveLength(2);
    expect(graph.parentEdges).toHaveLength(2);
    const e1 = graph.parentEdges.find((e) => e.fam === '@F1@');
    const e2 = graph.parentEdges.find((e) => e.fam === '@F2@');
    expect(e1?.parents).toEqual(['@I1@', '@I2@']);
    expect(e1?.pedi).toBe('birth');
    expect(e1?.famcStat).toBe('PROVEN');
    expect(e2?.parents).toEqual(['@I1@', '@I3@']);
    expect(e2?.pedi).toBe('adopted');
  });

  it('deterministik: panggilan berulang dengan input sama menghasilkan output sama', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', fams: ['@F2@', '@F1@'], famc: [{ fam: '@F3@' }] },
      { id: '@I2@', fams: ['@F1@', '@F2@'] },
    ];
    const a = buildFamilyGraph(indis);
    const b = buildFamilyGraph(indis);
    expect(a).toEqual(b);
    expect(a.unions.map((u) => u.fam)).toEqual(['@F2@', '@F1@']);
  });

  it('mengumpulkan pasangan dari kedua arah relasi FAMS', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', fams: ['@F1@'] },
      { id: '@I2@', fams: ['@F1@'] },
      { id: '@I3@', fams: ['@F1@'] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.unions).toHaveLength(1);
    expect(graph.unions[0]?.spouses).toEqual(['@I1@', '@I2@', '@I3@']);
  });

  it('pointer FAMS berulang identik tidak menduplikasi node pernikahan', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', fams: ['@F1@', '@F1@'] },
      { id: '@I2@', fams: ['@F1@'] },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.unions).toHaveLength(1);
    expect(graph.unions[0]?.spouses).toEqual(['@I1@', '@I2@']);
  });

  it('pointer FAMC identik berulang tidak menduplikasi edge ortu', () => {
    const indis: IndiInput[] = [
      {
        id: '@I1@',
        famc: [
          { fam: '@F1@', pedi: 'birth' },
          { fam: '@F1@', pedi: 'birth' },
        ],
      },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.parentEdges).toHaveLength(1);
  });

  it('FAMC dengan metadata beda pada FAM sama tetap menghasilkan edge terpisah', () => {
    const indis: IndiInput[] = [
      {
        id: '@I1@',
        famc: [
          { fam: '@F1@', pedi: 'birth' },
          { fam: '@F1@', pedi: 'adopted', famcStat: 'CHALLENGED' },
        ],
      },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.parentEdges).toHaveLength(2);
    expect(graph.parentEdges[0]?.pedi).toBe('birth');
    expect(graph.parentEdges[1]?.pedi).toBe('adopted');
    expect(graph.parentEdges[1]?.famcStat).toBe('CHALLENGED');
  });

  it('edge ortu tetap dibuat walau ortu tidak diketahui', () => {
    const indis: IndiInput[] = [{ id: '@I1@', famc: [{ fam: '@F1@', pedi: 'birth' }] }];
    const graph = buildFamilyGraph(indis);
    expect(graph.parentEdges).toHaveLength(1);
    expect(graph.parentEdges[0]?.parents).toEqual([]);
    expect(graph.unions).toHaveLength(1);
    expect(graph.unions[0]?.spouses).toEqual([]);
  });

  it('personIds terisi urut kemunculan tanpa duplikat', () => {
    const indis: IndiInput[] = [
      { id: '@I1@', fams: ['@F1@'] },
      { id: '@I2@', fams: ['@F1@'] },
      { id: '@I1@' },
    ];
    const graph = buildFamilyGraph(indis);
    expect(graph.personIds).toEqual(['@I1@', '@I2@']);
  });
});
