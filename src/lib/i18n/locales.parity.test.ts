// Locale parity tests for common.json (P2-7 U5).
//
// The digest namespace shipped in both locales at once; these tests
// keep that promise mechanical from now on: every key must exist on
// both sides, interpolation placeholders must match per key, and the
// digest namespace must carry its full key set with non-empty values.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const loadLocale = (locale: string): Record<string, Json> =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL(`./locales/${locale}/common.json`, import.meta.url)), 'utf8'),
  );

/** Flattens nested objects into dot-separated leaf paths with string values. */
function flatten(value: { [key: string]: Json }, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, entry] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (entry !== null && typeof entry === 'object' && !Array.isArray(entry)) {
      for (const [nestedPath, nestedValue] of flatten(entry as { [key: string]: Json }, path)) {
        out.set(nestedPath, nestedValue);
      }
    } else {
      out.set(path, String(entry));
    }
  }
  return out;
}

/** Extracts the {{placeholder}} names used by one translated string. */
const placeholders = (value: string | undefined): string[] =>
  [...(value ?? '').matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]).sort();

const en = flatten(loadLocale('en'));
const id = flatten(loadLocale('id'));

const DIGEST_KEYS = [
  'title',
  'subtitle',
  'optInLabel',
  'optInHint',
  'saving',
  'saveFailed',
  'loading',
  'loadFailed',
  'retry',
  'unavailable',
  'previewTitle',
  'windowLabel',
  'previewEmpty',
];

const CHANGE_REVIEW_KEYS = [
  'open',
  'title',
  'close',
  'refresh',
  'unavailable',
  'loading',
  'loadFailed',
  'ownerTitle',
  'editorTitle',
  'emptyOwner',
  'emptyEditor',
  'targetType.member',
  'targetType.relationship',
  'state.pending',
  'state.rejected',
  'state.distinct',
  'reasonLabel',
  'beforeLabel',
  'afterLabel',
  'proposedAt',
  'decidedAt',
  'decisionNoteLabel',
  'actionAccept',
  'actionReject',
  'actionDistinct',
  'cancelReject',
  'rejectNotePlaceholder',
  'rejectNoteRequired',
  'distinctNotePlaceholder',
  'distinctHint',
  'actionFailed',
  'acceptDone',
  'proposeBanner',
  'reasonNoteLabel',
  'reasonNotePlaceholder',
  'reasonNoteRequired',
  'submitPropose',
  'proposeSent',
  'proposeFailed',
];

describe('flatten helper', () => {
  it('joins nested keys with dots and stringifies leaves', () => {
    const flat = flatten({ a: 'x', b: { c: 'y', d: { e: 'z' } } });
    expect([...flat.entries()]).toEqual([
      ['a', 'x'],
      ['b.c', 'y'],
      ['b.d.e', 'z'],
    ]);
  });
});

describe('common.json key parity (en vs id)', () => {
  it('every en key exists in id', () => {
    const missing = [...en.keys()].filter((key) => !id.has(key));
    expect(missing).toEqual([]);
  });

  it('every id key exists in en', () => {
    const missing = [...id.keys()].filter((key) => !en.has(key));
    expect(missing).toEqual([]);
  });

  it('interpolation placeholders match between locales on every shared key', () => {
    const mismatched = [...en.keys()].filter(
      (key) => id.has(key) && JSON.stringify(placeholders(en.get(key))) !== JSON.stringify(placeholders(id.get(key))),
    );
    expect(mismatched).toEqual([]);
  });
});

describe('digest namespace (P2-7 U5)', () => {
  it('ships the full key set in both locales', () => {
    for (const locale of [en, id]) {
      const keys = [...locale.keys()].filter((key) => key.startsWith('digest.')).map((key) => key.slice('digest.'.length)).sort();
      expect(keys).toEqual([...DIGEST_KEYS].sort());
    }
  });

  it('carries non-empty values in both locales', () => {
    for (const key of DIGEST_KEYS) {
      expect(en.get(`digest.${key}`)).not.toBe('');
      expect(id.get(`digest.${key}`)).not.toBe('');
    }
  });

  it('labels the preview window with the same start and end placeholders in both locales', () => {
    expect(placeholders(en.get("digest.windowLabel"))).toEqual(['end', 'start']);
    expect(placeholders(id.get("digest.windowLabel"))).toEqual(['end', 'start']);
  });
});

describe('changeReview namespace (P2-5 U5)', () => {
  it('ships the full key set in both locales', () => {
    for (const locale of [en, id]) {
      const keys = [...locale.keys()]
        .filter((key) => key.startsWith('changeReview.'))
        .map((key) => key.slice('changeReview.'.length))
        .sort();
      expect(keys).toEqual([...CHANGE_REVIEW_KEYS].sort());
    }
  });

  it('carries non-empty values in both locales', () => {
    for (const key of CHANGE_REVIEW_KEYS) {
      expect(en.get(`changeReview.${key}`)).not.toBe('');
      expect(id.get(`changeReview.${key}`)).not.toBe('');
    }
  });

  it('formats titles and timestamps with the same placeholders in both locales', () => {
    expect(placeholders(en.get('changeReview.title'))).toEqual(['treeName']);
    expect(placeholders(id.get('changeReview.title'))).toEqual(['treeName']);
    expect(placeholders(en.get('changeReview.proposedAt'))).toEqual(['date']);
    expect(placeholders(id.get('changeReview.proposedAt'))).toEqual(['date']);
    expect(placeholders(en.get('changeReview.decidedAt'))).toEqual(['date']);
    expect(placeholders(id.get('changeReview.decidedAt'))).toEqual(['date']);
  });
});
