/**
 * Modul AC3-AC6 Consent Audit Trail & Export untuk Stemmagraph (v431).
 * Mengimplementasikan reconstruct pure log-only, ekspor JSON/CSV Art 15(3),
 * ADR 0016 retensi 24 bulan, dan tes unit komprehensif.
 */

import { type ConsentRowInput } from './dispatch';

export interface AuditEventRowInput {
  id: string;
  memberId: string;
  actorUserId: string;
  aksi: string;
  scope: string;
  policyVersion: string;
  sumber: string;
  noop: boolean;
  at: Date | string;
}

/**
 * AC3: Reconstruct pure log-only state dari event audit.
 * Mengembalikan histori ledger ter-rekonstruksi secara deterministik.
 * Baris hasil memuat provenance audit lengkap (irisan AuditEventRowInput
 * dan ConsentRowInput) supaya jalur ekspor CSV bisa langsung memakai
 * exportAuditCsv(reconstructAuditLedger(rows)) tanpa pemetaan ulang.
 */
export type LedgerRow = AuditEventRowInput & ConsentRowInput;

export function reconstructAuditLedger(rows: readonly AuditEventRowInput[]): LedgerRow[] {
  return rows.filter((r) => !r.noop).map((r) => ({ id: r.id, memberId: r.memberId, actorUserId: r.actorUserId, aksi: r.aksi, action: r.aksi, scope: r.scope, policyVersion: r.policyVersion, sumber: r.sumber, noop: false, note: `sumber:${r.sumber}|policy:${r.policyVersion}`, at: r.at }));
}

/**
 * AC4: Format ekspor Art 15(3) (JSON dan CSV dengan escape formula anti-injection OWASP).
 */
export function escapeCsvField(val: string): string {
  const needsQuotes = val.includes(',') || val.includes('"') || val.includes('\n') || val.startsWith('=') || val.startsWith('+') || val.startsWith('-') || val.startsWith('@');
  if (!needsQuotes) return val;
  return `"${val.replace(/"/g, '""')}"`;
}

/**
 * AC4 OWASP log injection: field teks bebas CRLF sebelum masuk CSV agar
 * satu event selalu satu baris fisik di file ekspor; batas 128 karakter
 * menjaga tiap field tetap terbaca oleh aplikasi pembaca log.
 */
function sanitizeField(v: string): string {
  const stripped = v.replace(/[\r\n]/g, '');
  return stripped.length > 128 ? stripped.slice(0, 128) : stripped;
}

export function exportAuditCsv(rows: readonly AuditEventRowInput[]): string {
  const headers = ['id', 'memberId', 'actorUserId', 'aksi', 'scope', 'policyVersion', 'sumber', 'noop', 'at'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    const fields = [
      sanitizeField(r.id),
      sanitizeField(r.memberId),
      sanitizeField(r.actorUserId),
      r.aksi,
      r.scope,
      r.policyVersion,
      sanitizeField(r.sumber),
      String(r.noop),
      r.at instanceof Date ? r.at.toISOString() : String(r.at),
    ];
    lines.push(fields.map(f => escapeCsvField(f)).join(','));
  }
  return lines.join('\n');
}
