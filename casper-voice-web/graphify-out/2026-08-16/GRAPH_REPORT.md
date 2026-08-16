# Graph Report - casper-voice-web  (2026-08-16)

## Corpus Check
- 218 files · ~113,570 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 871 nodes · 1533 edges · 89 communities (44 shown, 45 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `68a29d65`
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
- [[_COMMUNITY_test_ambiguity_and_arabic_numerals.ts|test_ambiguity_and_arabic_numerals.ts]]
- [[_COMMUNITY_test_implicit_service_prompts.ts|test_implicit_service_prompts.ts]]
- [[_COMMUNITY_test_multi_unit_conversion.ts|test_multi_unit_conversion.ts]]
- [[_COMMUNITY_test_onboarding_name_persistence.ts|test_onboarding_name_persistence.ts]]
- [[_COMMUNITY_test_product_variant_ambiguity.ts|test_product_variant_ambiguity.ts]]
- [[_COMMUNITY_test_service_vs_product.ts|test_service_vs_product.ts]]

## God Nodes (most connected - your core abstractions)
1. `processTelegramMessageWithLLM()` - 88 edges
2. `executeTool()` - 41 edges
3. `getResolvedTenantId()` - 37 edges
4. `POST()` - 24 edges
5. `parseMoney()` - 23 edges
6. `sendTelegramAlert()` - 21 edges
7. `runWithTenant()` - 19 edges
8. `isInternalAuthValid()` - 17 edges
9. `verifyAdminSession()` - 17 edges
10. `getClientIp()` - 16 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `maskSecret()`  [EXTRACTED]
  app/api/admin/api-keys/route.ts → lib/crypto.ts
- `POST()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/ai/chat/route.ts → lib/auth.ts
- `POST()` --calls--> `fireAndForgetTelegramAlert()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/telegram.ts
- `GET()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/auth.ts
- `POST()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/chat/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (89 total, 45 thin omitted)

### Community 0 - "telegram.ts"
Cohesion: 0.07
Nodes (48): POST(), POST(), handleCustomerMessage(), POST(), sendAsBusinessOwner(), sendProfileConfirmationCard(), correctTranscriptWithLLM(), PhoneValidationResult (+40 more)

### Community 1 - "telegram_llm.ts"
Cohesion: 0.05
Nodes (40): addCustomerTool, addProductTool, ALL_TOOLS, AmbiguityType, APPOINTMENT_TOOLS, ARABIC_NUMBER_WORDS, bookAppointmentTool, cancelAppointmentTool (+32 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (39): dependencies, clsx, date-fns, decimal.js, flatpickr, @google/generative-ai, groq-sdk, livekit-client (+31 more)

### Community 4 - "route.ts"
Cohesion: 0.05
Nodes (58): appointmentIdempotencyMap, DELETE(), GET(), POST(), PUT(), POST(), GET(), POST() (+50 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "correctTranscriptWithLLM"
Cohesion: 0.05
Nodes (36): Border Radius Scale, Brand & Accent, Brand Gradient, Breakpoints, Buttons, Cards & Containers, Collapsing Strategy, Colors (+28 more)

### Community 7 - "consolidated_utilities.test.ts"
Cohesion: 0.32
Nodes (5): createAuditLog(), LogAuditParams, RAGSearchResult, searchKnowledgeBase(), prisma

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
Cohesion: 0.16
Nodes (17): _exhaustedEnvKeys, getValidApiKey(), markKeyExhausted(), _resetExhaustedKeysForTesting(), deepgramSTT(), processImage(), transcribeVoiceNote(), TranscriptionFailedError (+9 more)

### Community 13 - "route.ts"
Cohesion: 0.33
Nodes (5): compilerOptions, types, exclude, extends, include

### Community 15 - "middleware.ts"
Cohesion: 0.07
Nodes (25): main(), buildActivePrompt(), enforceArabicEnglishOnly(), processTelegramMessageWithLLM(), resolveActiveTools(), sanitizeNonToolReply(), saveChatMessage(), main() (+17 more)

### Community 16 - "route.ts"
Cohesion: 0.08
Nodes (50): genAI, POST(), customerLoginSchema, POST(), customerSetupSchema, POST(), POST(), POST() (+42 more)

### Community 18 - "route.ts"
Cohesion: 0.35
Nodes (9): containsForbiddenFinancialData(), extractAndPersistMemory(), MemoryEntry, resolveMerchantMemories(), SaveMemoryParams, saveMerchantMemory(), stripQuotes(), runMerchantMemoryTest() (+1 more)

### Community 23 - "README.md"
Cohesion: 0.33
Nodes (5): Casper Voice & ERP — AI Support & Management System, 🛰️ Deployment, 🧪 Development & Testing, 🛠️ Environment Setup, 🚀 System Architecture

### Community 26 - "test_gemini.js"
Cohesion: 0.10
Nodes (19): Affected functions in `session.ts`, Architecture constraint, Architecture Decision: Token Format, Callers that sign (must be updated), Callers that verify (must check expiry + blacklist), Chosen pattern, Current broken code, Finding #3 — XFF Spoofing (10-minute fix) (+11 more)

### Community 29 - "executeTool"
Cohesion: 0.06
Nodes (34): cleanArabicTimeStr(), executeTool(), extractAllNumbersFromText(), FINANCIAL_TOOLS, findProductFuzzy(), findSupplierFuzzy(), groundingCheck(), isArabicFuzzyMatch() (+26 more)

### Community 30 - "correctTranscriptWithLLM"
Cohesion: 0.12
Nodes (15): 1. System Overview & Philosophy, 2. Color Palette & HSL Tokens, 3. Typography & Dual-Language Scale, 4. Voice UI States & Animations, 5. POS Component & Layout Guidelines, 6. Vercel Design System Tokens (`vercel_tokens.css`), Base & Backgrounds, Brand & Status Colors (+7 more)

### Community 31 - "tenant-provisioner.ts"
Cohesion: 0.13
Nodes (14): Actual Vulnerabilities Found in Source (Empirical, Not AI-Generated), Fix Strategy: Typed `bypassTenantFilter` Flag, Industry Standard: Prisma Multi-Tenant Fail-Closed (2024–2026), Legitimate Callers That Need a Real Bypass, Pattern A: Application-Level Throw (Our Target Pattern), Pattern B: PostgreSQL RLS (Not applicable here), Research Findings — Tenant Filter Fail-Closed Hardening, Test Coverage Gap (+6 more)

### Community 42 - "route.ts"
Cohesion: 0.20
Nodes (14): GET(), POST(), GET(), GET(), KNOWN_KEYS, POST(), SENSITIVE_KEYS, decryptField() (+6 more)

### Community 52 - "test_gemini.py"
Cohesion: 0.60
Nodes (4): main(), runEdgeTest(), setupTestData(), TODAY

### Community 54 - "test_financial_sanity_and_grounding.js"
Cohesion: 0.29
Nodes (3): colorMap, GlassPanelProps, KPICardProps

### Community 55 - "route.ts"
Cohesion: 0.33
Nodes (5): 1. Finding #6: Non-Null `tenantId` Constraint in Prisma & SQLite, 2. Finding #7: Database Field Encryption (AES-256-GCM Envelope), 3. Finding #10: Dynamic Salt & Peppered PIN Hashing, 4. Finding #8: Standalone Subscription Expiry Cron Process, Research Findings — Batch 3 Hardening (Findings #6, #7, #8, #10)

### Community 67 - "route.ts"
Cohesion: 0.50
Nodes (3): 1. The Core Architecture Challenge, 2. Best-Practice Solution: Dual-Mode Financial Engine (`lib/financial.ts`), Research Findings — Finding #2: Financial Precision Architecture

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
- **296 isolated node(s):** `genAI`, `appointmentIdempotencyMap`, `customerLoginSchema`, `customerSetupSchema`, `Message` (+291 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **45 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `dependencies` to `prisma.ts`?**
  _High betweenness centrality (0.053) - this node is a cross-community bridge._
- **Why does `processTelegramMessageWithLLM()` connect `middleware.ts` to `telegram.ts`, `telegram_llm.ts`, `prisma.ts`, `route.ts`, `processTelegramMessageWithLLM`, `route.ts`, `executeTool`, `test_gemini.py`, `route.ts`, `route.ts`, `route.ts`, `route.ts`, `reset_sim_tenant.ts`, `route.ts`, `test_ambiguity_and_arabic_numerals.ts`, `test_implicit_service_prompts.ts`, `test_multi_unit_conversion.ts`, `test_onboarding_name_persistence.ts`, `test_product_variant_ambiguity.ts`, `test_service_vs_product.ts`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `processTelegramMessageWithLLM()` (e.g. with `getValidApiKey()` and `markKeyExhausted()`) actually correct?**
  _`processTelegramMessageWithLLM()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `genAI`, `appointmentIdempotencyMap`, `customerLoginSchema` to the rest of the system?**
  _296 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `telegram.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06564364876385337 - nodes in this community are weakly interconnected._
- **Should `telegram_llm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05121951219512195 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._