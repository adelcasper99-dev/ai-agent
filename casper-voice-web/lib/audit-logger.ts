/**
 * System Audit Trail Logger
 * Records critical actions (Tenant Signup, Login, Prompt Edit, Impersonation, Webhook Approval) for security & tracking.
 */
import { prismaSystem as prisma } from "./prisma";

export interface LogAuditParams {
  tenantId?: string | null;
  userId?: string | null;
  impersonatorId?: string | null;
  action: string;
  entity: string;
  details?: Record<string, any> | string | null;
}

export async function createAuditLog(params: LogAuditParams): Promise<void> {
  try {
    const detailsString =
      typeof params.details === "object" && params.details !== null
        ? JSON.stringify(params.details)
        : params.details || null;

    await (prisma as any).auditLog.create({
      data: {
        tenantId: params.tenantId || null,
        userId: params.userId || null,
        impersonatorId: params.impersonatorId || null,
        action: params.action,
        entity: params.entity,
        details: detailsString,
      },
    });
  } catch (error) {
    console.error("[Audit Logger Error]: Failed to create audit log entry", error);
  }
}
