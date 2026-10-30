"""Run the hosted site with its /api/ on this computer, the way Cloudflare Pages runs it (wrangler pages dev).

    cd tools/dev && npm install          once: gets wrangler (Cloudflare's tool) into tools/dev/node_modules
    python3 tools/dev/serve.py           http://localhost:8788, with an empty local database
    python3 tools/dev/serve.py --seeded  the sample roster's page (build/site-seeded) instead of site/
    python3 tools/dev/serve.py --d1-pics pictures kept in the database instead of the local R2 bucket

The local database and bucket live in build/dev-state/ (delete it to start over). Secrets here are throwaway values;
Discord and Google sign-in go to a stand-in (tests/api/oauth_mock.py) only when --mock-oauth is given.
"""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def command(port=8788, seeded=False, d1_pics=False, mock_oauth=None, state=None):
    exe = os.path.join(ROOT, "tools", "dev", "node_modules", ".bin", "wrangler")
    if not os.path.exists(exe): exe = os.environ.get("WRANGLER") or "wrangler"
    site = os.path.join(ROOT, "build", "site-seeded") if seeded else os.path.join(ROOT, "site")
    cmd = [exe, "pages", "dev", site, "--port", str(port), "--ip", "127.0.0.1", "--d1", "DB=fgi",
           "--persist-to", state or os.path.join(ROOT, "build", "dev-state"), "--compatibility-date", "2026-09-01",
           "--binding", "PEPPER=local-dev-pepper-not-secret"]
    if not d1_pics: cmd += ["--r2", "PICS=fgi-pics"]
    if mock_oauth:
        cmd += ["--binding", "DISCORD_CLIENT_ID=dev-discord", "--binding", "DISCORD_CLIENT_SECRET=dev-discord-secret",
                "--binding", "GOOGLE_CLIENT_ID=dev-google", "--binding", "GOOGLE_CLIENT_SECRET=dev-google-secret", "--binding", "OAUTH_MOCK=" + mock_oauth]
    return cmd

if __name__ == "__main__":
    a = sys.argv[1:]
    mock = a[a.index("--mock-oauth") + 1] if "--mock-oauth" in a else None
    env = dict(os.environ, WRANGLER_SEND_METRICS="false")
    sys.exit(subprocess.call(command(seeded="--seeded" in a, d1_pics="--d1-pics" in a, mock_oauth=mock), cwd=ROOT, env=env))
