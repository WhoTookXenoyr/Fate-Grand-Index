import os
# 0.54.0-beta: Command Codes (a page, five slots on a servant's page, what they add to a card, and the Battle simulator
# fighting with them), the bond calculator, the Saint Quartz planner, calendar files of NA's events, the rank score
# without rarity, the Saint Quartz picture, and GamePress's walkthroughs on the Story page. The roster's servants are
# never changed by any of it. Atlas Academy is stood in for.
import sys, json, re, time, tempfile
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));"
LIVE_ON = "localStorage.setItem('spirit-origin-list:v1:live', JSON.stringify({on: true}));"
KEY = "spirit-origin-list:v1"
CC = f"JSON.parse(localStorage.getItem('{KEY}:cc') || '{{}}')"
AD = open(f"{sp}/atlas_data.js", encoding="utf-8").read()
ATL = json.loads(re.search(r"^const ATLAS_S = (.*?);?$", AD, re.M).group(1))
ACC = json.loads(re.search(r"^const ATLAS_CC = (.*?);?$", AD, re.M).group(1))
ABOND = json.loads(re.search(r"^const ATLAS_BOND = (.*?);?$", AD, re.M).group(1))
CU = next(x for x in ATL if x["no"] == 98)  # Cú Chulainn (Alter)
by_name = lambda n: next(c for c in ACC if c["n"] == n)
NOW = int(time.time()); D = 86400
camel = lambda c: {"Moon Cancer": "moonCancer", "Alter Ego": "alterEgo"}.get(c, c[:1].lower() + c[1:])
IMG = "https://static.atlasacademy.io/NA/"
svts = [{"id": x["id"], "collectionNo": x["no"], "name": x["n"], "type": "normal", "className": camel(x["c"]), "rarity": x["r"], "face": IMG + x["f"]} for x in ATL]
FIVE = next(x for x in ATL if x["r"] == 5 and x["n"] == "Ereshkigal")
EVENTS = [{"id": 80700, "type": "eventQuest", "name": "Calendar Test Festival, Part 1", "noticeAt": NOW - 3 * D, "startedAt": NOW - 2 * D, "endedAt": NOW + 9 * D, "finishedAt": NOW + 9 * D, "materialOpenedAt": NOW + 9 * D, "warIds": [9070]},
          {"id": 80701, "type": "eventQuest", "name": "Upcoming; Test Event", "noticeAt": NOW - D, "startedAt": NOW + 5 * D, "endedAt": NOW + 20 * D, "finishedAt": NOW + 20 * D, "materialOpenedAt": NOW + 20 * D, "warIds": []}]
GACHAS = [{"id": 5, "name": "Calendar Test Pickup Summon", "type": "payGacha", "openedAt": NOW - D, "closedAt": NOW + 8 * D, "gachaSubs": [], "featuredSvtIds": [FIVE["id"]]}]
FILES = {"basic_servant.json": svts, "basic_equip.json": [], "basic_event.json": EVENTS, "nice_gacha.json": GACHAS, "info.json": {"hash": "h", "timestamp": NOW - 3600}}
WAR = {"id": 301, "name": "Anastasia", "spots": [{"name": "Frozen Plain", "quests": [
    {"id": 94000001, "type": "free", "name": "Snow Field", "phases": [1, 2, 3], "consume": 40, "consumeType": "ap"},
    {"id": 94000002, "type": "main", "name": "Section 1", "phases": [1], "consume": 0, "consumeType": "ap"}]}]}
PHASE = {"id": 94000001, "phase": 3, "name": "Snow Field", "bond": 690, "consume": 40, "consumeType": "ap", "stages": []}
asked = []
def api(r):
    u = r.request.url; asked.append(u)
    h = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}
    if u.endswith("/nice/NA/war/301"): return r.fulfill(body=json.dumps(WAR), headers=h)
    if u.endswith("/nice/NA/quest/94000001/3"): return r.fulfill(body=json.dumps(PHASE), headers=h)
    if u.endswith("/nice/NA/quest/94000777"): return r.fulfill(body=json.dumps({"id": 94000777, "phases": [1]}), headers=h)
    if u.endswith("/nice/NA/quest/94000777/1"): return r.fulfill(body=json.dumps({"name": "Typed Quest", "bond": 1000, "consume": 30, "consumeType": "ap"}), headers=h)
    name = u.rsplit("/", 1)[-1].split("?")[0]
    if "/export/NA/" in u and name in FILES: return r.fulfill(body=json.dumps(FILES[name]), headers=h)
    r.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*"})
def page(p, init, w=1440, h=900):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h}, accept_downloads=True)
    pg = ctx.new_page(); pg.add_init_script(init)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", api)
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    pg.route("https://fategrandorder.fandom.com/**", lambda r: r.fulfill(body="{}", headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}))
    pg.route("https://itunes.apple.com/**", lambda r: r.fulfill(body='{"results": []}', headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}))
    return ctx, pg
roster = lambda pg: pg.evaluate(f"localStorage.getItem('{KEY}')")
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])

with sync_playwright() as p:
    ctx, pg = page(p, INIT)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    before = roster(pg)

    # ================= Command Codes: the data =================
    L = pg.evaluate("window.__fgiCc.list()")
    check(f"NA's Command Codes come with the page ({len(L)}, from No. {L[0]['no']} {L[0]['n']})", len(L) >= 180 and L[0]["n"] == "Code: Mortal" and all(c.get("f") and c.get("e") for c in L))
    t = pg.evaluate("[1, 46, 15, 79, 153, 180, 23].map((n) => window.__fgiCc.text(n))")
    check(f"what they do, in numbers ({t[0]}, {t[1]}, {t[2]})", t[0] == ["Special attack +5% (against Human)"] and t[1] == ["NP +10% when it attacks (once every 3 turns)"] and t[2] == ["Critical damage +10%"])
    check(f"cards, traits, stars, conditions ({t[3]}, {t[4]}, {t[5]})", t[3] == ["Critical damage +30% (against Dragon, Buster card only)"] and t[4] == ["+3 stars each attack (Quick card only)"]
          and t[5] == ["Critical damage +10% (if you're Lawful)", "NP Gain +5% (if you're Chaotic)", "+3 stars each attack"] and t[6] == ["Damage Plus +1,000"])
    k = pg.evaluate("[[8, window.__fgiCc.kinds(8)], [9, window.__fgiCc.kinds(9)], [22, window.__fgiCc.kinds(22)], [21, window.__fgiCc.kinds(21)]]")
    check(f"what each one is for, for the filter ({k})", k[0][1] == ["crit"] and k[1][1] == ["stars"] and "other" in k[2][1] and k[3][1] == ["hit"])

    # ================= on a servant's page =================
    pg.click(f'#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(800)
    sec = pg.locator("#dossier .cc-sec")
    check("the servant's page has Command Codes right under Deck", sec.count() == 1 and pg.evaluate("document.querySelector('#dossier .deck-sec').nextElementSibling.classList.contains('cc-sec')"))
    slots = pg.evaluate("Array.from(document.querySelectorAll('#dossier .cc-slot')).map((b) => b.className.match(/\\bc-(quick|arts|buster)\\b/)[1])")
    check(f"five slots, lined up with NA's deck for Cu Chulainn (Alter), {CU['d']} ({slots})", slots == ["quick", "arts", "buster", "buster", "buster"] and CU["d"] == "QABBB")
    pg.locator('#dossier [data-cc-slot="2"]').click(); pg.wait_for_timeout(300)
    check(f"a slot opens a list of every code ({pg.locator('#dossier .cc-opt').count()})", pg.locator("#dossier .cc-pick").count() == 1 and pg.locator("#dossier .cc-opt").count() == len(L))
    typ(pg, "#dossier input[data-cc-q]", "Red Gem"); pg.wait_for_timeout(250)
    opts = pg.locator("#dossier .cc-opt b").all_inner_texts()
    check(f"typing finds one ({opts})", opts == ["Red Gem Lady's Command Seal"] and pg.evaluate("document.activeElement && document.activeElement.matches('input[data-cc-q]')"))
    typ(pg, "#dossier input[data-cc-q]", ""); typ(pg, "#dossier select[data-cc-k]", "stars"); pg.wait_for_timeout(250)
    check("the For filter keeps the star ones", pg.locator("#dossier .cc-opt").count() > 20 and all("star" in x.lower() or "Star" in x for x in pg.locator("#dossier .cc-opt small").all_inner_texts()))
    dead = pg.evaluate("Array.from(document.querySelectorAll('#dossier .cc-opt.dead b')).map((b) => b.textContent)")
    check(f"codes for another card type say they'd do nothing on this Buster card ({dead[:3]})", "Nobbu Drive" in dead)
    typ(pg, "#dossier select[data-cc-k]", ""); typ(pg, "#dossier input[data-cc-q]", "Red Gem"); pg.wait_for_timeout(250)
    pg.locator("#dossier .cc-opt").first.click(); pg.wait_for_timeout(300)
    st = pg.evaluate(CC)
    check(f"picking one engraves it on that card, kept on its own ({st})", st.get("s", {}).get("cu-chulainn-alter") == [0, 0, 15, 0, 0] and pg.locator("#dossier .cc-pick").count() == 0)
    check("the slot shows it", "Red Gem Lady" in pg.locator('#dossier [data-cc-slot="2"]').inner_text() and "1 of 5 engraved" in sec.inner_text())
    eff = pg.locator("#dossier .cc-eff li").first.inner_text()
    nums = [int(x.replace(",", "")) for x in re.findall(r"[\d,]{4,}", eff)]
    check(f"what it adds: Critical damage +10%, a critical hit 10% stronger ({eff.splitlines()[-1]})", "Critical damage +10%" in eff and len(nums) == 2 and abs(nums[1] / nums[0] - 1.1) < 0.002)
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(300)
    check("Undo takes it off again", pg.evaluate(CC).get("s", {}).get("cu-chulainn-alter") is None and "none engraved" in pg.locator("#dossier .cc-sec").inner_text())
    for i, no in ((0, by_name("Nobbu Drive")["no"]), (2, 15), (3, by_name("Code: Mortal")["no"]), (4, by_name("Code: Glitter")["no"])):
        pg.evaluate(f"window.__fgiCc.put('cu-chulainn-alter', {i}, {no})")
    pg.wait_for_timeout(300)
    vs = pg.locator("#dossier .cc-eff li", has_text="Code: Mortal").inner_text()
    check(f"a special attack shows against its trait ({vs.splitlines()[-1]})", "Against Human: hit" in vs and "critical" in vs)
    d0, d1 = pg.evaluate("[window.__fgiCc.dmg('cu-chulainn-alter', 'Buster', 0, false, true), window.__fgiCc.dmg('cu-chulainn-alter', 'Buster', 1, false, true)]")
    check(f"Code: Mortal: +5% against Human ({round(d0)} → {round(d1)})", abs(d1 / d0 - 1.05) < 0.002)
    pg.locator('#dossier [data-cc-slot="1"]').click(); pg.wait_for_timeout(200)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
    check("Escape closes the list", pg.locator("#dossier .cc-pick").count() == 0)

    # ================= the Battle simulator fights with them =================
    t = pg.evaluate("window.__fgiCc.battle('cu-chulainn-alter')")
    cc = t.get("cc") or []
    check(f"the fighter's cards carry their codes ({t['deck']}: {[c and c['n'] for c in cc]})", t["deck"] == ["Q", "A", "B", "B", "B"] and [c and c["n"] for c in cc] == ["Nobbu Drive", None, "Red Gem Lady's Command Seal", "Code: Mortal", "Code: Glitter"])
    check("each with what it does on that card", cc[0]["stars"] == 3 and cc[2]["crit"] == 10 and cc[3]["vs"] == [[5, "Human", 0]] and cc[4]["drop"] == 20)
    R = pg.evaluate("""() => { const B = window.__fgiBattle, me = window.__fgiCc.battle('cu-chulainn-alter');
      const R = B.run({party: [me], waves: [[B.made({cls: 'Saber', name: 'Pillow', hp: 2000000, atk: 0})]]}, 99);
      const cards = R.events.filter((e) => e.t === 'card' && e.who === R.units[0].id);
      return {quick: cards.filter((e) => e.card === 'Q').length, said: cards.filter((e) => e.cc && e.cc.n === 'Nobbu Drive' && e.cc.did.join() === '+3 stars').length,
        other: cards.filter((e) => e.cc && e.cc.n !== 'Nobbu Drive' && e.cc.did.length).length}; }""")
    check(f"a Quick card with Nobbu Drive gives 3 stars each time it attacks ({R})", R["quick"] > 0 and R["said"] == R["quick"] and R["other"] == 0)
    crit = pg.evaluate("""() => { const B = window.__fgiBattle, me = window.__fgiCc.battle('cu-chulainn-alter'), plain = Object.assign({}, me, {cc: null});
      const foe = () => [[B.made({cls: 'Saber', name: 'Pillow', hp: 900000000, atk: 0})]];
      const run = (t) => B.run({party: [t], waves: foe()}, 4242).events.filter((e) => e.t === 'card' && e.card === 'B' && e.crit).reduce((a, e) => a + e.dmg, 0);
      return [run(plain), run(me)]; }""")
    check(f"with the codes, the same fight's Buster criticals hit harder ({crit[0]} → {crit[1]})", crit[0] > 0 and crit[1] > crit[0])
    pg.evaluate("window.__fgiCc.put('cu-chulainn-alter', 3, 0)")

    # ================= the Command Codes page =================
    pg.goto(SEEDED + "#codes"); pg.wait_for_timeout(1500)
    check(f"Command Codes is a page of its own ({pg.locator('.cc-card').count()})", pg.locator("#tab-codes").get_attribute("aria-selected") == "true" and pg.locator(".cc-card").count() == len(L))
    on = pg.locator(f'.cc-card[data-cc="15"] .cc-on').inner_text()
    check(f"each says which of your servants have it ({on})", "Chulainn Alter" in on and pg.locator(".cc-card.on").count() == 3)
    pg.fill("#codes input[data-ccp-q]", "Code: Mortal"); pg.wait_for_timeout(500)
    hits = pg.locator(".cc-card h3").all_inner_texts()
    check(f"search, and the box keeps its focus while the list changes ({hits})", hits == ["Code: Mortal"] and pg.evaluate("document.activeElement && document.activeElement.matches('input[data-ccp-q]')"))
    typ(pg, "#codes input[data-ccp-q]", ""); pg.wait_for_timeout(400)
    typ(pg, "#codes select[data-ccp-k]", "crit"); typ(pg, "#codes select[data-ccp-r]", "5"); pg.wait_for_timeout(300)
    rs = pg.evaluate("Array.from(document.querySelectorAll('.cc-card')).map((c) => [c.querySelector('.cc-stars').textContent.length, c.querySelector('.cc-chips') ? c.querySelector('.cc-chips').textContent : ''])")
    check(f"filters by what it's for and rarity ({len(rs)})", rs and all(r[0] == 5 and "Critical damage" in r[1] for r in rs))
    typ(pg, "#codes select[data-ccp-sort]", "mine"); typ(pg, "#codes select[data-ccp-k]", ""); typ(pg, "#codes select[data-ccp-r]", "0"); pg.wait_for_timeout(300)
    check("Engraved first", pg.locator(".cc-card").first.get_attribute("class") == "cc-card on")
    pg.locator(".cc-card.on .cc-on .linkish").first.click(); pg.wait_for_timeout(800)
    check("a name there opens that servant", pg.locator("#dossier .cc-sec").count() == 1 and "Chulainn Alter" in pg.locator("#dossier h2").inner_text())
    check("the codes are kept apart: the roster's servants didn't change", roster(pg) == before)

    # ================= the bond calculator =================
    tab = ABOND[CU["bg"]]
    bc = pg.locator("#dossier details.bc")
    check(f"a bond calculator under Progress ({bc.locator('summary').inner_text()})", bc.count() == 1 and pg.evaluate("!!document.querySelector('#dossier .lv-row').closest('.d-sec').querySelector('details.bc')"))
    check(f"NA's bond table for the servant ({pg.evaluate('window.__fgiBond.table(\"cu-chulainn-alter\")')[:3]}…)", pg.evaluate("window.__fgiBond.table('cu-chulainn-alter')") == tab)
    bc.locator("summary").click(); pg.wait_for_timeout(300)
    b0 = pg.evaluate(f"Math.floor(Number(JSON.parse(localStorage.getItem('{KEY}')).servants.find((x) => x.id === 'cu-chulainn-alter').bond) || 0)")
    need10 = tab[9] - (tab[b0 - 1] if b0 else 0)
    check(f"points to Bond 10 from the start of Bond {b0}: {need10:,}", pg.evaluate("window.__fgiBond.need('cu-chulainn-alter', 10)") == need10 and f"{need10:,}" in bc.locator(".bc-out").inner_text())
    pg.fill('#dossier input[data-bc="rem"]', "1000"); pg.wait_for_timeout(200)
    step = tab[b0] - (tab[b0 - 1] if b0 else 0)
    check(f"what the game says is still needed counts instead ({1000 + tab[9] - tab[b0]:,})", pg.evaluate("window.__fgiBond.need('cu-chulainn-alter', 10)") == 1000 + tab[9] - tab[b0] and pg.evaluate("document.activeElement.dataset.bc") == "rem")
    pg.select_option('#dossier select[data-bc-war]', "301"); pg.wait_for_timeout(800)
    fq = pg.evaluate("Array.from(document.querySelectorAll('#dossier select[data-bc-free] option')).map((o) => o.textContent)")
    check(f"a chapter's free quests come from Atlas Academy ({fq})", fq == ["Pick one…", "Frozen Plain: Snow Field (40 AP)"])
    pg.select_option('#dossier select[data-bc-free]', "94000001/3"); pg.wait_for_timeout(800)
    check(f"picking one fills in its bond and AP ({bc.locator('.bc-quest').inner_text()[-60:]})", pg.input_value('#dossier input[data-bc="base"]') == "690" and pg.input_value('#dossier input[data-bc="ap"]') == "40")
    per = pg.evaluate("window.__fgiBond.perRun()")
    check(f"front line: 690 × 1.2 = {per}", per == 828)
    pg.locator('#dossier input[data-bc="sup"]').check(); typ(pg, '#dossier input[data-bc="ce"]', "10"); typ(pg, '#dossier input[data-bc="flat"]', "50"); pg.wait_for_timeout(200)
    per = pg.evaluate("window.__fgiBond.perRun()")
    check(f"support in front (+4%), Bond CEs 10% and 50 flat: floor(690 × 1.24 × 1.1 + 50) = {per}", per == int(690 * 1.24 * 1.1 + 50))
    pg.locator('#dossier input[data-bc="tea"]').check(); pg.wait_for_timeout(200)
    per2 = pg.evaluate("window.__fgiBond.perRun()")
    runs = -(-(1000 + tab[9] - tab[b0]) // per2)
    out = bc.locator(".bc-out").inner_text()
    check(f"Stargazer's Teapot doubles it, and the runs and AP follow ({per2}, {runs} runs)", per2 == 2 * per and f"{runs:,}" in out and f"{runs * 40:,} AP" in out)
    pg.select_option('#dossier select[data-bc="front"]', "0"); pg.wait_for_timeout(200)
    check("in the back line only the support's 4% counts", pg.evaluate("window.__fgiBond.perRun()") == int((690 * 1.04 * 1.1 + 50)) * 2)
    pg.fill('#dossier form[data-bc-qid] input', "94000777"); pg.locator('#dossier form[data-bc-qid] button').click(); pg.wait_for_timeout(800)
    check("or a quest by its number", pg.input_value('#dossier input[data-bc="base"]') == "1000" and "Typed Quest" in bc.inner_text())
    check("the calculator is kept on its own; the roster's servants didn't change", roster(pg) == before and pg.evaluate(f"!!localStorage.getItem('{KEY}:bondcalc')"))

    # ================= the rank score: no points for rarity =================
    pg.evaluate(f"localStorage.setItem('{KEY}:rankView', 'list')")
    pg.goto(SEEDED + "#ranking"); pg.wait_for_timeout(1500)
    rows = pg.evaluate("Array.from(document.querySelectorAll('.rank-row')).map((r) => [r.querySelector('.rk-parts').textContent, r.querySelector('.rk-score').textContent])")
    def parts(t): return {k: float(v) for k, v in re.findall(r"(Stats|Skills|NP|Bond|Level) ([\d.]+)", t)}
    P = [parts(r[0]) for r in rows]
    check(f"the parts no longer include rarity ({rows[0][0][:90]})", rows and all("Rarity" not in r[0] for r in rows) and all(len(x) == 5 for x in P))
    check("each score is its five parts added up", all(abs(sum(x.values()) - float(r[1])) < 0.11 for x, r in zip(P, rows)))
    ids = pg.evaluate("Array.from(document.querySelectorAll('.rank-row .rk-name')).map((b) => b.dataset.id)")
    sv = {x["id"]: x for x in json.loads(roster(pg))["servants"]}
    def power(v):
        if not isinstance(v, (int, float)): return 0
        lv = min(max(v, 1), 10)
        return 0.8 * (1 if lv >= 10 else (lv - 1) / 10) + 0.2 * ((0.5 if lv >= 6 else 0) + (0.5 if lv >= 10 else 0))
    want = [sum(power((sv[i].get("skills") or [])[j] if j < len(sv[i].get("skills") or []) else None) for j in range(3)) / 3 * 33 for i in ids]
    check(f"skills are out of 33 now ({[round(w, 1) for w in want[:4]]} vs {[x['Skills'] for x in P[:4]]})", all(abs(w - x["Skills"]) < 0.06 for w, x in zip(want, P)))
    lv = [(min(max(int(sv[i].get("level") or 1), 1), 120)) for i in ids]
    CAPS = {1: 60, 2: 65, 3: 70, 4: 80, 5: 90}
    lvw = [(6.5 * l / 120 + (2 if CAPS.get(int(sv[i].get("rarity") or 0)) and l >= CAPS[int(sv[i]["rarity"])] else 0) + (1.5 if l >= 100 else 0)) * 1.2 for i, l in zip(ids, lv)]
    check(f"and level out of 12 ({lv[:4]} → {[x['Level'] for x in P[:4]]})", all(abs(w - x["Level"]) < 0.06 for w, x in zip(lvw, P)))

    # ================= the Saint Quartz picture =================
    pg.goto(SEEDED + "#summon"); pg.wait_for_timeout(1500)
    ic = pg.evaluate("Array.from(document.querySelectorAll('#summoning .sq-ic')).map((i) => [i.tagName, (i.getAttribute('src') || '').slice(0, 15), i.getBoundingClientRect().width])")
    check(f"Saint Quartz shows the game's picture ({len(ic)}, {ic[:1]})", ic and all(x[0] == "IMG" and x[1].startswith("data:image/web") for x in ic) and all(x[2] > 0 for x in ic))

    # ================= the Saint Quartz planner =================
    qp = pg.locator("#summoning .qp")
    check("the planner sits under the summoning simulator", qp.count() == 1)
    typ(pg, '#summoning .qp input[data-qp="sq"]', "600"); typ(pg, '#summoning .qp input[data-qp="tix"]', "2")
    day = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
    pg.select_option('#summoning .qp select[data-qp="t"]', "d"); pg.wait_for_timeout(200)
    typ(pg, '#summoning .qp input[data-qp="date"]', day); pg.wait_for_timeout(200)
    C = pg.evaluate("window.__fgiQuartz.calc()")
    check(f"600 Saint Quartz and 2 tickets: 20 × 11 + 2 = {C['n']} summons", C["sq"] == 600 and C["n"] == 222)
    check(f"the chance of a featured ★5 at 0.8% ({C['ch']:.4f})", abs(C["ch"] - (1 - 0.992 ** 222)) < 1e-9 and "Saint Quartz by then" in qp.inner_text())
    typ(pg, '#summoning .qp input[data-qp="week"]', "35"); pg.wait_for_timeout(200)
    C2 = pg.evaluate("window.__fgiQuartz.calc()")
    check(f"35 a week for about two weeks adds about 70 ({C2['sq']})", 600 + 65 <= C2["sq"] <= 600 + 73 and C2["n"] > C["n"])
    typ(pg, '#summoning .qp input[data-qp="sq"]', "900"); typ(pg, '#summoning .qp input[data-qp="tix"]', "0"); typ(pg, '#summoning .qp input[data-qp="week"]', "0"); pg.wait_for_timeout(200)
    C3 = pg.evaluate("window.__fgiQuartz.calc()")
    check(f"900 Saint Quartz is 330 summons: the guarantee makes it certain ({C3['n']}, {C3['ch']})", C3["n"] == 330 and C3["ch"] == 1 and "Enough for the 330-summon guarantee" in qp.inner_text())
    k = pg.evaluate("[window.__fgiQuartz.chance(400, 0.008, 2, 330), window.__fgiQuartz.chance(400, 0.008, 2, 0), window.__fgiQuartz.sqFor(330, 0), window.__fgiQuartz.sqFor(12, 1)]")
    check(f"two copies in 400: the guarantee gives one of them ({k[0]:.4f} vs {k[1]:.4f}); Saint Quartz for 330 summons {k[2]}, for 12 with a ticket {k[3]}", k[0] > k[1] and k[0] < 1 and k[2] == 900 and k[3] == 30)
    pg.select_option('#summoning .qp select[data-qp="r"]', "4"); pg.wait_for_timeout(200)
    C4 = pg.evaluate("window.__fgiQuartz.calc()")
    check(f"a ★4 rate-up: 1.5%, no guarantee ({C4['p']}, {C4['pity']})", abs(C4["p"] - 0.015) < 1e-12 and C4["pity"] == 0)
    ups = pg.evaluate("window.__fgiQuartz.targets().filter((x) => x.k.startsWith('u:')).map((x) => [x.n, x.est])")
    check(f"servants coming to NA are there to save for ({ups[:2]})", len(ups) >= 1 and all(u[1] for u in ups))
    check("the planner is kept on its own; the roster's servants didn't change", roster(pg) == before and pg.evaluate(f"!!localStorage.getItem('{KEY}:quartz')"))

    # ================= calendar files =================
    ics = pg.evaluate("""() => window.__fgiCal.ics([{k: 'event', id: 80700, n: 'A very long event name, with commas; semicolons and a Götterdämmerung of words to fold onto the next line', s: 1763000000, e: 1764000000, url: 'https://example.com/#event/80700', d: 'Line one\\nline two'}], {rem: 'P1D', start: true, last: true})""")
    lines = ics.split("\r\n")
    check("a calendar file: VCALENDAR, CRLF line ends", lines[0] == "BEGIN:VCALENDAR" and lines[-2] == "END:VCALENDAR" and lines[-1] == "" and "\n" not in ics.replace("\r\n", ""))
    check("no line longer than 75 bytes (longer ones fold)", all(len(l.encode("utf-8")) <= 75 for l in lines) and any(l.startswith(" ") for l in lines))
    un = ics.replace("\r\n ", "")
    check("text is escaped", "SUMMARY:A very long event name\\, with commas\\; semicolons and a Götterdämmerung" in un and "DESCRIPTION:Line one\\nline two" in un)
    check("times in UTC, a stable id, a reminder a day before it ends, and its last day", "DTSTART:20251113T021320Z" in un and "UID:fgi-event-80700-1763000000@fategrandindex.com" in un
          and "TRIGGER;RELATED=END:-P1D" in un and "SUMMARY:Last day: A very long" in un)
    check(f"nothing went wrong ({errs[:2]})", not errs)
    ctx.close()

    # ---------- with live updates on: Home's list, an event's page, banners in the planner ----------
    ctx, pg = page(p, INIT + LIVE_ON)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .cal-btn", timeout=20000); pg.wait_for_timeout(800)
    pg.locator("#home .cal-btn").click(); pg.wait_for_timeout(400)
    names = pg.locator("#home .cal-list b").all_inner_texts()
    check(f"Add to calendar lists NA's events and campaigns ({names})", "Calendar Test Festival, Part 1" in names and "Upcoming; Test Event" in names and "Calendar Test Pickup Summon" in names)
    pg.locator("#home .cal-list label", has_text="Upcoming; Test Event").locator("input").uncheck(); pg.wait_for_timeout(200)
    pg.select_option("#home .cal select[data-cal='rem']", "PT1H")
    with pg.expect_download() as dl:
        pg.locator('#home [data-action="cal-get"]').click()
    f = dl.value; txt = open(f.path(), encoding="utf-8").read().replace("\r\n ", "")
    check(f"the download ({f.suggested_filename}): the ticked ones, with the reminder picked", f.suggested_filename == "fgo-na-events.ics" and "SUMMARY:Calendar Test Festival\\, Part 1" in txt
          and "Calendar Test Pickup Summon" in txt and "Upcoming" not in txt and txt.count("TRIGGER;RELATED=END:-PT1H") == 2 and f"Rate-up: {FIVE['n']} (★5)" in txt)
    pg.reload(); pg.wait_for_selector("#home .cal-btn", timeout=20000); pg.locator("#home .cal-btn").click(); pg.wait_for_timeout(300)
    check("what was unticked and the reminder are remembered", not pg.locator("#home .cal-list label", has_text="Upcoming; Test Event").locator("input").is_checked() and pg.input_value("#home .cal select[data-cal='rem']") == "PT1H")
    pg.goto(SEEDED + "#summon"); pg.wait_for_timeout(1500)
    opts = pg.evaluate("Array.from(document.querySelectorAll('#summoning .qp select[data-qp=t] optgroup')).map((g) => [g.label, Array.from(g.querySelectorAll('option')).map((o) => o.textContent)])")
    check(f"the planner can save for NA's banners ({opts[0] if opts else None})", opts and opts[0][0] == "NA summoning campaigns" and any("Calendar Test Pickup Summon" in o for o in opts[0][1]))
    pg.select_option('#summoning .qp select[data-qp="t"]', index=0); pg.wait_for_timeout(300)
    C5 = pg.evaluate("window.__fgiQuartz.calc()")
    check(f"a banner that's on now counts to the day it ends, for its featured ★5 ({C5['who']}, {C5['T']['up']})", C5["who"]["n"] == FIVE["n"] and C5["T"]["up"] is False and abs(C5["T"]["at"] - (NOW + 8 * D)) < 5)
    ctx.close()

    # ================= Story: GamePress's walkthroughs =================
    ctx, pg = page(p, INIT)
    pg.goto(SEEDED + "#story"); pg.wait_for_timeout(1200)
    G = pg.evaluate("window.__fgiStoryGuides()")
    check(f"every Lostbelt and Ordeal Call chapter has GamePress's guide ({len(G)})", sorted(int(k) for k in G) == [301, 302, 303, 304, 305, 306, 307, 308, 309, 310, 311, 402, 403, 404]
          and all(re.match(r"^https://(fgo|grandorder)\.gamepress\.gg/", u) for v in G.values() for _, u in v))
    ctx.close()

print("errors:", errs[:5])
sys.exit(1 if fails or errs else 0)
