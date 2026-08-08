function generateEffectiveIdempotencyKey(tenantId, name, telegramMessageId, callIndex = 0) {
  const tId = tenantId || "global";
  const msgIdPart = telegramMessageId ? `msg_${telegramMessageId}` : `nomsg_${Date.now()}`;
  return `${tId}:${name}:${msgIdPart}:call_${callIndex}`;
}

// Test Case 1: Standard message
const key1 = generateEffectiveIdempotencyKey("tenant_A", "log_sale", 998811, 0);
console.log("Key 1 (Standard):", key1);

// Test Case 2: Webhook Retry (Exact same Telegram update/message ID)
const key2_retry = generateEffectiveIdempotencyKey("tenant_A", "log_sale", 998811, 0);
console.log("Key 2 (Webhook Retry):", key2_retry);
console.assert(key1 === key2_retry, "TEST FAILED: Webhook retry must yield identical idempotency key!");

// Test Case 3: Multiple tool calls in the same message (call_0 vs call_1)
const key3_call0 = generateEffectiveIdempotencyKey("tenant_A", "log_sale", 998811, 0);
const key3_call1 = generateEffectiveIdempotencyKey("tenant_A", "log_sale", 998811, 1);
console.log("Key 3 (Call 0):", key3_call0);
console.log("Key 3 (Call 1):", key3_call1);
console.assert(key3_call0 !== key3_call1, "TEST FAILED: Multi-tool calls in same message must have unique keys!");

// Test Case 4: Multi-tenant safety (tenant_A vs tenant_B with same message ID)
const key4_tenantB = generateEffectiveIdempotencyKey("tenant_B", "log_sale", 998811, 0);
console.log("Key 4 (Tenant B):", key4_tenantB);
console.assert(key1 !== key4_tenantB, "TEST FAILED: Different tenants must have unique keys!");

console.log("\n✅ ALL IDEMPOTENCY KEY UNIT TESTS PASSED!");
