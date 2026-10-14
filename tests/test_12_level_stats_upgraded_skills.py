import os
import sys, tempfile, json, re
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
EMPTY = f"{URL}/out/Fate_Grand_Index.html"
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
def atlas(r):
    u = r.request.url
    f = "ph_buff.png" if "BuffIcons" in u else "ph_skill.png" if "SkillIcons" in u else "ph_face.png" if "/Faces/" in u else "ph_graph.png"
    r.fulfill(path=f"{sp}/{f}", content_type="image/png")
def docs(pg):
    v = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") or '{"servants": []}')["servants"]; return v if isinstance(v, list) else list(v.values())
def page(p, w=1360, h=1000):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", atlas)
    return ctx, pg
AD = open(f"{sp}/atlas_data.js").read()
ATL = json.loads(re.search(r"const ATLAS_S = (\[.*?\]);\n", AD, re.S).group(1))
BY = {x["no"]: x for x in ATL}
CURVES = json.loads(re.search(r"const ATLAS_CURVES = (\{.*?\});\n", AD, re.S).group(1))
def stat(no, lv, k):
    x = BY[no]; c = CURVES[str(x["gc"])]; b, m = x[k][0], x[k][1]; return b + (m - b) * c[lv - 1] // 1000
def sk_name(pg, i, scope="#dossier"):
    return pg.locator(f"{scope} .skills > article.skill").nth(i).locator("header h4").inner_text().split("\n")[0].strip()

with sync_playwright() as p:
    ctx, pg = page(p)
    pg.goto(EMPTY); pg.wait_for_timeout(1500)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    chip = pg.locator(".masthead .ver-chip")
    check(f"the version shows top left ({chip.inner_text()!r})", chip.is_visible() and re.fullmatch(r"v0\.\d+\.\d+ · alpha", chip.inner_text()) is not None and chip.bounding_box()["x"] < 600 and chip.bounding_box()["y"] < 80)
    chip.click(); pg.wait_for_timeout(300)
    first = pg.locator(".news-panel .cl-v").first.inner_text()
    check("pressing it opens What's new at the current version", first.startswith(chip.inner_text()[1:].split(" ")[0]) and "Upgraded skills" in pg.locator(".news-panel").inner_text())
    labels = pg.evaluate("Array.from(document.querySelectorAll('.cl-n')).map(e => e.textContent)")
    check(f"every release has a MAJOR.MINOR.PATCH number under 1.0.0 ({labels[:4]}…)", all(re.fullmatch(r"0\.\d+\.\d+", l) for l in labels) and labels[0] == chip.inner_text()[1:].split(" ")[0] and "0.15.0" in labels and labels[-1] == "0.1.0")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(150)

    # ---- Artoria Face
    pg.click("#tab-past"); pg.wait_for_timeout(600)
    opts = pg.evaluate("Array.from(document.querySelectorAll('[data-pc-f=tr] option')).map(o => o.value)")
    check("Artoria Face is a trait to filter by (Saberface is gone)", "Artoria Face" in opts and "Saberface" not in opts)
    pg.select_option('[data-pc-f="tr"]', "Artoria Face"); pg.wait_for_timeout(300)
    hits = sorted(int(x) for x in pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(b => b.dataset.no)"))
    check(f"…{len(hits)} servants have it, Altria and Morgan among them", 2 in hits and 309 in hits and hits == sorted(x["no"] for x in ATL if "Artoria Face" in x["t"]))
    pg.click('[data-action="pc-clear"]'); pg.wait_for_timeout(300)

    # ---- upgraded skills in Past Chaldea
    pg.click('.pc-card[data-no="2"]'); pg.wait_for_timeout(400)
    sw = pg.locator('.pcd-panel [data-action="pc-skup"]')
    check(f"Altria: switches on skills 2 and 3 only ({sw.count()})", sw.count() == 2 and pg.locator('.pcd-panel [data-action="pc-skup"][data-i="0"]').count() == 0)
    s2 = pg.locator('.pcd-panel [data-action="pc-skup"][data-i="1"]')
    check("the switch starts on Upgraded, with the upgraded skill", s2.get_attribute("role") == "switch" and s2.get_attribute("aria-checked") == "true" and sk_name(pg, 1, ".pcd-panel").startswith("Dragon's Core"))
    s2.click(); pg.wait_for_timeout(250)
    s2 = pg.locator('.pcd-panel [data-action="pc-skup"][data-i="1"]')
    check(f"switching off shows the skill before its upgrade ({sk_name(pg, 1, '.pcd-panel')})", s2.get_attribute("aria-checked") == "false" and sk_name(pg, 1, ".pcd-panel").startswith("Mana Burst") and "Before upgrade" in s2.inner_text())
    check("…and keeps focus on the switch", pg.evaluate("document.activeElement.dataset.action") == "pc-skup")
    s2.click(); pg.wait_for_timeout(250)
    check("and back on", sk_name(pg, 1, ".pcd-panel").startswith("Dragon's Core"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    pg.fill('[data-pc-q="q"]', "emiya"); pg.wait_for_timeout(300)
    pg.click('.pc-card[data-no="11"]'); pg.wait_for_timeout(400)
    seen = []
    for _ in range(4):
        seen.append(sk_name(pg, 2, ".pcd-panel")); pg.click('.pcd-panel [data-action="pc-skup"][data-i="2"]'); pg.wait_for_timeout(200)
    eff = pg.locator(".pcd-panel .skills > article.skill").nth(1).locator(".effect").inner_text()
    check(f"'Increase C. Star Drop Rate' stays on one line ({eff[:40]!r})", "Increase C. Star Drop Rate" in eff)
    check(f"Emiya's third skill steps through all three versions ({seen})", [x.split(" ")[0] for x in seen] == ["Circuit", "Magecraft", "Projection", "Circuit"])

    # ---- summoned: the switch on your own servant, and HP / ATK by level
    pg.keyboard.press("Escape"); pg.fill('[data-pc-q="q"]', ""); pg.wait_for_timeout(300)
    pg.click('.pc-card[data-no="2"]'); pg.wait_for_timeout(300)
    pg.click('.pcd-panel [data-action="pc-summon"]')
    pg.wait_for_function("document.getElementById('summon').classList.contains('info')", timeout=15000)
    pg.click(".sm-done"); pg.wait_for_timeout(900)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    sw = pg.locator('#dossier [data-action="skup"]')
    check(f"Altria on your roster: switches on skills 2 and 3 ({sw.count()})", sw.count() == 2)
    pg.click('#dossier [data-action="skup"][data-i="1"]'); pg.wait_for_timeout(700)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    base = BY[2]["sk"][1]["u"][0]
    check("switching off saves the original skill: name, effect, cooldown and values", a["skillInfo"][1]["name"] == base["n"] and a["skillInfo"][1]["effect"] == "\n".join(base["e"]) and a["skillInfo"][1]["cd"] == base["cd"] and [r["v1"] for r in a["skillInfo"][1]["scales"]] == [r[1] for r in base["v"]])
    check("the other skills stay as they were", a["skillInfo"][2]["name"] == BY[2]["sk"][2]["n"] and a["skills"] == [1, "Locked", "Locked"])
    # your own text survives a round trip
    pg.evaluate("""() => { const k = 'spirit-origin-list:v1', d = JSON.parse(localStorage.getItem(k)); const s = d.servants.find(x => x.atlas === 2); s.skillInfo[1].effect = 'my own notes'; localStorage.setItem(k, JSON.stringify(d)); }"""); pg.reload(); pg.wait_for_timeout(1300)
    pg.click('#dossier [data-action="skup"][data-i="1"]'); pg.wait_for_timeout(500)
    pg.click('#dossier [data-action="skup"][data-i="1"]'); pg.wait_for_timeout(600)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    check("flipping away and back brings your own text back", a["skillInfo"][1]["name"].startswith("Mana Burst") and a["skillInfo"][1]["effect"] == "my own notes")
    # level + and −
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(150)
    hp_shown = pg.locator("#dossier .stat").first.inner_text()
    check(f"+ on the level: HP shows Lv 2 straight away ({stat(2, 2, 'hp')})", f"{stat(2, 2, 'hp'):,}" in hp_shown)
    for _ in range(4): pg.click('#dossier [data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(60)
    pg.wait_for_timeout(900)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    check(f"Lv 6: saved HP {a['hp']} and ATK {a['atk']} match the level", a["level"] == 6 and a["hp"] == stat(2, 6, "hp") and a["atk"] == stat(2, 6, "atk"))
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(900)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    check("− lowers them again", a["level"] == 5 and a["hp"] == stat(2, 5, "hp") and a["atk"] == stat(2, 5, "atk"))
    pg.click('#dossier [data-action="ql-lv"][data-v="120"]'); pg.wait_for_timeout(700)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    check("Quick set Lv 120: HP and ATK at Lv 120", a["hp"] == BY[2]["hp"][3] and a["atk"] == BY[2]["atk"][3])
    pg.click('#dossier [data-action="ql-lv"][data-v="90"]'); pg.wait_for_timeout(700)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    check("…and back down to Lv 90", a["hp"] == BY[2]["hp"][1] and a["atk"] == BY[2]["atk"][1])
    # the edit form
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    pg.fill("#sv-level", "80"); pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(1200)
    a = next(x for x in docs(pg) if x.get("atlas") == 2)
    check(f"changing the level in the edit form moves HP and ATK too ({a['level']}, {a['hp']})", a["level"] == 80 and a["hp"] == stat(2, 80, "hp") and a["atk"] == stat(2, 80, "atk"))
    ctx.close()

    # ================= your list: stats put right once; the trait fix sticks =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1800)
    t = pg.locator("#toast").inner_text()
    ss = docs(pg)
    check(f"once: HP and ATK put right for servants that didn't match their level ({t[:70]!r})", "HP and ATK now match the level" in t and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:statsync')") == "1")
    pg.reload(); pg.wait_for_timeout(1300)
    check("…and only once", "HP and ATK now match" not in (pg.locator("#toast").inner_text() if pg.locator("#toast.show").count() else ""))
    # Shuten-Douji (Caster), saved the way 0.14.0 left her, with Demonic Beast read as Demonic Beast Servant
    x = BY[225]
    pg.evaluate("""(t) => { const k = 'spirit-origin-list:v1', d = JSON.parse(localStorage.getItem(k));
      d.servants = [{id: 'shuten', order: 1, name: 'Shuten-Douji Caster', cls: 'Caster', rarity: 5, level: 90, skills: [1,1,1], attr: 'Sky', lawOrder: ['Chaotic'], moral: ['Evil'], traits: t, traitsSet: true},
                    {id: 'alt', order: 2, name: 'Artoria', cls: 'Saber', rarity: 5, level: 90, skills: [1,1,1], attr: 'Earth', lawOrder: ['Lawful'], moral: ['Good'], traits: ['Female', 'Saberface', 'Dragon'], traitsSet: true}];
      d.parties = []; localStorage.setItem(k, JSON.stringify(d)); }""", [t for t in x["t"] if t != "Demonic Beast"] + ["Demonic Beast Servant"])
    pg.reload(); pg.wait_for_timeout(1500)
    note = pg.locator("#trait-note")
    check("Shuten-Douji (Caster) is flagged", note.is_visible() and "Shuten-Douji Caster" in note.inner_text())
    pg.click('#trait-note [data-action="tr-open"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="tr-go"]'); pg.wait_for_timeout(900)
    s = next(v for v in docs(pg) if v["id"] == "shuten")
    check("one press fixes her: Earth, Demonic Beast in, Demonic Beast Servant out", s["attr"] == "Earth" and "Demonic Beast" in s["traits"] and "Demonic Beast Servant" not in s["traits"])
    pg.reload(); pg.wait_for_timeout(1400)
    check("…and nobody asks again after a reload", note.is_hidden() and pg.locator("#dossier .tr-one").count() == 0)
    pg.click('[data-id="shuten"]'); pg.wait_for_timeout(500)
    check("her page shows Demonic Beast as its own trait", "Demonic Beast" in pg.locator("#dossier .tr-sec").inner_text() and "Demonic Beast Servant" not in pg.locator("#dossier .tr-sec").inner_text())
    pg.click('[data-id="alt"]'); pg.wait_for_timeout(500)
    trs = pg.locator("#dossier .tr-sec").inner_text()
    check("a saved 'Saberface' shows as Artoria Face", "Artoria Face" in trs and "Saberface" not in trs)
    ctx.close()

    # ================= skills typed from the wiki: the switch still knows which one it is =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1600)
    pg.click('[data-id="artoria"]'); pg.wait_for_timeout(600)
    sw3 = pg.locator('#dossier [data-action="skup"][data-i="2"]')
    before = next(v for v in docs(pg) if v["id"] == "artoria")["skillInfo"][2] if any(v["id"] == "artoria" for v in docs(pg)) else None
    check("Artoria's 'Instinct A (→ Radiant Road EX after Rank Up)' gets a switch, set to before the upgrade", sw3.count() == 1 and sw3.get_attribute("aria-checked") == "false")
    sw3.click(); pg.wait_for_timeout(700)
    now = next(v for v in docs(pg) if v["id"] == "artoria")["skillInfo"][2]
    check(f"switching it on gives the NA upgraded skill ({now['name']})", now["name"] == BY[2]["sk"][2]["n"])
    pg.click('#dossier [data-action="skup"][data-i="2"]'); pg.wait_for_timeout(700)
    back = next(v for v in docs(pg) if v["id"] == "artoria")["skillInfo"][2]
    check(f"and off again brings your own wiki text back ({back['name'][:30]})", back["name"].startswith("Instinct A") and "Radiant Road" in back["name"])
    ctx.close()

print("\nerrors:", errs)
print("FAILED:" if fails else "ALL PASSED", fails)
