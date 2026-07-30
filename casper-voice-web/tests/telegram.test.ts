/**
 * casper-voice-web/tests/telegram.test.ts
 *
 * Unit test suite for sendTelegramAlert:
 *   T1: Markdown parse failure -> fallback retry without markdown
 *   T2: Failed send after retries is logged
 *   T3: Missing TELEGRAM_BOT_TOKEN throws explicit error
 *   T4: Chat ID allowlist enforcement
 *   T5: Idempotency guard window
 *   T6: Transient 5xx / 429 triggers backoff retry
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { sendTelegramAlert } from '../lib/telegram';

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  process.env = {
    ...ORIGINAL_ENV,
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_ALLOWED_CHAT_IDS: '12345,67890',
  };
  vi.restoreAllMocks();
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
});

describe('T1 — G1: Markdown fallback retry', () => {
  it('retries without markdown when Telegram returns 400 on markdown parse error', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendTelegramAlert({
      chatId: '12345',
      text: 'Customer note with *bad markdown [chars',
      idempotencyKey: 'test-t1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(true);
    expect(result.usedMarkdownFallback).toBe(true);
  });
});

describe('T2 — G2: Failure is logged', () => {
  it('logs an error when all retries fail on non-retryable status', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await sendTelegramAlert({
      chatId: '12345',
      text: 'hello',
      idempotencyKey: 'test-t2',
    });

    expect(result.success).toBe(false);
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});

describe('T3 — G3: Missing bot token throws error', () => {
  it('throws when TELEGRAM_BOT_TOKEN is not set', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;

    await expect(
      sendTelegramAlert({ chatId: '12345', text: 'hi', idempotencyKey: 'test-t3' })
    ).rejects.toThrow(/TELEGRAM_BOT_TOKEN/);
  });
});

describe('T4 — Chat ID allowlist enforcement', () => {
  it('rejects a chat_id not present in TELEGRAM_ALLOWED_CHAT_IDS', async () => {
    await expect(
      sendTelegramAlert({ chatId: '99999', text: 'hi', idempotencyKey: 'test-t4' })
    ).rejects.toThrow(/not in TELEGRAM_ALLOWED_CHAT_IDS/);
  });
});

describe('T5 — Idempotency guard on alert sends', () => {
  it('does not re-send when same idempotency key is used within window', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const first = await sendTelegramAlert({
      chatId: '12345',
      text: 'appointment booked',
      idempotencyKey: 'appointment:abc123',
    });
    const second = await sendTelegramAlert({
      chatId: '12345',
      text: 'appointment booked',
      idempotencyKey: 'appointment:abc123',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toEqual(first);
  });
});

describe('T6 — Retry with backoff on transient errors', () => {
  it('retries on 429/5xx and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 429 } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await sendTelegramAlert({
      chatId: '67890',
      text: 'debt payment received',
      idempotencyKey: 'test-t6',
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.success).toBe(true);
  });
});
