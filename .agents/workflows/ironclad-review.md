---
name: ironclad-review
description: >
  Pre-execution plan critic. Acts as Lead System Architect & Senior PM to stress-test any
  implementation plan: scores success probability (0–100%), surfaces critical gaps and edge cases,
  validates workflows, automatically updates target plan files on disk, and delivers a hardened
  revised plan ready for coding. Use before executing any feature plan, migration, or architectural change.
---

Read and follow `.agents/skills/ironclad-review/SKILL.md` exactly.

If the user has not already provided a plan in their message or referenced a plan file, ask:
> "Paste the implementation plan or provide the plan file path you want stress-tested."

Execute the full ironclad review protocol as defined in SKILL.md:
1. Detect plan domain and adapt output sections.
2. Clamp score calculation between 0% and 100%.
3. **If plan is from a file**: Automatically edit/update the target plan file on disk with findings/mitigations and suppress full plan text from chat output.
4. Conclude with execution handoff options.
