# The page is mostly used as a file opened straight from the disk (file://), so this suite opens it that way.
# (The other suites go over http, see tests/run.py.)
import sys, tempfile, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": 1360, "height": 1000})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(f"file://{sp}/out/Fate_Grand_Index.html"); pg.wait_for_timeout(1500)
    check("the shipped file opens on Home with an empty roster", pg.locator(".brand-logo").count() == 1 and pg.locator("#app-ver").count() == 1)
    check("and the guide greets a first-time visitor", pg.locator(".tour-panel").is_visible())
    ctx.close()

    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": 1360, "height": 1000})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT); pg.route("https://**", lambda r: r.abort())
    pg.goto(f"file://{sp}/_seeded.html#servants"); pg.wait_for_timeout(1500)
    n = pg.locator("#list .row").count()
    check(f"the sample roster lists its servants ({n})", n >= 20)
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(600)
    check("a servant page opens", pg.locator("#dossier h2").first.inner_text() == "Artoria")
    saved = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") or "{}")
    check("the roster is saved in this browser under the same key as always", len(saved.get("servants", [])) == n)
    pg.click("#tab-past"); pg.wait_for_timeout(800)
    check("Past Chaldea lists the NA servants", pg.locator(".pc-grid .pc-card").count() == 240)
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
