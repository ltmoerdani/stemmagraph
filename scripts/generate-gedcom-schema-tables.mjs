#!/usr/bin/env node
/**
 * Generator tabel validasi struktur GEDCOM 7 (Stemmagraph fase i, v120).
 *
 * Sumber resmi: repo FamilySearch/GEDCOM, tag v7.0.18, direktori extracted-files.
 * Unduhan dilakukan sekali; salinan input tersimpan di
 * src/lib/gedcom/schema/vendor-snapshot/ agar regenerasi bisa offline.
 *
 * Output: src/lib/gedcom/schema/gedcom7-structures.json
 *   - meta      : versi, sumber, jumlah entri
 *   - payloads  : URI struktur -> tipe payload (null bila tanpa payload)
 *   - substructures : URI superstruktur -> { TAG -> { uri, cardinality, payload } }
 *     Superstruktur root (dokumen) memakai kunci kosong "".
 *
 * Pemakaian: node scripts/generate-gedcom-schema-tables.mjs
 * Tanpa argumen membaca snapshot lokal; dengan --fetch mengunduh ulang dari tag.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT_TAG = 'v7.0.18';
const BASE_RAW = `https://raw.githubusercontent.com/FamilySearch/GEDCOM/${ROOT_TAG}/extracted-files`;
const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA_DIR = join(HERE, '..', 'src', 'lib', 'gedcom', 'schema');
const SNAPSHOT_DIR = join(SCHEMA_DIR, 'vendor-snapshot');
const OUT_FILE = join(SCHEMA_DIR, 'gedcom7-structures.json');

const INPUTS = ['payloads.tsv', 'substructures.tsv', 'cardinalities.tsv'];

async function fetchInputs() {
  for (const name of INPUTS) {
    const res = await fetch(`${BASE_RAW}/${name}`);
    if (!res.ok) {
      throw new Error(`unduh gagal ${name}: HTTP ${res.status}`);
    }
    const body = await res.text();
    writeFileSync(join(SNAPSHOT_DIR, name), body);
    console.log(`unduh ${name}: ${body.length} byte`);
  }
}

/** Parse TSV sederhana: baris data (bukan komentar/kosong) dipisah tab. */
function parseTsv(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map((line) => line.split('\t'));
}

function readSnapshot(name) {
  const path = join(SNAPSHOT_DIR, name);
  if (!existsSync(path)) {
    throw new Error(`snapshot ${name} tidak ada; jalankan dengan --fetch`);
  }
  return readFileSync(path, 'utf8');
}

async function main() {
  if (process.argv.includes('--fetch')) {
    await fetchInputs();
  }

  const payloadsRows = parseTsv(readSnapshot('payloads.tsv'));
  const subsRows = parseTsv(readSnapshot('substructures.tsv'));
  const cardsRows = parseTsv(readSnapshot('cardinalities.tsv'));

  // payloads.tsv: <structureURI> <payloadType?> ; kolom kosong = tanpa payload.
  const payloads = {};
  for (const [uri, payloadType] of payloadsRows) {
    if (uri in payloads) {
      throw new Error(`payload duplikat untuk ${uri}`);
    }
    payloads[uri] = payloadType === '' ? null : payloadType;
  }

  // cardinalities.tsv: <superURI> <subURI> <cardinality>
  const cardinality = new Map();
  for (const [superUri, subUri, card] of cardsRows) {
    cardinality.set(`${superUri}\t${subUri}`, card);
  }

  // substructures.tsv: <superURI?> <tag> <subURI> ; super kosong = root dokumen.
  // Kardinalitas root dokumen tidak ada di cardinalities.tsv; ambil dari
  // grammar.gedstruct resmi: Dataset := 0 <<HEADER>> {1:1}, 0 <<RECORD>> {0:M}, 0 TRLR {1:1}.
  const ROOT_CARDINALITY = {
    HEAD: '{1:1}',
    TRLR: '{1:1}',
  };
  const rootCardinalityFallback = (tag) =>
    ROOT_CARDINALITY[tag] ?? '{0:M}';
  const substructures = {};
  let entryCount = 0;
  for (const [superUri, tag, subUri] of subsRows) {
    const superKey = superUri; // "" untuk root
    if (!substructures[superKey]) {
      substructures[superKey] = {};
    }
    if (tag in substructures[superKey]) {
      throw new Error(`substruktur duplikat ${superKey || '<root>'} + ${tag}`);
    }
    const card = cardinality.get(`${superUri}\t${subUri}`) ?? rootCardinalityFallback(tag);
    if (card === undefined) {
      throw new Error(`kardinalitas tidak ditemukan untuk ${superUri || '<root>'} + ${subUri}`);
    }
    if (!(subUri in payloads)) {
      throw new Error(`payload tidak ditemukan untuk ${subUri}`);
    }
    substructures[superKey][tag] = {
      uri: subUri,
      cardinality: card,
      payload: payloads[subUri],
    };
    entryCount += 1;
  }

  const rootTags = Object.keys(substructures[''] ?? {});
  const output = {
    meta: {
      gedcomVersion: '7.0.18',
      source: `FamilySearch/GEDCOM tag ${ROOT_TAG}, extracted-files`,
      sourceUrl: BASE_RAW,
      generatedAt: new Date().toISOString(),
      counts: {
        structures: Object.keys(payloads).length,
        substructureEntries: entryCount,
        superstructures: Object.keys(substructures).length,
        rootTags: rootTags.length,
      },
    },
    payloads,
    substructures,
  };

  writeFileSync(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`tulis ${OUT_FILE}`);
  console.log(
    `struktur: ${output.meta.counts.structures}, entri sub: ${entryCount}, root: ${rootTags.join(', ')}`,
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
