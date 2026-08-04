/**
 * tenant-provisioner.ts
 *
 * Provisions a new approved tenant in the shared voice-project database.
 * Unlike Casper POS Desktop (which creates a separate physical PostgreSQL DB per tenant),
 * the voice project uses a shared database with row-level tenantId isolation.
 *
 * Called when:
 *   - Admin approves a PendingTenantRequest from the dashboard
 *   - Or during self-signup if instant approval is enabled
 */

import { prisma } from "@/lib/prisma";

export interface VoiceTenantProvisionOptions {
  name: string;
  telegramChatId?: string;
  phoneNumber?: string;
  businessType?: string;
  workingHours?: string;
  /** If provided, links to an existing PendingTenantRequest */
  pendingRequestId?: string;
}

export interface ProvisionResult {
  success: boolean;
  tenantId?: string;
  error?: string;
}

export class TenantProvisioner {
  /**
   * Creates an active Tenant record and seeds default knowledge items.
   * Runs inside a single transaction — atomic: either all succeeds or all rolls back.
   */
  public static async provision(
    options: VoiceTenantProvisionOptions
  ): Promise<ProvisionResult> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        // 1. Upsert Tenant record (idempotent on re-approval)
        const tenant = await (tx as any).tenant.upsert({
          where: options.telegramChatId
            ? { telegramChatId: options.telegramChatId }
            : (() => {
                if (!options.pendingRequestId) {
                  console.warn('[TenantProvisioner] Neither telegramChatId nor pendingRequestId provided — creating new tenant with no external identifiers.');
                }
                return { id: options.pendingRequestId ?? '__nonexistent__' };
              })(),
          update: {
            state: 'active',
            phoneNumber: options.phoneNumber ?? undefined,
            businessType: options.businessType ?? undefined,
            workingHours: options.workingHours ?? undefined,
          },
          create: {
            name: options.name,
            telegramChatId: options.telegramChatId ?? null,
            phoneNumber: options.phoneNumber ?? null,
            businessType: options.businessType ?? null,
            workingHours: options.workingHours ?? null,
            state: 'active',
          },
        });

        // 2. Seed default KnowledgeItems — idempotent on both SQLite and PostgreSQL
        // skipDuplicates is PostgreSQL-only; use per-item try/catch for cross-provider safety
        const seedItems = [
          {
            tenantId: tenant.id,
            question: 'ما هي أوقات العمل؟',
            answer: options.workingHours ?? 'يُرجى التواصل معنا لمعرفة أوقات العمل.',
            keywords: JSON.stringify(['أوقات', 'وقت', 'ساعات', 'دوام']),
          },
          {
            tenantId: tenant.id,
            question: 'كيف أتواصل معكم؟',
            answer: `يمكنك التواصل معنا عبر هذا الرقم: ${options.phoneNumber ?? 'سيُعلَن عنه قريبًا'}.`,
            keywords: JSON.stringify(['تواصل', 'هاتف', 'رقم', 'اتصال']),
          },
        ];

        for (const item of seedItems) {
          try {
            await (tx as any).knowledgeItem.create({ data: item });
          } catch (e: any) {
            // Swallow UNIQUE constraint on re-approval — already seeded
            if (!e?.message?.includes('Unique constraint') && !e?.message?.includes('UNIQUE constraint')) {
              throw e;
            }
          }
        }

        // 3. Mark PendingTenantRequest as approved (if linked)
        if (options.pendingRequestId) {
          await (tx as any).pendingTenantRequest.update({
            where: { id: options.pendingRequestId },
            data: {
              status: 'approved',
              decidedAt: new Date(),
            },
          });
        }

        return tenant;
      });

      console.log(`[TenantProvisioner] Tenant "${result.name}" provisioned → id: ${result.id}`);

      return {
        success: true,
        tenantId: result.id,
      };
    } catch (error: any) {
      console.error("[TenantProvisioner] Failed to provision tenant:", error);
      return {
        success: false,
        error: error?.message ?? "فشل إنشاء الشركة",
      };
    }
  }

  /**
   * Suspends a tenant — stops all voice/bot interactions without deleting data.
   */
  public static async suspend(tenantId: string): Promise<void> {
    await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { state: "suspended" },
    });
    console.log(`[TenantProvisioner] Tenant ${tenantId} suspended.`);
  }

  /**
   * Reactivates a suspended tenant.
   */
  public static async reactivate(tenantId: string): Promise<void> {
    await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { state: "active" },
    });
    console.log(`[TenantProvisioner] Tenant ${tenantId} reactivated.`);
  }

  /**
   * Soft-deletes a tenant — marks as deleted, data preserved for legal/audit.
   */
  public static async softDelete(tenantId: string): Promise<void> {
    await (prisma as any).tenant.update({
      where: { id: tenantId },
      data: { state: "deleted" },
    });
    console.log(`[TenantProvisioner] Tenant ${tenantId} soft-deleted.`);
  }
}
