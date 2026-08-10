import subprocess

cmd = "cd /root/ai-support-agent/casper-voice-web && SECRET=$(grep INTERNAL_SERVICE_SECRET .env | cut -d= -f2) && curl -s -H \"x-internal-secret: $SECRET\" http://localhost:3006/api/health/voice"

res = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
