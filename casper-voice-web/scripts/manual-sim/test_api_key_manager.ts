import { getValidApiKey, markKeyExhausted, _resetExhaustedKeysForTesting } from "./lib/apiKeyManager";

async function runTests() {
  console.log("=== Testing ApiKeyManager Hardening ===");

  // Reset test state
  _resetExhaustedKeysForTesting();

  // 1. Single ENV key lookup
  process.env.TEST_PROVIDER_API_KEY = "key_alpha_123";
  let key1 = await getValidApiKey("test_provider");
  console.log("Test #1 (Single Key Lookup):", key1 === "key_alpha_123" ? "PASSED ✅" : `FAILED ❌ (${key1})`);

  // 2. Comma-separated ENV keys lookup
  delete process.env.TEST_PROVIDER_API_KEY;
  process.env.TEST_MULTI_API_KEYS = "key_multi_1, key_multi_2, key_multi_3";
  let keyMulti1 = await getValidApiKey("test_multi");
  console.log("Test #2 (Comma-separated Multi-Key #1):", keyMulti1 === "key_multi_1" ? "PASSED ✅" : `FAILED ❌ (${keyMulti1})`);

  // 3. Exhaustion & Failover
  await markKeyExhausted("key_multi_1", "test_multi");
  let keyMulti2 = await getValidApiKey("test_multi");
  console.log("Test #3 (Exhaustion & Failover to Multi-Key #2):", keyMulti2 === "key_multi_2" ? "PASSED ✅" : `FAILED ❌ (${keyMulti2})`);

  // 4. Generic Provider Prefix (e.g. MOCKROUTER)
  process.env.MOCKROUTER_API_KEY_PRIMARY = "mr_secret_999";
  let keyOR = await getValidApiKey("mockrouter");
  console.log("Test #4 (Generic Provider Prefix Match):", keyOR === "mr_secret_999" ? "PASSED ✅" : `FAILED ❌ (${keyOR})`);

  // Cleanup
  delete process.env.TEST_PROVIDER_API_KEY;
  delete process.env.TEST_MULTI_API_KEYS;
  delete process.env.MOCKROUTER_API_KEY_PRIMARY;
  _resetExhaustedKeysForTesting();

  console.log("\n✅ All ApiKeyManager Unit Tests Completed Successfully.");
}

runTests().catch(err => {
  console.error("❌ Test Runner Failed:", err);
  process.exit(1);
});
