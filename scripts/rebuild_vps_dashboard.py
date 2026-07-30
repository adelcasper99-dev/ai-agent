import subprocess
import sys

VPS_HOST = "root@109.123.247.119"
REMOTE_DIR = "/root/ai-support-agent"

def run_remote(cmd):
    full_cmd = ["ssh", "-o", "StrictHostKeyChecking=no", VPS_HOST, f"cd {REMOTE_DIR} && {cmd}"]
    print(f"Executing remote: {cmd}")
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding="utf-8", errors="ignore")
    stdout_clean = res.stdout.encode("ascii", errors="replace").decode("ascii")
    print(stdout_clean)
    if res.stderr:
        stderr_clean = res.stderr.encode("ascii", errors="replace").decode("ascii")
        print(f"STDERR: {stderr_clean}")
    if res.returncode != 0:
        print(f"Command failed with exit code {res.returncode}")
        sys.exit(res.returncode)

def main():
    print("[HQ DEPLOY] Starting HQ VPS Deployment...")
    run_remote("git reset --hard HEAD")
    run_remote("git pull origin main")
    run_remote("cd voice_service && python3 -m venv venv && ./venv/bin/pip install -r requirements.txt")
    run_remote("cd casper-voice-web && npm install && npx prisma generate && npx prisma db push && npm run build")
    run_remote("pm2 restart ecosystem.config.js || pm2 start ecosystem.config.js")
    run_remote("pm2 status")
    print("[HQ DEPLOY] Deployment complete successfully!")

if __name__ == "__main__":
    main()
