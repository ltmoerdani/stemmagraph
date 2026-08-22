#!/usr/bin/env node
// Agregator verify Stemmagraph (S-15): menjalankan ketujuh harness verifikasi
// dev-only secara berurutan, meneruskan outputnya ke konsol, lalu menutup
// dengan ringkasan lulus/gagal + jumlah assertion per harness.
//
// Isi harness lama tidak diubah. Jumlah assertion diambil dengan mem-parse
// baris ringkasan yang memang sudah dicetak tiap harness:
//   - "N assertions passed, M failed" (gedcom70, gedzip70, privacy-export)
//   - "N lulus, M gagal" beserta variasi prefiksnya
//     (canvas-scale, poster-pdf, s14-repro, s14-roundtrip)
// Karena ringkasan selalu berada di akhir output, parser memakai kecocokan
// regex TERAKHIR, bukan yang pertama.
//
// Exit code 0 hanya bila ketujuh harness exit 0. Satu harness gagal tetap
// tidak menghentikan harness berikutnya, supaya ringkasan lengkap.

import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))

const HARNESS = [
  'verify-gedcom70.mjs',
  'verify-gedzip70.mjs',
  'verify-privacy-export.mjs',
  'verify-canvas-scale.mjs',
  'verify-poster-pdf.mjs',
  'verify-s14-repro.mjs',
  'verify-s14-roundtrip.mjs',
]

const ASSERTION_SUMMARY =
  /(\d+) assertions passed|(\d+) lulus/g

function parseAssertionCount(output) {
  const matches = [...output.matchAll(ASSERTION_SUMMARY)]
  const last = matches[matches.length - 1]
  if (!last) return null
  return Number(last[1] ?? last[2])
}

function runHarness(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [join(SCRIPT_DIR, script)], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    })
    let stdoutText = ''
    child.stdout.on('data', (chunk) => {
      stdoutText += chunk
      process.stdout.write(chunk)
    })
    child.stderr.on('data', (chunk) => {
      process.stderr.write(chunk)
    })
    child.on('error', (err) => {
      console.error(`run-verify-all: gagal menjalankan ${script}:`, err)
      resolve({ ok: false, assertions: null })
    })
    child.on('close', (code) => {
      resolve({ ok: code === 0, assertions: parseAssertionCount(stdoutText) })
    })
  })
}

async function main() {
  console.log('run-verify-all: menjalankan', HARNESS.length, 'harness berurutan')
  const results = []
  for (const script of HARNESS) {
    console.log(`\n### ${script} ###`)
    const result = await runHarness(script)
    results.push({ script, ...result })
  }

  console.log('\n=== ringkasan run-verify-all ===')
  let failed = 0
  let totalAssertions = 0
  let counted = 0
  for (const { script, ok, assertions } of results) {
    const status = ok ? 'PASS' : 'FAIL'
    const count = assertions === null ? 'n/a' : String(assertions)
    console.log(`${status}  ${script.padEnd(28)} ${count} assertion`)
    if (!ok) failed += 1
    if (assertions !== null) {
      totalAssertions += assertions
      counted += 1
    }
  }
  console.log(
    `total: ${results.length - failed}/${results.length} harness lulus,` +
      ` ${totalAssertions} assertion terhitung dari ${counted} harness`
  )
  if (failed > 0) {
    console.error(`run-verify-all: ${failed} harness gagal`)
    process.exit(1)
  }
  console.log('run-verify-all: OK')
}

main().catch((err) => {
  console.error('run-verify-all: crashed:', err && err.stack ? err.stack : err)
  process.exit(1)
})
