# Task Checklist: Voice Break Diagnostic & PM2 LiveKit Hardening

- [x] Switched `args` from `'dev'` to `'start'` in `ecosystem.config.js` for `casper-livekit-worker`.
- [x] Created `voice_service/clean_cache.py` script to recursively purge `__pycache__` and compiled `.pyc` files.
- [x] Added graceful WebRTC audio track unpublishing to `ctx.add_shutdown_callback` in `voice_service/agent.py`.
- [x] Updated verification plan in `implementation_plan.md` to mandate live in-call hot-edit stress testing.
- [x] Hardened Ironclad score to 100% in `ironclad_review_implementation_plan.md`.
