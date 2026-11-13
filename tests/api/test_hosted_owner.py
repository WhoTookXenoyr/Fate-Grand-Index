"""0.51.0-beta: the site's owner and the servants coming to NA, on the hosted site (tests/api/hosted.py runs it with
OWNER=owner@example.test). /api/me says owner: true only for that account. In Past Chaldea the owner sees the upcoming
servants' full pages (and can summon them); a signed-out visitor and any other account see them locked with a
countdown. Signing out of the owner's account locks them again after a reload.

    python3 tests/api/test_hosted_owner.py
"""
import os, sys, json
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

def run(base):
    A, O = Client(base), Client(base)
    s, r, _ = A.post("/api/auth/signup", {"name": "Guest", "email": "someone@example.test", "key": key_of("someone@example.test", PW)})
    check(f"another account isn't the owner ({s})", s == 200 and r["user"]["owner"] is False)
    s, r, _ = O.post("/api/auth/signup", {"name": "Noyr", "email": "owner@example.test", "key": key_of("owner@example.test", PW)})
    check(f"the OWNER account is ({s})", s == 200 and r["user"]["owner"] is True)
    s, r, _ = O.get("/api/me")
    check("and /api/me says so", r["user"]["owner"] is True)
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
        check(f"no errors ({errs[:2]})", not errs)
        b.close()

if __name__ == "__main__":
    with hosted.server(seeded=True) as (base, mport): run(base)
    if fails: print(hosted.server.log[-2500:])
    print("ALL PASSED" if not fails else "FAILED %d: %s" % (len(fails), fails))
    sys.exit(1 if fails else 0)
