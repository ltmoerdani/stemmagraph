/**
 * v398: parser multipart/form-data mini implementasi sendiri.
 *
 * Tanpa dependency (nihil multer). Menangani satu file field dan
 * beberapa text field sederhana dari body buffer mentah. Kontrak:
 * input buffer penuh body + header content-type, output field file
 * pertama (nama, contentType, bytes) dan peta text field. Body yang
 * melebihi batas ditolak sebelum parsing (mencegah OOM, OWASP).
 *
 * Format multipart per RFC 2045: bagian dipisah delimiter
 * `--boundary`, bagian penutup `--boundary--`. Header per bagian
 * dipisah CRLF, body diakhiri CRLF sebelum delimiter berikutnya.
 */

export interface MultipartFile {
  name: string;
  contentType: string | null;
  bytes: Uint8Array;
}

export interface MultipartParseResult {
  file: MultipartFile | null;
  fields: Record<string, string>;
}

/** Ambil boundary dari header Content-Type multipart/form-data. */
export function extractBoundary(contentType: string | undefined): string | null {
  if (!contentType) return null;
  const m = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  if (!m) return null;
  return m[1] ?? m[2] ?? null;
}

function bytesMatch(hay: Uint8Array, needle: Uint8Array, at: number): boolean {
  if (at + needle.length > hay.length) return false;
  for (let i = 0; i < needle.length; i++) {
    if (hay[at + i] !== needle[i]) return false;
  }
  return true;
}

function dashesAt(hay: Uint8Array, at: number): boolean {
  return at + 2 <= hay.length && hay[at] === 0x2d && hay[at + 1] === 0x2d;
}

/** Cari subsekuens byte (TypedArray.indexOf mencari nilai elemen, bukan subsekuens). */
function indexOfSeq(hay: Uint8Array, needle: Uint8Array, from: number): number {
  const last = hay.length - needle.length;
  for (let i = Math.max(0, from); i <= last; i++) {
    if (bytesMatch(hay, needle, i)) return i;
  }
  return -1;
}

/**
 * Parse body multipart. Mengembalikan null bila struktur tidak sah
 * (nihil boundary, nihil delimiter, body terpotong). File pertama
 * yang ditemukan menjadi `file`; field value biner tidak didukung.
 */
export function parseMultipart(
  body: Uint8Array,
  contentType: string | undefined,
): MultipartParseResult | null {
  const boundary = extractBoundary(contentType);
  if (boundary === null) return null;

  const enc = new TextEncoder();
  const delim = enc.encode(`--${boundary}`);
  const crlf = enc.encode('\r\n');
  const hdrSep = enc.encode('\r\n\r\n');
  const partDelim = enc.encode(`\r\n--${boundary}`);

  // Temukan delimiter pertama (toleransi preamble CRLF dari klien).
  let pos = -1;
  for (let i = 0; i + delim.length <= body.length; i++) {
    if (bytesMatch(body, delim, i)) {
      pos = i + delim.length;
      break;
    }
  }
  if (pos === -1) return null;

  let file: MultipartFile | null = null;
  const fields: Record<string, string> = {};
  const dec = new TextDecoder();

  for (;;) {
    // Setelah delimiter: `--` penutup, CRLF lanjut bagian berikutnya.
    if (dashesAt(body, pos)) break;
    if (bytesMatch(body, crlf, pos)) pos += crlf.length;

    const hdrEnd = indexOfSeq(body, hdrSep, pos);
    if (hdrEnd === -1) return null;
    const rawHeaders = dec.decode(body.subarray(pos, hdrEnd));
    const bodyStart = hdrEnd + hdrSep.length;

    // Batas bagian berikutnya: CRLF + delimiter.
    const partEnd = indexOfSeq(body, partDelim, bodyStart);
    if (partEnd === -1) return null;

    const headers = rawHeaders.split('\r\n');
    let partName: string | null = null;
    let partFilename: string | null = null;
    let partType: string | null = null;
    for (const line of headers) {
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const lk = line.slice(0, idx).trim().toLowerCase();
      const value = line.slice(idx + 1).trim();
      if (lk === 'content-disposition') {
        const nm = /name="([^"]*)"/.exec(value);
        if (nm) partName = nm[1];
        const fn = /filename="([^"]*)"/.exec(value);
        if (fn) partFilename = fn[1];
      } else if (lk === 'content-type') {
        partType = value;
      }
    }

    if (partName !== null) {
      const partBytes = body.subarray(bodyStart, partEnd);
      if (partFilename !== null || partType !== null) {
        if (file === null) {
          file = {
            name: partName,
            contentType: partType,
            bytes: partBytes.slice(),
          };
        }
      } else {
        fields[partName] = dec.decode(partBytes);
      }
    }

    pos = partEnd + partDelim.length;
    if (pos >= body.length) return null;
  }

  return { file, fields };
}

/**
 * Ambil payload gambar dari request upload: base64 JSON
 * ({ photoBase64 }) atau multipart (file field `photo`). Payload
 * tidak sah mengembalikan null; validasi ukuran dan magic bytes
 * lewat validatePhotoUpload supaya aturan satu pintu.
 */
export function extractPhotoPayload(
  body: unknown,
  rawBody: Uint8Array | null,
  contentType: string | undefined,
): { bytes: Uint8Array; source: 'multipart' | 'base64' } | null {
  const isMultipart =
    typeof contentType === 'string' && contentType.toLowerCase().includes('multipart/form-data');
  if (isMultipart) {
    if (rawBody === null || rawBody.length === 0) return null;
    const parsed = parseMultipart(rawBody, contentType);
    if (parsed === null || parsed.file === null) return null;
    return { bytes: parsed.file.bytes, source: 'multipart' };
  }
  const json = body as { photoBase64?: unknown } | null;
  if (
    json !== null &&
    typeof json === 'object' &&
    typeof json.photoBase64 === 'string' &&
    json.photoBase64.length > 0
  ) {
    const bytes = new Uint8Array(Buffer.from(json.photoBase64, 'base64'));
    if (bytes.length === 0) return null;
    return { bytes, source: 'base64' };
  }
  return null;
}
