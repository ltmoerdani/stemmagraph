import { describe, expect, it } from 'vitest';
import { buildUndoPayload, isExpired, parseRegistryFile } from './undoRegistry';

describe('buildUndoPayload', () => {
  it('builds payload with default TTL of 24 hours', () => {
    const appliedAtMs = Date.UTC(2026, 0, 15, 12, 0, 0);
    const entry = buildUndoPayload('tok-1', '/tmp/snap.json', appliedAtMs);
    expect(entry.token).toBe('tok-1');
    expect(entry.snapshotPath).toBe('/tmp/snap.json');
    expect(entry.appliedAt).toBe('2026-01-15T12:00:00.000Z');
    expect(entry.expiresAt).toBe('2026-01-16T12:00:00.000Z');
    expect(entry.summary).toBeNull();
  });
});

describe('parseRegistryFile', () => {
  it('parses a valid registry JSON', () => {
    const entry = buildUndoPayload('tok-2', '/tmp/snap2.json', Date.UTC(2026, 0, 15, 12, 0, 0));
    const parsed = parseRegistryFile(JSON.stringify(entry));
    expect(parsed).not.toBeNull();
    expect(parsed?.token).toBe('tok-2');
    expect(parsed?.snapshotPath).toBe('/tmp/snap2.json');
    expect(parsed?.appliedAt).toBe('2026-01-15T12:00:00.000Z');
    expect(parsed?.expiresAt).toBe('2026-01-16T12:00:00.000Z');
  });

  it('returns null for broken JSON', () => {
    expect(parseRegistryFile('{not valid json')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseRegistryFile(JSON.stringify({ token: 'tok-3' }))).toBeNull();
    expect(
      parseRegistryFile(
        JSON.stringify({ token: 'tok-3', snapshotPath: '/x', appliedAt: '2026-01-01T00:00:00.000Z' })
      )
    ).toBeNull();
  });
});

describe('isExpired', () => {
  it('returns true when past expiresAt and false when not', () => {
    const appliedAtMs = Date.UTC(2026, 0, 15, 12, 0, 0);
    const entry = buildUndoPayload('tok-4', '/tmp/snap4.json', appliedAtMs);
    expect(isExpired(entry, appliedAtMs + 24 * 3600000 + 1)).toBe(true);
    expect(isExpired(entry, appliedAtMs + 3600000)).toBe(false);
  });
});
