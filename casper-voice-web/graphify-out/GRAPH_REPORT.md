# Graph Report - casper-voice-web  (2026-08-07)

## Corpus Check
- 106 files · ~54,457 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 410 nodes · 567 edges · 50 communities (28 shown, 22 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3a190e34`
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
- [[_COMMUNITY_route.ts|route.ts]]
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
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_AIChatBox.tsx|AIChatBox.tsx]]
- [[_COMMUNITY_TextChat.tsx|TextChat.tsx]]
- [[_COMMUNITY_cron-session-cleanup.ts|cron-session-cleanup.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_next.config.ts|next.config.ts]]
- [[_COMMUNITY_list_groq_models.sh|list_groq_models.sh]]

## God Nodes (most connected - your core abstractions)
1. `getResolvedTenantId()` - 32 edges
2. `POST()` - 20 edges
3. `compilerOptions` - 16 edges
4. `isInternalAuthValid()` - 14 edges
5. `sendTelegramAlert()` - 14 edges
6. `approveTenantRequest()` - 10 edges
7. `processTelegramMessageWithLLM()` - 9 edges
8. `fireAndForgetTelegramAlert()` - 8 edges
9. `handleFallbackSaleCallback()` - 8 edges
10. `correctTranscriptWithLLM()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/ai/chat/route.ts → lib/auth.ts
- `POST()` --calls--> `fireAndForgetTelegramAlert()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/telegram.ts
- `GET()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/auth.ts
- `POST()` --calls--> `signTenantSession()`  [EXTRACTED]
  app/api/auth/login/route.ts → lib/session.ts
- `GET()` --calls--> `getResolvedTenantId()`  [EXTRACTED]
  app/api/dashboard/settings/tenant-setup/route.ts → lib/auth.ts

## Import Cycles
- None detected.

## Communities (50 total, 22 thin omitted)

### Community 0 - "telegram.ts"
Cohesion: 0.11
Nodes (35): handleCustomerMessage(), POST(), sendAsBusinessOwner(), POST(), POST(), approveDirectTenant(), approveTenantRequest(), callTelegramApi() (+27 more)

### Community 1 - "telegram_llm.ts"
Cohesion: 0.09
Nodes (25): _exhaustedEnvKeys, getValidApiKey(), markKeyExhausted(), bookAppointmentTool, executedKeys, executeTool(), findCustomerFuzzy(), getAppointmentsListTool (+17 more)

### Community 2 - "dependencies"
Cohesion: 0.05
Nodes (36): dependencies, clsx, date-fns, decimal.js, flatpickr, @google/generative-ai, groq-sdk, livekit-client (+28 more)

### Community 3 - "prisma.ts"
Cohesion: 0.06
Nodes (8): POST(), GroupByOption, KNOWN_KEYS, POST(), POST(), correctTranscriptWithLLM(), globalForPrisma, buildWhisperPrompt()

### Community 4 - "route.ts"
Cohesion: 0.07
Nodes (37): genAI, POST(), appointmentIdempotencyMap, DELETE(), GET(), POST(), PUT(), POST() (+29 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "correctTranscriptWithLLM"
Cohesion: 0.29
Nodes (8): $allOperations(), asyncHooks, getTenantId(), runWithTenant(), TENANT_AWARE_MODELS, TenantContext, tenantStorage, runVerificationSuite()

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

### Community 11 - "route.ts"
Cohesion: 0.25
Nodes (3): ProvisionResult, TenantProvisioner, VoiceTenantProvisionOptions

### Community 13 - "route.ts"
Cohesion: 0.33
Nodes (5): compilerOptions, types, exclude, extends, include

### Community 14 - "layout.tsx"
Cohesion: 0.40
Nodes (3): cairo, metadata, plusJakarta

### Community 15 - "middleware.ts"
Cohesion: 0.60
Nodes (4): config, isInternalSecretValid(), middleware(), PUBLIC_PATHS

### Community 18 - "route.ts"
Cohesion: 0.83
Nodes (3): DELETE(), GET(), requireAdmin()

### Community 23 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **144 isolated node(s):** `genAI`, `appointmentIdempotencyMap`, `Message`, `THRESHOLDS`, `idempotencyMap` (+139 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `prisma` connect `dependencies` to `prisma.ts`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **What connects `genAI`, `appointmentIdempotencyMap`, `Message` to the rest of the system?**
  _144 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `telegram.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.11205073995771671 - nodes in this community are weakly interconnected._
- **Should `telegram_llm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08994708994708994 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.056025369978858354 - nodes in this community are weakly interconnected._
- **Should `route.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._