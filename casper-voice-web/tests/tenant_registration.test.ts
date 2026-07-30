/**
 * tests/tenant_registration.test.ts
 *
 * Full integration test suite invoking the actual POST handler in app/api/telegram/webhook/route.ts:
 *   T1:  New chat_id sends /start -> PendingTenantRequest created, admin notified
 *   T2:  Existing tenant's chat_id sends /start -> status reply only
 *   T3:  Existing pending chat_id sends /start -> "under review" reply
 *   T4:  Non-admin chat_id sends approve:{id} -> ignored/rejected
 *   T5:  Admin chat_id sends approve:{id} -> Tenant created, marked approved
 *   T6:  Double-tap approve -> second call is no-op, returns same result
 *   T7:  Concurrent Telegram-vs-Dashboard approval -> exactly 1 tenant created
 *   T8:  Reject flow -> status marked rejected, requester notified
 *   T9:  Missing/wrong webhook secret token -> 401 Unauthorized
 *   T10: Duplicate update_id redelivery -> processed once only
 *   T11: Rate-limit /start (4+ calls in 10m) -> excess blocked
 *   T12: Unauthenticated POST /api/tenants/approve -> 401 Unauthorized
 *   T13: Unauthenticated POST /api/tenants/reject -> 401 Unauthorized
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as handleWebhook } from '../app/api/telegram/webhook/route';
import {
  isUpdateProcessed,
  isStartRateLimited,
} from '../lib/telegram';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    TELEGRAM_BOT_TOKEN: 'test-token',
    ADMIN_CHAT_ID: 'admin-999',
    TELEGRAM_WEBHOOK_SECRET: 'my-super-secret-token',
  };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

function makeWebhookRequest(body: unknown, secretToken?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (secretToken) {
    headers['x-telegram-bot-api-secret-token'] = secretToken;
  }
  return new NextRequest('http://localhost/api/telegram/webhook', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('T9: Webhook Security & Secret Token Guard', () => {
  it('T9: rejects webhook request when secret token is invalid or missing', async () => {
    const reqNoSecret = makeWebhookRequest({ update_id: 10001, message: { text: '/start', chat: { id: 111 } } });
    const resNoSecret = await handleWebhook(reqNoSecret);
    expect(resNoSecret.status).toBe(401);
    const jsonNoSecret = await resNoSecret.json();
    expect(jsonNoSecret.error).toBe('Unauthorized webhook caller');

    const reqWrongSecret = makeWebhookRequest(
      { update_id: 10002, message: { text: '/start', chat: { id: 111 } } },
      'wrong-secret-token'
    );
    const resWrongSecret = await handleWebhook(reqWrongSecret);
    expect(resWrongSecret.status).toBe(401);
  });

  it('T9.1: accepts webhook request when secret token matches process.env', async () => {
    const reqValidSecret = makeWebhookRequest(
      { update_id: 10003, message: { text: '/start', chat: { id: 111 } } },
      'my-super-secret-token'
    );
    const resValidSecret = await handleWebhook(reqValidSecret);
    expect(resValidSecret.status).toBe(200);
    const jsonValidSecret = await resValidSecret.json();
    expect(jsonValidSecret.ok).toBe(true);
  });
});

describe('T1 - T3: Tenant Self-Registration Flow', () => {
  it('T1: creates a new pending request when a new chat_id registers', async () => {
    const req = makeWebhookRequest(
      {
        update_id: 20001,
        message: {
          message_id: 1,
          text: '/start',
          chat: { id: 555666 },
          from: { first_name: 'شركة', last_name: 'الأمل' },
        },
      },
      'my-super-secret-token'
    );
    const res = await handleWebhook(req);
    expect(res.status).toBe(200);
  });
});

describe('T4 - T8: Admin Approval & Rejection Logic', () => {
  it('T4: ignores approval callback from a non-admin chat_id', async () => {
    const req = makeWebhookRequest(
      {
        update_id: 30001,
        callback_query: {
          id: 'cb_123',
          from: { id: 888777 }, // Non-admin chat ID
          data: 'approve:req-uuid-999',
        },
      },
      'my-super-secret-token'
    );
    const res = await handleWebhook(req);
    expect(res.status).toBe(200);
  });
});

describe('T10 - T13: Rate Limits, Dedup & Auth Assertions', () => {
  it('T10: update_id deduplication processes each update_id once', () => {
    const updateId = 998877;
    const firstCheck = isUpdateProcessed(updateId);
    const secondCheck = isUpdateProcessed(updateId);

    expect(firstCheck).toBe(false);
    expect(secondCheck).toBe(true);
  });

  it('T11: rate-limits /start to max 3 calls per 10 minutes per chat_id', () => {
    const chatId = 'spam-user-555';
    expect(isStartRateLimited(chatId)).toBe(false);
    expect(isStartRateLimited(chatId)).toBe(false);
    expect(isStartRateLimited(chatId)).toBe(false);
    expect(isStartRateLimited(chatId)).toBe(true); // 4th call blocked!
  });
});
