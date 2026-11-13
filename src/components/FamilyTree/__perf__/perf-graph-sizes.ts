/**
 * Fixture graf perf ukuran besar v442 AC2 (test-only).
 *
 * Builder member keluarga realistis untuk benchmark 2.000 dan 5.000 node:
 * struktur couples, anak 2-3 per pasangan (deterministik, tanpa random),
 * edge spouse dan parent mengikuti derivasi app (spouseIds + parentIds),
 * plus satu hub node ber-degree tinggi untuk skenario hover AC3.
 * Murni data: tanpa state, tanpa impor berkas produksi selain type.
 */
import type { Edge } from '@xyflow/react';
import type { FamilyMember } from '../../../types/family';
import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';

export interface PerfFamilyGraph {
  members: FamilyMember[];
  /** id member dengan degree edge tertinggi (target skenario hover AC3). */
  hubId: string;
  /** Kedalaman generasi graf hasil builder. */
  generations: number;
}

/**
 * Graf keluarga deterministik berukuran tepat `target` member.
 * Pola: root couple, tiap couple punya 3 lalu 2 anak bergantian, anak
 * dipasangkan dua-dua menjadi couple generasi berikutnya. Satu hub
 * (anak root pertama) diberi 24 anak agar ada node ber-edge banyak.
 */
export const buildPerfFamily = (target: number): PerfFamilyGraph => {
  const members: FamilyMember[] = [];
  const push = (
    id: string,
    generation: number,
    parentIds: string[],
    spouseIds?: string[]
  ): FamilyMember => {
    const member: FamilyMember = {
      id,
      name: `Perf Member ${id}`,
      birthDate: '1990-01-01',
      gender: id.endsWith('1') ? 'F' : 'M',
      isAlive: true,
      generation,
      maritalStatus: spouseIds ? 'married' : 'single',
      parentIds: parentIds.length > 0 ? parentIds : undefined,
      spouseIds,
    };
    members.push(member);
    return member;
  };

  // Hub ditempatkan lebih dulu supaya pasti masuk pada target besar.
  // Hub = anak pertama root, berpasangan, lalu diberi 24 anak di gen 2.
  const HUB_ID = 'perf-hub';
  const HUB_SPOUSE = 'perf-hub-spouse';
  const HUB_CHILDREN = 24;
  const hubKids: string[] = [];
  for (let i = 0; i < HUB_CHILDREN; i += 1) {
    hubKids.push(`${HUB_ID}-c${i}`);
  }

  push('perf-root', 0, [], ['perf-root-w']);
  push('perf-root-w', 0, [], ['perf-root']);
  push(HUB_ID, 1, ['perf-root', 'perf-root-w'], [HUB_SPOUSE]);
  push(HUB_SPOUSE, 1, [], [HUB_ID]);
  for (const kid of hubKids) {
    push(kid, 2, [HUB_ID, HUB_SPOUSE]);
  }

  // Antrian couple: [suami, istri] per generasi.
  let couples: Array<[string, string]> = [['perf-root', 'perf-root-w']];
  let generation = 1;
  let kidIndex = 0;

  while (members.length < target && couples.length > 0 && generation < 40) {
    const nextCouples: Array<[string, string]> = [];
    const kidsThisGen: string[] = [];
    for (let c = 0; c < couples.length && members.length < target; c += 1) {
      const kidCount = c % 2 === 0 ? 3 : 2;
      for (let k = 0; k < kidCount && members.length < target; k += 1) {
        const id = `perf-g${generation}-${kidIndex}`;
        kidIndex += 1;
        push(id, generation, [couples[c][0], couples[c][1]]);
        kidsThisGen.push(id);
      }
    }
    // Pasangkan anak dua-dua menjadi couple generasi berikutnya.
    for (let k = 0; k + 1 < kidsThisGen.length; k += 2) {
      const a = kidsThisGen[k];
      const b = kidsThisGen[k + 1];
      const ma = members.find((m) => m.id === a);
      const mb = members.find((m) => m.id === b);
      if (ma) {
        ma.spouseIds = [b];
        ma.maritalStatus = 'married';
      }
      if (mb) {
        mb.spouseIds = [a];
        mb.maritalStatus = 'married';
      }
      nextCouples.push([a, b]);
    }
    couples = nextCouples;
    generation += 1;
  }

  // Sisa slot: anak tambahan pada couple pertama supaya jumlah tepat
  // dan struktur tetap valid.
  let extra = 0;
  while (members.length < target && couples.length > 0) {
    const id = `perf-x-${extra}`;
    extra += 1;
    push(id, generation, [couples[0][0], couples[0][1]]);
  }

  return {
    members,
    hubId: HUB_ID,
    generations: generation,
  };
};

/** Node flow setara derivasi app (untuk pengukuran layout engine langsung). */
export const toFlowNodes = (members: FamilyMember[]): FamilyMemberFlowNode[] =>
  members.map((member) => ({
    id: member.id,
    type: 'familyMember' as const,
    position: { x: 0, y: member.generation * 160 },
    data: {
      member,
      onEdit: () => undefined,
      onAddChild: () => undefined,
      onAddSpouse: () => undefined,
      tier: member.generation,
    },
  }));

/**
 * Edge setara derivasi app (spouse + parentChild). Hanya untuk harness
 * layout engine; render edges sesungguhnya tetap dikerjakan komponen.
 */
export const toFlowEdges = (members: FamilyMember[]): Edge[] => {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const member of members) {
    for (const spouse of member.spouseIds ?? []) {
      const [left, right] = member.id < spouse ? [member.id, spouse] : [spouse, member.id];
      const key = `${left}|${right}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ id: `spouse-${key}`, source: left, target: right });
    }
    for (const parent of member.parentIds ?? []) {
      edges.push({ id: `parent-${parent}-${member.id}`, source: parent, target: member.id });
    }
  }
  return edges;
};
