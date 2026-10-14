import os
import sys, tempfile, json, re
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
def atlas(r):
    u = r.request.url
    f = "ph_buff.png" if "BuffIcons" in u else "ph_skill.png" if "SkillIcons" in u else "ph_face.png" if "/Faces/" in u else "ph_graph.png"
    r.fulfill(path=f"{sp}/{f}", content_type="image/png")
def store(pg): return json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") or '{"servants": [], "parties": []}')
def doc(pg, sid): return next((d for d in store(pg)["servants"] if d.get("id") == sid), None)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
def page(p, w=1360, h=1000, init="", mobile=False):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT + init)
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", atlas)
    return ctx, pg
def stat(pg, i): return int(re.sub(r"\D", "", pg.locator("#dossier .stat-grid .stat").nth(i).locator(".v").inner_text()))
LIST = "() => document.querySelector('#list').getAnimations({subtree: true}).map(a => a.playState).reduce((m, s) => (m[s] = (m[s] || 0) + 1, m), {})"

with sync_playwright() as p:
    # ================= 0.18.1: 15 fps =================
    ctx, pg = page(p, w=1800, h=1000, init="localStorage.setItem('spirit-origin-list:v1:fps','30');")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1600); pg.keyboard.press("Escape")
    guide = lambda: pg.evaluate("(() => { const g = [...document.querySelectorAll('.masthead button')].find(b => b.textContent.trim() === 'Guide'); const r = g.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; })()")
    logo = pg.evaluate("document.querySelector('.brand-logo').getBoundingClientRect().bottom")
    g30 = guide()
    pg.click("#fps-btn"); pg.wait_for_timeout(500)
    g15 = guide()
    check(f"the top buttons sit under the logo and don't move when switching to 15 fps ({g30} → {g15})", g30 == g15 and g15[1] > logo)
    pg.click("#fps-btn"); pg.wait_for_timeout(400)
    check("and at 60 fps", guide() == g30)
    pg.click("#fps-btn"); pg.wait_for_timeout(300); pg.click("#fps-btn"); pg.wait_for_timeout(400)
    check("back at 15 fps", pg.locator("#fps-btn").get_attribute("data-fps") == "15")
    before = pg.evaluate(LIST)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(800)
    pg.evaluate("window.scrollTo(0, 0)"); pg.wait_for_timeout(1000)
    after = pg.evaluate(LIST)
    check(f"at 15 fps, list animations run again after scrolling away and back ({before} → {after})", after.get("running", 0) == before.get("running", 0) and not after.get("paused"))
    ctx.close()

    # ================= 0.19.0: favourite Craft Essences =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500); pg.keyboard.press("Escape")
    pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(700)
    check("five favourite Craft Essence slots under the stats", pg.locator("#dossier .fce .fce-card").count() == 5 and pg.locator('#dossier .fce [data-action="fce-add"]').count() == 5)
    hp0, atk0 = stat(pg, 0), stat(pg, 1)
    pg.locator('#dossier [data-action="fce-add"]').first.click(); pg.wait_for_timeout(400)
    check("+ opens the Craft Essence picker with pictures", pg.locator(".cep").is_visible() and pg.locator(".cep-grid .pc-card img").count() > 20)
    pg.fill(".cep [data-cep-q]", "kaleidoscope"); pg.wait_for_timeout(400)
    check("search finds Kaleidoscope", pg.locator('.cep [data-cep="34"]').count() == 1)
    pg.click('.cep [data-cep="34"]'); pg.wait_for_timeout(800)
    d = doc(pg, "space-ereshkigal")
    check("picking saves it as favourite 1", pg.locator(".cep").is_hidden() and d and (d.get("favCe") or [None])[0] == 34)
    check("adding doesn't change the stats yet", stat(pg, 0) == hp0 and stat(pg, 1) == atk0)
    pg.locator('#dossier [data-action="fce-on"][data-i="0"]').click(); pg.wait_for_timeout(500)
    check(f"equipping Kaleidoscope adds ATK 2,000 ({atk0} → {stat(pg, 1)}) and no HP", stat(pg, 1) == atk0 + 2000 and stat(pg, 0) == hp0)
    sub = pg.locator("#dossier .stat-grid .stat").nth(1).locator(".sub").inner_text()
    pg.wait_for_timeout(400)
    check(f"the ATK line shows the Craft Essence part ({sub!r})", "+ CE 2,000" in sub and "Craft Essence included" in pg.locator("#dossier .stat-grid").locator("xpath=ancestor::section[1]").locator("h3").inner_text())
    check("saved as equipped", doc(pg, "space-ereshkigal").get("favCeOn") == 0)
    pg.locator('#dossier [data-action="fce-add"]').first.click(); pg.wait_for_timeout(300)
    pg.click('.cep [data-cep-r="5"]'); pg.wait_for_timeout(300)
    pg.fill(".cep [data-cep-q]", "prisma cosmos"); pg.wait_for_timeout(400)
    pg.click('.cep [data-cep="40"]'); pg.wait_for_timeout(400)
    pg.locator('#dossier [data-action="fce-on"][data-i="1"]').click(); pg.wait_for_timeout(400)
    check(f"equipping another one swaps it: Prisma Cosmos HP +1,500 ATK +1,000 ({stat(pg, 0)}, {stat(pg, 1)})", stat(pg, 0) == hp0 + 1500 and stat(pg, 1) == atk0 + 1000 and pg.locator("#dossier .fce-card.on").count() == 1)
    pg.locator('#dossier [data-action="fce-on"][data-i="1"]').click(); pg.wait_for_timeout(800)
    check("pressing the equipped one takes it off", stat(pg, 0) == hp0 and stat(pg, 1) == atk0 and doc(pg, "space-ereshkigal").get("favCeOn") is None)
    pg.locator('#dossier [data-action="fce-on"][data-i="0"]').click(); pg.wait_for_timeout(300)
    pg.wait_for_timeout(600)  # past the old half-second save delay, so the roster holds a fresh copy of the servant
    pg.locator('#dossier .fce-cell').first.hover(); pg.locator('#dossier [data-action="fce-del"][data-i="0"]').click(); pg.wait_for_timeout(800)
    d = doc(pg, "space-ereshkigal")
    check("× removes a favourite (and takes it off)", d["favCe"][0] is None and d.get("favCeOn") is None and stat(pg, 1) == atk0)
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(200)
    d = doc(pg, "space-ereshkigal")
    check("Undo puts it back, equipped, on screen and saved at once (0.20.0)", d["favCe"][0] == 34 and d.get("favCeOn") == 0 and stat(pg, 1) == atk0 + 2000 and pg.locator("#dossier .fce-card.on").count() == 1)
    pg.locator('#dossier [data-action="fce-add"]').first.click(); pg.wait_for_timeout(300)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc closes the picker and leaves the servant open", pg.locator(".cep").is_hidden() and pg.locator("#dossier h2").first.inner_text() == "Space Ereshkigal")
    pg.reload(); pg.wait_for_timeout(1500); pg.keyboard.press("Escape"); pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(600)
    check("after reload the favourites and the equipped one are still there", pg.locator("#dossier .fce-card.on").count() == 1 and stat(pg, 1) == atk0 + 2000)
    pg.fill("#fou-atk", "1000"); pg.dispatch_event("#fou-atk", "change"); pg.wait_for_timeout(500)
    check(f"Fou and the Craft Essence add up ({stat(pg, 1)})", stat(pg, 1) == atk0 + 2000 + 1000)
    ctx.close()

    # ================= 0.19.0: parties =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#parties"); pg.wait_for_timeout(1500)
    pg.locator('[data-action="edit-party"]').first.click(); pg.wait_for_timeout(500)
    check("every Craft Essence field in the party form has a picture picker", pg.locator("#party-form .ce-pick").count() == 7)
    pg.locator("#party-form .ce-pick").first.click(); pg.wait_for_timeout(400)
    pg.fill(".cep [data-cep-q]", "black grail"); pg.wait_for_timeout(400)
    first = pg.locator(".cep .cep-grid [data-cep]").first
    name = first.locator(".pc-n").inner_text(); first.click(); pg.wait_for_timeout(300)
    check(f"picking fills the field ({name!r}) and shows its picture", pg.input_value("#pt-ce0") == name and pg.locator("#party-form .ce-pick.has img").count() == 1)
    pg.fill("#pt-ce1", "Kaleidoscope (MLB)"); pg.wait_for_timeout(200)
    check("a typed name is recognised too", pg.locator('#party-form .ce-pick[data-ce-for="pt-ce1"].has').count() == 1)
    pg.locator('#party-form button[type="submit"]').click(); pg.wait_for_timeout(600)
    p0 = store(pg)["parties"]
    check("saved as names, like before", any((x.get("ce") or [None])[0] == name for x in p0))
    imgs = pg.locator("#parties .fc-ce.has-img")
    check(f"the party card shows the Craft Essences with pictures ({imgs.count()})", imgs.count() >= 2)
    ctx.close()

    # ================= phone =================
    ctx, pg = page(p, w=390, h=860, mobile=True)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1400)
    pg.click('#list .row[data-id="ereshkigal"]'); pg.wait_for_timeout(700)
    row = pg.locator("#dossier .fce-row"); bb = row.bounding_box()
    check(f"phone: the five slots fit the screen ({bb and round(bb['width'])})", bb and bb["x"] >= 0 and bb["x"] + bb["width"] <= 390)
    pg.locator('#dossier [data-action="fce-add"]').first.click(); pg.wait_for_timeout(400)
    pb = pg.locator(".cep-panel").bounding_box()
    check("phone: the picker fills the screen", pb and pb["width"] >= 388 and pg.evaluate("document.documentElement.scrollWidth") <= 390)
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
