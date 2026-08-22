#!/usr/bin/env node
// S-14 U5 repro harness (AC e): bukti pohon 6+ generasi, bug card tak muncul.
// Skenario laporan Pak 21 Agu: isi form, simpan, card tidak muncul di canvas.
// Jalur uji: pure functions S-09 (applyGenerationLimit, expandBranch,
// countGenerationSpan, collapseToDefaultLimit) dibundle esbuild on-the-fly,
// pola verify-canvas-scale.mjs. Repro yang diuji:
//   A) pohon rantai 7 generasi, tambah anak di bawah generasi terdalam yang
//      terlihat (g5 -> g6): tanpa reveal tersembunyi (bug asli), dengan
//      expandBranch(parent) sesuai effect U3 => muncul.
//   A2) tambah anak di generasi terdalam mutlak (g7 -> g8): sama.
//   B) anggota polos tanpa relasi (generasi akar): langsung terlihat.
//   C) refresh: daftar member di-rehydrate jadi objek baru, state batas
//      generasi dipertahankan komponen => semua anggota baru tetap tampil.
// SMOKE MANUAL (dilengkapi sesi gerbang): npm run dev, bangun pohon 6+
// generasi lewat UI (atau impor fixture GEDCOM), ulangi A/A2/B, reload.
// Exit code 0 = semua assertion lulus.

import { mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const WORK_DIR = join(SCRIPT_DIR, '.verify-s14-work')

let passedCount = 0
let failedCount = 0
const check = (label, ok, detail = '') => {
  if (ok) { passedCount++; console.log(`  PASS ${label}${detail ? ` (${detail})` : ''}`) }
  else { failedCount++; console.log(`  FAIL ${label}${detail ? ` (${detail})` : ''}`) }
}
const section = (t) => console.log(`\n== ${t}`)

// Pohon rantai 7 generasi: m1(g1) tanpa ortu, m2(g2) ortu m1, dst sampai m7(g7).
const chain = () => {
  const out = []
  for (let g = 1; g <= 7; g++) {
    out.push({
      id: `m${g}`,
      name: `Anggota rantai g${g}`,
      nickname: undefined,
      birthDate: '1990-01-01',
      gender: g % 2 === 0 ? 'female' : 'male',
      isAlive: true,
      generation: g,
      maritalStatus: 'married',
      parentIds: g === 1 ? [] : [`m${g - 1}`],
    })
  }
  return out
}

const main = async () => {
  section('Bundle pure functions (esbuild)')
  mkdirSync(WORK_DIR, { recursive: true })
  const outfile = join(WORK_DIR, 'generations.mjs')
  await build({
    entryPoints: [join(ROOT, 'src/components/FamilyTree/generations/index.ts')],
    bundle: true, format: 'esm', platform: 'node', outfile,
  })
  const { applyGenerationLimit, expandBranch, countGenerationSpan,
    collapseToDefaultLimit, DEFAULT_GENERATION_LIMIT_STATE } = await import(outfile)

  section('Dataset: pohon rantai 7 generasi')
  const members = chain()
  check('span pohon = 7 generasi', countGenerationSpan(members) === 7)

  const ids = (arr) => arr.map((m) => m.id).sort()
  const defaultState = { ...DEFAULT_GENERATION_LIMIT_STATE }

  section('A. tambah anak di bawah generasi terdalam yang terlihat (g5 -> g6)')
  const base = applyGenerationLimit(members, defaultState)
  check('jendela default 5 gen: m6 dan m7 tersembunyi', base.visibleMembers.length === 5 && !ids(base.visibleMembers).includes('m6'))
  const childG6 = { id: 'new-g6', name: 'Anak baru g6', nickname: undefined, birthDate: '2026-01-01', gender: 'male', isAlive: true, generation: 6, maritalStatus: 'single', parentIds: ['m5'] }
  const withChild = [...members, childG6]
  check('repro bug: tanpa reveal, anak g6 TIDAK muncul', !ids(applyGenerationLimit(withChild, defaultState).visibleMembers).includes('new-g6'))
  const revealed = applyGenerationLimit(withChild, expandBranch(defaultState, 'm5'))
  check('reveal expandBranch(parent m5): anak g6 MUNCUL', ids(revealed.visibleMembers).includes('new-g6'))

  section('A2. tambah anak di generasi terdalam mutlak (g7 -> g8)')
  const childG8 = { id: 'new-g8', name: 'Anak baru g8', nickname: undefined, birthDate: '2026-01-01', gender: 'female', isAlive: true, generation: 8, maritalStatus: 'single', parentIds: ['m7'] }
  const withBoth = [...withChild, childG8]
  const stateA = expandBranch(defaultState, 'm5')
  check('repro: anak g8 tersembunyi sebelum reveal', !ids(applyGenerationLimit(withBoth, defaultState).visibleMembers).includes('new-g8'))
  const stateA2 = expandBranch(stateA, 'm7')
  check('reveal expandBranch(m7): anak g8 MUNCUL', ids(applyGenerationLimit(withBoth, stateA2).visibleMembers).includes('new-g8'))

  section('B. anggota polos tanpa relasi (generasi akar)')
  const plain = { id: 'new-plain', name: 'Anggota polos', nickname: undefined, birthDate: '2026-01-01', gender: 'male', isAlive: true, generation: 1, maritalStatus: 'single', parentIds: [] }
  const withPlain = [...withBoth, plain]
  check('anggota polos langsung terlihat tanpa ekspansi', ids(applyGenerationLimit(withPlain, stateA2).visibleMembers).includes('new-plain'))

  section('C. refresh: rehydrate objek baru, state batas dipertahankan')
  const rehydrated = withPlain.map((m) => ({ ...m, parentIds: [...(m.parentIds ?? [])] }))
  const vis = ids(applyGenerationLimit(rehydrated, stateA2).visibleMembers)
  check('pasca refresh: anak g6 tetap tampil', vis.includes('new-g6'))
  check('pasca refresh: anak g8 tetap tampil', vis.includes('new-g8'))
  check('pasca refresh: anggota polos tetap tampil', vis.includes('new-plain'))

  section('Regresi S-09: collapse mengembalikan batas default')
  const collapsed = applyGenerationLimit(rehydrated, collapseToDefaultLimit(stateA2))
  const col = ids(collapsed.visibleMembers)
  check('collapse: 6 terlihat (5 rantai + polos), new-g6 dan new-g8 hilang kembali', collapsed.visibleMembers.length === 6 && !col.includes('new-g6') && !col.includes('new-g8'))

  rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`\nS14-REPRO: ${passedCount} lulus, ${failedCount} gagal`)
  process.exit(failedCount === 0 ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
