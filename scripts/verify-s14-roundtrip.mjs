#!/usr/bin/env node
// S-14 round-2 harness (permintaan QA put-1): bukti end-to-end roundtrip
// store + mock adapter untuk jalur addMemberWithRelationship pasca fix
// 4 temuan put-1. Pola: bundle esbuild store asli (mock adapter default),
// lalu assert pada state terhidrasi ulang, bukan pada payload input.
//
//   A. add-child (biological_child) ke target => edge parentChild TERBENTUK
//      (simulasi pembaca createFamilyEdgeSpecs), child.parentIds berisi
//      target, dan anak ditemukan di members.
//   B. add-spouse (partner) ke target BELUM berpasangan => edge marriage
//      terbentuk konsisten dua arah (spouseIds saling memuat), tepat satu
//      edge per pasangan lewat kunci pasangan terurut.
//   C. add-spouse (partner) ke target SUDAH berpasangan. KEBIJAKAN TERCATAT:
//      layer adapter tidak menegakkan monogami; rel kedua disimpan apa adanya
//      dan hidrasi mengumpulkan SEMUA pasangan ke spouseIds, jadi canvas
//      menggambar dua edge marriage (satu per pasangan, dedup kunci pasangan).
//      Yang diassert: tidak crash, anggota tetap dibuat, pasangan baru masuk
//      spouseIds target, dan edge pasangan baru tepat satu.
//   D. id balikan addMemberWithRelationship ada di members (rantai Temuan-1:
//      modal reveal memakai id ini, harus sama dengan id di store).
//
// Exit code 0 = semua assertion lulus.

import { mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const WORK_DIR = join(SCRIPT_DIR, '.verify-s14-roundtrip-work')

let passedCount = 0
let failedCount = 0
const check = (label, ok, detail = '') => {
  if (ok) { passedCount++; console.log(`  PASS ${label}${detail ? ` (${detail})` : ''}`) }
  else { failedCount++; console.log(`  FAIL ${label}${detail ? ` (${detail})` : ''}`) }
}
const section = (t) => console.log(`\n== ${t}`)

// Cermin data-level dari pembaca edge createFamilyEdgeSpecs (ReactFlowFamilyTree):
// parentChild dibangun dari child.parentIds, marriage didedup per kunci
// pasangan terurut (idKecil + '|' + idBesar).
const simParentChildEdges = (members) => {
  const edges = []
  const byId = new Map(members.map((m) => [m.id, m]))
  members.forEach((m) => {
    ;(m.parentIds ?? []).forEach((p) => {
      if (byId.has(p)) edges.push(`parent-${p}-${m.id}`)
    })
  })
  return edges
}
const simMarriageEdges = (members) => {
  const byId = new Map(members.map((m) => [m.id, m]))
  const seen = new Set()
  members.forEach((m) => {
    const list = m.spouseIds ?? (m.spouseId ? [m.spouseId] : [])
    list.forEach((raw) => {
      const s = byId.get(raw)
      if (!s) return
      const key = m.id < s.id ? `${m.id}|${s.id}` : `${s.id}|${m.id}`
      if (seen.has(key)) return
      seen.add(key)
    })
  })
  return Array.from(seen)
}

const payload = (name, birthDate, gender) => ({
  id: `ignored-local-${name.toLowerCase().replace(/\s+/g, '-')}`,
  name,
  nickname: undefined,
  birthDate,
  gender,
  isAlive: true,
  generation: 99, // sengaja salah; store wajib menghitung ulang dari target
  maritalStatus: 'married',
})

const main = async () => {
  section('Bundle store asli + mock adapter (esbuild)')
  mkdirSync(WORK_DIR, { recursive: true })
  const outfile = join(WORK_DIR, 'familyStore.bundle.mjs')
  await build({
    entryPoints: [join(ROOT, 'src/store/familyStore.ts')],
    bundle: true, format: 'esm', platform: 'node', outfile,
    tsconfig: join(ROOT, 'tsconfig.app.json'),
    define: { 'import.meta.env': '{"VITE_DATA_ADAPTER":"mock"}' },
  })
  const { useFamilyStore } = await import(outfile)

  const st = useFamilyStore.getState()
  st.setCurrentFamilyTreeId('wijaya-family')
  await st.fetchMembers('wijaya-family')
  const seed = useFamilyStore.getState()
  console.log('seed members:', seed.members.length, '| seed relationships:', seed.relationships.length)
  check('seed termuat', seed.members.length >= 11 && seed.relationships.length >= 18)

  // Target berstatus: 3 belum berpasangan, 1 sudah berpasangan dengan 2.
  const t3 = seed.members.find((m) => m.id === '3')
  const t1 = seed.members.find((m) => m.id === '1')
  check('prasyarat target 3 belum berpasangan', !t3?.spouseId && (t3?.spouseIds?.length ?? 0) === 0)
  check('prasyarat target 1 berpasangan dengan 2', t1?.spouseId === '2' && (t1?.spouseIds ?? []).includes('2'))

  section('A. add-child (biological_child) ke target 1')
  const childId = await useFamilyStore
    .getState()
    .addMemberWithRelationship(payload('Roundtrip Anak', '2020-06-01', 'male'), 'biological_child', '1')
  const sA = useFamilyStore.getState()
  const child = sA.members.find((m) => m.id === childId)
  check('D. id balikan addMemberWithRelationship ada di members', !!child, `id=${childId}`)
  check('A. anak ditemukan di members', !!child)
  check('A. child.parentIds berisi target', (child?.parentIds ?? []).includes('1'))
  check('A. edge parentChild terbentuk (pembaca createFamilyEdgeSpecs)',
    simParentChildEdges(sA.members).includes(`parent-1-${childId}`))
  const relDir = sA.relationships.find(
    (r) => r.type === 'parent' && r.memberId === '1' && r.relatedId === childId,
  )
  check('A. rel tersimpan arah parent (memberId=ortu, relatedId=anak)', !!relDir)
  check('A. generation dihitung ulang store dari target', child?.generation === (t1?.generation ?? 1) + 1,
    `gen=${child?.generation}`)

  section('B. add-spouse (partner) ke target 3 (belum berpasangan)')
  const spouseId = await useFamilyStore
    .getState()
    .addMemberWithRelationship(payload('Roundtrip Pasangan', '1990-02-02', 'female'), 'partner', '3')
  const sB = useFamilyStore.getState()
  const newSpouse = sB.members.find((m) => m.id === spouseId)
  const target3 = sB.members.find((m) => m.id === '3')
  check('D. id balikan jalur spouse ada di members', !!newSpouse, `id=${spouseId}`)
  check('B. spouseIds pasangan baru memuat target', (newSpouse?.spouseIds ?? []).includes('3'))
  check('B. spouseIds target memuat pasangan baru', (target3?.spouseIds ?? []).includes(spouseId))
  check('B. spouseId legacy target = pasangan pertama', target3?.spouseId === spouseId)
  const pairKey = `3|${spouseId}`.split('|').sort().join('|')
  check('B. edge marriage tepat satu untuk pasangan',
    simMarriageEdges(sB.members).filter((k) => k === pairKey).length === 1)
  check('B. edge marriage pasangan seed 1|2 tidak dobel',
    simMarriageEdges(sB.members).filter((k) => k === '1|2').length === 1)

  section('C. add-spouse (partner) ke target 1 (SUDAH berpasangan dengan 2)')
  console.log('  Kebijakan: adapter tidak menegakkan monogami; rel kedua disimpan,')
  console.log('  hidrasi mengumpulkan semua pasangan ke spouseIds, canvas menggambar')
  console.log('  satu edge per pasangan (dedup kunci pasangan terurut).')
  let crashed = false
  let secondSpouseId = ''
  try {
    secondSpouseId = await useFamilyStore
      .getState()
      .addMemberWithRelationship(payload('Roundtrip Pasangan Kedua', '1988-03-03', 'female'), 'partner', '1')
  } catch (err) {
    crashed = true
    console.log('  error tak terduga:', err instanceof Error ? err.message : String(err))
  }
  const sC = useFamilyStore.getState()
  const target1 = sC.members.find((m) => m.id === '1')
  const second = sC.members.find((m) => m.id === secondSpouseId)
  check('C. tidak crash', !crashed)
  check('C. anggota kedua tetap dibuat', !!second, `id=${secondSpouseId}`)
  check('C. spouseIds target memuat 2 dan pasangan baru',
    (target1?.spouseIds ?? []).includes('2') && (target1?.spouseIds ?? []).includes(secondSpouseId),
    `spouseIds=${JSON.stringify(target1?.spouseIds)}`)
  check('C. spouseId legacy tetap pasangan pertama (2)', target1?.spouseId === '2')
  const newPairKey = [ '1', secondSpouseId ].sort().join('|')
  check('C. edge marriage pasangan baru tepat satu',
    simMarriageEdges(sC.members).filter((k) => k === newPairKey).length === 1)
  check('C. edge marriage pasangan lama 1|2 tetap tepat satu',
    simMarriageEdges(sC.members).filter((k) => k === '1|2').length === 1)

  rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`\n${passedCount} lulus, ${failedCount} gagal`)
  process.exit(failedCount === 0 ? 0 : 1)
}

main().catch((err) => { console.error(err); process.exit(1) })
