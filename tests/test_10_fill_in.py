import sys, tempfile, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; BASE = f"file://{sp}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
def atlas(r):
    u = r.request.url
    f = "ph_buff.png" if "BuffIcons" in u else "ph_skill.png" if "SkillIcons" in u else "ph_face.png" if "/Faces/" in u else "ph_graph.png"
    r.fulfill(path=f"{sp}/{f}", content_type="image/png")
def docs(pg):
    v = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')"))["servants"]; return v if isinstance(v, list) else list(v.values())
NEW = [("Ishtar Rider", "Rider", 182), ("Shuten-Douji Caster", "Caster", 225), ("Nitocris Caster", "Caster", 120), ("Elizabeth Halloween", "Caster", 61), ("Scathach Assassin", "Assassin", 133), ("Jeanne D'Arc (Beserker Alter)", "Berserker", 219), ("Atalanta Alter", "Berserker", 202), ("Lancelot Berserker", "Berserker", 48)]
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": 1360, "height": 1000})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", atlas)
    pg.goto(BASE + "#servants"); pg.wait_for_timeout(1500)
    d = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")); sv = d["servants"]
    for i, (n, c, no) in enumerate(NEW):
        doc = {"id": "t" + str(i), "order": 100 + i, "name": n, "cls": c, "rarity": 5 if i % 2 else 4, "level": 80, "npLevel": 2, "skills": [9, 8, 7], "hp": 11000, "atk": 9000, "notes": "mine " + str(i)}
        if i == 0: doc.update({"level": 92, "hp": None, "atk": None})
        if i == 1: doc.update({"deck": ["Buster", "", "", "", ""], "npCard": "Quick", "attr": "Sky"})
        if isinstance(sv, list): sv.append(doc)
        else: sv[doc["id"]] = doc
    pg.evaluate("v => localStorage.setItem('spirit-origin-list:v1', v)", json.dumps(d)); pg.reload(); pg.wait_for_timeout(1600)
    before = {x["id"]: json.dumps(x, sort_keys=True) for x in docs(pg)}
    check("a note offers to fill in the empty parts", pg.locator("#fill-note").is_visible() and "empty parts" in pg.locator("#fill-note").inner_text())
    pg.click('[data-action="fill-open"]'); pg.wait_for_timeout(500)
    rows = pg.locator(".fill-row")
    ticked = pg.evaluate("Array.from(document.querySelectorAll('.fill-row input:checked')).map(i => i.dataset.fill)")
    check(f"everything is ticked, the 8 included ({len(ticked)} of {rows.count()})", all("t" + str(i) in ticked for i in range(8)) and len(ticked) == rows.count())
    txt = pg.locator(".fill-panel").inner_text()
    check("matched to the right NA servants (Elisabeth, Atalante, Jeanne Alter Berserker, Lancelot Berserker)", all(s in txt for s in ["Elisabeth Báthory (Halloween)", "Atalante (Alter)", "Jeanne d'Arc Alter (Berserker)", "Lancelot · No. 48", "Ishtar (Rider)", "Shuten-Douji (Caster)", "Scáthach (Assassin)", "Nitocris · No. 120"]))
    pg.click('[data-action="fill-go"]'); pg.wait_for_timeout(1500)
    after = docs(pg)
    for i, (n, c, no) in enumerate(NEW):
        x = next(a for a in after if a["id"] == "t" + str(i))
        ok = len(x.get("art", {})) >= 4 and all((k or {}).get("name") for k in x["skillInfo"]) and len(x.get("passives", [])) >= 1 and x["skills"] == [9, 8, 7] and x["npLevel"] == 2 and x["notes"] == "mine " + str(i) and x["rarity"] == (5 if i % 2 else 4) and "wish" not in x
        full = x.get("npName") and x.get("npTarget") and x.get("npTable") and isinstance(x.get("lawOrder"), list) and x["lawOrder"] and isinstance(x.get("moral"), list) and x.get("traits") and x.get("url", "").startswith("https://fategrandorder.fandom.com/wiki/")
        if i == 1: full = full and x["deck"] == ["Buster", "", "", "", ""] and x["npCard"] == "Quick" and x["attr"] == "Sky"
        else: full = full and all(x["deck"]) and x.get("npCard") in ("Buster", "Arts", "Quick") and x.get("attr")
        if i == 0: full = full and x["level"] == 92 and x["hp"] == 12048 and x["atk"] == 10811
        else: full = full and x["hp"] == 11000 and x["atk"] == 9000
        check(f"{n}: pictures, skills, passives, deck, NP and traits filled where empty, the rest untouched", ok and full)
    def empty(v): return v is None or v == "" or v == [] or v == {} or (isinstance(v, list) and all(not x for x in v))
    touched = []
    for k, v in before.items():
        if k.startswith("t"): continue
        b0, a0 = json.loads(v), next(a for a in after if a["id"] == k)
        for f, bv in b0.items():
            if empty(bv): continue
            if f == "skillInfo":
                for i, sk in enumerate(bv):
                    if sk and (sk.get("name") or sk.get("effect")) and a0[f][i] != sk: touched.append(k + "." + f + str(i))
            elif a0.get(f) != bv: touched.append(k + "." + f)
    check(f"other servants only gained what was empty, nothing they had changed ({touched[:5]})", not touched)
    check("the note goes away", pg.locator("#fill-note").is_hidden())
    pg.click('#list .row[data-id="t3"]'); pg.wait_for_timeout(900)
    check("Elizabeth's page shows the skills and pictures", pg.locator("#dossier .skill").count() == 3 and pg.locator("#dossier .art-frame img[data-art]").count() >= 1 and pg.locator("#dossier .fill-one").count() == 0)
    pg.screenshot(path=f"{sp}/v13-filled.png")
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(1200)
    back = docs(pg)
    check("Undo puts all 8 back as they were", all(json.dumps(next(a for a in back if a["id"] == k), sort_keys=True) == v for k, v in before.items()))
    # one at a time, from the servant's page; your own skill text is never replaced
    d = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")); sv = d["servants"]
    lst = sv if isinstance(sv, list) else list(sv.values())
    t2 = next(a for a in lst if a["id"] == "t2"); t2["skillInfo"] = [{"name": "My own skill", "effect": "typed by me"}, {}, {}]
    pg.evaluate("v => localStorage.setItem('spirit-origin-list:v1', v)", json.dumps(d)); pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#list .row[data-id="t2"]'); pg.wait_for_timeout(900)
    check("a servant's own page offers to fill in what's missing", pg.locator("#dossier .fill-one").count() == 1 and "skill 2 & 3" in pg.locator("#dossier .fill-one").inner_text())
    pg.click('#dossier [data-action="fill-one"]'); pg.wait_for_timeout(1000)
    x = next(a for a in docs(pg) if a["id"] == "t2")
    check("only the empty skills are filled; your own skill stays", x["skillInfo"][0]["name"] == "My own skill" and x["skillInfo"][1].get("name") and x["skillInfo"][2].get("name"))
    pg.click('#list .row[data-id="oberon"]'); pg.wait_for_timeout(800)
    n1 = pg.locator("#dossier .fill-one").count()
    if n1: pg.click('#dossier [data-action="fill-one-no"]'); pg.wait_for_timeout(300)
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(500); pg.click('#list .row[data-id="oberon"]'); pg.wait_for_timeout(800)
    check("Not now hides the offer for that servant", n1 == 1 and pg.locator("#dossier .fill-one").count() == 0)
check("no page errors" + (": " + "; ".join(errs[:3]) if errs else ""), not errs)
print("FAILS:", len(fails))
