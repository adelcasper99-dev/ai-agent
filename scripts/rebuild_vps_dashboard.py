import os
import sys
import subprocess
import datetime

# Enforce UTF-8 output encoding for Windows console
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "root@109.123.247.119"
REMOTE_DIR = "/root/ai-support-agent"

def run_local(cmd):
    print(f"[LOCAL EXEC] {cmd}")
    res = subprocess.run(cmd, shell=True, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.stdout and res.stdout.strip():
        print(res.stdout.strip())
    if res.stderr and res.stderr.strip():
        print(f"[LOCAL STDERR] {res.stderr.strip()}")
    if res.returncode != 0:
        print(f"[LOCAL WARNING] Command exit code {res.returncode}")
    return res

def run_remote(cmd):
    full_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", VPS_HOST, f"cd {REMOTE_DIR} && {cmd}"]
    print(f"[REMOTE EXEC] {cmd}")
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.stdout and res.stdout.strip():
        print(res.stdout.strip())
    if res.stderr and res.stderr.strip():
        print(f"[REMOTE STDERR] {res.stderr.strip()}")
    if res.returncode != 0:
        print(f"[REMOTE ERROR] Command failed with exit code {res.returncode}")
        sys.exit(res.returncode)
    return res

def main():
    print("==================================================")
    print("AUTOMATED FULL-STACK VPS DEPLOYMENT PIPELINE")
    print(f"Timestamp: {datetime.datetime.now().isoformat()}")
    print("==================================================")

    # Step 1: Local Git Commit & Push
    print("\nSTEP 1: Syncing Local Changes to GitHub...")
    status_res = run_local("git status --porcelain")
    if status_res.stdout and status_res.stdout.strip():
        commit_msg = f"Auto-deploy update: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        print(f"Staging uncommitted changes and committing with: '{commit_msg}'")
        run_local("git add .")
        run_local(f'git commit -m "{commit_msg}"')

    push_res = run_local("git push origin main")
    if push_res.returncode != 0:
        print("Warning: git push had non-zero exit code. Attempting remote pull anyway...")

    # Step 2: Remote Pull & Clean Bytecode
    print("\nSTEP 2: Remote Pull & Bytecode Purge on VPS...")
    run_remote("git reset --hard HEAD")
    run_remote("git pull origin main")
    run_remote("python3 voice_service/clean_cache.py voice_service || true")

    # Step 3: Dependencies & Prisma Build
    print("\nSTEP 3: Dependencies & Next.js Build...")
    run_remote("cd voice_service && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt")
    run_remote("cd casper-voice-web && npm install && npx prisma generate && npx prisma db push && npm run build")

    # Step 4: PM2 Production Reload
    print("\nSTEP 4: PM2 Production Server Reload...")
    run_remote("pm2 reload ecosystem.config.js --env production || pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js")
    run_remote("pm2 status")

    print("\n==================================================")
    print("DEPLOYMENT COMPLETE SUCCESSFULLY TO HQ VPS!")
    print("==================================================")

if __name__ == "__main__":
    main()
