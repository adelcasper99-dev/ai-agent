import secrets
import subprocess
import sys

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

VPS_HOST = "root@109.123.247.119"

def run_ssh(cmd):
    full_cmd = ["ssh", "-o", "BatchMode=yes", "-o", "StrictHostKeyChecking=no", VPS_HOST, cmd]
    print(f"[SSH EXEC] {cmd}")
    res = subprocess.run(full_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if res.stdout:
        print(res.stdout.strip())
    if res.stderr:
        print(f"[SSH STDERR] {res.stderr.strip()}")
    return res

def main():
    jwt_secret = secrets.token_hex(32)
    internal_secret = secrets.token_hex(32)
    
    print(f"Generated new JWT_SECRET: {jwt_secret[:8]}...")
    print(f"Generated new INTERNAL_SERVICE_SECRET: {internal_secret[:8]}...")
    
    # 1. Update casper-voice-web/.env
    cmd_web = f"""
    cd /root/ai-support-agent/casper-voice-web
    sed -i 's/^JWT_SECRET=.*/JWT_SECRET={jwt_secret}/' .env || echo "JWT_SECRET={jwt_secret}" >> .env
    sed -i 's/^INTERNAL_SERVICE_SECRET=.*/INTERNAL_SERVICE_SECRET={internal_secret}/' .env || echo "INTERNAL_SERVICE_SECRET={internal_secret}" >> .env
    grep -E "JWT_SECRET|INTERNAL_SERVICE_SECRET" .env
    """
    print("\n--- Updating Web Service .env ---")
    run_ssh(cmd_web.strip())

    # 2. Update voice_service/.env if exists
    cmd_voice = f"""
    cd /root/ai-support-agent/voice_service
    if [ -f .env ]; then
        sed -i 's/^INTERNAL_SERVICE_SECRET=.*/INTERNAL_SERVICE_SECRET={internal_secret}/' .env || echo "INTERNAL_SERVICE_SECRET={internal_secret}" >> .env
        grep -E "INTERNAL_SERVICE_SECRET" .env
    fi
    """
    print("\n--- Updating Voice Service .env ---")
    run_ssh(cmd_voice.strip())

    # 3. Reload PM2
    print("\n--- Reloading PM2 ---")
    run_ssh("cd /root/ai-support-agent && pm2 reload ecosystem.config.js --env production || pm2 restart all")
    run_ssh("pm2 status")

if __name__ == "__main__":
    main()
