import os
# 0.53.0-beta: the second set of colours, "Black and cream": true black in dark mode, cream white in light mode.
import sys
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
ONCE = "if (!sessionStorage.getItem('t49')) { sessionStorage.setItem('t49', '1'); localStorage.setItem('spirit-origin-list:v1:theme', 'dark'); }"
COL = """(() => { const cs = (el) => getComputedStyle(el), r = document.documentElement, v = (n) => cs(r).getPropertyValue(n).trim();
  return {pal: r.getAttribute('data-pal'), theme: r.getAttribute('data-theme'), body: cs(document.body).backgroundColor, page: cs(document.querySelector('.page-bg')).backgroundImage,
    bg: v('--bg'), panel: v('--panel'), ink: v('--ink'), gold: v('--gold'), side: cs(document.querySelector('.side')).backgroundImage, g: [1, 2, 3].map((i) => r.style.getPropertyValue('--g' + i).trim())}; })()"""
def lum(hexc):
    c = [int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5)]; c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
def contrast(a, b): la, lb = sorted([lum(a), lum(b)], reverse=True); return (la + 0.05) / (lb + 0.05)
def theme(pg, to):
    pg.locator('#theme-tgl').click(); pg.wait_for_function(f"document.documentElement.getAttribute('data-theme') === '{to}'", timeout=20000, polling=150); pg.wait_for_timeout(1800)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1280, "height": 800}, color_scheme="dark"); pg = ctx.new_page(); pg.add_init_script(INIT + ONCE)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    pg.goto(SEEDED + "#settings"); pg.wait_for_timeout(1500)
    c0 = pg.evaluate(COL)
    check(f"Chaldea blue to begin with ({c0['bg']}, {c0['pal']})", c0["pal"] is None and c0["bg"] == "#0a1229" and pg.locator('[data-action="palette"][data-v="blue"]').get_attribute("aria-pressed") == "true")
    check("Settings has Colours, right under Light or dark", pg.locator('[data-action="palette"]').count() == 2 and pg.evaluate("document.querySelector('.set-theme').nextElementSibling.classList.contains('set-palette')"))

    pg.locator('[data-action="palette"][data-v="mono"]').click(); pg.wait_for_timeout(2200) # (the page's colours ease over 1.6 s)
    c1 = pg.evaluate(COL)
    check(f"Black and cream in dark mode: the page is true black ({c1['body']}, {c1['g']})", c1["pal"] == "mono" and c1["body"] == "rgb(0, 0, 0)" and c1["bg"] == "#000000" and c1["g"] == ["#000000"] * 3 and "rgb(0, 0, 0) 0%, rgb(0, 0, 0) 55%, rgb(0, 0, 0) 100%" in c1["page"])
    check(f"the sidebar too, and the panels are nearly black ({c1['panel']})", "rgb(0, 0, 0), rgb(0, 0, 0)" in c1["side"] and lum(c1["panel"]) < 0.006)
    check(f"text and gold stay readable on it ({contrast(c1['ink'], c1['bg']):.1f}, {contrast(c1['gold'], c1['bg']):.1f}, {contrast(c1['ink'], c1['panel']):.1f})", contrast(c1["ink"], c1["bg"]) > 12 and contrast(c1["gold"], c1["bg"]) > 7 and contrast(c1["ink"], c1["panel"]) > 12)
    check("it's kept", pg.evaluate("localStorage.getItem('spirit-origin-list:v1:palette')") == "mono" and pg.locator('[data-action="palette"][data-v="mono"]').get_attribute("aria-pressed") == "true")

    # a servant's colours used to tint the page: in black and cream the page stays black
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1200)
    pg.evaluate("(() => { const r = document.querySelector('#list .row[data-id]') || document.querySelector('#list [data-id]'); if (r) r.click(); })()"); pg.wait_for_timeout(1500)
    c2 = pg.evaluate(COL)
    check(f"with a servant open the page is still black ({c2['g']})", c2["g"] == ["#000000"] * 3 and c2["body"] == "rgb(0, 0, 0)")

    # the page opened again: the attribute is there before anything is drawn (the first script in the page sets it)
    pg.goto(SEEDED + "#settings"); pg.reload(); pg.wait_for_timeout(1500)
    c3 = pg.evaluate(COL)
    check("opened again, it's still black and cream", c3["pal"] == "mono" and c3["body"] == "rgb(0, 0, 0)")
    check("the page's first script sets it", "spirit-origin-list:v1:palette" in pg.evaluate("document.querySelector('head script').textContent"))

    theme(pg, "light")
    c4 = pg.evaluate(COL)
    check(f"light mode is cream white ({c4['body']}, {c4['panel']}, {c4['g']})", c4["body"] == "rgb(243, 236, 221)" and c4["panel"] == "#fffaf0" and all(x.startswith("#") and lum(x) > 0.7 for x in c4["g"]))
    check(f"dark text on it ({contrast(c4['ink'], c4['bg']):.1f}, {contrast(c4['gold'], c4['panel']):.1f})", contrast(c4["ink"], c4["bg"]) > 12 and contrast(c4["gold"], c4["panel"]) > 4)
    theme(pg, "dark")
    check("and black again in dark mode", pg.evaluate(COL)["body"] == "rgb(0, 0, 0)")

    pg.locator('[data-action="palette"][data-v="blue"]').click(); pg.wait_for_timeout(500)
    c5 = pg.evaluate(COL)
    check(f"Chaldea blue gives the old colours back ({c5['bg']}, {c5['g']})", c5["pal"] is None and c5["bg"] == "#0a1229" and c5["g"] == c0["g"] and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:palette')") is None)
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(500)
    check("Undo goes back to black and cream", pg.evaluate(COL)["pal"] == "mono")
    pg.locator('[data-action="palette"][data-v="blue"]').click(); pg.wait_for_timeout(300)

    # Classic look: the same two palettes
    pg.evaluate("localStorage.setItem('spirit-origin-list:v1:palette', 'mono')"); pg.locator('[data-action="ui-look"][data-v="classic"]').click(); pg.wait_for_timeout(600); pg.reload(); pg.wait_for_timeout(1500)
    c6 = pg.evaluate("(() => { const r = document.documentElement; return {ui: r.getAttribute('data-ui'), pal: r.getAttribute('data-pal'), body: getComputedStyle(document.body).backgroundColor}; })()")
    check(f"the Classic look goes black too ({c6})", c6["ui"] == "classic" and c6["pal"] == "mono" and c6["body"] == "rgb(0, 0, 0)")
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
