# Graph Report - casper-voice-web  (2026-08-03)

## Corpus Check
- 86 files · ~39,985 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 347 nodes · 399 edges · 54 communities (27 shown, 27 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `903f7102`
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
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_route.ts|route.ts]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_page.tsx|page.tsx]]
- [[_COMMUNITY_AIChatBox.tsx|AIChatBox.tsx]]
- [[_COMMUNITY_TextChat.tsx|TextChat.tsx]]
- [[_COMMUNITY_cron-session-cleanup.ts|cron-session-cleanup.ts]]
- [[_COMMUNITY_next.config.ts|next.config.ts]]
- [[_COMMUNITY_list_groq_models.sh|list_groq_models.sh]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `POST()` - 15 edges
3. `sendTelegramAlert()` - 14 edges
4. `isInternalAuthValid()` - 8 edges
5. `handleFallbackSaleCallback()` - 8 edges
6. `processTelegramMessageWithLLM()` - 8 edges
7. `correctTranscriptWithLLM()` - 7 edges
8. `fireAndForgetTelegramAlert()` - 6 edges
9. `approveTenantRequest()` - 6 edges
10. `rejectTenantRequest()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --calls--> `fireAndForgetTelegramAlert()`  [EXTRACTED]
  app/api/appointments/route.ts → lib/telegram.ts
- `POST()` --calls--> `correctTranscriptWithLLM()`  [EXTRACTED]
  app/api/knowledge/voice-ingest/route.ts → lib/llm_correction.ts
- `POST()` --calls--> `correctTranscriptWithLLM()`  [EXTRACTED]
  app/api/telegram/webhook/route.ts → lib/llm_correction.ts
- `POST()` --calls--> `processTelegramMessageWithLLM()`  [EXTRACTED]
  app/api/telegram/webhook/route.ts → lib/telegram_llm.ts
- `POST()` --calls--> `buildWhisperPrompt()`  [EXTRACTED]
  app/api/telegram/webhook/route.ts → lib/whisper_prompt.ts

## Import Cycles
- None detected.

## Communities (54 total, 27 thin omitted)

### Community 0 - "telegram.ts"
Cohesion: 0.11
Nodes (32): POST(), POST(), prisma, POST(), POST(), approveTenantRequest(), callTelegramApi(), executeSaleFlow() (+24 more)

### Community 1 - "telegram_llm.ts"
Cohesion: 0.09
Nodes (26): _exhaustedEnvKeys, getValidApiKey(), markKeyExhausted(), bookAppointmentTool, executedKeys, executeTool(), findCustomerFuzzy(), getAppointmentsListTool (+18 more)

### Community 2 - "dependencies"
Cohesion: 0.07
Nodes (27): dependencies, decimal.js, @google/generative-ai, groq-sdk, livekit-client, livekit-server-sdk, lucide-react, next (+19 more)

### Community 3 - "prisma.ts"
Cohesion: 0.08
Nodes (5): THRESHOLDS, KNOWN_KEYS, POST(), globalForPrisma, prisma

### Community 4 - "route.ts"
Cohesion: 0.15
Nodes (11): appointmentIdempotencyMap, DELETE(), prisma, PUT(), prisma, PUT(), idempotencyMap, prisma (+3 more)

### Community 5 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 6 - "correctTranscriptWithLLM"
Cohesion: 0.26
Nodes (8): POST(), prisma, POST(), prisma, correctTranscriptWithLLM(), prisma, buildWhisperPrompt(), prisma

### Community 7 - "consolidated_utilities.test.ts"
Cohesion: 0.24
Nodes (7): createAuditLog(), LogAuditParams, PhoneValidationResult, sanitizeEgyptianPhone(), RAGSearchResult, searchKnowledgeBase(), prisma

### Community 8 - "VoiceCallModal.tsx"
Cohesion: 0.20
Nodes (4): TABS, Message, ChatMessage, VoiceCallModalProps

### Community 9 - "page.tsx"
Cohesion: 0.22
Nodes (5): FIELDS, ProviderUsage, UsageData, UsageIndicator(), VoiceNotePlayerProps

### Community 10 - "fix_legacy_item.js"
Cohesion: 0.33
Nodes (4): fs, path, prisma, { PrismaClient }

### Community 11 - "route.ts"
Cohesion: 0.50
Nodes (4): getSystemPrompt(), Message, POST(), prisma

### Community 14 - "layout.tsx"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

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
- **140 isolated node(s):** `prisma`, `genAI`, `prisma`, `appointmentIdempotencyMap`, `prisma` (+135 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **27 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `dependencies` connect `dependencies` to `prisma.ts`?**
  _High betweenness centrality (0.067) - this node is a cross-community bridge._
- **Why does `prisma` connect `prisma.ts` to `dependencies`?**
  _High betweenness centrality (0.065) - this node is a cross-community bridge._
- **What connects `prisma`, `genAI`, `prisma` to the rest of the system?**
  _140 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `telegram.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1141025641025641 - nodes in this community are weakly interconnected._
- **Should `telegram_llm.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08620689655172414 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07142857142857142 - nodes in this community are weakly interconnected._
- **Should `prisma.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._