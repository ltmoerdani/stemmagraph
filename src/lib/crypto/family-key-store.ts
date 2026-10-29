import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

// Penyimpanan DEK per keluarga (tree) di disk, ter-wrap AES-256-GCM
// memakai KEK hasil derive scrypt dari STMG_MASTER_KEY dan salt.bin.
// File kunci tidak pernah di-log dan tidak ada secret hard-code.

const SALT_FILE_NAME = 'salt.bin';
const SALT_LENGTH_BYTES = 32;
const KEK_LENGTH_BYTES = 32;
const DEK_LENGTH_BYTES = 32;
const WRAP_IV_BYTES = 12;
const WRAP_TAG_BYTES = 16;
const KEY_DIR_MODE = 0o700;
const KEY_FILE_MODE = 0o600;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const TREE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

interface WrappedKey {
  iv: string;
  tag: string;
  data: string;
}

interface KeyFileShape {
  wrapped: WrappedKey;
}

// Direktori kunci: STMG_KEY_DIR bila diisi, selain itu .keys-data di cwd.
function resolveKeyDir(): string {
  const configured = process.env.STMG_KEY_DIR;
  if (configured && configured.trim() !== '') {
    return configured;
  }
  return join(process.cwd(), '.keys-data');
}

// Salt global 32 byte, dibuat sekali lalu dibaca ulang berikutnya.
function loadOrCreateSalt(keyDir: string): Buffer {
  const saltPath = join(keyDir, SALT_FILE_NAME);
  if (existsSync(saltPath)) {
    return readFileSync(saltPath);
  }
  const salt = randomBytes(SALT_LENGTH_BYTES);
  writeFileSync(saltPath, salt, { mode: KEY_FILE_MODE });
  chmodSync(saltPath, KEY_FILE_MODE);
  return readFileSync(saltPath);
}

// KEK 32 byte dari master key dan salt via scrypt.
function deriveKek(masterKey: string, salt: Buffer): Buffer {
  return scryptSync(masterKey, salt, KEK_LENGTH_BYTES, SCRYPT_PARAMS);
}

// Generasi tertinggi yang sudah ada di disk untuk treeId, 0 bila belum ada.
function findHighestGeneration(keyDir: string, treeId: string): number {
  let highest = 0;
  for (const n of listGenerations(keyDir, treeId)) {
    if (n > highest) highest = n;
  }
  return highest;
}

// Generasi aktif: scan N=1,2,... beruntun sampai gap. Generasi tertinggi
// pada rantai tanpa gap adalah kunci aktif yang dibaca ulang. Bila k1 tidak
// ada berarti kunci sudah dirotasi manual ke nomor lebih tinggi, sehingga
// kunci berikutnya dibuat baru (lihat getOrCreateDek).
function findActiveGeneration(keyDir: string, treeId: string): number | null {
  const generations = new Set(listGenerations(keyDir, treeId));
  if (!generations.has(1)) return null;
  let n = 1;
  while (generations.has(n + 1)) n += 1;
  return n;
}

function listGenerations(keyDir: string, treeId: string): number[] {
  let entries: string[];
  try {
    entries = readdirSync(keyDir);
  } catch {
    return [];
  }
  const prefix = `${treeId}.k`;
  const suffix = '.json';
  const generations: number[] = [];
  for (const entry of entries) {
    if (!entry.startsWith(prefix) || !entry.endsWith(suffix)) continue;
    const mid = entry.slice(prefix.length, entry.length - suffix.length);
    if (!/^\d+$/.test(mid)) continue;
    const n = Number.parseInt(mid, 10);
    if (Number.isSafeInteger(n) && n > 0) generations.push(n);
  }
  return generations;
}

function readWrappedDek(
  keyDir: string,
  treeId: string,
  generation: number,
  kek: Buffer,
): Buffer {
  const keyPath = join(keyDir, `${treeId}.k${generation}.json`);
  const parsed = JSON.parse(readFileSync(keyPath, 'utf8')) as KeyFileShape;
  const iv = Buffer.from(parsed.wrapped.iv, 'base64');
  const tag = Buffer.from(parsed.wrapped.tag, 'base64');
  const data = Buffer.from(parsed.wrapped.data, 'base64');
  if (iv.length !== WRAP_IV_BYTES) {
    throw new Error(
      `IV wrap untuk ${treeId} k${generation} harus ${WRAP_IV_BYTES} byte`,
    );
  }
  if (tag.length !== WRAP_TAG_BYTES) {
    throw new Error(
      `Auth tag wrap untuk ${treeId} k${generation} harus ${WRAP_TAG_BYTES} byte`,
    );
  }
  const decipher = createDecipheriv('aes-256-gcm', kek, iv);
  decipher.setAuthTag(tag);
  const dek = Buffer.concat([decipher.update(data), decipher.final()]);
  if (dek.length !== DEK_LENGTH_BYTES) {
    throw new Error(
      `DEK ter-unwrap untuk ${treeId} k${generation} berukuran ${dek.length} byte, harus ${DEK_LENGTH_BYTES} byte`,
    );
  }
  return dek;
}

function writeWrappedDek(
  keyDir: string,
  treeId: string,
  generation: number,
  dek: Buffer,
  kek: Buffer,
): void {
  const iv = randomBytes(WRAP_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', kek, iv);
  const data = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  const payload = JSON.stringify({
    wrapped: {
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: data.toString('base64'),
    },
  } satisfies KeyFileShape);
  const keyPath = join(keyDir, `${treeId}.k${generation}.json`);
  writeFileSync(keyPath, payload, { mode: KEY_FILE_MODE });
  chmodSync(keyPath, KEY_FILE_MODE);
}

// Ambil DEK aktif untuk treeId: unwrap generasi tertinggi bila ada,
// selain itu buat generasi baru k1 (atau k tertinggi ditambah satu).
export function getOrCreateDek(treeId: string): { dek: Buffer; keyId: string } {
  if (!TREE_ID_PATTERN.test(treeId)) {
    throw new Error(
      `treeId tidak valid, hanya huruf angka underscore strip, panjang 1 sampai 64: ${treeId}`,
    );
  }
  const masterKey = process.env.STMG_MASTER_KEY;
  if (!masterKey || masterKey.trim() === '') {
    throw new Error('STMG_MASTER_KEY wajib diset');
  }
  const keyDir = resolveKeyDir();
  mkdirSync(keyDir, { recursive: true, mode: KEY_DIR_MODE });
  const salt = loadOrCreateSalt(keyDir);
  const kek = deriveKek(masterKey, salt);

  const active = findActiveGeneration(keyDir, treeId);
  if (active !== null) {
    return {
      dek: readWrappedDek(keyDir, treeId, active, kek),
      keyId: `k${active}`,
    };
  }

  const dek = randomBytes(DEK_LENGTH_BYTES);
  const nextGeneration = findHighestGeneration(keyDir, treeId) + 1;
  writeWrappedDek(keyDir, treeId, nextGeneration, dek, kek);
  return { dek, keyId: `k${nextGeneration}` };
}

// Rotasi DEK untuk treeId: tulis generasi baru findHighestGeneration + 1
// tanpa menghapus generasi lama, sehingga event lama tetap terbaca lewat
// getDekByKeyId. Rotasi berarti generasi baru; penggantian STMG_MASTER_KEY
// (re-wrap KEK) cukup membungkus ulang file kunci tanpa menyentuh data.
// Batas operasi enkripsi per kunci menurut NIST SP 800-38D adalah 2^32,
// rotasi rutin menjaga pemakaian tetap di bawah batas itu.
export function rotateDek(treeId: string): { dek: Buffer; keyId: string } {
  if (!TREE_ID_PATTERN.test(treeId)) {
    throw new Error(
      `treeId tidak valid, hanya huruf angka underscore strip, panjang 1 sampai 64: ${treeId}`,
    );
  }
  const masterKey = process.env.STMG_MASTER_KEY;
  if (!masterKey || masterKey.trim() === '') {
    throw new Error('STMG_MASTER_KEY wajib diset');
  }
  const keyDir = resolveKeyDir();
  mkdirSync(keyDir, { recursive: true, mode: KEY_DIR_MODE });
  const salt = loadOrCreateSalt(keyDir);
  const kek = deriveKek(masterKey, salt);
  const dek = randomBytes(DEK_LENGTH_BYTES);
  const nextGeneration = findHighestGeneration(keyDir, treeId) + 1;
  writeWrappedDek(keyDir, treeId, nextGeneration, dek, kek);
  return { dek, keyId: `k${nextGeneration}` };
}

// Ambil DEK spesifik berdasar keyId berformat k<n>, n integer positif.
// Membaca file generasi n lalu unwrap dengan KEK. Mengembalikan null tanpa
// throw bila STMG_MASTER_KEY kosong, treeId tidak valid, keyId salah format,
// file generasi tidak ada, atau unwrap gagal (kunci rusak atau KEK beda).
export function getDekByKeyId(treeId: string, keyId: string): Buffer | null {
  if (!TREE_ID_PATTERN.test(treeId)) {
    return null;
  }
  if (!/^k\d+$/.test(keyId)) {
    return null;
  }
  const generation = Number.parseInt(keyId.slice(1), 10);
  if (!Number.isSafeInteger(generation) || generation <= 0) {
    return null;
  }
  const masterKey = process.env.STMG_MASTER_KEY;
  if (!masterKey || masterKey.trim() === '') {
    return null;
  }
  const keyDir = resolveKeyDir();
  const saltPath = join(keyDir, SALT_FILE_NAME);
  if (!existsSync(saltPath)) {
    return null;
  }
  let kek: Buffer;
  try {
    kek = deriveKek(masterKey, readFileSync(saltPath));
  } catch {
    return null;
  }
  try {
    return readWrappedDek(keyDir, treeId, generation, kek);
  } catch {
    return null;
  }
}

// Daftar keyId untuk treeId, terurut generasi naik.
export function listKeyIds(treeId: string): string[] {
  if (!TREE_ID_PATTERN.test(treeId)) {
    throw new Error(
      `treeId tidak valid, hanya huruf angka underscore strip, panjang 1 sampai 64: ${treeId}`,
    );
  }
  const generations = listGenerations(resolveKeyDir(), treeId);
  generations.sort((a, b) => a - b);
  return generations.map((n) => `k${n}`);
}
