// Unit test generator ICS v394 (modul pure src/lib/calendar/icsFeed.ts).
// Cakupan: struktur VCALENDAR/VEVENT all-day, UID deterministik per
// kind+refId, escaping teks (backslash, semicolon, comma, newline), fold
// 75 oktet aman UTF-8, DTSTAMP dari now yang diinjeksi, horizon dua tahun
// disusun pemanggil dari computeNextAnniversaries (diuji jalur wiringnya),
// prioritas haulOverrideDate fallback deathDate via effectiveHaulDate.

import { describe, expect, it } from 'vitest';
import { buildIcsFeed, effectiveHaulDate, icsDtstamp, type IcsEntry } from './icsFeed';
import { computeNextAnniversaries } from '../anniversaries/nextAnniversaries';

const NOW = new Date('2026-10-25T03:00:00Z');
const LABELS = { birthday: 'Ulang tahun', wedding: 'Anniversary nikah', haul: 'Haul' };

function entry(partial: Partial<IcsEntry>): IcsEntry {
  return {
    kind: 'birthday',
    refId: 'm-1',
    displayName: 'Adi',
    date: '1990-10-24',
    nextDate: '2026-10-24',
    yearsCompleted: 36,
    ...partial,
  };
}

function unfold(text: string): string {
  return text.replace(/\r\n /g, '');
}

function lines(text: string): string[] {
  return text.split('\r\n').filter((l) => l.length > 0);
}

describe('buildIcsFeed (v394)', () => {
  it('struktur VCALENDAR minimal dengan satu VEVENT all-day VALUE=DATE', () => {
    const out = buildIcsFeed([entry({})], { labels: LABELS, now: NOW, name: 'Keluarga Sitorus' });
    expect(out.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(out).toContain('VERSION:2.0');
    expect(out).toContain('PRODID:-//Stemmagraph//Family Calendar v394//ID');
    expect(out).toContain('CALSCALE:GREGORIAN');
    expect(unfold(out)).toContain('X-WR-CALNAME:Keluarga Sitorus');
    expect(out).toContain('BEGIN:VEVENT');
    expect(out).toContain('UID:stg-birthday-m-1@stemmagraph');
    expect(out).toContain('DTSTART;VALUE=DATE:20261024');
    expect(out).toContain('DTEND;VALUE=DATE:20261025');
    expect(out).toContain('END:VEVENT');
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('SUMMARY memakai label kind, nama, dan tahun dicapai bila lebih dari 0', () => {
    const out = buildIcsFeed([entry({ kind: 'haul', refId: 'h-1', displayName: 'Opung', nextDate: '2026-11-15', yearsCompleted: 8 })], { labels: LABELS, now: NOW });
    expect(unfold(out)).toContain('SUMMARY:Haul: Opung (8)');
    const wedding = buildIcsFeed([entry({ kind: 'wedding', refId: 'w-1', displayName: 'A & B', yearsCompleted: 0 })], { labels: LABELS, now: NOW });
    expect(unfold(wedding)).toContain('SUMMARY:Anniversary nikah: A & B');
  });

  it('UID stabil antar panggilan dan antar DTSTAMP berbeda (deterministik kind+refId)', () => {
    const a = buildIcsFeed([entry({})], { labels: LABELS, now: NOW });
    const b = buildIcsFeed([entry({})], { labels: LABELS, now: new Date('2027-01-01T00:00:00Z') });
    const ua = a.match(/UID:(.*)\r\n/)![1];
    const ub = b.match(/UID:(.*)\r\n/)![1];
    expect(ua).toBe('stg-birthday-m-1@stemmagraph');
    expect(ua).toBe(ub);
    const c = buildIcsFeed([entry({ refId: 'm-2' })], { labels: LABELS, now: NOW });
    expect(c).not.toContain(`UID:${ua}`);
    const d = buildIcsFeed([entry({ kind: 'haul', refId: 'm-1' })], { labels: LABELS, now: NOW });
    expect(d).toContain('UID:stg-haul-m-1@stemmagraph');
  });

  it('escaping backslash, semicolon, comma, dan newline pada SUMMARY', () => {
    const out = buildIcsFeed([entry({ displayName: 'A;B,C\\D\nE', yearsCompleted: 0 })], { labels: LABELS, now: NOW });
    expect(unfold(out)).toContain('SUMMARY:Ulang tahun: A\\;B\\,C\\\\D\\nE');
  });

  it('DTSTAMP mengikuti now yang diinjeksi (format UTC dasar)', () => {
    const out = buildIcsFeed([entry({})], { labels: LABELS, now: NOW });
    expect(out).toContain(`DTSTAMP:${icsDtstamp(NOW)}`);
    expect(icsDtstamp(NOW)).toBe('20261025T030000Z');
  });

  it('setiap baris maksimal 75 oktet, fold aman karakter multibyte UTF-8', () => {
    const panjang = 'N'.repeat(90) + ' é '.repeat(20);
    const out = buildIcsFeed([entry({ displayName: panjang })], { labels: LABELS, now: NOW });
    for (const line of lines(out)) {
      expect(Buffer.byteLength(line, 'utf8')).toBeLessThanOrEqual(75);
    }
    expect(out).toContain('\r\n ');
  });

  it('entries kosong: VCALENDAR tanpa VEVENT', () => {
    const out = buildIcsFeed([], { labels: LABELS, now: NOW });
    expect(out).not.toContain('BEGIN:VEVENT');
  });

  it('wiring horizon dua tahun: entries dari computeNextAnniversaries hari=730 diterjemahkan jadi VEVENT', () => {
    const items = [
      { kind: 'birthday' as const, refId: 'm-1', displayName: 'Adi', date: '1990-10-24' },
      { kind: 'wedding' as const, refId: 'p-1:p-2', displayName: 'B & C', date: '2015-03-07' },
    ];
    const horizon = computeNextAnniversaries(items, NOW, 730);
    expect(horizon.length).toBe(2);
    const out = buildIcsFeed(horizon, { labels: LABELS, now: NOW });
    expect(out).toContain('UID:stg-birthday-m-1@stemmagraph');
    expect(out).toContain('UID:stg-wedding-p-1:p-2@stemmagraph');
    // 24 Okt sudah lewat pada 25 Okt 2026: peringatan berikutnya 24 Okt 2027.
    expect(out).toContain('DTSTART;VALUE=DATE:20271024');
    expect(out).toContain('DTSTART;VALUE=DATE:20270307');
    expect(unfold(out)).toContain('SUMMARY:Ulang tahun: Adi (37)');
  });

  it('prioritas haulOverrideDate di atas deathDate, fallback deathDate saat override nihil', () => {
    expect(effectiveHaulDate('2020-05-10', '2020-05-01')).toBe('2020-05-01');
    expect(effectiveHaulDate('2020-05-10', null)).toBe('2020-05-10');
    expect(effectiveHaulDate('2020-05-10', undefined)).toBe('2020-05-10');
    expect(effectiveHaulDate('2020-05-10', '')).toBe('2020-05-10');
    expect(effectiveHaulDate(null, null)).toBeNull();
    expect(effectiveHaulDate('  ', '  ')).toBeNull();
    const out = buildIcsFeed([entry({ kind: 'haul', refId: 'h-1', date: '2020-05-01', nextDate: '2026-11-15', yearsCompleted: 6 })], { labels: LABELS, now: NOW });
    expect(out).toContain('UID:stg-haul-h-1@stemmagraph');
  });
});
