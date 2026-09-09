import subprocess
import os
import sys

with open("cf_run_out.txt", "w") as f:
    try:
        proc = subprocess.run(
            [os.path.abspath("cloudflared.exe"), "--version"],
            stdout=f,
            stderr=subprocess.STDOUT,
            timeout=5
        )
    except Exception as e:
        f.write(str(e))
