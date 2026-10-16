/**
 * Tipe payload anggota ter-redaksi (fase ii relationship privacy).
 * Modul PURE: union type dan type guard murni, NOL efek samping.
 *
 * Kontrak v261-ii: NOL sentuh relationship-privacy.ts, member-redaction.ts,
 * viewer-relation.ts, exportPrivacyGate.ts, schema, lockfile, server/index.ts.
 *
 * Latar: read path server (v261-i) bisa mengembalikan NameOnlyMember (6 field)
 * untuk anggota yang visibilitasnya name-only, sehingga konsumsi client harus
 * aman terhadap payload subset: birthDate absen, gender dan generation
 * null-able.
 */

import type { FamilyMemberRecord } from '../lib/adapters';
import type { NameOnlyMember } from '../lib/privacy/member-redaction';

/**
 * Payload anggota dari read path: bentuk penuh (FamilyMemberRecord) atau
 * bentuk redaksi name-only (NameOnlyMember, 6 field).
 */
export type RedactedMemberPayload = FamilyMemberRecord | NameOnlyMember;

/**
 * Type guard murni: membedakan NameOnlyMember dari FamilyMemberRecord.
 * Deteksi via absence kunci birthDate (NameOnlyMember tidak punya) PLUS
 * nullable gender/generation, sesuai kontrak v261-ii.
 */
export function isNameOnlyMember(payload: RedactedMemberPayload): payload is NameOnlyMember {
  if (payload === null || typeof payload !== 'object') return false;
  if ('birthDate' in payload) return false;
  const candidate = payload as Partial<NameOnlyMember>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.treeId === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.isAlive === 'boolean' &&
    ('generation' in candidate) &&
    ('gender' in candidate)
 );
}
