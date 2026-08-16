# Research Findings: DesignMD & Design System Integration for Casper Voice

## 1. Executive Summary
Integration of the DesignMD MCP server (`designmd-mcp`) with `casper-voice-web` enables automated, machine-readable design system spec enforcement via `DESIGN.md`.

## 2. Key Standards & Architectural Findings
- **`DESIGN.md` Protocol**: A plain-text markdown blueprint standardizing HSL color tokens, typography scales (Cairo/Inter), 8-pt modular spacing, and glassmorphism backdrop blurs.
- **Apple HIG vs Material 3**: Apple HIG provides 44pt+ touch bounds and sleek translucency suitable for iPad cashier docks; Material 3 provides dynamic surface roles suitable for Android POS hardware.
- **Voice State Motion**: Standardized pulsing CSS keyframes (`.voice-state-listening`, `.voice-state-processing`, `.voice-state-speaking`) ensure instant visual feedback during voice commands.
- **Low-Hardware POS Safety**: CSS `@supports not (backdrop-filter: blur(10px))` fallbacks ensure performance on budget POS terminals.

## 3. Best Practices Compliance Checklist
- [x] Zero floats in financial displays (`Decimal.js` monospace formatting).
- [x] Hardware-accelerated CSS animations (`box-shadow` & `opacity`).
- [x] Dual RTL/LTR typography symmetry (`dir="rtl"` for Arabic Cairo font).
