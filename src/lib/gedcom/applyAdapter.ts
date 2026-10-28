import type { Prisma } from '../../generated/prisma/client';
import type {
  CreateMemberInput,
  ImportApplyIO,
} from './applyImportPlan';

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
          sexGed: input.sexGed ?? null,
          birthDate: input.birthDate ?? '',
          deathDate: input.deathDate ?? null,
          birthPlace: input.birthPlace ?? null,
          privacyStatus: input.privacyStatus ?? 'private',
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
