import os
# 0.60.0: your favourite servant (70-favourite.js). A heart on the servant page makes them your favourite (one at a
# time, kept under its own key); their page then wears a halo in their picture's colours (a ring with a light going
# round it, a breathing glow, rising motes) and a burst of light where you click on it. Their roster row gets a heart.
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
KEY = "spirit-origin-list:v1"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
def frame(pg): return pg.evaluate("(() => { const f = document.querySelector('.fav-frame'); const r = f.getBoundingClientRect(); return {hidden: f.hidden, cls: f.className, x: r.x, y: r.y, w: r.width, h: r.height}; })()")
def dossier(pg): return pg.evaluate("(() => { const r = document.getElementById('dossier').getBoundingClientRect(); return {x: r.x, y: r.y, w: r.width, h: r.height}; })()")
def anims(pg, sel): return pg.evaluate(f"Array.from(document.querySelectorAll('{sel}')).reduce((n, e) => n + e.getAnimations().filter((a) => a.playState === 'running' || a.playState === 'paused').length, 0)")

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1360, "height": 900}); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    servants = lambda: pg.evaluate(f"JSON.stringify((JSON.parse(localStorage.getItem('{KEY}') || 'null') || {{}}).servants || null)")
    ids = pg.evaluate("Array.from(document.querySelectorAll('#list > .row')).map((r) => r.dataset.id)")
    A, B = ids[0], ids[1]
    pg.click(f'#list [data-id="{A}"]'); pg.wait_for_timeout(700)
    roster0 = servants()
    btn = pg.locator("#dossier .fav-btn")
    check("the servant page has a Favourite heart, not pressed yet", btn.count() == 1 and btn.get_attribute("aria-pressed") == "false" and frame(pg)["hidden"])
    btn.click(); pg.wait_for_timeout(500)
    check("pressed: it's on, saved under its own key, with an Undo", pg.locator("#dossier .fav-btn").get_attribute("aria-pressed") == "true"
          and pg.evaluate(f"localStorage.getItem('{KEY}:favourite')") == A and "favourite servant now" in pg.locator("#toast").inner_text())
    f, d = frame(pg), dossier(pg)
    check(f"the halo sits around the page, just outside it ({f}, {d})", not f["hidden"] and abs(f["x"] - (d["x"] - 7)) < 1.5 and abs(f["w"] - (d["w"] + 14)) < 1.5 and abs(f["y"] - (d["y"] - 7)) < 1.5)
    check(f"its ring, glow and motes are moving ({anims(pg, '.fav-frame .fv-ring > b, .fav-frame .fv-glow, .fav-frame .fv-motes > s')})", anims(pg, ".fav-frame .fv-ring > b, .fav-frame .fv-glow, .fav-frame .fv-motes > s") >= 10)
    col = pg.evaluate("[getComputedStyle(document.documentElement).getPropertyValue('--p2').trim(), getComputedStyle(document.querySelector('.fv-burst, .fv-ring')).backgroundImage.slice(0, 60)]")
    check(f"in the colours of the servant's picture (--p1..3) ({col})", col[0] != "" and "gradient" in col[1])
    check("their roster row has a heart, and says so to screen readers", pg.locator(f'#list .row.is-fav[data-id="{A}"] .fav-mark').count() == 1 and "your favourite" in pg.locator(f'#list .row[data-id="{A}"]').inner_text())
    # a click on the page: a burst of light where it was pressed
    h = pg.locator("#dossier h2").bounding_box()
    pg.mouse.click(h["x"] + 10, h["y"] + 10); pg.wait_for_timeout(60)
    burst = pg.evaluate("(() => { const b = document.querySelector('.fv-burst'); if (!b) return null; const f = document.querySelector('.fav-frame').getBoundingClientRect(); return {x: f.x + parseFloat(b.style.left), y: f.y + parseFloat(b.style.top), n: b.children.length, a: b.getAnimations({subtree: true}).length}; })()")
    check(f"clicking the page makes a burst where you clicked ({burst})", burst and abs(burst["x"] - (h["x"] + 10)) < 2 and abs(burst["y"] - (h["y"] + 10)) < 2 and burst["n"] == 12 and burst["a"] == 12)
    for i in range(8): pg.mouse.click(h["x"] + 20 + i * 15, h["y"] + 12); pg.wait_for_timeout(100)
    check(f"at most four at once ({pg.locator('.fv-burst').count()})", pg.locator(".fv-burst").count() <= 4)
    pg.wait_for_timeout(1800)
    check("and they clear away", pg.locator(".fv-burst").count() == 0)
    # another servant: no halo; and making them the favourite moves it
    pg.click(f'#list [data-id="{B}"]'); pg.wait_for_timeout(700)
    check("another servant's page has no halo", frame(pg)["hidden"] and pg.locator("#dossier .fav-btn").get_attribute("aria-pressed") == "false")
    pg.mouse.click(h["x"] + 10, h["y"] + 10); pg.wait_for_timeout(60)
    check("and clicking it makes no burst", pg.locator(".fv-burst").count() == 0)
    pg.click("#dossier .fav-btn"); pg.wait_for_timeout(400)
    t = pg.locator("#toast").inner_text()
    check(f"one favourite at a time: the heart moves ({t!r})", pg.evaluate(f"localStorage.getItem('{KEY}:favourite')") == B and "in place of" in t
          and pg.locator("#list .row.is-fav").count() == 1 and pg.locator(f'#list .row.is-fav[data-id="{B}"]').count() == 1 and not frame(pg)["hidden"])
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(400)
    check("Undo gives the heart back to the one before", pg.evaluate(f"localStorage.getItem('{KEY}:favourite')") == A and frame(pg)["hidden"] and pg.locator(f'#list .row.is-fav[data-id="{A}"]').count() == 1)
    # other pages: no halo
    pg.click(f'#list [data-id="{A}"]'); pg.wait_for_timeout(500)
    check("back on the favourite: the halo again", not frame(pg)["hidden"])
    pg.evaluate("location.hash = '#ranking'"); pg.wait_for_timeout(600)
    check("on another page the halo is hidden (so it doesn't animate)", frame(pg)["hidden"])
    pg.evaluate("location.hash = '#servants'"); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click(f'#list [data-id="{A}"]'); pg.wait_for_timeout(700)
    check("kept after a reload", pg.locator("#dossier .fav-btn").get_attribute("aria-pressed") == "true" and not frame(pg)["hidden"])
    check("the roster's servants weren't touched", servants() == roster0)
    pg.locator("#dossier").screenshot(path=f"{sp}/out/v60-favourite.png")
    # turning it off
    pg.click("#dossier .fav-btn"); pg.wait_for_timeout(400)
    check("pressed again: no favourite", pg.evaluate(f"localStorage.getItem('{KEY}:favourite')") is None and frame(pg)["hidden"] and pg.locator("#list .row.is-fav").count() == 0)
    pg.close()

    # ---------- a phone: the page fills the screen, the halo sits just inside it ----------
    ph = b.new_page(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); ph.on("pageerror", lambda e: errs.append(str(e)))
    ph.add_init_script(INIT + f"localStorage.setItem('{KEY}:favourite', '{A}');"); ph.route("https://**", lambda r: r.abort())
    ph.goto(SEEDED + "#servants"); ph.wait_for_timeout(1500)
    check("phone: no halo while the list shows", frame(ph)["hidden"])
    ph.locator(f'#list [data-id="{A}"]').tap(); ph.wait_for_timeout(900)
    f = frame(ph)
    check(f"phone: the halo just inside the screen's edge ({f})", not f["hidden"] and "in" in f["cls"].split() and f["x"] >= 0 and f["x"] + f["w"] <= 390.5)
    ph.close()

    # ---------- reduced motion: the ring and glow stay still, no motes, no bursts ----------
    rm = b.new_page(viewport={"width": 1360, "height": 900}, reduced_motion="reduce"); rm.on("pageerror", lambda e: errs.append(str(e)))
    rm.add_init_script(INIT + f"localStorage.setItem('{KEY}:favourite', '{A}');"); rm.route("https://**", lambda r: r.abort())
    rm.goto(SEEDED + "#servants"); rm.wait_for_timeout(1500)
    rm.click(f'#list [data-id="{A}"]'); rm.wait_for_timeout(700)
    h = rm.locator("#dossier h2").bounding_box(); rm.mouse.click(h["x"] + 10, h["y"] + 10); rm.wait_for_timeout(60)
    check("reduced motion: the halo is there, still, without motes or bursts", not frame(rm)["hidden"] and anims(rm, ".fav-frame .fv-ring > b, .fav-frame .fv-glow") == 0
          and rm.evaluate("getComputedStyle(document.querySelector('.fv-motes')).display") == "none" and rm.locator(".fv-burst").count() == 0)
    check(f"no page errors ({errs[:2]})", not errs)
    b.close()

print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
sys.exit(1 if fails or errs else 0)
