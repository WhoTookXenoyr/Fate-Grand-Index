import sys, tempfile, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]
EMPTY = f"file://{sp}/out/Fate_Grand_Index.html"
SEEDED = f"file://{sp}/_seeded.html"
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
ATL = json.loads(re.search(r"const ATLAS_S = (\[.*?\]);\n", open(f"{sp}/atlas_data.js").read(), re.S).group(1))
BY = {x["no"]: x for x in ATL}
CURVES = json.loads(re.search(r"const ATLAS_CURVES = (\{.*?\});\n", open(f"{sp}/atlas_data.js").read(), re.S).group(1))
def stat(no, lv, k):
    x = BY[no]; c = CURVES[str(x["gc"])]; b, m = x[k][0], x[k][1]; return b + (m - b) * c[lv - 1] // 1000

with sync_playwright() as p:
    # ================= the shared file: empty, with a guide =================
    ctx, pg = page(p)
    pg.goto(EMPTY); pg.wait_for_timeout(1700)
    check("the shared file opens with no servants of anyone's", pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") is None and pg.locator("#home .hm-lead").inner_text().startswith("Your Chaldea is empty"))
    check("the guide opens for a first-timer", pg.locator(".tour-panel").is_visible() and "Welcome" in pg.locator(".tour-panel h2").inner_text())
    check("the page behind it can't be clicked meanwhile", pg.evaluate("document.querySelector('.shell').inert"))
    for i in range(4): pg.click('.tour-panel [data-action="tour-step"][data-d="1"]'); pg.wait_for_timeout(120)
    check("five steps, the last one leads to Past Chaldea", "5 of 5" in pg.locator(".tour-panel .pcd-kick").inner_text().lower() and pg.locator('[data-action="tour-done"]').inner_text() == "Open Past Chaldea")
    pg.click('[data-action="tour-step"][data-d="-1"]'); pg.wait_for_timeout(100)
    check("Back goes back a step", "4 of 5" in pg.locator(".tour-panel .pcd-kick").inner_text().lower())
    pg.click('[data-action="tour-step"][data-d="1"]'); pg.click('[data-action="tour-done"]'); pg.wait_for_timeout(700)
    check("…and it opens Past Chaldea, seen for good", pg.evaluate("document.querySelector('[role=tab][aria-selected=true]').id") == "tab-past" and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:intro')") == "seen" and pg.locator("#pc-dlg").is_hidden())
    pg.reload(); pg.wait_for_timeout(1400)
    check("no guide on the next visit", pg.locator(".tour-panel").count() == 0)

    # ---- names and alignments from the NA data
    pg.fill('[data-pc-q="q"]', "ereshkigal"); pg.wait_for_timeout(350)
    names = pg.locator(".pc-card .pc-n").all_inner_texts()
    check(f"Space Ereshkigal has her name ({names})", "Space Ereshkigal" in names and "Ereshkigal" in names)
    check("Morgan is Lawful Evil, BB (Summer) and both Hakunos are named", BY[309]["o"] == ["Lawful"] and BY[309]["m"] == ["Evil"] and BY[220]["n"] == "BB (Summer)" and BY[424]["n"].endswith("(Male)") and BY[425]["n"].endswith("(Female)"))
    check("every NA servant has an attribute, a Lawful/Neutral/Chaotic and a morality", all(x["a"] and x["o"] and x["m"] for x in ATL))
    check("alignments that change with ascension are all there (Aesc, Kuonji Alice, Hibiki & Chikagi, Nero Bride)", BY[385]["m"] == ["Good", "Balanced", "Summer"] and BY[415]["m"] == ["Good", "Evil"] and BY[416]["o"] == ["Lawful", "Neutral"] and BY[90]["m"] == ["Bride"])

    # ---- search and filter by attribute, alignment and trait
    pg.fill('[data-pc-q="q"]', "lawful evil fae"); pg.wait_for_timeout(350)
    check("typing 'lawful evil fae' finds Morgan", pg.locator(".pc-card .pc-n").all_inner_texts() == ["Morgan"])
    pg.fill('[data-pc-q="q"]', "sky female divine"); pg.wait_for_timeout(350)
    hits = [int(x) for x in pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(b => b.dataset.no)")]
    want = sorted(x["no"] for x in ATL if x["a"] == "Sky" and x["g"] == "Female" and any(t.split()[0] == "Divine" for t in x["t"]))
    check(f"'sky female divine' finds exactly the Sky, Female, Divine (Spirit) servants ({len(hits)})", sorted(hits) == want and len(hits) > 3)
    pg.fill('[data-pc-q="q"]', ""); pg.wait_for_timeout(300)
    pg.select_option('[data-pc-f="attr"]', "Earth"); pg.select_option('[data-pc-f="ord"]', "Lawful"); pg.select_option('[data-pc-f="mor"]', "Evil"); pg.wait_for_timeout(300)
    hits = sorted(int(x) for x in pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(b => b.dataset.no)"))
    check(f"filters: Earth + Lawful + Evil ({len(hits)})", hits == sorted(x["no"] for x in ATL if x["a"] == "Earth" and "Lawful" in x["o"] and "Evil" in x["m"]) and 309 in hits)
    pg.select_option('[data-pc-f="tr"]', "Dragon"); pg.wait_for_timeout(300)
    hits = sorted(int(x) for x in pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(b => b.dataset.no)"))
    check("…and a trait on top", hits == sorted(x["no"] for x in ATL if x["a"] == "Earth" and "Lawful" in x["o"] and "Evil" in x["m"] and "Dragon" in x["t"]))
    pg.click('[data-action="pc-clear"]'); pg.wait_for_timeout(300)
    check("Clear filters shows everyone again", pg.locator(".pc-count").inner_text().startswith("418") and pg.locator('[data-pc-f="attr"]').input_value() == "")
    pg.fill('[data-pc-q="q"]', "morgan"); pg.wait_for_timeout(300)
    pg.click('.pc-card[data-no="309"]'); pg.wait_for_timeout(400)
    tags = pg.locator(".pcd-tags button").all_inner_texts()
    check(f"Morgan's page shows Lawful and Evil as tags ({tags[:5]})", "Lawful" in tags and "Evil" in tags and "Attribute: Earth" in tags)
    pg.click('.pcd-tags button[data-v="Fae"]'); pg.wait_for_timeout(400)
    hits = sorted(int(x) for x in pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(b => b.dataset.no)"))
    check(f"pressing the Fae tag lists every Fae ({len(hits)})", pg.locator("#pc-dlg").is_hidden() and pg.locator('[data-pc-f="tr"]').input_value() == "Fae" and hits == sorted(x["no"] for x in ATL if "Fae" in x["t"]))

    # ---- summon Morgan, then quick set
    pg.click('.pc-card[data-no="309"]'); pg.wait_for_timeout(300)
    pg.click('.pcd-panel [data-action="pc-summon"]')
    pg.wait_for_function("document.getElementById('summon').classList.contains('info')", timeout=15000)
    pg.click(".sm-done"); pg.wait_for_timeout(900)
    m = next(x for x in docs(pg) if x.get("atlas") == 309)
    check("summoned Morgan comes with her alignment", m["lawOrder"] == ["Lawful"] and m["moral"] == ["Evil"] and m["attr"] == "Earth")
    ql = pg.locator("#dossier .ql")
    check("Quick set sits under Progress", ql.count() == 1 and [t.split("\n")[0] for t in ql.locator("button").all_inner_texts()] == ["Max level", "Lv 100", "Lv 120", "Skills 10/10/10"])
    pg.click('#dossier [data-action="ql-lv"][data-v="100"]'); pg.wait_for_timeout(700)
    m = next(x for x in docs(pg) if x.get("atlas") == 309)
    check(f"Lv 100 in one press, HP and ATK to match ({m['level']}, {m['hp']}, {m['atk']})", m["level"] == 100 and m["hp"] == stat(309, 100, "hp") == BY[309]["hp"][2] and m["atk"] == BY[309]["atk"][2])
    st = pg.locator("#dossier .status.grail").first.inner_text()
    row = pg.locator(f'.row[data-id="{m["id"]}"] .row-lv, [data-id="{m["id"]}"] .row-lv').first.inner_text()
    check(f"a ★5 at Lv 100 shows +10 · 5 grails ({st!r}, row {row!r})", st == "+10 · 5 grails" and "+10 · 5 grails" in row)
    pg.click(".toast-btn"); pg.wait_for_timeout(700)
    m = next(x for x in docs(pg) if x.get("atlas") == 309)
    check("Undo puts Lv 1 and her stats back", m["level"] == 1 and m["hp"] == BY[309]["hp"][0] and m["atk"] == BY[309]["atk"][0])
    pg.click('#dossier [data-action="ql-lv"][data-v="120"]'); pg.wait_for_timeout(600)
    check("Lv 120 is 15 grails", pg.locator("#dossier .status.grail").first.inner_text() == "+30 · 15 grails")
    pg.click('#dossier [data-action="ql-lv"][data-v="90"]'); pg.wait_for_timeout(600)
    m = next(x for x in docs(pg) if x.get("atlas") == 309)
    check("Max level is Lv 90 without grails", m["level"] == 90 and m["hp"] == BY[309]["hp"][1] and pg.locator('#dossier [data-action="ql-lv"][data-v="90"]').is_disabled())
    pg.click('#dossier [data-action="ql-sk"]'); pg.wait_for_timeout(600)
    m = next(x for x in docs(pg) if x.get("atlas") == 309)
    check("Skills 10/10/10, locked ones too", m["skills"] == [10, 10, 10] and pg.locator('#dossier [data-action="ql-sk"]').is_disabled())
    # typed numbers stay
    pg.evaluate("""() => { const k = 'spirit-origin-list:v1', d = JSON.parse(localStorage.getItem(k)); const s = d.servants.find(x => x.atlas === 309); s.hp = 12345; localStorage.setItem(k, JSON.stringify(d)); }"""); pg.reload(); pg.wait_for_timeout(1300)
    pg.click('#dossier [data-action="ql-lv"][data-v="100"]'); pg.wait_for_timeout(600)
    m = next(x for x in docs(pg) if x.get("atlas") == 309)
    check("HP and ATK always follow the level now (0.15.0), even a typed HP", m["hp"] == BY[309]["hp"][2] and m["atk"] == BY[309]["atk"][2])
    pg.evaluate("window.scrollTo(0, 600)")
    pg.click(".home-link"); pg.wait_for_timeout(600)
    check("the title goes Home and to the top", pg.evaluate("document.querySelector('[role=tab][aria-selected=true]').id") == "tab-home" and pg.evaluate("scrollY") < 5)
    check("Home counts the grails", "(5 grails in all)" in pg.locator("#home .hm-lead").inner_text())

    # ---- What's new
    check("What's new has a dot until it's read", pg.locator(".news-dot").is_visible())
    pg.click('.mast-actions [data-action="news"]'); pg.wait_for_timeout(300)
    txt = pg.locator(".news-panel").inner_text()
    check("What's new lists every version, newest first", txt.index("0.14.0") < txt.index("0.13.1") < txt.index("0.12.0") < txt.index("0.2.0") < txt.index("0.1.0") and "Past Chaldea" in txt and pg.locator(".cl-v").count() >= 17)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("…and the dot goes away for good", pg.locator(".news-dot").is_hidden() and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:news')") == pg.locator(".masthead .ver-chip").inner_text().split(" ")[0][1:])
    check("Home has What's new too", pg.locator("#home .hm-b-news").count() == 1 and pg.locator('#home .hm-b-news [data-action="sf-open"]').count() == 1)

    # ---- grails for other rarities: ★4 at Lv 100 took 7
    pg.evaluate("""() => { const k = 'spirit-origin-list:v1', d = JSON.parse(localStorage.getItem(k)); d.servants.push({id: 'four', order: 9, name: 'Four', cls: 'Saber', rarity: 4, level: 100, skills: [1,1,1]}, {id: 'three', order: 10, name: 'Three', cls: 'Saber', rarity: 3, level: 91, skills: [1,1,1]}); localStorage.setItem(k, JSON.stringify(d)); }""")
    pg.reload(); pg.wait_for_timeout(1300)
    pg.click("#tab-servants"); pg.wait_for_timeout(500)
    t4 = pg.locator('[data-id="four"] .row-lv').first.inner_text(); t3 = pg.locator('[data-id="three"] .row-lv').first.inner_text()
    check(f"★4 at Lv 100 took 7 grails, ★3 at Lv 91 took 5 ({t4!r}, {t3!r})", "+20 · 7 grails" in t4 and "+21 · 5 grails" in t3)

    # ---- start fresh
    pg.evaluate("localStorage.setItem('spirit-origin-list:v1:theme', 'dark')")
    pg.click("#btn-export"); pg.wait_for_timeout(150)
    check("Start fresh is in the Export menu", pg.locator('#export-menu [data-action="sf-open"]').is_visible())
    pg.click('#export-menu [data-action="sf-open"]'); pg.wait_for_timeout(250)
    go = pg.locator('[data-action="sf-go"]')
    check("it asks for a backup and a typed confirmation first", go.is_disabled() and pg.locator('.sf-panel [data-action="export"]').count() == 1 and "3 servants" in pg.locator(".sf-panel").inner_text())
    pg.fill("[data-sf-word]", "start"); check("half the words isn't enough", go.is_disabled())
    pg.fill("[data-sf-word]", "start fresh"); check("typing START FRESH unlocks it", go.is_enabled())
    with pg.expect_navigation(): go.click()
    pg.wait_for_timeout(1500)
    check("everything in this browser is gone", docs(pg) == [] and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:log')") is None and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:atlaslink')") is None)
    check("settings kept (dark stays dark), and the guide greets the fresh start", pg.evaluate("localStorage.getItem('spirit-origin-list:v1:theme')") == "dark" and pg.locator(".tour-panel").is_visible())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes the guide", pg.locator("#pc-dlg").is_hidden())
    ctx.close()

    # ================= your own list: the trait check =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    check("a browser that already has servants gets no guide", pg.locator(".tour-panel").count() == 0)
    note = pg.locator("#trait-note")
    print("   trait note on your seeded roster:", note.inner_text()[:300] if note.is_visible() else "(none)")
    pg.click("#tab-servants"); pg.wait_for_timeout(300)
    # one wrong Morgan: wrong attribute and order, a trait she doesn't have, one the NA data doesn't know
    pg.evaluate("""() => { const k = 'spirit-origin-list:v1'; const d = {servants: [], parties: [], guests: []};
      d.servants.push({id: 'morg', order: 1, name: 'Morgan (Berserker)', cls: 'Berserker', rarity: 5, level: 90, skills: [1,1,1], attr: 'Sky', lawOrder: ['Chaotic'], moral: ['Good'], traits: ['Female', 'Dragon', 'Pseudo-Servant', 'King'], traitsSet: true, notes: 'mine'});
      d.servants.push({id: 'ok', order: 2, name: 'Morgan', cls: 'Berserker', rarity: 5, level: 90, skills: [1,1,1], atlas: 309, attr: 'Earth', lawOrder: ['Lawful'], moral: ['Evil'], traits: ['Female','Fae','Humanoid','Saberface','Weak to Enuma Elish','King','Seven Knights Servant','Non-Hominidae Servant'], traitsSet: true});
      localStorage.setItem(k, JSON.stringify(d)); }""")
    pg.reload(); pg.wait_for_timeout(1500)
    check("a note names the servant whose traits differ (and not the one that matches)", note.is_visible() and "Morgan (Berserker)" in note.inner_text() and "1 servant" in note.inner_text())
    pg.click('#trait-note [data-action="tr-open"]'); pg.wait_for_timeout(300)
    txt = pg.locator(".fill-panel").inner_text()
    check(f"the check shows each change ({txt[txt.find('Attribute'):txt.find('Attribute')+160]!r})", "Sky → Earth" in txt and "Chaotic Good → Lawful Evil" in txt and "Dragon" in txt and "Fae" in txt)
    pg.click('[data-action="tr-go"]'); pg.wait_for_timeout(800)
    x = next(v for v in docs(pg) if v["id"] == "morg")
    check("one press fixes attribute, alignment and traits; Pseudo-Servant stays", x["attr"] == "Earth" and x["lawOrder"] == ["Lawful"] and x["moral"] == ["Evil"] and "Dragon" not in x["traits"] and "Fae" in x["traits"] and "Pseudo-Servant" in x["traits"] and x["notes"] == "mine" and x["level"] == 90)
    check("…and the note goes away", note.is_hidden())
    pg.click(".toast-btn"); pg.wait_for_timeout(700)
    x = next(v for v in docs(pg) if v["id"] == "morg")
    check("Undo puts the old traits back", x["attr"] == "Sky" and x["lawOrder"] == ["Chaotic"] and "Dragon" in x["traits"])
    pg.click('[data-id="morg"]'); pg.wait_for_timeout(500)
    one = pg.locator("#dossier .tr-one")
    check("the servant's own page offers the fix too", one.count() == 1 and "Sky → Earth" in one.inner_text())
    pg.click('#dossier .tr-one [data-action="tr-keep"]'); pg.wait_for_timeout(400)
    check("Keep mine stops asking", pg.locator("#dossier .tr-one").count() == 0 and note.is_hidden())
    pg.reload(); pg.wait_for_timeout(1300)
    check("…after a reload too", note.is_hidden())
    ctx.close()

print("\nerrors:", errs)
print("FAILED:" if fails else "ALL PASSED", fails)
