/**
 * Pure family-graph builder untuk GOAL v171-i.
 *
 * Modul ini tanpa import apa pun (storage, schema, prisma, react).
 * Input berupa daftar INDI dengan pointer FAMS dan FAMC. Setiap FAM
 * menghasilkan tepat satu node pernikahan (union), dan setiap FAMC
 * menghasilkan satu edge orang tua dengan metadata PEDI serta
 * FAMC-STAT yang dibawa verbatim. Remarriage tidak saling menimpa.
 */

export interface FamPointerInput {
  fam: string;
  marr?: string;
}

export interface FamcPointerInput {
  fam: string;
  pedi?: string;
  famcStat?: string;
}

export interface IndiInput {
  id: string;
  /** Pointer FAMS: string polos atau objek dengan metadata MARR. */
  fams?: Array<string | FamPointerInput>;
  /** Pointer FAMC dengan metadata PEDI dan FAMC-STAT verbatim. */
  famc?: FamcPointerInput[];
}

export interface UnionNode {
  fam: string;
  spouses: string[];
  marr?: string;
}

export interface ParentEdge {
  child: string;
  fam: string;
  parents: string[];
  pedi?: string;
  famcStat?: string;
}

export interface FamilyGraph {
  personIds: string[];
  unions: UnionNode[];
  parentEdges: ParentEdge[];
}

/**
 * Bangun graph keluarga dari daftar INDI.
 *
 * Urutan output deterministik: node union mengikuti urutan kemunculan
 * pointer FAM pertama kali, edge ortu mengikuti urutan kemunculan FAMC,
 * personIds mengikuti urutan INDI tanpa duplikat. Pasangan dan ortu
 * diisi setelah seluruh INDI diproses agar arah relasi dua arah tetap
 * lengkap tanpa bergantung pada urutan deklarasi.
 */
export function buildFamilyGraph(indis: IndiInput[]): FamilyGraph {
  const personIds: string[] = [];
  const seenPersons = new Set<string>();
  const unionByFam = new Map<string, UnionNode>();
  const unions: UnionNode[] = [];
  const parentEdges: ParentEdge[] = [];
  const seenEdgeKeys = new Set<string>();
  const spousesByFam = new Map<string, string[]>();

  const ensureUnion = (fam: string): UnionNode => {
    const existing = unionByFam.get(fam);
    if (existing) {
      return existing;
    }
    const node: UnionNode = { fam, spouses: [] };
    unionByFam.set(fam, node);
    unions.push(node);
    return node;
  };

  for (const indi of indis) {
    if (!seenPersons.has(indi.id)) {
      seenPersons.add(indi.id);
      personIds.push(indi.id);
    }

    const seenFamPointer = new Set<string>();
    for (const raw of indi.fams ?? []) {
      const pointer: FamPointerInput = typeof raw === 'string' ? { fam: raw } : raw;
      if (!seenFamPointer.has(pointer.fam)) {
        seenFamPointer.add(pointer.fam);
        const spouses = spousesByFam.get(pointer.fam) ?? [];
        spouses.push(indi.id);
        spousesByFam.set(pointer.fam, spouses);
      }
      const node = ensureUnion(pointer.fam);
      if (pointer.marr !== undefined && node.marr === undefined) {
        node.marr = pointer.marr;
      }
    }

    for (const famc of indi.famc ?? []) {
      const key = [indi.id, famc.fam, famc.pedi ?? '', famc.famcStat ?? ''].join('|');
      if (seenEdgeKeys.has(key)) {
        continue;
      }
      seenEdgeKeys.add(key);
      ensureUnion(famc.fam);
      const edge: ParentEdge = { child: indi.id, fam: famc.fam, parents: [] };
      if (famc.pedi !== undefined) {
        edge.pedi = famc.pedi;
      }
      if (famc.famcStat !== undefined) {
        edge.famcStat = famc.famcStat;
      }
      parentEdges.push(edge);
    }
  }

  for (const node of unions) {
    node.spouses = spousesByFam.get(node.fam) ?? [];
  }
  for (const edge of parentEdges) {
    edge.parents = spousesByFam.get(edge.fam) ?? [];
  }

  return { personIds, unions, parentEdges };
}
