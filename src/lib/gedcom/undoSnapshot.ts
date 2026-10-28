import { randomBytes } from 'node:crypto';

export function buildSnapshotPath(dir: string, treeId: string, nowMs: number): string {
  const randomHex = randomBytes(2).toString('hex');
  return `${dir}/${treeId}-${nowMs}-${randomHex}.db`;
}

export function parseDatabaseUrl(databaseUrl: string): string {
  return databaseUrl.startsWith('file:') ? databaseUrl.slice('file:'.length) : databaseUrl;
}

export function undoExpiredError(): { code: 'UNDO_EXPIRED' } {
  return { code: 'UNDO_EXPIRED' };
}

export function undoConsumedError(): { code: 'UNDO_GONE' } {
  return { code: 'UNDO_GONE' };
}
