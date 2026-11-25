"""0.54.1: limits on the hosted site's server (from the daily security check, 23 and 25 Nov 2026), in a local copy of
Cloudflare (tests/api/hosted.py) with DOC_QUOTA_MB=1.

- A roster's share of the database (users.docs_bytes, /api/me's docBytes): each entry counts 64 + its id + its text; a
  deleted one keeps 64 + its id. A push that would go past the share is refused (507), one that shrinks the roster
  always goes through.
- Sync's pace: 6000 entries an hour per account (429, in sync's own words).
- Friend requests: 30 an hour per account, lookups that find no one included (429).

    python3 tests/api/test_hosted_limits.py
"""
import json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hosted
from test_api import Client, key_of

fails = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label, flush=True)
    if not ok: fails.append(label)
PW = "correct horse battery"
ROW = 64
size = lambda id, data: ROW + len(id) + (len(json.dumps(data, ensure_ascii=False, separators=(",", ":"))) if data is not None else 0)

def account(base, name):
    c = Client(base); email = name.lower() + "@example.test"
    s, r, _ = c.post("/api/auth/signup", {"name": name, "email": email, "key": key_of(email, PW)})
    if s != 200: raise SystemExit("couldn't make an account: %s %s" % (s, r))
    return c
def doc_bytes(c): return c.get("/api/me")[1]["user"]["docBytes"]
def push(c, changes): return c.post("/api/sync", {"changes": changes})

def run(base):
    # ---------- the roster's share ----------
    Q = account(base, "Quota")
    check("a new account's roster takes no space", doc_bytes(Q) == 0)
    a = {"name": "Mash Kyrielight", "cls": "Shielder", "rarity": 4, "level": 80, "notes": "Senpai ✦ 先輩 🛡"}
    s, r, _ = push(Q, [{"col": "servants", "id": "s1", "data": a}, {"col": "extras", "id": "log", "data": {"v": "x" * 500}}])
    want = size("s1", a) + size("log", {"v": "x" * 500})
    check(f"two entries count as 64 + id + text each, emoji and kanji as one character ({doc_bytes(Q)} vs {want})", s == 200 and doc_bytes(Q) == want)
    b = dict(a, level=90)
    push(Q, [{"col": "servants", "id": "s1", "data": b}])
    want = size("s1", b) + size("log", {"v": "x" * 500})
    check(f"changing one counts the difference ({doc_bytes(Q)} vs {want})", doc_bytes(Q) == want)
    push(Q, [{"col": "servants", "id": "s1", "data": None}])
    want = ROW + len("s1") + size("log", {"v": "x" * 500})
    check(f"a deleted one keeps 64 + its id: the row stays for the other devices ({doc_bytes(Q)} vs {want})", doc_bytes(Q) == want)
    big = lambda n: {"v": "y" * n}
    s, r, _ = push(Q, [{"col": "extras", "id": "b%d" % i, "data": big(280000)} for i in range(3)])
    check(f"three big entries fit in 1 MB ({s}, {doc_bytes(Q)})", s == 200 and doc_bytes(Q) < 1048576)
    before = doc_bytes(Q)
    s, r, _ = push(Q, [{"col": "extras", "id": "b3", "data": big(280000)}])
    check(f"a fourth would go past the share: refused ({s}, {r.get('error')})", s == 507 and r.get("error") == "roster_full" and "1 MB" in r.get("message", ""))
    check("and nothing of it was kept", doc_bytes(Q) == before and not any(d["id"] == "b3" for d in Q.get("/api/sync?since=0")[1]["docs"]))
    s, r, _ = push(Q, [{"col": "extras", "id": "b0", "data": big(10)}, {"col": "extras", "id": "b3", "data": big(5000)}])
    check(f"a push that makes the roster smaller goes through, even with a new entry in it ({s}, {doc_bytes(Q)} < {before})", s == 200 and doc_bytes(Q) < before)

    # ---------- sync's pace ----------
    P = account(base, "Pacer")
    tiny = [{"col": "extras", "id": "t%d" % i, "data": {"v": "1"}} for i in range(120)]
    codes = [push(P, tiny)[0] for _ in range(50)]
    check(f"6000 entries in an hour go through ({set(codes)})", set(codes) == {200})
    s, r, _ = push(P, tiny[:1])
    check(f"the next is held back, in sync's words ({s}, {r.get('message', '')[:60]!r})", s == 429 and r.get("error") == "slow_down" and "Syncing picks up again" in r.get("message", "") and r.get("retry", 0) > 0)
    check("pulling still works meanwhile", P.get("/api/sync?since=0")[0] == 200)

    # ---------- friend requests ----------
    F = account(base, "Asker")
    got = [F.post("/api/friends", {"to": "%09d" % (100000000 + i)})[0] for i in range(30)]
    check(f"30 lookups in an hour are answered ({set(got)})", set(got) <= {404, 200})
    s, r, _ = F.post("/api/friends", {"to": "Quota"})
    check(f"the 31st is held back, even for a name that exists ({s}, {r.get('message', '')[:50]!r})", s == 429 and "friend requests" in r.get("message", ""))
    s, r, _ = Q.post("/api/friends", {"to": "Asker"})
    check(f"someone else can still ask them ({s})", s == 200 and r.get("state") == "asked")

    # ---------- the page, when the server holds back what it sends ----------
    from test_hosted_ui import browser_ctx, sign_in, errs
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.launch()
        c, pg = browser_ctx(br, roster={"servants": [{"id": "sv1", "name": "Altria Pendragon", "cls": "Saber", "rarity": 5, "level": 90}], "parties": [], "guests": []})
        posts = []
        pg.on("request", lambda q: posts.append(q.url) if q.method == "POST" and q.url.endswith("/api/sync") else None)
        pg.goto(base + "/#servants"); pg.wait_for_timeout(2500)
        sign_in(pg, "pacer@example.test", PW); pg.wait_for_timeout(5000)
        foot = pg.evaluate("window.__fgiSync.words()")
        check(f"the page says why its changes wait ({foot[:90]!r})", "Syncing picks up again" in foot)
        n = len(posts)
        pg.evaluate("window.__fgiSync.now()"); pg.wait_for_timeout(1500)
        check(f"and doesn't keep sending while it's held back ({n} → {len(posts)})", n >= 1 and len(posts) == n)
        check(f"no page errors ({errs[:2]})", not errs)
        br.close()

if __name__ == "__main__":
    with hosted.server(seeded=False, bindings={"DOC_QUOTA_MB": "1"}) as (base, mport): run(base)
    if fails: print(hosted.server.log[-2500:])
    print("ALL PASSED" if not fails else "FAILED %d: %s" % (len(fails), fails))
    sys.exit(1 if fails else 0)
