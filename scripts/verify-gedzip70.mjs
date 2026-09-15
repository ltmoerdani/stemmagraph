#!/usr/bin/env node
// GEDZIP packaging verification for Stemmagraph (VISION T0d Wave 2, S-05).
//
// Companion to verify-gedcom70.mjs (Wave 1) with the same discipline;
// this script verifies the ZIP layer, not the GEDCOM mapping itself.
//
// Three parts, mirroring the S-05 acceptance criteria:
//   (a) Fixtures: the three official gedcom.io 7.0 test files
//       (minimal70, same-sex-marriage, maximal70) exist under
//       scripts/fixtures-gedcom70/. They are committed; a missing one
//       is downloaded from the official URL, same as Wave 1.
//   (b) Round-trip: each fixture is parsed with the vendored parser
//       into lightweight adapter records (INDI becomes a member, FAM
//       becomes spouse and parent relationships). exportGedzip then
//       packages those records; the archive is unzipped with fflate
//       and must hold exactly one entry named gedcom.ged
//       (case-sensitive, no folder part) whose content is
//       byte-identical to running exportGedcom70 directly on the same
//       records. ZIP hygiene is asserted too: local header magic,
//       end-of-central-directory present, and no zip64 structures.
//   (c) Guard: thresholds are checked with injected small limits, so
//       no real multi-gigabyte payload is ever built. The content and
//       entry guards must trip with structured errors, a limit exactly
//       at the content size must still pass, and the fallback contract
//       must hold: a rejected archive still returns the full .ged text
//       byte-identical to the direct export, which is what the UI
//       downloads as its fallback.
//
// The TypeScript modules are bundled on the fly with esbuild (an
// existing dev toolchain dependency; no new dependency is added) into
// a temporary folder that is removed again at the end.
//
// Exit code 0 means every assertion passed.

import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { unzipSync } from 'fflate'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROOT = join(SCRIPT_DIR, '..')
const FIXTURE_DIR = join(SCRIPT_DIR, 'fixtures-gedcom70')
const WORK_DIR = join(SCRIPT_DIR, '.verify-work-gedzip')

const FIXTURES = [
  {
    name: 'minimal70.ged',
    url: 'https://gedcom.io/testfiles/gedcom70/minimal70.ged',
    // The official minimal file is literally HEAD + TRLR: no INDI at
    // all, so the empty export path is what this fixture exercises.
    minMembers: 0,
  },
  {
    name: 'same-sex-marriage.ged',
    url: 'https://gedcom.io/testfiles/gedcom70/same-sex-marriage.ged',
    minMembers: 1,
  },
  {
    name: 'maximal70.ged',
    url: 'https://gedcom.io/testfiles/gedcom70/maximal70.ged',
    minMembers: 1,
  },
]

// The one legal entry name inside a GEDZIP archive (case-sensitive).
const ENTRY_NAME = 'gedcom.ged'

// Deterministic export timestamp so HEAD.DATE and the zip entry mtime
// are stable across the two export calls being compared.
const EXPORTED_AT = new Date('2026-08-18T10:00:00Z')

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

// ---- Shared helpers ---------------------------------------------------

async function ensureFixture(name, url) {
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

function bytesEqual(a, b) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

function startsWith(haystack, bytes) {
  if (haystack.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i += 1) {
    if (haystack[i] !== bytes[i]) return false
  }
  return true
}

function contains(haystack, bytes) {
  const text = Buffer.from(haystack)
  return text.includes(Buffer.from(bytes))
}

// ---- Part (a): fixtures ----------------------------------------------

async function partFixtures() {
  section('(a) official fixtures present under scripts/fixtures-gedcom70/')
  for (const fixture of FIXTURES) {
    const path = await ensureFixture(fixture.name, fixture.url)
    const size = readFileSync(path).length
    check(`fixture ${fixture.name} available`, size > 0, `${size} bytes`)
  }
}

// ---- Fixture -> adapter records extraction ---------------------------
//
// Deliberately minimal: only what exportGedzip consumes. This is test
// scaffolding, not an importer (import is a Wave 3 non-goal); exotic
// structures are simply ignored, which is fine because both export
// calls in each round-trip receive the exact same extracted records.

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

function textSub(struct, tag) {
  const payload = subPayload(struct, tag)
  return typeof payload === 'string' ? payload : undefined
}

function extractRecords(records) {
  const members = []
  const relationships = []
  const known = new Set()

  for (const record of records) {
    if (record.tag !== 'INDI' || !record.xref_id) continue
    known.add(record.xref_id)
    const birt = subStruct(record, 'BIRT')
    const deat = subStruct(record, 'DEAT')
    members.push({
      id: record.xref_id,
      treeId: 't',
      name: textSub(record, 'NAME') ?? '',
      birthDate: (birt && textSub(birt, 'DATE')) ?? '',
      deathDate: (deat && textSub(deat, 'DATE')) || undefined,
      gender: textSub(record, 'SEX') === 'M'
        ? 'male'
        : textSub(record, 'SEX') === 'F'
          ? 'female'
          : 'other',
      isAlive: !deat,
      generation: 1,
      maritalStatus: 'single',
    })
  }

  let relId = 0
  const pushRel = (memberId, relatedId, type) => {
    relId += 1
    relationships.push({ id: `r${relId}`, treeId: 't', memberId, relatedId, type })
  }

  for (const record of records) {
    if (record.tag !== 'FAM') continue
    const partners = [ptrId(record, 'HUSB'), ptrId(record, 'WIFE')]
      .filter((id) => id !== undefined && known.has(id))
    if (partners.length === 2) {
      pushRel(partners[0], partners[1], 'spouse')
    }
    const children = record.sub
      .filter((s) => s.tag === 'CHIL')
      .map((s) => (s.payload && typeof s.payload === 'object' ? s.payload.xref_id : undefined))
      .filter((id) => id !== undefined && known.has(id))
    for (const parent of partners) {
      for (const child of children) {
        pushRel(parent, child, 'parent')
      }
    }
  }

  return { members, relationships }
}

// ---- Part (b): round-trip through exportGedzip ------------------------

function partRoundTrip(exportGedzip, exportGedcom70, GEDCStruct, g7ConfGEDC) {
  section('(b) fixture records -> exportGedzip -> unzip -> byte-identical')

  for (const fixture of FIXTURES) {
    const original = readFileSync(join(FIXTURE_DIR, fixture.name), 'utf8')
    const core = original.charCodeAt(0) === 0xfeff ? original.slice(1) : original
    const parseErrors = []
    const records = GEDCStruct.fromString(core, g7ConfGEDC, (msg) =>
      parseErrors.push(String(msg)),
    )
    check(`${fixture.name}: parses without syntax errors`, parseErrors.length === 0, parseErrors.join('; '))

    const { members, relationships } = extractRecords(records)
    check(`${fixture.name}: extraction yields at least ${fixture.minMembers} members`, members.length >= fixture.minMembers, `${members.length} members, ${relationships.length} relationships`)
    console.log(`    extracted ${members.length} members, ${relationships.length} relationships`)

    const input = { members, relationships, exportedAt: EXPORTED_AT }
    const direct = exportGedcom70(input)
    const result = exportGedzip(input)

    check(`${fixture.name}: exportGedzip succeeds with default limits`, result.ok === true, result.ok ? undefined : JSON.stringify(result.error))

    const unzipped = unzipSync(result.zip)
    const names = Object.keys(unzipped)
    check(`${fixture.name}: archive holds exactly one entry`, names.length === 1, names.join(', '))
    check(`${fixture.name}: entry name is exactly gedcom.ged (case-sensitive)`, names[0] === ENTRY_NAME, JSON.stringify(names[0]))
    check(`${fixture.name}: entry name has no folder part`, !names[0].includes('/'), names[0])

    const entryBytes = unzipped[ENTRY_NAME]
    check(`${fixture.name}: entry content decodes to the direct export`, decoder.decode(entryBytes) === direct.gedcom)
    check(`${fixture.name}: entry content is byte-identical to exportGedcom70`, bytesEqual(entryBytes, encoder.encode(direct.gedcom)))

    const zip = result.zip
    check(`${fixture.name}: starts with local file header magic PK 03 04`, startsWith(zip, [0x50, 0x4b, 0x03, 0x04]))
    check(`${fixture.name}: contains end-of-central-directory PK 05 06`, contains(zip, [0x50, 0x4b, 0x05, 0x06]))
    check(`${fixture.name}: no zip64 EOCD marker PK 06 06`, !contains(zip, [0x50, 0x4b, 0x06, 0x06]))
    check(`${fixture.name}: no zip64 locator marker PK 06 07`, !contains(zip, [0x50, 0x4b, 0x06, 0x07]))
  }
}

// ---- Part (c): guard thresholds with injected small limits ------------

function partGuard(exportGedzip, packageGedzip, exportGedcom70, DEFAULT_GEDZIP_LIMITS) {
  section('(c) limit guard trips with structured errors, fallback intact')

  // Minimal but real record set; the mapper output feeds both the
  // guard and the fallback comparison.
  const members = [
    {
      id: 'm1', treeId: 't', name: 'Guard Person',
      birthDate: '1 JAN 1900', gender: 'female',
      isAlive: false, generation: 1, maritalStatus: 'single',
    },
  ]
  const relationships = []
  const input = { members, relationships, exportedAt: EXPORTED_AT }
  const direct = exportGedcom70(input)

  // Defaults: classic ZIP bounds, one byte below the zip64 cliff.
  check('default content limit is 0xFFFFFFFF', DEFAULT_GEDZIP_LIMITS.maxContentBytes === 0xffffffff)
  check('default entry limit is 65535', DEFAULT_GEDZIP_LIMITS.maxEntries === 0xffff)

  // Content guard: a limit far below the real payload trips it.
  const contentBlocked = exportGedzip({ ...input, limits: { maxContentBytes: 8 } })
  check('content guard rejects with GEDZIP_CONTENT_TOO_LARGE', contentBlocked.ok === false && contentBlocked.error.code === 'GEDZIP_CONTENT_TOO_LARGE')
  check('content guard reports value above limit', contentBlocked.ok === false && contentBlocked.error.value > contentBlocked.error.limit, contentBlocked.ok ? undefined : `${contentBlocked.error.value} > ${contentBlocked.error.limit}`)

  // Fallback contract: the rejected result still carries the full .ged
  // text, byte-identical to the direct export; that string is what the
  // UI downloads when the guard trips.
  check('fallback .ged text equals direct export', contentBlocked.ok === false && contentBlocked.gedcom === direct.gedcom)
  check('fallback .ged text is complete (ends with TRLR newline)', contentBlocked.ok === false && /(^|\n)0 TRLR\n$/.test(contentBlocked.gedcom))

  // Entry guard: zero allowed entries trips the entry code.
  const entryBlocked = exportGedzip({ ...input, limits: { maxEntries: 0 } })
  check('entry guard rejects with GEDZIP_TOO_MANY_ENTRIES', entryBlocked.ok === false && entryBlocked.error.code === 'GEDZIP_TOO_MANY_ENTRIES')

  // Boundary: a limit exactly equal to the encoded payload size must
  // still pass (the guard trips only above the limit).
  const encoded = encoder.encode(direct.gedcom).byteLength
  const boundary = exportGedzip({ ...input, limits: { maxContentBytes: encoded } })
  check('boundary limit exactly at content size passes', boundary.ok === true)

  // Unit level: packageGedzip runs the same guard without the mapper.
  const unitBlocked = packageGedzip(direct.gedcom, { limits: { maxContentBytes: 8 } })
  check('packageGedzip guard rejects oversized content', unitBlocked.ok === false && unitBlocked.error.code === 'GEDZIP_CONTENT_TOO_LARGE')
  const unitOk = packageGedzip(direct.gedcom, { mtime: EXPORTED_AT })
  check('packageGedzip packages with default limits', unitOk.ok === true)
}

// ---- Orchestration ----------------------------------------------------

async function main() {
  console.log('verify-gedzip70: GEDZIP packaging verification')

  await partFixtures()

  const { GEDCStruct, g7ConfGEDC } = await import(
    '../src/lib/gedcom/vendor/gedcstruct.js'
  )

  mkdirSync(WORK_DIR, { recursive: true })
  try {
    const outfileZip = join(WORK_DIR, 'exportGedzip.bundle.mjs')
    const outfileGed = join(WORK_DIR, 'exportGedcom70.bundle.mjs')
    await Promise.all([
      build({
        entryPoints: [join(ROOT, 'src/lib/gedcom/exportGedzip.ts')],
        bundle: true,
        format: 'esm',
        platform: 'node',
        outfile: outfileZip,
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
    ])
    const { exportGedzip, packageGedzip, DEFAULT_GEDZIP_LIMITS } = await import(outfileZip)
    const { exportGedcom70 } = await import(outfileGed)

    partRoundTrip(exportGedzip, exportGedcom70, GEDCStruct, g7ConfGEDC)
    partGuard(exportGedzip, packageGedzip, exportGedcom70, DEFAULT_GEDZIP_LIMITS)
  } finally {
    rmSync(WORK_DIR, { recursive: true, force: true })
  }

  console.log(`\n${passedCount} assertions passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.error('verify-gedzip70: FAILED')
    process.exit(1)
  }
  console.log('verify-gedzip70: OK')
}

main().catch((error) => {
  console.error('verify-gedzip70: crashed:', error && error.stack ? error.stack : error)
  process.exit(1)
})
