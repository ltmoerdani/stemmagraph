#!/usr/bin/env node
// Pure-core guard for Stemmagraph (VISION T0b).
//
// Stemmagraph src/ and server/ must stay free of commercial code:
// no billing, premium, paywall, or subscription logic. This script
// scans both trees and exits non-zero on the first offense it finds,
// so it can gate `npm run build` (via the prebuild hook) and CI.
//
// Runs on Node >= 18 using built-in modules only. No dependencies.

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

// Directories that are never scanned, matched by name at any depth.
// docs/ is whitelisted (design notes and ADRs may discuss commercial
// patterns), same for node_modules/, dist/, and .github/.
const IGNORED_DIRS = new Set(['node_modules', 'dist', '.github', 'docs']);

// File extensions we never inspect because they are not source text.
const BINARY_EXTS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.avif', '.ico',
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  '.zip', '.gz', '.tar', '.pdf', '.db', '.sqlite',
]);

// The commercial patterns that must not appear. Case-insensitive.
const PATTERN = /isPremium|paywall|billing|subscription/i;

// Repository-relative paths that get scanned.
const SCAN_ROOTS = ['src', 'server'];

// Read at most 2 MB per file; larger files in src/ or server/ are
// almost certainly generated assets, and we skip them defensively.
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// Internal allowlist for legitimate exceptions. Empty on purpose:
// the baseline (develop 838a26b, after the S-01 teardown) is clean.
//
// How to use it, if a true positive ever needs an exception:
//   { path: /^server\/webhooks\//, pattern: /^subscriptionId$/i, reason: 'CRM ref' }
// A hit is excused when `path` matches the file path AND `pattern`
// matches the offending text. Omit `pattern` to excuse every hit in
// the matching files. Always add a short reason so reviewers know why.
const ALLOWLIST = [];

function walk(dir, files) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walk(full, files);
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
}

function looksBinary(buf, name) {
  const dot = name.lastIndexOf('.');
  if (dot !== -1 && BINARY_EXTS.has(name.slice(dot).toLowerCase())) return true;
  // A NUL byte, or a control character other than \t \n \r, within the
  // first 8 KB means the file is not UTF-8 text.
  const sniff = buf.subarray(0, 8192);
  for (const byte of sniff) {
    if (byte === 0) return true;
    if (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13) return true;
  }
  return false;
}

function isAllowed(relPath, text) {
  return ALLOWLIST.some(
    (rule) => rule.path.test(relPath) && (!rule.pattern || rule.pattern.test(text)),
  );
}

const scanned = [];
const skipped = [];
const missingRoots = [];

for (const root of SCAN_ROOTS) {
  const absRoot = join(ROOT, root);
  const found = [];
  try {
    readdirSync(absRoot);
  } catch {
    missingRoots.push(root);
    continue;
  }
  walk(absRoot, found);
  for (const file of found) {
    const rel = relative(ROOT, file).split('\\').join('/');
    if (rel.endsWith('.md') || file.split('/').pop().startsWith('.')) {
      skipped.push(rel);
      continue;
    }
    let buf;
    try {
      buf = readFileSync(file);
    } catch {
      skipped.push(rel);
      continue;
    }
    if (buf.length > MAX_FILE_BYTES || looksBinary(buf, file)) {
      skipped.push(rel);
      continue;
    }
    scanned.push({ rel, buf });
  }
}

const violations = [];
for (const { rel, buf } of scanned) {
  const lines = buf.toString('utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(PATTERN);
    if (match && !isAllowed(rel, match[0])) {
      const snippet = lines[i].trim().slice(0, 120);
      violations.push(`${rel}:${i + 1}: matched "${match[0]}" :: ${snippet}`);
    }
  }
}

const patternSource = PATTERN.source;

if (violations.length > 0) {
  console.error('pure-core guard: FAILED');
  console.error(
    `Stemmagraph is a pure-core project: commercial code (billing, premium,` +
      ` paywall, subscription) is not allowed in src/ or server/.`,
  );
  console.error(`Found ${violations.length} violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  if (missingRoots.length) {
    console.error(`Note: scan root(s) missing and skipped: ${missingRoots.join(', ')}`);
  }
  process.exit(1);
}

console.log('pure-core guard: OK');
console.log(`Scanned ${scanned.length} file(s) in ${SCAN_ROOTS.join(' + ')} for /${patternSource}/i`);
if (skipped.length) console.log(`Skipped ${skipped.length} non-source file(s) (markdown, binary, oversized)`);
if (missingRoots.length) console.log(`Note: scan root(s) missing and skipped: ${missingRoots.join(', ')}`);
console.log('No commercial patterns found. src/ and server/ stay pure-core.');
