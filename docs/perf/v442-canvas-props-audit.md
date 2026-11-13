# Audit Props Kanvas FamilyTree (GOAL v442, AC1)

Tanggal: 2026-11-13. Basis kode: develop 491070d. Pustaka: @xyflow/react 12.11.0.
Ruangan lingkup: src/components/FamilyTree (ReactFlowFamilyTree.tsx, TreeCanvas.tsx, dan turunan node/edge kustom).
Metode: baca kode statis, cocokkan dengan checklist kinerja resmi React Flow v12.
Referensi checklist: reactflow.dev docs "optimize for performance" (12.x), poin dirangkum di bagian 1.

## 1. Ringkasan checklist resmi React Flow v12 yang dipakai sebagai acuan

1. Custom node dan edge wajib dibungkus React.memo agar drag, zoom, atau seleksi satu elemen tidak memicu re-render seluruh elemen.
2. Referensi data node/edge harus stabil (props objek atau array baru tiap render membuat memo tidak berguna).
3. nodeTypes dan edgeTypes wajib identitasnya stabil: didefinisikan di module scope atau useMemo; definisi inline di JSX membuat semua node re-render.
4. Handler yang dipass ke ReactFlow atau ke node wajib stabil: useCallback untuk fungsi, useMemo untuk objek/array.
5. Bila komponen membaca state internal React Flow (useStore), wajib selector sempit plus shallow compare (useShallow atau equalityFn); membaca objek state penuh membuat re-render massal.
6. Membaca state nodes penuh pada komponen pemilik state (useNodesState) membuat komponen itu re-render setiap frame drag; hindari bergantung pada array nodes untuk keperluan yang tidak butuh per-frame.
7. Graf besar: aktifkan onlyRenderVisibleElements; render node dipaginasi; hanya elemen di viewport yang di-mount.

## 2. Temuan per file

### ReactFlowFamilyTree.tsx (kontainer React Flow, jalur utama)

Sudah sesuai:
- nodeTypes dan edgeTypes di module scope (baris 51-59), identitas stabil.
- FamilyMemberNode memo; ketiga edge kustom memo.
- Referensi node/edge stabil lewat cache hidrasi hydrateStableByKey (S-09 AC4): node lama dipakai ulang bila sources tidak berubah, sehingga memo node efektif.
- Handler utama stabil: handleExpandBranch, handleCollapseGenerations, handleExpandAllGenerations, buildMemberNode, handleNodesChange, onConnect, handleLayoutChange, handleAutoLayout, handleFitView (useCallback).
- ariaLabelConfig pakai useMemo.
- shouldOnlyRenderVisibleElements aktif dengan threshold 500 plus override perf (S-09 AC3).

Pelanggaran:
- P-01 (medium): effect revealMemberId bergantung array `nodes` penuh (baris 421-442). useNodesState mengganti array tiap frame drag, jadi effect jalan tiap frame; isinya visibleMembers.some O(n) plus nodes.find O(n). Saran: ambil node via getNodes() dari useReactFlow di dalam callback, keluarkan nodes dari dependensi.
- P-02 (low): proOptions objek literal inline di JSX (baris 517-519), referensi baru tiap render. Saran: konstanta module scope.
- P-03 (low): getSnapGrid(layoutDirection) dipanggil dua kali di JSX (baris 511-512); bila mengembalikan objek literal, referensi baru tiap render. Saran: memo satu kali per layoutDirection.
- P-04 (low): handler inline di Panel: onGridTypeChange (baris 579-581), onClose dan onSave MemberEditModal (baris 645-651). Panel kecil, dampak rendah, tetap termasuk checklist poin 4.
- P-05 (medium): MiniMap, ExportControls, ImportControls, FamilyTreeControls tidak dibungkus memo; komponen Inner re-render tiap frame drag (pemilik useNodesState), semua panel ikut re-render per frame. Saran: React.memo komponen kontrol, karena props-nya stabil atau bisa dibuat stabil.
- P-06 (low): nodeColor MiniMap inline (baris 560-564), fungsi baru tiap render. Saran: hoist ke module scope.

### nodes/FamilyMemberNode.tsx

Sudah sesuai: React.memo dengan displayName; data referensi stabil dari cache hidrasi; handler internal hanya untuk JSX lokal.

Catatan:
- N-01 (low, informasional): useTranslation dipanggil di setiap node; graf 5.000 node berarti 5.000 langganan i18n. Checklist resmi tidak melarang, dicatat sebagai risiko memori pada graf besar.
- N-02 (low): tidak ada custom comparator memo. Shallow compare default sudah cukup karena data stabil; perubahan hiddenDescendantCount memang harus memicu render.

### edges/MarriageEdge.tsx, ParentChildEdge.tsx, SiblingEdge.tsx

Sudah sesuai: ketiganya React.memo plus displayName (S-04 fase i). Tidak ada pelanggaran. Konstruksi path string per render murah dan tak terhindarkan.

### TreeCanvas.tsx (jalur DOM klasik, bukan React Flow)

Pelanggaran:
- T-01 (high): useFamilyStore() destructuring penuh tanpa selector (baris 61). Re-render total setiap slice store berubah. Saran: selector mikro per field plus useShallow.
- T-02 (high): setPanOffset dan state pan/zoom lain berada di komponen pemilik daftar kartu; tiap mousemove saat pan memicu re-render seluruh kartu, connections, dan label. Saran: pindahkan transform ke ref (manipulasi style langsung) atau pisahkan komponen pan dari daftar kartu.
- T-03 (medium): calculateCanvasDimensions dan calculateMemberPositions dibungkus useCallback tapi dipanggil langsung tiap render (baris 113, 172); hasil tidak dimemo. Saran: useMemo.
- T-04 (medium): filteredMembers filter inline tanpa useMemo (baris 420-425), array baru tiap render, dipass ke FamilyTreeConnections dan peta kartu.
- T-05 (medium): effect pemasangan event listener bergantung callback yang identitasnya berubah tiap panOffset berubah (handleWheel dan handleMouseDown bergantung panOffset, baris 276-314); removeEventListener dan addEventListener jalan tiap frame pan. Saran: simpan state pan di ref, bukan dependensi callback.
- T-06 (low): MemberCard dan EditableMemberCard menerima position objek hasil kalkulasi baru tiap render; tanpa memo di kedua kartu, tidak ada penghalang re-render.

### MemberCard.tsx dan EditableMemberCard.tsx

- M-01 (high): keduanya tanpa React.memo.
- M-02 (high): useFamilyStore() penuh padahal hanya perlu selectedMember (MemberCard baris 20); EditableMemberCard perlu selectedMember plus editMode. Re-render semua kartu saat slice apa pun berubah.
- M-03 (low): handler internal tanpa useCallback; dampak kecil karena tidak dipass ke child memoized, tetap dicatat untuk kelengkapan checklist.

### FamilyTreeConnections.tsx

- C-01 (medium): tanpa memo; props members (array baru) dan positions (objek baru) tiap render TreeCanvas; isi 569 baris perhitungan garis dijalankan ulang tiap frame pan. Saran: memo plus memo kalkulasi path, atau pindah ke SVG dengan transform ref.

### ReactFlowTreeView.tsx

- R-01 (medium): handleMemberUpdate, handleMemberAdd, handleMemberDelete tanpa useCallback; dipass ke ReactFlowFamilyTree yang tidak memo, jadi re-render store memicu render Inner penuh. Saran: useCallback ketiganya.
- R-02 (medium): useFamilyStore() destructuring penuh (members, updateMember, deleteMember); subscribe seluruh store.

### NewFamilyTreeCanvas.tsx

- NF-01 (low): useFamilyStore() penuh hanya untuk members.length (baris 20). Saran: selector count.

## 3. Rekap prioritas

| ID | File | Kategori checklist | Prioritas |
|---|---|---|---|
| T-01, M-02 | TreeCanvas, MemberCard, EditableMemberCard | selector tanpa shallow (poin 5) | high |
| T-02 | TreeCanvas | re-render per frame pan (poin 6) | high |
| M-01 | MemberCard, EditableMemberCard | React.memo hilang (poin 1) | high |
| P-01 | ReactFlowFamilyTree | pembacaan state.nodes penuh (poin 6) | medium |
| P-05 | ReactFlowFamilyTree | panel kontrol tanpa memo (poin 1) | medium |
| R-01, R-02 | ReactFlowTreeView | handler tanpa useCallback, selector penuh (poin 4, 5) | medium |
| T-03, T-04 | TreeCanvas | props array/objek tanpa useMemo (poin 4) | medium |
| C-01 | FamilyTreeConnections | memo hilang plus props baru tiap render (poin 1, 2) | medium |
| P-02, P-03, P-04, P-06, N-01, N-02, M-03, T-05, T-06, NF-01 | berbagai | detail di bagian 2 | low |

Catatan cakupan: jalur React Flow (ReactFlowFamilyTree plus node/edge kustom) sudah memenuhi inti checklist poin 1 sampai 3 dan 7; kelemahan terkonsentrasi pada jalur TreeCanvas (DOM klasik) dan pada effect reveal di kontainer. Angka benchmark di dokumen findings v442 menjadi dasar pemrioritasan perbaikan pada ladder 6 level (AC5).
