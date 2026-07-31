# Implementation Plan: Voice Break Diagnostic & PM2 LiveKit Hardening

Fix the 100% voice-to-voice audio drop after code modifications by eliminating the LiveKit `dev` file watcher collision with PM2 and implementing graceful WebRTC shutdown handlers.

## Proposed Changes

### Root Ecosystem Configuration

#### [MODIFY] [ecosystem.config.js](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/ecosystem.config.js)
- Change `args: 'dev'` to `args: 'start'` for `casper-livekit-worker` (Line 40).

---

### Voice Service Agent

#### [MODIFY] [agent.py](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/agent.py)
- Ensure `ctx.add_shutdown_callback` cleanly unpublishes local audio tracks and flushes diagnostic sessions upon worker shutdown.
- Verify fallback audio stream cleanups to prevent hanging WebRTC audio sources.

---

### Process Maintenance & Cleanup

#### [NEW] [clean_cache.py](file:///c:/Users/TheExpert/Downloads/casper-voice-project/casper-voice-project/voice_service/clean_cache.py)
- Utility script to recursively remove `__pycache__` directories across `voice_service/`.

## Verification Plan

### Automated Verification
- Run `python -m py_compile voice_service/agent.py` to verify zero syntax/bytecode errors.
- Verify `ecosystem.config.js` syntax via `node -c ecosystem.config.js`.

### Manual Verification (Exact Reproduction Scenario)
1. **Live In-Call Hot-Edit Stress Test**:
   - Establish an active, ongoing voice call session with the assistant.
   - While the call is active and speaking, edit an unrelated file (e.g. modify a comment or button label in `casper-voice-web/app/dashboard/page.tsx` or `specs/SPEC.md`).
   - Save the file and verify that the active voice stream continues without any audio drop or WebRTC track unsubscription.
2. **Post-Deployment Session Test**:
   - Deploy via `pm2 reload ecosystem.config.js --env production`.
   - Verify clean startup without `watchfiles` or `dev` mode file watchers attached.
