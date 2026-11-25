"""0.51.0-beta: the site's owner and the servants coming to NA, on the hosted site. /api/me says owner: true only for the
OWNER account. In Past Chaldea the owner sees the upcoming servants' full pages (and can summon them); a signed-out
visitor and any other account see them locked with a countdown. Signing out of the owner's account locks them again.
0.54.1: OWNER is the owner's friend code (an email no longer counts: the test first makes the accounts, then starts the
server again with OWNER set to that code), and the kits aren't in the page: only GET /api/upcoming has them, and it
gives them to the owner alone.

    python3 tests/api/test_hosted_owner.py
"""
import os, sys, json, shutil, tempfile, time, urllib.request
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hosted
from test_api import Client, key_of
from test_hosted_ui import browser_ctx, sign_in, errs
from playwright.sync_api import sync_playwright

fails = []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label, flush=True)
    if not ok: fails.append(label)
UP = "window.__fgiUpcoming"
PW = "correct horse battery"

CLAIMED = "claimed@example.test"
LOUHI_SKILL = "Celestial Orbit Tuning"  # Louhi's first skill in JP's data: in the server's kits, never in the page

def setup(base):
    # the first start: no OWNER yet; the accounts, and the owner's friend code
    A, O = Client(base), Client(base)
    s, r, _ = A.post("/api/auth/signup", {"name": "Guest", "email": "someone@example.test", "key": key_of("someone@example.test", PW)})
    check(f"an account ({s})", s == 200 and r["user"]["owner"] is False)
    s, r, _ = O.post("/api/auth/signup", {"name": "Noyr", "email": "owner@example.test", "key": key_of("owner@example.test", PW)})
    check(f"the owner's account, not the owner yet ({s})", s == 200 and r["user"]["owner"] is False)
    return r["user"]["code"]

def run(base):
    A, O, M, V = Client(base), Client(base), Client(base), Client(base)
    s, r, _ = A.post("/api/auth/login", {"email": "someone@example.test", "key": key_of("someone@example.test", PW)})
    check(f"another account isn't the owner ({s})", s == 200 and r["user"]["owner"] is False)
    s, r, _ = O.post("/api/auth/login", {"email": "owner@example.test", "key": key_of("owner@example.test", PW)})
    check(f"the account with OWNER's friend code is ({s})", s == 200 and r["user"]["owner"] is True)
    s, r, _ = O.get("/api/me")
    check("and /api/me says so", r["user"]["owner"] is True)
    # 0.54.1: OWNER also lists an email no account has: whoever signs up with it isn't the owner
    s, r, _ = M.post("/api/auth/signup", {"name": "Mallory", "email": CLAIMED, "key": key_of(CLAIMED, PW)})
    check(f"an email in OWNER doesn't make an account the owner ({s})", s == 200 and r["user"]["owner"] is False)
    def kits(c):
        s, r, h = c.get("/api/upcoming"); return s, r, h
    s, r, h = kits(O)
    check(f"/api/upcoming: the owner gets all three in full ({s}, {len(r.get('servants', []))})", s == 200 and r["owner"] is True and sorted(x["no"] for x in r["servants"]) == [429, 430, 431] and all(x.get("sk") for x in r["servants"]))
    check("and nothing keeps a copy on the way", "no-store" in (h.get("cache-control") or ""))
    # (none of the three has a release time in upcoming.json yet; one that has, and is past it, would be given to all)
    released = lambda r: all((x.get("up") or {}).get("at") for x in r["servants"])
    for who, c in (("signed out", V), ("another account", A), ("the account with OWNER's email", M)):
        s, r, _ = kits(c)
        check(f"/api/upcoming, {who}: not the owner, and only servants whose NA release has passed ({s}, {[x['no'] for x in r.get('servants', [])]})", s == 200 and r["owner"] is False and released(r))
    html = urllib.request.urlopen(base + "/").read().decode("utf-8")
    check("the page itself has their cards but none of their kits", "Louhi" in html and LOUHI_SKILL not in html)
    with sync_playwright() as p:
        b = p.chromium.launch()
        # ---------- signed out ----------
        c1, a = browser_ctx(b)
        a.goto(base + "/#past"); a.wait_for_timeout(2500)
        u = a.evaluate(UP + ".all()")
        check("signed out: all three locked", len(u) == 3 and not any(x["open"] for x in u) and a.evaluate(UP + ".owner()") is False)
        a.click('.up-card[data-no="429"]'); a.wait_for_timeout(400)
        check("Louhi's page is the locked one", a.locator("#pc-dlg .up-lockpage").count() == 1 and a.locator("#pc-dlg .pcd-stats").count() == 0)
        a.keyboard.press("Escape"); a.wait_for_timeout(200)
        # ---------- another account ----------
        sign_in(a, "someone@example.test", PW); a.wait_for_timeout(6000)
        check("another account: still locked", not any(x["open"] for x in a.evaluate(UP + ".all()")) and a.locator(".up-card .up-lock").count() == 3)
        c1.close()
        # ---------- the owner ----------
        c2, o = browser_ctx(b, roster={"servants": [], "parties": [], "guests": []})
        o.goto(base + "/#past"); o.wait_for_timeout(2500)
        sign_in(o, "owner@example.test", PW); o.wait_for_timeout(6000)
        if o.locator(".acct").first.is_visible(): o.keyboard.press("Escape")
        u = o.evaluate(UP + ".all()")
        check(f"the owner: all three open as soon as they sign in ({[x['open'] for x in u]})", all(x["open"] for x in u) and o.evaluate(UP + ".owner()") is True)
        check("their cards have no lock, and the row says why", o.locator(".up-card .up-lock").count() == 0 and "You're the owner" in o.locator(".up-row").inner_text())
        o.click('.up-card[data-no="431"]'); o.wait_for_timeout(500)
        d = o.locator("#pc-dlg")
        check("Phantasmoon's full page, marked as only theirs", d.locator(".pcd-stats").count() == 1 and "Only you can see this page" in d.locator(".up-note").inner_text())
        o.click('#pc-dlg [data-action="pc-summon"]'); o.wait_for_timeout(1500)
        for _ in range(6):
            sk = o.get_by_role("button", name="Skip")
            if sk.count() and sk.first.is_visible(): sk.first.click(); o.wait_for_timeout(800)
            else: break
        o.wait_for_timeout(1500)
        names = o.evaluate("Array.from(document.querySelectorAll('#list .row')).map((r) => r.innerText)")
        check(f"and they can summon them ({o.locator('#toast').inner_text()!r}, {names})", any("Phantasmoon" in n for n in names))
        o.reload(); o.wait_for_timeout(3000)
        check("after a reload they're open right away", all(x["open"] for x in o.evaluate(UP + ".all()")))
        o.click("#acct-btn"); o.wait_for_selector('[data-action="acct-signout"]'); o.click('[data-action="acct-signout"]'); o.wait_for_timeout(1500)
        if o.locator(".acct").first.is_visible(): o.keyboard.press("Escape")
        o.evaluate("document.querySelector('#tab-past').click()"); o.wait_for_timeout(600)
        check("signed out: locked again", not any(x["open"] for x in o.evaluate(UP + ".all()")) and o.locator(".up-card .up-lock").count() == 3)
        o.reload(); o.wait_for_timeout(3000)
        check("signed out and reloaded: still locked", not any(x["open"] for x in o.evaluate(UP + ".all()")) and o.evaluate(UP + ".owner()") is False)
        check("and the owner's copy of the kits is gone from the browser", o.evaluate("localStorage.getItem('spirit-origin-list:v1:owner-up')") is None and o.evaluate(UP + ".full()") == [])
        # 0.54.1: the owner flag typed in by hand opens nothing: the kits aren't there to open
        o.evaluate("localStorage.setItem('spirit-origin-list:v1:owner', '1')"); o.reload(); o.wait_for_timeout(3000)
        check("a visitor who sets the owner flag by hand: still locked", not any(x["open"] for x in o.evaluate(UP + ".all()")) and o.evaluate(UP + ".full()") == [] and LOUHI_SKILL not in o.content())
        check(f"no errors ({errs[:2]})", not errs)
        b.close()

if __name__ == "__main__":
    state = tempfile.mkdtemp(prefix="fgi-owner-")
    try:
        with hosted.server(seeded=True, state=state) as (base, mport): code = setup(base)
        with hosted.server(seeded=True, state=state, bindings={"OWNER": code + " " + CLAIMED}) as (base, mport): run(base)
    finally:
        shutil.rmtree(state, ignore_errors=True)
    if fails: print(hosted.server.log[-2500:])
    print("ALL PASSED" if not fails else "FAILED %d: %s" % (len(fails), fails))
    sys.exit(1 if fails else 0)
