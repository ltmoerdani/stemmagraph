/**
 * Merge anggota duplikat, logika keputusan pure (v390 fase 1).
 *
 * Modul ini TIDAK menyentuh database: semua fungsi menerima data polos
 * (bentuk baris prisma yang sudah dibaca) dan mengembalikan keputusan
 * atau rencana transformasi. Eksekusi transaksional ada di server/index.ts
 * (POST /api/v1/trees/:treeId/members/:memberId/merge).
 *
 * Aturan inti sesuai GOAL v390:
 * - relasi FamilyRelationship yang menunjuk ke duplikat di-rewire ke
 *   primary dengan dedup baris ganda (pasangan relasi identik tidak
 *   diduplikat);
 * - facts (GenealogyEvent) duplikat dipindah-assign ke primary tanpa
 *   menimpa nilai existing (konflik dibiarkan dua-duanya hidup);
 * - duplikat ditandai mergedIntoId + mergedAt tanpa penghapusan baris;
 * - guard: self, sudah merged, cycle parent-child.
 * Deterministik, tanpa I/O, tanpa dependency.
 */

/** Bentuk baris relasi minimal yang dibutuhkan perencana merge. */
export interface MergeRelRow {
  id: string;
  memberId: string;
  relatedId: string;
  type: string;
}

/** Bentuk baris event minimal yang dibutuhkan perencana merge. */
export interface MergeEventRow {
  id: string;
  memberId: string;
  type: string;
}

/**
 * Cek cycle parent-child: apakah `candidateId` adalah leluhur atau
 * turunan langsung primary di graf FamilyRelationship type parent.
 *
 * Semantik type mengikuti kontrak repo (server/index.ts v284): type
 * 'parent' berarti memberId orang tua dari relatedId; 'child' kebalikannya.
 * Traversal dua arah dari primary lewat edge parent/child (dedup per node).
 */
export function isParentChildConnected(
  primaryId: string,
  candidateId: string,
  rels: MergeRelRow[],
): boolean {
  const adjacency = new Map<string, string[]>();
  const push = (from: string, to: string): void => {
    const list = adjacency.get(from);
    if (list) list.push(to);
    else adjacency.set(from, [to]);
  };
  for (const r of rels) {
    if (r.type === 'parent') {
      push(r.memberId, r.relatedId); // memberId orang tua dari relatedId
      push(r.relatedId, r.memberId); // inverse utk traversal dua arah
    } else if (r.type === 'child') {
      push(r.relatedId, r.memberId); // relatedId anak: sisi orangtua
      push(r.memberId, r.relatedId); // memberId anak: sisi anak
    }
  }
  // BFS dari primary, cari candidate. Multi-hop disengaja: merge leluhur
  // jauh maupun langsung sama-sama merusak graf parent-child.
  const visited = new Set<string>([primaryId]);
  const queue = [primaryId];
  while (queue.length > 0) {
    const cur = queue.shift() as string;
    for (const nxt of adjacency.get(cur) ?? []) {
      if (nxt === candidateId) return true;
      if (!visited.has(nxt)) {
        visited.add(nxt);
        queue.push(nxt);
      }
    }
  }
  return false;
}

/**
 * Kunci kanonik satu relasi untuk dedup pasca rewire. Parent/child adalah
 * inverse sempurna menurut kontrak repo (type 'parent' = memberId orang
 * tua, 'child' kebalikannya), jadi K->P parent dan P->K child adalah dua
 * baris yang menyatakan hubungan sama dan harus dianggap identik.
 * Spouse simetris (arah tak penting). Type lain dipakai apa adanya.
 */
function canonicalRelKey(memberId: string, relatedId: string, type: string): string {
  if (type === 'parent') return `pc:${memberId}>${relatedId}`;
  if (type === 'child') return `pc:${relatedId}>${memberId}`;
  if (type === 'spouse') return `spouse:${[memberId, relatedId].sort().join('~')}`;
  return `t:${type}:${memberId}>${relatedId}`;
}

/**
 * Rencana rewire relasi: setiap relasi yang menunjuk ke duplikat diarahkan
 * ke primary, baris yang identik (kanonik, lihat canonicalRelKey) dengan
 * baris yang tetap hidup dihapus dari rencana update (dedup baris ganda,
 * termasuk pasangan mirror parent/child dan spouse dua arah).
 *
 * Return:
 * - rewire: id relasi yang perlu di-update (satu sisi saja yang menunjuk
 *   duplikat; relasi antara primary dan duplikat sendiri dihapus).
 * - delete: id relasi yang harus dihapus (primary<->duplicate edge,
 *   atau relasi yang menjadi duplikat kanonik baris lain).
 */
export interface RewirePlan {
  rewire: string[];
  delete: string[];
}

export function planRelationshipRewire(
  duplicateId: string,
  primaryId: string,
  rels: MergeRelRow[],
): RewirePlan {
  const rewire: string[] = [];
  const del: string[] = [];
  // kunci kanonik baris hidup (tidak menyentuh duplikat) untuk dedup.
  const liveKeys = new Set<string>();
  for (const r of rels) {
    if (r.memberId !== duplicateId && r.relatedId !== duplicateId) {
      liveKeys.add(canonicalRelKey(r.memberId, r.relatedId, r.type));
    }
  }
  for (const r of rels) {
    if (r.memberId === duplicateId && r.relatedId === duplicateId) {
      // mustahil secara domain, tapi dijawab konsisten: hapus.
      del.push(r.id);
      continue;
    }
    if (r.memberId !== duplicateId && r.relatedId !== duplicateId) continue;
    // relasi primary<->duplicate: edge internal merge, hapus.
    if (r.memberId === primaryId || r.relatedId === primaryId) {
      del.push(r.id);
      continue;
    }
    // satu sisi menunjuk duplikat: arahkan ke primary.
    const nextMemberId = r.memberId === duplicateId ? primaryId : r.memberId;
    const nextRelatedId = r.relatedId === duplicateId ? primaryId : r.relatedId;
    const key = canonicalRelKey(nextMemberId, nextRelatedId, r.type);
    if (liveKeys.has(key)) {
      del.push(r.id); // baris ganda (persis atau mirror) setelah rewire, hapus.
    } else {
      liveKeys.add(key);
      rewire.push(r.id);
    }
  }
  return { rewire, delete: del };
}

/**
 * Rencana reassign facts (GenealogyEvent) dari duplikat ke primary.
 * Aturan GOAL: tanpa menimpa nilai existing; konflik dibiarkan dua-duanya
 * hidup di sisi primary. Semua event duplikat dipindah (memberId ganti),
 * tidak ada yang dihapus atau diubah isinya.
 */
export function planEventReassign(events: MergeEventRow[]): string[] {
  return events.map((e) => e.id);
}
