import os
import sys
import time
import subprocess
import re
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CF_EXE = os.path.join(BASE_DIR, "cloudflared.exe")
URL_FILE = os.path.join(BASE_DIR, "PUBLIC_URL.txt")

def download_cloudflared():
    if not os.path.exists(CF_EXE) or os.path.getsize(CF_EXE) < 1000000:
        print("[+] Downloading Cloudflare Tunnel engine...")
        url = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
        try:
            urllib.request.urlretrieve(url, CF_EXE)
            print("[+] Download completed.")
        except Exception as e:
            print(f"[!] Cloudflare download error: {e}")

def start_tunnel():
    download_cloudflared()
    
    if os.path.exists(CF_EXE):
        print("[+] Starting Cloudflare Public Tunnel for GREENOX on port 3000...")
        cmd = [CF_EXE, "tunnel", "--url", "http://127.0.0.1:3000"]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
        
        tunnel_url = None
        for line in proc.stdout:
            match = re.search(r"https://[-a-zA-Z0-9.]+\.trycloudflare\.com", line)
            if match:
                tunnel_url = match.group(0)
                print("\n" + "=" * 60)
                print("🌟 GREENOX LIVE PUBLIC ACCESS LINK (ACCESSIBLE TO ALL DEVICES):")
                print(f"👉 {tunnel_url}")
                print("=" * 60 + "\n")
                with open(URL_FILE, "w", encoding="utf-8") as f:
                    f.write(tunnel_url)
                break
        
        proc.wait()

if __name__ == "__main__":
    start_tunnel()
