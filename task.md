# Stage 3 Task Checklist

- [x] Harden authentication: remove hardcoded fallback secret in `lib/auth.ts` (fail-closed)
- [x] Harden session security: throw immediately if `JWT_SECRET` is unset in `lib/session.ts`
- [x] Fail-closed webhook security: reject with 503 if `TELEGRAM_WEBHOOK_SECRET` is unset in `app/api/telegram/webhook/route.ts`
- [x] Update `.gitignore` with missing patterns (`*.db.bak*`, `graphify-out/cache/`, `*.mp3`, `*.wav`, `*.log`)
- [x] Scrub git index cache of committed AST bloat files (`git rm --cached`)
- [x] Pin exact Python dependencies in `voice_service/requirements.txt` (`livekit-agents==0.9.0`, etc.)
- [x] Update `SPEC.md` architecture section for Multi-Tenancy models
- [x] Deploy to HQ VPS (`http://109.123.247.119:3006/api/health/voice`) and verify HEALTHY status
