import { prisma } from './prisma';

type AType = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'NOTE_ADDED' | 'PROPOSAL_SENT' | 'MILESTONE_COMPLETED';

export async function logActivity(args: {
  type: AType;
  description: string;
  entityType: string;
  entityId: string;
  userId?: string | null;
  leadId?: string | null;
  proposalId?: string | null;
  projectId?: string | null;
}) {
  if (!args.userId) return;
  try {
    await prisma.activity.create({
      data: {
        type: args.type,
        description: args.description,
        entityType: args.entityType,
        entityId: args.entityId,
        userId: args.userId,
        leadId: args.leadId || null,
        proposalId: args.proposalId || null,
        projectId: args.projectId || null,
      },
    });
  } catch (e) {
    console.error('logActivity error:', e);
  }
}
