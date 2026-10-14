import os
import sys, tempfile, io
from playwright.sync_api import sync_playwright
from PIL import Image
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
BASE = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def page(ctx):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return pg
def sat(png):
    im = Image.open(io.BytesIO(png)).convert("HSV").resize((40, 20)); px = list(im.getdata())
    return sum(p[1] for p in px) / len(px)
prof = tempfile.mkdtemp()
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000})
    pg = page(ctx); pg.goto(BASE); pg.wait_for_timeout(1600)

    # ---- Home is the landing page
    check("opens on Home", pg.evaluate("location.hash") == "#home" and pg.locator("#tab-home").get_attribute("aria-selected") == "true" and not pg.locator("#view-home").is_hidden())
    check("summary line hidden on Home (the hero says it)", pg.locator("#summary").is_hidden())
    check("resting backdrop behind Home", pg.evaluate("document.getElementById('idle-bg').classList.contains('on')"))
    hello = pg.locator(".hm-hello").inner_text()
    check(f"greeting {hello!r}", "Master" in hello)
    cards = pg.locator(".hm-fan .hm-card")
    check(f"a hand of {cards.count()} Saint Graph cards", cards.count() == 7 and pg.locator(".hm-fan.deal, .hm-fan.dealt").count() == 1)
    top = pg.evaluate("Array.from(document.querySelectorAll('.hm-card')).sort((a,b)=>parseFloat(getComputedStyle(a).zIndex)-parseFloat(getComputedStyle(b).zIndex)).pop().dataset.cap")
    check(f"strongest servant in the middle ({top})", top == "Space Ereshkigal")
    cards.nth(0).hover(); pg.wait_for_timeout(400)
    check("pointing at a card names it underneath", pg.locator(".hm-cap b").inner_text() == cards.nth(0).get_attribute("data-cap"))
    nxt = pg.locator(".hm-next li")
    check(f"next upgrades listed ({nxt.count()})", nxt.count() == 5 and "Skill" in nxt.first.inner_text())
    check("class grid shows all 15 classes", pg.locator(".hm-cls").count() == 15)
    check("NP card split shown", pg.locator(".hm-bar").count() == 3)
    check(f"Guests listed in the Summoning block ({pg.locator('.hm-b-sum .hs-g').count()})", pg.locator(".hm-b-sum .hs-g").count() >= 1 and pg.locator("#home .summon-btn[data-action='summon']").count() == 0)
    check("parties listed", pg.locator(".hm-parties li").count() >= 1)
    pg.screenshot(path=f"{sp}/v10-home-desktop.png")

    # ---- Home links into the rest of the page
    name = cards.nth(3).get_attribute("data-cap"); cards.nth(3).click(); pg.wait_for_timeout(900)
    check(f"clicking a card opens {name}", pg.evaluate("location.hash") == "#servants" and pg.locator("#dossier h2").first.inner_text() == name and pg.locator("#home").inner_html() == "")
    pg.click("#tab-home"); pg.wait_for_timeout(700)
    pg.click('.hm-cls[data-cls="Berserker"]'); pg.wait_for_timeout(700)
    rows = pg.locator("#list > .row .row-meta").all_inner_texts()
    check(f"a class opens the roster filtered ({len(rows)} Berserkers)", rows and all(r.startswith("Berserker") for r in rows) and pg.input_value("#f-class") == "Berserker")
    pg.select_option("#f-class", ""); pg.wait_for_timeout(300)
    pg.click("#tab-home"); pg.wait_for_timeout(700)
    pg.click('.hm-actions [data-tab="summon"]'); pg.wait_for_timeout(1200)
    check("Summoning button opens the Summoning page", pg.evaluate("location.hash") == "#summon" and pg.locator(".smg").count() >= 1)
    pg.click("#tab-servants"); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(1200)
    check("reloading stays on Servants", pg.evaluate("location.hash") == "#servants" and not pg.locator("#view-servants").is_hidden())

    # ---- Quick banner loops seamlessly
    kf = pg.evaluate("""() => { let last = null; for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch (e) { continue; } for (const r of rules) if (r.type === CSSRule.KEYFRAMES_RULE && r.name === 'npSpeed') last = r.cssText; } return last; }""")
    check(f"Quick speed lines move one stripe per loop", kf and "-56.509px" in kf and "-30.046px" in kf)

    # ---- skill cards fill with colour as they level
    pg.click('[data-id="artoria"]'); pg.wait_for_timeout(500); pg.click('[data-action="edit"]'); pg.wait_for_timeout(500)
    pg.fill("#sv-s1-name", "Charisma"); pg.fill("#sv-s1-rank", "A"); pg.fill("#sv-s2-name", "Mana Burst"); pg.fill("#sv-s2-rank", "A"); pg.fill("#sv-s3-name", "Instinct"); pg.fill("#sv-s3-rank", "B")
    pg.select_option("#sv-sk0", "2"); pg.select_option("#sv-sk1", "10"); pg.select_option("#sv-sk2", "9")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900)
    sk = pg.locator("#dossier .skills .skill")
    s_lo, s_hi = sat(sk.nth(0).screenshot()), sat(sk.nth(1).screenshot())
    check(f"gold A skill is much more golden at Lv 10 than Lv 2 (saturation {s_lo:.0f} → {s_hi:.0f})", s_hi > s_lo * 1.6)
    pg.locator("#dossier .skills").screenshot(path=f"{sp}/v10-skills-light.png")

    # ---- the whole servant panel framed for grails
    check("Artoria (not grailed): plain panel", "gr100" not in (pg.get_attribute("#dossier", "class") or ""))
    pg.click('[data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(600)
    check("Cu Alter Lv 100: gold frame on the whole panel", "gr100" in pg.get_attribute("#dossier", "class"))
    bw = pg.evaluate("getComputedStyle(document.getElementById('dossier')).borderTopWidth")
    check(f"frame drawn as the panel border ({bw})", bw == "2px")
    pg.click('[data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(200); pg.click('[data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(600)
    check("Lv 102: gold and rainbow frame", "gr102" in pg.get_attribute("#dossier", "class"))
    pg.screenshot(path=f"{sp}/v10-dossier-102.png")
    pg.click('[data-action="edit"]'); pg.wait_for_timeout(400)
    check("frame steps aside while editing", "gr102" not in (pg.get_attribute("#dossier", "class") or ""))
    pg.click('[data-action="cancel-edit"]'); pg.wait_for_timeout(400)
    ctx.close()

    # ---- phones
    for w in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": w, "height": 820})
        pg = page(ctx); pg.goto(BASE); pg.wait_for_timeout(1800)
        check(f"{w}px: Home with 5 cards", pg.locator(".hm-fan .hm-card").count() == 5)
        sw = pg.evaluate("document.documentElement.scrollWidth")
        check(f"{w}px: no sideways scroll ({sw})", sw <= w)
        pg.screenshot(path=f"{sp}/v10-phone{w}-home.png", full_page=True)
        ctx.close()

    # ---- dark
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000}, color_scheme="dark")
    pg = page(ctx); pg.goto(BASE); pg.wait_for_timeout(1800)
    pg.screenshot(path=f"{sp}/v10-home-dark.png")
    pg.click('#tab-servants'); pg.wait_for_timeout(500); pg.click('[data-id="artoria"]'); pg.wait_for_timeout(700)
    pg.locator("#dossier .skills").screenshot(path=f"{sp}/v10-skills-dark.png")
    pg.click('[data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(700)
    pg.screenshot(path=f"{sp}/v10-dossier-dark.png")
    ctx.close()
check("no page errors", not errs)
if errs: print(errs[:6])
print("FAILS:", len(fails))
