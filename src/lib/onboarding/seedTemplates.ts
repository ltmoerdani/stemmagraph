/**
 * Seed template onboarding Stemmagraph (GOAL v154 fase i).
 *
 * Kontrak pure: tanpa DB, tanpa env, tanpa network. Modul ini hanya menyediakan
 * data silsilah contoh dan validator struktural untuk dipakai flow onboarding.
 * Selaras draft v154 design summary (seed template onboarding PURE).
 *
 * Sensitivitas budaya: varian tarombo (Batak) dan zupu (Tionghoa) adalah struktur
 * generik placeholder tanpa nama nyata, mengikuti rujukan evidence v152b:
 * - Ideguru 2024, DOI 10.51169/ideguru.v10i1.1617
 * - Vergouwen 1964, Springer, DOI 10.1007/978-94-015-1035-6_2
 */

export interface SeedPerson {
  id: string;
  nama: string;
  gender: 'M' | 'F' | 'X' | 'U';
  parentLinks: string[];
  childLinks: string[];
  pasangan: string | null;
}

export interface SeedTemplate {
  templateId: string;
  nama: string;
  deskripsi: string;
  persons: SeedPerson[];
}

/** (a) Keluarga inti: 4 person, 3 generasi. */
const KELUARGA_INTI: SeedTemplate = {
  templateId: 'keluarga-inti',
  nama: 'Keluarga Inti',
  deskripsi: 'Contoh keluarga kecil 3 generasi: pasangan orang tua, satu anak, satu cucu.',
  persons: [
    { id: 'p1', nama: 'Person A', gender: 'M', parentLinks: [], childLinks: ['p3'], pasangan: 'p2' },
    { id: 'p2', nama: 'Person B', gender: 'F', parentLinks: [], childLinks: ['p3'], pasangan: 'p1' },
    { id: 'p3', nama: 'Person C', gender: 'X', parentLinks: ['p1', 'p2'], childLinks: ['p4'], pasangan: null },
    { id: 'p4', nama: 'Person D', gender: 'U', parentLinks: ['p3'], childLinks: [], pasangan: null },
  ],
};

/** (b) Tarombo Batak: 3 root leluhur puncak terpisah, satu cabang boru masuk via pasangan. */
const TAROMBO_BATAK: SeedTemplate = {
  templateId: 'tarombo-batak',
  nama: 'Tarombo (Batak)',
  deskripsi: 'Tiga garis leluhur puncak terpisah; satu cabang boru bergabung lewat pernikahan antar garis.',
  persons: [
    // Root 1: dua generasi turunan sampai cabang yang menikahi boru dari root 2.
    { id: 'r1', nama: 'Leluhur 1', gender: 'M', parentLinks: [], childLinks: ['c1'], pasangan: null },
    { id: 'c1', nama: 'Keturunan 1', gender: 'M', parentLinks: ['r1'], childLinks: ['c2'], pasangan: null },
    { id: 'c2', nama: 'Keturunan 2', gender: 'M', parentLinks: ['c1'], childLinks: ['g1'], pasangan: 'd1' },
    // Root 2: leluhur terpisah; anak perempuannya (boru) masuk garis root 1 via pasangan.
    { id: 'r2', nama: 'Leluhur 2', gender: 'M', parentLinks: [], childLinks: ['d1'], pasangan: null },
    { id: 'd1', nama: 'Keturunan 3', gender: 'F', parentLinks: ['r2'], childLinks: ['g1'], pasangan: 'c2' },
    // Anak hasil perkawinan antar root.
    { id: 'g1', nama: 'Keturunan 4', gender: 'U', parentLinks: ['c2', 'd1'], childLinks: [], pasangan: null },
    // Root 3: garis leluhur ketiga yang berdiri sendiri.
    { id: 'r3', nama: 'Leluhur 3', gender: 'M', parentLinks: [], childLinks: ['e1'], pasangan: null },
    { id: 'e1', nama: 'Keturunan 5', gender: 'F', parentLinks: ['r3'], childLinks: ['e2'], pasangan: null },
    { id: 'e2', nama: 'Keturunan 6', gender: 'X', parentLinks: ['e1'], childLinks: [], pasangan: null },
  ],
};

/** (c) Zupu: 1 root leluhur, cabang paralel per generasi lewat saudara se-generasi. */
const ZUPU: SeedTemplate = {
  templateId: 'zupu',
  nama: 'Zupu (Silsilah Klan)',
  deskripsi: 'Satu leluhur puncak; tiap saudara se-generasi membuka cabang paralel yang turun sendiri.',
  persons: [
    { id: 'z1', nama: 'Leluhur 1', gender: 'M', parentLinks: [], childLinks: ['z2', 'z3'], pasangan: null },
    // Cabang A dan B: saudara se-generasi, masing-masing lanjut turunannya sendiri.
    { id: 'z2', nama: 'Keturunan 1', gender: 'M', parentLinks: ['z1'], childLinks: ['z4', 'z5'], pasangan: null },
    { id: 'z3', nama: 'Keturunan 2', gender: 'M', parentLinks: ['z1'], childLinks: ['z6', 'z7'], pasangan: null },
    { id: 'z4', nama: 'Keturunan 3', gender: 'F', parentLinks: ['z2'], childLinks: [], pasangan: null },
    { id: 'z5', nama: 'Keturunan 4', gender: 'M', parentLinks: ['z2'], childLinks: ['z8'], pasangan: null },
    { id: 'z6', nama: 'Keturunan 5', gender: 'X', parentLinks: ['z3'], childLinks: [], pasangan: null },
    { id: 'z7', nama: 'Keturunan 6', gender: 'U', parentLinks: ['z3'], childLinks: [], pasangan: null },
    { id: 'z8', nama: 'Keturunan 7', gender: 'U', parentLinks: ['z5'], childLinks: [], pasangan: null },
  ],
};

export const SEED_TEMPLATES: SeedTemplate[] = [KELUARGA_INTI, TAROMBO_BATAK, ZUPU];

/**
 * Validasi struktural satu template. Mengembalikan daftar masalah berbahasa
 * singkat; template valid ditandai array kosong.
 */
export function validateSeedTemplate(t: SeedTemplate): string[] {
  const problems: string[] = [];
  const byId = new Map<string, SeedPerson>();

  for (const p of t.persons) {
    if (byId.has(p.id)) {
      problems.push(`id duplikat: ${p.id}`);
    }
    byId.set(p.id, p);
  }

  const refExists = (from: SeedPerson, field: 'parentLinks' | 'childLinks', target: string): boolean => {
    if (!byId.has(target)) {
      problems.push(`${field} ${from.id} menunjuk id tak dikenal: ${target}`);
      return false;
    }
    return true;
  };

  for (const p of t.persons) {
    if (p.parentLinks.includes(p.id) || p.childLinks.includes(p.id)) {
      problems.push(`self loop: ${p.id}`);
    }
    for (const pid of p.parentLinks) {
      if (!refExists(p, 'parentLinks', pid)) continue;
      const parent = byId.get(pid) as SeedPerson;
      if (!parent.childLinks.includes(p.id)) {
        problems.push(`parentLinks tak konsisten dua arah: ${p.id} -> ${pid}`);
      }
    }
    for (const cid of p.childLinks) {
      if (!refExists(p, 'childLinks', cid)) continue;
      const child = byId.get(cid) as SeedPerson;
      if (!child.parentLinks.includes(p.id)) {
        problems.push(`childLinks tak konsisten dua arah: ${p.id} -> ${cid}`);
      }
    }
    if (p.pasangan !== null) {
      if (p.pasangan === p.id) {
        problems.push(`self loop: ${p.id} (pasangan)`);
      } else if (!byId.has(p.pasangan)) {
        problems.push(`pasangan ${p.id} menunjuk id tak dikenal: ${p.pasangan}`);
      } else {
        const spouse = byId.get(p.pasangan) as SeedPerson;
        if (spouse.pasangan !== p.id) {
          problems.push(`pasangan tak dua arah: ${p.id} <-> ${p.pasangan}`);
        }
      }
    }
  }

  return problems;
}

/** Konversi seed ke input member aplikasi; urutan mengikuti persons. */
export function seedToMemberInputs(
  t: SeedTemplate,
): Array<{ name: string; gender: 'male' | 'female' | 'other' }> {
  return t.persons.map((p) => ({
    name: p.nama,
    gender: p.gender === 'M' ? 'male' : p.gender === 'F' ? 'female' : 'other',
  }));
}
