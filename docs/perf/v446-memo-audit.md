# Audit Memoisasi Kanvas dan Edge (Task v446 STG Canvas Memo Fase 1)

Tanggal: 2026-11-13. Berdasarkan temuan audit v442 (docs/perf/v442-canvas-props-audit.md).

## 1. Daftar Komponen Custom Node/Edge dan Props ReactFlow

- FamilyMemberNode: custom node (`familyMember`), menerima `data` ({ member, onEdit, onDelete, onAddChild, onAddSpouse, hiddenDescendantCount, onExpandBranch }) dan prop `selected` dari React Flow.
- MarriageEdge: custom edge (`marriage`), menerima EdgeProps ({ id, sourceX, sourceY, targetX, targetY, style, markerEnd, data }).
- ParentChildEdge: custom edge (`parentChild`), menerima EdgeProps.
- SiblingEdge: custom edge (`sibling`), menerima EdgeProps.

## 2. Status Memo Sebelum (Temuan v442 P-01..P-06, T-01/T-02/T-05/T-06)

- P-01 (medium): effect revealMemberId bergantung array nodes penuh (ReactFlowFamilyTree), effect jalan tiap frame drag.
- P-02 (low): proOptions objek literal inline di JSX, referensi baru tiap render.
- P-03 (low): getSnapGrid(layoutDirection) dipanggil dua kali di JSX, objek baru tiap render.
- P-04 (low): handler inline di Panel (onGridTypeChange, onClose/onSave MemberEditModal).
- P-05 (medium): MiniMap, ExportControls, ImportControls, FamilyTreeControls belum dibungkus memo.
- P-06 (low): nodeColor MiniMap inline, fungsi baru tiap render.
- T-01 (high): TreeCanvas destructuring penuh useFamilyStore() tanpa selector.
- T-02 (high): state pan/zoom di komponen pemilik daftar kartu, re-render tiap mousemove.
- T-05 (medium): effect event listener bergantung callback yang identitasnya berubah tiap panOffset berubah.
- T-06 (low): MemberCard dan EditableMemberCard menerima objek position baru tiap render, tanpa memo.

Status komponen node/edge: FamilyMemberNode sudah memo sejak S-09; MarriageEdge, ParentChildEdge, SiblingEdge sudah memo sejak S-04.

## 3. Yang Diubah (v446)

1. ReactFlowFamilyTree.tsx: proOptions di-hoist ke konstanta module scope (P-02); snapGrid/snapToGrid di-memo satu kali per layoutDirection (P-03); handler Panel inline dipindah ke useCallback (P-04); nodeColor MiniMap di-hoist ke module scope (P-06); effect revealMemberId tidak lagi bergantung array nodes penuh, node dibaca via getNodes() dari useReactFlow (P-01).
2. TreeCanvas.tsx: selector granular zustand per field dengan useShallow (T-01); kalkulasi canvasDimensions dan memberPositions dibungkus useMemo (T-02/T-03 terkait); filteredMembers dibungkus useMemo (T-04 terkait).
3. MemberCard.tsx dan EditableMemberCard.tsx: dibungkus React.memo (M-01/T-06) dan selector granular selectedMember/editMode/setSelectedMember (M-02).
4. Test guard struktural baru: src/components/FamilyTree/__tests__/memo-guard-v446.test.ts, memindai source via fs dan assert pola memo/useCallback/larangan filter nodes penuh di badan render komponen.

Perilaku tidak berubah: drag, select, expand/collapse via hidden tetap sama (AC6). Node dan edge kustom tidak diubah karena sudah memo sebelumnya.
