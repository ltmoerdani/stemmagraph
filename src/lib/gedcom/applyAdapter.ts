// Adapter Prisma transaksional untuk applyImportPlan (v418 AC2).
//
// Modul wiring: menghubungkan antarmuka murni ImportApplyIO
// (src/lib/gedcom/applyImportPlan.ts) ke database lewat Prisma
// TransactionClient. Setiap instance terikat pada satu transaksi dan
// satu pohon: applyImportPlan menerima io ini sehingga seluruh penulisan
// member + relasi terjadi ATOMIK: error apapun yang lolos dari adapter
// membuat prisma.$transaction mengembalikan (rollback) semuanya.
//
// KEPUTUSAN PM kolom NOT NULL (prisma/schema.prisma model FamilyMember:
// name String NOT NULL, birthDate String NOT NULL):
//   - name undefined  → fallback '(tanpa nama)'
//   - birthDate undefined → string kosong ''
//
// KEPUTUSAN v466 kolom associations (prisma/schema.prisma model
// FamilyMember: associations Json?, NULL = tanpa asosiasi):
//   - associations undefined: kolom NULL (INDI tanpa ASSO sah).
//   - associations array: ditulis verbatim (ParsedAssociation hasil
//     capture import: xref null untuk @VOID@, role verbatim
//     case-sensitive, phrase bila ada). Pola cast dari
//     src/lib/adapters/prisma.adapter.ts (as never).

import type { Prisma } from '../../generated/prisma/client';
import type {
  CreateMemberInput,
  ImportApplyIO,
} from './applyImportPlan';

/**
 * Membangun sepasang callback tulis terikat transaksi (io) yang
 * dipakai applyImportPlan. tx dipakai untuk semua penulisan supaya
 * seluruh import berada dalam satu transaksi database.
 */
export function createPrismaApplyAdapter(
  tx: Prisma.TransactionClient,
  treeId: string,
): ImportApplyIO {
  return {
    treeId,
    async createMember(input: CreateMemberInput): Promise<string> {
      const created = await tx.familyMember.create({
        data: {
          treeId,
          name: input.name ?? '(tanpa nama)',
          gender: input.gender,
          sexGed: null,
          birthDate: input.birthDate ?? '',
          deathDate: input.deathDate ?? null,
          birthPlace: input.birthPlace ?? null,
          privacyStatus: input.privacyStatus ?? 'private',
          // v466 ASSO wiring: verbatim dari plan, undefined tetap NULL.
          associations: input.associations as never,
        },
      });
      return created.id;
    },
    async createRelation(
      treeId: string,
      memberId: string,
      relatedId: string,
      type: 'spouse' | 'parent',
    ): Promise<string | void> {
      const created = await tx.familyRelationship.create({
        data: { treeId, memberId, relatedId, type },
      });
      return created.id;
    },
  };
}
