# DESIGN.md - Casper Voice & POS Design System Specification

## 1. System Overview & Philosophy
**Casper Voice** is a high-volume, voice-first Point of Sale (POS) and ERP system built with a **Royal Obsidian Dark Mode** aesthetic. The design system prioritizes high-contrast visibility on cashier terminals, instant visual feedback for voice commands, bilingual (Arabic RTL & English LTR) layout symmetry, and fast touch interactions.

---

## 2. Color Palette & HSL Tokens

### Base & Backgrounds
- Base Background: `hsl(240, 10%, 4%)` (`#09090b`)
- Card Background: `rgba(22, 22, 24, 0.85)`
- Card Border: `#27272a` (`zinc-800`)
- Card Hover Border: `#3f3f46` (`zinc-700`)

### Brand & Status Colors
- Primary Accent (Royal Blue): `hsl(217, 91%, 60%)` (`#2563eb`)
- Accent Hover: `#1d4ed8`
- Voice Active / Success (Emerald): `hsl(158, 64%, 52%)` (`#10b981`)
- Warning / Alert (Amber): `hsl(38, 92%, 50%)` (`#f59e0b`)
- Error / Reversal (Crimson): `hsl(0, 84%, 60%)` (`#ef4444`)

---

## 3. Typography & Dual-Language Scale

### Font Families
- Primary / Arabic: `'Cairo', 'Inter', system-ui, sans-serif`
- Code / Monospace: `'JetBrains Mono', 'Fira Code', monospace`

### Modular Scale
- `display-lg`: `2.25rem` (36px) | weight: 700 | line-height: 1.2
- `heading-md`: `1.5rem` (24px) | weight: 600 | line-height: 1.3
- `body-lg`: `1.125rem` (18px) | weight: 500 | line-height: 1.5
- `body-md`: `1rem` (16px) | weight: 400 | line-height: 1.5
- `caption`: `0.875rem` (14px) | weight: 400 | line-height: 1.4

---

## 4. Voice UI States & Animations

### Microphone States & Glow Tokens
1. **Idle**: Opacity 0.6, border `#27272a`
2. **Listening**: Emerald Pulse (`box-shadow: 0 0 20px rgba(16, 185, 129, 0.4)`), infinite pulse keyframe (1.5s).
3. **Processing**: Royal Blue Radar Wave (`box-shadow: 0 0 25px rgba(37, 99, 235, 0.5)`), spin/wave keyframe.
4. **Speaking**: Amber Pulse (`box-shadow: 0 0 20px rgba(245, 158, 11, 0.4)`).

---

## 5. POS Component & Layout Guidelines

### Touch Targets & Ergo-Grid
- Minimum Touch Target: `48px x 48px`
- Bento Card Border Radius: `1.25rem` (20px)
- Padding Density: Compact for item grids (`8px–12px`), spacious for bento cards (`20px–24px`).
- Monospaced Financial Display: All currency amounts, totals, and invoice IDs must use `var(--font-code)` with strict `Decimal.js` precision formatting.

### RTL / LTR Direction Rules
- Default Direction: `dir="rtl"` for Arabic interface.
- Action Buttons & Floating Voice Dock: Positioned at bottom center / bottom start for single-hand cashier accessibility.
