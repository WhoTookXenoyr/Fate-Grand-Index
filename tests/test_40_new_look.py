import os
# 0.50.0-beta: the new look. A sidebar with the pages (and their icons), the tools and the Look switch; it folds to icons
# and remembers that. Classic puts the page back as it was (with a "New look" button in the header), with Undo, and
# survives a reload. Pages slide in when you change them. Past Chaldea's window drops in, and the menu waits behind it
# (it's inert while any window makes the page inert). On a phone the sidebar is a drawer: the menu button opens it, a
# page picked in it closes it, so do Escape and the dark area beside it, and the page has no sideways scroll.
# None of it touches the roster.
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
UIK = KEY + ":ui"
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    return pg
roster = lambda pg: json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True)
look = lambda pg: pg.evaluate("document.documentElement.getAttribute('data-ui')")
inert = lambda pg, sel: pg.evaluate(f"(() => {{ const e = document.querySelector('{sel}'); return e ? !!e.inert : null; }})()")
def quiet(pg): pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
with sync_playwright() as p:
    b = p.chromium.launch()
    # ================= a computer =================
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1600)
    before = roster(pg)
    check(f"the new look is on from the start ({look(pg)})", look(pg) == "beta" and pg.evaluate("document.documentElement.classList.contains('has-side')"))
    tabs = pg.evaluate("Array.from(document.querySelectorAll('#side .side-nav .tab')).map((t) => t.dataset.tab)")
    check(f"the sidebar has every page, Battle before Past Chaldea ({tabs})", tabs[:2] == ["home", "servants"] and "battle" in tabs and tabs.index("battle") == tabs.index("past") - 1 and len(tabs) >= 9)
    check("each page has its icon and its name", pg.locator("#side .side-nav .tab .tab-ic svg").count() == len(tabs) and pg.locator("#side .side-nav .tab .tab-t").count() == len(tabs))
    check("the logo and the tools are in it too", pg.locator("#side .side-top .brand").count() == 1 and pg.locator("#side .side-tools .mast-actions").count() == 1)
    chip = pg.locator("#side .ver-chip").inner_text()
    check(f"the version says beta ({chip!r})", "0.50.0" in chip and "beta" in chip and "alpha" not in chip)
    sx = pg.evaluate("[document.getElementById('side').getBoundingClientRect().right, document.querySelector('.shell').getBoundingClientRect().left]")
    check(f"the page sits beside the sidebar ({sx})", 200 <= sx[0] <= 260 and sx[0] - 1 <= sx[1] <= sx[0] + 80)
    # light mode: a white sidebar; dark mode: the game's navy (Noyr's fix)
    bgs = {}
    for th in ("light", "dark"):
        pg.evaluate(f"document.documentElement.setAttribute('data-theme', '{th}')"); pg.wait_for_timeout(150)
        bgs[th] = pg.evaluate("getComputedStyle(document.getElementById('side')).backgroundImage")
    pg.evaluate("document.documentElement.setAttribute('data-theme', 'light')")
    check(f"light mode: the sidebar is white ({bgs['light'][:60]})", "rgb(255, 255, 255)" in bgs["light"])
    check(f"dark mode: the sidebar is navy ({bgs['dark'][:60]})", "rgb(16, 27, 64)" in bgs["dark"])
    # the class name behind the page starts beside the sidebar (it was half under it)
    pg.locator('#list .row').first.evaluate("(e) => e.click()"); pg.wait_for_timeout(1200)
    cw = lambda: pg.evaluate("[document.querySelector('.pc-word').getBoundingClientRect().left, document.getElementById('side').getBoundingClientRect().right]")
    c = cw()
    check(f"the class name in the background starts beside the sidebar ({c})", c[0] >= c[1])

    # ---------- changing pages ----------
    m0 = pg.evaluate("document.querySelector('.side-mark').style.transform")
    pg.click('#side .tab[data-tab="story"]'); pg.wait_for_timeout(60)
    check("the page slides in", pg.evaluate("document.getElementById('view-story').classList.contains('view-in')") and pg.evaluate("getComputedStyle(document.getElementById('view-story')).animationName") != "none")
    pg.wait_for_timeout(700)
    m1 = pg.evaluate("document.querySelector('.side-mark').style.transform")
    check(f"the marker moves to the page you're on ({m0} → {m1})", m0 != m1 and pg.locator('#side .tab[data-tab="story"]').get_attribute("aria-selected") == "true")
    check("and the slide is over afterwards", not pg.evaluate("document.getElementById('view-story').classList.contains('view-in')"))
    pg.click('#side .tab[data-tab="servants"]'); pg.wait_for_timeout(700)

    # ---------- Settings: the cog beside the account (the header's tools live there) ----------
    check("the sidebar's foot is the account and the cog", pg.locator("#side .side-tools .side-cog").count() == 1 and pg.locator("#side #theme-tgl, #side #fps-btn, #side #btn-export, #side [data-action='tour']").count() == 0)
    pg.click("#side .side-cog"); pg.wait_for_timeout(600)
    check(f"the cog opens Settings ({pg.evaluate('location.hash')}, {pg.locator('#top-title').inner_text()!r})", pg.evaluate("location.hash") == "#settings" and pg.locator("#view-settings").is_visible() and pg.locator("#top-title").inner_text() == "Settings" and pg.locator("#side .side-cog").get_attribute("aria-current") == "page")
    tools = pg.evaluate("['#theme-tgl', '#layout-tgl', '#fps-btn', '#btn-export', '[data-action=\"fonts\"]', '[data-action=\"tour\"]', '.news-btn'].map((q) => !!document.querySelector('#view-settings ' + q))")
    check(f"with every tool on it ({tools})", all(tools))
    check("the Look switch shows New", pg.locator('#view-settings [data-action="ui-look"][data-v="beta"]').get_attribute("aria-pressed") == "true")
    pg.click('#view-settings [data-action="fps"]'); pg.wait_for_timeout(300)
    check("its tools work (the frame rate)", pg.locator("#fps-btn").get_attribute("data-fps") == "30")
    pg.click('#view-settings [data-action="fps"]'); pg.wait_for_timeout(200); pg.click('#view-settings [data-action="fps"]'); pg.wait_for_timeout(300)

    # ---------- folding it (on Settings) ----------
    pg.click('#view-settings [data-action="ui-mini"][data-v="1"]'); pg.wait_for_timeout(500)
    sw = pg.evaluate("[document.getElementById('side').getBoundingClientRect().width, document.querySelector('.shell').getBoundingClientRect().width]")
    check(f"folded: only the icons, the page gets the room ({sw})", pg.evaluate("document.documentElement.classList.contains('side-mini')") and sw[0] < 100 and sw[1] > 1100)
    check("its switch says Only icons", pg.locator('#view-settings [data-action="ui-mini"][data-v="1"]').get_attribute("aria-pressed") == "true")
    check("folded, the logo is the app icon's diamond (a link Home), and the cog is still there", pg.locator("#side .side-gem").is_visible() and not pg.locator("#side .brand").is_visible() and pg.locator("#side .side-gem").get_attribute("href") == "#home" and pg.locator("#side .side-cog").is_visible())
    pg.click('#side .tab[data-tab="servants"]'); pg.wait_for_timeout(900); c2 = cw()
    check(f"and the class name moves along with it ({c[0]:.0f} → {c2[0]:.0f})", c2[0] >= c2[1] and c2[0] < c[0] - 100)
    check("remembered", pg.evaluate(f"JSON.parse(localStorage.getItem('{UIK}'))").get("mini") is True)
    pg.reload(); pg.wait_for_timeout(1400)
    check("still folded after a reload", pg.evaluate("document.documentElement.classList.contains('side-mini')"))
    pg.click("#side .side-cog"); pg.wait_for_timeout(500)
    pg.click('#view-settings [data-action="ui-mini"][data-v="0"]'); pg.wait_for_timeout(400)
    check("unfolded again, with the whole logo", not pg.evaluate("document.documentElement.classList.contains('side-mini')") and pg.locator("#side .brand").is_visible() and not pg.locator("#side .side-gem").is_visible())

    # ---------- Classic, and back ----------
    pg.click('#view-settings [data-action="ui-look"][data-v="classic"]'); pg.wait_for_timeout(500)
    check("Classic leaves Settings (its tools are back in the header)", pg.evaluate("location.hash") != "#settings" and pg.locator("#view-settings").is_hidden() and pg.locator(".masthead .mast-actions #theme-tgl").count() == 1)
    check(f"Classic: the page as it was ({look(pg)})", look(pg) == "classic" and pg.locator("#side").count() == 0 and pg.locator(".shell > nav.tabs").count() == 1 and pg.locator(".masthead .brand").count() == 1)
    check("the tabs are in the header again, without icons showing", pg.evaluate("getComputedStyle(document.querySelector('nav.tabs .tab .tab-ic')).display") == "none")
    check("the header has a way back", pg.locator(".mast-actions .ui-try").count() == 1)
    check("Undo is offered", "Undo" in pg.locator("#toast").inner_text())
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(500)
    check("Undo brings the new look back", look(pg) == "beta" and pg.locator("#side .side-nav nav.tabs").count() == 1 and pg.locator(".ui-try").count() == 0)
    pg.click("#side .side-cog"); pg.wait_for_timeout(400); pg.click('#view-settings [data-action="ui-look"][data-v="classic"]'); pg.wait_for_timeout(400); quiet(pg)
    pg.reload(); pg.wait_for_timeout(1400)
    check("Classic stays after a reload", look(pg) == "classic" and pg.locator("#side").count() == 0)
    pg.click(".mast-actions .ui-try"); pg.wait_for_timeout(500); quiet(pg)
    check("New look from the header", look(pg) == "beta" and pg.locator("#side").count() == 1)

    # ---------- windows over the page ----------
    pg.click('#side .tab[data-tab="past"]'); pg.wait_for_timeout(1200)
    pg.locator('[data-action="pc-open"]').first.click(); pg.wait_for_timeout(120)
    check("Past Chaldea's window drops in", pg.evaluate("(() => { const d = document.querySelector('.pcd:not([hidden])'); return !!d && d.classList.contains('pcd-drop'); })()"))
    check("the menu waits behind it", inert(pg, "#side") is True and inert(pg, ".shell") is True)
    pg.wait_for_timeout(900)
    check("the drop is over after a moment", pg.evaluate("!document.querySelector('.pcd:not([hidden])').classList.contains('pcd-drop')"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("closed: the menu works again", inert(pg, "#side") is False and pg.locator(".pcd:not([hidden])").count() == 0)
    pg.click('#side .tab[data-tab="servants"]'); pg.wait_for_timeout(700)
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(500)
    check("any window that makes the page inert makes the menu inert too (the Workshop)", inert(pg, ".shell") is True and inert(pg, "#side") is True)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(500)
    if inert(pg, ".shell"):
        pg.locator('[data-ws="close"], .ws-x, [data-action="ws-close"]').first.click(); pg.wait_for_timeout(500)
    check("and not after it's closed", inert(pg, ".shell") is False and inert(pg, "#side") is False)
    check("none of it changed the roster", roster(pg) == before)
    ctx.close()

    # ================= reduced motion =================
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    pg = page(ctx); pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1400)
    pg.click('#side .tab[data-tab="parties"]'); pg.wait_for_timeout(60)
    check("with reduced motion the page just appears", pg.evaluate("getComputedStyle(document.getElementById('view-parties')).animationName") == "none")
    ctx.close()

    # ================= a phone =================
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=3)
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1600)
    check("a menu button in the bar at the top", pg.locator(".top-bar .side-btn").is_visible() and pg.locator(".top-bar .side-btn").get_attribute("aria-expanded") == "false")
    check(f"the bar names the page ({pg.locator('#top-title').inner_text()!r})", pg.locator("#top-title").inner_text() == "Servants")
    x = pg.evaluate("document.getElementById('side').getBoundingClientRect().right")
    check(f"the menu is out of sight, and out of reach ({x})", x <= 0 and inert(pg, "#side") is True)
    pg.tap(".top-bar .side-btn"); pg.wait_for_timeout(500)
    x = pg.evaluate("document.getElementById('side').getBoundingClientRect().left")
    check(f"the button slides it in ({x})", pg.evaluate("document.documentElement.classList.contains('side-open')") and abs(x) < 2 and inert(pg, "#side") is False)
    check("its button says it's open", pg.locator(".top-bar .side-btn").get_attribute("aria-expanded") == "true")
    pg.tap('#side .tab[data-tab="parties"]'); pg.wait_for_timeout(600)
    check("a page picked in it closes it", not pg.evaluate("document.documentElement.classList.contains('side-open')") and pg.evaluate("document.querySelector('#side .tab[aria-selected=\"true\"]').dataset.tab") == "parties")
    check(f"and the bar names the new page ({pg.locator('#top-title').inner_text()!r})", pg.locator("#top-title").inner_text() == "Parties")
    pg.tap(".top-bar .side-btn"); pg.wait_for_timeout(450)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("Escape closes it", not pg.evaluate("document.documentElement.classList.contains('side-open')"))
    pg.tap(".top-bar .side-btn"); pg.wait_for_timeout(450)
    pg.mouse.click(370, 400); pg.wait_for_timeout(400)
    check("so does a tap beside it", not pg.evaluate("document.documentElement.classList.contains('side-open')"))
    for tab in ("home", "servants", "battle", "story"):
        pg.tap(".top-bar .side-btn"); pg.wait_for_timeout(400); pg.tap(f'#side .tab[data-tab="{tab}"]'); pg.wait_for_timeout(900)
        w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
        check(f"{tab}: no sideways scroll ({w})", w[0] <= w[1] + 1)
    # the classic look on a phone still has the drawer (the sidebar is how a phone gets around)
    pg.tap(".top-bar .side-btn"); pg.wait_for_timeout(400)
    pg.tap("#side .side-cog"); pg.wait_for_timeout(600)
    check("on a phone the cog opens Settings and closes the menu", pg.evaluate("location.hash") == "#settings" and not pg.evaluate("document.documentElement.classList.contains('side-open')") and pg.locator("#top-title").inner_text() == "Settings")
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    check(f"Settings: no sideways scroll ({w})", w[0] <= w[1] + 1)
    pg.tap('#view-settings [data-action="ui-look"][data-v="classic"]'); pg.wait_for_timeout(500)
    check("Classic on a phone keeps the menu drawer", look(pg) == "classic" and pg.locator("#side").count() == 1 and pg.locator(".top-bar .side-btn").count() == 1)
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
