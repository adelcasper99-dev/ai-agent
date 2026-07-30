# /req-workflow-pipeline Workflow (AI Support Agent)

Use this workflow to run the complete 6-stage Requirements, User/Customer Workflows & Best-Practice Gap Analysis Pipeline specifically tailored for the **AI Support Agent System**.

## Slash Command Usage

Type `/req-workflow-pipeline <optional focus>` or `/gap-pipeline <optional focus>` in chat.

Example:
```text
/req-workflow-pipeline AI Support Agent Ticket Resolution, Auth Bridge & KB Integration
```

## What it does:

1. **Stage 1: Support Agent Architecture Grounding** (`graphify` + `Prisma Schema` + Auth/VPS/KB scripts).
2. **Stage 2: AI Support System Best-Practice Benchmark** (`ce-best-practices-researcher` + `ce-web-researcher` for Agentic Support, RAG & Ticket Systems).
3. **Stage 3: Support Agent Workflow Mapping** (`ce-spec-flow-analyzer` + `Product Manager` for End-User, Operator & AI Agent workflows).
4. **Stage 4: Agent Risk & Guardrail Audit** (`AppSec` + `ce-adversarial-document-reviewer` for Auth, RBAC, Nginx routing, and LLM safety).
5. **Stage 5: UI & Admin Dashboard Modeling** (`StitchMCP` + `impeccable` for Web Dashboard, KB editor & Live Chat UI).
6. **Stage 6: AI Support Agent Gap Matrix & Roadmap** (`requirements_gap_matrix.md` with P0/P1 feature roadmap).
