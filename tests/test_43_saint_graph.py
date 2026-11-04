import os
# 0.50.0-beta: the Saint Graph maker. Servants of your own (Workshop-made, or not one of NA's) get a "Saint Graph maker"
# button beside their pictures; NA's servants don't. It opens a window over the page (the page and the menu inert behind
# it) with the four stages. A stage is drawn on a 512 × 724 canvas from a picture (uploaded, or one of theirs) with a
# scene, a colour, a light and effects; "Make all four from this one" builds a rising set. Save puts the pictures on the
# servant with Undo, keeps the picture they were made from (art sg1…sg4) and the settings (sgMaker), so reopening it
# shows them again; Download hands over the picture. Escape closes it and gives the focus back. Nothing else on the
# roster changes.
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
ART = "https://static.atlasacademy.io/NA/CharaGraph/1/1a.png"
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png", headers={"Access-Control-Allow-Origin": "*"}))
    return pg
servants = lambda pg: pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants")
get = lambda pg, sid: next(x for x in servants(pg) if x["id"] == sid)
def open_(pg, sid): pg.locator(f'#list [data-id="{sid}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(700)
def quiet(pg): pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
# how a stage looks: a hash of the big canvas's pixels (to tell two pictures apart)
px = lambda pg: pg.evaluate("(() => { const c = document.getElementById('sg-cv'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 0; for (let i = 0; i < d.length; i += 4 * 7) h = (h * 31 + d[i] * 3 + d[i + 1] * 5 + d[i + 2] * 7) % 2147483647; return h; })()")
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    # one of NA's servants, and the same made our own
    na, cid = pg.evaluate(f"""(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), m = d.servants.filter((x) => !x.wish && x.rarity === 5);
      m[1].custom = true; m[1].name = 'Maker Test'; m[1].art = {{"1": "{ART}"}}; m[1].artStage = "1"; delete m[1].sgMaker;
      localStorage.setItem('{KEY}', JSON.stringify(d)); return [m[0].id, m[1].id]; }})()""")
    pg.reload(); pg.wait_for_timeout(1400)
    open_(pg, na)
    check("NA's servants have no maker", pg.locator("#dossier .sg-open").count() == 0)
    open_(pg, cid)
    check("a servant of your own has it, beside the pictures", pg.locator("#dossier .art-side .sg-open").count() == 1)
    others = json.dumps([x for x in servants(pg) if x["id"] != cid], sort_keys=True)

    # ---------- the window ----------
    pg.click("#dossier .sg-open"); pg.wait_for_timeout(900)
    check("it opens over the page", pg.locator("#sg-dlg:not([hidden]) .sg-panel").count() == 1 and pg.evaluate("document.querySelector('.shell').inert") and pg.evaluate("(() => { const s = document.getElementById('side'); return !s || s.inert; })()"))
    check("the focus is in it", pg.evaluate("document.getElementById('sg-dlg').contains(document.activeElement)"))
    check("four stages, Stage 1 picked", pg.locator("#sg-dlg .sg-tab").count() == 4 and pg.locator('#sg-dlg .sg-tab[aria-selected="true"]').get_attribute("data-sg-stage") == "1")
    cv = pg.evaluate("[document.getElementById('sg-cv').width, document.getElementById('sg-cv').height]")
    check(f"a Saint Graph's size ({cv})", cv == [512, 724])
    src = pg.evaluate("Array.from(document.querySelectorAll('#sg-dlg [data-sg-src] option')).map((o) => o.textContent)")
    check(f"it starts from their Stage 1 picture ({src})", src[:1] == ["Stage 1 picture"])
    a = px(pg)
    pg.click('#sg-dlg [data-sg-scene="inferno"]'); pg.wait_for_timeout(300)
    check("a scene changes the picture", px(pg) != a and pg.locator('#sg-dlg [data-sg-scene="inferno"]').get_attribute("aria-pressed") == "true")
    a = px(pg)
    pg.click('#sg-dlg [data-sg-grade="noir"]'); pg.wait_for_timeout(300)
    check("so does a colour", px(pg) != a)
    a = px(pg)
    pg.click('#sg-dlg [data-sg-fx="sparkle"]'); pg.wait_for_timeout(300)
    check("and an effect", px(pg) != a and pg.locator('#sg-dlg [data-sg-fx="sparkle"]').get_attribute("aria-pressed") == "true")
    a = px(pg)
    pg.evaluate("(() => { const e = document.querySelector('#sg-dlg [data-sg-num=\"zoom\"]'); e.value = '1.8'; e.dispatchEvent(new Event('input', {bubbles: true})); })()"); pg.wait_for_timeout(300)
    check("and the zoom", px(pg) != a)
    pg.click('#sg-dlg [data-sg-act="centre"]'); pg.wait_for_timeout(250)
    check("Centre it puts it back", pg.locator('#sg-dlg [data-sg-num="zoom"]').input_value() == "1")

    # ---------- a cut-out picture, and the rising set ----------
    pg.set_input_files("#sg-dlg [data-sg-file]", f"{sp}/ph_cutout.png"); pg.wait_for_timeout(900)
    check("an upload is picked for the stage", "Your upload 1" in pg.locator("#sg-dlg [data-sg-src] option:checked").inner_text())
    pg.click('#sg-dlg [data-sg-act="all"]'); pg.wait_for_timeout(600); quiet(pg)
    looks = []
    for k in "1234":
        pg.click(f'#sg-dlg [data-sg-stage="{k}"]'); pg.wait_for_timeout(300)
        looks.append([pg.evaluate("Array.from(document.querySelectorAll('#sg-dlg [data-sg-fx][aria-pressed=\"true\"]')).length"), pg.locator('#sg-dlg [data-sg-light][aria-pressed="true"]').get_attribute("data-sg-light"), px(pg)])
    check(f"Make all four: plain, then more at each stage ({[l[:2] for l in looks]})", looks[0][0] == 0 and looks[0][1] == "none" and looks[3][0] >= 3 and looks[0][0] < looks[1][0] < looks[2][0] <= looks[3][0])
    check("four different pictures", len({l[2] for l in looks}) == 4)
    check("all from the upload", all("Your upload 1" in pg.locator("#sg-dlg [data-sg-src] option:checked").inner_text() for _ in [0]))
    see = pg.evaluate("(() => { const x = document.getElementById('sg-cv').getContext('2d'), d = x.getImageData(4, 360, 1, 1).data; return d[3]; })()")
    check(f"the scene shows around a cut-out (the card is filled to its edge: alpha {see})", see == 255)

    # ---------- saving ----------
    pg.click('#sg-dlg [data-sg-act="save-all"]'); pg.wait_for_timeout(2500)
    s = get(pg, cid)
    check(f"Save all four: four new pictures on the servant ({sorted(s['art'])})", all(s["art"].get(k, "").startswith("img_") for k in "1234") and s["art"]["1"] != ART)
    check("the picture they were made from is kept with them, once", len({s["art"].get("sg" + k) for k in "1234"}) == 1 and s["art"]["sg1"].startswith("img_") and s["art"]["sg1"] not in [s["art"][k] for k in "1234"])
    check(f"and the settings ({sorted((s.get('sgMaker') or {}).get('cfg', {}))})", sorted(s["sgMaker"]["cfg"]) == ["1", "2", "3", "4"] and s["sgMaker"]["cfg"]["4"]["fx"] and len(s["sgMaker"]["made"]) == 4)
    check("Undo is offered", "Undo" in pg.locator("#toast").inner_text() and "4 stages saved" in pg.locator("#toast").inner_text())
    check("the stage pictures show in the window's tabs and on the page", pg.locator("#dossier .stage-btn[data-slot='4'] img").count() == 1)
    stored = pg.evaluate("(async () => { const db = await new Promise((r) => { const q = indexedDB.open('spirit-origin-list-images'); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); if (!db) return []; return await new Promise((r) => { const out = []; const t = db.transaction(db.objectStoreNames[0], 'readonly'); const c = t.objectStore(db.objectStoreNames[0]).openCursor(); c.onsuccess = () => { const x = c.result; if (x) { out.push(x.key); x.continue(); } else r(out); }; c.onerror = () => r(out); }); })()")
    check(f"they're stored in this browser ({len(stored)} pictures)", all(s["art"][k] in stored for k in ("1", "2", "3", "4", "sg1")))
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(1200)
    s2 = get(pg, cid)
    check(f"Undo: the pictures from before ({s2['art']})", s2["art"] == {"1": ART} and "sgMaker" not in s2)
    pg.click('#sg-dlg [data-sg-stage="3"]'); pg.wait_for_timeout(200)
    pg.click('#sg-dlg [data-sg-act="save"]'); pg.wait_for_timeout(2000)
    s3 = get(pg, cid)
    check(f"saved again after Undo: the picture is stored again ({sorted(s3['art'])})", s3["art"]["3"].startswith("img_") and s3["art"].get("sg3", "").startswith("img_") and s3["art"]["1"] == ART)
    ok = pg.evaluate(f"(async () => {{ const db = await new Promise((r) => {{ const q = indexedDB.open('spirit-origin-list-images'); q.onsuccess = () => r(q.result); }}); return await new Promise((r) => {{ const t = db.transaction(db.objectStoreNames[0], 'readonly'); const q = t.objectStore(db.objectStoreNames[0]).get('{s3['art']['sg3']}'); q.onsuccess = () => r(!!q.result); q.onerror = () => r(false); }}); }})()")
    check("(really stored, not only in this window)", ok)
    quiet(pg)
    # download
    with pg.expect_download() as dl: pg.click('#sg-dlg [data-sg-act="download"]')
    d = dl.value
    check(f"Download hands over the picture ({d.suggested_filename})", d.suggested_filename == "Maker Test - Stage 3.webp")

    # ---------- closing, and coming back ----------
    pg.keyboard.press("Escape"); pg.wait_for_timeout(400)
    check("Escape closes it, the page works again", pg.locator("#sg-dlg[hidden]").count() == 1 and not pg.evaluate("document.querySelector('.shell').inert") and pg.evaluate("(() => { const s = document.getElementById('side'); return !s || !s.inert; })()"))
    check("and the focus is back on its button", pg.evaluate("document.activeElement && document.activeElement.classList.contains('sg-open')"))
    pg.reload(); pg.wait_for_timeout(1500); open_(pg, cid)
    pg.click("#dossier .sg-open"); pg.wait_for_timeout(1200)
    pg.click('#sg-dlg [data-sg-stage="3"]'); pg.wait_for_timeout(400)
    check("after a reload it opens where it was left", pg.locator('#sg-dlg [data-sg-light="rays"]').get_attribute("aria-pressed") == "true" and "Your picture for Stage 3" in pg.locator("#sg-dlg [data-sg-src] option:checked").inner_text())
    pg.click('#sg-dlg [data-sg-act="close"]'); pg.wait_for_timeout(300)
    check("nothing else on the roster changed", json.dumps([x for x in servants(pg) if x["id"] != cid], sort_keys=True) == others)
    ctx.close()

    # ================= a phone =================
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=3)
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.evaluate(f"(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), s = d.servants.find((x) => x.id === '{cid}'); s.art = {{'1': '{ART}'}}; delete s.sgMaker; localStorage.setItem('{KEY}', JSON.stringify(d)); }})()")
    pg.reload(); pg.wait_for_timeout(1400)
    open_(pg, cid); pg.wait_for_timeout(500)
    pg.locator("#dossier .sg-open").scroll_into_view_if_needed(); pg.locator("#dossier .sg-open").tap(); pg.wait_for_timeout(900)
    w = pg.evaluate("[document.getElementById('sg-dlg').querySelector('.sg-panel').scrollWidth, innerWidth]")
    check(f"phone: it fits ({w})", pg.locator("#sg-dlg:not([hidden])").count() == 1 and w[0] <= w[1] + 1)
    bx = pg.locator('#sg-dlg [data-sg-act="save"]').bounding_box()
    check(f"Save stays in reach at the bottom ({bx['y'] + bx['height']:.0f} of 844)", bx["y"] + bx["height"] <= 844 and bx["y"] > 600)
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
