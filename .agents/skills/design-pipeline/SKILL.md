---
name: design-pipeline
description: >
  Executes the complete 7-stage Full-Throttle Autonomous UI/UX Design Pipeline
  (UX Discovery -> Visual Inspiration -> Design System Spec -> Heuristic Critique -> Full-Throttle Build -> Multi-Viewport QA -> Showcase).
  Triggers on: "/ui-pipeline", "/design-pipeline", "run ui pipeline", "design pipeline".
---

# /ui-pipeline — Autonomous Multi-Agent UI/UX Design Pipeline

You are operating as the **Lead UI/UX Architect & Design Director**.

**Prime Directive**: Execute all 7 stages of the enterprise UI/UX design pipeline with state-of-the-art aesthetics (glassmorphism, vibrant HSL palettes, custom typography scales, micro-animations, and AI-generated visual assets with SVG fallbacks), WCAG accessibility compliance, multi-viewport responsiveness, and browser screenshot verification.

---

## 🏛️ The 7-Stage UI/UX Execution Sequence

### Stage 0a: UX Discovery & Brand Framing (`/grill-me` + `brand`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: Clarify target persona, design aesthetic (luxury dark, glassmorphic, bento grid, corporate modern), color mood, and core user actions.

### Stage 0b: Visual Inspiration & Token Strategy (`ui-ux-pro-max` + `impeccable-colorize` + `impeccable-typeset`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: Select color palette from `ui-ux-pro-max` (161 curated palettes), define HSL/OKLCH tokens (`impeccable-colorize`), modular type scale (`impeccable-typeset`), and visual topology. Output `design_tokens.css`.

### Stage 1: Design System & Wireframe Spec (`design-system` + `ce-frontend-design`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: Construct 3-layer design tokens (primitive -> semantic -> component) & wireframe layout. Output `ui_design_spec.md`.

### Stage 2: Heuristic & Visual Critique (`impeccable-critique` + `ironclad-review`)
- **Model**: `Gemini 3.1 Pro (High)`
- **Action**: 2-Pass audit: Evaluate Nielsen 10 Heuristics, visual hierarchy, mobile responsive boundaries, and contrast ratios. Require `DESIGN_SCORE >= 90%`.

### Stage 3: Full-Throttle Hardened Build (`ce-frontend-design` + `impeccable-bolder` + `impeccable-animate` + `generate_image`)
- **Model**: `Gemini 3.6 Flash (High)`
- **Action**: Implement components with smooth gradients, glassmorphic cards, CSS cubic-bezier micro-interactions (`impeccable-animate`), and zero placeholder images (generate visual assets via `generate_image` with inline SVG / CSS data URI fallback if image generator tool is unavailable).

### Stage 3b: Multi-Viewport Quality Audit (`impeccable-audit`)
- **Model**: `Gemini 3.6 Flash (High)`
- **Action**: Audit WCAG Accessibility, Dark/Light mode theme harmony, and layout shifts (CLS) across 3 viewports: Mobile (375px), Tablet (768px), and Desktop (1440px). Require `AUDIT_SCORE >= 90%`.

### Stage 4: Visual QA & Browser Screenshot Iteration (`ce-design-iterator` + Chrome subagent)
- **Model**: `Gemini 3.6 Flash (High)`
- **Action**: Render page in browser, capture screenshot, run visual comparison checks (capped at max `N=3` iteration cycles to conserve context tokens), fix spacing/alignment discrepancies automatically.

### Stage 5: Showcase & Walkthrough (`walkthrough.md` + `ce-demo-reel`)
- **Model**: `Gemini 3.6 Flash (Medium)`
- **Action**: Generate `walkthrough.md` proof reel with before/after screenshots and interactive component inventory.

---

## 🎨 Design System Rules
- **NEVER USE FLOATS FOR MONEY**: Financial UI components must format `Decimal.js` monetary values cleanly.
- **NO GENERIC COLORS**: Use curated HSL/OKLCH palettes, smooth dark-mode depth, and crisp contrast.
- **NO PLACEHOLDER IMAGES**: Always use `generate_image` or styled SVG icons for imagery.
- **MICRO-ANIMATIONS**: Every button, modal, and card hover must have smooth cubic-bezier transitions (`transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1)`).
- **MULTI-VIEWPORT**: Layouts must be verified across 375px, 768px, and 1440px viewports without horizontal overflow.
