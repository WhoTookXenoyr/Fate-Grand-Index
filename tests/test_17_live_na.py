import os
# 0.21.0: "On NA now" on Home — events, campaigns, login bonuses, summon banners and the newest servants and Craft
# Essences, from Atlas Academy. Since 0.24.0 the events and summon banners are on Home's event board above it (checked
# here as they come from the same data), and On NA now keeps the login bonuses, campaigns and newest releases. Atlas Academy is replaced by a stand-in that serves files shaped like the real ones
# (same names and fields), with dates set around the moment the test runs.
import sys, tempfile, json, re, time
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
LIVE_ON = "localStorage.setItem('spirit-origin-list:v1:live', JSON.stringify({on: true}));"

# ---------- the stand-in's files ----------
AD = open(f"{sp}/atlas_data.js").read()
ATL = json.loads(re.search(r"const ATLAS_S = (\[.*?\]);\n", AD, re.S).group(1))
ATC = json.loads(re.search(r"const ATLAS_C = (\[.*?\]);\n", AD, re.S).group(1))
IMG = "https://static.atlasacademy.io/NA/"
camel = lambda c: {"Moon Cancer": "moonCancer", "Alter Ego": "alterEgo"}.get(c, c[:1].lower() + c[1:])
top = max(x["no"] for x in ATL)
atlas_name = lambda n: re.sub(r" \((Male|Female)\)$", "", n)  # how Atlas Academy names them
svts = [{"id": x["id"], "collectionNo": x["no"], "name": atlas_name(x["n"]), "originalName": x["n"], "type": "heroine" if x["no"] == 1 else "normal", "flag": "normal",
         "className": camel(x["c"]), "rarity": x["r"], "atkMax": 10000, "hpMax": 12000, "face": IMG + x["f"]} for x in ATL]
NEW_S = [{"id": 9990100, "collectionNo": top + 1, "name": "Test Arrival Lancer", "originalName": "Test Arrival Lancer", "type": "normal", "flag": "normal", "className": "lancer", "rarity": 5, "atkMax": 12000, "hpMax": 14000, "face": IMG + "Faces/f_9990100.png"},
         {"id": 9990200, "collectionNo": top + 2, "name": "Test Arrival Beast", "originalName": "Test Arrival Beast", "type": "normal", "flag": "normal", "className": "beastII", "rarity": 4, "atkMax": 9000, "hpMax": 11000, "face": IMG + "Faces/f_9990200.png"},
         {"id": 9990300, "collectionNo": 0, "name": "Enemy-only Shadow", "originalName": "x", "type": "enemy", "flag": "normal", "className": "saber", "rarity": 0, "atkMax": 1, "hpMax": 1, "face": ""}]
ces = [{"id": 9400000 + c["no"], "collectionNo": c["no"], "name": c["n"], "originalName": c["n"], "type": "servantEquip", "flag": "normal", "rarity": c["r"],
        "atkMax": (c.get("atk") or [0, 0])[-1], "hpMax": (c.get("hp") or [0, 0])[-1], "face": IMG + c["fc"]} for c in ATC if c.get("fc")]
ctop = max(c["no"] for c in ATC if c["no"] < 100000)
NEW_C = {"id": 9999001, "collectionNo": ctop + 1, "name": "Test Fresh Memory", "originalName": "Test Fresh Memory", "type": "servantEquip", "flag": "normal", "rarity": 5, "atkMax": 2000, "hpMax": 0, "face": IMG + "Faces/f_99990010.png"}
NOW = int(time.time()); D = 86400
ev = lambda i, t, n, s, e, a=None: {"id": i, "type": t, "name": n, "noticeAt": a if a is not None else s, "startedAt": s, "endedAt": e, "finishedAt": e, "materialOpenedAt": e + 30 * D, "warIds": []}
EVENTS = [
    ev(1, "eventQuest", "Test Halloween Rising", NOW - 3 * D, NOW + 2 * D + 3 * 3600),
    ev(2, "combineCampaign", "Super & Great Success Rate x2!", NOW - D, NOW + 9 * D),
    ev(3, "questCampaign", "Daily Quests AP Cost 1/2", NOW - D, NOW + 5 * D),
    ev(4, "questCampaign", "Daily Quests AP Cost 1/2", NOW - D, NOW + 5 * D),          # the same campaign on another quest: shown once
    ev(5, "loginBonus", "Test Halloween Login Bonus", NOW - 2 * D, NOW + 6 * 3600),       # ends within a day
    ev(6, "eventQuest", "Test Summer Gone By", NOW - 20 * D, NOW - 3 * D),               # over
    ev(7, "combineCampaign", "Permanent Grail Front Something", NOW - 900 * D, NOW + 900 * D),  # lasts years: a permanent feature
    ev(8, "shop", "Test Halloween Rising Shop", NOW - 3 * D, NOW + 2 * D),               # the event's shop: not listed on its own
    ev(9, "eventQuest", "Test Christmas Preview", NOW + 4 * D, NOW + 18 * D, NOW - 3600),  # announced, starts later
    ev(10, "eventQuest", "Test Unannounced Event", NOW + 20 * D, NOW + 30 * D, NOW + 10 * D),  # not announced yet: hidden
    ev(12, "questCampaign", "[FFFF00]Special Release Conditions![-]", NOW - 3 * D, NOW + 2 * D + 3 * 3600),  # game colour tags; same dates as the event
]
g = lambda i, t, n, s, e, ft: {"id": i, "name": n, "imageId": i, "type": t, "adjustId": 0, "pickupId": 0, "drawNum1": 1, "drawNum2": 10, "freeDrawFlag": 0, "maxDrawNum": 0,
                                "openedAt": s, "closedAt": e, "detailUrl": "", "flags": [], "storyAdjusts": [], "gachaSubs": [], "featuredSvtIds": ft, "releaseConditions": []}
ERESH = next(x for x in ATL if x["n"] == "Ereshkigal")
GACHAS = [
    g(101, "payGacha", "Test Halloween Pickup Summon", NOW - 2 * D, NOW + 8 * D, [ERESH["id"], 9990100]),
    g(102, "payGacha", "Test Halloween Pickup Summon", NOW - 2 * D, NOW + 8 * D, [9999001]),   # same banner, second entry: merged
    g(103, "friendPoint", "Limited Time Test FP Pickup", NOW - D, NOW + 3 * D, [9990200]),
    g(106, "ticketGacha", "Test Ticket Summon", NOW - D, NOW + 12 * D, []),                    # a kind the page doesn't name
    g(104, "payGacha", "Test Old Banner", NOW - 30 * D, NOW - 9 * D, [ERESH["id"]]),           # closed
    g(105, "payGacha", "【paid】After completing Part 1 Chapter 0", NOW - 3000 * D, NOW + 3000 * D, []),  # the story summon
]
FILES = {"basic_servant.json": svts + NEW_S, "basic_equip.json": ces + [NEW_C], "basic_event.json": EVENTS, "nice_gacha.json": GACHAS}
info = {"hash": "abc123", "timestamp": NOW - 3600, "serverHash": "x", "serverTimestamp": NOW - 7200, "dataVer": 899, "dateVer": NOW - 7200}
hits, down = {}, {"on": False}
def api(r):
    name = r.request.url.rsplit("/", 1)[-1].split("?")[0]
    hits[name] = hits.get(name, 0) + 1
    if down["on"]: return r.abort()
    body = info if name == "info.json" else FILES.get(name)
    if body is None: return r.fulfill(status=404, body="not found", headers={"Access-Control-Allow-Origin": "*"})
    r.fulfill(status=200, body=json.dumps(body), headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"})
def pic(r):
    r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png")
def page(p, init=INIT, w=1500, h=1000, mobile=False, ctx=None):
    ctx = ctx or p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(init)
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://api.atlasacademy.io/**", api); pg.route("https://static.atlasacademy.io/**", pic)
    pg.route("https://fategrandorder.fandom.com/**", lambda r: r.abort()); pg.route("https://itunes.apple.com/**", lambda r: r.abort())
    return ctx, pg
LIVE = "#home .hm-b-live"
# a row by its own title (event titles are buttons inside the <b> since 0.22.0)
row = lambda pg, name, cls="lv-ev": pg.locator(f"{LIVE} .{cls}").filter(has=pg.locator(f'xpath=./b[normalize-space(.)="{name}"]'))
lists = lambda: sum(hits.get(n, 0) for n in FILES)
# the roster without its save time (the page saves on its own at start, e.g. HP and ATK following the level)
roster = lambda pg: {k: v for k, v in json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") or "{}").items() if k != "savedAt"}
# Home's event board: its cards, and its summoning campaigns
board = lambda pg: pg.evaluate("[...document.querySelectorAll('#home .hb-ev .hb-n')].map(e => e.textContent)")
card = lambda pg, name: pg.locator("#home .hb-ev").filter(has=pg.locator(f'xpath=.//b[contains(@class, "hb-n") and normalize-space(.)="{name}"]'))
camp = lambda pg, name: pg.locator("#home .hb-camp").filter(has=pg.locator(f'xpath=./span/b[normalize-space(.)="{name}"]'))
names = lambda pg, h4: pg.evaluate("""(h) => { const t = [...document.querySelectorAll('.hm-b-live h4')].find(x => x.firstChild.textContent.trim() === h); if (!t) return null;
  const ul = t.nextElementSibling; return ul && ul.matches('ul') ? [...ul.querySelectorAll('li > b')].map(b => b.textContent) : []; }""", h4)

with sync_playwright() as p:
    # ================= off until turned on (in the test copies), and then it fills in =================
    ctx, pg = page(p)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector(LIVE, timeout=20000); pg.wait_for_timeout(2500)
    r0 = roster(pg)
    check("Home has the On NA now block, switched off in this copy, and nothing was asked of Atlas Academy",
          pg.locator(LIVE + ".off").count() == 1 and pg.locator(LIVE + ' [data-action="live-on"]').count() == 1 and not hits)
    check("the block sits first in the Home grid, full width", pg.evaluate("document.querySelector('#home .hm-grid').firstElementChild.classList.contains('hm-b-live')"))
    pg.click(LIVE + ' [data-action="live-on"]'); pg.wait_for_selector(LIVE + " .lv-cols", timeout=20000); pg.wait_for_timeout(300)
    check(f"turning it on fetches info.json and the four lists once ({hits})", hits.get("info.json") == 1 and all(hits.get(n) == 1 for n in FILES))
    check("saved as on", json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:live')")).get("on") is True)
    pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(300)
    evs = board(pg); camps = names(pg, "Campaigns"); logins = names(pg, "Login bonuses")
    bans = pg.evaluate("[...document.querySelectorAll('#home .hb-camp .hb-cm > b')].map(e => e.textContent)")
    check(f"On NA now no longer lists the events and summon banners: they're on the board above ({names(pg, 'Events')}, {names(pg, 'Summon banners')})", names(pg, "Events") is None and names(pg, "Summon banners") is None)
    check(f"Events on the board: the running one first, the announced one after, the one not announced yet left out ({evs})", evs == ["Test Halloween Rising", "Test Christmas Preview"])
    check(f"Campaigns: game colour tags removed, duplicates shown once, permanent ones left out ({camps})", camps == ["Special Release Conditions!", "Daily Quests AP Cost 1/2", "Super & Great Success Rate x2!"])
    srow = row(pg, "Special Release Conditions!", "lv-ev")
    check(f"a campaign on an event's dates says which event it belongs to ({srow.locator('small').all_inner_texts()})", srow.locator("small").inner_text() == "with Test Halloween Rising")
    check("one that matches no event doesn't", row(pg, "Daily Quests AP Cost 1/2", "lv-ev").locator("small").count() == 0)
    check(f"Login bonuses ({logins})", logins == ["Test Halloween Login Bonus"])
    check(f"Summoning campaigns on the board: Friend Points, closed and story summons left out ({bans})", bans == ["Test Halloween Pickup Summon", "Test Ticket Summon"])
    kh = [pg.locator(LIVE + f' .lv-rel [data-action="pc-open"][data-no="{x["no"]}"]').get_attribute("aria-label") or "" for x in ATL if x["n"].startswith("Kishinami Hakuno")]
    check(f"servants this file has use its names, so the two Kishinami Hakunos differ ({[k.split(',')[0] for k in kh]})", len(kh) == 2 and kh[0].split(",")[0] != kh[1].split(",")[0] and all("(Male)" in k or "(Female)" in k for k in kh))
    t1 = card(pg, "Test Halloween Rising").locator(".hb-left").inner_text()
    check(f"a running event counts down to its end ({t1!r})", re.fullmatch(r"ends in 2d [23]h", t1) is not None)
    t2 = card(pg, "Test Christmas Preview").locator(".hb-left").inner_text()
    check(f"an announced one shows when it starts ({t2!r})", t2.startswith("starts in ") and pg.locator("#home .hb-ev.up").filter(has_text="Test Christmas Preview").count() == 1)
    check("one ending within a day stands out", row(pg, "Test Halloween Login Bonus", "lv-ev.soon").count() == 1)
    ban = camp(pg, "Test Halloween Pickup Summon")
    check(f"the banner shows its featured servants and Craft Essence, merged from both entries ({ban.locator('.lv-face').count()})", ban.locator(".lv-face").count() == 3)
    newest = pg.locator(LIVE + " .lv-rel .lv-grid").first.locator(".lv-face")
    first = newest.first
    check(f"Newest servants: newest first, the enemy-only one left out ({newest.count()})", newest.count() == 8 and "Test Arrival Beast" in first.inner_text())
    href = first.get_attribute("href")
    check(f"a servant this file doesn't have yet is marked NEW and opens on Atlas Academy ({href})",
          first.locator(".lv-new").count() == 1 and href == f"https://apps.atlasacademy.io/db/NA/servant/{top + 2}" and first.get_attribute("target") == "_blank")
    check("its class reads like the rest of the page (beastII → Beast)", "Beast" in (first.get_attribute("aria-label") or ""))
    nce = pg.locator(LIVE + " .lv-rel .lv-grid").nth(1).locator(".lv-face").first
    check("Newest Craft Essences: the new one first, NEW, linking to Atlas Academy", "Test Fresh Memory" in nce.inner_text() and (nce.get_attribute("href") or "").endswith(f"/craft-essence/{ctop + 1}"))
    check("the anniversary Craft Essences (numbers in the 400,000s) don't crowd the newest list", not pg.locator(LIVE + " .lv-rel", has_text="Anniversary Celebration").count())
    ban.locator(f'[data-action="pc-open"][data-no="{ERESH["no"]}"]').click(); pg.wait_for_timeout(600)
    check("a featured servant this file has opens in Past Chaldea", pg.locator("#pc-dlg").is_visible() and "Ereshkigal" in pg.locator("#pc-dlg").inner_text())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("your roster wasn't touched", roster(pg) == r0)

    # ---- cached: a reload within a few hours doesn't ask again, and still shows everything
    n_info, n_lists = hits.get("info.json", 0), lists()
    pg.reload(); pg.wait_for_timeout(1500)
    pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(300)
    check("after a reload it shows the same, without asking Atlas Academy again", board(pg) == evs and hits.get("info.json") == n_info and lists() == n_lists)
    # ---- Check now: asks for info.json; the lists only come again when NA's data changed
    pg.click(LIVE + ' [data-action="live-check"]'); pg.wait_for_timeout(1200)
    check(f"Check now with nothing new on NA only asks for info.json ({hits})", hits.get("info.json") == n_info + 1 and lists() == n_lists)
    info["hash"] = "def456"; info["timestamp"] = NOW
    EVENTS.append(ev(11, "eventQuest", "Test Surprise Event", NOW - 3600, NOW + 7 * D))
    pg.click(LIVE + ' [data-action="live-check"]'); pg.wait_for_timeout(1500)
    check(f"when NA's data changed, the lists come again and the new event shows ({board(pg)})", lists() == n_lists + 4 and "Test Surprise Event" in board(pg))
    # ---- Show all
    for i in range(6): EVENTS.append(ev(20 + i, "combineCampaign", f"Test Extra Campaign {i}", NOW - D, NOW + (10 + i) * D))
    info["timestamp"] = NOW + 1
    pg.click(LIVE + ' [data-action="live-check"]'); pg.wait_for_timeout(1500)
    camps = names(pg, "Campaigns")
    more = pg.locator(LIVE + ' [data-action="live-more"][data-k="camp"]')
    check(f"long lists show five with a Show all button ({len(camps)})", len(camps) == 5 and more.inner_text() == "Show all 9")
    more.click(); pg.wait_for_timeout(300)
    check("Show all shows them all", len(names(pg, "Campaigns")) == 9 and pg.locator(LIVE + ' [data-action="live-more"][data-k="camp"]').inner_text() == "Show fewer")
    # ---- can't reach Atlas Academy: keeps showing what it had
    down["on"] = True
    pg.click(LIVE + ' [data-action="live-check"]'); pg.wait_for_timeout(1500)
    check("when Atlas Academy can't be reached, it says so and keeps what it had", "Couldn't reach Atlas Academy" in pg.locator(LIVE).inner_text() and "Test Halloween Rising" in board(pg))
    down["on"] = False
    # ---- turning it off
    pg.click(LIVE + ' [data-action="live-off"]'); pg.wait_for_timeout(500)
    before = dict(hits); pg.reload(); pg.wait_for_timeout(1500)
    check("turned off: the block says so, stays off after a reload, and nothing is fetched", pg.locator(LIVE + ".off").count() == 1 and hits == before
          and json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:live')")).get("on") is False)
    check("and the roster still wasn't touched", roster(pg) == r0)
    ctx.close()

    # ================= a first visit that can't reach Atlas Academy =================
    down["on"] = True
    ctx, pg = page(p, INIT + LIVE_ON)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1800)
    check("no data and no connection: a plain message, no errors", "Couldn't reach Atlas Academy" in pg.locator(LIVE).inner_text() and pg.locator(LIVE + " .lv-cols").count() == 0)
    down["on"] = False
    ctx.close()

    # ================= phone =================
    ctx, pg = page(p, INIT + LIVE_ON, w=390, h=860, mobile=True)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector(LIVE + " .lv-cols", timeout=20000); pg.wait_for_timeout(400)
    bb = pg.locator(LIVE).bounding_box()
    check(f"phone: the block fits the screen, one column ({bb and round(bb['width'])})", bb and bb["x"] >= 0 and bb["x"] + bb["width"] <= 390 and pg.evaluate("document.documentElement.scrollWidth") <= 390
          and pg.evaluate("getComputedStyle(document.querySelector('.lv-cols')).gridTemplateColumns.split(' ').length") == 1)
    ctx.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
