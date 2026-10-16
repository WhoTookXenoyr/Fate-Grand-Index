import os
# 0.22.0: the Event page (from On NA now) and simulating an NA banner on the Summoning page.
# Atlas Academy and the fandom wiki are replaced by stand-ins serving data shaped like theirs, dated around now.
import sys, tempfile, json, re, time, math
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = ("localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
        "localStorage.setItem('spirit-origin-list:v1:live', JSON.stringify({on: true}));"
        "if (!localStorage.getItem('spirit-origin-list:v1:summon')) localStorage.setItem('spirit-origin-list:v1:summon', JSON.stringify({anim: false}));")

AD = open(f"{sp}/atlas_data.js").read()
grab = lambda name: json.loads(re.search(r"const %s = (\[.*?\]);\n" % name, AD, re.S).group(1))
ATL, ATC, MATS = grab("ATLAS_S"), grab("ATLAS_C"), grab("ATLAS_MATS")
IMG = "https://static.atlasacademy.io/NA/"
camel = lambda c: {"Moon Cancer": "moonCancer", "Alter Ego": "alterEgo"}.get(c, c[:1].lower() + c[1:])
ERESH = next(x for x in ATL if x["n"] == "Ereshkigal")
top = max(x["no"] for x in ATL)
NOW = int(time.time()); D = 86400
EID, WID = 80900, 9900
CUR, CUR2 = 94100001, 94100002  # the event's two currencies
svts = [{"id": x["id"], "collectionNo": x["no"], "name": x["n"], "type": "normal", "flag": "normal", "className": camel(x["c"]), "rarity": x["r"], "atkMax": 1, "hpMax": 1, "face": IMG + x["f"]} for x in ATL]
NEW_S = {"id": 9990100, "collectionNo": top + 1, "name": "Test Arrival Lancer", "type": "normal", "flag": "normal", "className": "lancer", "rarity": 5, "atkMax": 1, "hpMax": 1, "face": IMG + "Faces/f_9990100.png"}
ces = [{"id": 9400000 + c["no"], "collectionNo": c["no"], "name": c["n"], "type": "servantEquip", "flag": "normal", "rarity": c["r"], "atkMax": 1, "hpMax": 1, "face": IMG + c["fc"]} for c in ATC if c.get("fc") and c["no"] < 100000]
EV_CE = ces[-1]  # the event's own Craft Essence
WELFARE = next(x for x in ATL if x["r"] == 4 and x["no"] > 300)
ev = {"id": EID, "type": "eventQuest", "name": "Test Halloween Rising", "noticeAt": NOW - 5 * D, "startedAt": NOW - 3 * D, "endedAt": NOW + 9 * D, "finishedAt": NOW + 9 * D, "materialOpenedAt": NOW + 40 * D, "warIds": [WID]}
PC5 = next(x for x in ATL if x["n"] == "Gilgamesh" and x["r"] == 5)  # a ★5 who isn't on the sample roster or a Guest
EID2 = 80901
ev2 = {"id": EID2, "type": "eventQuest", "name": "Fate/Summer Splash Carnival", "noticeAt": NOW - 4 * D, "startedAt": NOW - D, "endedAt": NOW + 12 * D, "finishedAt": NOW + 12 * D, "materialOpenedAt": NOW + 40 * D, "warIds": []}
event_full2 = dict(ev2, **{"originalName": ev2["name"], "shortName": "", "detail": "Splash around.", "banner": "", "icon": "", "shop": [], "missions": [], "rewards": [], "pointGroups": [], "lotteries": []})
gacha2 = {"id": 50902, "name": "Fate/Grand Order Fes. 2026 Summon", "type": "payGacha", "openedAt": NOW - 2 * D + 7200, "closedAt": NOW + 8 * D, "featuredSvtIds": [PC5["id"]]}
basic_events = [ev, ev2, {"id": 20900, "type": "questCampaign", "name": "AP Cost 1/2", "noticeAt": ev["startedAt"], "startedAt": ev["startedAt"], "endedAt": ev["endedAt"], "finishedAt": ev["endedAt"], "warIds": []}]
gacha = {"id": 50900, "name": "Test Halloween Rising Pickup Summon", "type": "payGacha", "openedAt": NOW - 2 * D, "closedAt": NOW + 7 * D, "featuredSvtIds": [ERESH["id"], NEW_S["id"], EV_CE["id"]],
         "gachaSubs": [{"id": 1, "openedAt": NOW - 2 * D, "closedAt": NOW + 2 * D}, {"id": 2, "openedAt": NOW + 2 * D, "closedAt": NOW + 7 * D}]}

# what Ereshkigal's skills still need (sample roster: skills 9, 8, 7 or so): two of those materials are sold in the shop
need_rows = ERESH["ms"][6:9]
mat_ids = []
for row in need_rows:
    for k in range(0, len(row), 2):
        mid = MATS[row[k]][0]
        if mid not in mat_ids: mat_ids.append(mid)
M1, M2 = mat_ids[0], mat_ids[-1]
mat_name = {m[0]: m[1] for m in MATS}
item = lambda i, n, t="eventItem": {"id": i, "name": n, "type": t, "icon": IMG + f"Items/{i}.png", "background": "gold", "uses": []}
ITEMS = [item(CUR, "Pumpkin Lantern"), item(CUR2, "Candy Coin"), item(1, "QP", "qp"), item(2, "Saint Quartz", "stone"), item(M1, mat_name[M1], "skillLvUp"), item(M2, mat_name[M2], "skillLvUp")]
cost = lambda cid, n: {"item": item(cid, "Pumpkin Lantern" if cid == CUR else "Candy Coin"), "amount": n}
shop = [
    {"id": 1, "name": mat_name[M1], "detail": "", "purchaseType": "item", "targetIds": [M1], "setNum": 1, "limitNum": 5, "cost": cost(CUR, 100), "priority": 9, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
    {"id": 2, "name": mat_name[M2], "detail": "", "purchaseType": "item", "targetIds": [M2], "setNum": 2, "limitNum": 10, "cost": cost(CUR, 50), "priority": 8, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
    {"id": 3, "name": EV_CE["name"], "detail": "", "purchaseType": "servant", "targetIds": [EV_CE["id"]], "setNum": 1, "limitNum": 4, "cost": cost(CUR2, 300), "priority": 7, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
    {"id": 5, "name": mat_name[M1], "detail": "", "purchaseType": "item", "targetIds": [M1], "setNum": 1, "limitNum": 999, "cost": cost(CUR2, 20), "priority": 6, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
    {"id": 4, "name": "QP", "detail": "", "purchaseType": "item", "targetIds": [1], "setNum": 1000000, "limitNum": 0, "cost": cost(CUR2, 10), "priority": 1, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
]
gift = lambda t, i, n=1: {"id": 1, "type": t, "objectId": i, "priority": 0, "num": n, "giftAdds": []}
EMBER = 9770100
event_full = dict(ev, **{"originalName": ev["name"], "shortName": "", "detail": "Trick or treat across the city.", "banner": IMG + "Banner/event_war_80900.png", "icon": "",
    "shop": shop,
    "missions": [{"id": 1, "dispNo": 1, "name": "Clear 5 quests in the event", "detail": "", "gifts": [gift("item", 2, 1)], "conds": []},
                 {"id": 2, "dispNo": 2, "name": "", "detail": "", "gifts": [gift("servant", EMBER, 3)], "conds": [{"missionProgressType": "clear", "conditionMessage": "Defeat 10 Saber-class enemies"}]},
                 {"id": 3, "dispNo": 3, "name": "Get 100,000 points", "detail": "", "gifts": [gift("servant", EV_CE["id"])], "conds": []}],
    "rewards": [{"groupId": 0, "point": 10000, "gifts": [gift("item", CUR, 50)]}, {"groupId": 0, "point": 500000, "gifts": [gift("servant", WELFARE["id"])]}],
    "pointGroups": [],
    "lotteries": [{"id": 1, "cost": cost(CUR2, 10), "limited": False, "boxes": [{"boxIndex": 0, "no": 1, "gifts": [gift("item", M1, 1)], "maxNum": 3, "isRare": True}, {"boxIndex": 0, "no": 2, "gifts": [gift("item", 1, 100000)], "maxNum": 20, "isRare": False},
                                                                                {"boxIndex": 1, "no": 1, "gifts": [gift("item", M2, 1)], "maxNum": 2, "isRare": True}]}]})
q = lambda i, n, t, ac, ap, lv, fl=None, ph=None: {"id": i, "name": n, "type": t, "afterClear": ac, "consumeType": "ap", "consume": ap, "recommendLv": lv, "flags": fl or [], "phases": ph or [1], "spotName": "Pumpkin Plaza", "openedAt": NOW - 3 * D}
war = {"id": WID, "name": "Pumpkin City", "eventId": EID, "spots": [{"id": 1, "name": "Pumpkin Plaza", "quests": [
    q(94900101, "Chapter One: Trick", "main", "close", 5, "70", ph=[1, 2, 3]), q(94900102, "Chapter One: Trick", "main", "close", 5, "70", ["branch"], [2]),
    q(94900201, "Candy Hunt - Novice", "event", "repeatLast", 20, "60", ["displayLoopmark"]), q(94900202, "Candy Hunt - Expert", "event", "repeatLast", 40, "90+", ["displayLoopmark"]),
    q(94900301, "A Side Story", "event", "close", 5, "80"), q(94900401, "[High Difficulty] The Great Pumpkin", "event", "close", 5, "90++", ["dropFirstTimeOnly", "notRetrievable"])]}]}
drops = {94900201: [{"type": "item", "objectId": CUR, "num": 3, "dropCount": 300, "runs": 100, "dropExpected": 3.0, "dropVariance": 1}, {"type": "item", "objectId": M1, "num": 1, "dropCount": 20, "runs": 100, "dropExpected": 0.2}],
         94900202: [{"type": "item", "objectId": CUR, "num": 3, "dropCount": 450, "runs": 100, "dropExpected": 4.5, "dropVariance": 1}, {"type": "item", "objectId": CUR2, "num": 2, "dropCount": 100, "runs": 100, "dropExpected": 1.0}]}
basic_svt = [{"id": EMBER, "collectionNo": 0, "name": "Test Gold Ember", "type": "combineMaterial", "rarity": 4, "face": IMG + "Faces/f_9770100.png", "className": "ALL"}]
info = {"hash": "ev1", "timestamp": NOW - 3600, "dataVer": 900}
hits = {}
def count(k): hits[k] = hits.get(k, 0) + 1
def jfulfill(r, body, status=200):
    r.fulfill(status=status, body=json.dumps(body), headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"})
def atlas(r):
    u = urlparse(r.request.url); p = u.path; count(p)
    files = {"/export/NA/info.json": info, "/export/NA/basic_servant.json": svts + [NEW_S], "/export/NA/basic_equip.json": ces, "/export/NA/basic_event.json": basic_events,
             "/export/NA/nice_gacha.json": [gacha, gacha2], "/export/NA/nice_item.json": ITEMS, "/export/NA/basic_svt.json": basic_svt,
             f"/nice/NA/event/{EID}": event_full, f"/nice/NA/war/{WID}": war, f"/nice/NA/event/{EID2}": event_full2}
    m = re.match(r"/nice/NA/quest/(\d+)/(\d+)$", p)
    if p in files: return jfulfill(r, files[p])
    if m and int(m.group(1)) in drops: return jfulfill(r, {"id": int(m.group(1)), "drops": drops[int(m.group(1))]})
    jfulfill(r, {"detail": "Not found"}, 404)
WIKI_HTML = """<div class="mw-parser-output"><p>Intro: <b>Halloween</b> is back.<script>window.__pwned = 1</script></p>
<h2><span class="mw-headline" id="Event_Summary">Event Summary</span><span class="mw-editsection">[edit]</span></h2>
<p style="color:red" onclick="window.__pwned=2">Clear the main quests, then farm <a href="/wiki/Candy">Candy</a> and <a href="javascript:window.__pwned=3">this</a>.</p>
<img src="data:image/gif;base64,R0lGOD" data-src="https://static.wikia.nocookie.net/fategrandorder/images/a/aa/Pumpkin.png/revision/latest?cb=1" width="50" height="50" alt="Pumpkin" onerror="window.__pwned=4">
<img src="https://evil.example.com/x.png" alt="outside picture">
<iframe src="https://evil.example.com/"></iframe><form action="https://evil.example.com/"><input name="x"></form>
<h2><span class="mw-headline" id="Event_Servants">Event Servants</span></h2>
<table class="wikitable" style="width:100%"><tr><th>Servant</th><th>Bonus</th></tr><tr><td><a href="/wiki/Ereshkigal">Ereshkigal</a></td><td colspan="1" onmouseover="window.__pwned=5">+100% Candy</td></tr></table>
<h2><span class="mw-headline" id="Event_Cards">Event Cards</span></h2><ul><li>Pumpkin Party: +1 Candy per drop</li></ul>
<h2><span class="mw-headline" id="Misc_Info">Misc Info</span></h2><p>Released for Halloween.<style>body{display:none}</style></p>
<h2><span class="mw-headline" id="Game_Updates">Game Updates</span></h2><p>New interludes.</p>
<h2><span class="mw-headline" id="Trivia_Gallery">Something Else</span></h2><p>Other things.</p></div>"""
WIKI_B = """<div class="mw-parser-output"><p>Summer is here.</p>
<div class="mw-heading mw-heading2"><h2 id="Event_Summary">Event Summary</h2></div><p>Swim and farm shells.</p>
<div class="mw-heading mw-heading2"><h2 id="Misc_Info">Misc Info</h2></div><p>Splash trivia.</p></div>"""
wiki_mode = {"v": "ok"}
hold = {"page": None, "routes": []}  # a wiki page whose answer is held back, to open another event meanwhile
def wiki(r):
    qs = parse_qs(urlparse(r.request.url).query); count("wiki:" + qs.get("action", ["?"])[0])
    if wiki_mode["v"] == "down": return r.abort()
    if qs.get("origin") != ["*"]: return r.fulfill(status=403, body="no CORS")
    if qs.get("action") == ["query"]:
        if "Summer" in qs.get("srsearch", [""])[0]: return jfulfill(r, {"query": {"search": [{"title": "Fate/Summer Splash Carnival"}]}})
        return jfulfill(r, {"query": {"search": [{"title": "Talk:Test Halloween Rising"}, {"title": "Test Halloween Rising"}, {"title": "Halloween Event List"}]}})
    if qs.get("action") == ["parse"]:
        pg_ = qs.get("page", [""])[0]
        if hold["page"] == pg_: hold["routes"].append(r); return
        return jfulfill(r, {"parse": {"title": pg_, "text": WIKI_B if "Summer" in pg_ else WIKI_HTML}})
    jfulfill(r, {}, 400)
def pic(r): r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png")
def page(p, w=1400, h=1000, mobile=False, init=INIT):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(init)
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://api.atlasacademy.io/**", atlas); pg.route("https://static.atlasacademy.io/**", pic)
    pg.route("https://fategrandorder.fandom.com/**", wiki); pg.route("https://static.wikia.nocookie.net/**", pic)
    pg.route("https://evil.example.com/**", lambda r: (count("evil"), r.abort()))
    return ctx, pg
EVP = "#event"
sec = lambda pg, k: pg.locator(f"#ev-{k}")
num = lambda t: int(re.sub(r"[^\d]", "", t) or 0)

with sync_playwright() as p:
    ctx, pg = page(p)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .hm-b-live .lv-cols", timeout=20000); pg.wait_for_timeout(500)
    r0 = {k: v for k, v in json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")).items() if k != "savedAt"}
    link = pg.locator('#home .hm-b-live [data-action="ev-open"]', has_text="Test Halloween Rising").first
    check("On NA now: the event's name opens its page", link.count() == 1)
    link.click(); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(1500)
    check(f"the Event page has its own address ({pg.evaluate('location.hash')})", pg.evaluate("location.hash") == f"#event/{EID}" and pg.locator("#view-event").is_visible() and pg.locator("#view-home").is_hidden())
    check("no tab is selected, the tab bar still has seven", pg.locator('.tabs .tab[aria-selected="true"]').count() == 0 and pg.locator(".tabs .tab").count() == 7)
    head = pg.locator(f"{EVP} .ev-head").inner_text()
    check(f"header: name, countdown and the event's own banner picture", "Test Halloween Rising" in head and re.search(r"ends in \d+d \d+h", head) is not None and pg.locator(f"{EVP} .ev-bn").count() == 1)
    check("summary from the event and the wiki", "Trick or treat across the city." in sec(pg, "summary").inner_text() and "Clear the main quests" in sec(pg, "summary").inner_text())
    check("the wiki page found is the event's own (not the Talk page)", "Test Halloween Rising" in pg.locator(f"{EVP} .ev-src").inner_text() and "Talk:" not in pg.locator(f"{EVP} .ev-src").inner_text())

    # ---- the wiki's text arrives filtered
    check("nothing from the wiki ran", pg.evaluate("window.__pwned") is None)
    html = pg.evaluate("document.getElementById('event').innerHTML")
    check("no script, style, frame, form or event handler from the wiki", not re.search(r"<script|<style|<iframe|<form|<input name=\"x\"|onclick|onerror|onmouseover|javascript:", html, re.I))
    check("pictures only from the wiki's own servers, and only the lazy ones' real picture", "evil.example.com" not in html and "static.wikia.nocookie.net/fategrandorder/images/a/aa/Pumpkin.png" in html and "data:image/gif" not in html and hits.get("evil", 0) == 0)
    check("wiki links point to the wiki and open in a new tab", pg.locator(f'{EVP} .ew a[href="https://fategrandorder.fandom.com/wiki/Candy"][target="_blank"]').count() == 1)
    check("the wiki's style attributes are gone, colspan kept", "style=" not in pg.locator(f"{EVP} .ew").first.inner_html() and pg.locator(f'{EVP} .ew td[colspan="1"]').count() == 1)
    check("Event Servants and Event Cards from the wiki sit under Event servants", "+100% Candy" in sec(pg, "svts").inner_text() and "+1 Candy per drop" in sec(pg, "svts").inner_text())
    check("Misc Info and Game Updates have their own section", "Released for Halloween." in sec(pg, "misc").inner_text() and "New interludes." in sec(pg, "misc").inner_text())

    # ---- from Atlas Academy
    st = sec(pg, "svts").inner_text()
    check(f"what you can get: the welfare servant and the event's Craft Essence", WELFARE["n"] in pg.locator("#ev-svts .ev-gets").inner_html() and EV_CE["name"] in pg.locator("#ev-svts .ev-gets").inner_html())
    mi = sec(pg, "missions").inner_text()
    check("missions, with their rewards; an ember's name comes from the list of everything", "Clear 5 quests in the event" in mi and "Defeat 10 Saber-class enemies" in mi and "Test Gold Ember" in mi and "Saint Quartz" in mi)
    qt = sec(pg, "quests")
    groups = qt.locator("h4").all_inner_texts()
    check(f"quests grouped: main, free, extra, challenge; the branch copy of a chapter left out ({groups})", [g.split("\n")[0].strip() for g in groups] == ["MAIN QUESTS 1", "FREE QUESTS 2", "EXTRA QUESTS 1", "CHALLENGE QUESTS 1"] or [re.sub(r"\s+", " ", g).upper() for g in groups] == ["MAIN QUESTS 1", "FREE QUESTS 2", "EXTRA QUESTS 1", "CHALLENGE QUESTS 1"])
    pg.wait_for_timeout(800)
    ex = qt.locator(".ev-q", has_text="Candy Hunt - Expert").inner_text()
    check(f"free quests show drops per run ({ex!r})", "Pumpkin Lantern 13.50" in ex or "Pumpkin Lantern 14" in ex)
    sh = sec(pg, "shop").inner_text()
    check(f"the shop, by currency, with everything's total; a Craft Essence shows its name", "Pumpkin Lantern" in sh and "everything 1,000" in sh and "Candy Coin" in sh and "1 unlimited" in sh and EV_CE["name"] in sh)
    check("point rewards and the lottery", "500,000" in sec(pg, "points").inner_text() and "Box 1" in sec(pg, "points").inner_text() and "Box 2" in sec(pg, "points").inner_text())

    # ---- the calculator
    calc = pg.locator(f'{EVP} .ev-calc[data-cur="{CUR}"]')
    rows = calc.locator("tbody tr")
    check(f"calculator: the shop's materials your servants need ({rows.count()})", rows.count() >= 1 and mat_name[M1] in calc.inner_text())
    r1 = calc.locator("tbody tr", has_text=mat_name[M1])
    need1 = num(r1.locator("td").nth(1).inner_text())
    who = r1.locator("td").nth(1).get_attribute("title") or ""
    check(f"need counts your roster, Ereshkigal among them ({need1}; {who[:80]})", need1 > 0 and "Ereshkigal" in who)
    buy1 = min(5, need1)
    check(f"buy and cost: min(limit, what's needed) × 100 ({r1.locator('td').nth(3).inner_text()}, {r1.locator('td').nth(4).inner_text()})",
          num(r1.locator("td").nth(3).inner_text()) == buy1 and num(r1.locator("td").nth(4).inner_text()) == buy1 * 100)
    c2 = pg.locator(f'{EVP} .ev-calc[data-cur="{CUR2}"] tbody tr', has_text=mat_name[M1])
    check(f"the same material sold for the other currency only covers what's still left ({c2.count()} row, buy {c2.locator('td').nth(3).inner_text() if c2.count() else '?'})",
          c2.count() == 1 and num(c2.locator("td").nth(3).inner_text()) == max(0, need1 - buy1))
    r1.locator("input").fill(str(max(0, need1 - 1))); pg.wait_for_timeout(700)
    r1 = calc.locator("tbody tr", has_text=mat_name[M1])
    check("what you have lowers what to buy", num(r1.locator("td").nth(3).inner_text()) == 1 and num(r1.locator("td").nth(4).inner_text()) == 100)
    check("the field keeps focus while you type", pg.evaluate("document.activeElement && document.activeElement.dataset.evHave") == str(M1))
    tot = calc.locator(".ev-tot").inner_text()
    mine = sum(num(calc.locator("tbody tr").nth(i).locator("td").nth(4).inner_text()) for i in range(calc.locator("tbody tr").count()))
    check(f"totals: for your servants and the whole shop ({tot!r})", f"{mine:,}" in tot and "1,000" in tot)
    run = calc.locator(".ev-run").inner_text()
    check(f"best quest for the currency: the one with the most per AP ({run!r})", "Candy Hunt - Novice" in run and "9.0 a run" in run)
    calc.locator("[data-ev-bonus]").fill("2"); pg.wait_for_timeout(700)
    run2 = pg.locator(f'{EVP} .ev-calc[data-cur="{CUR}"] .ev-run').inner_text()
    left = mine
    check(f"a bonus per drop raises it: (3+2)×3 = 15 a run ({run2!r})", "15.0 a run" in run2 and (f"About {math.ceil(left / 15):,} runs" in run2 if left else True))
    saved = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:event')"))
    check("the calculator's numbers are kept in this browser", saved.get("have", {}).get(str(M1)) == max(0, need1 - 1) and saved.get("bonus", {}).get(str(CUR)) == 2)
    pg.select_option(f"{EVP} [data-ev-to]", "9"); pg.wait_for_timeout(500)
    r9 = pg.locator(f'{EVP} .ev-calc[data-cur="{CUR}"] tbody tr', has_text=mat_name[M1])
    check("skills up to Lv 9 needs no more than up to Lv 10", r9.count() == 0 or num(r9.locator("td").nth(1).inner_text()) <= need1)
    pg.select_option(f"{EVP} [data-ev-to]", "10"); pg.wait_for_timeout(400)

    # ---- the banner, then Simulate
    sm = sec(pg, "summon")
    check("summoning campaign: the event's banner, its rate-up schedule and featured", "Test Halloween Rising Pickup Summon" in sm.inner_text() and "Rate-up schedule" in sm.inner_text() and sm.locator(".lv-face").count() == 3)
    check("your roster wasn't touched by the Event page", {k: v for k, v in json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")).items() if k != "savedAt"} == r0)
    sm.locator('[data-action="ev-sim"]').click(); pg.wait_for_timeout(1200)
    check("Simulate opens the Summoning page with the NA banner", pg.locator("#view-summon").is_visible() and pg.evaluate("location.hash") == "#summon" and "Test Halloween Rising Pickup Summon" in pg.locator(".sm-ban").inner_text())
    ban = pg.locator(".sm-ban").inner_text()
    check(f"two featured ★5 servants share 0.8%, the Craft Essence gets its own rate, no guarantee ({re.findall(r'[0-9.]+% each[^\\n]*', ban)})", "0.40% each summon each" in ban and "guarantee isn't simulated" in ban)
    hero = pg.locator(".smh").inner_text()
    check(f"the banner's header names both ({hero[:120]!r})", "Ereshkigal or Test Arrival Lancer" in hero)
    chances = pg.locator(".sm-ch").inner_text()
    check("drop chances list both featured, each at 0.40%", "Test Arrival Lancer" in chances and chances.count("0.40%") >= 2)
    for _ in range(12): pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(800)
    smst = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')"))
    check(f"the banner rolls ({smst.get('n')} summons) and no Guest is added for the featured servants", smst.get("n", 0) >= 11 and smst.get("ban", {}).get("id") == 50900
          and {k: v for k, v in json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")).items() if k != "savedAt"} == r0)
    pg.go_back(); pg.wait_for_timeout(1200)
    check("Back returns to the Event page", pg.evaluate("location.hash") == f"#event/{EID}" and pg.locator("#view-event").is_visible())
    pg.go_back(); pg.wait_for_timeout(1000)
    check("and Back again to Home", pg.locator("#view-home").is_visible() and pg.locator("#view-event").is_hidden())
    pg.click("#tab-summon"); pg.wait_for_timeout(600)
    pg.click('[data-action="sm-ban-off"]'); pg.wait_for_timeout(600)
    smst = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')"))
    check("Back to your own banner leaves the NA one", "ban" not in smst and pg.locator(".sm-ban").count() == 0)

    # ---- 0.22.1: the guarantee for a featured ★5 who isn't on your list
    pg.click("#tab-home"); pg.wait_for_timeout(600)
    pg.locator("#home .lv-ban", has_text="Fes. 2026").locator('[data-action="ev-sim"]').click(); pg.wait_for_timeout(900)
    st = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')")); st["n"] = 325; st["got"] = 0
    pg.evaluate("(v) => localStorage.setItem('spirit-origin-list:v1:summon', v)", json.dumps(st))
    pg.reload(); pg.wait_for_selector(".sm-ban", timeout=20000); pg.wait_for_timeout(500)
    check("one featured ★5: the guarantee is on", "guarantee is on" in pg.locator(".sm-ban").inner_text())
    pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(1500)
    res = pg.locator("#sm-results").inner_text()
    up = pg.locator("#sm-results .smr", has_text=PC5["n"])
    check(f"by summon 330 the featured ★5 came, by name, not as an unknown servant ({PC5['n']})", up.count() >= 1 and pg.locator("#sm-results .smr.anon.r5").count() == 0)
    check("their card says rate-up or guaranteed, not Past Chaldea", up.first.locator(".smr-tag.pity, .smr-tag.up").count() == 1 and up.first.locator(".smr-tag.pc").count() == 0)
    smst = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')"))
    check(f"the banner counts them as got ({smst.get('got')})", 326 <= smst.get("got", 0) <= 330 and not any(str(l.get("id", "")).startswith("na:") for l in smst.get("log", [])))
    pg.click('[data-action="sm-ban-off"]'); pg.wait_for_timeout(500)

    # ---- straight to an event's address, from what's kept in this browser
    n_ev = hits.get(f"/nice/NA/event/{EID}", 0)
    pg.goto(SEEDED + f"#event/{EID}"); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(800)
    check(f"opening the address directly shows the event, from this browser's copy ({n_ev} → {hits.get(f'/nice/NA/event/{EID}', 0)} downloads)", hits.get(f"/nice/NA/event/{EID}", 0) == n_ev and "Test Halloween Rising" in pg.locator(f"{EVP} .ev-title").inner_text())
    check("opened directly, the banners are there too", pg.locator('#ev-summon [data-action="ev-sim"]').count() == 1)
    check("the wiki's text read back from this browser is filtered again", pg.evaluate("window.__pwned") is None and not re.search(r"onclick|<script", pg.evaluate("document.getElementById('event').innerHTML"), re.I))
    ctx.close()

    # ================= the wiki can't be reached =================
    wiki_mode["v"] = "down"
    ctx, pg = page(p)
    pg.goto(SEEDED + f"#event/{EID}"); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(1500)
    src = pg.locator(f"{EVP} .ev-src").inner_text()
    check(f"without the wiki, the Atlas parts still show and it says so ({src!r})", "Couldn't reach the Fate/Grand Order wiki" in src and sec(pg, "shop").count() == 1 and sec(pg, "quests").count() == 1)
    pg.wait_for_timeout(1500)
    check("a first visit straight to an event's address gets the banners too", pg.locator('#ev-summon [data-action="ev-sim"]').count() == 1)
    wiki_mode["v"] = "ok"
    ctx.close()

    # ================= 0.22.1: two events, one after the other =================
    ctx, pg = page(p)
    hold["page"] = "Test Halloween Rising"
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .hm-b-live .lv-cols", timeout=20000); pg.wait_for_timeout(500)
    pg.locator('#home .hm-b-live [data-action="ev-open"]', has_text="Test Halloween Rising").first.click(); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000)
    check("opening an event moves focus to its page", pg.evaluate("document.activeElement && document.activeElement.id") == "event")
    for _ in range(40):
        if hold["routes"]: break
        pg.wait_for_timeout(250)
    pg.click(f"{EVP} .ev-back"); pg.wait_for_timeout(400)
    pg.locator('#home .hm-b-live [data-action="ev-open"]', has_text="Summer Splash").first.click()
    pg.wait_for_selector(f"{EVP} .ev-title:has-text('Summer Splash')", timeout=20000); pg.wait_for_timeout(800)
    held = len(hold["routes"]); hold["page"] = None
    for rr in hold["routes"]: jfulfill(rr, {"parse": {"title": "Test Halloween Rising", "text": WIKI_HTML}})
    hold["routes"].clear(); pg.wait_for_timeout(2000)
    t = pg.locator(EVP).inner_text()
    check(f"the first event's wiki text doesn't land on the second one's page ({held} held)", held == 1 and "Halloween is back" not in t and "Clear the main quests" not in t and "Swim and farm shells." in t)
    check("newer wiki heading markup still splits the sections", "Splash trivia." in sec(pg, "misc").inner_text() and "Splash trivia." not in sec(pg, "summary").inner_text())
    check("a banner that only shares 'Fate/Grand Order' with the event isn't taken for its own", "None of these is named after the event" in sec(pg, "summon").inner_text())
    ctx.close()

    # ================= 0.22.1: live updates off =================
    ctx, pg = page(p, init=INIT.replace("{on: true}", "{on: false}"))
    pg.goto(SEEDED + f"#event/{EID}"); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(800)
    so = sec(pg, "summon")
    check("live updates off: the Event page says why there are no banners and offers to turn them on", "Live NA updates are off" in so.inner_text() and so.locator('[data-action="live-on"]').count() == 1)
    so.locator('[data-action="live-on"]').click()
    try: pg.wait_for_selector('#ev-summon [data-action="ev-sim"]', timeout=15000); on = True
    except Exception: on = False
    check("turned on from there, the banners arrive", on)
    ctx.close()

    # ================= phone =================
    ctx, pg = page(p, w=390, h=860, mobile=True)
    pg.goto(SEEDED + f"#event/{EID}"); pg.wait_for_selector(f"{EVP} .ev-calc", timeout=20000); pg.wait_for_timeout(1500)
    check(f"phone: the Event page fits the screen ({pg.evaluate('document.documentElement.scrollWidth')})", pg.evaluate("document.documentElement.scrollWidth") <= 390)
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
