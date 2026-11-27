// Import gate OBJE (STG v467-A): validasi struktural record media.
//
// Kardinalitas GEDCOM 7.0.18: record OBJE wajib membawa minimal satu
// FILE (FILE {1:M}) dan tiap FILE wajib membawa tepat satu FORM
// (FORM {1:1}) berpayload media type. Dokumen yang melanggar kedua
// aturan itu ditolak saat import, sesuai halaman spek OBJE/record-OBJE
// gedcom.io (evidence wake-354).
//
// Scanner murni level teks: menelusuri struktur baris (level + tag),
// melacak record OBJE level 0 yang sedang terbuka, dan melaporkan semua
// pelanggaran dengan kode stabil, nomor baris 1-based, dan xref record.
// Pointer OBJE embedded (level di atas 0) adalah referensi bukan record
// dan tidak pernah membuka record. Baris FILE dan FORM di luar record
// OBJE diabaikan gate ini (legalitas skema di luar cakupan).
//
// Modul pure: tanpa database, tanpa akses environment, tanpa concerns
// komersial apa pun.

export type ObjeErrorCode = 'OBJE_NO_FILE' | 'FILE_NO_FORM';

export interface ObjeGateError {
  code: ObjeErrorCode;
  message: string;
  line: number;
  xref: string;
}

interface PendingFile {
  line: number;
}

interface OpenObjeRecord {
  xref: string;
  startLine: number;
  fileCount: number;
  pendingFile: PendingFile | null;
}

export function scanObjeGate(text: string): ObjeGateError[] {
  const errors: ObjeGateError[] = [];
  const lines = text.split('\n');
  let open: OpenObjeRecord | null = null;

  const flushPendingFile = (xref: string, pending: PendingFile) => {
    errors.push({
      code: 'FILE_NO_FORM',
      message: 'Payload FILE ditolak: FORM wajib tepat satu di tiap FILE (kardinalitas FORM 1:1 per GEDCOM 7).',
      line: pending.line,
      xref,
    });
  };

  const closeOpen = () => {
    if (!open) return;
    if (open.fileCount === 0) {
      errors.push({
        code: 'OBJE_NO_FILE',
        message: 'Record OBJE ditolak: minimal satu FILE wajib ada di record OBJE (kardinalitas FILE 1:M per GEDCOM 7).',
        line: open.startLine,
        xref: open.xref,
      });
    }
    if (open.pendingFile) flushPendingFile(open.xref, open.pendingFile);
    open = null;
  };
  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i].trim();
    if (raw === '') continue;
    const level = Number(raw.slice(0, raw.indexOf(' ')));
    const withoutLevel = raw.slice(raw.indexOf(' ') + 1);
    let xrefToken = '';
    let rest = withoutLevel;
    if (rest.startsWith('@')) {
      const end = rest.indexOf('@', 1);
      if (end > 0) {
        xrefToken = rest.slice(0, end + 1);
        rest = rest.slice(end + 1).trim();
      }
    }
    const sp = rest.indexOf(' ');
    const tag = sp === -1 ? rest : rest.slice(0, sp);
    const payload = sp === -1 ? '' : rest.slice(sp + 1);
    if (level === 0) {
      if (tag === 'OBJE' && xrefToken) {
        closeOpen();
        open = { xref: xrefToken, startLine: i + 1, fileCount: 0, pendingFile: null };
      } else {
        closeOpen();
      }
      continue;
    }
    if (!open) continue;
    if (level === 1 && tag === 'FILE') {
      if (open.pendingFile) flushPendingFile(open.xref, open.pendingFile);
      open.fileCount += 1;
      open.pendingFile = { line: i + 1 };
      continue;
    }
    if (level === 2 && tag === 'FORM' && open.pendingFile && payload !== '') {
      open.pendingFile = null;
      continue;
    }
  }
  closeOpen();
  return errors;
}
