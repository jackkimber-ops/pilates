import { prisma } from "@/lib/prisma";

type AuditInput = {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  details?: unknown;
};

export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action,
        details: input.details ?? {},
      },
    });
  } catch (error) {
    console.error("Failed to write audit log", error);
  }
}
