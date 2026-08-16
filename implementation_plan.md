# Implementation Plan: DesignMD MCP & Casper Voice Design System

## Executive Summary
Integrate DesignMD MCP server configuration and Casper Voice design specification to enforce consistent typography, HSL color tokens, 8-pt spacing grids, voice state animations, and low-hardware glassmorphism fallbacks across `casper-voice-web`.

## Proposed Changes

### Workspace Root
#### [NEW] [`.mcp.json`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/.mcp.json)
- Configures `designmd-mcp` stdio server via `npx -y designmd-mcp`.

#### [NEW] [`.vscode/mcp.json`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/.vscode/mcp.json)
- Configures IDE workspace MCP server binding for DesignMD.

### `casper-voice-web`
#### [NEW] [`casper-voice-web/DESIGN.md`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/DESIGN.md)
- Machine-readable specification detailing HSL colors, Cairo/Inter typography, 8-pt spacing, voice states, and 48px touch rules.

#### [MODIFY] [`casper-voice-web/app/design_tokens.css`](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/casper-voice-web/app/design_tokens.css)
- Added 8-pt spacing variables (`--space-xs` to `--space-touch-min`), voice state glow tokens, `.glass-dock`, `.glass-card-lg` utility classes, and `@supports not (backdrop-filter: blur(10px))` fallbacks.

## Verification Plan
1. Validate CSS syntax and build compatibility via `npx tsc --noEmit`.
2. Confirm `.mcp.json` JSON structure.
3. Perform audit of design tokens and accessibility guidelines.
