---
name: deploy-hq
description: >
  Automatically pushes local changes to GitHub, pulls them on HQ VPS server (109.123.247.119),
  cleans bytecode cache, runs Prisma migrations/build, and reloads PM2 in production mode.
  Triggered on: "/deploy-hq", "/deploy", "حدث السيرفر", "ارفع التحديثات".
---

# /deploy-hq — Automated VPS Deployment Skill

This skill automates the full deployment pipeline for Casper POS & Voice ERP to the HQ VPS server (`root@109.123.247.119`).

## Execution Protocol

When triggered by the user (e.g. typing `/deploy-hq`, `/deploy`, `حدث السيرفر`, or `ارفع التحديثات`):

1. Run the unified Python deployment script using the `run_command` tool:

```bash
python scripts/rebuild_vps_dashboard.py
```

2. What the script does automatically:
   - **Local Sync**: Stages local changes (`git add .`), commits them, and pushes to `origin main`.
   - **Remote Pull**: Connects via SSH (`root@109.123.247.119`) to `/root/ai-support-agent` and runs `git reset --hard HEAD && git pull origin main`.
   - **Cache Clean**: Purges `__pycache__` and `.pyc` files via `clean_cache.py`.
   - **Web & Voice Build**: Installs Python requirements, generates Prisma Client, syncs DB schema, and runs `npm run build` for Next.js 16.
   - **Production PM2 Reload**: Runs `pm2 reload ecosystem.config.js --env production` to apply voice agent and web changes without breaking WebRTC audio sessions.
   - **Health Output**: Displays PM2 process table and status.
