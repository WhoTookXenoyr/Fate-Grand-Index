import os
# 0.28.0: card frames. The SERVANTPAGE and Past Chaldea's windows each have Card frame: Off / On. Servants get the Saint
# Graph frame with the class in its diamond; Craft Essences (Past Chaldea) the open frame with the vines. The frame
# follows the rarity (gold, silver, bronze), shows ATK and HP (the Stats section's numbers; NA's max level in Past
# Chaldea), keeps up with the level, lets clicks through to the picture, stays off an empty stage, and each place
# remembers its own choice.
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
CFK = KEY + ":cardframe"
ART = "https://static.atlasacademy.io/NA/CharaGraph/1/1a.png"
def stats(pg):
    return pg.evaluate("Array.from(document.querySelectorAll('#dossier .stat-grid .stat .v')).map((e) => e.textContent.trim())")
def cf(pg, box="#dossier .art-frame"):
    return pg.evaluate("""(sel) => { const b = document.querySelector(sel); if (!b) return null;
      const t = (c) => { const e = b.querySelector(':scope > ' + c); return e ? e.textContent.trim() : null; }, r = b.getBoundingClientRect();
      return {cls: Array.from(b.classList).filter((c) => c.startsWith('cf')).sort(), frame: !!b.querySelector(':scope > .cf-img'), diamond: !!b.querySelector(':scope > .cf-cls'),
        atk: t('.cf-atk'), hp: t('.cf-hp'), sr: t('.cf-sr'), ratio: Math.round(r.width / r.height * 1000) / 1000}; }""", box)
def pick(pg, where, on):
    pg.click(f'.cf-pick [data-action="cf-set"][data-w="{where}"][data-v="{"1" if on else ""}"]'); pg.wait_for_timeout(300)
def page(ctx, w=1440, h=900):
    pg = ctx.new_page(); pg.set_viewport_size({"width": w, "height": h}); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return pg
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    # a ★5 with two stage pictures (stage 3 empty)
    sid = pg.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), s = d.servants.find((x) => !x.wish && x.rarity === 5);
      s.art = {{"1": "{ART}", "2": "{ART}?2"}}; s.artStage = "1"; localStorage.setItem('{KEY}', JSON.stringify(d)); return s.id; }}""")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(600)

    # ---------- the SERVANTPAGE ----------
    c = cf(pg)
    check(f"off by default: just the picture ({c})", c["cls"] == [] and not c["frame"])
    check("Card frame has Off and On, with Off picked", pg.locator('#dossier .cf-pick [data-action="cf-set"]').count() == 2 and pg.locator('#dossier .cf-pick [aria-pressed="true"]').get_attribute("data-v") == "")
    pick(pg, "mine", True)
    c, st = cf(pg), stats(pg)
    check(f"On: the Saint Graph frame in gold, the class in the diamond ({c['cls']})", c["cls"] == ["cf", "cf-f", "cf-gold"] and c["frame"] and c["diamond"])
    check(f"ATK and HP as the Stats section shows them ({c['atk']}, {c['hp']} / {st})", c["hp"] == st[0] and c["atk"] == st[1] and c["sr"] == f"ATK {st[1]}, HP {st[0]}")
    check(f"the card has the frame's shape ({c['ratio']})", abs(c["ratio"] - 512 / 875) < 0.01)
    check("remembered in this browser", pg.evaluate(f"JSON.parse(localStorage.getItem('{CFK}'))") == {"mine": True})
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(900)
    c, st = cf(pg), stats(pg)
    check(f"a level change moves the numbers on the card too ({c['atk']} / {st[1]})", c["atk"] == st[1] and c["hp"] == st[0] and c["frame"])
    pg.locator("#dossier .art-frame").scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    was = pg.evaluate("document.querySelector('#dossier .stage-btn[aria-pressed=\"true\"]').dataset.slot")
    box = pg.locator("#dossier .art-frame").bounding_box()
    pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] * 0.4); pg.wait_for_timeout(700)
    now = pg.evaluate("document.querySelector('#dossier .stage-btn[aria-pressed=\"true\"]').dataset.slot")
    check(f"a click on the framed picture still goes to the next stage ({was} → {now})", was != now and cf(pg)["frame"])
    pg.click('#dossier .stage-btn[data-slot="3"]'); pg.wait_for_timeout(600)
    check("an empty stage has no frame (room to add a picture)", cf(pg)["cls"] == [] and pg.locator("#dossier .art-frame.drop").count() == 1)
    pg.click('#dossier .stage-btn[data-slot="1"]'); pg.wait_for_timeout(600)
    pg.reload(); pg.wait_for_timeout(1500); pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(600)
    check("still on after a reload", cf(pg)["cls"] == ["cf", "cf-f", "cf-gold"])
    # the frame's metal follows the rarity
    for r, metal in ((3, "cf-silver"), (2, "cf-bronze"), (0, "cf-bronze")):
        pg.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')); d.servants.find((x) => x.id === '{sid}').rarity = {r}; localStorage.setItem('{KEY}', JSON.stringify(d)); }}""")
        pg.reload(); pg.wait_for_timeout(1300); pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(500)
        check(f"★{r}: {metal}", metal in cf(pg)["cls"])
    pick(pg, "mine", False)
    c = cf(pg)
    check("Off takes it all away again", c["cls"] == [] and not c["frame"] and not c["diamond"] and c["atk"] is None)

    # ---------- Past Chaldea: a servant ----------
    pg.evaluate("location.hash = '#past'"); pg.wait_for_timeout(1200)
    pg.locator('#view-past [data-action="pc-open"]').first.click(); pg.wait_for_timeout(700)
    c = cf(pg, "#pc-dlg .pcd-frame")
    check("Past Chaldea: off by default, with its own Card frame", c["cls"] == [] and pg.locator('#pc-dlg .cf-pick [data-w="pc"]').count() == 2)
    pick(pg, "pc", True)
    c = cf(pg, "#pc-dlg .pcd-frame")
    hp_max, atk_max = pg.evaluate("Array.from(document.querySelectorAll('#pc-dlg .pcd-stats tbody tr')).map((r) => r.children[2].textContent.trim())")
    check(f"a servant gets the Saint Graph frame with NA's numbers at the max level ({c['atk']}, {c['hp']})", "cf-f" in c["cls"] and c["diamond"] and c["atk"] == atk_max and c["hp"] == hp_max)
    check("each place keeps its own choice", pg.evaluate(f"JSON.parse(localStorage.getItem('{CFK}'))") == {"mine": False, "pc": True})
    pg.click('#pc-dlg .pcd-stages button[data-k="1"]'); pg.wait_for_timeout(500)
    check("another picture keeps the frame", "cf-f" in cf(pg, "#pc-dlg .pcd-frame")["cls"])
    pg.click('#pc-dlg [data-action="pc-close"]'); pg.wait_for_timeout(300)

    # ---------- Past Chaldea: a Craft Essence ----------
    pg.click('#view-past [data-action="pc-view"][data-v="ces"], #view-past [data-action="pc-view"]:not([data-v="servants"])'); pg.wait_for_timeout(800)
    pg.locator('#view-past [data-action="ce-open"]').first.click(); pg.wait_for_timeout(700)
    c = cf(pg, "#pc-dlg .pcd-art.is-ce .pcd-frame")
    hp_ce, atk_ce = pg.evaluate("Array.from(document.querySelectorAll('#pc-dlg .pcd-stats tbody tr')).map((r) => r.children[2].textContent.trim())")
    check(f"a Craft Essence gets the open frame with the vines, no diamond ({c and c['cls']})", bool(c) and "cf-o" in c["cls"] and c["frame"] and not c["diamond"])
    check(f"with its ATK and HP at the max level ({c and c['atk']}, {c and c['hp']})", bool(c) and c["atk"] == atk_ce and c["hp"] == hp_ce)
    check("and the same switch (Past Chaldea's)", pg.locator('#pc-dlg .cf-pick [data-w="pc"][aria-pressed="true"]').get_attribute("data-v") == "1")
    pick(pg, "pc", False)
    check("Off there takes it away", cf(pg, "#pc-dlg .pcd-art.is-ce .pcd-frame")["cls"] == [])
    pg.screenshot(path=f"{sp}/out/cf-ce.png")
    pg.click('#pc-dlg [data-action="pc-close"]'); pg.wait_for_timeout(300)

    # ---------- phone ----------
    ph = page(ctx, 390, 844)
    ph.goto(SEEDED + "#servants"); ph.wait_for_timeout(1200)
    ph.evaluate(f"localStorage.setItem('{CFK}', JSON.stringify({{mine: true}}))"); ph.reload(); ph.wait_for_timeout(1200)
    ph.click(f'#list [data-id="{sid}"]'); ph.wait_for_timeout(900)
    over = ph.evaluate("(() => { const d = document.querySelector('#dossier'); return d.scrollWidth - d.clientWidth; })()")
    check(f"phone: framed, nothing sideways ({over}px)", "cf-f" in (cf(ph) or {"cls": []})["cls"] and over <= 1)
    ph.screenshot(path=f"{sp}/out/cf-phone.png")
    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
