/**
 * Generation count (v282 fase i): modul PURE untuk komputasi jumlah generasi
 * dari daftar edge relasi orang tua anak, pilar 2 VISION-stemmagraph.
 * Tanpa import server/, tanpa prisma, tanpa fetch, tanpa jaringan.
 *
 * Semantik (kontrak kukuh v282, 18 Okt 2026):
 *   Founder tanpa orang tua depth 1.
 *   Depth anak = 1 + maksimum depth kedua orang tua (multi-parent ambil maks).
 *   generationCount = maksimum depth; 0 bila nihil edge.
 *   Komponen terpisah dihitung independen, hasil ambil maks global.
 *   Anggota terjangkau dua jalur ambil maksimum depth jalur terpanjang.
 *
 * Siklus: dideteksi DFS dan diputus deterministik. Urutan pemutusan
 * parentId ascending: dari semua edge yang berada pada siklus, edge dengan
 * parentId terkecil dihapus lebih dulu; tie dipecah childId ascending.
 * Setiap iterasi menghapus tepat satu edge sehingga loop berhingga,
 * nihil infinite loop. Input edge duplikat didedupe sebelum analisis.
 *
 * Deterministik: edges dan node diurutkan id ascending sebelum diproses,
 * urutan input tidak mengubah hasil.
 *
 * Param now? ada demi keseragaman tanda tangan modul stats (pola v278);
 * kedalaman generasi tidak bergantung waktu, jadi fase i tidak memakainya.
 */

export interface GenerationEdge {
  childId: string;
  parentId: string;
}

export interface GenerationsResult {
  depthByMember: Record<string, number>;
  generationCount: number;
}

/** Urutan kanonik edge: childId asc lalu parentId asc. */
function compareEdges(a: GenerationEdge, b: GenerationEdge): number {
  if (a.childId !== b.childId) {
    return a.childId < b.childId ? -1 : 1;
  }
  if (a.parentId !== b.parentId) {
    return a.parentId < b.parentId ? -1 : 1;
  }
  return 0;
}

/**
 * Kumpulkan node unik dari edges, urut id ascending.
 * Edge duplikat didedupe lewat key childId + pemisah + parentId.
 */
function normalizeEdges(edges: GenerationEdge[]): GenerationEdge[] {
  const seen = new Set<string>();
  const unique: GenerationEdge[] = [];
  for (const e of edges) {
    const key = `${e.childId}\u0000${e.parentId}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push({ childId: e.childId, parentId: e.parentId });
    }
  }
  unique.sort(compareEdges);
  return unique;
}

/**
 * Deteksi satu siklus mana pun via DFS berwarna pada adjacency sorted.
 * Mengembalikan daftar edge yang berada pada siklus yang ditemukan;
 * array kosong bila graf acyclic. Traversal node dan tetangga selalu
 * urut id sehingga siklus yang ditemukan deterministik terhadap input.
 */
function findCycleEdges(edges: GenerationEdge[]): GenerationEdge[] {
  const childrenOf = new Map<string, string[]>();
  const nodes = new Set<string>();
  for (const e of edges) {
    nodes.add(e.childId);
    nodes.add(e.parentId);
    const list = childrenOf.get(e.parentId);
    if (list) {
      list.push(e.childId);
    } else {
      childrenOf.set(e.parentId, [e.childId]);
    }
  }
  for (const list of childrenOf.values()) {
    list.sort();
  }
  const sortedNodes = [...nodes].sort();

  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of sortedNodes) {
    color.set(n, WHITE);
  }

  // Path edge dari root DFS ke posisi saat ini, untuk rekonstruksi siklus.
  const pathEdges: GenerationEdge[] = [];

  const dfs = (id: string): GenerationEdge[] => {
    color.set(id, GRAY);
    const kids = childrenOf.get(id) ?? [];
    for (const child of kids) {
      const edge: GenerationEdge = { childId: child, parentId: id };
      const state = color.get(child) ?? WHITE;
      if (state === GRAY) {
        // Back edge: rekonstruksi siklus dari path hingga child.
        const cycle: GenerationEdge[] = [edge];
        for (let i = pathEdges.length - 1; i >= 0; i -= 1) {
          cycle.push(pathEdges[i]);
          if (pathEdges[i].parentId === child) {
            break;
          }
        }
        return cycle;
      }
      if (state === WHITE) {
        pathEdges.push(edge);
        const found = dfs(child);
        if (found.length > 0) {
          return found;
        }
        pathEdges.pop();
      }
    }
    color.set(id, BLACK);
    return [];
  };

  for (const n of sortedNodes) {
    if ((color.get(n) ?? WHITE) === WHITE) {
      pathEdges.length = 0;
      const found = dfs(n);
      if (found.length > 0) {
        return found;
      }
    }
  }
  return [];
}

/**
 * Urutan prioritas pemutusan siklus sesuai kontrak: parentId ascending,
 * tie dipecah childId ascending.
 */
function compareBreakPriority(a: GenerationEdge, b: GenerationEdge): number {
  if (a.parentId !== b.parentId) {
    return a.parentId < b.parentId ? -1 : 1;
  }
  if (a.childId !== b.childId) {
    return a.childId < b.childId ? -1 : 1;
  }
  return 0;
}

/**
 * Putus semua siklus secara deterministik: tiap iterasi pilih edge siklus
 * dengan parentId terkecil (tie childId terkecil) untuk dihapus.
 * Maksimal sebanyak jumlah edge iterasi, jadi berhingga.
 */
function breakCycles(edges: GenerationEdge[]): GenerationEdge[] {
  let current = edges;
  for (;;) {
    const cycle = findCycleEdges(current);
    if (cycle.length === 0) {
      return current;
    }
    let victim = cycle[0];
    for (const e of cycle) {
      if (compareBreakPriority(e, victim) < 0) {
        victim = e;
      }
    }
    current = current.filter(
      (e) => !(e.childId === victim.childId && e.parentId === victim.parentId)
    );
  }
}

export function computeGenerations(
  edges: GenerationEdge[],
  now?: Date
): GenerationsResult {
  void now; // compat signature, fase i tidak bergantung waktu

  const normalized = breakCycles(normalizeEdges(edges));
  const nodes = new Set<string>();
  for (const e of normalized) {
    nodes.add(e.childId);
    nodes.add(e.parentId);
  }
  if (nodes.size === 0) {
    return { depthByMember: {}, generationCount: 0 };
  }

  // parentOf: anak ke daftar orang tua (sorted ascending di normalizeEdges).
  const parentsOf = new Map<string, string[]>();
  for (const e of normalized) {
    const list = parentsOf.get(e.childId);
    if (list) {
      list.push(e.parentId);
    } else {
      parentsOf.set(e.childId, [e.parentId]);
    }
  }

  // Depth memoized, rekursi aman karena graf sudah acyclic.
  const depthMemo = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depthMemo.get(id);
    if (cached !== undefined) {
      return cached;
    }
    const parents = parentsOf.get(id) ?? [];
    let maxParent = 0;
    for (const p of parents) {
      const d = depthOf(p);
      if (d > maxParent) {
        maxParent = d;
      }
    }
    const result = maxParent + 1;
    depthMemo.set(id, result);
    return result;
  };

  const depthByMember: Record<string, number> = {};
  let generationCount = 0;
  for (const id of [...nodes].sort()) {
    const d = depthOf(id);
    depthByMember[id] = d;
    if (d > generationCount) {
      generationCount = d;
    }
  }

  return { depthByMember, generationCount };
}
