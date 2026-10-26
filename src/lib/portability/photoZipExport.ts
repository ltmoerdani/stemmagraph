// Portability Photo ZIP export for Stemmagraph (v403 Fase 2).
//
// Pure, deterministic, zero dependencies beyond fflate: no I/O, no
// clock reads, no store access. The export time is an explicit
// parameter so two calls with identical inputs produce byte-identical
// ZIP archives.
//
// Privacy (v403 AC1): exportPrivacyGate (src/lib/privacy/exportPrivacyGate)
// is the single source of truth for the living/consent decision. This
// module never re-implements the redact rule; it consumes
// evaluateMemberPrivacy exactly like the GEDCOM, GEDZIP and JSON
// export paths do, so the four formats can never disagree.
//
// Photo bytes are injected as a map keyed by member id; the module
// itself never touches the filesystem. A missing map entry becomes an
// honest 'file_not_found' skip in the manifest instead of a total
// failure, so one lost file cannot take down the whole export.

import { zipSync } from 'fflate';
import type { FamilyMemberRecord } from '../adapters/types';
import {
  buildExportPrivacyReport,
  evaluateMemberPrivacy,
} from '../privacy/exportPrivacyGate';

/** Schema version locked for the fase 2 contract. */
export const PHOTO_ZIP_EXPORT_SCHEMA_VERSION = 'stemmagraph-photo-export/1';

/** Privacy mode; mirrors the GEDCOM/JSON export modes. Default 'clean'. */
export type PhotoZipPrivacyMode = 'clean' | 'full';

/** Default aggregate ZIP bound: 200 MB of selected photo bytes. */
export const DEFAULT_MAX_AGGREGATE_BYTES = 200 * 1024 * 1024;

export interface PhotoZipExportInput {
  members: FamilyMemberRecord[];
  /** Raw photo bytes injected by the caller, keyed by member id. */
  photos: ReadonlyMap<string, Uint8Array>;
  /** Export timestamp; required for determinism (no clock reads). */
  exportedAt: Date;
  /** Privacy mode; see PhotoZipPrivacyMode. Defaults to 'clean'. */
  privacyMode?: PhotoZipPrivacyMode;
  /** Optional tree identity block for the manifest header. */
  tree?: { id?: string; name?: string };
  /** Aggregate guard override; verification injects small values. */
  maxAggregateBytes?: number;
}

/** One successfully packaged photo, recorded in the manifest. */
export interface PhotoManifestEntry {
  memberId: string;
  name: string;
  /** Deterministic ZIP entry name derived from the member id. */
  filename: string;
  sizeBytes: number;
}

/** One honestly reported omission, recorded in the manifest. */
export interface PhotoManifestSkippedEntry {
  memberId: string;
  name: string;
  reason: 'missing_photo' | 'file_not_found' | 'redacted';
}

export interface PhotoZipExportManifest {
  schemaVersion: string;
  exportedAt: string;
  tree?: { id?: string; name?: string };
  privacy: {
    mode: PhotoZipPrivacyMode;
    total: number;
    livingFull: number;
    livingRedacted: number;
    deceased: number;
  };
  exported: PhotoManifestEntry[];
  skipped: PhotoManifestSkippedEntry[];
}

export type PhotoZipExportResult =
  | { ok: true; zip: Uint8Array<ArrayBuffer>; manifest: PhotoZipExportManifest }
  | {
      ok: false;
      code: 'AGGREGATE_LIMIT';
      message: string;
      totalBytes: number;
      limitBytes: number;
    };

/** Reads the file extension carried by the internal photoUrl pointer. */
function photoExtension(photoUrl: string | null | undefined): string {
  if (!photoUrl) return 'jpg';
  if (photoUrl.includes('.png')) return 'png';
  if (photoUrl.includes('.webp')) return 'webp';
  return 'jpg';
}

/**
 * Builds the deterministic portability photo ZIP archive plus manifest.
 *
 * Determinism contract: members sorted by id, entry names derived from
 * the id alone, the only timestamp is exportedAt (ISO in the manifest,
 * mtime in the ZIP), and no source of randomness. The privacy report
 * counts come from the same gate the GEDCOM and JSON paths use.
 *
 * The aggregate guard trips BEFORE any archive is built: once the
 * running total of selected photo bytes crosses the bound, the caller
 * gets a structured AGGREGATE_LIMIT result instead of a partial ZIP.
 */
export function buildPhotoZipManifest(
  input: PhotoZipExportInput,
): PhotoZipExportResult {
  const mode: PhotoZipPrivacyMode = input.privacyMode ?? 'clean';
  const maxAggregateBytes =
    input.maxAggregateBytes ?? DEFAULT_MAX_AGGREGATE_BYTES;

  const sortedMembers = [...input.members].sort((a, b) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0,
  );

  const exported: PhotoManifestEntry[] = [];
  const skipped: PhotoManifestSkippedEntry[] = [];
  const zipFiles: Record<string, Uint8Array> = {};
  let totalBytes = 0;

  for (const member of sortedMembers) {
    if (mode === 'clean' && evaluateMemberPrivacy(member) === 'redact') {
      skipped.push({ memberId: member.id, name: member.name, reason: 'redacted' });
      continue;
    }
    if (!member.photoUrl) {
      skipped.push({ memberId: member.id, name: member.name, reason: 'missing_photo' });
      continue;
    }
    const photoBytes = input.photos.get(member.id);
    if (!photoBytes) {
      skipped.push({ memberId: member.id, name: member.name, reason: 'file_not_found' });
      continue;
    }
    totalBytes += photoBytes.length;
    if (totalBytes > maxAggregateBytes) {
      return {
        ok: false,
        code: 'AGGREGATE_LIMIT',
        message: `Total photo size ${totalBytes} bytes exceeds the aggregate ZIP limit of ${maxAggregateBytes} bytes`,
        totalBytes,
        limitBytes: maxAggregateBytes,
      };
    }
    const entryName = `photos/${member.id}.${photoExtension(member.photoUrl)}`;
    exported.push({
      memberId: member.id,
      name: member.name,
      filename: entryName,
      sizeBytes: photoBytes.length,
    });
    zipFiles[entryName] = photoBytes;
  }

  const manifest: PhotoZipExportManifest = {
    schemaVersion: PHOTO_ZIP_EXPORT_SCHEMA_VERSION,
    exportedAt: input.exportedAt.toISOString(),
    tree: input.tree,
    privacy: { mode, ...buildExportPrivacyReport(input.members) },
    exported,
    skipped,
  };
  const manifestBytes = new TextEncoder().encode(
    JSON.stringify(manifest, null, 2),
  );
  zipFiles['manifest.json'] = manifestBytes;

  const zip = zipSync(zipFiles, { mtime: input.exportedAt });
  return { ok: true, zip, manifest };
}
