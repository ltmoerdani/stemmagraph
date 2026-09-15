#!/usr/bin/env node
// Canvas scale harness for Stemmagraph (S-09 AC6), dev-only.
//
// Mirrors the verify-gedcom70/gedzip70/privacy-export pattern:
//   (a) Generator dataset sintetis deterministik (seeded PRNG mulberry32):
//       500 / 2000 / 5000 individu, satu akar, pasangan, parentIds dua sisi.
//   (b) Kasus batas: pohon 12 generasi (chain), pasangan lintas cabang,
//       akar tunggal. Pure function S-09 diuji di kasus batas:
//       applyGenerationLimit (AC2) dan shouldOnlyRenderVisibleElements (AC3),
//       plus stabilitas referensi hidrasi (AC4).
//   (c) Layout compute: modul layout asli (layout/index.ts, dagre tier
//       engine) dibundle on-the-fly dengan esbuild dari node_modules
//       (tanpa dependency baru), lalu dijalankan per ukuran dataset.
//       Waktu compute layout TB dan LR dicetak per ukuran, begitu juga
//       RSS process.memoryUsage (peak dilacak).
//   (d) Assert minimal: 2000 selesai compute layout, 5000 selesai tanpa
//       crash, semua kasus batas lulus, threshold AC3 tepat (499/500/501).
//
// Angka tercetak adalah catatan AC (bukan gate pass/fail kecuali assert
// minimal di atas). Exit code 0 = semua assertion lulus.
//
// SMOKE MANUAL (langkah jujur, belum otomatisasi):
//   1. npm run dev  (lalu buka URL Vite yang tercetak)
//   2. Impor fixture GEDCOM resmi scripts/fixtures-gedcom70/maximal70.ged
//      lewat UI impor, atau gunakan pohon yang sudah ada di familyStore.
//   3. Buka tampilan pohon (canvas): pastikan hanya 5 generasi pertama
//      tampil, kartu batas memakai badge jumlah keturunan, tombol expand
//      cabang menambah generasi di bawah cabang itu saja, tombol
//      "Tampilkan semua generasi" memunculkan konfirmasi, collapse
//      mengembalikan batas.
//   4. Ganti bahasa ID/EN: string kontrol generasi ikut berganti.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const WORK_DIR = join(SCRIPT_DIR, '.verify-canvas-work')

let passedCount = 0
let failedCount = 0

const check = (label, ok, detail = '') => {
  if (ok) {
    passedCount++
    console.log(`  PASS ${label}${detail ? ` (${detail})` : ''}`)
  } else {
    failedCount++
    console.log(`  FAIL ${label}${detail ? ` (${detail})` : ''}`)
  }
}

const section = (title) => console.log(`\n== ${title}`)

// ---- Deterministic seeded PRNG (mulberry32) ---------------------------

const mulberry32 = (seed) => {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

let memberSeq = 0
const mkMember = (generation, parentIds, seedName) => ({
  id: `m${++memberSeq}`,
  name: `${seedName} ${memberSeq}`,
  nickname: undefined,
  birthDate: '1990-01-01',
  gender: memberSeq % 2 === 0 ? 'male' : 'female',
  isAlive: true,
  generation,
  maritalStatus: 'married',
  parentIds,
})

/**
 * Pohon sintetis satu akar, deterministik. Setiap orang tua berpasangan
 * dengan peluang 0.75 (pasangan ikut dihitung ke total), anak 0-3.
 * Opsi rootSpouse=false: akar tidak diberi pasangan sama sekali (untuk
 * kasus batas akar tunggal murni).
 */
const generateTree = (targetCount, seed, opts = {}) => {
  const rng = mulberry32(seed)
  memberSeq = 0
  const members = []
  const root = mkMember(1, [], opts.namePrefix ?? 'Aga')
  if (opts.rootSpouse !== false) {
    const spouse = mkMember(1, [], opts.namePrefix ?? 'Aga')
    root.spouseId = spouse.id
    spouse.spouseId = root.id
    members.push(root, spouse)
  } else {
    members.push(root)
  }
  const frontier = [root]
  while (members.length < targetCount && frontier.length > 0) {
    const node = frontier.shift()
    let spouse = null
    if (opts.rootSpouse !== false || node !== root) {
      if (rng() < 0.75) {
        spouse = mkMember(node.generation, [], opts.namePrefix ?? 'Aga')
        node.spouseId = spouse.id
        spouse.spouseId = node.id
        members.push(spouse)
        if (members.length >= targetCount) break
      }
    }
    let kidCount = Math.floor(rng() * 4)
    if (frontier.length === 0 && kidCount === 0) kidCount = 1
    for (let i = 0; i < kidCount && members.length < targetCount; i++) {
      const parents = spouse ? [node.id, spouse.id] : [node.id]
      const kid = mkMember(node.generation + 1, parents, opts.namePrefix ?? 'Aga')
      members.push(kid)
      frontier.push(kid)
    }
  }
  return members
}

/** Chain tepat N generasi (kasus batas pohon 12 generasi). */
const generateChain = (generations, seed) => {
  const rng = mulberry32(seed)
  memberSeq = 0
  const members = []
  let current = mkMember(1, [], 'Bagas')
  members.push(current)
  for (let g = 2; g <= generations; g++) {
    const kid = mkMember(g, [current.id], 'Bagas')
    if (rng() < 0.5) {
      const sibling = mkMember(g, [current.id], 'Bagas')
      members.push(sibling)
    }
    members.push(kid)
    current = kid
  }
  return members
}

/** Kasus batas: pasangan lintas cabang + anak dua induk beda cabang. */
const generateCrossBranch = (seed) => {
  const rng = mulberry32(seed)
  memberSeq = 0
  const leftRoot = mkMember(1, [], 'Chika')
  const rightRoot = mkMember(1, [], 'Chika')
  const leftA = mkMember(2, [leftRoot.id], 'Chika')
  const rightA = mkMember(2, [rightRoot.id], 'Chika')
  // pasangan lintas cabang: node gen-3 kiri menikah node gen-3 kanan
  const leftB = mkMember(3, [leftA.id], 'Chika')
  const rightB = mkMember(3, [rightA.id], 'Chika')
  leftB.spouseId = rightB.id
  rightB.spouseId = leftB.id
  const child = mkMember(4, [leftB.id, rightB.id], 'Chika')
  const deepChild = mkMember(5, [child.id], 'Chika')
  void rng
  return [leftRoot, rightRoot, leftA, rightA, leftB, rightB, child, deepChild]
}

// ---- Pure-function checks (AC2, AC3, AC4) -----------------------------

const runPureChecks = (mods) => {
  const {
    applyGenerationLimit,
    DEFAULT_GENERATION_LIMIT_STATE,
    DEFAULT_GENERATION_LIMIT,
    expandBranch,
    collapseToDefaultLimit,
    expandAllGenerations,
    shouldOnlyRenderVisibleElements,
    hydrateStableByKey,
  } = mods

  section('AC3 threshold onlyRenderVisibleElements')
  check('499 -> false', shouldOnlyRenderVisibleElements(499) === false)
  check('500 -> true', shouldOnlyRenderVisibleElements(500) === true)
  check('501 -> true', shouldOnlyRenderVisibleElements(501) === true)
  check(
    `default limit = 5 (final-via-acceptance-test)`,
    DEFAULT_GENERATION_LIMIT === 5
  )

  section('AC2 kasus batas: pohon 12 generasi')
  const chain = generateChain(12, 20260819)
  const defaultView = applyGenerationLimit(chain, DEFAULT_GENERATION_LIMIT_STATE)
  const maxGenVisible = Math.max(...defaultView.visibleMembers.map((m) => m.generation))
  check(
    'default render hanya gen 1-5',
    defaultView.visibleMembers.length > 0 && maxGenVisible === 5,
    `visible=${defaultView.visibleMembers.length}, maxGen=${maxGenVisible}`
  )
  check(
    'indikator keturunan tersembunyi terisi di node batas',
    defaultView.hiddenDescendantCounts.size > 0,
    `nodes=${defaultView.hiddenDescendantCounts.size}`
  )
  const expandedRoot = expandBranch(DEFAULT_GENERATION_LIMIT_STATE, chain[0].id)
  const expandedView = applyGenerationLimit(chain, expandedRoot)
  check(
    'expand akar menurunkan seluruh 12 generasi',
    expandedView.visibleMembers.length === chain.length,
    `visible=${expandedView.visibleMembers.length}/${chain.length}`
  )
  const collapsedState = collapseToDefaultLimit(expandedRoot)
  const collapsedView = applyGenerationLimit(chain, collapsedState)
  check(
    'collapse mengembalikan batas',
    collapsedView.visibleMembers.length === defaultView.visibleMembers.length,
    `visible=${collapsedView.visibleMembers.length}`
  )
  const fullView = applyGenerationLimit(chain, expandAllGenerations(collapsedState))
  check(
    'ekspansi penuh menampilkan semua',
    fullView.visibleMembers.length === chain.length
  )

  section('AC2 kasus batas: pasangan lintas cabang')
  const cross = generateCrossBranch(20260820)
  const crossView = applyGenerationLimit(cross, DEFAULT_GENERATION_LIMIT_STATE)
  // gen 1..5 semuanya masuk jendela default
  check(
    'seluruh anggota masuk jendela default (gen 1-5)',
    crossView.visibleMembers.length === cross.length,
    `visible=${crossView.visibleMembers.length}/${cross.length}`
  )
  const crossDeep = applyGenerationLimit(
    [...cross, mkMemberAt(6, cross[cross.length - 1])],
    DEFAULT_GENERATION_LIMIT_STATE
  )
  check(
    'gen 6 lintas cabang tersembunyi + terhitung di indikator',
    crossDeep.visibleMembers.length === cross.length &&
      crossDeep.hiddenDescendantCounts.get(cross[cross.length - 1].id) === 1
  )

  section('AC2 kasus batas: akar tunggal')
  const single = generateTree(120, 4242, { rootSpouse: false, namePrefix: 'Dira' })
  const roots = single.filter((m) => (!m.parentIds || m.parentIds.length === 0) && !m.spouseId)
  check('tepat satu akar tanpa orang tua', roots.length === 1, `roots=${roots.length}`)
  const singleView = applyGenerationLimit(single, DEFAULT_GENERATION_LIMIT_STATE)
  check(
    'akar tunggal: baseline generasi = 1',
    singleView.rootGeneration === 1
  )

  section('AC4 hidrasi: referensi stabil untuk bagian tak berubah')
  const cacheEmpty = new Map()
  const specA = { key: 'a', sources: [single[0]], build: () => ({ id: 'a' }) }
  const first = hydrateStableByKey(cacheEmpty, [specA])
  const second = hydrateStableByKey(first.cache, [specA])
  check('node reuse referensi identik', first.values[0] === second.values[0])
  const mutated = [{ ...single[0], name: 'Berubah' }]
  const third = hydrateStableByKey(second.cache, [
    { key: 'a', sources: [mutated[0]], build: () => ({ id: 'a-v2' }) },
  ])
  check('member berubah -> node dibangun ulang', third.values[0].id === 'a-v2')
}

const mkMemberAt = (generation, parent) =>
  mkMember(generation, [parent.id], 'Eka')

// ---- Layout compute per ukuran (AC6 angka) ----------------------------

const toFlowNode = (member) => ({
  id: member.id,
  type: 'familyMember',
  position: { x: 0, y: 0 },
  data: {
    member,
    onEdit: () => undefined,
    onAddChild: () => undefined,
    onAddSpouse: () => undefined,
  },
  draggable: true,
})

const toFlowEdge = (members) => {
  const edges = []
  for (const m of members) {
    for (const parentId of m.parentIds ?? []) {
      edges.push({ id: `parent-${parentId}-${m.id}`, source: parentId, target: m.id })
    }
  }
  return edges
}

// LR (dagre) untuk 5000 node menit-kan waktu di server dev; default
// dilewati dengan catatan tercetak, opt-in via env. Assert "5000 selesai
// tanpa crash" dipenuhi lewat TB (engine yang sama, jalur tier layout).
const LR_5000 = process.env.CANVAS_SCALE_LR_5000 === '1'

const runScale = async (engine) => {
  let peakRss = 0
  const trackRss = (label) => {
    const rss = process.memoryUsage().rss
    peakRss = Math.max(peakRss, rss)
    return `${(rss / 1024 / 1024).toFixed(1)}MB`
  }

  for (const size of [500, 2000, 5000]) {
    section(`dataset ${size} individu`)
    const members = generateTree(size, 1000 + size, { namePrefix: `S${size}` })
    check(`generator tepat ${size}`, members.length === size, `got=${members.length}`)
    const nodes = members.map(toFlowNode)
    const edges = toFlowEdge(members)

    const tb = engine.layout(nodes, edges, { direction: 'TB' })
    check(
      `${size}: layout TB selesai`,
      tb.nodes.length === size,
      `compute=${tb.meta.computeMs.toFixed(1)}ms, tiers=${tb.meta.tierCount}, rss=${trackRss()}`
    )
    if (size === 5000 && !LR_5000) {
      console.log(
        `  NOTE 5000: layout LR (dagre) dilewati default` +
          ` (ekstrapolasi >5 menit di server dev; set CANVAS_SCALE_LR_5000=1 untuk angka penuh).` +
          ` Assert "5000 selesai tanpa crash" dipenuhi lewat TB di atas.`
      )
      continue
    }
    const lr = engine.layout(nodes, edges, { direction: 'LR' })
    check(
      `${size}: layout LR (dagre) selesai`,
      lr.nodes.length === size,
      `compute=${lr.meta.computeMs.toFixed(1)}ms, rss=${trackRss()}`
    )
  }
  console.log(`\npeak RSS proses harness: ${(peakRss / 1024 / 1024).toFixed(1)}MB`)
  return peakRss
}

// ---- Main --------------------------------------------------------------

const main = async () => {
  console.log('verify-canvas-scale: S-09 AC6 harness (dev-only)')
  rmSync(WORK_DIR, { recursive: true, force: true })
  mkdirSync(WORK_DIR, { recursive: true })

  const entry = join(WORK_DIR, 'entry.ts')
  writeFileSync(
    entry,
    [
      `export { dagreTierEngine } from '../../src/components/FamilyTree/layout/index.ts'`,
      `export {`,
      `  applyGenerationLimit,`,
      `  DEFAULT_GENERATION_LIMIT,`,
      `  DEFAULT_GENERATION_LIMIT_STATE,`,
      `  expandBranch,`,
      `  collapseToDefaultLimit,`,
      `  expandAllGenerations,`,
      `} from '../../src/components/FamilyTree/generations/generationLimit.ts'`,
      `export { shouldOnlyRenderVisibleElements } from '../../src/components/FamilyTree/generations/visibility.ts'`,
      `export { hydrateStableByKey } from '../../src/components/FamilyTree/generations/hydration.ts'`,
    ].join('\n')
  )

  const outfile = join(WORK_DIR, 'canvas-scale.bundle.mjs')
  try {
    await build({
      entryPoints: [entry],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    })
    const mods = await import(outfile)

    runPureChecks(mods)
    await runScale(mods.dagreTierEngine)
  } finally {
    rmSync(WORK_DIR, { recursive: true, force: true })
  }

  console.log(
    `\nhasil: ${passedCount} lulus, ${failedCount} gagal` +
      (failedCount === 0 ? ' (semua assertion OK)' : ' (ADA KEGAGALAN)')
  )
  console.log('smoke manual: lihat komentar header scripts/verify-canvas-scale.mjs')
  if (failedCount > 0) process.exit(1)
}

main().catch((err) => {
  console.error('verify-canvas-scale crash:', err)
  process.exit(1)
})
