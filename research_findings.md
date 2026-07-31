# 🔬 External Best-Practice Research: LiveKit Agent SDK & PM2 Deployment

## 1. Executive Summary
This document establishes industry best practices for running Python LiveKit Agents (`livekit-agents` SDK) in production using PM2 process management, specifically resolving WebRTC Audio Track drops during application reloads or code modifications.

## 2. Key Findings & Architecture Standards

### A. LiveKit CLI Mode (`start` vs `dev`)
- **`dev` mode (`python agent.py dev`)**: Designed strictly for local interactive development without process supervisors. Spawns `watchfiles` / `watchgod` file watchers. Upon ANY file change, it abruptly terminates the asyncio event loop and worker process.
- **WebRTC Impact**: In `dev` mode, terminating the process mid-session abruptly disconnects the WebRTC peer connection without signaling track unpublish to LiveKit Cloud. The web client remains in the room, but audio publishing fails silently.
- **`start` mode (`python agent.py start`)**: Production mode. Operates as a stateless worker waiting for LiveKit Cloud job assignments. Must be managed exclusively by an external process supervisor (PM2 or Systemd).

### B. PM2 Integration Standards
- Set `args: 'start'` in `ecosystem.config.js`.
- Set `autorestart: true`, `max_restarts: 50`, `restart_delay: 2000`.
- Disable `watch` inside PM2 (`watch: false`) to prevent double-watching collisions.

### C. Graceful WebRTC Track Cleanup
- Implement `ctx.add_shutdown_callback()` in `agent.py` to unpublish audio tracks and close WebSocket connections cleanly before process exit.
- Purge `__pycache__` artifacts prior to PM2 restarts to eliminate stale Python bytecode loading.

## 3. Best Practice Checklist
- [x] Use `python agent.py start` under PM2 supervision.
- [x] Implement graceful `add_shutdown_callback` for WebRTC peer connection cleanup.
- [x] Standardize environment variable loading (`PYTHONUNBUFFERED=1`).
