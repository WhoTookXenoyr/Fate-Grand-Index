import os
# 0.51.0-beta: servants coming to NA. Past Chaldea has a "Coming to NA" row with the servants JP has and NA doesn't yet
# (ATLAS_UP). For everyone but the site's owner their page is locked: the picture blurred, the event, a countdown
# to NA's release in your own time, and nothing of their kit. When the countdown ends the page opens for everyone and
# they join NA's list. A servant without a date says when it's expected; the wiki's date takes over once NA announces
# the event. Once NA's own data has a servant (tools/fetch_na.py, the NA data job) it's an ordinary NA servant.
# The owner's side is in tests/api/test_hosted_owner.py.
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1')"
KEY = "spirit-origin-list:v1"
up = lambda pg: {x["no"]: x for x in pg.evaluate("window.__fgiUpcoming.all()")}
# (Tutankhamun and Van Gogh (Miner) came out on NA on 12 Nov 2026 and are NA's own servants since the NA data of 13 Nov;
# the three still to come are Christmas 2026's and Phantasmoon. The wiki gives Christmas 2026 a date here.)
XMAS = "Date.parse('2026-12-09T09:00:00Z')"
WIKI = "window.__fgiUpcoming.wiki([{n: 'Christmas 2026', s: Math.floor(Date.parse('2026-12-09T09:00:00Z') / 1000), e: 0, pick: [{n: 'Louhi', c: 'Berserker', k: 'pickup'}, {n: 'Abigail Williams (Santa)', c: 'Pretender', k: 'pickup'}]}])"
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#past"); pg.wait_for_timeout(1600)
    pg.evaluate(f"window.__fgiUpcoming.setNow({XMAS} - 3 * 86400e3 - 5 * 3600e3)")
    roster = json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True)
    u = up(pg)
    check(f"three servants are coming to NA ({[x['n'] for x in u.values()]})", sorted(u) == [429, 430, 431] and not any(x["open"] for x in u.values()))
    check("the offline file has no owner", pg.evaluate("window.__fgiUpcoming.owner()") is False)
    row = pg.locator(".up-row")
    check("Past Chaldea shows them in a Coming to NA row", row.is_visible() and "Coming to NA" in row.inner_text() and row.locator(".up-card").count() == 3)
    check("all three locked", row.locator(".up-card .up-lock").count() == 3 and row.locator(".up-card.open").count() == 0)
    check("Louhi's says it's expected in December", "Expected December 2026" in row.locator('.up-card[data-no="429"]').inner_text())
    def found(q):
        pg.fill('[data-pc-q]', q); pg.wait_for_timeout(450)
        return pg.evaluate("Array.from(document.querySelectorAll('#pc-results .pc-grid .pc-card')).map((b) => +b.dataset.no)")
    check("Tutankhamun and Van Gogh (Miner) are NA's own servants now: in NA's list, not in the row", 427 in found("tutankhamun") and pg.locator(".up-row").count() == 0 and 428 in found("van gogh (miner)"))
    pg.fill('[data-pc-q]', "tutankhamun"); pg.wait_for_timeout(450)
    pg.click('#pc-results .pc-card[data-no="427"]'); pg.wait_for_timeout(500)
    d = pg.locator("#pc-dlg")
    txt = d.inner_text()
    check("and Tutankhamun's page is NA's: NA's skill names, no note about JP's data", d.is_visible() and "Royal Valley" in txt and d.locator(".up-note").count() == 0 and d.locator(".up-cd").count() == 0)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
    check("Louhi isn't in NA's list yet", 429 not in found("louhi") and pg.locator(".up-row .up-card").count() == 1)
    pg.fill('[data-pc-q]', "zzzz nobody"); pg.wait_for_timeout(500)
    check("a search that isn't them hides the row", pg.locator(".up-row").count() == 0)
    pg.fill('[data-pc-q]', "phantasmoon"); pg.wait_for_timeout(500)
    check("a search for one shows just that one", pg.locator(".up-row .up-card").count() == 1)
    pg.fill('[data-pc-q]', ""); pg.wait_for_timeout(500)

    # ---------- the wiki's date ----------
    pg.evaluate(WIKI); pg.wait_for_timeout(400)
    check("once the wiki has NA's date, Louhi counts down to it", up(pg)[429]["at"] == pg.evaluate(XMAS) and pg.locator('.up-card[data-no="429"] [data-up-at]').count() == 1)
    t = row.locator('.up-card[data-no="429"]').inner_text()
    check(f"Louhi's card: Christmas 2026 and a countdown ({t!r})", "Christmas 2026" in t and "3d 05:00:0" in t)

    # ---------- the locked page ----------
    pg.click('.up-card[data-no="429"]'); pg.wait_for_timeout(500)
    txt = d.inner_text()
    check("the locked page: name, class, stars and the event", d.is_visible() and "Louhi" in txt and "BERSERKER" in txt.upper() and "Christmas 2026" in txt)
    check(f"a countdown to the release ({d.locator('.up-cd.big').inner_text()!r})", d.locator(".up-cd.big").inner_text().startswith("3d 05:00:0") and "your time" in txt)
    check("none of the kit: no skills, Noble Phantasm, stats or buttons", d.locator(".skills, .pcd-stats, .pcd-np, [data-action='pc-summon'], [data-action='pc-add']").count() == 0 and "Calamity of the North" not in txt)
    check("the picture is blurred", d.locator(".up-art img").evaluate("(i) => getComputedStyle(i).filter").startswith("blur("))
    pg.evaluate(f"window.__fgiUpcoming.setNow({XMAS} - 61e3)"); pg.wait_for_timeout(1100)
    check(f"a minute before ({d.locator('.up-cd.big').inner_text()!r})", d.locator(".up-cd.big").inner_text() == "00:01:01")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(250)
    check("Escape closes it", d.is_hidden())
    pg.click('.up-card[data-no="431"]'); pg.wait_for_timeout(400)
    check("Phantasmoon: no date yet, so no countdown", d.locator("[data-up-at]").count() == 0 and "Expected December 2026" in d.inner_text() and "once NA announces" in d.inner_text())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)

    # ---------- release ----------
    pg.click('.up-card[data-no="430"]'); pg.wait_for_timeout(400)
    pg.evaluate(f"window.__fgiUpcoming.setNow({XMAS} + 1000)"); pg.wait_for_timeout(1500)
    u = up(pg)
    check("at NA's release time Louhi and Abigail Williams (Santa) open", u[429]["open"] and u[430]["open"] and not u[431]["open"])
    check("and it says so", "on NA now" in pg.locator("#toast").inner_text())
    check("the open window turns into Abigail Williams (Santa)'s full page", d.locator(".pcd-stats").count() == 1 and d.locator(".skills .skill, .pcd-skills > *").count() >= 3 and d.locator("[data-action='pc-summon']").count() == 1)
    check("which says the text is JP's for now", "JP's data" in d.locator(".up-note").inner_text() and d.locator('a[href*="/db/JP/servant/430"]').count() == 1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("they're in NA's list now", 429 in found("louhi") and 430 in found("abigail williams (santa)") and 431 not in found("phantasmoon"))
    pg.fill('[data-pc-q]', ""); pg.wait_for_timeout(450)
    check("their cards in the row lost the lock", pg.locator('.up-card.open').count() == 2 and pg.locator('.up-card[data-no="429"] .up-lock').count() == 0)
    check("nothing on the roster changed", json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True) == roster)
    ctx.close()

    # ---------- a phone, dark ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, color_scheme="dark")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#past"); pg.wait_for_timeout(1600)
    pg.evaluate("document.querySelector('.up-card[data-no=\"430\"]').click()"); pg.wait_for_timeout(500)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    box = pg.locator(".up-panel").bounding_box()
    check(f"phone: the locked page fits ({w}, {box})", w[0] <= w[1] + 1 and box and box["width"] <= 390 and "Abigail Williams (Santa)" in pg.locator("#pc-dlg").inner_text())
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
