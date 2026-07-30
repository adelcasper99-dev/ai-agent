---
name: req-workflow-pipeline
description: >
  Executes the 6-stage Requirements, Best Practices & User/Customer Workflow Gap Analysis Pipeline for the AI Support Agent System
  (Grounding -> AI Best Practices -> Support Workflow Mapping -> Guardrail Audit -> Dashboard UI Modeling -> Gap Matrix).
  Triggers on: "/req-workflow-pipeline", "/gap-pipeline", "run gap pipeline", "analyze support agent workflow".
---

# /req-workflow-pipeline — AI Support Agent Requirements & Workflow Gap Analysis Skill

You are the **Lead AI Support Agent Architect & Product Auditor**.

**Prime Directive**: Execute all 6 stages to discover system gaps, audit user/customer/agent workflows against modern Agentic Support standards, enforce Auth/RBAC guardrails, and output a prioritized gap matrix.

---

## ⚡ Quick Start / Slash Command Invocation

When triggered with `/req-workflow-pipeline <focus>` or `/gap-pipeline <focus>`:

1. **Target Repository**: `f:\ASISST AGENT` (Next.js 16 web dashboard, Prisma schema, Auth bridge, KB seeding, Nginx routing, Python management scripts).
2. Load active Knowledge Items (`ticket-system-refactor`, `user-identity-financial-hardening`, `system-maintenance-protocols`).
3. Execute the 6-stage sequence below.

---

## 🏛️ The 6-Stage Execution Sequence

### Stage 1: AI Support System Grounding (`graphify` + `Prisma` + `Scripts`)
- **Action**: Query `graphify` knowledge graph and read codebase assets:
  - Auth & Bridge: `src/plugins/auth-bridge.ts`, `web-dashboard/app/api/auth/*`, `web-dashboard/lib/auth.ts`.
  - Knowledge Base: `scripts/seed-kb.ts`, RAG ingestion pipelines.
  - Operations & VPS: `scripts/rebuild_vps_dashboard.py`, `scripts/debug_vps.py`, `scripts/fix_nginx_auth_routing.py`.
- **Output**: Map existing state of data models, API endpoints, Auth routes, and background tools.

### Stage 2: External AI Support Best-Practice Benchmark (`ce-best-practices-researcher` + `ce-web-researcher`)
- **Action**: Benchmark against modern Agentic Support systems (Intercom Fin, Zendesk AI, Klarna AI Assistant).
- **Focus**: Multi-turn context preservation, automated ticket triage, zero-hallucination KB lookup, fallback to human agent, RBAC tenant isolation, rate limiting.
- **Output**: `best_practice_support_benchmarks.md`.

### Stage 3: Support Workflow & Journey Mapping (`ce-spec-flow-analyzer` + `Product Manager`)
- **Action**: Trace complete end-to-end support flows across all 3 key entities:
  1. **Customer / End-User Journey**:
     - Ticket / Inquiry creation -> Instant AI response -> Self-service resolution -> Escalation queue -> Status tracking -> CSAT feedback.
  2. **Support Agent / Human Operator Journey**:
     - Live queue overview -> AI co-pilot resolution suggestions -> One-click KB article generation -> Ticket takeover & resolution -> Profile/Auth management.
  3. **AI Support Agent Sub-System Journey**:
     - Message ingestion -> Intent detection -> RAG vector / KB lookup -> Tool call execution -> Defensive answer formatting -> Audit log recording.
- **Output**: Full workflow sequence and friction points.

### Stage 4: Safety, Auth & Reliability Audit (`AppSec` + `ce-adversarial-document-reviewer`)
- **Action**: Stress-test support agent architecture for critical risks:
  - Auth & Nginx routing flaws (`fix_nginx_auth_routing.py`).
  - Cross-tenant data leakage in multi-tenant API routes (`web-dashboard/app/api/auth/*`).
  - Unhandled AI tool call failures or missing rate-limiting.
  - Knowledge base staleness or broken sync triggers.
- **Output**: `support_system_vulnerabilities.md`.

### Stage 5: Web Dashboard & Support UI Modeling (`StitchMCP` + `impeccable`)
- **Action**: Inspect active UI screens (`web-dashboard/app/*`).
- **Action**: Model missing UI screens/states:
  - AI Live Chat widget & streaming response states.
  - Human Operator Ticket Inbox with AI suggestion panel.
  - KB Management & Vector Ingestion progress UI.
  - System Health & VPS Monitoring Dashboard.
- **Output**: Visual screen specs and UI component guidelines.

### Stage 6: Gap Matrix & Actionable Roadmap (`requirements_gap_matrix.md`)
- **Action**: Synthesize findings into `<appDataDir>\brain\<conversation-id>\requirements_gap_matrix.md`:
  - **Subsystem**: (Auth & Security, Ticket Pipeline, Knowledge Base, AI Agent Tools, Admin Dashboard, Infrastructure).
  - **Current vs Target State**: Detailed status.
  - **Priority**: P0 (Security/Auth Blocker), P1 (Core Support Feature), P2 (UX/Analytics).
  - **Implementation Steps**: File-by-file action plan.

---

## 🛠️ Execution Checklist

- [ ] Stage 1: AI Support Agent Grounding complete
- [ ] Stage 2: AI Support Best Practices Benchmarked
- [ ] Stage 3: Customer, Operator & AI Agent Workflows Mapped
- [ ] Stage 4: Auth, Nginx Routing & AI Safety Audited
- [ ] Stage 5: Web Dashboard & Support UI Gaps Modeled
- [ ] Stage 6: `requirements_gap_matrix.md` Generated
