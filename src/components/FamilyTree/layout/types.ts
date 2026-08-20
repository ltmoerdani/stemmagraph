import type { Edge } from '@xyflow/react';
import type { FamilyMemberFlowNode } from '../nodes/FamilyMemberNode';
import type { TierLayout } from './tierLayout';

/** Arah layout, dipertahankan dari kontrak lama ReactFlowFamilyTree. */
export type LayoutDirection = 'TB' | 'LR';

/** Opsi layout yang diterima engine. */
export interface LayoutEngineOptions {
  direction?: LayoutDirection;
}

/** Meta hasil layout, untuk logging dan harness dev (S-09 U6). */
export interface LayoutEngineMeta {
  /** Nama engine yang menjalankan compute. */
  engine: string;
  direction: LayoutDirection;
  nodeCount: number;
  edgeCount: number;
  tierCount: number;
  /** Durasi compute layout dalam milidetik. */
  computeMs: number;
}

/**
 * Disiplin snap grid generasi: layout TB memakai snap agar kartu tetap
 * rata pada baris generasi saat digeser manual.
 */
export interface LayoutSnapGrid {
  snapToGrid: boolean;
  snapGrid: [number, number];
}

/** Hasil layout: posisi node + tiers + meta. */
export interface LayoutResult {
  nodes: FamilyMemberFlowNode[];
  edges: Edge[];
  tiers: TierLayout[];
  /** Posisi hasil per node id, agar pemanggil bisa membaca tanpa memindai array. */
  positions: Map<string, { x: number; y: number }>;
  snap: LayoutSnapGrid;
  meta: LayoutEngineMeta;
}

/**
 * Kontrak layout engine (S-09 AC1): input nodes + edges + options,
 * output posisi node + tiers + meta. Komponen React tidak boleh
 * mengimpor library layout (dagre) langsung; hanya lewat interface ini.
 */
export interface LayoutEngine {
  readonly name: string;
  layout(
    nodes: FamilyMemberFlowNode[],
    edges: Edge[],
    options?: LayoutEngineOptions
  ): LayoutResult;
}
