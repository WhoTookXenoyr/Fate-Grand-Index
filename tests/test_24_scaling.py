import os
# 0.24.0: big screens. Above about 1700x960 the interface is zoomed with the screen (1.125 at 1080p, 1.5 at 1440p,
# 2.25 at 4K); things placed from screen measurements (the grail frame, the tier menu, the drag ghost, the icon picker,
# the Versus tips, the Compact window) still land where they should, and nothing scrolls sideways.
import sys
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
R = "(s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom, r.width, r.height]; }"
def rect(pg, sel): return pg.evaluate(R, sel)
def inside(pg, r): return r and r[0] >= -1 and r[1] >= -1 and r[2] <= pg.evaluate("innerWidth") + 1 and r[3] <= pg.evaluate("innerHeight") + 1
SIZES = [(1280, 720, 1), (1920, 1080, 1.125), (2560, 1440, 1.5), (3440, 1440, 1.5), (3840, 2160, 2.25)]
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h, z in SIZES:
        tag = f"{w}x{h}"
        ctx = b.new_context(viewport={"width": w, "height": h}); pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
        pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
        pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
        zz = float(pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--ui-z')") or 0)
        sh = rect(pg, ".shell")
        check(f"{tag}: zoom {zz} (expected {z}); the page is {sh[4] / w:.0%} of the screen", abs(zz - z) < 0.01 and (0.7 <= sh[4] / w <= 0.99 if w > 1300 else True))
        side = []
        for t in ("home", "servants", "story", "summon", "parties", "ranking", "versus", "past"):
            pg.evaluate(f"document.querySelector('#tab-{t}').click()"); pg.wait_for_timeout(500)
            if pg.evaluate("document.documentElement.scrollWidth > innerWidth"): side.append(t)
        check(f"{tag}: no tab scrolls sideways ({side or 'none'})", not side)
        # the grail frame sits exactly on the servant page
        pg.evaluate("document.querySelector('#tab-servants').click()"); pg.wait_for_timeout(400)
        pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(700)
        d, f = rect(pg, "#dossier"), rect(pg, ".ds-frame")
        check(f"{tag}: the grail frame sits on the servant page", f and all(abs(a - c) < 1.5 for a, c in zip(d[:4], f[:4])))
        # the icon picker opens next to its button, on the screen
        ic = pg.locator("#dossier button.ln-ic").first
        if ic.count():
            ic.scroll_into_view_if_needed(); ar = ic.bounding_box(); ic.click(); pg.wait_for_timeout(400)
            pk = rect(pg, ".ic-pick")
            # under the button, or over it when there's no room below (kept 8 px from the top at most)
            # under the button or over it (shortened to fit when neither side has room), never covering it
            near = pk and (abs(pk[1] - (ar["y"] + ar["height"] + 6)) < 3 or abs(pk[3] - (ar["y"] - 6)) < 3) and abs(pk[0] - (ar["x"] - 8)) < 420
            check(f"{tag}: the icon picker opens next to its button ({[round(x) for x in pk[:2]] if pk else None} vs button bottom {round(ar['y'] + ar['height'])})", near and inside(pg, pk))
            pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        # the tier menu opens under (or over) its card
        pg.evaluate("document.querySelector('#tab-ranking').click()"); pg.wait_for_timeout(500)
        pg.evaluate("document.querySelector('[data-action=\"rank-view\"][data-v=\"tiers\"]').click()"); pg.wait_for_timeout(500)
        card = pg.locator(".tier-card").first; card.scroll_into_view_if_needed(); cr = card.bounding_box(); card.click(); pg.wait_for_timeout(400)
        m = rect(pg, "#tier-menu")
        near = m and (abs(m[1] - (cr["y"] + cr["height"] + 6)) < 3 or abs(m[3] - (cr["y"] - 6)) < 3)
        check(f"{tag}: the tier menu opens at its card", near and inside(pg, m))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        # dragging a card: the ghost stays under the pointer
        card = pg.locator(".tier-card").nth(1); card.scroll_into_view_if_needed(); cr = card.bounding_box()
        x0, y0 = cr["x"] + cr["width"] / 2, cr["y"] + cr["height"] / 2
        pg.mouse.move(x0, y0); pg.mouse.down(); pg.mouse.move(x0 + 30, y0 + 20, steps=4)
        g1 = rect(pg, ".tier-ghost"); pg.mouse.move(x0 + 90, y0 + 60, steps=4); g2 = rect(pg, ".tier-ghost")
        # the ghost moves exactly as far as the pointer, and is the card's size
        ok = g1 and g2 and abs((g2[0] - g1[0]) - 60) < 2 and abs((g2[1] - g1[1]) - 40) < 2 and abs(g2[4] - cr["width"]) < 2 and abs(g1[0] - cr["x"]) < 60
        check(f"{tag}: a dragged card's ghost stays under the pointer, at the card's size", ok)
        pg.mouse.up(); pg.wait_for_timeout(300)
        pg.evaluate("document.querySelector('[data-action=\"rank-view\"][data-v=\"list\"]').click()"); pg.wait_for_timeout(300)
        # a Versus tip sits by what it explains
        pg.evaluate("document.querySelector('#tab-versus').click()"); pg.wait_for_timeout(600)
        tip_el = pg.locator("#versus [data-tip]").first
        if tip_el.count():
            tip_el.scroll_into_view_if_needed(); er = tip_el.bounding_box(); tip_el.hover(); pg.wait_for_timeout(300)
            t = rect(pg, "#vs-tip")
            near = t and (abs(t[3] - (er["y"] - 8)) < 3 or abs(t[1] - (er["y"] + er["height"] + 8)) < 3)
            check(f"{tag}: a Versus tip sits by what it explains", near and inside(pg, t))
        # Compact: the servant page opens as a window on the screen, with its × at the corner
        pg.evaluate("localStorage.setItem('spirit-origin-list:v1:layout', 'compact')"); pg.reload(); pg.wait_for_timeout(1300)
        pg.evaluate("document.querySelector('#tab-servants').click()"); pg.wait_for_timeout(400)
        pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(600)
        if w > 900:
            d, x = rect(pg, "#dossier"), rect(pg, ".cmp-x")
            check(f"{tag}: Compact's servant window fits the screen ({[round(v) for v in d[:4]]})", inside(pg, d) and d[5] > h * 0.8)
            check(f"{tag}: and its × sits on the window's corner", x and abs((x[0] + x[2]) / 2 - d[2]) < 30 * z and abs((x[1] + x[3]) / 2 - d[1]) < 30 * z)
        pg.evaluate("localStorage.setItem('spirit-origin-list:v1:layout', 'modern')")
        # Past Chaldea's detail window and the Fonts dialog fit the screen
        pg.goto(SEEDED + "#past"); pg.wait_for_timeout(1300)
        pg.locator(".pc-grid .pc-card").first.click(); pg.wait_for_timeout(600)
        check(f"{tag}: Past Chaldea's detail window fits the screen", inside(pg, rect(pg, ".pcd-panel")))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        fb = pg.locator('[data-action="fonts"], #btn-fonts').first
        if fb.count():
            fb.click(); pg.wait_for_timeout(400)
            check(f"{tag}: the Fonts dialog fits the screen", inside(pg, rect(pg, "#font-dlg")))
            pg.keyboard.press("Escape")
        ctx.close()
    b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
