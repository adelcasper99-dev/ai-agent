import subprocess

cmd = "head -n 10 /root/ai-support-agent/casper-voice-web/middleware.ts"
res = subprocess.run(['ssh', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=no', 'root@109.123.247.119', cmd], capture_output=True, text=True)
print("REMOTE MIDDLEWARE.TS:\n", res.stdout)
