import os
# 0.24.0: Home's event board and sidebar. With live updates on: the wiki's current and upcoming NA events as banner
# cards (dates, countdown, requirement, new servants), matched to NA's events from Atlas Academy so they open the
# Event page; summoning campaigns now and coming, marked as an event's campaign or another kind (an upcoming event's
# pickups from the wiki when NA's data has no banner yet); and a sidebar with the server times, the game's version
# (App Store) and the wiki's Latest Updates. With live updates off only the clocks run and nothing is asked for.
# Atlas Academy, the wiki and the App Store are stood in for.
import sys, tempfile, json, re, time
from urllib.parse import urlparse, parse_qs
from datetime import datetime, timezone, timedelta
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
LIVE_ON = "localStorage.setItem('spirit-origin-list:v1:live', JSON.stringify({on: true}));"
AD = open(f"{sp}/atlas_data.js").read()
ATL = json.loads(re.search(r"const ATLAS_S = (\[.*?\]);\n", AD, re.S).group(1))
IMG = "https://static.atlasacademy.io/NA/"
camel = lambda c: {"Moon Cancer": "moonCancer", "Alter Ego": "alterEgo"}.get(c, c[:1].lower() + c[1:])
svts = [{"id": x["id"], "collectionNo": x["no"], "name": x["n"], "type": "normal", "className": camel(x["c"]), "rarity": x["r"], "face": IMG + x["f"]} for x in ATL]
NOW = int(time.time()); D = 86400
ev = lambda i, t, n, s, e: {"id": i, "type": t, "name": n, "noticeAt": s - D, "startedAt": s, "endedAt": e, "finishedAt": e, "materialOpenedAt": e, "warIds": []}
EVENTS = [ev(80534, "eventQuest", "Revival: Showa Kishin Project: GUDAGUDA Test Escape - Lite", NOW - 10 * D, NOW + 10 * D),
          ev(80600, "eventQuest", "Atlas Only Mystery Event", NOW - 2 * D, NOW + 3 * D),
          ev(80601, "questCampaign", "AP Cost 1/2", NOW - D, NOW + 5 * D),
          ev(80610, "eventQuest", "25 Million Downloads Campaign", NOW - D, NOW + 11 * D)]  # the wiki says "25M", and starts it two days earlier
TUT = next(x for x in ATL if x["n"] == "Ereshkigal")
g = lambda i, n, s, e, ft: {"id": i, "name": n, "type": "payGacha", "openedAt": s, "closedAt": e, "gachaSubs": [], "featuredSvtIds": ft}
GACHAS = [g(1, "GUDAGUDA Test Escape Pickup Summon", NOW - 10 * D, NOW + 10 * D, [TUT["id"]]), g(2, "Class-Based Summoning Campaign (Saber)", NOW - D, NOW + 6 * D, [])]
FILES = {"basic_servant.json": svts, "basic_equip.json": [], "basic_event.json": EVENTS, "nice_gacha.json": GACHAS}
info = {"hash": "h1", "timestamp": NOW - 3600}
def pst(ts): d = datetime.fromtimestamp(ts, timezone(timedelta(hours=-8))); return d.strftime("%B ") + str(d.day) + "th " + d.strftime("%Y %H:%M")
WIKI = {
  "GUDAGUDA Test Escape 2023 Revival (US)": f"{{{{EventHeaderNA\n|pagename=GUDAGUDA Test Escape (US)\n|image=GudaTestUS.png\n|start={pst(NOW - 10 * D)}\n|end={pst(NOW + 10 * D)}\n|timezone=PST\n|name=Revival: Showa Kishin Project: GUDAGUDA Test Escape - Lite\n|requirement=[[Fuyuki]]\n}}}}\nrest",
  "25M Downloads Campaign (US)": f"{{{{EventHeaderNA\n|start={pst(NOW - 3 * D)}\n|end={pst(NOW + 11 * D)}\n|timezone=PST\n|name=25M Downloads Campaign\n|requirement=None\n}}}}\nrest",
  "Mystery House Testers (US)": f"{{{{EventHeaderNA\n|pagename = Mystery House Testers (US)\n|image = MysteryTestUS.png\n|start = {pst(NOW + 17 * D)}\n|end = {pst(NOW + 36 * D)}\n|timezone = PST\n|name = Smash! Mystery House Testers\n|requirement = Olympus\n|story = Imaginary Scramble\n}}}}\n== New Servants ==\n|{{{{Star}}}} {{{{Lancer}}}} [[Van Gogh (Miner)]] {{{{EventR}}}}\n|{{{{Star}}}} {{{{Archer}}}} [[{TUT['n']}]] {{{{LimitedS}}}}\n",
  "Template:GameUpdatesNA": "{{Data Updates\n|squest1= {{Inum|{{Yagyū Munenori|stage=2|68px|link=x}}|STR{{Mini NP Icon}}}}\n|newserv1={{Inum|{{Ereshkigal|stage=3|68px}}|{{LimitedS}}}}\n|newce1= {{Craft Essence Icon|Formal Craft|31|68px}}\n|newcc1={{Command Code Icon|Fairy King's Crown|177|68px}}\n|newitem1= {{Moonlight Nucleus}}\n}}"}
wiki_hits = []
def wiki(r):
    q = parse_qs(urlparse(r.request.url).query); q = {k: v[0] for k, v in q.items()}; wiki_hits.append(q.get("list") or q.get("prop"))
    h = {"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"}
    if q.get("list") == "categorymembers":
        t = ["GUDAGUDA Test Escape 2023 Revival (US)", "25M Downloads Campaign (US)"] if "Current" in q["cmtitle"] else ["Mystery House Testers (US)"]
        return r.fulfill(body=json.dumps({"query": {"categorymembers": [{"title": x} for x in t]}}), headers=h)
    if q.get("prop") == "revisions":
        return r.fulfill(body=json.dumps({"query": {"pages": [{"title": t, "revisions": [{"slots": {"main": {"content": WIKI.get(t, "")}}}]} for t in q["titles"].split("|")]}}), headers=h)
    if q.get("prop") == "imageinfo":
        return r.fulfill(body=json.dumps({"query": {"pages": [{"title": t, "imageinfo": [{"thumburl": "https://static.wikia.nocookie.net/test/" + t[5:]}]} for t in q["titles"].split("|")]}}), headers=h)
    if q.get("action") == "parse" and q.get("page") == "Mystery House Testers (US)":
        return r.fulfill(body=json.dumps({"parse": {"title": q["page"], "text": '<div class="mw-parser-output"><p>A mystery to test.</p><div class="mw-heading mw-heading2"><h2 id="Event_Summary">Event Summary</h2></div><p>Solve the test mystery.</p><div class="mw-heading mw-heading2"><h2 id="Event_Shop">Event Shop</h2></div><p>Clue shop.</p></div>'}}), headers=h)
    r.fulfill(body="{}", headers=h)
def itunes(r):
    cc = parse_qs(urlparse(r.request.url).query)["country"][0]
    x = {"version": "2.94.1" if cc == "us" else "2.140.0", "currentVersionReleaseDate": "2026-10-22T05:15:14Z", "releaseNotes": "[ver2.94.1] Update Contents\n\n- Game System Improvement\n- Various Bug Fixes"}
    r.fulfill(body=json.dumps({"resultCount": 1, "results": [x]}), headers={"Access-Control-Allow-Origin": "*", "Content-Type": "application/json"})
def api(r):
    name = r.request.url.rsplit("/", 1)[-1].split("?")[0]
    body = info if name == "info.json" else FILES.get(name)
    if body is None: return r.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*"})
    r.fulfill(body=json.dumps(body), headers={"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"})
outside = []
def page(p, init, w=1500, h=1000, mobile=False):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h}, is_mobile=mobile, has_touch=mobile)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.add_init_script(init)
    pg.route("https://fonts.**", lambda r: r.abort())
    pg.route("https://api.atlasacademy.io/**", api); pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.route("https://fategrandorder.fandom.com/api.php**", wiki); pg.route("https://itunes.apple.com/**", itunes)
    pg.route("https://static.wikia.nocookie.net/**", lambda r: r.fulfill(path=f"{sp}/ph_art.png", content_type="image/png"))
    pg.on("request", lambda rq: outside.append(rq.url) if re.match(r"https://(fategrandorder|itunes|api\.atlas)", rq.url) else None)
    return ctx, pg
with sync_playwright() as p:
    # live updates off: clocks only, nobody asked
    ctx, pg = page(p, INIT)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(2200)
    check("the board sits right under the greeting", pg.evaluate("(() => { const h = document.querySelector('#home .hm-hero'); return !!h && h.nextElementSibling && h.nextElementSibling.classList.contains('hb'); })()"))
    clk = pg.evaluate("[...document.querySelectorAll('[data-hb-clk]')].map(e => e.textContent)")
    check(f"the sidebar's clocks run ({clk})", len(clk) == 3 and all(re.match(r"^\d\d:\d\d:\d\d$", c) for c in clk))
    t1 = pg.evaluate("document.querySelector('[data-hb-clk=\"Asia/Tokyo\"]').textContent")
    want = datetime.now(timezone(timedelta(hours=9))).strftime("%H:%M")
    check(f"JP time is Tokyo time ({t1} vs {want})", t1.startswith(want) or abs(int(t1[:2]) * 60 + int(t1[3:5]) - (int(want[:2]) * 60 + int(want[3:]))) <= 1)
    zone = pg.evaluate("document.querySelector('[data-hb-z=\"America/Los_Angeles\"]').textContent")
    check(f"NA time says whether it's PST or PDT ({zone})", zone in ("PST", "PDT"))
    check("with live updates off, the board asks to turn them on", pg.locator("#home .hb-events.off [data-action='live-on']").count() == 1)
    check(f"and nothing outside is asked for ({outside[:3]})", not outside)
    ctx.close()

    # live updates on
    outside.clear()
    ctx, pg = page(p, INIT + LIVE_ON)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(1500)
    now_cards = pg.evaluate("[...document.querySelectorAll('#home .hb-grid:not(.up) .hb-ev')].map(e => e.querySelector('.hb-n').textContent)")
    up_cards = pg.evaluate("[...document.querySelectorAll('#home .hb-grid.up .hb-ev')].map(e => e.querySelector('.hb-n').textContent)")
    check(f"Now on: the wiki's current events and the one only NA's data knows, ending first first ({now_cards})", now_cards == ["Atlas Only Mystery Event", "Revival: Showa Kishin Project: GUDAGUDA Test Escape - Lite", "25M Downloads Campaign"])
    dl = pg.locator("#home .hb-ev", has_text="25M Downloads")
    check("\"25M Downloads Campaign\" on the wiki is \"25 Million Downloads Campaign\" in NA's data, two days apart: one card, opening NA's event", dl.count() == 1 and dl.locator('[data-action="ev-open"]').get_attribute("data-ev") == "80610")
    check(f"Coming up: the wiki's announced event ({up_cards})", up_cards == ["Smash! Mystery House Testers"])
    guda = pg.locator("#home .hb-ev", has_text="GUDAGUDA")
    check("the wiki's banner is the card's picture", "GudaTestUS.png" in (guda.locator(".hb-art img").get_attribute("src") or ""))
    check("matched to NA's event, the card opens its Event page", guda.locator('[data-action="ev-open"]').get_attribute("data-ev") == "80534")
    prog = float(guda.evaluate("e => getComputedStyle(e).getPropertyValue('--p')"))
    check(f"it shows the time left, and that it's halfway through (--p {prog})", "ends in" in guda.inner_text() and abs(prog - 0.5) < 0.05)
    up = pg.locator("#home .hb-ev.up").first
    check(f"the upcoming one: starts in 17 days, needs Olympus, story after Imaginary Scramble ({' '.join(up.inner_text().split())[:200]!r})", "starts in 16d" in up.inner_text() or "starts in 17d" in up.inner_text())
    check("its requirement and story", "Olympus" in up.inner_text() and "Imaginary Scramble" in up.inner_text())
    check("and its new servants, pickup and free", up.locator(".hb-pk.pickup").count() == 1 and up.locator(".hb-pk.reward").count() == 1)
    wid = up.locator('[data-action="ev-open"]').get_attribute("data-ev") or ""
    check(f"an event NA's data doesn't have yet still opens a page here ({wid}), with the wiki link beside it", wid.startswith("-") and up.locator(".hb-wl").get_attribute("href").endswith("Mystery_House_Testers_(US)"))
    camps = pg.evaluate("[...document.querySelectorAll('#home .hb-camp')].map(c => [c.querySelector('.hb-cm > b').textContent, c.querySelector('.hb-ctag').textContent, c.classList.contains('up')])")
    check(f"summoning campaigns: the event's pickup, another kind, and the announced event's pickup ({camps})",
          ["GUDAGUDA Test Escape Pickup Summon", "Event campaign", False] in camps and ["Class-Based Summoning Campaign (Saber)", "Other campaign", False] in camps
          and ["Smash! Mystery House Testers Summoning Campaign", "Event campaign", True] in camps and camps[-1][2])
    ver = pg.locator("#home .hb-ver").inner_text()
    check(f"the game's version for NA and JP ({' '.join(ver.split())[:80]!r})", "2.94.1" in ver and "2.140.0" in ver)
    pg.click("#home .hb-notes summary"); pg.wait_for_timeout(200)
    check("with what NA's update changed", "Various Bug Fixes" in pg.locator("#home .hb-notes").inner_text())
    upd = pg.locator("#home .hb-upd").inner_text()
    check(f"the wiki's Latest Updates ({' '.join(upd.split())[:160]!r})", "Munenori" in upd and "Formal Craft" in upd and "Fairy King's Crown" in upd and "Moonlight Nucleus" in upd)
    pg.locator('#home .hb-upd [data-action="ce-open"]').first.click(); pg.wait_for_timeout(500)
    check("a new Craft Essence opens its details", pg.evaluate("!document.getElementById('pc-dlg').hidden"))
    check("a wiki name finds its servant even when NA spells it differently", pg.locator('#home .hb-upd [data-action="pc-open"]').count() == 2)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    n_wiki = len(wiki_hits)
    pg.reload(); pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(1200)
    check(f"after a reload it's all there without asking the wiki again ({len(wiki_hits) - n_wiki} asks)", len(wiki_hits) == n_wiki and pg.locator("#home .hb-ev").count() == 4)
    # the upcoming event's own page, made from the wiki
    pg.click('#home .hb-ev.up [data-action="ev-open"]'); pg.wait_for_selector("#event .ev-title", timeout=20000); pg.wait_for_timeout(1500)
    head = pg.locator("#event .ev-head").inner_text()
    check(f"its page: the wiki's name, from the wiki, when it starts ({' '.join(head.split())[:120]!r})", pg.evaluate("location.hash") == "#event/" + wid and "Smash! Mystery House Testers" in head and "from the wiki" in head and "starts" in head)
    tabs = [x.strip() for x in pg.locator("#event .ev-tab").all_inner_texts()]
    ov = pg.locator("#event .ev-pane").inner_text()
    check(f"with the wiki page's sections as tabs ({tabs}) and what the board knew: requirement, story, servants", "Event Summary" in tabs and "Event Shop" in tabs and "Olympus" in ov and "Imaginary Scramble" in ov and "pickup" in ov)
    pg.reload(); pg.wait_for_selector("#event .ev-title", timeout=20000); pg.wait_for_timeout(800)
    check("it opens again after a reload", "Smash! Mystery House Testers" in pg.locator("#event .ev-title").inner_text())
    pg.click('#event [data-action="tab"][data-tab="home"]'); pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(600)
    pg.click('#home .hb-ev.now [data-action="ev-open"][data-ev="80534"]'); pg.wait_for_timeout(800)
    check("a card opens the Event page", pg.evaluate("location.hash").startswith("#event/80534"))
    ctx.close()

    # a phone: one column, the sidebar under the events, no sideways scroll
    ctx, pg = page(p, INIT + LIVE_ON, 390, 844, True)
    pg.goto(SEEDED + "#home"); pg.wait_for_selector("#home .hb-ev", timeout=20000); pg.wait_for_timeout(1200)
    lay = pg.evaluate("(() => { const m = document.querySelector('.hb-main').getBoundingClientRect(), s = document.querySelector('.hb-side').getBoundingClientRect(); return [s.top >= m.bottom - 1, document.documentElement.scrollWidth <= innerWidth]; })()")
    check(f"on a phone the sidebar comes after the events and nothing scrolls sideways ({lay})", all(lay))
    ctx.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
