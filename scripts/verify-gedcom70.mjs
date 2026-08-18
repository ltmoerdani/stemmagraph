#!/usr/bin/env node
// GEDCOM 7.0 export verification for Stemmagraph (VISION T0d Wave 1, S-04).
//
// Three parts, mirroring the acceptance criteria:
//   (a) Fixtures: ensure the three official gedcom.io 7.0 test files
//       (minimal70, same-sex-marriage, maximal70) exist under
//       scripts/fixtures-gedcom70/. The .ged fixtures are committed to
//       the repository; if one is missing (e.g. a fresh checkout with
//       sparse paths), it is downloaded from the official URL.
//   (b) Round-trip: for each fixture, GEDCStruct.fromString then
//       toString must reproduce the input byte-identically (including
//       a UTF-8 BOM when present, and CRLF line endings when present).
//       This re-proves the upstream claim from js-gedcom commit 34dd91ad
//       inside our vendored copy.
//   (c) Semantics: build an in-code sample tree (2 generations, one
//       deceased, one divorced couple, one single-parent family, contact
//       fields filled, one blob photo that must be skipped), export it
//       through the real mapper, parse the output back with the vendored
//       parser, and assert counts, pointers, field values, MARR/DIV
//       status handling, header/trailer shape, plus a type-aware
//       validation pass (0 errors; extension/datatype warnings allowed).
//
// Runs on Node >= 18. The mapper itself is TypeScript, so the script
// bundles it on the fly with esbuild (an existing dev toolchain
// dependency, imported from node_modules; no new dependency is added)
// into a temporary folder that is removed again at the end.
//
// Exit code 0 means every assertion passed.

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const FIXTURE_DIR = join(SCRIPT_DIR, 'fixtures-gedcom70')
const WORK_DIR = join(SCRIPT_DIR, '.verify-work')

const FIXTURES = [
  {
    name: 'minimal70.ged',
    url: 'https://gedcom.io/testfiles/gedcom70/minimal70.ged',
  },
  {
    name: 'same-sex-marriage.ged',
    url: 'https://gedcom.io/testfiles/gedcom70/same-sex-marriage.ged',
  },
  {
    name: 'maximal70.ged',
    url: 'https://gedcom.io/testfiles/gedcom70/maximal70.ged',
  },
]

const G7VALIDATION_URL =
  'https://raw.githubusercontent.com/FamilySearch/GEDCOM-registries/main/generated_files/g7validation.json'

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

// ---- Part (a): fixtures ----------------------------------------------

async function ensureFile(name, url) {
  const target = join(FIXTURE_DIR, name)
  if (existsSync(target)) return target
  console.log(`  downloading missing fixture ${name} from ${url}`)
  mkdirSync(FIXTURE_DIR, { recursive: true })
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`failed to download ${url}: HTTP ${response.status}`)
  }
  writeFileSync(target, Buffer.from(await response.arrayBuffer()))
  return target
}

async function partFixtures() {
  section('(a) official fixtures present under scripts/fixtures-gedcom70/')
  for (const fixture of FIXTURES) {
    const path = await ensureFile(fixture.name, fixture.url)
    const size = readFileSync(path).length
    check(`fixture ${fixture.name} available`, size > 0, `${size} bytes`)
  }
}

// ---- Part (b): byte-identical round-trips ---------------------------

async function partRoundTrip(GEDCStruct, g7ConfGEDC) {
  section('(b) fromString -> toString round-trip must be byte-identical')
  for (const fixture of FIXTURES) {
    const original = readFileSync(join(FIXTURE_DIR, fixture.name), 'utf8')
    const hasBom = original.charCodeAt(0) === 0xfeff
    const core = hasBom ? original.slice(1) : original
    // Respect the fixture's own line endings when serializing back.
    const newline = core.includes('\r\n') ? '\r\n' : '\n'
    const parseErrors = []
    const records = GEDCStruct.fromString(core, g7ConfGEDC, (msg) =>
      parseErrors.push(String(msg)),
    )
    check(`${fixture.name}: parses without syntax errors`, parseErrors.length === 0, parseErrors.join('; '))
    const serialized = (hasBom ? '\ufeff' : '') + records.toString(newline)
    check(
      `${fixture.name}: round-trip is byte-identical`,
      serialized === original,
      serialized === original
        ? undefined
        : `input ${original.length} chars vs output ${serialized.length} chars`,
    )
  }
}

// ---- Part (c): semantic verification of the exporter -----------------

function buildSampleTree() {
  // Two generations. Ids are chosen so the sorted order is
  // a1, a2, b2, d2, k1, r2, t3 (deterministic @I1@..@I7@).
  const members = [
    {
      id: 'a1', treeId: 't', name: 'Ahmad Wijaya', nickname: 'Ade',
      birthDate: '15 MAR 1962', birthPlace: 'Jakarta',
      currentLocation: 'Bandung', profession: 'Engineer', education: 'S1 Teknik',
      gender: 'male', photoUrl: 'https://cdn.example.com/ahmad.jpg',
      email: 'ahmad@example.com', phone: '+62 812 555 0100',
      isAlive: true, generation: 1, maritalStatus: 'married',
    },
    {
      id: 'a2', treeId: 't', name: 'Siti Rahayu',
      birthDate: '2 JUL 1965', birthPlace: 'Yogyakarta',
      gender: 'female', isAlive: true, generation: 1, maritalStatus: 'married',
    },
    {
      id: 'b2', treeId: 't', name: 'Budi Wijaya',
      birthDate: '20 MAR 1993', gender: 'male',
      photoUrl: 'blob:local-temp-photo', isAlive: true, generation: 2,
      maritalStatus: 'single',
    },
    {
      id: 'd2', treeId: 't', name: 'Dedi Saputra',
      birthDate: '11 SEP 1988', gender: 'male', isAlive: true,
      generation: 2, maritalStatus: 'divorced',
    },
    {
      id: 'k1', treeId: 't', name: 'Kartini Harsono',
      birthDate: '8 AUG 1968', deathDate: '1 JAN 2024',
      gender: 'female', isAlive: false, generation: 1, maritalStatus: 'widowed',
    },
    {
      id: 'r2', treeId: 't', name: 'Rina Wijaya',
      birthDate: '10 JAN 1990', gender: 'female', isAlive: true,
      generation: 2, maritalStatus: 'divorced',
    },
    {
      id: 't3', treeId: 't', name: 'Tono Harsono',
      birthDate: '14 FEB 1995', gender: 'male', isAlive: true,
      generation: 2, maritalStatus: 'single',
    },
  ]
  const relationships = [
    { id: 'x1', treeId: 't', memberId: 'a1', relatedId: 'a2', type: 'spouse' },
    { id: 'x2', treeId: 't', memberId: 'd2', relatedId: 'r2', type: 'spouse' },
    { id: 'x3', treeId: 't', memberId: 'a1', relatedId: 'r2', type: 'parent' },
    { id: 'x4', treeId: 't', memberId: 'a2', relatedId: 'r2', type: 'parent' },
    { id: 'x5', treeId: 't', memberId: 'a1', relatedId: 'b2', type: 'parent' },
    { id: 'x6', treeId: 't', memberId: 'a2', relatedId: 'b2', type: 'parent' },
    { id: 'x7', treeId: 't', memberId: 'k1', relatedId: 't3', type: 'parent' },
  ]
  return { members, relationships }
}

function subPayload(struct, tag) {
  const found = struct.sub.find((s) => s.tag === tag)
  return found ? found.payload : undefined
}

function subStruct(struct, tag) {
  return struct.sub.find((s) => s.tag === tag)
}

async function partSemantics(exportGedcom70, GEDCStruct, g7ConfGEDC, G7Dataset, G7Lookups) {
  section('(c) semantic export -> re-parse assertions')

  // Deterministic export timestamp so HEAD.DATE is assertable.
  const exportedAt = new Date('2026-08-18T05:30:00Z')
  const { members, relationships } = buildSampleTree()
  const { gedcom, stats } = exportGedcom70({ members, relationships, exportedAt })

  // Basic shape.
  check('output ends with TRLR line and trailing newline', /(^|\n)0 TRLR\n$/.test(gedcom))
  const parseErrors = []
  const records = GEDCStruct.fromString(gedcom, g7ConfGEDC, (msg) =>
    parseErrors.push(String(msg)),
  )
  check('exported output parses back without syntax errors', parseErrors.length === 0, parseErrors.join('; '))

  const head = records[0]
  check('first record is HEAD', head.tag === 'HEAD')
  check('HEAD.SOUR is Stemmagraph', subPayload(head, 'SOUR') === 'Stemmagraph')

  const sour = subStruct(head, 'SOUR')
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  check('HEAD.SOUR.VERS equals package.json version', sour && subPayload(sour, 'VERS') === pkg.version, `expected ${pkg.version}`)
  const gedcTag = subStruct(head, 'GEDC')
  check('HEAD.GEDC.VERS is 7.0', gedcTag && subPayload(gedcTag, 'VERS') === '7.0')
  check('HEAD.DATE is the export timestamp (DateExact)', subPayload(head, 'DATE') === '18 AUG 2026', String(subPayload(head, 'DATE')))
  check('HEAD has no CHAR (GEDCOM 7 is UTF-8 only)', !head.sub.some((s) => s.tag === 'CHAR'))
  check('last record is TRLR', records[records.length - 1].tag === 'TRLR')

  // Counts and deterministic xrefs (sorted member ids a1,a2,b2,d2,k1,r2,t3).
  const indis = records.filter((r) => r.tag === 'INDI')
  const fams = records.filter((r) => r.tag === 'FAM')
  check('individual count matches input', indis.length === members.length, `${indis.length} vs ${members.length}`)
  check('family count matches plan', fams.length === 3, `${fams.length}`)
  check('stats.individuals matches', stats.individuals === members.length)
  check('stats.families matches', stats.families === 3)
  const byXref = new Map(indis.map((r) => [r.xref_id, r]))
  const expectedOrder = ['a1', 'a2', 'b2', 'd2', 'k1', 'r2', 't3']
  expectedOrder.forEach((id, i) => {
    check(`xref @I${i + 1}@ belongs to member ${id}`, byXref.has(`I${i + 1}`) && subPayload(byXref.get(`I${i + 1}`), 'NAME') === members.find((m) => m.id === id).name)
  })
  const famByXref = new Map(fams.map((r) => [r.xref_id, r]))

  // Every pointer payload resolves to a real record object (not a
  // dangling string, which fromString would have logged about above).
  let pointerCount = 0
  const unresolved = []
  const walkPointers = (struct) => {
    for (const child of struct.sub) {
      if (child.payload instanceof GEDCStruct) pointerCount += 1
      else if (child.payload === null) unresolved.push(`${child.tag} (null pointer)`)
      walkPointers(child)
    }
  }
  records.forEach(walkPointers)
  check('no unresolved pointers anywhere in the output', unresolved.length === 0, unresolved.join('; '))
  check('output actually contains pointer payloads', pointerCount > 0, `${pointerCount} pointers`)

  // Individual field spot checks.
  const ahmad = byXref.get('I1')
  check('Ahmad NAME exported', subPayload(ahmad, 'NAME') === 'Ahmad Wijaya')
  const ahmadName = subStruct(ahmad, 'NAME')
  check('Ahmad NICK is a substructure of NAME', ahmadName && subPayload(ahmadName, 'NICK') === 'Ade')
  check('Ahmad SEX is M', subPayload(ahmad, 'SEX') === 'M')
  const birt = subStruct(ahmad, 'BIRT')
  check('Ahmad BIRT.DATE exported', birt && subPayload(birt, 'DATE') === '15 MAR 1962')
  check('Ahmad BIRT.PLAC exported', birt && subPayload(birt, 'PLAC') === 'Jakarta')
  check('Ahmad OCCU exported', subPayload(ahmad, 'OCCU') === 'Engineer')
  check('Ahmad EDUC exported (standard tag)', subPayload(ahmad, 'EDUC') === 'S1 Teknik')
  const resi = subStruct(ahmad, 'RESI')
  check('Ahmad RESI.PLAC exported', resi && subPayload(resi, 'PLAC') === 'Bandung')
  check('Ahmad RESI.EMAIL exported', resi && subPayload(resi, 'EMAIL') === 'ahmad@example.com')
  check('Ahmad RESI.PHON exported', resi && subPayload(resi, 'PHON') === '+62 812 555 0100')
  const objePointer = subStruct(ahmad, 'OBJE')
  const objeRecord = objePointer && objePointer.payload instanceof GEDCStruct ? objePointer.payload : null
  check('Ahmad OBJE points at a standalone OBJE record', objeRecord !== null && objeRecord.tag === 'OBJE')
  check('OBJE record keeps the http(s) photo URL in FILE', objeRecord && subPayload(objeRecord, 'FILE') === 'https://cdn.example.com/ahmad.jpg')

  const budi = byXref.get('I3')
  check('Budi has no OBJE (blob: photo skipped)', !budi.sub.some((s) => s.tag === 'OBJE'))
  check('skipped photo counted in stats', stats.skippedPhotos === 1, `${stats.skippedPhotos}`)

  const kartini = byXref.get('I5')
  check('Siti SEX is F', subPayload(byXref.get('I2'), 'SEX') === 'F')
  const deat = subStruct(kartini, 'DEAT')
  check('Kartini DEAT.DATE exported', deat && subPayload(deat, 'DATE') === '1 JAN 2024')

  // Family semantics.
  const f1 = famByXref.get('F1')
  check('F1 is the married couple Ahmad+Siti', f1 && subPayload(f1, 'HUSB')?.xref_id === 'I1' && subPayload(f1, 'WIFE')?.xref_id === 'I2')
  check('F1 has MARR', f1 && subPayload(f1, 'MARR') === 'Y')
  check('F1 has no DIV', f1 && subPayload(f1, 'DIV') === undefined)
  const f1Children = f1.sub.filter((s) => s.tag === 'CHIL').map((s) => s.payload.xref_id)
  check('F1 children are Rina and Budi exactly once each', f1Children.length === 2 && f1Children.includes('I6') && f1Children.includes('I3'), f1Children.join(','))
  check('Rina FAMC points at F1', byXref.get('I6').sub.some((s) => s.tag === 'FAMC' && s.payload.xref_id === 'F1'))
  check('Budi FAMC points at F1', byXref.get('I3').sub.some((s) => s.tag === 'FAMC' && s.payload.xref_id === 'F1'))

  const f2 = famByXref.get('F2')
  check('F2 is the divorced couple Dedi+Rina', f2 && subPayload(f2, 'HUSB')?.xref_id === 'I4' && subPayload(f2, 'WIFE')?.xref_id === 'I6')
  check('F2 has MARR', f2 && subPayload(f2, 'MARR') === 'Y')
  check('F2 has DIV', f2 && subPayload(f2, 'DIV') === 'Y')
  check('F2 has no children', f2 && !f2.sub.some((s) => s.tag === 'CHIL'))

  const f3 = famByXref.get('F3')
  check('F3 is Kartini single-parent (WIFE slot)', f3 && subPayload(f3, 'WIFE')?.xref_id === 'I5' && subPayload(f3, 'HUSB') === undefined)
  check('F3 (widowed) has MARR but no DIV', f3 && subPayload(f3, 'MARR') === 'Y' && subPayload(f3, 'DIV') === undefined)
  check('F3 child is Tono', f3 && f3.sub.filter((s) => s.tag === 'CHIL').map((s) => s.payload.xref_id).join(',') === 'I7')
  check('Tono FAMC points at F3', byXref.get('I7').sub.some((s) => s.tag === 'FAMC' && s.payload.xref_id === 'F3'))

  // Single members must not gain a family of their own.
  check('single member Budi has no FAMS', !byXref.get('I3').sub.some((s) => s.tag === 'FAMS'))
  check('single member Tono has no FAMS', !byXref.get('I7').sub.some((s) => s.tag === 'FAMS'))

  // Our own output should also survive a byte-identical round-trip.
  const reserialized = records.toString('\n')
  check('exported output round-trips byte-identically', reserialized === gedcom)

  // Type-aware validation with the official registry: 0 errors required,
  // warnings (e.g. unregistered extension usage, FilePath datatype
  // passthrough) are permitted and only reported.
  const registryPath = join(FIXTURE_DIR, 'g7validation.json')
  let registryText
  if (existsSync(registryPath)) {
    registryText = readFileSync(registryPath, 'utf8')
  } else {
    console.log('  downloading g7validation.json registry (runtime cache, gitignored)')
    const response = await fetch(G7VALIDATION_URL)
    if (!response.ok) {
      throw new Error(`failed to download ${G7VALIDATION_URL}: HTTP ${response.status}`)
    }
    registryText = await response.text()
    writeFileSync(registryPath, registryText)
  }
  const validationErrors = []
  const validationWarnings = []
  const lookups = new G7Lookups(JSON.parse(registryText))
  lookups.err = (msg) => validationErrors.push(String(msg))
  lookups.warn = (msg) => validationWarnings.push(String(msg))
  G7Dataset.fromGEDC(records, lookups)
  check('type-aware validation reports 0 errors', validationErrors.length === 0, validationErrors.join(' | '))
  console.log(`  validation warnings (allowed): ${validationWarnings.length}`)
  for (const warning of validationWarnings) console.log(`    - ${warning}`)
}

// ---- Orchestration ----------------------------------------------------

async function main() {
  console.log('verify-gedcom70: GEDCOM 7.0 export verification')

  await partFixtures()

  // Import the vendored modules directly (plain ESM JavaScript).
  const { GEDCStruct, g7ConfGEDC } = await import(
    '../src/lib/gedcom/vendor/gedcstruct.js'
  )
  const { G7Dataset } = await import('../src/lib/gedcom/vendor/g7structure.js')
  const { G7Lookups } = await import('../src/lib/gedcom/vendor/g7lookups.js')

  await partRoundTrip(GEDCStruct, g7ConfGEDC)

  // Bundle the TypeScript mapper to a temporary ESM file and import it.
  mkdirSync(WORK_DIR, { recursive: true })
  const outfile = join(WORK_DIR, 'exportGedcom70.bundle.mjs')
  try {
    await build({
      entryPoints: [join(ROOT, 'src/lib/gedcom/exportGedcom70.ts')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile,
      logLevel: 'silent',
    })
    const { exportGedcom70 } = await import(outfile)
    await partSemantics(exportGedcom70, GEDCStruct, g7ConfGEDC, G7Dataset, G7Lookups)
  } finally {
    rmSync(WORK_DIR, { recursive: true, force: true })
  }

  console.log(`\n${passedCount} assertions passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.error('verify-gedcom70: FAILED')
    process.exit(1)
  }
  console.log('verify-gedcom70: OK')
}

main().catch((error) => {
  console.error('verify-gedcom70: crashed:', error && error.stack ? error.stack : error)
  process.exit(1)
})
