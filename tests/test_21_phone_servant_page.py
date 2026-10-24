import os
# 0.23.2: on a phone, a servant's page covers the screen: solid, its scrolling stays inside it, and the page behind it
# (and the animated background) isn't drawn, so nothing shows through or smears while scrolling.
import sys
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');if(!localStorage.getItem('spirit-origin-list:v1:summon'))localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
BEHIND = [".shell", ".aura", ".page-emblem", ".page-class", ".page-fx", ".idle-bg"]
def page(b, w, h, mobile):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile); pg = ctx.new_page()
    pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    return ctx, pg
def vis(pg, sel): return pg.evaluate(f"getComputedStyle(document.querySelector('{sel}')).visibility")
def alpha(pg): return pg.evaluate("(() => { const c = getComputedStyle(document.querySelector('#dossier')).backgroundColor; const m = c.match(/[\\d.]+/g); return c.startsWith('rgba') || c.includes('/') ? Number(m[m.length - 1]) : 1; })()")
def on(pg): return pg.evaluate("document.documentElement.classList.contains('sheet-on')")
def open_sv(pg, sid): pg.evaluate(f"document.querySelector('#list [data-id=\"{sid}\"]').click()"); pg.wait_for_timeout(600)
def close_sv(pg): pg.evaluate("document.querySelector('#dossier [data-action=\"close\"]').click()"); pg.wait_for_timeout(400)
def mean(png):
    from PIL import Image; import io
    h = Image.open(io.BytesIO(png)).convert("L").histogram(); return sum(i * n for i, n in enumerate(h)) / sum(h)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = page(b, 390, 844, True)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.mouse.wheel(0, 600); pg.wait_for_timeout(300); y0 = pg.evaluate("scrollY")
    check("with no servant open, the page is drawn as usual", not on(pg) and all(vis(pg, s) == "visible" for s in BEHIND))
    open_sv(pg, "oberon")
    check("a servant's page on a phone marks the screen as covered", on(pg))
    check(f"it's solid (background alpha {alpha(pg)})", alpha(pg) == 1)
    check("its scrolling stays inside it (overscroll-behavior: contain)", pg.evaluate("getComputedStyle(document.querySelector('#dossier')).overscrollBehaviorY") == "contain")
    hidden = {s: vis(pg, s) for s in BEHIND}
    check(f"the page and the animated background behind it aren't drawn ({hidden})", all(v == "hidden" for v in hidden.values()))
    check("the servant's page itself is drawn", vis(pg, "#dossier") == "visible")
    # pixel check: a black block right behind the servant page (drawn even while the page is hidden) doesn't show through
    pg.evaluate("document.querySelector('#dossier').scrollTop = 600"); pg.wait_for_timeout(300)
    a = mean(pg.screenshot())
    pg.evaluate("const k = document.createElement('div'); k.id = 't21k'; k.style.cssText = 'position:fixed;inset:0;z-index:29;background:#000;visibility:visible'; document.querySelector('.shell').appendChild(k)"); pg.wait_for_timeout(200)
    b2 = mean(pg.screenshot())
    check(f"a black block behind it doesn't show through (brightness {a:.1f} -> {b2:.1f})", abs(a - b2) < 0.5)
    pg.evaluate("document.getElementById('t21k').remove()")
    # things opened from the servant page still show: the Craft Essence picker and the icon picker
    pg.evaluate("document.querySelector('#dossier').scrollTop = 0"); pg.wait_for_timeout(200)
    pg.evaluate("document.querySelector('#dossier [data-action=\"fce-add\"]').click()"); pg.wait_for_timeout(500)
    check("the Craft Essence picker opened from it is visible", pg.evaluate("(() => { const c = document.querySelector('.cep'); return !!c && !c.hidden && getComputedStyle(c).visibility === 'visible' && getComputedStyle(c).display !== 'none'; })()"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    close_sv(pg)
    check(f"closing it draws the page again, at the same place in the list ({y0} -> {pg.evaluate('scrollY')})", not on(pg) and all(vis(pg, s) == "visible" for s in BEHIND) and pg.evaluate("scrollY") == y0)
    # a grailed servant keeps the gold frame
    open_sv(pg, "cu-chulainn-alter")
    check("a grailed servant's gold frame is still drawn", pg.evaluate("(() => { const f = document.querySelector('.ds-frame'); return !!f && !f.hidden && getComputedStyle(f).visibility === 'visible'; })()"))
    # Back closes it (0.23.1) and the page is drawn again
    pg.go_back(wait_until="commit"); pg.wait_for_timeout(500)
    check("Back closes it and the page is drawn again", not on(pg) and vis(pg, ".shell") == "visible")
    # leaving for another tab from inside it
    open_sv(pg, "oberon"); pg.evaluate("document.querySelector('#dossier [data-action=\"vs-add\"]').click()"); pg.wait_for_timeout(500)
    check("Compare (to Versus) draws the page again", not on(pg) and vis(pg, ".shell") == "visible")
    # turning the phone sideways past 900px: the servant page sits next to the list again
    pg.evaluate("document.querySelector('#tab-servants').click()"); pg.wait_for_timeout(300); open_sv(pg, "oberon")
    pg.set_viewport_size({"width": 1100, "height": 700}); pg.wait_for_timeout(400)
    check("wider than 900px, nothing is hidden", not on(pg) and vis(pg, ".shell") == "visible")
    ctx.close()

    # the desktop servant page is unchanged (a little see-through over the background)
    ctx, pg = page(b, 1360, 900, False)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1300); pg.click('#list [data-id="oberon"]'); pg.wait_for_timeout(400)
    check(f"desktop: unchanged (not covered, alpha {alpha(pg)})", not on(pg) and 0.9 < alpha(pg) < 1 and vis(pg, ".aura") == "visible")
    b.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
