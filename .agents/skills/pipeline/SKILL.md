---
name: pipeline
description: >
  Executes the complete 7-stage Casper autonomous engineering pipeline in Hybrid Mode
  (Grill-Me -> Best-Practice Research -> Spec -> 2-Pass Ironclad Review -> Build -> Code Audit -> Test & DevTools QA -> Accept -> Compliance Verification).
  Triggers on: "/pipeline", "/casper-pipeline", "run pipeline", "execute pipeline".
---

# /pipeline — Autonomous Multi-Agent Pipeline Skill (Hybrid Mode)

You are operating as the **Pipeline Master Orchestrator** for Casper POS & ERP.

**Prime Directive**: Execute all stages with strict quality gates. NO stage may be skipped. Each stage MUST produce its required artifact before the next begins. NO BATCH SKIPPING.

**ANTI-SKIP ENFORCEMENT**: The `Permanent Anti-Skip & Pipeline Compliance Protocol` in AGENTS.md is ACTIVE and OVERRIDES Token Conservation during this pipeline.

**HYBRID MODE**: The pipeline runs continuously in two autonomous blocks. There are only TWO mandatory human checkpoints — after Ironclad Review and after Stage 5 Accept. All other stages chain automatically.

---

## ⚡ Quick Start / Slash Command Invocation

When triggered with `/pipeline <task description>` or `/casper-pipeline <task description>`:

1. **Auto-Detect Upstream Requirements**: Check `docs/brainstorms/` for any recent `*-requirements.md` matching the task.
2. Initialize `.agents/stage_log.json` if it doesn't exist: `[]`
3. Execute **Block A** autonomously (Stages 0a → 0b → 1 → 2ab).
4. ⛔ **CHECKPOINT ALPHA** — Present Ironclad results. Await user approval.
5. Execute **Block B** autonomously (Stages 3 → 3b → 4 → 5).
6. ⛔ **CHECKPOINT BETA** — Present full results summary. Await user approval.
7. Execute **Stage 6** Compliance Verification.

---

## 🏛️ BLOCK A — Research & Planning (Autonomous, No Interruption)

> Run Stages 0a → 0b → 1 → 2ab in sequence without stopping. Each stage logs to `stage_log.json` and chains directly to the next.

### Stage 0a: Grill-Me Initiation Interview (`/grill-me`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: Ask 3-4 targeted questions to clarify scope, trade-offs, and edge cases. (Skip if `*-requirements.md` present.)
- **Output**: Print the full interview Q&A inline.
- **Log**: `{ "stage": "0a-grill-me", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": [] }`
- **→ Auto-continue to Stage 0b.**

---

### Stage 0b: External Best-Practice Research (`ce-best-practices-researcher`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: Research external industry standards and framework patterns. Save to `research_findings.md`.
- **Output**: Print research summary inline.
- **Log**: `{ "stage": "0b-research", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["research_findings.md"] }`
- **→ Auto-continue to Stage 1.**

---

### Stage 1: Grounding & Spec Generation (`spec-kit`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: Ground via `graphify` + `research_findings.md`. Output `implementation_plan.md`.
- **Output**: Print spec summary inline.
- **Log**: `{ "stage": "1-spec", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["implementation_plan.md"] }`
- **→ Auto-continue to Stage 2ab.**

---

### Stage 2a & 2b: 2-Pass Ironclad Review (`ironclad-review`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Pass 1**: Adversarial critique → Hardened Revised Plan.
- **Pass 2**: Verify all gaps resolved. Score must be >= 95%.
- **Exit Criteria**: `ironclad_review_implementation_plan.md` on disk with score >= 95%.
- **Log**: `{ "stage": "2ab-ironclad", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["ironclad_review_implementation_plan.md"] }`

---

## ⛔ CHECKPOINT ALPHA — Human Gate (Required)

**Present to user:**
- Ironclad Score (before → after)
- Number of critical gaps found and resolved
- Link to `ironclad_review_implementation_plan.md`
- Link to hardened `implementation_plan.md`

**Then ask:** *"BLOCK A complete. Review the Ironclad results above. Type **Proceed** to begin the build, or **Stop** to revise the plan."*

> Do NOT begin BLOCK B until the user explicitly types "Proceed" or "✅".

---

## 🏛️ BLOCK B — Build, Audit & Ship (Autonomous, No Interruption)

> Run Stages 3 → 3b → 4 → 5 in sequence without stopping. Each stage logs to `stage_log.json` and chains directly to the next.

### Stage 3: Surgical Build (`cavecrew-builder`)
- **Model**: `Gemini 3.6 Flash (High)`
- **Action**: Mutate code. Zero `any` types. `Decimal.js` for all monetary fields. Log to `task.md` with `[x]` markers.
- **Exit Criteria**: `task.md` exists with ALL items `[x]`.
- **Output**: Print diff summary inline.
- **Log**: `{ "stage": "3-build", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["task.md"] }`
- **→ Auto-continue to Stage 3b.**

---

### Stage 3b: Code Audit & Peer Review (`ce-adversarial-reviewer` + `AppSec` + `ponytail-review`)
- **Model**: `Gemini 3.6 Flash (High)`
- **Action**: Audit diff for RBAC, input validation, try/catch, over-engineering. Require `DIFF_SCORE >= 80%`.
- **Exit Criteria**: `code_review_report.md` on disk with `DIFF_SCORE >= 80%`. If score < 80% → fix issues in Stage 3 and re-audit before advancing.
- **Output**: Print audit summary and DIFF_SCORE inline.
- **Log**: `{ "stage": "3b-audit", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["code_review_report.md"] }`
- **→ Auto-continue to Stage 4.**

---

### Stage 4: Test & DevTools QA
- **Model**: `Gemini 3.6 Flash (High)`
- **Action**: Run `node scripts/check-casper-rules.js` + `npx vitest run` + `npm run build`. Capture DevTools screenshots if UI touched. Revert on failure.
- **Exit Criteria**: All tests pass. Zero TS errors.
- **Output**: Print pass/fail counts inline.
- **Log**: `{ "stage": "4-test", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["test_results.txt"] }`
- **→ Auto-continue to Stage 5.**

---

### Stage 5: Accept & Walkthrough
- **Model**: `Gemini 3.6 Flash (Medium)`
- **Action**: Generate `walkthrough.md`. Run `graphify update .`.
- **Exit Criteria**: `walkthrough.md` on disk.
- **Output**: Print walkthrough summary inline.
- **Log**: `{ "stage": "5-accept", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["walkthrough.md"] }`

---

## ⛔ CHECKPOINT BETA — Human Gate (Required)

**Present to user:**
- Full BLOCK B summary: files modified, DIFF_SCORE, test results, walkthrough link
- Links: `task.md`, `code_review_report.md`, `test_results.txt`, `walkthrough.md`

**Then ask:** *"BLOCK B complete. All artifacts verified. Type **Proceed** for final compliance audit, or **Revert** to rollback changes."*

> Do NOT run Stage 6 until the user explicitly types "Proceed" or "✅".

---

## 🛡️ Stage 6: Pipeline Compliance Verification (Immutable Audit)

- **Action**:
  1. Read `.agents/stage_log.json` — verify `COMPLETED` entries for ALL stages: `0a`, `0b`, `1`, `2ab`, `3`, `3b`, `4`, `5`.
  2. Verify files on disk: `ironclad_review_*.md`, `task.md` (all `[x]`), `code_review_report.md`, `walkthrough.md`.
  3. Cross-reference: every stage in log must have a corresponding artifact.
- **Pass**: `✅ PIPELINE COMPLIANCE: PASSED — All stages verified via stage_log.json + filesystem.`
- **Fail**: `🚨 PIPELINE COMPLIANCE: FAILED. Missing: [exact list]. Re-run missing stage(s). Do NOT merge until resolved.`

---

## 🛠️ Command Wrapper Script

```bash
./scripts/run-ce-agent-pipeline.sh "Task description here"
```
