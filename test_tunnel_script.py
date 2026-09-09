import os
import sys
import subprocess
import time
import re
import urllib.request
import ssl

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CF_EXE = os.path.join(BASE_DIR, "cloudflared.exe")
URL_FILE = os.path.join(BASE_DIR, "PUBLIC_URL.txt")

def kill_cloudflared():
    try:
        if sys.platform == "win32":
            subprocess.run(["taskkill", "/F", "/IM", "cloudflared.exe", "/T"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except Exception:
        pass

def run():
    kill_cloudflared()
    time.sleep(1)
    
    log_file = os.path.join(BASE_DIR, "tunnel_current.log")
    if os.path.exists(log_file):
        try:
            os.remove(log_file)
        except Exception:
            pass

    cmd = [
        CF_EXE, "tunnel",
        "--protocol", "http2",
        "--no-autoupdate",
        "--url", "http://127.0.0.1:3000",
        "--logfile", log_file
    ]
    
    print("Launching cloudflared with HTTP/2 protocol...")
    proc = subprocess.Popen(cmd)
    
    url = None
    for i in range(40):
        time.sleep(0.5)
        if os.path.exists(log_file):
            try:
                with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
                    match = re.search(r"https://[-a-zA-Z0-9.]+\.trycloudflare\.com", content)
                    if match:
                        url = match.group(0)
                        break
            except Exception:
                pass

    if url:
        print(f"Extracted Tunnel URL: {url}")
        with open(URL_FILE, "w", encoding="utf-8") as f:
            f.write(url)
        print("PUBLIC_URL.txt successfully updated!")
    else:
        print("Failed to get URL within 20s")

if __name__ == "__main__":
    run()
