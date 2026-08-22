import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Edge,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  MiniMap,
  Background,
  Connection,
  NodeTypes,
  EdgeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
  BackgroundVariant,
  NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useTranslation } from 'react-i18next';
import type { FamilyMember } from '../../types/family';
import { FamilyMemberNode, type FamilyMemberFlowNode } from './nodes/FamilyMemberNode';
import { MarriageEdge } from './edges/MarriageEdge';
import { ParentChildEdge } from './edges/ParentChildEdge';
import { SiblingEdge } from './edges/SiblingEdge';
import { ExportControls } from './controls/ExportControls';
import { FamilyTreeControls } from './controls/FamilyTreeControls';
import { MemberEditModal } from './modals/MemberEditModal';
import { constrainNodeMovement } from './layout/tierLayout';
import { dagreTierEngine, getSnapGrid, type TierLayout } from './layout';
import {
  DEFAULT_GENERATION_LIMIT_STATE,
  applyGenerationLimit,
  collapseToDefaultLimit,
  countGenerationSpan,
  expandAllGenerations,
  expandBranch,
  groupMembersByGeneration,
  hydrateStableByKey,
  type GenerationLimitState,
  type HydrationSpec,
  type StableHydrationEntry,
} from './generations';
import { shouldOnlyRenderVisibleElements } from './generations';

// Define custom node and edge types
const nodeTypes: NodeTypes = {
  familyMember: FamilyMemberNode,
};

const edgeTypes: EdgeTypes = {
  marriage: MarriageEdge,
  parentChild: ParentChildEdge,
  sibling: SiblingEdge,
};

// Layout engine diinjeksi via interface (S-09 AC1): komponen tidak
// mengimpor dagre langsung, semua compute ada di ./layout.
const layoutEngine = dagreTierEngine;

interface ReactFlowFamilyTreeProps {
  members: FamilyMember[];
  onMemberUpdate?: (member: FamilyMember) => void;
  onMemberAdd?: (member: Partial<FamilyMember>) => void;
  onMemberDelete?: (memberId: string) => void;
  /** S-14 U3: id anggota yang wajib dibuat terlihat (expand + fitView). */
  revealMemberId?: string | null;
  /** S-14 U3: dipanggil setelah viewport dipusatkan ke anggota reveal. */
  onMemberRevealed?: () => void;
}

/**
 * Handler interaksi node; komponen menyuntikkan versi stabil (S-09 AC4+AC5).
 */
export interface MemberNodeHandlers {
  onEdit: (member: FamilyMember) => void;
  onDelete?: (memberId: string) => void;
  onAddChild: (parentId: string) => void;
  onAddSpouse: (memberId: string) => void;
}

/**
 * Converts one family member to a React Flow node.
 * Posisi {0,0}: akan diisi layout engine.
 */
const createMemberNode = (
  member: FamilyMember,
  handlers: MemberNodeHandlers
): FamilyMemberFlowNode => ({
  id: member.id,
  type: 'familyMember',
  position: { x: 0, y: 0 }, // Will be set by layout algorithm
  data: {
    member,
    onEdit: handlers.onEdit,
    onDelete: handlers.onDelete,
    onAddChild: handlers.onAddChild,
    onAddSpouse: handlers.onAddSpouse,
  },
  draggable: true,
});

/**
 * Creates edge hydration specs between family members (S-09 AC4).
 * sources = objek member yang menjadi dasar edge; selama referensinya
 * tidak berubah, edge lama dipakai ulang (tidak dibangun ulang).
 */
const createFamilyEdgeSpecs = (
  members: FamilyMember[]
): HydrationSpec<FamilyMember, Edge>[] => {
  const specs: HydrationSpec<FamilyMember, Edge>[] = [];
  const byId = new Map(members.map((member) => [member.id, member]));
  const siblingsMap = new Map<string, FamilyMember[]>();
  // QA put-1 Temuan-3: dedup edge marriage per pasangan. Kunci = id pasangan
  // terurut leksikografis, menggantikan banding member.id < spouse.id yang
  // gagal saat id baru lebih besar secara leksikografis.
  const marriageSeen = new Set<string>();

  members.forEach((member) => {
    // Create spouse connections (direct horizontal lines), satu edge per pasangan
    const spouseList = member.spouseIds ?? (member.spouseId ? [member.spouseId] : []);
    spouseList.forEach((rawSpouseId) => {
      const spouse = byId.get(rawSpouseId);
      if (!spouse) return;
      const [left, right] = member.id < spouse.id ? [member, spouse] : [spouse, member];
      const pairKey = `${left.id}|${right.id}`;
      if (marriageSeen.has(pairKey)) return;
      marriageSeen.add(pairKey);
      specs.push({
        key: `spouse-${left.id}-${right.id}`,
        sources: [left, right],
        build: () => ({
          id: `spouse-${left.id}-${right.id}`,
          source: left.id,
          target: right.id,
          type: 'marriage', // Uses simplified MarriageEdge
          data: { relationship: 'spouse' },
        }),
      });
    });

    // Create parent-child edges (bracket style)
    if (member.parentIds && member.parentIds.length > 0) {
      member.parentIds.forEach((parentId) => {
        const parent = byId.get(parentId);
        specs.push({
          key: `parent-${parentId}-${member.id}`,
          sources: [member, parent ?? member],
          build: () => ({
            id: `parent-${parentId}-${member.id}`,
            source: parentId,
            target: member.id,
            type: 'parentChild',
            data: { relationship: 'parentChild' },
          }),
        });
      });

      // Group siblings for bracket connections
      const sortedParentIds = [...member.parentIds].sort((a, b) => a.localeCompare(b));
      const parentKey = sortedParentIds.join('-');
      if (!siblingsMap.has(parentKey)) {
        siblingsMap.set(parentKey, []);
      }
      siblingsMap.get(parentKey)?.push(member);
    }
  });

  // Create sibling connections in bracket style
  siblingsMap.forEach((siblings) => {
    if (siblings.length > 1) {
      for (let i = 0; i < siblings.length - 1; i++) {
        const left = siblings[i];
        const right = siblings[i + 1];
        specs.push({
          key: `sibling-${left.id}-${right.id}`,
          sources: [left, right],
          build: () => ({
            id: `sibling-${left.id}-${right.id}`,
            source: left.id,
            target: right.id,
            type: 'sibling',
            data: { relationship: 'sibling' },
          }),
        });
      }
    }
  });

  return specs;
};

type GridPatternType = 'dots' | 'lines' | 'cross';

/**
 * Helper grid murni (S-09 AC5): di-hoist keluar komponen supaya identitas
 * fungsi stabil antar render.
 */
const convertToBackgroundVariant = (pattern: GridPatternType): BackgroundVariant => {
  return pattern as BackgroundVariant;
};

const getGridBackgroundColor = (variant: BackgroundVariant): string => {
  switch (variant) {
    case 'dots':
      return '#d1d5db';
    case 'cross':
      return '#e5e7eb';
    default:
      return '#e5e7eb';
  }
};

const getGridGap = (variant: BackgroundVariant): number => {
  return variant === 'lines' ? 25 : 30;
};

const getGridSize = (variant: BackgroundVariant): number => {
  switch (variant) {
    case 'dots':
      return 1;
    case 'cross':
      return 0.5;
    default:
      return 0.5;
  }
};

const ReactFlowFamilyTreeInner: React.FC<ReactFlowFamilyTreeProps> = ({
  members,
  onMemberUpdate,
  onMemberAdd,
  onMemberDelete,
  revealMemberId,
  onMemberRevealed,
}) => {
  const { fitView, getNodes, getEdges } = useReactFlow<FamilyMemberFlowNode, Edge>();
  const [nodes, setNodes, onNodesChange] = useNodesState<FamilyMemberFlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [layoutDirection, setLayoutDirection] = useState<'TB' | 'LR'>('TB');
  const [tiers, setTiers] = useState<TierLayout[]>([]);
  const [gridType, setGridType] = useState<GridPatternType>('lines');
  const [showGrid, setShowGrid] = useState(true);
  const [generationLimitState, setGenerationLimitState] = useState<GenerationLimitState>(
    DEFAULT_GENERATION_LIMIT_STATE
  );
  const { t } = useTranslation('canvas');

  // S-09 AC2: batas generasi (pure function, default-on)
  const generationLimit = useMemo(
    () => applyGenerationLimit(members, generationLimitState),
    [members, generationLimitState]
  );
  const visibleMembers = generationLimit.visibleMembers;
  // S-09 AC7: rentang generasi total untuk label batas (satuan generasi,
  // bukan jumlah individu).
  const totalGenerations = useMemo(
    () => countGenerationSpan(members),
    [members]
  );

  // S-09 AC2: kontrol cabang; ekspansi penuh lewat konfirmasi i18n.
  const handleExpandBranch = useCallback((memberId: string) => {
    setGenerationLimitState((state) => expandBranch(state, memberId));
  }, []);
  const handleCollapseGenerations = useCallback(() => {
    setGenerationLimitState((state) => collapseToDefaultLimit(state));
  }, []);
  const handleExpandAllGenerations = useCallback(() => {
    if (window.confirm(t('generations.expandAllWarning', { count: members.length }))) {
      setGenerationLimitState((state) => expandAllGenerations(state));
    }
  }, [t, members.length]);

  // S-09 AC5: handler interaksi hoist + delegasi ref. Node yang dipakai
  // ulang oleh cache hidrasi memanggil handler lewat actionsRef, jadi
  // tidak ada closure basi saat prop onMemberAdd/onMemberDelete berganti.
  const membersRef = useRef(new Map<string, FamilyMember>());
  membersRef.current = new Map(members.map((member) => [member.id, member]));

  const actionsRef = useRef<MemberNodeHandlers>({
    onEdit: setEditingMember,
    onDelete: onMemberDelete,
    onAddChild: () => undefined,
    onAddSpouse: () => undefined,
  });
  actionsRef.current = {
    onEdit: setEditingMember,
    onDelete: onMemberDelete,
    onAddChild: (parentId: string) => {
      if (onMemberAdd) {
        const parentMember = membersRef.current.get(parentId);
        onMemberAdd({
          parentIds: [parentId],
          generation: (parentMember?.generation ?? 0) + 1,
        });
      }
    },
    onAddSpouse: (memberId: string) => {
      if (onMemberAdd) {
        const selfMember = membersRef.current.get(memberId);
        onMemberAdd({
          spouseId: memberId,
          generation: selfMember?.generation ?? 0,
        });
      }
    },
  };

  // Factory node stabil: hanya bergantung handler expand yang useCallback.
  const buildMemberNode = useCallback(
    (member: FamilyMember, hiddenDescendantCount: number | undefined) => {
      const base = createMemberNode(member, {
        onEdit: (m) => actionsRef.current.onEdit(m),
        onDelete: (id) => actionsRef.current.onDelete?.(id),
        onAddChild: (id) => actionsRef.current.onAddChild(id),
        onAddSpouse: (id) => actionsRef.current.onAddSpouse(id),
      });
      return {
        ...base,
        data: {
          ...base.data,
          onExpandBranch: handleExpandBranch,
          hiddenDescendantCount,
        },
      };
    },
    [handleExpandBranch]
  );

  // S-09 AC4: konstruksi nodes/edges memo per lingkup generasi dengan
  // cache referensi; expand satu cabang hanya membangun node baru pada
  // cabang itu, node lama dipakai ulang dengan referensi identik.
  const nodesCacheRef = useRef<Map<string, StableHydrationEntry<FamilyMember | number, FamilyMemberFlowNode>>>(
    new Map()
  );
  const edgesCacheRef = useRef<Map<string, StableHydrationEntry<FamilyMember, Edge>>>(
    new Map()
  );

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodeSpecs: HydrationSpec<FamilyMember | number, FamilyMemberFlowNode>[] = [];
    const byGeneration = groupMembersByGeneration(visibleMembers);
    for (const generationMembers of byGeneration.values()) {
      for (const member of generationMembers) {
        const hiddenCount = generationLimit.hiddenDescendantCounts.get(member.id);
        nodeSpecs.push({
          key: member.id,
          sources: [member, hiddenCount ?? 0],
          build: () => buildMemberNode(member, hiddenCount),
        });
      }
    }
    const hydratedNodes = hydrateStableByKey(nodesCacheRef.current, nodeSpecs);
    nodesCacheRef.current = hydratedNodes.cache;

    const edgeSpecs = createFamilyEdgeSpecs(visibleMembers);
    const hydratedEdges = hydrateStableByKey(edgesCacheRef.current, edgeSpecs);
    edgesCacheRef.current = hydratedEdges.cache;

    return {
      initialNodes: hydratedNodes.values,
      initialEdges: hydratedEdges.values,
    };
  }, [visibleMembers, generationLimit, buildMemberNode]);

  // Apply tier layout when members change
  useEffect(() => {
    // Semua algoritma layout (tier TB / dagre LR) berada di engine.
    const result = layoutEngine.layout(initialNodes, initialEdges, {
      direction: layoutDirection,
    });

    setNodes(result.nodes);
    setEdges(layoutDirection === 'TB' ? initialEdges : result.edges);
    setTiers(result.tiers);

    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [initialNodes, initialEdges, layoutDirection, setNodes, setEdges, fitView]);

  // S-14 U3: anggota baru wajib terlihat pasca simpan. Bila id berada di
  // luar jendela generasi, buka cabang leluhurnya; begitu nodenya sudah
  // ada di canvas, pusatkan viewport ke node itu (delay 220ms agar
  // mengalahkan fitView generik pasca-layout).
  useEffect(() => {
    if (!revealMemberId) return;
    if (!membersRef.current.has(revealMemberId)) return;
    if (!visibleMembers.some((m) => m.id === revealMemberId)) {
      const member = membersRef.current.get(revealMemberId);
      const parentId =
        member?.parentIds && member.parentIds.length > 0 ? member.parentIds[0] : undefined;
      setGenerationLimitState((state) =>
        parentId ? expandBranch(state, parentId) : expandAllGenerations(state)
      );
      return;
    }
    const node = nodes.find((n) => n.id === revealMemberId);
    if (node) {
      const targetId = revealMemberId;
      const timer = setTimeout(() => {
        fitView({ nodes: [{ id: targetId }], padding: 0.35, duration: 400, maxZoom: 1.25 });
        onMemberRevealed?.();
      }, 220);
      return () => clearTimeout(timer);
    }
  }, [revealMemberId, visibleMembers, nodes, fitView, onMemberRevealed]);

  // Custom node change handler to constrain movement
  const handleNodesChange = useCallback((changes: NodeChange<FamilyMemberFlowNode>[]) => {
    if (layoutDirection === 'TB' && tiers.length > 0) {
      const constrainedChanges = changes.map(change => {
        if (change.type === 'position' && 'position' in change && change.position) {
          const constrainedPosition = constrainNodeMovement(
            change.id,
            change.position,
            tiers
          );
          return {
            ...change,
            position: constrainedPosition
          };
        }
        return change;
      });
      onNodesChange(constrainedChanges);
    } else {
      onNodesChange(changes);
    }
  }, [onNodesChange, layoutDirection, tiers]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  const handleLayoutChange = useCallback((direction: 'TB' | 'LR') => {
    setLayoutDirection(direction);
  }, []);

  const handleAutoLayout = useCallback(() => {
    const result = layoutEngine.layout(getNodes(), getEdges(), {
      direction: layoutDirection,
    });

    setNodes(result.nodes);
    setEdges(layoutDirection === 'TB' ? getEdges() : result.edges);
    setTiers(result.tiers);

    setTimeout(() => {
      fitView({ padding: 0.2 });
    }, 100);
  }, [getNodes, getEdges, layoutDirection, setNodes, setEdges, fitView]);

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 800 });
  }, [fitView]);


  return (
    <div className="w-full h-full relative">
      <ReactFlow<FamilyMemberFlowNode>
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        attributionPosition={undefined} // Remove React Flow attribution
        className="bg-gray-50"
        minZoom={0.1}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
        snapToGrid={getSnapGrid(layoutDirection).snapToGrid}
        snapGrid={getSnapGrid(layoutDirection).snapGrid}
        onlyRenderVisibleElements={shouldOnlyRenderVisibleElements(nodes.length)}
        proOptions={{
          hideAttribution: true // Hide React Flow attribution if using Pro
        }}
      >
        {/* Enhanced Background with softer grid pattern */}
        {showGrid && (
          <Background 
            variant={convertToBackgroundVariant(gridType)}
            gap={getGridGap(convertToBackgroundVariant(gridType))}
            size={getGridSize(convertToBackgroundVariant(gridType))}
            color={getGridBackgroundColor(convertToBackgroundVariant(gridType))}
            style={{
              backgroundColor: '#fafafa',
              opacity: 0.4,
            }}
          />
        )}
        
        {/* Major grid lines - much softer with adjusted spacing */}
        {showGrid && gridType === 'lines' && (
          <Background 
            variant={convertToBackgroundVariant('lines')}
            gap={125}
            size={1}
            color="#d1d5db"
            offset={0}
            style={{
              opacity: 0.15,
            }}
          />
        )}

        {/* Controls for zoom, fit view, etc. */}
        <Controls 
          position="bottom-right"
          showInteractive={false}
          className="bg-white border border-gray-300 rounded-lg shadow-lg"
        />

        {/* Minimap for navigation */}
        <MiniMap
          position="bottom-left"
          className="bg-white border border-gray-300 rounded-lg shadow-lg"
          nodeColor={(node) => {
            const member = node.data?.member as FamilyMember;
            if (!member) return '#e5e7eb';
            return member.gender === 'male' ? '#3b82f6' : '#ec4899';
          }}
          maskColor="rgba(0, 0, 0, 0.1)"
          pannable
          zoomable
        />

        {/* Custom control panels */}
        <Panel position="top-left" className="space-y-2">
          <FamilyTreeControls
            onLayoutChange={handleLayoutChange}
            onAutoLayout={handleAutoLayout}
            onFitView={handleFitView}
            currentLayout={layoutDirection}
            gridType={convertToBackgroundVariant(gridType)}
            showGrid={showGrid}
            onGridTypeChange={(type: BackgroundVariant) => {
              setGridType(type as GridPatternType);
            }}
            onGridToggle={setShowGrid}
          />
        </Panel>

        <Panel position="top-right">
          <ExportControls />
        </Panel>

        {/* Tier indicators for vertical layout */}
        {layoutDirection === 'TB' && tiers.length > 0 && (
          <Panel position="top-center" className="pointer-events-none">
            <div className="text-xs text-gray-500 bg-white/80 px-2 py-1 rounded">
              {t('generations.tierIndicator', { count: tiers.length })}
            </div>
          </Panel>
        )}

        {/* S-09 AC2: kontrol batas generasi */}
        {(generationLimitState.fullExpand ||
          generationLimitState.expandedBranches.size > 0 ||
          generationLimit.hiddenDescendantCounts.size > 0) && (
          <Panel position="top-center" className="mt-10">
            <div className="flex items-center gap-2 text-xs bg-white/90 border border-gray-200 px-2 py-1 rounded">
              <span className="text-gray-600">
                {generationLimitState.fullExpand
                  ? t('generations.expandAll')
                  : t('generations.limitNotice', {
                      shown: generationLimitState.maxGenerations,
                      total: totalGenerations,
                    })}
              </span>
              {!generationLimitState.fullExpand && (
                <button
                  type="button"
                  className="px-2 py-0.5 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-100"
                  onClick={handleExpandAllGenerations}
                >
                  {t('generations.expandAll')}
                </button>
              )}
              {(generationLimitState.fullExpand ||
                generationLimitState.expandedBranches.size > 0) && (
                <button
                  type="button"
                  className="px-2 py-0.5 border border-gray-300 rounded text-gray-700 bg-white hover:bg-gray-100"
                  onClick={handleCollapseGenerations}
                >
                  {t('generations.collapse')}
                </button>
              )}
            </div>
          </Panel>
        )}
      </ReactFlow>

      {/* Edit Member Modal */}
      {editingMember && (
        <MemberEditModal
          member={editingMember}
          isOpen={!!editingMember}
          onClose={() => setEditingMember(null)}
          onSave={(updatedMember) => {
            if (onMemberUpdate) {
              onMemberUpdate(updatedMember);
            }
            setEditingMember(null);
          }}
        />
      )}
    </div>
  );
};

export const ReactFlowFamilyTree: React.FC<ReactFlowFamilyTreeProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ReactFlowFamilyTreeInner {...props} />
    </ReactFlowProvider>
  );
};