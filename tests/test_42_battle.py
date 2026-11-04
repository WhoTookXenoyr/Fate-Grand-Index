import os
# 0.50.0-beta: the battle simulator (auto-battle). The engine: the same seed plays the same fight; NA's skill lines are
# read into effects (bundled "&" lines into each part, "disable HP recovery" isn't a heal, "Apply a state …" is left
# alone); a fight ends in a win, a loss or the turn limit, with each servant's numbers. The page: the party (your
# servants, Guests, a support, any NA servant), the enemies (made up and edited, your Guests, your servants, a real NA
# quest from Atlas Academy), Fight, playback (play, pause, step, jump, speed), the summary, the log. A custom servant
# fights with its Workshop kit. The setup is kept in this browser; nothing on the roster changes. A phone gets it all
# without sideways scrolling.
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
QUEST = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures", "battle-quest-1000113-4.json")
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1')"
KEY = "spirit-origin-list:v1"
BTK = KEY + ":battle"
asked = []
def atlas(r):
    u = r.request.url; asked.append(u)
    if "/nice/NA/quest/1000113/4" in u: r.fulfill(path=QUEST, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"})
    else: r.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*"})
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", atlas)
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    return pg
roster = lambda pg: json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True)
prefs = lambda pg: pg.evaluate(f"JSON.parse(localStorage.getItem('{BTK}') || 'null')")
def sel(pg, s, v): pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event('change', {bubbles: true})); }", [s, v]); pg.wait_for_timeout(300)
def stop(pg):
    if pg.locator('#battle [data-bt-act="play"][aria-pressed="true"]').count(): pg.click('#battle [data-bt-act="play"]'); pg.wait_for_timeout(150)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    before = roster(pg)

    # ================= the engine =================
    r = pg.evaluate("""() => { const B = window.__fgiBattle, mine = B.servants().filter((s) => !s.wish).slice(0, 3).map((s) => B.fromServant(s));
      const waves = [[B.made({cls: 'Lancer', name: 'A', hp: 15000, atk: 3000}), B.made({cls: 'Archer', name: 'B', hp: 15000, atk: 3000})], [B.made({cls: 'Saber', name: 'Boss', hp: 90000, atk: 5000, charge: 3})]];
      const one = B.run({party: mine, waves: waves}, 12345), two = B.run({party: mine, waves: waves}, 12345);
      const strip = (R) => JSON.stringify(R.events.map((e) => [e.t, e.who, e.to, e.dmg, e.n]));
      return {same: strip(one) === strip(two), result: one.result, turns: one.turns, waves: one.waves, n: one.events.length, first: one.events[0].t, last: one.events[one.events.length - 1].t,
        snap: !!one.events[5].s && Array.isArray(one.events[5].s.u), allies: one.units.filter((u) => u.side === 'ally').length, dmg: one.units.filter((u) => u.side === 'ally').reduce((a, u) => a + u.stat.dmg, 0),
        kinds: Array.from(new Set(one.events.map((e) => e.t))).sort()}; }""")
    check(f"the same seed plays the same fight ({r['n']} steps)", r["same"] and r["n"] > 20)
    check(f"it starts, and it ends ({r['first']} … {r['last']})", r["first"] == "start" and r["last"] == "end")
    check(f"a seeded party beats two easy waves ({r['result']} in {r['turns']} turns)", r["result"] == "win" and 1 <= r["turns"] <= 40 and r["waves"] == 2)
    check(f"each step has its moment to show, and the totals add up ({r['dmg']})", r["snap"] and r["allies"] == 3 and r["dmg"] >= 120000)
    check(f"skills, cards and NPs all happen ({r['kinds']})", all(k in r["kinds"] for k in ("skill", "plan", "card", "np", "turn", "wave")))
    lose = pg.evaluate("""() => { const B = window.__fgiBattle, one = [B.fromServant(B.servants().filter((s) => !s.wish)[0])];
      const R = B.run({party: one, waves: [[B.made({cls: 'Berserker', name: 'Wall', hp: 50000000, atk: 60000, acts: 3})]]}, 7); return [R.result, R.turns]; }""")
    check(f"one servant against a wall loses ({lose})", lose[0] == "lose")
    tl = pg.evaluate("""() => { const B = window.__fgiBattle, one = [B.fromServant(B.servants().filter((s) => !s.wish)[0])];
      const R = B.run({party: one, waves: [[B.made({cls: 'Saber', name: 'Pillow', hp: 900000000, atk: 0})]]}, 7); return [R.result, R.turns]; }""")
    check(f"a fight that can't end stops at the turn limit ({tl})", tl == ["time", 40])
    rd = pg.evaluate("""() => { const R = window.__fgiBattle.read; const k = (l) => R(l).map((x) => x.k + ':' + x.tg + (x.d ? ':' + x.d : ''));
      return {two: k('Increase ATK for all allies (3 turns) & Increase NP Gauge for all allies'), self: k('Increase your Buster Card effectiveness (3 turns)'),
        dis: k('Disable HP recovery for a single enemy (3 turns)'), state: k('Apply a state that increases NP gauge by 20% when attacking'), def: k('Decrease DEF for all enemies (3 turns)'),
        inv: R('Grant Invincible to yourself (1 time, 3 turns)')[0]}; }""")
    check(f"an '&' line is two effects for the same allies ({rd['two']})", rd["two"] == ["atk:a:3", "charge:a"])
    check(f"a card buff for yourself ({rd['self']})", rd["self"] == ["card:s:3"])
    check(f"'disable HP recovery' isn't a heal ({rd['dis']})", not any(x.startswith("heal") or x.startswith("regen") for x in rd["dis"]))
    check(f"'Apply a state …' is left alone ({rd['state']})", rd["state"] == [])
    check(f"a debuff on all enemies ({rd['def']})", rd["def"] == ["defdown:E:3"])
    check(f"Invincible: once, for 3 turns ({rd['inv']['n']}, {rd['inv']['d']})", rd["inv"]["k"] == "invinc" and rd["inv"]["n"] == 1 and rd["inv"]["d"] == 3)

    # ================= the page =================
    pg.click('[data-action="tab"][data-tab="battle"]'); pg.wait_for_timeout(900)
    check("the Battle page opens", pg.locator("#view-battle:not([hidden]) #battle .bt-setup").count() == 1)
    check("it's in the footer's list of pages too", pg.locator('footer [data-tab="battle"], .foot [data-tab="battle"]').count() >= 1)
    check(f"six places in the party, the first three filled ({pg.locator('#battle [data-bt-slot]').count()})", pg.locator("#battle [data-bt-slot]").count() == 6 and all(pg.locator(f"#bt-p{i}").input_value() for i in range(3)))
    opts = pg.evaluate("Array.from(document.querySelectorAll('#bt-p0 optgroup')).map((g) => g.label)")
    check(f"a place can take yours, a Guest, a support or any NA servant ({opts})", opts[0] == "Your servants" and any("support" in o for o in opts) and "Any NA servant" in opts)
    check("made-up enemies to start: three waves", pg.locator("#battle .bt-made .bt-wave").count() == 3 and pg.locator('#battle [data-bt-src="made"]').get_attribute("aria-pressed") == "true")
    # editing them
    pg.click('#battle [data-bt-act="enemy-del"][data-w="0"][data-e="0"]'); pg.wait_for_timeout(250)
    check("an enemy removed", pg.locator("#battle .bt-wave").first.locator(".bt-erow").count() == 2)
    pg.fill('#battle [data-bt-e="0.0.hp"]', "12345"); pg.locator('#battle [data-bt-e="0.0.hp"]').dispatch_event("change"); pg.wait_for_timeout(200)
    check("an HP changed, kept, and the setup says it's your own now", prefs(pg)["made"][0][0]["hp"] == 12345 and prefs(pg)["preset"] == "own")
    pg.click('#battle [data-bt-act="wave-del"][data-w="2"]'); pg.wait_for_timeout(250)
    check("a wave removed", pg.locator("#battle .bt-made .bt-wave").count() == 2)
    sel(pg, "#battle [data-bt-preset]", "dummy")
    check("a preset puts its waves back", pg.locator("#battle .bt-made .bt-wave").count() == 3 and "Dummy" in pg.locator('#battle [data-bt-e="0.0.name"]').input_value())
    pg.fill("#battle [data-bt-seed]", "4242"); pg.locator("#battle [data-bt-seed]").dispatch_event("change")

    # ---------- the fight ----------
    pg.click('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(1600)
    check("Fight: it plays", pg.locator("#battle .bt-run").count() == 1 and pg.locator('#battle [data-bt-act="play"]').get_attribute("aria-pressed") == "true")
    stop(pg)
    s0 = pg.locator("#battle .bt-say").inner_text()
    pg.click('#battle [data-bt-act="next"]'); pg.wait_for_timeout(150)
    s1 = pg.locator("#battle .bt-say").inner_text()
    pg.click('#battle [data-bt-act="prev"]'); pg.wait_for_timeout(150)
    check(f"paused, it steps on and back ({s0!r} → {s1!r} → back)", pg.locator("#battle .bt-say").inner_text() == s0 and pg.locator('#battle [data-bt-act="play"]').get_attribute("aria-pressed") == "false")
    check("three enemies and three allies on the stage", pg.locator("#battle .bt-row.foes .bt-u").count() >= 1 and pg.locator("#battle .bt-row.allies .bt-u").count() == 3)
    pg.click('#battle [data-bt-speed="4"]'); pg.wait_for_timeout(150)
    check("4× is kept", prefs(pg).get("speed") == 4)
    pg.click('#battle [data-bt-act="last"]'); pg.wait_for_timeout(400)
    head = pg.locator("#battle .bt-sum h3").inner_text()
    check(f"at the end: the result and each servant's numbers ({head!r})", ("Victory" in head or "Defeat" in head or "Out of time" in head) and pg.locator("#battle .bt-sum tbody tr").count() == 3)
    log = pg.locator("#battle [data-bt-log] li").count()
    pg.locator("#battle [data-bt-log] summary").click(); pg.wait_for_timeout(200)
    pg.locator("#battle [data-bt-log] li button").nth(3).click(); pg.wait_for_timeout(250)
    check(f"the log jumps to any moment ({log} lines)", log > 10 and pg.locator("#battle .bt-sum").count() == 0 and pg.locator("#battle [data-bt-log] li").nth(3).get_attribute("class").startswith("cur"))
    pg.click('#battle [data-bt-act="last"]'); pg.wait_for_timeout(300)
    t1 = pg.locator("#battle .bt-sum h3").inner_text()
    pg.click('#battle [data-bt-act="setup"]'); pg.wait_for_timeout(300)
    pg.click('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(300); stop(pg)
    pg.click('#battle [data-bt-act="last"]'); pg.wait_for_timeout(300)
    check(f"the same seed again: the same ending ({t1!r})", pg.locator("#battle .bt-sum h3").inner_text() == t1)
    # keys: space on the page plays and pauses; space on a button still presses that button
    pg.click('#battle [data-bt-act="first"]'); pg.wait_for_timeout(150)
    pg.evaluate("document.activeElement.blur()"); pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(150)
    check(f"→ steps on ({pg.locator('#battle .bt-say').inner_text()!r})", pg.locator("#battle .bt-say").inner_text() != "The battle begins.")
    pg.keyboard.press(" "); pg.wait_for_timeout(200)
    check("Space plays", pg.locator('#battle [data-bt-act="play"]').get_attribute("aria-pressed") == "true")
    pg.keyboard.press(" "); pg.wait_for_timeout(200)
    check("and pauses", pg.locator('#battle [data-bt-act="play"]').get_attribute("aria-pressed") == "false")
    pg.focus('#battle [data-bt-act="setup"]'); pg.keyboard.press(" "); pg.wait_for_timeout(300)
    check("Space on a button presses that button (Change the setup)", pg.locator("#battle .bt-setup").count() == 1)

    # ---------- Guests and your own as enemies ----------
    pg.click('#battle [data-bt-src="guests"]'); pg.wait_for_timeout(300)
    gs = pg.evaluate("Array.from(document.querySelectorAll('#battle [data-bt-pick=\"0.0\"] option')).slice(1).map((o) => o.value)")
    guests = pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants.filter((s) => s.wish).map((s) => 'r:' + s.id)")
    check(f"Your Guests: only Guests to pick ({len(gs)})", gs and sorted(gs) == sorted(guests))
    sel(pg, '#battle [data-bt-pick="0.0"]', gs[0]); sel(pg, '#battle [data-bt-pick="0.1"]', gs[1 % len(gs)])
    pg.click('#battle [data-bt-hpm="10"]'); pg.wait_for_timeout(200)
    check("with their HP ×10 kept", prefs(pg)["hpMul"] == 10 and prefs(pg)["pick"][0][0] == gs[0])
    pg.click('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(300); stop(pg)
    foes = pg.locator("#battle .bt-row.foes .bt-u .bt-un").all_inner_texts()
    check(f"they're the enemies ({foes})", len(foes) == 2)
    pg.click('#battle [data-bt-act="setup"]'); pg.wait_for_timeout(300)
    pg.click('#battle [data-bt-src="mine"]'); pg.wait_for_timeout(300)
    ms = pg.evaluate("Array.from(document.querySelectorAll('#battle [data-bt-pick=\"0.0\"] option')).slice(1).map((o) => o.value)")
    check(f"Your servants: no Guests in that list ({len(ms)})", ms and not set(ms) & set(guests))

    # ---------- a real NA quest ----------
    pg.click('#battle [data-bt-src="quest"]'); pg.wait_for_timeout(300)
    pg.fill("#battle [data-bt-qid] input", "https://apps.atlasacademy.io/db/NA/quest/1000113/4"); pg.click("#battle [data-bt-qid] button"); pg.wait_for_timeout(1500)
    check("a quest by its link: asked Atlas Academy for that battle", any("/nice/NA/quest/1000113/4" in u for u in asked))
    qw = pg.locator("#battle .bt-qwaves .bt-qw").count()
    check(f"its waves and enemies are listed ({qw} waves)", qw == 3 and "Fafnir" in pg.locator("#battle .bt-qwaves").inner_text())
    pg.click('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(300); stop(pg)
    pg.click('#battle [data-bt-act="last"]'); pg.wait_for_timeout(300)
    names = pg.evaluate("Array.from(document.querySelectorAll('#battle [data-bt-log] li button')).map((b) => b.textContent).join(' ')")
    check("the fight is against the quest's enemies", "Wyvern" in names or "Fafnir" in names)
    check("three waves", "of 3" in pg.locator("#battle .bt-where span").inner_text())
    pg.click('#battle [data-bt-act="setup"]'); pg.wait_for_timeout(300)
    n0 = len(asked)
    pg.reload(); pg.wait_for_timeout(1500); pg.click('[data-action="tab"][data-tab="battle"]'); pg.wait_for_timeout(1200)
    check("after a reload the quest is still there, from this browser's copy", pg.locator("#battle .bt-qwaves .bt-qw").count() == 3 and not any("/quest/1000113/4" in u for u in asked[n0:]))
    pg.fill("#battle [data-bt-qid] input", "hello"); pg.click("#battle [data-bt-qid] button"); pg.wait_for_timeout(300)
    check("a word that isn't a quest number says so", "doesn't look like a quest number" in pg.locator("#battle .bt-warn").inner_text())
    pg.fill("#battle [data-bt-qid] input", "1000999/1"); pg.click("#battle [data-bt-qid] button"); pg.wait_for_timeout(1200)
    check("a quest Atlas Academy doesn't have says so", "Couldn't load that quest" in pg.locator("#battle .bt-warn").inner_text())

    # ---------- a custom servant in the party ----------
    pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(600)
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="dice"]'); pg.wait_for_timeout(500)
    pg.click(".ws-rail [data-i='1']"); pg.wait_for_timeout(250)
    pg.evaluate("(() => { const e = document.querySelector('#ws-name'); e.value = 'Battle Tester'; e.dispatchEvent(new Event('input', {bubbles: true})); })()"); pg.wait_for_timeout(300)
    pg.click(".ws-rail [data-i='7']"); pg.wait_for_timeout(250); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1000)
    cid = next(x for x in pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants") if x["name"] == "Battle Tester")["id"]
    before = roster(pg)
    pg.click('[data-action="tab"][data-tab="battle"]'); pg.wait_for_timeout(700)
    sel(pg, "#bt-p0", "r:" + cid)
    check("a custom servant in the party, marked Custom", "Custom" in pg.locator("#battle .bt-slot").first.inner_text())
    t = pg.evaluate(f"(() => {{ const B = window.__fgiBattle, s = B.servants().find((x) => x.id === '{cid}'), t = B.fromServant(s); return {{custom: !!t.custom, np: !!t.np, sk: t.sk.length, atk: t.atk}}; }})()")
    check(f"with its Workshop kit ({t})", t["custom"] and t["np"] and t["sk"] == 3 and t["atk"] > 0)
    pg.click('#battle [data-bt-src="made"]'); pg.wait_for_timeout(200)
    pg.click('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(300); stop(pg)
    pg.click('#battle [data-bt-act="last"]'); pg.wait_for_timeout(300)
    sm = pg.locator("#battle .bt-sum").inner_text() if pg.locator("#battle .bt-sum").count() else pg.locator("#battle").inner_text()[:200]
    check(f"and it fights ({sm[:160]!r})", "Battle Tester" in sm)
    check("nothing on the roster changed", roster(pg) == before)
    ctx.close()

    # ================= a phone =================
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=3)
    pg = page(ctx)
    pg.goto(SEEDED + "#battle"); pg.wait_for_timeout(1700)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    check(f"phone, the setup: no sideways scroll ({w})", w[0] <= w[1] + 1)
    pg.tap('#battle [data-bt-act="fight"]'); pg.wait_for_timeout(1200)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    check(f"phone, the fight: no sideways scroll ({w})", w[0] <= w[1] + 1)
    top = pg.evaluate("document.querySelector('#battle .bt-ctl').getBoundingClientRect().top")
    check(f"the playback buttons aren't under the bar at the top ({top:.0f})", top >= 50)
    stop(pg)
    pg.tap('#battle [data-bt-act="last"]'); pg.wait_for_timeout(400)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    check(f"phone, the summary: no sideways scroll ({w})", w[0] <= w[1] + 1)
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
