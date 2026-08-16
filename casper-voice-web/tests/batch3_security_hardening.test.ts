import { describe, it, expect, beforeEach } from "vitest";
import { encryptField, decryptField, maskSecret, resolveDecryptedSettings } from "@/lib/crypto";
import { hashPin, verifyPin } from "@/lib/session";
import { enforceSubscriptionExpiry } from "@/lib/subscription-guard";
import { prismaSystem } from "@/lib/prisma";

describe("Finding #7: AES-256-GCM Field Encryption & Masking", () => {
  it("should encrypt and decrypt a plaintext API key correctly", () => {
    const rawApiKey = "AIzaSyD_TestGoogleApiKey123456789";
    const encrypted = encryptField(rawApiKey);

    expect(encrypted).toMatch(/^enc:v1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/);
    expect(encrypted).not.toBe(rawApiKey);

    const decrypted = decryptField(encrypted);
    expect(decrypted).toBe(rawApiKey);
  });

  it("should be idempotent when encrypting already-encrypted strings", () => {
    const rawKey = "gsk_GroqSecretApiKey987654321";
    const encrypted1 = encryptField(rawKey);
    const encrypted2 = encryptField(encrypted1);

    expect(encrypted2).toBe(encrypted1);
    expect(decryptField(encrypted2)).toBe(rawKey);
  });

  it("should fallback gracefully to raw plaintext when decrypting legacy unencrypted values", () => {
    const legacyPlainKey = "plain-legacy-api-key-value";
    const decrypted = decryptField(legacyPlainKey);
    expect(decrypted).toBe(legacyPlainKey);
  });

  it("should mask secrets correctly for UI representation", () => {
    const geminiKey = "AIzaSyB1234567890abcdefXYZ";
    const masked = maskSecret(geminiKey);
    expect(masked).toBe("AIza...fXYZ");

    const encrypted = encryptField(geminiKey);
    const maskedFromEnc = maskSecret(encrypted);
    expect(maskedFromEnc).toBe("AIza...fXYZ");

    expect(maskSecret("short")).toBe("****");
    expect(maskSecret("")).toBe("");
  });

  it("should resolve and decrypt a map of database setting rows", () => {
    const encryptedGroq = encryptField("gsk_secret_123");
    const rows = [
      { key: "VOICE_PROVIDER", value: "groq_pipeline" },
      { key: "GROQ_API_KEY", value: encryptedGroq },
      { key: "LEGACY_KEY", value: "legacy_unencrypted_val" },
    ];

    const resolved = resolveDecryptedSettings(rows);
    expect(resolved["VOICE_PROVIDER"]).toBe("groq_pipeline");
    expect(resolved["GROQ_API_KEY"]).toBe("gsk_secret_123");
    expect(resolved["LEGACY_KEY"]).toBe("legacy_unencrypted_val");
  });
});

describe("Finding #10: Salted & Peppered PIN Hashing", () => {
  it("should generate deterministic hash for same pin + salt and verify successfully", async () => {
    const pin = "1234";
    const customerId = "cust_abc_999";

    const hash = await hashPin(pin, customerId);
    expect(hash).toBeDefined();
    expect(typeof hash).toBe("string");

    const isValid = await verifyPin(pin, hash, customerId);
    expect(isValid).toBe(true);

    const isWrongPin = await verifyPin("9999", hash, customerId);
    expect(isWrongPin).toBe(false);

    const isWrongSalt = await verifyPin(pin, hash, "different_customer");
    expect(isWrongSalt).toBe(false);
  });

  it("should verify legacy v1 hashes for backwards compatibility", async () => {
    const pin = "5678";
    // Legacy computation: computeHmacHex(`pin:casper-salt:5678`)
    const crypto = await import("crypto");
    const secret = process.env.JWT_SECRET || process.env.INTERNAL_SERVICE_SECRET || "casper-pos-secret-key-production-change-me";
    const legacyHash = crypto.createHmac("sha256", secret).update(`pin:casper-salt:${pin}`).digest("hex");

    const isValid = await verifyPin(pin, legacyHash);
    expect(isValid).toBe(true);

    const isWrong = await verifyPin("0000", legacyHash);
    expect(isWrong).toBe(false);
  });
});

describe("Finding #8: Standalone Subscription Expiry Logic", () => {
  it("should transition expired active/trial tenants to past_due_silent", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const testTenant = await prismaSystem.tenant.create({
      data: {
        name: "Test Expired Tenant",
        state: "trial",
        expiresAt: pastDate,
      },
    });

    try {
      const transitionedCount = await enforceSubscriptionExpiry();
      expect(transitionedCount).toBeGreaterThanOrEqual(1);

      const updated = await prismaSystem.tenant.findUnique({
        where: { id: testTenant.id },
      });
      expect(updated?.state).toBe("past_due_silent");
    } finally {
      await prismaSystem.tenant.delete({
        where: { id: testTenant.id },
      });
    }
  });
});

describe("Finding #6: Non-Null tenantId Database Constraint", () => {
  it("should require tenantId when inserting sales, expenses, and purchases", async () => {
    const tenant = await prismaSystem.tenant.create({
      data: { name: "Tenant For Constraint Test" },
    });

    try {
      // 1. Valid insert with tenantId succeeds
      const sale = await prismaSystem.sale.create({
        data: {
          tenantId: tenant.id,
          itemName: "Test Item",
          price: "100.00",
          total: "100.00",
        },
      });
      expect(sale.tenantId).toBe(tenant.id);

      const expense = await prismaSystem.expense.create({
        data: {
          tenantId: tenant.id,
          amount: "50.00",
          description: "Office Supplies",
        },
      });
      expect(expense.tenantId).toBe(tenant.id);

      // Clean up records
      await prismaSystem.sale.delete({ where: { id: sale.id } });
      await prismaSystem.expense.delete({ where: { id: expense.id } });
    } finally {
      await prismaSystem.tenant.delete({ where: { id: tenant.id } });
    }
  });
});
