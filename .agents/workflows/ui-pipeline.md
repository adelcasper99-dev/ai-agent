---
name: ui-pipeline
description: >
  Full-Throttle Autonomous UI/UX Design Pipeline. Combines ui-ux-pro-max, impeccable design suite,
  ce-frontend-design, generate_image (with SVG fallback), multi-viewport audits, and browser screenshot visual QA to ship state-of-the-art web/mobile interfaces.
---

Read and follow `.agents/skills/design-pipeline/SKILL.md` exactly.

If no prompt or target component is provided, ask:
> "Describe the UI component, page, or dashboard you want to design with the Full-Throttle Design Pipeline."

Then execute the 7-stage sequence:
1. **Stage 0a (UX Discovery)**: `/grill-me` + `brand`
2. **Stage 0b (Visual Inspiration)**: `ui-ux-pro-max` + `impeccable-colorize` + `typeset`
3. **Stage 1 (Design System Spec)**: `design-system` + `ce-frontend-design`
4. **Stage 2 (Heuristic Critique)**: `impeccable-critique` (`DESIGN_SCORE >= 90%`)
5. **Stage 3 (Full-Throttle Build)**: `impeccable-bolder` + `impeccable-animate` + `generate_image` (with inline SVG fallback)
6. **Stage 3b (Multi-Viewport Audit)**: `impeccable-audit` (WCAG + 375px/768px/1440px breakpoints)
7. **Stage 4 (Visual QA & Screenshot Iteration)**: `ce-design-iterator` + Chrome subagent (max `N=3` cycles)
8. **Stage 5 (Showcase & Walkthrough)**: `walkthrough.md` proof reel
