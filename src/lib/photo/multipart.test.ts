/**
 * Test v398: parser multipart mini (pure, tanpa I/O).
 */
import { describe, expect, it } from 'vitest';
import { extractBoundary, extractPhotoPayload, parseMultipart } from './multipart';

const enc = new TextEncoder();

function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

function buildBody(opts: {
  boundary?: string;
  file?: { field: string; filename: string; mime: string; bytes: Uint8Array };
  fields?: Record<string, string>;
}): { body: Uint8Array; contentType: string } {
  const boundary = opts.boundary ?? 'testbound123';
  const chunks: Uint8Array[] = [];
  const push = (s: string) => chunks.push(enc.encode(s));
  if (opts.file) {
    push(`--${boundary}\r\n`);
    push(
      `Content-Disposition: form-data; name="${opts.file.field}"; filename="${opts.file.filename}"\r\n` +
        `Content-Type: ${opts.file.mime}\r\n\r\n`,
    );
    chunks.push(opts.file.bytes);
    push(`\r\n`);
  }
  if (opts.fields) {
    for (const [k, v] of Object.entries(opts.fields)) {
      push(`--${boundary}\r\n`);
      push(`Content-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
    }
  }
  push(`--${boundary}--\r\n`);
  return { body: concat(chunks), contentType: `multipart/form-data; boundary=${boundary}` };
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01]);

describe('extractBoundary', () => {
  it('membaca boundary polos', () => {
    expect(extractBoundary('multipart/form-data; boundary=abc123')).toBe('abc123');
  });

  it('membaca boundary berkutip', () => {
    expect(extractBoundary('multipart/form-data; boundary="abc 123"')).toBe('abc 123');
  });

  it('menolak non-multipart dan nihil boundary', () => {
    expect(extractBoundary('application/json')).toBeNull();
    expect(extractBoundary('multipart/form-data')).toBeNull();
    expect(extractBoundary(undefined)).toBeNull();
  });
});

describe('parseMultipart', () => {
  it('mengekstrak file dengan nama, tipe, dan bytes utuh', () => {
    const { body, contentType } = buildBody({ file: { field: 'photo', filename: 'a.png', mime: 'image/png', bytes: PNG } });
    const r = parseMultipart(body, contentType);
    expect(r).not.toBeNull();
    expect(r!.file).not.toBeNull();
    expect(r!.file!.name).toBe('photo');
    expect(r!.file!.contentType).toBe('image/png');
    expect(Array.from(r!.file!.bytes)).toEqual(Array.from(PNG));
  });

  it('mengekstrak text field', () => {
    const { body, contentType } = buildBody({ fields: { note: 'halo', dua: 'x' } });
    const r = parseMultipart(body, contentType);
    expect(r!.fields).toEqual({ note: 'halo', dua: 'x' });
    expect(r!.file).toBeNull();
  });

  it('mencampur file dan field, file pertama menang', () => {
    const { body, contentType } = buildBody({
      fields: { caption: 'foto adi' },
      file: { field: 'photo', filename: 'a.png', mime: 'image/png', bytes: PNG },
    });
    const r = parseMultipart(body, contentType);
    expect(r).not.toBeNull();
    expect(r!.file!.name).toBe('photo');
    expect(r!.fields['caption']).toBe('foto adi');
  });

  it('menolak body nihil delimiter', () => {
    const r = parseMultipart(enc.encode('bukan multipart'), 'multipart/form-data; boundary=testbound123');
    expect(r).toBeNull();
  });

  it('menolak body terpotong (nihil penutup)', () => {
    const chunks = [
      enc.encode('--testbound123\r\n'),
      enc.encode('Content-Disposition: form-data; name="photo"; filename="a.png"\r\nContent-Type: image/png\r\n\r\n'),
      PNG,
    ];
    const r = parseMultipart(concat(chunks), 'multipart/form-data; boundary=testbound123');
    expect(r).toBeNull();
  });
});

describe('extractPhotoPayload', () => {
  it('mengambil dari multipart file field photo', () => {
    const { body, contentType } = buildBody({ file: { field: 'photo', filename: 'a.png', mime: 'image/png', bytes: PNG } });
    const r = extractPhotoPayload(undefined, body, contentType);
    expect(r).not.toBeNull();
    expect(r!.bytes).toEqual(PNG);
    expect(r!.source).toBe('multipart');
  });

  it('mengambil dari JSON base64', () => {
    const payload = { photoBase64: Buffer.from(PNG).toString('base64') };
    const r = extractPhotoPayload(payload, null, 'application/json');
    expect(r).not.toBeNull();
    expect(Array.from(r!.bytes)).toEqual(Array.from(PNG));
    expect(r!.source).toBe('base64');
  });

  it('menolak base64 kosong dan base64 rusak tetap jujur nihil payload', () => {
    expect(extractPhotoPayload({ photoBase64: '' }, null, 'application/json')).toBeNull();
    const bad = extractPhotoPayload({ photoBase64: '!!!' }, null, 'application/json');
    expect(bad).toBeNull();
  });

  it('menolak multipart tanpa file part', () => {
    const { body, contentType } = buildBody({ fields: { catatan: 'tanpa file' } });
    expect(extractPhotoPayload(undefined, body, contentType)).toBeNull();
  });

  it('menolak contentType tak dikenal', () => {
    expect(extractPhotoPayload({ lain: 1 }, null, 'text/plain')).toBeNull();
  });
});
