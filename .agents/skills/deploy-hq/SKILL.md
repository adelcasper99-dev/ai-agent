---
name: deploy-hq
description: Deploy the latest updates to the HQ Server automatically. Triggered when the user types /deploy-hq or asks to update the server.
---
# deploy-hq

This skill automates the deployment of the latest code to the Casper HQ Server.

## Instructions
When the user triggers this skill (e.g. by typing `/deploy-hq` or `حدث السيرفر`), execute the deployment script using the `run_command` tool:

`python scripts/rebuild_vps_dashboard.py`

This will automatically connect to the server via SSH (109.123.247.119), pull the latest code from `main`, push Prisma schema, seed DB, build Next.js dashboard, and restart PM2 services.
