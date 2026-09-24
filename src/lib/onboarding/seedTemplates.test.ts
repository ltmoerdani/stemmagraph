import { describe, expect, it } from 'vitest';
import {
  SEED_TEMPLATES,
  seedToMemberInputs,
  validateSeedTemplate,
  type SeedTemplate,
} from './seedTemplates';

function tpl(templateId: string): SeedTemplate {
  const t = SEED_TEMPLATES.find((x) => x.templateId === templateId);
  if (!t) throw new Error(`template ${templateId} tidak ada`);
  return t;
}

function person(t: SeedTemplate, id: string): SeedTemplate['persons'][number] {
  const p = t.persons.find((x) => x.id === id);
  if (!p) throw new Error(`person ${id} tidak ada di ${t.templateId}`);
  return p;
}

function mk(persons: SeedTemplate['persons']): SeedTemplate {
  return {
    templateId: 't-uji',
    nama: 'Template Uji',
    deskripsi: 'Template sintetis untuk kasus negatif.',
    persons,
  };
}

describe('SEED_TEMPLATES', () => {
  it('memuat 3 template dengan templateId unik yang diharapkan', () => {
    expect(SEED_TEMPLATES).toHaveLength(3);
    const ids = SEED_TEMPLATES.map((t) => t.templateId);
    expect(new Set(ids).size).toBe(3);
    expect(ids).toEqual(['keluarga-inti', 'tarombo-batak', 'zupu']);
  });

  it('semua template bawaan valid: 0 masalah struktural', () => {
    for (const t of SEED_TEMPLATES) {
      expect(validateSeedTemplate(t), `template ${t.templateId}`).toEqual([]);
    }
  });

  it('keluarga-inti: 4 person, pasangan p1-p2, p3 anak p1+p2, p4 cucu p3', () => {
    const t = tpl('keluarga-inti');
    expect(t.persons).toHaveLength(4);
    expect(person(t, 'p1').pasangan).toBe('p2');
    expect(person(t, 'p2').pasangan).toBe('p1');
    expect(person(t, 'p3').parentLinks).toEqual(['p1', 'p2']);
    expect(person(t, 'p4').parentLinks).toEqual(['p3']);
  });

  it('tarombo-batak: 3 root leluhur terpisah, cabang boru masuk via pasangan antar garis', () => {
    const t = tpl('tarombo-batak');
    const roots = t.persons.filter((p) => p.parentLinks.length === 0).map((p) => p.id);
    expect(roots).toEqual(['r1', 'r2', 'r3']);
    expect(person(t, 'c2').pasangan).toBe('d1');
    expect(person(t, 'd1').pasangan).toBe('c2');
    expect(person(t, 'd1').parentLinks).toEqual(['r2']);
    expect(person(t, 'g1').parentLinks).toEqual(['c2', 'd1']);
  });

  it('zupu: 1 root leluhur, dua cabang paralel dari saudara se-generasi', () => {
    const t = tpl('zupu');
    const roots = t.persons.filter((p) => p.parentLinks.length === 0);
    expect(roots).toHaveLength(1);
    expect(roots[0]?.id).toBe('z1');
    expect(person(t, 'z1').childLinks).toEqual(['z2', 'z3']);
  });
});

describe('validateSeedTemplate', () => {
  it('template tanpa person dianggap valid', () => {
    expect(validateSeedTemplate(mk([]))).toEqual([]);
  });

  it('menandai id duplikat', () => {
    const problems = validateSeedTemplate(
      mk([
        { id: 'a', nama: 'A', gender: 'M', parentLinks: [], childLinks: [], pasangan: null },
        { id: 'a', nama: 'A lagi', gender: 'F', parentLinks: [], childLinks: [], pasangan: null },
      ]),
    );
    expect(problems.some((p) => p.includes('id duplikat'))).toBe(true);
  });

  it('menandai referensi parent tak dikenal', () => {
    const problems = validateSeedTemplate(
      mk([
        { id: 'a', nama: 'A', gender: 'M', parentLinks: ['hantu'], childLinks: [], pasangan: null },
      ]),
    );
    expect(problems.some((p) => p.includes('tak dikenal') && p.includes('hantu'))).toBe(true);
  });

  it('menandai self loop parent', () => {
    const problems = validateSeedTemplate(
      mk([
        { id: 'a', nama: 'A', gender: 'M', parentLinks: ['a'], childLinks: [], pasangan: null },
      ]),
    );
    expect(problems.some((p) => p.includes('self loop'))).toBe(true);
  });

  it('menandai parentLinks tidak dua arah: anak tak mencatat orang tuanya', () => {
    const problems = validateSeedTemplate(
      mk([
        { id: 'ortu', nama: 'O', gender: 'M', parentLinks: [], childLinks: ['anak'], pasangan: null },
        { id: 'anak', nama: 'K', gender: 'U', parentLinks: [], childLinks: [], pasangan: null },
      ]),
    );
    expect(problems.some((p) => p.includes('tak konsisten dua arah'))).toBe(true);
  });

  it('menandai pasangan tidak dua arah', () => {
    const problems = validateSeedTemplate(
      mk([
        { id: 'a', nama: 'A', gender: 'M', parentLinks: [], childLinks: [], pasangan: 'b' },
        { id: 'b', nama: 'B', gender: 'F', parentLinks: [], childLinks: [], pasangan: null },
      ]),
    );
    expect(problems.some((p) => p.includes('pasangan tak dua arah'))).toBe(true);
  });

  it('menandai pasangan tak dikenal dan pasangan diri sendiri', () => {
    const problems = validateSeedTemplate(
      mk([
        { id: 'a', nama: 'A', gender: 'M', parentLinks: [], childLinks: [], pasangan: 'hantu' },
        { id: 'b', nama: 'B', gender: 'F', parentLinks: [], childLinks: [], pasangan: 'b' },
      ]),
    );
    expect(problems.some((p) => p.includes('tak dikenal'))).toBe(true);
    expect(problems.some((p) => p.includes('self loop'))).toBe(true);
  });
});

describe('seedToMemberInputs', () => {
  it('panjang dan urutan mengikuti persons', () => {
    const t = tpl('keluarga-inti');
    const out = seedToMemberInputs(t);
    expect(out).toHaveLength(t.persons.length);
    expect(out.map((m) => m.name)).toEqual(t.persons.map((p) => p.nama));
  });

  it('mapping gender M male, F female, X dan U other', () => {
    const out = seedToMemberInputs(tpl('keluarga-inti'));
    expect(out.map((m) => m.gender)).toEqual(['male', 'female', 'other', 'other']);
  });
});
