import subprocess
import time
import re
import os

# Start cloudflared process
cmd = ["cloudflared.exe", "tunnel", "--url", "http://127.0.0.1:3000"]
proc = subprocess.Popen(
    cmd,
    stdout=subprocess.PIPE,
    stderr=subprocess.STDOUT,
    text=True,
    bufsize=1,
    creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
)

print("Starting Cloudflare tunnel...")
tunnel_url = None
start = time.time()

while time.time() - start < 20:
    line = proc.stdout.readline()
    if not line:
        continue
    print("LOG:", line.strip())
    match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", line)
    if match:
        tunnel_url = match.group(0)
        print("\nFOUND_TUNNEL_URL:", tunnel_url)
        with open("PUBLIC_URL.txt", "w", encoding="utf-8") as f:
            f.write(tunnel_url)
        break

if not tunnel_url:
    print("Could not parse tunnel URL in 20 seconds.")
