# Graph Report - casper-voice-web  (2026-08-13)

## Corpus Check
- 182 files · ~87,248 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 666 nodes · 1097 edges · 90 communities (43 shown, 47 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `20382073`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_telegram.ts|telegram.ts]]
- [[_COMMUNITY_telegram_llm.ts|telegram_llm.ts]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_prisma.ts|prisma.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_correctTranscriptWithLLM|correctTranscriptWithLLM]]
- [[_COMMUNITY_consolidated_utilities.test.ts|consolidated_utilities.test.ts]]
- [[_COMMUNITY_VoiceCallModal.tsx|VoiceCallModal.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_fix_legacy_item.js|fix_legacy_item.js]]
- [[_COMMUNITY_processTelegramMessageWithLLM|processTelegramMessageWithLLM]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_layout.tsx|layout.tsx]]
- [[_COMMUNITY_middleware.ts|middleware.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_check_settings.js|check_settings.js]]
- [[_COMMUNITY_check_tables.js|check_tables.js]]
- [[_COMMUNITY_query.js|query.js]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_dry_run_kb.js|dry_run_kb.js]]
- [[_COMMUNITY_test.js|test.js]]
- [[_COMMUNITY_test_gemini.js|test_gemini.js]]
- [[_COMMUNITY_AGENTS|AGENTS.md]]
- [[_COMMUNITY_executeTool|executeTool]]
- [[_COMMUNITY_correctTranscriptWithLLM|correctTranscriptWithLLM]]
- [[_COMMUNITY_tenant-provisioner.ts|tenant-provisioner.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_AIChatBox.tsx|AIChatBox.tsx]]
- [[_COMMUNITY_TextChat.tsx|TextChat.tsx]]
- [[_COMMUNITY_cron-session-cleanup.ts|cron-session-cleanup.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_next.config.ts|next.config.ts]]
- [[_COMMUNITY_list_groq_models.sh|list_groq_models.sh]]
- [[_COMMUNITY_test_gemini.py|test_gemini.py]]
- [[_COMMUNITY_test_financial_sanity_and_grounding.js|test_financial_sanity_and_grounding.js]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_broad_scan.js|broad_scan.js]]
- [[_COMMUNITY_check_chat_messages.js|check_chat_messages.js]]
- [[_COMMUNITY_check_contamination.js|check_contamination.js]]
- [[_COMMUNITY_check_latest_rejection.js|check_latest_rejection.js]]
- [[_COMMUNITY_check_sales.js|check_sales.js]]
- [[_COMMUNITY_check_today_sales.js|check_today_sales.js]]
- [[_COMMUNITY_cleanup_corrupted_ledger.js|cleanup_corrupted_ledger.js]]
- [[_COMMUNITY_cleanup_idempotency_key.js|cleanup_idempotency_key.js]]
- [[_COMMUNITY_investigate_sale_financial_anomaly.js|investigate_sale_financial_anomaly.js]]
- [[_COMMUNITY_query_remote.js|query_remote.js]]
- [[_COMMUNITY_test_sales_api_route.js|test_sales_api_route.js]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_test_ambiguity_and_arabic_numerals.ts|test_ambiguity_and_arabic_numerals.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_reset_sim_tenant.ts|reset_sim_tenant.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_query_rejected.ts|query_rejected.ts]]
- [[_COMMUNITY_test_agent_db_loop.ts|test_agent_db_loop.ts]]
- [[_COMMUNITY_test_ambiguity_and_arabic_numerals.ts|test_ambiguity_and_arabic_numerals.ts]]
- [[_COMMUNITY_test_implicit_service_prompts.ts|test_implicit_service_prompts.ts]]
- [[_COMMUNITY_test_multi_unit_conversion.ts|test_multi_unit_conversion.ts]]
- [[_COMMUNITY_test_onboarding_name_persistence.ts|test_onboarding_name_persistence.ts]]
- [[_COMMUNITY_test_product_variant_ambiguity.ts|test_product_variant_ambiguity.ts]]
- [[_COMMUNITY_test_service_vs_product.ts|test_service_vs_product.ts]]
- [[_COMMUNITY_stock_pressure.test.ts|stock_pressure.test.ts]]
- [[_COMMUNITY_sync_conflict.test.ts|sync_conflict.test.ts]]

## God Nodes (most connected - your core abstractions)
1. `processTelegramMessageWithLLM()` - 87 edges
2. `executeTool()` - 35 edges
3. `getResolvedTenantId()` - 32 edges
4. `POST()` - 21 edges
5. `sendTelegramAlert()` - 18 edges
6. `isInternalAuthValid()` - 16 edges
7. `compilerOptions` - 16 edges
8. `verifyAdminSession()` - 15 edges
9. `rateLimit()` - 11 edges
10. `getClientIp()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `runTests()` --calls--> `executeTool()`  [EXTRACTED]
  scripts/manual-sim/test_e2e_retry_and_null.js → lib/telegram_llm.ts
- `runFinancialSanityTests()` --calls--> `executeTool()`  [EXTRACTED]
  scripts/manual-sim/test_financial_sanity_and_grounding.js → lib/telegram_llm.ts
- `run()` --calls--> `processTelegramMessageWithLLM()`  [EXTRACTED]
  simulate_customer.ts → lib/telegram_llm.ts
- `POST()` --calls--> `fireAndForgetTelegramAlert()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/telegram.ts
- `GET()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (90 total, 47 thin omitted)

### Community 0 - "telegram.ts"
Cohesion: 0.08
Nodes (44): POST(), DELETE(), GET(), requireAdmin(), handleCustomerMessage(), POST(), sendAsBusinessOwner(), POST() (+36 more)

### Community 1 - "telegram_llm.ts"
Cohesion: 0.06
Nodes (35): addCustomerTool, addProductTool, ALL_TOOLS, APPOINTMENT_TOOLS, bookAppointmentTool, cancelAppointmentTool, cancelLastTransactionTool, CLUSTER_KEYWORDS (+27 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, clsx, date-fns, decimal.js, flatpickr, @google/generative-ai, groq-sdk, livekit-client (+31 more)

### Community 3 - "prisma.ts"
Cohesion: 0.06
Nodes (3): globalForPrisma, main(), setupData()

### Community 4 - "route.ts"
Cohesion: 0.07
Nodes (45): genAI, POST(), appointmentIdempotencyMap, DELETE(), GET(), POST(), PUT(), POST() (+37 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "correctTranscriptWithLLM"
Cohesion: 0.23
Nodes (8): $allOperations(), asyncHooks, getTenantId(), runWithTenant(), TENANT_AWARE_MODELS, TenantContext, tenantStorage, runMvpPrelaunchAudit()

### Community 7 - "consolidated_utilities.test.ts"
Cohesion: 0.24
Nodes (7): createAuditLog(), LogAuditParams, PhoneValidationResult, sanitizeEgyptianPhone(), RAGSearchResult, searchKnowledgeBase(), prisma

### Community 8 - "VoiceCallModal.tsx"
Cohesion: 0.15
Nodes (7): DiagData, DiagItem, PAGE_TITLES, TABS, Message, ChatMessage, VoiceCallModalProps

### Community 9 - "page.tsx"
Cohesion: 0.32
Nodes (5): FIELDS, getProgressStyle(), ProviderUsage, UsageData, UsageIndicator()

### Community 10 - "fix_legacy_item.js"
Cohesion: 0.33
Nodes (4): fs, path, prisma, { PrismaClient }

### Community 11 - "processTelegramMessageWithLLM"
Cohesion: 0.17
Nodes (16): _exhaustedEnvKeys, getValidApiKey(), markKeyExhausted(), _resetExhaustedKeysForTesting(), deepgramSTT(), processImage(), transcribeVoiceNote(), TranscriptionFailedError (+8 more)

### Community 13 - "route.ts"
Cohesion: 0.33
Nodes (5): compilerOptions, types, exclude, extends, include

### Community 15 - "middleware.ts"
Cohesion: 0.07
Nodes (23): main(), buildActivePrompt(), enforceArabicEnglishOnly(), processTelegramMessageWithLLM(), resolveActiveTools(), sanitizeNonToolReply(), saveChatMessage(), main() (+15 more)

### Community 18 - "route.ts"
Cohesion: 0.38
Nodes (8): containsForbiddenFinancialData(), extractAndPersistMemory(), MemoryEntry, resolveMerchantMemories(), SaveMemoryParams, saveMerchantMemory(), stripQuotes(), runTests()

### Community 23 - "README.md"
Cohesion: 0.33
Nodes (5): Casper Voice & ERP — AI Support & Management System, 🛰️ Deployment, 🧪 Development & Testing, 🛠️ Environment Setup, 🚀 System Architecture

### Community 26 - "test_gemini.js"
Cohesion: 0.29
Nodes (8): ARABIC_NUMBER_WORDS, extractAllNumbersFromText(), FINANCIAL_TOOLS, findProductFuzzy(), groundingCheck(), isArabicFuzzyMatch(), messageHasAnyNumber(), normalizeArabic()

### Community 29 - "executeTool"
Cohesion: 0.20
Nodes (11): cleanArabicTimeStr(), executeTool(), findSupplierFuzzy(), logRejectedToolCall(), resolveRelativeArabicDate(), sanitizeArgsLanguage(), runDirectTest(), testAvcoAndGuards() (+3 more)

### Community 30 - "correctTranscriptWithLLM"
Cohesion: 0.46
Nodes (4): POST(), POST(), correctTranscriptWithLLM(), buildWhisperPrompt()

### Community 31 - "tenant-provisioner.ts"
Cohesion: 0.25
Nodes (3): ProvisionResult, TenantProvisioner, VoiceTenantProvisionOptions

### Community 42 - "route.ts"
Cohesion: 0.15
Nodes (3): GroupByOption, KNOWN_KEYS, POST()

### Community 52 - "test_gemini.py"
Cohesion: 0.60
Nodes (4): main(), runEdgeTest(), setupTestData(), TODAY

### Community 55 - "route.ts"
Cohesion: 0.40
Nodes (4): { executeTool }, prisma, { PrismaClient }, runTests()

### Community 66 - "test_sales_api_route.js"
Cohesion: 0.40
Nodes (4): { executeTool }, prisma, { PrismaClient }, runFinancialSanityTests()

### Community 68 - "route.ts"
Cohesion: 0.60
Nodes (4): main(), runScenario(), setupTestData(), TODAY

### Community 71 - "route.ts"
Cohesion: 0.83
Nodes (3): main(), runGibberishTest(), setupTestData()

### Community 72 - "route.ts"
Cohesion: 0.83
Nodes (3): main(), runSlangTest(), setupTestData()

### Community 75 - "reset_sim_tenant.ts"
Cohesion: 0.83
Nodes (3): main(), runServiceTest(), setupData()

### Community 76 - "route.ts"
Cohesion: 0.83
Nodes (3): main(), runTestCase(), setupTestData()

## Knowledge Gaps
- **209 isolated node(s):** `genAI`, `appointmentIdempotencyMap`, `Message`, `THRESHOLDS`, `idempotencyMap` (+204 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **47 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `dependencies` to `prisma.ts`?**
  _High betweenness centrality (0.073) - this node is a cross-community bridge._
- **Why does `processTelegramMessageWithLLM()` connect `middleware.ts` to `telegram.ts`, `telegram_llm.ts`, `prisma.ts`, `correctTranscriptWithLLM`, `processTelegramMessageWithLLM`, `route.ts`, `executeTool`, `test_gemini.py`, `test_financial_sanity_and_grounding.js`, `route.ts`, `route.ts`, `route.ts`, `reset_sim_tenant.ts`, `route.ts`, `test_ambiguity_and_arabic_numerals.ts`, `test_implicit_service_prompts.ts`, `test_multi_unit_conversion.ts`, `test_onboarding_name_persistence.ts`, `test_product_variant_ambiguity.ts`, `test_service_vs_product.ts`?**
  _High betweenness centrality (0.048) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `processTelegramMessageWithLLM()` (e.g. with `getValidApiKey()` and `markKeyExhausted()`) actually correct?**
  _`processTelegramMessageWithLLM()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `genAI`, `appointmentIdempotencyMap`, `Message` to the rest of the system?**
  _209 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `telegram.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08270676691729323 - nodes in this community are weakly interconnected._
- **Should `telegram_llm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._