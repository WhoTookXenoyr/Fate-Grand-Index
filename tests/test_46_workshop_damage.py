import os
# 0.52.0-beta: in the Workshop, under each skill, what the skill adds to damage: the Noble Phantasm and the servant's
# own cards, without and with the skill, on a hit, a critical, against a class it beats, and both. A custom servant is
# made here by hand and every number is worked out again in this file from the game's formula.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));"
WSK = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:workshop') || 'null')"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def K(pg): pg.wait_for_timeout(450); return pg.evaluate(WSK)["k"]
def go(pg, i): pg.click(f".ws-rail [data-i='{i}']"); pg.wait_for_timeout(250)
def add_fx(pg, e):
    pg.click('[data-ws="fx-add"][data-w="sk"]'); pg.wait_for_timeout(200); pg.click(f".ws-pal [data-ws='fx-pick'][data-e='{e}']"); pg.wait_for_timeout(250)
CARD = {"Buster": 1.5, "Arts": 1.0, "Quick": 0.8}
CLS = {"Archer": 0.95, "Lancer": 1.05, "Caster": 0.9, "Assassin": 0.9, "Berserker": 1.1, "Ruler": 1.1, "Avenger": 1.1}
TERR = {"EX": 12, "A++": 11.5, "A+": 11, "A": 10, "A-": 9.5, "B++": 9.5, "B+": 9, "B": 8, "B-": 7.5, "C++": 7.5, "C+": 7, "C": 6, "C-": 5.5, "D++": 5.5, "D+": 5, "D": 4, "D-": 3.5, "E++": 3.5, "E+": 3, "E": 2, "E-": 1}
def table(pg):
    # {row: [[without, with] | None × 4]} as the page prints it
    return pg.evaluate("""(() => { const o = {}; document.querySelectorAll('.ws-dmg-t tbody tr').forEach((tr) => { o[tr.dataset.k] = Array.from(tr.querySelectorAll('td')).map((td) => {
      const n = (s) => Number(String(s).replace(/[^0-9]/g, '')); if (td.classList.contains('none')) return null; if (td.classList.contains('same')) return [n(td.textContent), n(td.textContent)];
      return [n(td.querySelector('.was').textContent), n(td.querySelector('b').textContent)]; }); }); return o; })()""")
def near(a, b): return a is not None and abs(a - b) <= 1
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)

    # ---------- a custom servant: a ★5 Caster with an Arts NP on all enemies ----------
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="blank"]'); pg.wait_for_timeout(200)
    pg.click('[data-ws="blank-cls"][data-v="Caster"]'); pg.click('[data-ws="blank-go"][data-r="5"]'); pg.wait_for_timeout(400)
    typ(pg, "#ws-name", "Orielle of the Last Light")
    go(pg, 2); typ(pg, '[data-wk="atk.1"]', "11000"); pg.wait_for_timeout(300)
    go(pg, 3); pg.click('[data-ws="set"][data-p="np.card"][data-v="Arts"]'); pg.click('[data-ws="set"][data-p="np.tg"][data-v="AoE"]'); pg.wait_for_timeout(300)
    k = K(pg)
    terr = sum(TERR.get(str(x.get("rank", "")).upper(), 0) for x in k["ps"] if x["name"] == "Territory Creation")
    check(f"the servant: ATK 11,000, Arts NP on all enemies at 450%, deck {k['deck']}, Territory Creation +{terr}%", k["atk"][1] == 11000 and k["np"]["dmg"][0] == 450 and k["np"]["card"] == "Arts" and terr > 0)
    go(pg, 5)
    box = pg.locator(".ws-dmg")
    check("under a skill with nothing in it, the damage box says what to do", box.count() == 1 and "Add an effect" in box.inner_text())

    # ---------- Arts up for yourself: 30% → 50% ----------
    add_fx(pg, "card")
    pg.locator('.ws-fx').first.locator('[data-ws="set"][data-v="Arts"]').click(); pg.wait_for_timeout(350)
    fx = K(pg)["sk"][0]["fx"][0]
    check(f"Arts up for yourself, 30% at Lv 1 and 50% at Lv 10 ({fx})", fx["e"] == "card" and fx["card"] == "Arts" and fx["v"] == [30, 50])
    ATK, C = 11000, CLS["Caster"]
    def np_(card_up=0, atk=0, npup=0, pow_=0, dp=0, eff=1): return ATK * 0.23 * 4.5 * CARD["Arts"] * (1 + (terr + card_up) / 100) * C * (1 + atk / 100) * (1 + (pow_ + npup) / 100) * eff + dp
    def card(c, card_up=0, atk=0, crit=None, pow_=0, dp=0, eff=1): return ATK * 0.23 * CARD[c] * (1 + ((terr if c == "Arts" else 0) + card_up) / 100) * C * (1 + atk / 100) * (1 + (pow_ + (crit or 0)) / 100) * (2 if crit is not None else 1) * eff + dp
    t = table(pg)
    check(f"the table has the Arts NP and the Arts card, and no row for cards the skill doesn't touch ({sorted(t.keys())})", sorted(t.keys()) == ["Arts", "np"])
    check(f"Arts NP: {t['np'][0]} is {round(np_())} → {round(np_(50))}", near(t["np"][0][0], np_()) and near(t["np"][0][1], np_(50)))
    check(f"the NP has no critical, and against a class it beats it's double ({t['np']})", t["np"][1] is None and t["np"][3] is None and near(t["np"][2][0], np_(eff=2)) and near(t["np"][2][1], np_(50, eff=2)))
    a = t["Arts"]
    check(f"Arts card, a hit: {a[0]} is {round(card('Arts'))} → {round(card('Arts', 50))}", near(a[0][0], card("Arts")) and near(a[0][1], card("Arts", 50)))
    check(f"a critical is twice that ({a[1]})", near(a[1][0], card("Arts", crit=0)) and near(a[1][1], card("Arts", 50, crit=0)))
    check(f"effective and effective critical ({a[2]}, {a[3]})", near(a[2][0], card("Arts", eff=2)) and near(a[2][1], card("Arts", 50, eff=2)) and near(a[3][0], card("Arts", crit=0, eff=2)) and near(a[3][1], card("Arts", 50, crit=0, eff=2)))
    txt = box.inner_text()
    gain = round(np_(50)) - round(np_())
    check(f"each cell says what was gained, as a number and a share (+{gain:,})", f"+{gain:,}" in txt and re.search(r"\(\+\d+(\.\d)?%\)", txt) is not None)
    check("and the note says what the numbers stand for", "skill level 10" in txt and "ATK 11,000" in txt and "Caster beats" in txt and "Arts Up +50%" in txt.replace("\n", " "))

    # the value follows what's typed, live
    typ(pg, '[data-wk="sk.0.fx.0.v.1"]', "40"); pg.wait_for_timeout(500)
    t = table(pg)
    check(f"typing 40% at Lv 10 moves the numbers at once ({t['np'][0]})", near(t["np"][0][1], np_(40)) and near(t["Arts"][0][1], card("Arts", 40)))
    typ(pg, '[data-wk="sk.0.fx.0.v.1"]', "50"); pg.wait_for_timeout(400)

    # ---------- more effects on the same skill: they stack the game's way ----------
    add_fx(pg, "atk"); add_fx(pg, "crit"); add_fx(pg, "np"); add_fx(pg, "dp")
    sk = K(pg)["sk"][0]
    v10 = {f["e"]: f["v"][1] for f in sk["fx"]}
    check(f"ATK up (all allies), Critical damage up, NP Strength up and Damage Plus are on the skill ({v10})", set(v10) == {"card", "atk", "crit", "np", "dp"})
    t = table(pg)
    check(f"now every card has a row ({sorted(t.keys())})", sorted(t.keys()) == sorted(["np"] + [c for c in CARD if c[0] in k["deck"]]))
    want = np_(50, v10["atk"], v10["np"], 0, v10["dp"])
    check(f"the NP: card up and ATK up multiply, NP Strength is its own factor, Damage Plus is added ({t['np'][0][1]} is {round(want)})", near(t["np"][0][1], want))
    want = card("Buster", 0, v10["atk"], None, 0, v10["dp"])
    check(f"a Buster card takes ATK up and Damage Plus, not Arts up or NP Strength ({t['Buster'][0][1]} is {round(want)})", near(t["Buster"][0][0], card("Buster")) and near(t["Buster"][0][1], want))
    want = card("Arts", 50, v10["atk"], v10["crit"], 0, v10["dp"], 2)
    check(f"an effective Arts critical takes everything but NP Strength ({t['Arts'][3][1]} is {round(want)})", near(t["Arts"][3][1], want))
    want = card("Quick", 0, v10["atk"], v10["crit"], 0, v10["dp"])
    check(f"critical damage up only shows on criticals ({t['Quick'][1][1]} is {round(want)})", near(t["Quick"][1][1], want) and near(t["Quick"][0][1], card("Quick", 0, v10["atk"], None, 0, v10["dp"])))

    # ---------- what isn't this servant's damage ----------
    pg.click('[data-ws="sk-tab"][data-i="1"]'); pg.wait_for_timeout(250)
    add_fx(pg, "heal")
    check("a skill that only heals says it changes no damage", "Nothing in this skill changes" in pg.locator(".ws-dmg").inner_text())
    add_fx(pg, "atk")
    pg.locator('.ws-fx').nth(1).locator('[data-ws="set"][data-v="x"]').click(); pg.wait_for_timeout(350)
    txt = pg.locator(".ws-dmg").inner_text()
    check("ATK up for the other allies isn't counted, and it says why", "Nothing in this skill changes" in txt and "other allies" in txt)
    pg.locator('.ws-fx').nth(1).locator('[data-ws="set"][data-v="s"]').click(); pg.wait_for_timeout(350)
    add_fx(pg, "defdown")
    sk1 = K(pg)["sk"][1]; a10 = sk1["fx"][1]["v"][1]; d10 = sk1["fx"][2]["v"][1]
    t = table(pg)
    check(f"DEF down on the enemy adds to ATK up ({a10}% + {d10}%: {t['np'][0][1]} is {round(np_(0, a10 + d10))})", near(t["np"][0][1], np_(0, a10 + d10)))

    # ---------- a skill level below 10 ----------
    go(pg, 7)
    pg.click('[data-ws="copy"][data-p="np"][data-v="3"]'); pg.wait_for_timeout(200)
    lvsel = pg.evaluate("(() => { const e = document.querySelector('[data-wc=\"skills.0\"]'); if (!e) return false; e.value = '6'; e.dispatchEvent(new Event('input', {bubbles: true})); return true; })()")
    go(pg, 5); pg.click('[data-ws="sk-tab"][data-i="0"]'); pg.wait_for_timeout(350)
    d = pg.evaluate("window.__fgiSkillDmg(0)")
    if lvsel:
        # the game's steps: a tenth of the way per level up to Lv 9
        up6 = 30 + (50 - 30) * 5 / 10
        check(f"at skill level 6 Arts up is {up6}% ({d['buffs']['card']['Arts']}), and the NP row is NP3's 675%", d["lv"] == 6 and abs(d["buffs"]["card"]["Arts"] - up6) < 0.01 and "NP3" in pg.locator(".ws-dmg").inner_text())
    else:
        check("the NP row follows the NP level picked for the copy (NP3)", "NP3" in pg.locator(".ws-dmg").inner_text())
    t = table(pg)
    want0 = ATK * 0.23 * 6.75 * (1 + terr / 100) * C
    check(f"NP3 without the skill ({t['np'][0][0]} is {round(want0)})", near(t["np"][0][0], want0))

    # ---------- summon them: their page's NP calculator gives the same number ----------
    go(pg, 7)
    pg.click('[data-ws="save"]'); pg.wait_for_timeout(1100)
    y = next((x for x in pg.evaluate(LS)["servants"] if x["name"] == "Orielle of the Last Light"), None)
    check("the servant is summoned", y is not None and y.get("custom") is True)
    calc = pg.evaluate("""(() => { const s = state.servants.find((x) => x.name === 'Orielle of the Last Light'); const np = npcNp(s);
      const I = {lv: 3, oc: 1, auto: true, team: false, se: false, card: 0, atk: 0, def: 0, np: 0, pow: 0, dp: 0, ecls: '', eattr: ''}; const r = npcCalc(s, np, I, ''); return r ? {avg: r.avg, atk: r.atk} : null; })()""") if pg.evaluate("typeof npcCalc === 'function' && typeof state === 'object'") else None
    if calc:
        scale = calc["atk"] / ATK
        check(f"their page's NP calculator agrees with the Workshop for the same ATK ({round(calc['avg'])} at ATK {round(calc['atk'])}, {round(want0 * scale)} expected)", abs(calc["avg"] - want0 * scale) <= max(2, want0 * scale * 0.001))
    else:
        check("the NP calculator is on their page", pg.locator("#dossier .npc, #dossier [data-npc]").count() >= 1)
    ctx.close()

    # ---------- a phone: the table scrolls inside its box, the page doesn't ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.evaluate("document.querySelector('[data-action=\"ws-new\"]').click()"); pg.wait_for_timeout(500)
    pg.click('[data-ws="blank"]'); pg.wait_for_timeout(200); pg.click('[data-ws="blank-cls"][data-v="Saber"]'); pg.click('[data-ws="blank-go"][data-r="5"]'); pg.wait_for_timeout(400)
    pg.evaluate("document.querySelector(\".ws-rail [data-i='5']\").click()"); pg.wait_for_timeout(300)
    pg.evaluate("document.querySelector('[data-ws=\"sk-preset\"][data-i=\"0\"][data-j=\"0\"]').click()"); pg.wait_for_timeout(400)
    m = pg.evaluate("(() => { const s = document.querySelector('.ws-dmg-scroll'), t = document.querySelector('.ws-dmg-t'), d = document.scrollingElement; return s && t ? {box: s.clientWidth, tab: t.scrollWidth, page: d.scrollWidth, vw: innerWidth, ws: document.querySelector('#ws').scrollWidth} : null; })()")
    check(f"on a phone the table scrolls inside its own box ({m})", m and m["tab"] > m["box"] and m["page"] <= m["vw"] + 1 and m["ws"] <= m["vw"] + 1)
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
