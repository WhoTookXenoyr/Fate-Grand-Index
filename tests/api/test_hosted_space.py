"""0.56.1: a ceiling for the whole site's database (server/space.js, from the daily security check, 26 Nov 2026), in a
local copy of Cloudflare (tests/api/hosted.py) with pictures kept in the database, DB_MAX_MB=2 (new things stop at 80%,
1.6 MB) and the database D1 reports (meta.size_after).

- Pictures fill it up to the ceiling; then new pictures, growing rosters and new accounts are refused (507 server_full),
  in words about the server's storage. Signing in still works, and so does a push that makes a roster smaller.
- The owner sees how full it is in /api/me (server.used/limit/stopsAt/full); nobody else does.
- Deleting pictures makes room again even though the file stays as big (SQLite reuses the freed space).
- Without R2, an account's picture space is 25 MB; an account can send 100 pictures an hour (429 after).

    python3 tests/api/test_hosted_space.py
"""
import os, sys, shutil, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hosted
from test_api import Client, key_of

fails = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label, flush=True)
    if not ok: fails.append(label)
PW = "correct horse battery"
MB = 1048576
PNG = b"\x89PNG\r\n\x1a\n"
def pic(n, seed):
    # incompressible bytes, so the database grows by about n
    import hashlib
    out, h = bytearray(PNG), hashlib.sha256(seed.encode()).digest()
    while len(out) < n: h = hashlib.sha256(h).digest(); out += h
    return bytes(out[:n])
def account(base, name):
    c = Client(base); email = name.lower() + "@example.test"
    s, r, _ = c.post("/api/auth/signup", {"name": name, "email": email, "key": key_of(email, PW)})
    return c, s, r
def put(c, id, n): return c.call("PUT", "/api/pics/" + id, raw=pic(n, id), ctype="image/png")

def fill(base):
    A, s, r = account(base, "Filler")
    check(f"an account ({s})", s == 200)
    code = r["user"]["code"]
    check("without R2, an account's picture space is 25 MB", A.get("/api/pics")[1]["quota"] == 25 * MB)
    s, r, _ = A.post("/api/sync", {"changes": [{"col": "servants", "id": "s1", "data": {"name": "Mash", "notes": "x" * 4000}}]})
    check(f"a roster entry, before it fills up ({s})", s == 200)
    # big pictures until the ceiling, then smaller ones, so the database ends up right at it
    got, last = [], None
    for size in (300000, 60000, 8000, 1500):
        for i in range(40):
            id = "img_f%d%02d" % (size // 1000, i)
            s, r, _ = put(A, id, size)
            if s == 200: got.append(id); continue
            last = (s, r); break
    check(f"pictures went up until the database neared its ceiling ({len(got)} pictures)", len(got) >= 4 and last and last[0] == 507)
    check(f"then: 507 server_full, in words about the server's storage ({last[1].get('error') if last else None}: {last[1].get('message', '')[:60] if last else ''!r})",
          last and last[1].get("error") == "server_full" and "storage is nearly full" in last[1].get("message", ""))
    s, r = put(A, "img_more1", 1500)[:2]
    check(f"another picture: refused too ({s})", s == 507 and r.get("error") == "server_full")
    s, r, _ = A.post("/api/sync", {"changes": [{"col": "servants", "id": "s2", "data": {"name": "Altria", "notes": "x" * 9000}}]})
    check(f"a roster that would grow: refused, its changes stay on the device ({s}, {r.get('error')})", s == 507 and r.get("error") == "server_full" and "stay on this device" in r.get("message", ""))
    B, s, r = account(base, "Latecomer")
    check(f"a new account: refused ({s}, {r.get('error') if isinstance(r, dict) else r})", s == 507 and r.get("error") == "server_full")
    L = Client(base)
    s, r, _ = L.post("/api/auth/login", {"email": "filler@example.test", "key": key_of("filler@example.test", PW)})
    check(f"signing in still works ({s})", s == 200)
    s, r, _ = L.post("/api/sync", {"changes": [{"col": "servants", "id": "s1", "data": None}]})
    check(f"and a push that makes the roster smaller goes through ({s})", s == 200)
    me = L.get("/api/me")[1]["user"]
    check("someone who isn't the owner doesn't see how full the database is", me.get("server") is None)
    return code, got

def owner(base, got):
    O = Client(base)
    s, r, _ = O.post("/api/auth/login", {"email": "filler@example.test", "key": key_of("filler@example.test", PW)})
    f = r["user"].get("server") or {}
    check(f"the owner sees it ({ {k: f.get(k) for k in ('used', 'limit', 'stopsAt', 'full')} })",
          f.get("limit") == 2 * MB and f.get("stopsAt") == round(2 * MB * 0.8) and f.get("used", 0) > 0 and f.get("full") is True)
    # deleting makes room, though the file stays as big
    for id in got: O.call("DELETE", "/api/pics/" + id)
    s, r = put(O, "img_after1", 300000)[:2]
    check(f"after deleting the pictures, a new one fits in the freed space ({s}, {r.get('error') if isinstance(r, dict) else ''})", s == 200)
    f = O.get("/api/me")[1]["user"].get("server") or {}
    check(f"and the owner's view says it isn't refusing ({f.get('full')})", f.get("full") is False)
    # the owner's account window says it too
    from test_hosted_ui import browser_ctx, sign_in, menu, errs
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch()
        c, pg = browser_ctx(br)
        pg.goto(base + "/#servants"); pg.wait_for_timeout(2000)
        sign_in(pg, "filler@example.test", PW); pg.wait_for_timeout(3000)
        if not pg.locator(".acct-server").count():
            menu(pg); pg.click("#acct-btn"); pg.wait_for_selector('[data-action="sync-now"]', timeout=15000); pg.wait_for_timeout(500)
        t = pg.locator(".acct-server").first.inner_text() if pg.locator(".acct-server").count() else ""
        check(f"the owner's account window shows how full the database is ({t[:80]!r})", t.startswith("The site's database:") and "of 2 MB" in t)
        check(f"no page errors ({errs[:2]})", not errs)
        br.close()
    C, s, r = account(base, "Pacer")
    check(f"new accounts are welcome again ({s})", s == 200)
    codes = [put(C, "img_p%03d" % i, 200)[0] for i in range(101)]
    check(f"100 pictures an hour go up, the 101st waits ({codes.count(200)} ok, last {codes[-1]})", codes[:100] == [200] * 100 and codes[100] == 429)
    s, r = put(C, "img_p999", 200)[:2]
    check(f"in its own words ({r.get('message', '')[:70]!r})", s == 429 and "pictures for one hour" in r.get("message", ""))

if __name__ == "__main__":
    state = tempfile.mkdtemp(prefix="fgi-space-")
    try:
        with hosted.server(seeded=False, d1_pics=True, state=state, bindings={"DB_MAX_MB": "2"}) as (base, mport): code, got = fill(base)
        with hosted.server(seeded=False, d1_pics=True, state=state, bindings={"DB_MAX_MB": "2", "OWNER": code}) as (base, mport): owner(base, got)
    finally:
        shutil.rmtree(state, ignore_errors=True)
    if fails: print(hosted.server.log[-2500:])
    print("ALL PASSED" if not fails else "FAILED %d: %s" % (len(fails), fails))
    sys.exit(1 if fails else 0)
