// v394 ICS feed kalender keluarga (fase 1): generator ICS murni (RFC 5545).
//
// PURE: tanpa I/O, tanpa jam sistem (now diinjeksi), tanpa dependency.
// Konsumen: route /api/v1/trees/:treeId/calendar.ics yang menyusun entries
// dari computeNextAnniversaries (horizon 2 tahun diputuskan pemanggil lewat
// lebar jendela hari; tanggal efektif haulOverrideDate lewat helper
// effectiveHaulDate di modul ini). UID dibuat deterministik per kind+refId
// supaya klien kalender memperbarui event yang sama antar refresh feed,
// bukan menduplikasi.
//
// Aturan format yang diuji: escaping nilai teks (RFC 5545 3.3.11),
// fold baris maksimal 75 oktet (RFC 5545 3.1), VALUE=DATE all-day,
// DTSTAMP UTC dari now yang diinjeksi.

export interface IcsEntry {
  /** 'birthday' | 'wedding' | 'haul', dipetakan ke label via labels. */
  kind: string;
  /** Identitas stabil: anggota atau pasangan (sama dengan refId reminders). */
  refId: string;
  /** Nama tampil, sudah final dari modul anniversaries. */
  displayName: string;
  /** Tanggal sumber YYYY-MM-DD, valid kalender (dari parser strict). */
  date: string;
  /** Tanggal peringatan berikutnya YYYY-MM-DD (hasil compute). */
  nextDate: string;
  /** Tahun penuh dijangkau (umur / tahun menikah / tahun sejak wafat). */
  yearsCompleted: number;
}

/**
 * Tanggal haul efektif satu anggota wafat: prioritas haulOverrideDate
 * keluarga, fallback deathDate saat override nihil atau string kosong.
 * Dipakai pemanggil saat menyusun items kind 'haul' sebelum compute.
 */
export function effectiveHaulDate(
  deathDate: string | null | undefined,
  haulOverrideDate: string | null | undefined,
): string | null {
  const override = typeof haulOverrideDate === 'string' ? haulOverrideDate.trim() : '';
  if (override.length > 0) return override;
  const death = typeof deathDate === 'string' ? deathDate.trim() : '';
  return death.length > 0 ? death : null;
}

/** Satu peringatan tahunan menjadi satu VEVENT all-day pada nextDate. */
function vevent(entry: IcsEntry, labels: Record<string, string>, dtstamp: string): string[] {
  const uid = `stg-${entry.kind}-${entry.refId}@stemmagraph`;
  const label = labels[entry.kind] ?? entry.kind;
  const years = entry.yearsCompleted > 0 ? ` (${entry.yearsCompleted})` : '';
  const summary = `${label}: ${entry.displayName}${years}`;
  const ymd = entry.nextDate.replace(/-/g, '');
  return [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${nextDay(ymd)}`,
    `SUMMARY:${escapeText(summary)}`,
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ];
}

/** YYYYMMDD menjadi YYYYMMDD berikutnya (kalender murni, cukup utk all-day). */
function nextDay(ymd: string): string {
  const y = Number(ymd.slice(0, 4));
  const m = Number(ymd.slice(4, 6));
  const d = Number(ymd.slice(6, 8));
  const len = [31, (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1] ?? 31;
  if (d < len) return `${ymd.slice(0, 6)}${String(d + 1).padStart(2, '0')}`;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${String(ny).padStart(4, '0')}${String(nm).padStart(2, '0')}01`;
}

/** Escaping nilai teks RFC 5545 3.3.11: backslash, semicolon, comma, newline. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

/**
 * Fold satu konten line maksimal 75 oktet per baris (RFC 5545 3.1):
 * kelanjutan diawali satu spasi. Aman UTF-8: tidak membelah oktet tengah
 * karakter multibyte (potong pada batas code point di bawah anggaran oktet).
 */
function foldLine(line: string): string[] {
  const budget = 75;
  const out: string[] = [];
  let rest = line;
  let first = true;
  while (octets(rest) > budget) {
    const limit = first ? budget : budget - 1;
    const cut = cutAt(rest, limit);
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
    first = false;
  }
  out.push(rest);
  return out;
}

function octets(s: string): number {
  return Buffer.byteLength(s, 'utf8');
}

/** Potong pada indeks karakter terakhir yang seluruh oktetnya muat dalam limit. */
function cutAt(s: string, limit: number): number {
  let bytes = 0;
  let idx = 0;
  for (const ch of s) {
    const b = octets(ch);
    if (bytes + b > limit) break;
    bytes += b;
    idx += ch.length;
  }
  return idx;
}

/** DTSTAMP UTC format dasar RFC 5545 dari Date yang diinjeksi. */
export function icsDtstamp(now: Date): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`;
}

/**
 * Susun dokumen VCALENDAR penuh dari entries hasil computeNextAnniversaries.
 * Deterministik terhadap entries + now: urutan input dipertahankan
 * (compute sudah mengurutkan berdasarkan daysUntil).
 */
export function buildIcsFeed(
  entries: IcsEntry[],
  options: { labels: Record<string, string>; now?: Date; name?: string },
): string {
  const now = options.now ?? new Date();
  const dtstamp = icsDtstamp(now);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Stemmagraph//Family Calendar v394//ID',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (options.name) {
    lines.push(`X-WR-CALNAME:${escapeText(options.name)}`);
  }
  for (const entry of entries) {
    lines.push(...vevent(entry, options.labels, dtstamp));
  }
  lines.push('END:VCALENDAR');
  return lines.map(foldLine).map((parts) => parts.join('\r\n')).join('\r\n') + '\r\n';
}
