# Autonomous Agent Pipeline Workflow

Use this workflow to run the 5-stage autonomous multi-agent pipeline for Casper POS & ERP tasks.

## Triggering the Pipeline
To run a task through the 5-stage pipeline, execute the runner script in your terminal:

```bash
./scripts/run-ce-agent-pipeline.sh "<task description>"
```

## Pipeline Handoff Sequence
1. **Stage 0a & 0b (Research)**: `/grill-me` initiation interview + `ce-best-practices-researcher`.
2. **Stage 1 (Ground & Spec)**: Grounding via `graphify` + `mcp-server-sqlite` + `spec-kit` (`Gemini 3.1 Pro`).
3. **Stage 2 (Review Plan)**: `ironclad-review` 2-pass adversarial critique with auto-file patching and chat token suppression (`Gemini 3.1 Pro`).
4. **Stage 3 (Build)**: `cavecrew-builder` code generation in isolated Git worktree (`Gemini 3.6 Flash`).
5. **Stage 4 (Test & Review)**: `node scripts/check-casper-rules.js` AST linter + `vitest` + DevTools screenshots (`Gemini 3.6 Flash`).
6. **Stage 5 (Accept)**: `walkthrough.md` proof generation + `git rebase main` + human merge gate (`Gemini 3.6 Flash`).

