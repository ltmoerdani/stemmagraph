#!/usr/bin/env node
// Export privacy verification for Stemmagraph (VISION T0e Wave 1, S-06).
//
// Companion to verify-gedcom70.mjs and verify-gedzip70.mjs; this script
// verifies the privacy gate and its enforcement in BOTH export paths.
//
// Four parts, mirroring the S-06 acceptance criteria:
//   (a) Gate unit checks: isLiving edge cases (including incomplete
//       records, which must err toward living), evaluateMemberPrivacy
//       truth table, and buildExportPrivacyReport counts.
//   (b) Fixture: a tree with the four required privacy cases, every
//       member carrying the full set of sensitive fields (name,
//       nickname, birth date and place, education, profession,
//       location, email, phone, http photo):
//         d1 deceased (isAlive false + death date)    -> full
//         l1 living, no privacyStatus (NULL)          -> redact
//         l2 living, privacyStatus 'shared'           -> full
//         l3 living, privacyStatus 'private'          -> redact
//   (c) Clean .ged export assertions: redacted members keep their INDI
//       record and xref, NAME becomes "[Living]", and BIRT/EDUC/OCCU/
//       RESI/EMAIL/PHON/NOTE/NICK/photos are absent (structurally and
//       as raw text). FAM pointers to redacted members stay valid.
//       Full and deceased members stay byte-complete. The legacy call
//       without privacyMode must equal the explicit 'full' mode.
//   (d) GEDZIP path: with privacyMode 'clean' the gedcom.ged entry is
//       byte-identical to the direct .ged export for the same input.
//
// The TypeScript modules are bundled on the fly with esbuild (an
// existing dev toolchain dependency; no new dependency is added) into
// a temporary folder that is removed again at the end.
//
// Exit code 0 means every assertion passed.

import { mkdirSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { unzipSync } from 'fflate'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const WORK_DIR = join(SCRIPT_DIR, '.verify-work-privacy')

// Deterministic export timestamp so HEAD.DATE and the zip entry mtime
// are stable across the export calls being compared.
const EXPORTED_AT = new Date('2026-08-19T02:00:00Z')

// The NAME payload the mapper substitutes for redacted members.
const REDACTED_NAME = '[Living]'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ---- Tiny assertion bookkeeping --------------------------------------

let passedCount = 0
const failures = []

function check(label, condition, detail) {
  if (condition) {
    passedCount += 1
  } else {
    failures.push(detail ? `${label} (${detail})` : label)
    console.error(`  [FAIL] ${label}${detail ? ' :: ' + detail : ''}`)
  }
}

function section(title) {
  console.log(`\n== ${title}`)
}

// ---- Part fixture: the four privacy cases ----------------------------

function buildFixtureTree() {
  // Ids sort as d1, l1, l2, l3 so xrefs are deterministic I1..I4.
  const members = [
    {
      id: 'd1', treeId: 't', name: 'Wati Wafat', nickname: 'Watie',
      birthDate: '5 JAN 1930', deathDate: '12 MAR 2001',
      birthPlace: 'Solo', currentLocation: 'Solo',
      profession: 'Pensiunan Guru', education: 'SMA',
      gender: 'female', photoUrl: 'https://cdn.example.com/wati.jpg',
      email: 'wati@example.com', phone: '+62 812 555 0001',
      isAlive: false, generation: 1, maritalStatus: 'widowed',
    },
    {
      id: 'l1', treeId: 't', name: 'Rian Rahasia', nickname: 'Rio',
      birthDate: '9 FEB 1996',
      birthPlace: 'Bandung', currentLocation: 'Jakarta',
      profession: 'Analis Data', education: 'S1 Statistika',
      gender: 'male', photoUrl: 'https://cdn.example.com/rian.jpg',
      email: 'rian@example.com', phone: '+62 812 555 0002',
      isAlive: true, generation: 2, maritalStatus: 'single',
      privacyStatus: undefined,
    },
    {
      id: 'l2', treeId: 't', name: 'Sari Setuju', nickname: 'Sar',
      birthDate: '17 MEI 1994',
      birthPlace: 'Semarang', currentLocation: 'Depok',
      profession: 'Dokter', education: 'S1 Kedokteran',
      gender: 'female', photoUrl: 'https://cdn.example.com/sari.jpg',
      email: 'sari@example.com', phone: '+62 812 555 0003',
      isAlive: true, generation: 2, maritalStatus: 'married',
      privacyStatus: 'shared',
    },
    {
      id: 'l3', treeId: 't', name: 'Toni Tertutup', nickname: 'Ton',
      birthDate: '23 AGO 1992',
      birthPlace: 'Surabaya', currentLocation: 'Bekasi',
      profession: 'Arsitek', education: 'S1 Arsitektur',
      gender: 'male', photoUrl: 'https://cdn.example.com/toni.jpg',
      email: 'toni@example.com', phone: '+62 812 555 0004',
      isAlive: true, generation: 2, maritalStatus: 'married',
      privacyStatus: 'private',
    },
  ]
  // F1 = couple l2 (full) + l3 (redacted) with child l1 (redacted),
  // so both partner and child FAM pointers target redacted members.
  // F2 = d1 (deceased, full) single parent of l2.
  const relationships = [
    { id: 'x1', treeId: 't', memberId: 'l2', relatedId: 'l3', type: 'spouse' },
    { id: 'x2', treeId: 't', memberId: 'l2', relatedId: 'l1', type: 'parent' },
    { id: 'x3', treeId: 't', memberId: 'l3', relatedId: 'l1', type: 'parent' },
    { id: 'x4', treeId: 't', memberId: 'd1', relatedId: 'l2', type: 'parent' },
  ]
  return { members, relationships }
}

// ---- Part (a): gate unit checks ---------------------------------------

function partGateUnit(gate) {
  section('(a) gate unit checks: isLiving, evaluate, report')

  // isLiving truth table. Incomplete records err toward living: only
  // isAlive false AND a filled deathDate counts as deceased.
  check('isLiving: isAlive true, no deathDate', gate.isLiving({ isAlive: true }) === true)
  check('isLiving: isAlive true with deathDate filled stays living', gate.isLiving({ isAlive: true, deathDate: '1 JAN 2020' }) === true)
  check('isLiving: isAlive false without deathDate still treated living (safe default)', gate.isLiving({ isAlive: false }) === true)
  check('isLiving: isAlive false with empty string deathDate still living', gate.isLiving({ isAlive: false, deathDate: '' }) === true)
  check('isLiving: isAlive false with deathDate filled is deceased', gate.isLiving({ isAlive: false, deathDate: '1 JAN 2020' }) === false)

  // evaluateMemberPrivacy truth table.
  check('evaluate: deceased -> full', gate.evaluateMemberPrivacy({ isAlive: false, deathDate: '1 JAN 2020' }) === 'full')
  check('evaluate: living shared -> full', gate.evaluateMemberPrivacy({ isAlive: true, privacyStatus: 'shared' }) === 'full')
  check('evaluate: living private -> redact', gate.evaluateMemberPrivacy({ isAlive: true, privacyStatus: 'private' }) === 'redact')
  check('evaluate: living without flag -> redact (safe default)', gate.evaluateMemberPrivacy({ isAlive: true }) === 'redact')

  // Report counts over the four-case fixture: 2 redacted, 1 full, 1 dead.
  const { members } = buildFixtureTree()
  const report = gate.buildExportPrivacyReport(members)
  check('report.total is 4', report.total === 4, JSON.stringify(report))
  check('report.livingRedacted is 2', report.livingRedacted === 2, `${report.livingRedacted}`)
  check('report.livingFull is 1', report.livingFull === 1, `${report.livingFull}`)
  check('report.deceased is 1', report.deceased === 1, `${report.deceased}`)
  check('report categories sum to total', report.livingFull + report.livingRedacted + report.deceased === report.total)
  check('report on empty list is all zeros', gate.buildExportPrivacyReport([]).total === 0 && gate.buildExportPrivacyReport([]).livingRedacted === 0)
}

// ---- Shared helpers ---------------------------------------------------

function subStruct(struct, tag) {
  return struct.sub.find((s) => s.tag === tag)
}

function subPayload(struct, tag) {
  const found = subStruct(struct, tag)
  return found ? found.payload : undefined
}

function ptrId(struct, tag) {
  const payload = subPayload(struct, tag)
  return payload && typeof payload === 'object' ? payload.xref_id : undefined
}

function bytesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

// ---- Part (c): clean .ged export assertions ---------------------------

function partCleanGed(exportGedcom70, GEDCStruct, g7ConfGEDC) {
  section('(c) clean .ged export: redaction, topology, intact full members')

  const { members, relationships } = buildFixtureTree()
  const input = { members, relationships, exportedAt: EXPORTED_AT }
  const byId = new Map(members.map((m) => [m.id, m]))

  const clean = exportGedcom70({ ...input, privacyMode: 'clean' })
  const full = exportGedcom70({ ...input, privacyMode: 'full' })
  const legacy = exportGedcom70(input)

  // Legacy contract: omitting privacyMode equals the explicit full
  // archive, byte for byte, and both differ from the clean export.
  check('legacy call (no privacyMode) equals explicit full mode', legacy.gedcom === full.gedcom)
  check('clean export differs from full export', clean.gedcom !== full.gedcom)

  // Parse the clean output back with the vendored parser.
  const parseErrors = []
  const records = GEDCStruct.fromString(clean.gedcom, g7ConfGEDC, (msg) =>
    parseErrors.push(String(msg)),
  )
  check('clean output parses without syntax errors', parseErrors.length === 0, parseErrors.join('; '))
  check('clean output round-trips byte-identically', records.toString('\n') === clean.gedcom)

  const indis = records.filter((r) => r.tag === 'INDI')
  const fams = records.filter((r) => r.tag === 'FAM')
  const byXref = new Map(indis.map((r) => [r.xref_id, r]))
  check('all four INDI records survive redaction', indis.length === 4, `${indis.length}`)

  // Deterministic xrefs preserved: d1=I1, l1=I2, l2=I3, l3=I4 in both
  // modes, so external pointers keep their meaning.
  const expected = [
    ['I1', 'd1'], ['I2', 'l1'], ['I3', 'l2'], ['I4', 'l3'],
  ]
  for (const [xref, id] of expected) {
    check(`xref ${xref} still belongs to ${id} in clean output`, byXref.has(xref) && subPayload(byXref.get(xref), 'NAME') !== undefined)
  }

  // No unresolved pointers anywhere (FAM/INDI topology intact).
  const unresolved = []
  const walkPointers = (struct) => {
    for (const child of struct.sub) {
      if (child.payload === null) unresolved.push(child.tag)
      walkPointers(child)
    }
  }
  records.forEach(walkPointers)
  check('no unresolved pointers in clean output', unresolved.length === 0, unresolved.join('; '))

  // Redacted members: l1 (I2) and l3 (I4).
  for (const [xref, id] of [['I2', 'l1'], ['I4', 'l3']]) {
    const indi = byXref.get(xref)
    const label = `${id} (${xref}, redacted)`
    check(`${label}: NAME payload is [Living]`, subPayload(indi, 'NAME') === REDACTED_NAME, String(subPayload(indi, 'NAME')))
    check(`${label}: no NICK substructure`, subStruct(indi, 'NAME') && subStruct(subStruct(indi, 'NAME'), 'NICK') === undefined)
    check(`${label}: no BIRT structure (no date, no place)`, subStruct(indi, 'BIRT') === undefined)
    check(`${label}: no OCCU`, subStruct(indi, 'OCCU') === undefined)
    check(`${label}: no EDUC`, subStruct(indi, 'EDUC') === undefined)
    check(`${label}: no RESI (covers EMAIL and PHON)`, subStruct(indi, 'RESI') === undefined)
    check(`${label}: no NOTE`, subStruct(indi, 'NOTE') === undefined)
    check(`${label}: no OBJE pointer`, subStruct(indi, 'OBJE') === undefined)
    check(`${label}: no DEAT structure`, subStruct(indi, 'DEAT') === undefined)
    // Text-level belt and braces on the serialized subtree: no contact
    // or birth tags at all, not even with unexpected payloads.
    const subtree = indi.toString('\n')
    check(`${label}: serialized subtree has no EMAIL line`, !subtree.includes('EMAIL'))
    check(`${label}: serialized subtree has no PHON line`, !subtree.includes('PHON'))
    check(`${label}: serialized subtree has no BIRT line`, !subtree.includes('BIRT'))
    check(`${label}: serialized subtree has no OCCU line`, !subtree.includes('OCCU'))
    check(`${label}: serialized subtree has no EDUC line`, !subtree.includes('EDUC'))
    check(`${label}: serialized subtree has no RESI line`, !subtree.includes('RESI'))
    check(`${label}: serialized subtree has no NOTE line`, !subtree.includes('NOTE'))
  }

  // The redacted raw values must not appear anywhere in the clean
  // output text, while they all appear in the full export.
  const redactedIds = ['l1', 'l3']
  for (const id of redactedIds) {
    const m = byId.get(id)
    const secrets = [m.name, m.nickname, m.birthDate, m.birthPlace, m.currentLocation, m.profession, m.education, m.email, m.phone, m.photoUrl]
    for (const secret of secrets) {
      check(`clean output omits ${id} value "${secret}"`, !clean.gedcom.includes(secret))
      check(`full export still contains ${id} value "${secret}"`, full.gedcom.includes(secret))
    }
  }
  // Full members: d1 (I1, deceased) and l2 (I3, shared). Data intact
  // to the byte against the full-mode export.
  const fullIndis = GEDCStruct.fromString(full.gedcom, g7ConfGEDC, () => {})
    .filter((r) => r.tag === 'INDI')
  const fullByXref = new Map(fullIndis.map((r) => [r.xref_id, r]))
  for (const [xref, id] of [['I1', 'd1'], ['I3', 'l2']]) {
    const m = byId.get(id)
    const label = `${id} (${xref}, full)`
    const cleanIndi = byXref.get(xref)
    const nameStruct = subStruct(cleanIndi, 'NAME')
    check(`${label}: NAME intact`, subPayload(cleanIndi, 'NAME') === m.name)
    check(`${label}: NICK intact`, nameStruct && subPayload(nameStruct, 'NICK') === m.nickname)
    const birt = subStruct(cleanIndi, 'BIRT')
    check(`${label}: BIRT.DATE intact`, birt && subPayload(birt, 'DATE') === m.birthDate)
    check(`${label}: BIRT.PLAC intact`, birt && subPayload(birt, 'PLAC') === m.birthPlace)
    check(`${label}: OCCU intact`, subPayload(cleanIndi, 'OCCU') === m.profession)
    check(`${label}: EDUC intact`, subPayload(cleanIndi, 'EDUC') === m.education)
    const resi = subStruct(cleanIndi, 'RESI')
    check(`${label}: RESI.PLAC intact`, resi && subPayload(resi, 'PLAC') === m.currentLocation)
    check(`${label}: RESI.EMAIL intact`, resi && subPayload(resi, 'EMAIL') === m.email)
    check(`${label}: RESI.PHON intact`, resi && subPayload(resi, 'PHON') === m.phone)
    const objePointer = subStruct(cleanIndi, 'OBJE')
    const objeRecord = objePointer && objePointer.payload instanceof GEDCStruct ? objePointer.payload : null
    check(`${label}: OBJE still points at a record with FILE`, objeRecord !== null && subPayload(objeRecord, 'FILE') === m.photoUrl)
    // Whole INDI subtree identical to the full-mode export, except that
    // standalone OBJE records are numbered per archive: redaction
    // removes OBJE records, so later photos shift xref numbers. Pointer
    // ids are normalized before comparing; payloads must match exactly.
    const normalize = (text) => text.replace(/@O\d+@/g, '@O@')
    check(
      `${label}: INDI subtree identical to full-mode export`,
      normalize(cleanIndi.toString('\n')) === normalize(fullByXref.get(xref).toString('\n')),
    )
  }
  const d1 = byXref.get('I1')
  const deat = subStruct(d1, 'DEAT')
  check('deceased d1: DEAT.DATE intact', deat && subPayload(deat, 'DATE') === '12 MAR 2001')

  // FAM topology: F1 = l2 (WIFE, full) + l3 (HUSB, redacted) with CHIL
  // l1 (redacted); F2 = d1 (WIFE) single parent of l2.
  const famByXref = new Map(fams.map((r) => [r.xref_id, r]))
  const f1 = famByXref.get('F1')
  check('F1 exists', f1 !== undefined)
  check('F1 WIFE points at l2 (I3)', ptrId(f1, 'WIFE') === 'I3')
  check('F1 HUSB points at redacted l3 (I4)', ptrId(f1, 'HUSB') === 'I4')
  const f1Children = f1.sub.filter((s) => s.tag === 'CHIL').map((s) => (s.payload && typeof s.payload === 'object' ? s.payload.xref_id : undefined))
  check('F1 CHIL points at redacted l1 (I2)', f1Children.join(',') === 'I2', f1Children.join(','))
  check('redacted l1 FAMC points back at F1', byXref.get('I2').sub.some((s) => s.tag === 'FAMC' && s.payload && s.payload.xref_id === 'F1'))
  check('redacted l3 FAMS points back at F1', byXref.get('I4').sub.some((s) => s.tag === 'FAMS' && s.payload && s.payload.xref_id === 'F1'))
  const f2 = famByXref.get('F2')
  check('F2 is d1 single parent of l2', f2 && ptrId(f2, 'WIFE') === 'I1' && f2.sub.filter((s) => s.tag === 'CHIL').map((s) => s.payload.xref_id).join(',') === 'I3')

  // Stats: all photos are http, nothing skipped even in clean mode
  // (redacted photos are suppressed, not counted as skipped).
  check('clean stats count 4 individuals', clean.stats.individuals === 4)
  check('clean stats count 2 families', clean.stats.families === 2)
  check('clean stats skip 0 photos', clean.stats.skippedPhotos === 0)

  return { input, cleanGedcom: clean.gedcom }
}

// ---- Part (d): GEDZIP carries the same redaction ----------------------

function partGedzip(exportGedzip, exportGedcom70, prepared) {
  section('(d) GEDZIP entry is byte-identical to the clean .ged path')

  const { input, cleanGedcom } = prepared

  const result = exportGedzip({ ...input, privacyMode: 'clean' })
  check('exportGedzip clean mode succeeds', result.ok === true, result.ok ? undefined : JSON.stringify(result.error))

  const unzipped = unzipSync(result.zip)
  const names = Object.keys(unzipped)
  check('archive holds exactly one entry', names.length === 1, names.join(', '))
  check('entry name is gedcom.ged', names[0] === 'gedcom.ged')

  const entryBytes = unzipped['gedcom.ged']
  check('entry decodes to the direct clean .ged export', decoder.decode(entryBytes) === cleanGedcom)
  check('entry is byte-identical to the direct clean .ged export', bytesEqual(entryBytes, encoder.encode(cleanGedcom)))

  // Cross-check via the mapper call the UI would make for the archive.
  const directAgain = exportGedcom70({ ...input, privacyMode: 'clean' })
  check('mapper is deterministic for identical privacy input', directAgain.gedcom === cleanGedcom)
  check('zip entry equals a fresh clean export', decoder.decode(entryBytes) === directAgain.gedcom)

  // The full archive mode keeps the unredacted text.
  const fullResult = exportGedzip({ ...input, privacyMode: 'full' })
  check('exportGedzip full mode succeeds', fullResult.ok === true)
  const fullEntry = decoder.decode(unzipSync(fullResult.zip)['gedcom.ged'])
  const fullDirect = exportGedcom70({ ...input, privacyMode: 'full' })
  check('full archive entry equals full .ged export', fullEntry === fullDirect.gedcom)
  check('full archive entry is not the clean text', fullEntry !== cleanGedcom)
}

// ---- Orchestration ----------------------------------------------------

async function main() {
  console.log('verify-privacy-export: S-06 privacy gate + redaction verification')

  mkdirSync(WORK_DIR, { recursive: true })
  try {
    const outfileGate = join(WORK_DIR, 'exportPrivacyGate.bundle.mjs')
    const outfileGed = join(WORK_DIR, 'exportGedcom70.bundle.mjs')
    const outfileZip = join(WORK_DIR, 'exportGedzip.bundle.mjs')
    await Promise.all([
      build({
        entryPoints: [join(ROOT, 'src/lib/privacy/exportPrivacyGate.ts')],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: outfileGate,
        logLevel: 'silent',
      }),
      build({
        entryPoints: [join(ROOT, 'src/lib/gedcom/exportGedcom70.ts')],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: outfileGed,
        logLevel: 'silent',
      }),
      build({
        entryPoints: [join(ROOT, 'src/lib/gedcom/exportGedzip.ts')],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: outfileZip,
        logLevel: 'silent',
      }),
    ])
    const gate = await import(outfileGate)
    const { exportGedcom70 } = await import(outfileGed)
    const { exportGedzip } = await import(outfileZip)
    const { GEDCStruct, g7ConfGEDC } = await import(
      '../src/lib/gedcom/vendor/gedcstruct.js'
    )

    partGateUnit(gate)
    const prepared = partCleanGed(exportGedcom70, GEDCStruct, g7ConfGEDC)
    partGedzip(exportGedzip, exportGedcom70, prepared)
  } finally {
    rmSync(WORK_DIR, { recursive: true, force: true })
  }

  console.log(`\n${passedCount} assertions passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.error('verify-privacy-export: FAILED')
    process.exit(1)
  }
  console.log('verify-privacy-export: OK')
}

main().catch((error) => {
  console.error('verify-privacy-export: crashed:', error && error.stack ? error.stack : error)
  process.exit(1)
})
