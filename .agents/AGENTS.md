<RULE>
# Caveman Mode Permanent Activation
Always respond using "caveman mode" (full intensity). You must follow the instructions in `.agents/skills/caveman/SKILL.md` for every response, without requiring the user to explicitly request it.
</RULE>

<RULE>
# Ponytail Mode Permanent Activation
Always respond using "ponytail mode" (full intensity). You must follow the instructions in `.agents/skills/ponytail/SKILL.md` for every response, without requiring the user to explicitly request it.
</RULE>

<RULE>
# Permanent Global Token Conservation & Subagent Compression Protocol
1. **Zero Fluff / Zero Boilerplate**: All responses, subagents, and skills must operate in full Caveman + Ponytail mode. Never output pleasantries, conversational intro/outro, or repeated explanations.
2. **Compressed Subagent Tool Results**: Every subagent invocation (`cavecrew`, `ce-plan`, `ce-code-review`, `ironclad-review`, etc.) MUST return output strictly using the `cavecrew` output contract (`path:line:severity`, <=10 word notes).
3. **Black-Box Script Execution**: Never read large scripts or schemas line-by-line into prompt tokens. Always invoke them as CLI black-box execution commands (e.g. `node scripts/check-casper-rules.js`).
4. **Repo-Relative Compact Paths**: All plan files and code references MUST use repo-relative paths (`src/lib/...`), never absolute paths.
</RULE>

<RULE>
# Mem0 Dedicated Memory Engine Permanent Activation
At the start of EVERY session and before performing any architectural decisions, research, or major code changes:
1. **Auto-Load Mem0 Memory Store**: Read `C:\Users\TheExpert\.gemini\antigravity-ide\mem0_store.json` (or run `python scripts/mem0_engine.py list`).
2. **Enforce Stored Rules & Context**: Strictly enforce all stored architecture decisions, financial rules, JWT keys, and user preferences found in Mem0 across all tasks.
3. **Auto-Persist Learnings**: Whenever new user preferences, architectural rules, or bug resolutions are agreed upon, immediately persist them to Mem0 using `python scripts/mem0_engine.py add "<content>" "<category>" "<tags>"`.
</RULE>

<RULE>
# Permanent Graphify & Spec-Kit Mandatory Execution Protocol
1. **Always Ground with Graphify**: Before making architectural decisions, research, or modifying code, query `graphify` (`graphify query "<concept>"`) or search the graph index.
2. **Always Use Spec-Kit Specs**: Every new feature or architectural phase MUST maintain an active specification document in `specs/` formatted per `spec-kit` standards.
3. **Always Run Graphify Update**: After code changes in any session, execute `graphify update .` to keep the knowledge graph synchronized.
</RULE>

<RULE>
# Tabular Communication & Strategic Insight Rule
In addition to Caveman and Ponytail modes, structure your responses to be precise, on-point, and highly scannable using tables whenever evaluating plans, proposing solutions, or analyzing code. 
Every significant analysis MUST include:
1. **Summary Table**: Core findings or steps for easy reading.
2. **Benefits**: Why this approach works.
3. **Risks**: Potential failure points or trade-offs.
4. **Recommendations**: Your clear, expert opinion on the best path forward.
</RULE>

<RULE>
# Context Degradation & Hallucination Protocol
If the chat history becomes too long and context begins to degrade (e.g. losing track of previously established facts, repeating mistakes, or struggling to recall architectural constraints), you MUST immediately stop execution and instruct the user: 
"⚠️ **Context Limit Reached:** I am starting to hallucinate due to token limits. Please start a new chat session to restore peak performance."
</RULE>

<RULE>
# Permanent Artifact Link Display & Graphify Sync Rule
Whenever an engineering pipeline or plan is executed:
1. **Explicit Artifact Links**: Automatically render direct clickable markdown file links for `implementation_plan.md`, `walkthrough.md`, `requirements_gap_matrix.md`, and `agent_workflow_architecture.md`.
2. **Mandatory Graphify Sync**: ALWAYS run `graphify update .` after code modifications to maintain a 100% synchronized AST knowledge graph.
3. **Zero-Hallucination Guard**: Enforce 0ms `verifyResponseGrounding` checks on all AI response pipelines to prevent unverified prices or false technical steps.
</RULE>

<RULE>
# Mandatory Question-First & Recommended Options Protocol
Whenever the user asks a question or presents a problem:
1. **Answer First**: Provide a clear, structured explanation first.
2. **Present Options with (Recommended)**: Present the available options with your explicit recommendation marked as `(Recommended)`.
3. **Do NOT Auto-Edit Code**: NEVER jump to modifying, editing, or fixing code immediately before presenting options and waiting for explicit user approval.
</RULE>

<RULE>
# Mandatory Memory & Graphify First Discovery Protocol
In every new chat session or when investigating any question/problem:
1. **Check Mem0 First**: Read `mem0_store.json` (or `python scripts/mem0_engine.py list`) for active architecture rules and user preferences.
2. **Query Graphify First**: NEVER scan or read raw source code files in bulk. Always run `graphify query "<concept>"` or search `graphify-out/` index to pinpoint exact files & line numbers.
3. **Targeted Reading Only**: View ONLY the specific target files returned by Graphify.
</RULE>

<RULE>
# Permanent Anti-Skip & Pipeline Compliance Protocol

**PRIORITY OVERRIDE:** This rule OVERRIDES the "Token Conservation" rule during any `/pipeline` or `/casper-pipeline` execution. Token conservation applies BETWEEN pipeline sessions, NOT during them.

1. **Mandatory Stage Halting**: After completing each Pipeline stage, you MUST stop, output the full stage results, and explicitly ask the user for a "Proceed" or "✅" confirmation before starting the next stage. This is NON-NEGOTIABLE and cannot be skipped for any reason including token efficiency.
2. **No Batch Execution**: NEVER read the full SKILL.md stage list and execute them as a single batch. Each stage is an isolated unit requiring explicit user approval to advance.
3. **stage_log.json Audit Trail**: At the START of every stage, append to `.agents/stage_log.json`:
   `{ "stage": "<name>", "status": "STARTED", "timestamp": "<ISO>" }`
   At the END of every stage, append:
   `{ "stage": "<name>", "status": "COMPLETED", "timestamp": "<ISO>", "artifacts": ["<file>"] }`
4. **Stage 6 Compliance Verification (Artifact-Based)**: Upon completing Stage 5, execute Stage 6 which checks BOTH the filesystem AND `stage_log.json`. If any required artifact is missing or any stage has no COMPLETED entry in the log, mark the pipeline as `FAILED_COMPLIANCE`:
   - `ironclad_review_*.md` → proves Stage 2 Ironclad ran
   - `task.md` with ALL items `[x]` → proves Stage 3 Build completed
   - `walkthrough.md` → proves Stage 5 Accept ran
   - `stage_log.json` with COMPLETED entries for ALL stages
</RULE>

<RULE>
# Permanent Context Condense & Session Persistence Activation
At the start of EVERY new session in this workspace:
1. **Auto-Load Condense State First**: Always read `.antigravity/condense-state.yaml` FIRST before any other tool (`mem0`, `graphify`, viewing docs).
2. **Output Verbatim Proof Line**: Output this exact line, verbatim, as its own line before anything else in your first response:
   `loaded prior session state — last condensed at [timestamp], [N] decisions, [N] open next_steps`
3. **Strict Single Source of Truth**: Treat `.antigravity/condense-state.yaml` as the absolute single source of truth for prior session facts.
4. **Flag Conflicts, Don't Merge**: If any other source (mem0, graphify, docs) reports a fact that conflicts with condense-state.yaml (e.g. a different test count), explicitly flag the discrepancy to the user — never silently blend or override the state file's number.
5. **Auto-Trigger Condense**: Run `/context-condense` automatically, without waiting to be asked, once the session exceeds 25 turns OR ~150k tokens (~75% of a 200k window) — whichever comes first.
6. **Measure Every Condense**: Every condense pass must record `tokens_before`, `tokens_after`, and `reduction_pct` into `last_condense` inside the state file. If `reduction_pct` < 60%, the pass didn't cut deep enough — repeat it before accepting the result.
</RULE>
