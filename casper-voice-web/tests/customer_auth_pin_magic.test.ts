import { describe, it, expect } from "vitest";
import { hashPin, verifyPin, signMagicLink, verifyMagicLink, signCustomerSession, verifyCustomerSession } from "@/lib/session";

describe("Customer Security Suite (PIN & Magic Links)", () => {
  const customerId = "cust-pin-test-1234";
  const pin = "4567";

  it("1. Accurately hashes and verifies customer PIN with constant-time check", async () => {
    const hashed = await hashPin(pin, customerId);
    expect(hashed).toBeDefined();
    expect(hashed.length).toBeGreaterThan(20);

    const isMatch = await verifyPin(pin, hashed, customerId);
    expect(isMatch).toBe(true);

    const isWrong = await verifyPin("9999", hashed, customerId);
    expect(isWrong).toBe(false);
  });

  it("2. Accurately generates and verifies expiring Magic Links for Telegram", async () => {
    // Valid link (15 minutes)
    const validToken = await signMagicLink(customerId, 15);
    expect(validToken).toContain(".");

    const verifiedId = await verifyMagicLink(validToken);
    expect(verifiedId).toBe(customerId);

    // Tampered link
    const tampered = validToken.substring(0, validToken.length - 4) + "abcd";
    const invalidTampered = await verifyMagicLink(tampered);
    expect(invalidTampered).toBeNull();

    // Expired link (-1 minute)
    const expiredToken = await signMagicLink(customerId, -1);
    const invalidExpired = await verifyMagicLink(expiredToken);
    expect(invalidExpired).toBeNull();
  });

  it("3. Issues and validates session cookie token", async () => {
    const sessionToken = await signCustomerSession(customerId);
    const sessionCustomer = await verifyCustomerSession(sessionToken);
    expect(sessionCustomer).toBe(customerId);
  });
});
