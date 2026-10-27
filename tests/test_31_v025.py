import os
# 0.25.0: servant icons (the game's faces for the stage marked Icon, or a framed icon, portrait, formation, the stage
# picture or fan art), five Craft Essences that suit a servant in Past Chaldea, and Sodom's Beast/Draco's own backdrop (the Beast of Revelation).
# (The support picker is in test_26, the zoom in test_24, the board's servant names in test_29.)
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
src = open(os.path.join(sp, "atlas_data.js"), encoding="utf-8").read()
def jsconst(name): return json.loads(re.search(r"^const " + name + r" = (.*);$", src, re.M).group(1))
ATLAS = {x["no"]: x for x in jsconst("ATLAS_S")}
CU = ATLAS[98]
loaded = []
def static(r):
    u = r.request.url; loaded.append(u)
    if "status_servant_1" in u and "/9999" in u: return r.fulfill(status=404, body="")
    r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in u or 'NarrowFigure' in u else 'ph_face.png'}", content_type="image/png")
def page(b, w=1440, h=900, mobile=False, dark=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile, color_scheme="dark" if dark else "light")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://static.atlasacademy.io/**", static)
    return ctx, pg
AVA = "(id) => { const a = document.querySelector(`#list [data-id=\"${id}\"] .avatar`); if (!a) return null; const i = a.tagName === 'IMG' ? a : a.querySelector('img'); return [a.className, (i.getAttribute('src') || '').replace('https://static.atlasacademy.io/NA/', '')]; }"
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = page(b)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    # ---------- icons ----------
    av = pg.evaluate(AVA, "cu-chulainn-alter")
    check(f"next to the name: the game's face for the icon's stage ({av})", av[0].startswith("avatar k-face") and av[1] == f"Faces/f_{CU['id']}0.png")
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(900)
    head = pg.evaluate("(() => { const a = document.querySelector('#dossier .d-head .avatar'); return a && a.getAttribute('src'); })()")
    check(f"and in the servant page's heading ({(head or '')[-24:]})", head and head.endswith(f"f_{CU['id']}0.png"))
    kinds = pg.evaluate("[...document.querySelectorAll('#dossier .ick-row .ick')].map(b => b.textContent.trim())")
    check(f"the servant page offers the kinds of icon ({kinds})", kinds[:4] == ["Face", "Servant icon", "Portrait", "Formation"] and not any("Fan art" in k for k in kinds))
    want = {"frame": ("avatar k-frame r5", f"Faces/f_{CU['id']}0.png"), "portrait": ("avatar k-portrait", f"Servants/Status/{CU['id']}/status_servant_1.png"), "formation": ("avatar k-formation", f"NarrowFigure/{CU['id']}/{CU['id']}@0.png")}
    for k, (cls, path) in want.items():
        pg.click(f'#dossier [data-action="icon-kind"][data-k="{k}"]'); pg.wait_for_timeout(500)
        av = pg.evaluate(AVA, "cu-chulainn-alter")
        check(f"{k}: {av}", av[0].startswith(cls) and av[1] == path)
        if k == "frame": check("the framed icon carries the class emblem", pg.locator('#list [data-id="cu-chulainn-alter"] .avatar.k-frame .avf-cls').count() == 1)
    check("the choice is saved on the servant", next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter").get("iconKind") == "formation")
    # the stage marked Icon decides which face: stage 3
    data = pg.evaluate(LS); cu = next(x for x in data["servants"] if x["id"] == "cu-chulainn-alter")
    cu["art"] = {"1": "https://static.atlasacademy.io/NA/" + CU["im"][0], "3": "https://static.atlasacademy.io/NA/" + CU["im"][2]}; cu["artStage"] = "3"; cu.pop("iconKind", None)
    pg.evaluate("(d) => localStorage.setItem('spirit-origin-list:v1', JSON.stringify(d))", data); pg.reload(); pg.wait_for_timeout(1500)
    av = pg.evaluate(AVA, "cu-chulainn-alter")
    check(f"the stage marked Icon picks the face: stage 3 ({av[1]})", av[1] == f"Faces/f_{CU['id']}2.png")
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(900)
    pg.click('#dossier [data-action="icon-kind"][data-k="art"]'); pg.wait_for_timeout(500)
    av = pg.evaluate(AVA, "cu-chulainn-alter")
    check(f"Stage art shows the stage picture as before ({av})", av[1].endswith(CU["im"][2]) and "k-" not in av[0])
    # fan art: a tile of its own after the costumes
    pg.click('#dossier [data-action="icon-kind"][data-k="face"]'); pg.wait_for_timeout(400)
    order = pg.evaluate("[...document.querySelectorAll('#dossier .stage-list > .stage-btn')].map(b => b.dataset.slot || b.dataset.action)")
    check(f"Fan art has a tile at the end of the stages and costumes ({order})", order[-1] == "fan" and "add-costume" in order and order.index("add-costume") < order.index("fan"))
    pg.click('#dossier [data-action="stage"][data-slot="fan"]'); pg.wait_for_timeout(500)
    check("its empty frame asks for a picture of your own", "Add fan art" in pg.locator("#dossier .art-frame").inner_text())
    pg.set_input_files('#dossier input[data-art-file="fan"]', os.path.join(sp, "ph_art.png")); pg.wait_for_timeout(1500)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    check(f"fan art is saved like a stage picture, and the Icon stays where it was ({cu.get('artStage')})", "fan" in cu.get("art", {}) and cu.get("artStage") == "3")
    pg.click('#dossier [data-action="stage"][data-slot="2"]'); pg.wait_for_timeout(300)
    pg.click('#dossier [data-action="stage"][data-slot="fan"]'); pg.wait_for_timeout(700)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    av = pg.evaluate(AVA, "cu-chulainn-alter")
    check(f"clicking its tile makes it the icon ({av[0]}, {cu.get('artStage')})", av[0].startswith("avatar k-fan") and cu.get("artStage") == "fan" and pg.locator('#dossier .stage-btn[data-slot="fan"] .thumb.is-icon').count() == 1)
    check("the icon row says the fan art is the icon", "fan art is the icon" in pg.locator("#dossier .ick-row").inner_text())
    pg.click('#dossier [data-action="art-remove"][data-slot="fan"]'); pg.wait_for_timeout(300)
    pg.click('#dossier [data-action="art-remove-go"]'); pg.wait_for_timeout(900)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    av = pg.evaluate(AVA, "cu-chulainn-alter")
    check(f"Remove takes the fan art away and a stage's face is back ({av}, {cu.get('artStage')})", "fan" not in cu.get("art", {}) and cu.get("artStage") in ("1", "3") and av[0].startswith("avatar k-face"))
    # fan art picked as the icon by the first 0.25.0 build (iconKind "fan") still shows, and lets go when a stage is clicked
    pg.click('#dossier [data-action="stage"][data-slot="fan"]'); pg.wait_for_timeout(400)
    pg.set_input_files('#dossier input[data-art-file="fan"]', os.path.join(sp, "ph_art.png")); pg.wait_for_timeout(1500)
    data = pg.evaluate(LS); cu = next(x for x in data["servants"] if x["id"] == "cu-chulainn-alter"); cu["iconKind"] = "fan"; cu["artStage"] = "3"
    pg.evaluate("(d) => localStorage.setItem('spirit-origin-list:v1', JSON.stringify(d))", data); pg.reload(); pg.wait_for_timeout(1500)
    check("an older fan art icon still shows", pg.evaluate(AVA, "cu-chulainn-alter")[0].startswith("avatar k-fan"))
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(900)
    pg.click('#dossier [data-action="stage"][data-slot="3"]'); pg.wait_for_timeout(700)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    check(f"and a click on a stage hands the icon back ({pg.evaluate(AVA, 'cu-chulainn-alter')})", "iconKind" not in cu and pg.evaluate(AVA, "cu-chulainn-alter")[1] == f"Faces/f_{CU['id']}2.png")

    # ---------- costumes: the icon is the costume's own, found by its name ----------
    A = "https://static.atlasacademy.io/NA/"
    data = pg.evaluate(LS)
    data["servants"].insert(0, {"id": "mash", "name": "Mash Kyrielight", "cls": "Shielder", "rarity": 4, "level": 90, "npLevel": 5, "atlas": 1, "costumeSlots": 5, "artStage": "c2",
        "art": {"1": A + "CharaGraph/800100/800100a@1.png", "c": A + "Status/x/mash-c.png", "c2": A + "Status/x/mash-c2.png", "c3": A + "Status/x/mash-c3.png", "c4": A + "Status/x/mash-c4.png", "c5": A + "CharaGraph/800150/800150a.png"},
        "artNames": {"c": "Swimsuit of Perpetual Summer", "c2": "Swimsuit of Perpetual Summer Ver.02", "c3": "Bright Voyager", "c4": "Swimsuit of Perpetual Summer Ver.03"}})
    pg.evaluate("(d) => localStorage.setItem('spirit-origin-list:v1', JSON.stringify(d))", data); pg.reload(); pg.wait_for_timeout(1500)
    av = pg.evaluate(AVA, "mash")
    check(f"Mash with Swimsuit of Perpetual Summer Ver.02 as Icon: that swimsuit's face, NA's Ver. 02 (No. 800160) ({av})", av[1] == "Faces/f_8001600.png")
    pg.click('#list [data-id="mash"]'); pg.wait_for_timeout(900)
    got = {}
    for k in ["c", "c3", "c4", "c5", "c2"]:
        pg.click(f'#dossier [data-action="stage"][data-slot="{k}"]'); pg.wait_for_timeout(450); got[k] = pg.evaluate(AVA, "mash")
    check(f"Swimsuit of Perpetual Summer is NA's Swimsuit of Everlasting Summer ({got['c'][1]})", got["c"][1] == "Faces/f_8001300.png")
    check(f"Bright Voyager is Bright Voyager ({got['c3'][1]})", got["c3"][1] == "Faces/f_8001700.png")
    check(f"a Ver.03 NA doesn't have uses its own picture ({got['c4']})", got["c4"][1].endswith("mash-c4.png") and "k-" not in got["c4"][0])
    check(f"an unnamed slot with NA's picture is that costume (Ortinax (Refurbished)) ({got['c5'][1]})", got["c5"][1] == "Faces/f_8001500.png")
    for k, path in {"portrait": "Servants/Status/800100/status_servant_14.png", "formation": "NarrowFigure/800160/800160@0.png"}.items():
        pg.click(f'#dossier [data-action="icon-kind"][data-k="{k}"]'); pg.wait_for_timeout(450)
        check(f"its {k} is the costume's too ({pg.evaluate(AVA, 'mash')[1]})", pg.evaluate(AVA, "mash")[1] == path)
    pg.click('#dossier [data-action="icon-kind"][data-k="face"]'); pg.wait_for_timeout(400)
    on = pg.evaluate("[...document.querySelectorAll('#dossier .cpk[aria-pressed=\"true\"]')].map(b => b.title || b.textContent.trim())")
    check(f"under the costume's name, NA's costume it was matched to ({on})", on == ["Swimsuit of Everlasting Summer Ver. 02"])
    pg.click('#dossier [data-action="stage"][data-slot="c4"]'); pg.wait_for_timeout(450)
    check("the Ver.03 shows Not on NA", pg.evaluate("[...document.querySelectorAll('#dossier .cpk[aria-pressed=\"true\"] span')].map(s => s.textContent.trim())") == ["Not on NA"])
    pg.click('#dossier [data-action="cos-pick"][data-cos="800140"]'); pg.wait_for_timeout(600)
    m = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "mash")
    check(f"picking one by hand is kept, and the icon follows ({m.get('artCos')}, {pg.evaluate(AVA, 'mash')[1]})", m.get("artCos") == {"c4": 800140} and pg.evaluate(AVA, "mash")[1] == "Faces/f_8001400.png")
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(600)
    m = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "mash")
    check(f"and Undo takes it back ({m.get('artCos')})", "artCos" not in m and pg.evaluate(AVA, "mash")[1].endswith("mash-c4.png"))

    # ---------- Craft Essences that suit a servant ----------
    pg.click("#tab-past"); pg.wait_for_timeout(700)
    if not pg.locator(".pc-mine input").is_checked(): pg.locator(".pc-mine input").check(); pg.wait_for_timeout(400)  # yours too
    pg.fill('[data-pc-q="q"]', "Altria Caster"); pg.wait_for_timeout(500)
    pg.locator('#view-past [data-action="pc-open"][data-no="284"]').first.click(); pg.wait_for_timeout(800)
    rows = pg.evaluate("[...document.querySelectorAll('.ces-row')].map(r => [r.querySelector('b').textContent, r.querySelector('small').textContent])")
    check(f"Castoria (a support): five Craft Essences for NP at the start and NP Gain ({[r[0] for r in rows]})", len(rows) == 5 and "NP 100% at the start" in rows[0][1] and all("at the start" in r[1] or "NP Gain" in r[1] for r in rows))
    pg.click(".pcd-x"); pg.wait_for_timeout(400)
    pg.fill('[data-pc-q="q"]', "Altria Pendragon"); pg.wait_for_timeout(500)
    pg.locator('#view-past [data-action="pc-open"][data-no="2"]').first.click(); pg.wait_for_timeout(800)
    rows = pg.evaluate("[...document.querySelectorAll('.ces-row b')].map(b => b.textContent)")
    check(f"Altria (AoE Buster): NP at the start and NP Strength come first ({rows})", len(rows) == 5 and set(rows[:2]) == {"Kaleidoscope", "The Black Grail"})
    note = pg.locator(".ces-note").inner_text()
    check("it says how it's worked out, and that it isn't a usage chart", "max limit break" in note and "usage" in note)
    pg.locator(".ces-ce").first.click(); pg.wait_for_timeout(600)
    check("a Craft Essence opens its page, with a way back", pg.locator(".pcd-back button").count() == 1 and "Altria Pendragon" in pg.locator(".pcd-back").inner_text())
    pg.click(".pcd-back button"); pg.wait_for_timeout(600)
    check("which goes back to the servant", "Altria Pendragon" in pg.locator(".pcd-name").first.inner_text() and pg.locator(".ces-sec").count() == 1)
    fav = pg.locator('.ces-fav').first
    if fav.count():
        no = int(fav.get_attribute("data-no")); sid = fav.get_attribute("data-id")
        fav.click(); pg.wait_for_timeout(700)
        s = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == sid)
        check(f"+ Favourite keeps it among the servant's favourite Craft Essences ({s.get('favCe')})", no in (s.get("favCe") or []))
        pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(600)
        s = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == sid)
        check("and Undo takes it out", no not in (s.get("favCe") or []))
    else:
        check("a servant on your list can keep one as a favourite", False)
    pg.click(".pcd-x"); pg.wait_for_timeout(300)
    ctx.close()

    # ---------- Sodom's Beast/Draco ----------
    ctx, pg = page(b, dark=True)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1200)
    data = pg.evaluate(LS)
    data["servants"].insert(0, {"id": "draco", "name": "Sodom's Beast/Draco", "cls": "Beast", "rarity": 5, "level": 90, "npLevel": 1, "atlas": 377})
    pg.evaluate("(d) => localStorage.setItem('spirit-origin-list:v1', JSON.stringify(d))", data); pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="draco"]'); pg.wait_for_timeout(1500)
    bg = pg.evaluate("(() => { const e = document.getElementById('own-bg'); return e ? [e.classList.contains('on'), e.dataset.m, e.querySelectorAll('.ob-rose').length, e.querySelectorAll('.ob-cup').length, e.querySelectorAll('.ob-star').length, e.querySelectorAll('.ob-petal').length, getComputedStyle(e.querySelector('.ob-rose')).animationName, getComputedStyle(e.querySelector('.ob-petal')).animationName, getComputedStyle(e).position, getComputedStyle(e.querySelector('.ob-cup')).backgroundImage.slice(0, 15)] : null; })()")
    check(f"Sodom's Beast/Draco has a backdrop of her own: a turning rose window, her golden cup, falling stars and rose petals ({bg})", bg and bg[0] and bg[1] == "revelation" and bg[2] == 2 and bg[3] == 1 and bg[4] >= 10 and bg[5] >= 14 and bg[6] == "ob-spin" and bg[7] == "ob-petal" and bg[8] == "fixed" and bg[9].startswith('url("data:'))
    pg.screenshot(path=os.environ.get("SHOT_DIR", "/tmp") + "/draco-bg.png")
    sc = pg.evaluate("(() => { const c = document.querySelector('#dossier .scene .own-scene .os-cup'), a = document.querySelector('#dossier .scene > .art'); if (!c || !a) return null; const r = c.getBoundingClientRect(), s = document.querySelector('#dossier .scene').getBoundingClientRect(); return [getComputedStyle(c).backgroundImage.slice(0, 15), +getComputedStyle(c).opacity > .5, r.left >= s.left && r.right <= s.right && r.top >= s.top && r.bottom <= s.bottom, +getComputedStyle(c.closest('.own-scene')).zIndex < +getComputedStyle(a).zIndex, document.querySelectorAll('#dossier .own-scene').length]; })()")
    check(f"her art panel has the golden cup too, inside the panel and behind the pictures ({sc})", sc and sc[0].startswith('url("data:') and sc[1] and sc[2] and sc[3] and sc[4] == 1)
    pg.click('#list [data-id="space-ereshkigal"]'); pg.wait_for_timeout(1200)
    check("Space Ereshkigal keeps the Beast's rainbow waves", not pg.evaluate("(() => { const e = document.getElementById('own-bg'); return !!e && e.classList.contains('on'); })()"))
    check("and her art panel has no cup", not pg.evaluate("!!document.querySelector('#dossier .own-scene')"))
    pg.click('#list [data-id="draco"]'); pg.wait_for_timeout(1000)
    pg.click("#tab-story"); pg.wait_for_timeout(800)
    on_story = pg.evaluate("(() => { const e = document.getElementById('own-bg'); return [!!e && e.classList.contains('on'), document.documentElement.classList.contains('story-on')]; })()")
    check(f"it steps aside where the Story look is on ({on_story})", not (on_story[0] and on_story[1]))
    ctx.close()

    # ---------- phone tiles keep a big picture ----------
    ctx, pg = page(b, 390, 844, True)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    tile = pg.evaluate("(() => { const r = document.querySelector('#list [data-id=\"cu-chulainn-alter\"]'), t = r.querySelector('.tile-art'), a = r.querySelector('.avatar'); return [t ? t.getAttribute('src').replace('https://static.atlasacademy.io/NA/', '') : null, t ? Math.round(t.getBoundingClientRect().width) : 0, a ? getComputedStyle(a).display : null, Math.round(r.getBoundingClientRect().width)]; })()")
    check(f"on a phone, Modern's tile shows the sharper portrait, not the small face blown up ({tile})", tile[0] == f"Servants/Status/{CU['id']}/status_servant_1.png" and tile[2] == "none" and abs(tile[1] - tile[3]) < 4)
    ctx.close(); b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
