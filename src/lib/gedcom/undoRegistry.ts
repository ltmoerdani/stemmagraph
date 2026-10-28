export interface UndoRegistryEntry {
  token: string;
  snapshotPath: string;
  appliedAt: string;
  expiresAt: string;
  summary: unknown;
}

export function buildUndoPayload(
  token: string,
  snapshotPath: string,
  appliedAtMs: number,
  ttlHours = 24,
  summary: unknown = null
): UndoRegistryEntry {
  const appliedAt = new Date(appliedAtMs).toISOString();
  const expiresAt = new Date(appliedAtMs + ttlHours * 3600000).toISOString();
  return { token, snapshotPath, appliedAt, expiresAt, summary };
}

export function parseRegistryFile(json: string): UndoRegistryEntry | null {
  try {
    const parsed: unknown = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.token !== 'string') return null;
    if (typeof obj.snapshotPath !== 'string') return null;
    if (typeof obj.appliedAt !== 'string') return null;
    if (typeof obj.expiresAt !== 'string') return null;
    return {
      token: obj.token,
      snapshotPath: obj.snapshotPath,
      appliedAt: obj.appliedAt,
      expiresAt: obj.expiresAt,
      summary: obj.summary,
    };
  } catch {
    return null;
  }
}

export function isExpired(entry: UndoRegistryEntry, nowMs: number): boolean {
  return Date.parse(entry.expiresAt) <= nowMs;
}
