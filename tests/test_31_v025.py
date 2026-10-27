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
    check(f"the servant page offers the kinds of icon ({kinds})", kinds[:4] == ["Face", "Servant icon", "Portrait", "Formation"] and kinds[-1].endswith("Fan art"))
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
    # fan art
    pg.set_input_files('#dossier input[data-icon-fan]', os.path.join(sp, "ph_art.png")); pg.wait_for_timeout(1500)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    av = pg.evaluate(AVA, "cu-chulainn-alter")
    check(f"fan art is saved and becomes the icon ({av[0]}, {cu.get('iconKind')})", av[0].startswith("avatar k-fan") and cu.get("iconKind") == "fan" and "fan" in cu.get("art", {}))
    check(f"the Icon stage stays as it was ({cu.get('artStage')})", cu.get("artStage") == "3")
    pg.click('#dossier [data-action="icon-fan-del"]'); pg.wait_for_timeout(700)
    cu = next(x for x in pg.evaluate(LS)["servants"] if x["id"] == "cu-chulainn-alter")
    check(f"Remove takes the fan art away and the face is back ({pg.evaluate(AVA, 'cu-chulainn-alter')[0]})", "fan" not in cu.get("art", {}) and "iconKind" not in cu and pg.evaluate(AVA, "cu-chulainn-alter")[0].startswith("avatar k-face"))

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
