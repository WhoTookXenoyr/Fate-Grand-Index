import os
# 0.22.0: the Event page (from On NA now) and simulating an NA banner on the Summoning page. Rebuilt as tabs in 0.22.2.
# Atlas Academy and the fandom wiki are replaced by stand-ins serving data shaped like theirs, dated around now. The
# wiki stand-in copies the markup of a real NA event page (October 2026): an event header and a tabber of transcluded
# pages, nested tabbers, item icons with phone-only copies, tooltips with hidden text, servant and Craft Essence icons.
import sys, tempfile, json, re, time, math, datetime
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
ERESH_NP = ERESH["np"]["n"] if isinstance(ERESH["np"], dict) else ERESH["np"][0]["n"]
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
    {"id": 6, "name": "Pumpkin Party Suit", "detail": "", "purchaseType": "costumeRelease", "targetIds": [60330012], "setNum": 1, "limitNum": 1, "cost": cost(CUR2, 150), "priority": 5, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
    {"id": 4, "name": "QP", "detail": "", "purchaseType": "item", "targetIds": [1], "setNum": 1000000, "limitNum": 0, "cost": cost(CUR2, 10), "priority": 1, "openedAt": NOW - 3 * D, "closedAt": NOW + 9 * D, "gifts": [], "itemSet": []},
]
gift = lambda t, i, n=1: {"id": 1, "type": t, "objectId": i, "priority": 0, "num": n, "giftAdds": []}
EMBER = 9770100
# the event's own mission list, and random missions in two ranks (detective missions in the real event)
missions = [{"id": 1, "type": "event", "dispNo": 1, "name": "Clear 5 quests in the event", "detail": "", "gifts": [gift("item", 2, 1)], "conds": []},
            {"id": 2, "type": "event", "dispNo": 2, "name": "", "detail": "", "gifts": [gift("servant", EMBER, 3)], "conds": [{"missionProgressType": "clear", "conditionMessage": "Defeat 10 Saber-class enemies"}]},
            {"id": 3, "type": "event", "dispNo": 3, "name": "Get 100,000 points", "detail": "", "gifts": [gift("servant", EV_CE["id"])], "conds": []}]
missions += [{"id": 900 + i, "type": "event", "dispNo": 4 + i, "name": f"Filler mission {4 + i}", "detail": "", "gifts": [gift("item", 1, 1000)], "conds": []} for i in range(19)]
missions += [{"id": 801, "type": "random", "dispNo": 1, "name": "Find the missing pumpkin head", "detail": "", "gifts": [gift("item", CUR, 5)], "conds": []},
             {"id": 802, "type": "random", "dispNo": 1, "name": "Question three witnesses", "detail": "", "gifts": [gift("item", CUR2, 5)], "conds": []}]
event_full = dict(ev, **{"originalName": ev["name"], "shortName": "", "detail": "Trick or treat across the city.", "banner": IMG + "Banner/event_war_80900.png", "icon": "",
    "shop": shop, "missions": missions, "randomMissions": [{"missionId": 801, "missionRank": 0}, {"missionId": 802, "missionRank": 1}],
    "svts": [{"svtId": WELFARE["id"], "type": "join"}],
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

# ---------------- the wiki stand-in ----------------
WT_PAGE = "Test Halloween Rising (US)"
def wdate(ts): d = datetime.datetime.fromtimestamp(ts - 7 * 3600, datetime.timezone.utc); n = d.day; return d.strftime("%B ") + f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')} " + d.strftime("%Y %H:%M")
SUBS = ["Main Info", "Event Shop", "Mission List", "Detective Missions", "Main Quests", "Free Quests", "Summoning Campaign"]
WIKITEXT = {
    WT_PAGE: "__NOTOC__\n{{EventHeaderNA\n|pagename=%s\n|image=TestBanner.png\n|start=%s\n|end=%s\n|timezone=PST\n|name=Test Halloween Rising\n|requirement=[[Fuyuki]]\n|summary=TestPrologue.png\n}}\n"
             "{{Divider|img=Divider.png|width=825px|top|left|text=<center><big>EVENT INFO</big></center>|color=#0a438e}}\n<tabber>\n%s\n</tabber>"
             % (WT_PAGE, wdate(ev["startedAt"]), wdate(ev["endedAt"]), "\n|-|".join(f"{s}=\n{{{{:{WT_PAGE.replace(' ', '_')}/{s}}}}}" for s in SUBS)),
    "Halloween Event List": "A list of Halloween events. {{Navbox}}",
    "Fate/Summer Splash Carnival (US)": "{{EventHeaderNA\n|pagename=Fate/Summer Splash Carnival (US)\n|start=%s\n|name=Fate/Summer Splash Carnival\n|requirement=None\n}}\nSummer is here." % wdate(ev2["startedAt"]),
}
WI = "https://static.wikia.nocookie.net/fategrandorder/images"
LAZY = 'src="data:image/gif;base64,R0lGODlhAQABAIABAAAAAP" decoding="async" loading="lazy" class="mw-file-element lazyload"'
def wimg(name, w=25): return f'<img alt="{name.split(".")[0]}" {LAZY} width="{w}" height="{w}" data-image-name="{name}" data-src="{WI}/a/aa/{name}/revision/latest/scale-to-width-down/{w}?cb=1">'
def svt_icon(no, page): return f'<span class="servant_icon"><span typeof="mw:File"><a href="/wiki/{page}" title="{page.replace("_", " ")}">{wimg(f"S{no:03d}A1Icon.webp", 75)}</a></span></span>'
def inum(item_name, file, n): return (f'<span class="InumWrapper hidden"><span class="InumIcon hidden"><span><a href="/wiki/Other_Items/Miscellaneous" title="{item_name}">{wimg(file, 45)}</a></span></span><span class="InumNum hidden" style="">{n}</span>'
    f'<span class="InumIconTop hidden"><span><a href="/wiki/Other_Items/Miscellaneous" title="{item_name}">{wimg(file, 45)}</a></span></span></span><span class="InumMobileDisplay mobile-only"><span><a href="/wiki/Other_Items/Miscellaneous" title="{item_name}">{wimg(file, 45)}</a></span>{n}</span>')
def tooltip(inner, tip): return (f'<span class="text-tooltip hover-tooltip" title="{tip}">{inner}</span><span class="custom-tt-wrapper mobile-only toggle-tooltip mw-collapsible mw-made-collapsible mw-collapsed giw-collapsible">{inner}'
    f'<span class="mw-collapsible-toggle mw-collapsible-toggle-default mw-collapsible-toggle-collapsed custom-tt toggle-tooltip"><span class="screen-reader-text">Tooltip for 25px|link=</span>&#9432;</span><span class="mw-collapsible-content custom-tt" style="display:none">{tip}</span></span>')
def tabber(parts): return ('<div class="tabber wds-tabber"><div class="wds-tabs__wrapper with-bottom-border"><ul class="wds-tabs">' + "".join(f'<li class="wds-tabs__tab{" wds-is-current" if i == 0 else ""}"><div class="wds-tabs__tab-label"><a href="#">{h}</a></div></li>' for i, (h, _) in enumerate(parts))
    + "</ul></div>" + "".join(f'<div class="wds-tab__content{" wds-is-current" if i == 0 else ""}">{b}</div>' for i, (_, b) in enumerate(parts)) + "</div>")
CE_PAGE = EV_CE["name"].replace(" ", "_")
PAGES = {
    "Main Info": tabber([
        ("Event Summary", '<p class="mw-empty-elt"></p><p>Intro: <b>Halloween</b> is back.<script>window.__pwned = 1</script></p>'
            '<p style="color:red" onclick="window.__pwned=2">Clear the main quests, then farm <a href="/wiki/Candy">Candy</a> and <a href="javascript:window.__pwned=3">this</a>.</p>'
            f'<figure class="mw-halign-center"><a href="{WI}/a/aa/Pumpkin.png/revision/latest?cb=1" class="mw-file-description image"><img alt="Pumpkin" {LAZY} width="50" height="50" data-image-name="Pumpkin.png" data-src="{WI}/a/aa/Pumpkin.png/revision/latest/scale-to-width-down/50?cb=1" onerror="window.__pwned=4"></a><figcaption></figcaption></figure>'
            '<img src="https://evil.example.com/x.png" alt="outside picture"><iframe src="https://evil.example.com/"></iframe><form action="https://evil.example.com/"><input name="x"></form>'),
        ("Event Guide", '<h2><span class="mw-headline" id="Main_Quest_Release_Dates">Main Quest Release Dates</span></h2><table class="wikitable" style="width:100%; text-align:center;"><tbody><tr><th>Quests</th><th>Date</th></tr><tr><td>Prologue - Chapter 1</td><td>Day 1</td></tr></tbody></table>'),
        ("Misc Info", '<h2><span class="mw-headline" id="Login_Bonus">Login Bonus</span></h2><table class="wikitable"><tbody><tr><th>Login Day</th><td>1</td></tr><tr><th>Reward</th><td>' + inum("Golden Apple", "Golden fruit.png", 3) + '</td></tr></tbody></table>'
            '<p>Released for Halloween.<style>body{display:none}</style></p><span style="display:none;">A hidden page name</span>'),
        ("Game Updates", "<p>New interludes.</p>"),
        ("Event Servants", '<table class="wikitable" style="text-align:center; width:100%;"><tbody><tr><th colspan="2">Event Bonus Servants</th></tr><tr><td><b>+100%</b></td><td>'
            + svt_icon(ERESH["no"], "Ereshkigal") + " " + svt_icon(NEW_S["collectionNo"], "Test_Arrival_Lancer") + '</td></tr><tr><td colspan="2" onmouseover="window.__pwned=5">+100% Candy for <a href="/wiki/Ereshkigal" title="Ereshkigal">Ereshkigal</a>; her Noble Phantasm <a href="/wiki/' + ERESH_NP.replace(" ", "_") + '">' + ERESH_NP + '</a></td></tr></tbody></table>'),
        ("Event Cards", f'<table class="wikitable"><tbody><tr><td><span class="craft_essence_icon"><span><a href="/wiki/{CE_PAGE}" title="{EV_CE["name"]}">{wimg("CEIcon%d.webp" % EV_CE["collectionNo"], 60)}</a></span></span></td><td>Pumpkin Party: +1 Candy per drop</td></tr></tbody></table>'),
    ]),
    "Event Shop": tabber([("Pumpkin Lantern", "<p>The wiki's shop: items unlock in stages.</p>"), ("Candy Coin", "<p>Candy shop notes.</p>")]),
    "Mission List": tabber([("1~20", "<p>The wiki's mission list.</p>"), ("21~40", "<p>More missions.</p>")]),
    "Detective Missions": tabber([("E Rank", "<p>Easy cases.</p>"), ("D Rank", "<p>Harder cases.</p>")]),
    "Main Quests": '<h2><span class="mw-headline">Prologue</span></h2><table class="wikitable" style="text-align:center;width:100%;"><tbody><tr><th>'
        + tooltip("Completion<br>Reward", "Clear all arrows for the first time to receive this reward") + "</th><td>" + inum("Saint Quartz", "Saintquartz.png", 1) + "</td></tr></tbody></table>"
        + tabber([("Arrow 1", '<table class="wikitable"><tbody><tr><th>Available NPCS</th><td><div class="ServantSupport" style="display: inline-block;"><table><tbody><tr><td>' + svt_icon(ERESH["no"], "Ereshkigal")
                   + '</td><td><b>Level 90</b><b>, NP3</b><br><b>NP: <a href="/wiki/' + ERESH_NP.replace(" ", "_") + '" title="' + ERESH_NP + '">' + ERESH_NP + '</a></b><br><b>Skills: 8/8/8</b></td></tr></tbody></table></div></td></tr>'
                   + '<tr><th>Battle 1/1</th><td><a href="/wiki/Imperial_Nobbu" title="Imperial Nobbu">Kinnobu A</a> Lvl 40 25,976 HP</td></tr></tbody></table>'
                   + '<ul><li><b>Pumpkin Field</b>: the boss gains <span class="UnremovableStatusFrame">' + tooltip('<span><span>' + wimg("Busterupstatus.png") + "</span></span>", "This effect is unremovable.") + '</span> <b>Buster Up</b> <i>[Permanent, Unremovable]</i></li></ul>'),
                  ("Arrow 2", "<p>The second arrow.</p>")]),
    "Free Quests": tabber([("Novice", '<table class="wikitable"><tbody><tr><th>Enemies</th><td><a href="/wiki/Pumpkin_Ghost">Pumpkin Ghost</a> Lvl 30 9,000 HP</td></tr></tbody></table>'), ("Expert", "<p>Expert enemies.</p>")]),
    "Summoning Campaign": tabber([("Summoning Campaign I", "<p>Rate-up from the wiki: " + svt_icon(ERESH["no"], "Ereshkigal") + "</p>"), ("Summoning Campaign II", "<p>The second week.</p>")]),
}
PAGE_B = ('<div class="mw-parser-output"><p>Summer is here.</p><div class="mw-heading mw-heading2"><h2 id="Event_Summary">Event Summary</h2></div><p>Swim and farm shells.</p>'
          '<div class="mw-heading mw-heading2"><h2 id="Misc_Info">Misc Info</h2></div><p>Splash trivia.</p></div>')
wiki_mode = {"v": "ok"}
hold = {"titles": None, "routes": []}  # a wiki request held back, to open another event meanwhile
def wiki(r):
    qs = parse_qs(urlparse(r.request.url).query); act = qs.get("action", ["?"])[0]
    count("wiki:" + act + (":" + qs.get("prop", [""])[0] if act == "query" else ""))
    if wiki_mode["v"] == "down": return r.abort()
    if qs.get("origin") != ["*"]: return r.fulfill(status=403, body="no CORS")
    if act == "query" and qs.get("list") == ["search"]:
        s = qs.get("srsearch", [""])[0]
        if "Summer" in s: return jfulfill(r, {"query": {"search": [{"title": "Fate/Summer Splash Carnival (US)"}]}})
        return jfulfill(r, {"query": {"search": [{"title": "Talk:Test Halloween Rising"}, {"title": WT_PAGE + "/Main Info"}, {"title": "Halloween Event List"}, {"title": WT_PAGE}]}})
    if act == "query" and qs.get("prop") == ["revisions"]:
        titles = qs.get("titles", [""])[0].split("|")
        if hold["titles"] and any(hold["titles"] in t for t in titles): hold["routes"].append(r); return
        return jfulfill(r, {"query": {"pages": [{"title": t, "revisions": [{"slots": {"main": {"content": WIKITEXT[t]}}}]} if t in WIKITEXT else {"title": t, "missing": True} for t in titles]}})
    if act == "parse":
        page = qs.get("page", [""])[0]; count("parse:" + page.split("/")[-1])
        if page == "Fate/Summer Splash Carnival (US)": return jfulfill(r, {"parse": {"title": page, "text": PAGE_B}})
        sub = page.split("/", 1)[1] if page.startswith(WT_PAGE + "/") else None
        if sub in PAGES: return jfulfill(r, {"parse": {"title": page, "text": '<div class="mw-parser-output">' + PAGES[sub] + "</div>"}})
        return jfulfill(r, {"error": {"code": "missingtitle"}})
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
PANE = "#event .ev-pane"
num = lambda t: int(re.sub(r"[^\d]", "", t) or 0)
tab_names = lambda pg: [t.strip() for t in pg.locator("#event .ev-tab").all_inner_texts()]
def tab(pg, name):
    pg.locator("#event .ev-tab", has_text=re.compile("^" + re.escape(name) + "$")).click(); pg.wait_for_timeout(500)
def sub(pg, name, scope=PANE):
    pg.locator(f"{scope} .ewt-b", has_text=name).first.click(); pg.wait_for_timeout(200)
visible_text = lambda pg: pg.locator(PANE).inner_text()

with sync_playwright() as p:
    ctx, pg = page(p)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(500)
    r0 = {k: v for k, v in json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")).items() if k != "savedAt"}
    link = pg.locator('#home .hb-ev [data-action="ev-open"]', has_text="Test Halloween Rising").first
    check("Home's board: the event's card opens its page", link.count() == 1)
    link.click(); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_selector(f"{PANE} .ewt", timeout=20000); pg.wait_for_timeout(1200)
    check(f"the Event page has its own address ({pg.evaluate('location.hash')})", pg.evaluate("location.hash").startswith(f"#event/{EID}") and pg.locator("#view-event").is_visible() and pg.locator("#view-home").is_hidden())
    check("opening an event moves focus to its page", pg.evaluate("document.activeElement && document.activeElement.id") in ("event", "evt-main-info"))
    check("no tab of the site is selected, the tab bar still has eight (Story joined in 0.24.0)", pg.locator('.tabs .tab[aria-selected="true"]').count() == 0 and pg.locator(".tabs .tab").count() == 8)
    head = pg.locator(f"{EVP} .ev-head").inner_text()
    check("header: name, countdown, the event's banner and where the tabs come from", "Test Halloween Rising" in head and re.search(r"ends in \d+d \d+h", head) is not None and pg.locator(f"{EVP} .ev-bn").count() == 1 and WT_PAGE in head)
    names = tab_names(pg)
    check(f"the page has the wiki's tabs, plus the Calculator after the shop ({names})", names[:3] == ["Main Info", "Event Shop", "Calculator"] and names[3:] == ["Mission List", "Detective Missions", "Main Quests", "Free Quests", "Summoning Campaign", "Rewards"])
    check("the wiki page was found by its event header (not the Talk page, not a sub-page)", hits.get("wiki:query:revisions", 0) >= 1 and pg.locator("#event .ev-src a").first.inner_text().startswith(WT_PAGE))
    check("one part at a time: only Main Info shows", pg.locator(PANE).count() == 1 and pg.locator(f"{PANE} .ev-ph").inner_text().strip().lower() == "main info" and "Candy shop notes" not in pg.locator("#event").inner_text())

    # ---- Main Info: facts from Atlas Academy, the wiki's tabs inside
    mi = visible_text(pg)
    check("Main Info: dates, who can take part, the servant who joins, the currencies", "Clear Fuyuki" in mi and WELFARE["n"] in pg.locator(f"{PANE} .ev-facts").inner_html() and "Pumpkin Lantern" in mi and "Candy Coin" in mi)
    subs = pg.locator(f"{PANE} .ewt-bar").first.locator(".ewt-b").all_inner_texts()
    check(f"the wiki's own tabs become tabs here ({subs})", subs == ["Event Summary", "Event Guide", "Misc Info", "Game Updates", "Event Servants", "Event Cards"])
    check("only the first of them shows", "Clear the main quests" in mi and "New interludes." not in mi and "Main Quest Release Dates" not in mi)
    sub(pg, "Game Updates")
    check("pressing one shows it instead", "New interludes." in visible_text(pg) and "Clear the main quests" not in visible_text(pg))
    sub(pg, "Misc Info")
    mt = visible_text(pg)
    check(f"the wiki's phone-only copies and hidden parts are left out ({mt.count('3')} threes)", "×3" in mt and "A hidden page name" not in mt and pg.locator(f"{PANE} .ew-n").count() == 1)
    check("nothing from the wiki ran", pg.evaluate("window.__pwned") is None)
    html = pg.evaluate("document.getElementById('event').innerHTML")
    check("no script, style, frame, form or event handler from the wiki", not re.search(r"<script|<style|<iframe|<form|<input name=\"x\"|onclick|onerror|onmouseover|javascript:", html, re.I))
    check("pictures only from the wiki's own servers", "evil.example.com" not in html and "data:image/gif" not in html and hits.get("evil", 0) == 0)
    check("the wiki's style attributes are gone; a full-width table stays full width", "style=" not in pg.locator(f"{PANE} .ew").first.inner_html() and pg.locator(f"{PANE} table.ew-w").count() >= 1)
    sub(pg, "Event Servants")
    sv = pg.locator(f'{PANE} .ewt-p:not([hidden]) [data-action="pc-open"][data-no="{ERESH["no"]}"]')
    check(f"servant icons, names and Noble Phantasms open Past Chaldea ({sv.count()} for Ereshkigal)", sv.count() == 3 and pg.locator(f'{PANE} .ewt-p:not([hidden]) a[href*="fandom.com/wiki/Ereshkigal"]').count() == 0)
    check("a servant who's new on NA links to Atlas Academy instead", pg.locator(f'{PANE} .ewt-p:not([hidden]) a[href="https://apps.atlasacademy.io/db/NA/servant/{NEW_S["collectionNo"]}"]').count() == 1)
    sv.first.click(); pg.wait_for_timeout(600)
    dlg = pg.locator("#pc-dlg, .pcd")
    check("pressing Ereshkigal opens her Past Chaldea page over the Event page", pg.locator(".pcd-panel").count() == 1 and "Ereshkigal" in pg.locator(".pcd-panel").inner_text() and pg.locator("#view-event").is_visible())
    pg.locator('[data-action="pc-close"]').first.click(); pg.wait_for_timeout(400)
    check("closing it goes back to the same tab", pg.locator(".pcd-panel").count() == 0 and "+100% Candy" in visible_text(pg))
    sub(pg, "Event Cards")
    check("a Craft Essence opens in Past Chaldea too", pg.locator(f'{PANE} .ewt-p:not([hidden]) [data-action="ce-open"][data-no="{EV_CE["collectionNo"]}"]').count() == 1)
    sub(pg, "Event Summary")

    # ---- the tooltips and the quest pages
    tab(pg, "Main Quests"); pg.wait_for_selector(f"{PANE} .ewt", timeout=10000)
    qt = visible_text(pg)
    check(f"no tooltip leftovers like '25px|link' and no doubled text ({qt[:60]!r})", "25px" not in qt and "Tooltip for" not in qt and "ⓘ" not in qt and "RewardCompletion" not in qt.replace("\n", "") and qt.count("Clear all arrows") == 0)
    check("the tooltip's text is the hover text", pg.locator(f'{PANE} .ew-tip[title="Clear all arrows for the first time to receive this reward"]').count() == 1 and pg.locator(f'{PANE} .ew-tip[title="This effect is unremovable."]').count() == 1)
    check("a support's Noble Phantasm opens that servant", pg.locator(f'{PANE} .ewt-p:not([hidden]) .ew-in[data-no="{ERESH["no"]}"]', has_text=ERESH_NP).count() == 1)
    check(f"the address names the tab ({pg.evaluate('location.hash')})", pg.evaluate("location.hash") == f"#event/{EID}/main-quests")
    tab(pg, "Free Quests")
    ft = visible_text(pg)
    check(f"Free Quests: Atlas Academy's drops per run, then the wiki's quest details ({ft[:80]!r})", ("Pumpkin Lantern 13.50" in ft or "Pumpkin Lantern 14" in ft) and "Pumpkin Ghost" in ft and "Expert enemies." not in ft)

    # ---- the shop, from Atlas Academy, with the wiki's page folded away
    tab(pg, "Event Shop")
    st = visible_text(pg)
    cur = pg.locator(f"{PANE} .ewt-bar").first.locator(".ewt-b").all_inner_texts()
    check(f"the shop: one tab per currency ({cur})", [c.strip() for c in cur] == ["Pumpkin Lantern", "Candy Coin"])
    check("each with its items, prices, limits and the total", mat_name[M1] in st and "Everything" in st and "1,000" in st and "Candy shop notes" not in st)
    sub(pg, "Candy Coin")
    st = visible_text(pg)
    check("the other currency: a Craft Essence by name, a costume, the unlimited item", EV_CE["name"] in st and "Pumpkin Party Suit" in st and "1 unlimited item" in st)
    check("the wiki's shop page is folded away", pg.locator(f"{PANE} details.ev-wd").count() == 1 and pg.locator(f"{PANE} details.ev-wd[open]").count() == 0)
    pg.locator(f"{PANE} details.ev-wd > summary").click(); pg.wait_for_timeout(600)
    check("and opens on request", "items unlock in stages" in visible_text(pg))

    # ---- the calculator
    tab(pg, "Calculator")
    calc = pg.locator(f'{PANE} .ev-calc[data-cur="{CUR}"]')
    rows = calc.locator("tbody tr")
    check(f"calculator: the shop's materials your servants need ({rows.count()})", rows.count() >= 1 and mat_name[M1] in calc.inner_text())
    r1 = calc.locator("tbody tr", has_text=mat_name[M1])
    need1 = num(r1.locator("td").nth(1).inner_text())
    who = r1.locator("td").nth(1).get_attribute("title") or ""
    check(f"need counts your roster, Ereshkigal among them ({need1}; {who[:80]})", need1 > 0 and "Ereshkigal" in who)
    buy1 = min(5, need1)
    check(f"buy and cost: min(limit, what's needed) × 100 ({r1.locator('td').nth(3).inner_text()}, {r1.locator('td').nth(4).inner_text()})",
          num(r1.locator("td").nth(3).inner_text()) == buy1 and num(r1.locator("td").nth(4).inner_text()) == buy1 * 100)
    sub(pg, "Candy Coin")
    c2 = pg.locator(f'{PANE} .ev-calc[data-cur="{CUR2}"] tbody tr', has_text=mat_name[M1])
    check(f"the same material sold for the other currency only covers what's still left ({c2.count()} row)", c2.count() == 1 and num(c2.locator("td").nth(3).inner_text()) == max(0, need1 - buy1))
    sub(pg, "Pumpkin Lantern")
    r1 = calc.locator("tbody tr", has_text=mat_name[M1])
    r1.locator("input").fill(str(max(0, need1 - 1))); pg.wait_for_timeout(700)
    r1 = calc.locator("tbody tr", has_text=mat_name[M1])
    check("what you have lowers what to buy", num(r1.locator("td").nth(3).inner_text()) == 1 and num(r1.locator("td").nth(4).inner_text()) == 100)
    check("the field keeps focus while you type", pg.evaluate("document.activeElement && document.activeElement.dataset.evHave") == str(M1))
    check("the currency tab you were on stays open after the numbers change", calc.is_visible())
    tot = calc.locator(".ev-tot").inner_text()
    mine = sum(num(calc.locator("tbody tr").nth(i).locator("td").nth(4).inner_text()) for i in range(calc.locator("tbody tr").count()))
    check(f"totals: for your servants and the whole shop ({tot!r})", f"{mine:,}" in tot and "1,000" in tot)
    run = calc.locator(".ev-run").inner_text()
    check(f"best quest for the currency: the one with the most per AP ({run!r})", "Candy Hunt - Novice" in run and "9.0 a run" in run)
    calc.locator("[data-ev-bonus]").fill("2"); pg.wait_for_timeout(700)
    run2 = pg.locator(f'{PANE} .ev-calc[data-cur="{CUR}"] .ev-run').inner_text()
    check(f"a bonus per drop raises it: (3+2)×3 = 15 a run ({run2!r})", "15.0 a run" in run2 and (f"About {math.ceil(mine / 15):,} runs" in run2 if mine else True))
    saved = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:event')"))
    check("the calculator's numbers are kept in this browser", saved.get("have", {}).get(str(M1)) == max(0, need1 - 1) and saved.get("bonus", {}).get(str(CUR)) == 2)
    pg.select_option(f"{PANE} [data-ev-to]", "9"); pg.wait_for_timeout(500)
    r9 = pg.locator(f'{PANE} .ev-calc[data-cur="{CUR}"] tbody tr', has_text=mat_name[M1])
    check("skills up to Lv 9 needs no more than up to Lv 10", r9.count() == 0 or num(r9.locator("td").nth(1).inner_text()) <= need1)
    pg.select_option(f"{PANE} [data-ev-to]", "10"); pg.wait_for_timeout(400)

    # ---- missions
    tab(pg, "Mission List")
    mt = visible_text(pg)
    ch = pg.locator(f"{PANE} .ewt-bar").first.locator(".ewt-b").all_inner_texts()
    check(f"missions from Atlas Academy, twenty to a tab ({ch})", ch == ["1–20", "21–22"] and "Clear 5 quests in the event" in mt and "Filler mission 21" not in mt)
    check("missions with their rewards; an ember's name comes from the list of everything", "Defeat 10 Saber-class enemies" in mt and "Test Gold Ember" in mt and "Saint Quartz" in mt)
    check("random missions aren't mixed into the mission list", "Find the missing pumpkin head" not in mt)
    tab(pg, "Detective Missions")
    dt = visible_text(pg)
    check(f"the random missions, by rank ({dt[:90]!r})", "Rank 1" in dt and "Rank 2" in dt and "Find the missing pumpkin head" in dt and "Question three witnesses" not in dt)

    # ---- the banner, then Simulate
    tab(pg, "Summoning Campaign")
    sm = pg.locator(PANE)
    check("summoning campaign: the event's banner, its rate-up schedule and featured, then the wiki's tabs", "Test Halloween Rising Pickup Summon" in sm.inner_text() and "Rate-up schedule" in sm.inner_text() and sm.locator(".ev-bans .lv-face").count() == 3 and "Rate-up from the wiki" in sm.inner_text())
    check("your roster wasn't touched by the Event page", {k: v for k, v in json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')")).items() if k != "savedAt"} == r0)
    tab(pg, "Rewards")
    check("point rewards and the lottery", "500,000" in visible_text(pg) and "Box 1" in visible_text(pg) and "Box 2" in visible_text(pg))
    tab(pg, "Summoning Campaign")
    sm.locator('[data-action="ev-sim"]').click(); pg.wait_for_timeout(1200)
    check("Simulate opens the Summoning page with the NA banner", pg.locator("#view-summon").is_visible() and pg.evaluate("location.hash") == "#summon" and "Test Halloween Rising Pickup Summon" in pg.locator(".sm-ban").inner_text())
    ban = pg.locator(".sm-ban").inner_text()
    check(f"two featured ★5 servants share 0.8%, the Craft Essence gets its own rate, no guarantee", "0.40% each summon each" in ban and "guarantee isn't simulated" in ban)
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
    check(f"Back returns to the Event page, on the tab you left ({pg.evaluate('location.hash')})", pg.evaluate("location.hash").startswith(f"#event/{EID}") and pg.locator("#view-event").is_visible() and pg.locator('#event .ev-tab[aria-selected="true"]').inner_text().strip() == "Summoning Campaign")
    pg.go_back(); pg.wait_for_timeout(1000)
    check("and Back again to Home (switching tabs adds no Back steps)", pg.locator("#view-home").is_visible() and pg.locator("#view-event").is_hidden())
    pg.click("#tab-summon"); pg.wait_for_timeout(600)
    pg.click('[data-action="sm-ban-off"]'); pg.wait_for_timeout(600)
    smst = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')"))
    check("Back to your own banner leaves the NA one", "ban" not in smst and pg.locator(".sm-ban").count() == 0)

    # ---- the guarantee for a featured ★5 who isn't on your list
    pg.click("#tab-home"); pg.wait_for_timeout(600)
    pg.locator("#home .hb-camp", has_text="Fes. 2026").locator('[data-action="ev-sim"]').click(); pg.wait_for_timeout(900)
    st = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')")); st["n"] = 325; st["got"] = 0
    pg.evaluate("(v) => localStorage.setItem('spirit-origin-list:v1:summon', v)", json.dumps(st))
    pg.reload(); pg.wait_for_selector(".sm-ban", timeout=20000); pg.wait_for_timeout(500)
    check("one featured ★5: the guarantee is on", "guarantee is on" in pg.locator(".sm-ban").inner_text())
    pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(1500)
    up = pg.locator("#sm-results .smr", has_text=PC5["n"])
    check(f"by summon 330 the featured ★5 came, by name, not as an unknown servant ({PC5['n']})", up.count() >= 1 and pg.locator("#sm-results .smr.anon.r5").count() == 0)
    check("their card says rate-up or guaranteed, not Past Chaldea", up.first.locator(".smr-tag.pity, .smr-tag.up").count() == 1 and up.first.locator(".smr-tag.pc").count() == 0)
    smst = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')"))
    check(f"the banner counts them as got ({smst.get('got')})", 326 <= smst.get("got", 0) <= 330 and not any(str(l.get("id", "")).startswith("na:") for l in smst.get("log", [])))
    pg.click('[data-action="sm-ban-off"]'); pg.wait_for_timeout(500)

    # ---- straight to an event's tab, from what's kept in this browser
    n_ev, n_parse = hits.get(f"/nice/NA/event/{EID}", 0), sum(v for k, v in hits.items() if k.startswith("parse:"))
    pg.goto(SEEDED + f"#event/{EID}/event-shop"); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(1000)
    check(f"an address with a tab opens that tab ({tab_names(pg)[:2]})", pg.locator('#event .ev-tab[aria-selected="true"]').inner_text().strip() == "Event Shop" and "Everything" in visible_text(pg))
    check(f"from this browser's copy: no new downloads from Atlas Academy or the wiki ({n_parse} wiki pages)", hits.get(f"/nice/NA/event/{EID}", 0) == n_ev and sum(v for k, v in hits.items() if k.startswith("parse:")) == n_parse and n_parse >= len(SUBS))
    check("opened directly, the banners are there too", pg.locator('[data-action="ev-tab"][data-k="summoning-campaign"]').count() == 1)
    tab(pg, "Summoning Campaign")
    check("… with Simulate", pg.locator(f'{PANE} [data-action="ev-sim"]').count() == 1)
    pg.locator("#event .ev-tab", has_text="Summoning Campaign").focus(); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(400)
    check("arrow keys move between the tabs", pg.locator('#event .ev-tab[aria-selected="true"]').inner_text().strip() == "Rewards" and pg.evaluate("document.activeElement.id") == "evt-rewards")
    ctx.close()

    # ================= the wiki can't be reached =================
    wiki_mode["v"] = "down"
    ctx, pg = page(p)
    pg.goto(SEEDED + f"#event/{EID}"); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(2000)
    src = pg.locator(f"{EVP} .ev-src").inner_text()
    names = tab_names(pg)
    check(f"without the wiki, it says so and the tabs come from Atlas Academy ({names})", "Couldn't reach the Fate/Grand Order wiki" in src and names == ["Main Info", "Event Shop", "Calculator", "Mission List", "Random Missions", "Quests", "Summoning", "Rewards"])
    tab(pg, "Quests")
    qs = pg.locator(f"{PANE} .ewt-bar").first.locator(".ewt-b").all_inner_texts()
    check(f"quests grouped as tabs: main, free, extra, challenge; the branch copy of a chapter left out ({qs})", [re.sub(r"\s+", " ", x).strip() for x in qs] == ["Main 1", "Free 2", "Extra 1", "Challenge 1"])
    check("a first visit straight to an event's address gets the banners too", pg.locator('[data-action="ev-tab"][data-k="summon"]').count() == 1)
    wiki_mode["v"] = "ok"
    ctx.close()

    # ================= two events, one after the other =================
    ctx, pg = page(p)
    hold["titles"] = WT_PAGE
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(500)
    pg.locator('#home .hb-ev [data-action="ev-open"]', has_text="Test Halloween Rising").first.click(); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000)
    for _ in range(40):
        if hold["routes"]: break
        pg.wait_for_timeout(250)
    pg.click(f"{EVP} .ev-back"); pg.wait_for_timeout(400)
    pg.locator('#home .hb-ev [data-action="ev-open"]', has_text="Summer Splash").first.click()
    pg.wait_for_selector(f"{EVP} .ev-title:has-text('Summer Splash')", timeout=20000); pg.wait_for_timeout(800)
    held = len(hold["routes"]); hold["titles"] = None
    for rr in hold["routes"]: jfulfill(rr, {"query": {"pages": [{"title": WT_PAGE, "revisions": [{"slots": {"main": {"content": WIKITEXT[WT_PAGE]}}}]}]}})
    hold["routes"].clear(); pg.wait_for_timeout(2500)
    names = tab_names(pg)
    check(f"the first event's wiki doesn't land on the second one ({held} held; {names})", held == 1 and "Event Shop" not in names and names == ["Main Info", "Event Summary", "Misc Info", "Summoning"])
    check("a wiki page without tabs is split at its headings (newer heading markup too)", "Summer is here." in visible_text(pg) and "Swim and farm shells." not in visible_text(pg))
    tab(pg, "Misc Info")
    check("… each heading its own tab", "Splash trivia." in visible_text(pg))
    tab(pg, "Main Info")
    check("'None' as the requirement reads as open to everyone", "Open to everyone" in visible_text(pg))
    tab(pg, "Summoning")
    check("a banner that only shares 'Fate/Grand Order' with the event isn't taken for its own", "None of these is named after the event" in visible_text(pg))
    ctx.close()

    # ================= live updates off =================
    ctx, pg = page(p, init=INIT.replace("{on: true}", "{on: false}"))
    pg.goto(SEEDED + f"#event/{EID}/summoning-campaign"); pg.wait_for_selector(f"{EVP} .ev-title", timeout=20000); pg.wait_for_timeout(1500)
    so = pg.locator(PANE)
    check("live updates off: the Summoning tab says why there are no banners and offers to turn them on", "Live NA updates are off" in so.inner_text() and so.locator('[data-action="live-on"]').count() == 1)
    so.locator('[data-action="live-on"]').click()
    try: pg.wait_for_selector(f'{PANE} [data-action="ev-sim"]', timeout=15000); on = True
    except Exception: on = False
    check("turned on from there, the banners arrive", on)
    ctx.close()

    # ================= phone =================
    ctx, pg = page(p, w=390, h=860, mobile=True)
    pg.goto(SEEDED + f"#event/{EID}"); pg.wait_for_selector(f"{PANE} .ewt", timeout=20000); pg.wait_for_timeout(1500)
    sw = [pg.evaluate("document.documentElement.scrollWidth")]
    for name in ("Main Quests", "Calculator", "Event Shop"):
        pg.evaluate(f"document.querySelector('#event .ev-tab[data-k=\"{ {'Main Quests': 'main-quests', 'Calculator': 'calc', 'Event Shop': 'event-shop'}[name] }\"]').click()"); pg.wait_for_timeout(600)
        sw.append(pg.evaluate("document.documentElement.scrollWidth"))
    check(f"phone: every tab fits the screen ({sw})", max(sw) <= 390)
    tl = pg.evaluate("(() => { const t = document.querySelector('#event .ev-tl'); return [t.scrollWidth, t.clientWidth]; })()")
    check(f"phone: the tab bar scrolls sideways on its own ({tl})", tl[0] > tl[1])
    pg.evaluate("document.querySelector('#event .ev-tab[data-k=\"main-quests\"]').click()"); pg.wait_for_timeout(600)
    stuck = pg.evaluate("(() => { const p = document.getElementById('ev-pane'); window.scrollTo(0, p.getBoundingClientRect().top + scrollY + Math.min(400, p.offsetHeight / 2)); return [document.querySelector('#event .ev-tabs').getBoundingClientRect().top, p.offsetHeight]; })()")
    check(f"the tab bar stays at the top while you scroll through a long tab ({stuck})", abs(stuck[0]) < 2 and stuck[1] > 400)
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
