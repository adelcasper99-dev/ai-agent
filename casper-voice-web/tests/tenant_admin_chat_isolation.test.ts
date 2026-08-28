import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { getAdminChatId, getSuperAdminChatId, approveDirectTenant } from '../lib/telegram';

describe('Per-Tenant ADMIN_CHAT_ID Isolation & Escalation Suite', () => {
  const ts = Date.now();
  const tenantAId = `test_tenant_a_${ts}`;
  const tenantBId = `test_tenant_b_${ts}`;
  const tenantCId = `test_tenant_c_${ts}`;
  const tenantDId = `test_tenant_d_${ts}`;

  const chatAUser = `chat_a_user_${ts}`;
  const chatBUser = `chat_b_user_${ts}`;
  const chatCFallback = `chat_c_fallback_${ts}`;
  const chatDOnboard = `chat_d_onboard_${ts}`;

  const adminChatA = `admin_chat_a_${ts}`;
  const adminChatB = `admin_chat_b_${ts}`;

  beforeAll(async () => {
    // 1. Create Tenant A with explicit adminChatId
    await (prisma as any).tenant.create({
      data: {
        id: tenantAId,
        name: 'شركة المصرية للتجارة',
        telegramChatId: chatAUser,
        adminChatId: adminChatA,
        state: 'active',
      },
    });

    // 2. Create Tenant B with different explicit adminChatId
    await (prisma as any).tenant.create({
      data: {
        id: tenantBId,
        name: 'شركة النور للألوميتال',
        telegramChatId: chatBUser,
        adminChatId: adminChatB,
        state: 'active',
      },
    });

    // 3. Create Tenant C with null adminChatId but valid telegramChatId (fallback case)
    await (prisma as any).tenant.create({
      data: {
        id: tenantCId,
        name: 'مؤسسة الأمل لمواد البناء',
        telegramChatId: chatCFallback,
        adminChatId: null,
        state: 'active',
      },
    });

    // 4. Create Tenant D in pending_approval state for onboarding approval test
    await (prisma as any).tenant.create({
      data: {
        id: tenantDId,
        name: 'مؤسسة الهدى للتوريدات',
        telegramChatId: chatDOnboard,
        adminChatId: null,
        state: 'pending_approval',
      },
    });
  });

  afterAll(async () => {
    const tenantIds = [tenantAId, tenantBId, tenantCId, tenantDId];
    await (prisma as any).customerLedgerEntry.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).sale.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).purchase.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).expense.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).supplierPayment.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).supplier.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).customer.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).product.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).quotation.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).customerMeasurement.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).reminder.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).appointment.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).chatMessage.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).conversationState.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).merchantMemoryFact.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).merchantMemory.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).knowledgeItem.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).rejectedToolCall.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).tokenUsage.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).auditLog.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).interactionDiagnostics.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).csatRating.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).adminLinkAudit.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).adminLinkToken.deleteMany({ where: { tenantId: { in: tenantIds } } }).catch(() => {});
    await (prisma as any).tenant.deleteMany({ where: { id: { in: tenantIds } } }).catch(() => {});
  });

  it('1. Strict Isolation: getAdminChatId returns exact tenant admin for distinct tenants', async () => {
    const adminA = await getAdminChatId(tenantAId);
    const adminB = await getAdminChatId(tenantBId);

    expect(adminA).toBe(adminChatA);
    expect(adminB).toBe(adminChatB);
    expect(adminA).not.toBe(adminB);
  });

  it('2. Automatic Fallback: getAdminChatId falls back to telegramChatId if adminChatId is null', async () => {
    const adminC = await getAdminChatId(tenantCId);
    expect(adminC).toBe(chatCFallback);
  });

  it('3. Super Admin Fallback: Non-existent tenant or empty argument returns super admin chat ID', async () => {
    const superAdmin = await getSuperAdminChatId();
    const fallbackForUnknown = await getAdminChatId('non_existent_tenant_999');
    const fallbackForEmpty = await getAdminChatId();

    expect(fallbackForUnknown).toBe(superAdmin);
    expect(fallbackForEmpty).toBe(superAdmin);
  });

  it('4. Onboarding Auto-Wiring: approveDirectTenant populates adminChatId from telegramChatId', async () => {
    const approvalResult = await approveDirectTenant(tenantDId, 'system_test');
    expect(approvalResult.alreadyDecided).toBe(false);

    const updatedTenant = await (prisma as any).tenant.findUnique({ where: { id: tenantDId } });
    expect(updatedTenant?.state).toBe('active');
    expect(updatedTenant?.adminChatId).toBe(chatDOnboard);

    const adminD = await getAdminChatId(tenantDId);
    expect(adminD).toBe(chatDOnboard);
  });
});
