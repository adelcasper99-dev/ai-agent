# /pipeline Workflow

Use this workflow to trigger the complete 7-stage autonomous multi-agent engineering pipeline for Casper POS & ERP.

## Slash Command Usage

Type `/pipeline <task description>` or `/casper-pipeline <task description>` in the chat window.

Example:
```text
/pipeline Add dynamic bundle stock deduction
```

## What it does:
1. **Stage 0a**: Grill-Me Initiation Interview (`/grill-me`).
2. **Stage 0b**: Best-Practice Research (`ce-best-practices-researcher`).
3. **Stage 1**: Grounding & Spec (`spec-kit` + SQLite MCP).
4. **Stage 2a & 2b**: 2-Pass Ironclad Review (`VERIFICATION_SCORE >= 95%`).
5. **Stage 3**: Build (`cavecrew-builder`).
6. **Stage 3b**: Code Audit & Peer Review (`DIFF_SCORE >= 80%`).
7. **Stage 4**: Test & QA (`check-casper-rules.js` + Vitest + Chrome DevTools Screenshots).
8. **Stage 5**: Accept & Walkthrough (`walkthrough.md` + Merge Gate).
