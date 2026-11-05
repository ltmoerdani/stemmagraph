/**
 * Penyimpanan API key BYO (Bring Your Own Key) terenkripsi (STG v420
 * Pilar 5, micro-2, AC2).
 *
 * KONTRAK BYO: API key milik pengguna, alur self-host. TIDAK ADA
 * telemetri dan TIDAK ADA pengiriman data keluar dari perangkat: modul
 * ini hanya menyentuh IndexedDB lokal, tidak ada fetch/XHR/WebSocket
 * sama sekali.
 *
 * Arsitektur: IndexedDB database TERPISAH bernama `stemmagraph-byo-key`
 * (bukan database app) dengan dua object store:
 *
 * - `wrap-keys`: CryptoKey AES-GCM 256 non-extractable sebagai wrapping
 *   key. Non-extractable berarti key mentah tidak bisa diekspor ulang
 *   dari storage, hanya dipakai lewat operasi WebCrypto.
 * - `secrets`: record { slot, ivB64, ctB64, updatedAt }, ciphertext
 *   AES-GCM dari API key mentah dengan IV 12 byte acak per enkripsi.
 *
 * Semua kegagalan dilempar sebagai ByoKeyError berpesan apiKeyError()
 * dari byo-key-mask.ts, tanpa potongan key, sesuai kontrak masking AC1.
 */

import { apiKeyError } from './byo-key-mask';

/** Nama database IndexedDB terpisah khusus API key BYO. */
const DB_NAME = 'stemmagraph-byo-key';

/** Versi skema database. */
const DB_VERSION = 1;

/** Object store untuk CryptoKey wrapping AES-GCM 256 non-extractable. */
const STORE_WRAP_KEYS = 'wrap-keys';

/** Object store untuk record terenkripsi {slot, ivB64, ctB64, updatedAt}. */
const STORE_SECRETS = 'secrets';

/** KeyPath field slot pada object store secrets. */
const SECRET_KEY_PATH = 'slot';

/** Nama record tunggal wrapping key di store wrap-keys. */
const WRAP_KEY_ID = 'wrap-key-v1';

/** Panjang IV AES-GCM, 12 byte. */
const IV_BYTES = 12;

/** Kode error: gagal dekripsi (ciphertext rusak atau wrapping key beda). */
export const CODE_DECRYPT_FAILED = 'BYO_KEY_DECRYPT_FAILED';

/** Kode error: IndexedDB atau WebCrypto tidak tersedia di environment. */
export const CODE_UNAVAILABLE = 'BYO_KEY_UNAVAILABLE';

/**
 * Record terenkripsi satu slot API key di store secrets. Tidak ada
 * field yang memuat key mentah, hanya IV dan ciphertext base64.
 */
export interface SecretRecord {
  /** Nama slot pemilik record, mis. 'openai'. */
  slot: string;
  /** IV 12 byte hasil enkripsi, base64. */
  ivB64: string;
  /** Ciphertext AES-GCM dari API key mentah, base64. */
  ctB64: string;
  /** Epoch ms saat record terakhir ditulis. */
  updatedAt: number;
}

/**
 * Error khusus BYO key. Pesan selalu dibangun lewat apiKeyError() dari
 * byo-key-mask.ts sehingga dijamin bebas potongan API key.
 */
export class ByoKeyError extends Error {
  /** Kode penyebab: BYO_KEY_DECRYPT_FAILED atau BYO_KEY_UNAVAILABLE. */
  readonly code: string;

  /**
   * @param code kode penyebab terstandar.
   * @param reason alasan pendek tanpa data sensitif, diteruskan ke apiKeyError.
   */
  constructor(code: string, reason: string) {
    super(apiKeyError(reason));
    this.name = 'ByoKeyError';
    this.code = code;
  }
}

/**
 * Guard environment: IndexedDB wajib ada. Di node test tanpa stub,
 * typeof indexedDB bernilai undefined sehingga langsung ditolak.
 */
function ensureIndexedDbAvailable(): void {
  if (typeof indexedDB === 'undefined') {
    throw new ByoKeyError(CODE_UNAVAILABLE, 'storage lokal tidak tersedia');
  }
}

/**
 * Guard environment: WebCrypto subtle wajib ada karena enkripsi
 * sepenuhnya bergantung pada globalThis.crypto.subtle.
 */
function ensureWebCryptoAvailable(): void {
  if (!globalThis.crypto?.subtle) {
    throw new ByoKeyError(CODE_UNAVAILABLE, 'WebCrypto tidak tersedia');
  }
}

/**
 * Bungkus IDBRequest menjadi promise: resolve pada onsuccess, reject
 * pada onerror. Semua request IDB di modul ini melewati helper ini
 * agar tidak ada callback telanjang yang tersebar.
 */
function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Tunggu transaksi IDB selesai: resolve pada oncomplete, reject pada
 * onerror maupun onabort. Semua penulisan baru dianggap sukses setelah
 * oncomplete, bukan sekadar setelah request terakhir di antre.
 */
function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () =>
      reject(
        transaction.error ??
          new ByoKeyError(CODE_UNAVAILABLE, 'transaksi dibatalkan'),
      );
  });
}

/**
 * Buka database IndexedDB dan pastikan skema dua object store sudah
 * dibuat lewat onupgradeneeded (sekali saat versi baru).
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const openRequest = indexedDB.open(DB_NAME, DB_VERSION);
    openRequest.onupgradeneeded = () => {
      const db = openRequest.result;
      if (!db.objectStoreNames.contains(STORE_WRAP_KEYS)) {
        db.createObjectStore(STORE_WRAP_KEYS);
      }
      if (!db.objectStoreNames.contains(STORE_SECRETS)) {
        db.createObjectStore(STORE_SECRETS, { keyPath: SECRET_KEY_PATH });
      }
    };
    openRequest.onsuccess = () => resolve(openRequest.result);
    openRequest.onerror = () => reject(openRequest.error);
    openRequest.onblocked = () =>
      reject(new ByoKeyError(CODE_UNAVAILABLE, 'database terblokir tab lain'));
  });
}

/**
 * Ambil CryptoKey wrapping AES-GCM 256 non-extractable dari store
 * wrap-keys. Bila belum ada (jalur pertama kali), generate satu key
 * dengan extractable false lalu simpan. Cek ulang di dalam transaksi
 * tulis meredam race dua tab yang membuka database bersamaan.
 */
async function getOrCreateWrapKey(db: IDBDatabase): Promise<CryptoKey> {
  const readTx = db.transaction(STORE_WRAP_KEYS, 'readonly');
  const existing = await requestToPromise(
    readTx.objectStore(STORE_WRAP_KEYS).get(WRAP_KEY_ID),
  );
  if (existing) {
    return existing as CryptoKey;
  }
  ensureWebCryptoAvailable();
  const generated = await globalThis.crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  const writeTx = db.transaction(STORE_WRAP_KEYS, 'readwrite');
  const writeStore = writeTx.objectStore(STORE_WRAP_KEYS);
  const recheck = await requestToPromise(writeStore.get(WRAP_KEY_ID));
  if (recheck) {
    return recheck as CryptoKey;
  }
  writeStore.put(generated, WRAP_KEY_ID);
  await transactionDone(writeTx);
  return generated;
}

/**
 * Konversi byte (ArrayBuffer atau Uint8Array) ke base64. Implementasi
 * manual tanpa Buffer agar identik di browser maupun node test.
 */
export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (let i = 0; i < view.length; i += 1) {
    binary += String.fromCharCode(view[i]);
  }
  return btoa(binary);
}

/**
 * Konversi base64 kembali ke Uint8Array. Implementasi manual tanpa
 * Buffer, pasangan roundtrip dari toB64.
 */
export function fromB64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

/**
 * Enkripsi API key mentah memakai wrapping key AES-GCM. IV baru 12
 * byte acak dihasilkan setiap pemanggilan via getRandomValues, jadi
 * dua enkripsi key sama menghasilkan ciphertext berbeda.
 *
 * @param slot nama slot pemilik key.
 * @param rawKey API key mentah, hanya dipakai sebagai input enkripsi.
 * @param wrapKey CryptoKey AES-GCM non-extractable.
 * @returns record SecretRecord siap ditulis ke store secrets.
 */
export async function encryptWithKey(
  slot: string,
  rawKey: string,
  wrapKey: CryptoKey,
): Promise<SecretRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encoded = new TextEncoder().encode(rawKey);
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    wrapKey,
    encoded,
  );
  return {
    slot,
    ivB64: toB64(iv),
    ctB64: toB64(ct),
    updatedAt: Date.now(),
  };
}

/**
 * Dekripsi record SecretRecord kembali menjadi API key mentah.
 * Kegagalan auth GCM (ciphertext rusak, record dimanipulasi, atau
 * wrapping key tidak cocok) dilempar sebagai ByoKeyError berkode
 * BYO_KEY_DECRYPT_FAILED tanpa detail biner maupun potongan key.
 *
 * @param record record terenkripsi dari store secrets.
 * @param wrapKey CryptoKey AES-GCM yang mem wrap record tersebut.
 * @returns API key mentah.
 */
export async function decryptWithKey(
  record: SecretRecord,
  wrapKey: CryptoKey,
): Promise<string> {
  try {
    const iv = fromB64(record.ivB64);
    const ct = fromB64(record.ctB64);
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      wrapKey,
      ct,
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new ByoKeyError(CODE_DECRYPT_FAILED, 'dekripsi gagal');
  }
}

/**
 * Simpan API key mentah ke slot, menimpa isi lama bila ada. Alur:
 * guard environment, buka db, ambil atau buat wrapping key, enkripsi
 * dengan IV acak baru, tulis record, tunggu transaksi oncomplete.
 */
export async function saveApiKey(slot: string, rawKey: string): Promise<void> {
  ensureIndexedDbAvailable();
  ensureWebCryptoAvailable();
  const db = await openDatabase();
  try {
    const wrapKey = await getOrCreateWrapKey(db);
    const record = await encryptWithKey(slot, rawKey, wrapKey);
    const tx = db.transaction(STORE_SECRETS, 'readwrite');
    tx.objectStore(STORE_SECRETS).put(record);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}

/**
 * Muat dan dekripsi API key dari slot. Mengembalikan null bila record
 * tidak ada. Kegagalan dekripsi melempar ByoKeyError berkode
 * BYO_KEY_DECRYPT_FAILED.
 */
export async function loadApiKey(slot: string): Promise<string | null> {
  ensureIndexedDbAvailable();
  ensureWebCryptoAvailable();
  const db = await openDatabase();
  try {
    const wrapKey = await getOrCreateWrapKey(db);
    const tx = db.transaction(STORE_SECRETS, 'readonly');
    const got = await requestToPromise(
      tx.objectStore(STORE_SECRETS).get(slot),
    );
    if (!got) {
      return null;
    }
    return await decryptWithKey(got as SecretRecord, wrapKey);
  } finally {
    db.close();
  }
}

/**
 * Hapus record pada slot. Tidak error bila record memang tidak ada;
 * sukses berarti slot kosong setelah transaksi oncomplete.
 */
export async function removeApiKey(slot: string): Promise<void> {
  ensureIndexedDbAvailable();
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_SECRETS, 'readwrite');
    tx.objectStore(STORE_SECRETS).delete(slot);
    await transactionDone(tx);
  } finally {
    db.close();
  }
}
