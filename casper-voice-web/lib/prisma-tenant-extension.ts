import { Prisma } from '@prisma/client';
import type { AsyncLocalStorage } from 'async_hooks';

export type TenantContext = {
  tenantId: string;
};

// AsyncLocalStorage — safe instantiation for environments where async_hooks is mocked/unavailable
let asyncHooks: any = {};
try {
  asyncHooks = require('async_hooks');
} catch (e) {}

export const tenantStorage = (asyncHooks.AsyncLocalStorage
  ? new asyncHooks.AsyncLocalStorage()
  : null) as unknown as AsyncLocalStorage<TenantContext>;

export async function getTenantId(): Promise<string | undefined> {
  if (!tenantStorage) return undefined;
  const stored = tenantStorage.getStore()?.tenantId;
  if (stored) return stored;

  try {
    // Fallback 1: x-tenant-id header (internal service path — Telegram bot, voice service)
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { headers, cookies } = require('next/headers');

    // Check x-tenant-id header first (internal service fast-path with secret verification)
    try {
      const reqHeaders = await headers();
      const raw = reqHeaders.get('x-tenant-id');
      const reqSecret = reqHeaders.get('x-internal-secret');
      const expectedSecret = process.env.INTERNAL_SERVICE_SECRET;

      if (raw && reqSecret && expectedSecret) {
        const reqBuffer = Buffer.from(reqSecret);
        const expectedBuffer = Buffer.from(expectedSecret);
        const crypto = require('crypto');
        if (
          reqBuffer.length === expectedBuffer.length &&
          crypto.timingSafeEqual(reqBuffer, expectedBuffer)
        ) {
          try { return decodeURIComponent(raw); } catch { return raw; }
        }
      }
    } catch { /* not in headers context */ }

    // Fallback 2: tenant_session cookie (web dashboard routes)
    try {
      const cookieStore = await cookies();
      const tenantCookie = cookieStore.get('tenant_session')?.value;
      if (tenantCookie) {
        // Use session.ts (no Prisma imports) to avoid circular dep: prisma → extension → auth → prisma
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { verifyTenantSession } = require('./session');
        return verifyTenantSession(tenantCookie) || undefined;
      }
    } catch { /* not in cookie context */ }

    return undefined;
  } catch {
    // Outside Next.js request context (background jobs, tests)
    return undefined;
  }
}

export function runWithTenant<T>(tenantId: string, callback: () => Promise<T>): Promise<T> {
  if (!tenantStorage) return callback();
  return tenantStorage.run({ tenantId }, callback);
}

// All models in schema.prisma that have a tenantId field
const TENANT_AWARE_MODELS = [
  'AuditLog',
  'Appointment',
  'ChatMessage',
  'ConversationState',
  'Customer',
  'CustomerLedgerEntry',
  'Expense',
  'InteractionDiagnostics',
  'JournalEntry',
  'KnowledgeItem',
  'Purchase',
  'Sale',
  'Supplier',
  'SupplierPayment',
];

export const prismaTenantExtension =
  typeof window === 'undefined'
    ? Prisma.defineExtension((client) => {
        return client.$extends({
          query: {
            $allModels: {
              async $allOperations({ model, operation, args, query }) {
                const tenantId = await getTenantId();

                // No tenant context or SYSTEM (Super Admin bypass) — skip filters
                if (!tenantId || tenantId === 'SYSTEM') {
                  return query(args);
                }

                if (TENANT_AWARE_MODELS.includes(model)) {
                  // 1. Inject tenantId filter on read/batch operations (these accept any fields in where)
                  if (
                    [
                      'findFirst',
                      'findFirstOrThrow',
                      'findMany',
                      'count',
                      'aggregate',
                      'groupBy',
                      'updateMany',
                      'deleteMany',
                    ].includes(operation)
                  ) {
                    (args as any).where = (args as any).where || {};
                    (args as any).where.tenantId = tenantId;
                  }

                  // 2. findUnique / findUniqueOrThrow — downgrade to findFirst to allow extra tenantId filter
                  if (operation === 'findUnique' || operation === 'findUniqueOrThrow') {
                    const newOperation =
                      operation === 'findUnique' ? 'findFirst' : 'findFirstOrThrow';

                    let finalWhere = { ...(args as any).where };
                    // Flatten composite keys that findFirst doesn't accept
                    for (const key of Object.keys(finalWhere)) {
                      if (
                        typeof finalWhere[key] === 'object' &&
                        finalWhere[key] !== null &&
                        key.includes('_')
                      ) {
                        const nestedObj = finalWhere[key];
                        const parts = key.split('_');
                        const isComposite = parts.every((part) => part in nestedObj);
                        if (isComposite) {
                          for (const part of parts) {
                            finalWhere[part] = nestedObj[part];
                          }
                          delete finalWhere[key];
                        }
                      }
                    }

                    const camelModel = model.charAt(0).toLowerCase() + model.slice(1);
                    // @ts-ignore
                    return (client as any)[camelModel][newOperation]({
                      ...args,
                      where: { ...finalWhere, tenantId },
                    });
                  }

                  // 3. update / delete — Prisma strict unique checking prevents injecting tenantId.
                  // We must verify ownership via a separate findFirst query before proceeding.
                  if (operation === 'update' || operation === 'delete') {
                    const camelModel = model.charAt(0).toLowerCase() + model.slice(1);
                    const existing = await (client as any)[camelModel].findFirst({
                      where: { ...(args as any).where, tenantId },
                      select: { id: true }, // lightweight fetch
                    });
                    
                    if (!existing) {
                      throw new Error(`Record not found or unauthorized for ${model} ${operation}`);
                    }
                    
                    // Ownership verified. Proceed with original unique where clause.
                    return query(args);
                  }

                  // Inject tenantId on create
                  if (operation === 'create') {
                    (args as any).data = (args as any).data || {};
                    (args as any).data.tenantId = tenantId;
                  }

                  if (operation === 'createMany') {
                    if (Array.isArray((args as any).data)) {
                      (args as any).data = (args as any).data.map((item: any) => ({
                        ...item,
                        tenantId,
                      }));
                    } else {
                      (args as any).data = (args as any).data || {};
                      (args as any).data.tenantId = tenantId;
                    }
                  }

                  if (operation === 'upsert') {
                    // NOTE: Do NOT inject tenantId into `.where` —
                    // Prisma upsert.where only accepts unique constraint fields.
                    // tenantId alone is not unique; injecting it causes a runtime crash.
                    (args as any).create = (args as any).create || {};
                    (args as any).create.tenantId = tenantId;
                    (args as any).update = (args as any).update || {};
                    // Do not overwrite tenantId in update — it never changes
                  }
                }

                return query(args);
              },
            },
          },
        });
      })
    : (null as any);
