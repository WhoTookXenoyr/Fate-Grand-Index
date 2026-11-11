import os
# 0.54.0-beta: a skill effect written by hand is read from its words and counted, and the damage block under a skill
# shows the whole deck. The same custom Caster as test_46; every number is worked out again here from the formula.
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
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def K(pg): pg.wait_for_timeout(450); return pg.evaluate(WSK)["k"]
def go(pg, i): pg.click(f".ws-rail [data-i='{i}']"); pg.wait_for_timeout(250)
def add_fx(pg, e):
    pg.click('[data-ws="fx-add"][data-w="sk"]'); pg.wait_for_timeout(200); pg.click(f".ws-pal [data-ws='fx-pick'][data-e='{e}']"); pg.wait_for_timeout(250)
CARD = {"Buster": 1.5, "Arts": 1.0, "Quick": 0.8}
TERR = {"EX": 12, "A++": 11.5, "A+": 11, "A": 10, "A-": 9.5, "B++": 9.5, "B+": 9, "B": 8, "B-": 7.5, "C++": 7.5, "C+": 7, "C": 6, "C-": 5.5, "D++": 5.5, "D+": 5, "D": 4, "D-": 3.5, "E++": 3.5, "E+": 3, "E": 2, "E-": 1}
def table(pg):
    return pg.evaluate("""(() => { const o = {}; document.querySelectorAll('.ws-dmg-t tbody tr').forEach((tr) => { o[tr.dataset.k] = Array.from(tr.querySelectorAll('td')).map((td) => {
      const n = (s) => Number(String(s).replace(/[^0-9]/g, '')); if (td.classList.contains('none')) return null; if (td.classList.contains('same')) return [n(td.textContent), n(td.textContent)];
      return [n(td.querySelector('.was').textContent), n(td.querySelector('b').textContent)]; }); }); return o; })()""")
def deck(pg):
    return pg.evaluate("""Array.from(document.querySelectorAll('.ws-deck .ws-dk')).map((li) => ({name: li.querySelector('.ws-dk-card b').textContent, hit: li.classList.contains('hit'),
      nums: (li.querySelector('.ws-dk-num').textContent.match(/[\\d,]+(?=\\s|$)/g) || []).map((x) => Number(x.replace(/,/g, ''))), buffs: Array.from(li.querySelectorAll('.ws-dk-buffs i')).map((i) => i.textContent)}))""")
def near(a, b): return a is not None and abs(a - b) <= 1
READ = "(t, o) => window.__fgiSkillRead(t, o).map((x) => ({k: x.k, card: x.card || '', v: x.v, v1: x.v1, v10: x.v10, src: x.src || '', label: x.label, notes: (x.notes || []).join('; '), others: !!x.others}))"
def read(pg, t, o=None): return pg.evaluate("([t, o]) => (" + READ + ")(t, o)", [t, o])
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)

    # ---------- the reader on its own ----------
    r = read(pg, "Grants 1 Waterside Battlefield Buster+")
    check(f"“Grants 1 Waterside Battlefield Buster+” is Buster up, an estimate at the usual 30% → 50% ({r})", len(r) == 1 and r[0]["k"] == "card" and r[0]["card"] == "Buster" and r[0]["src"] == "typical" and [r[0]["v1"], r[0]["v10"]] == [30, 50] and r[0]["v"] == 50)
    r = read(pg, "Grants 1 Waterside Battlefield Buster+", {"lv": 1})
    check("at skill level 1 the estimate is its Lv 1 number", r[0]["v"] == 30)
    r = read(pg, "Grants 1 Waterside Battlefield Buster+", {"v1": 12, "v10": 24, "u": "%"})
    check(f"with the Lv 1 → Lv 10 boxes filled, those are the number ({r[0]['v1']} → {r[0]['v10']}, {r[0]['src']})", r[0]["src"] == "values" and [r[0]["v1"], r[0]["v10"], r[0]["v"]] == [12, 24, 24])
    r = read(pg, "Grants 1 Waterside Battlefield Buster+ 35%")
    check("a number in the words wins over both", r[0]["src"] == "text" and r[0]["v"] == 35)
    cases = [("Increase your Buster Card effectiveness by 30% (3 turns)", [("card", "Buster", 30)]), ("ATK +20% & NP damage up 15% for 3 turns", [("atk", "", 20), ("np", "", 15)]),
             ("Buster and Arts up 20% → 40%", [("card", "Buster", 40), ("card", "Arts", 40)]), ("Deal 50% more damage against [Dragon] enemies", [("pow", "", 50)]),
             ("+500 damage each hit", [("dp", "", 500)]), ("Reduce enemy DEF by 20%", [("def", "", 20)]), ("When on a Burning field, boosts own power by 25%", [("dmg", "", 25)]),
             ("Lower all enemies' Buster resistance by 20%", [("res", "Buster", 20)]), ("Damage Plus 1000", [("dp", "", 1000)]), ("Special attack vs Divine 50%", [("pow", "", 50)]),
             ("Arts performance up by 10-20%", [("card", "Arts", 20)]), ("Quick+", [("card", "Quick", 50)]), ("boosts critical strength by 40%", [("crit", "", 40)])]
    bad = []
    for t, want in cases:
        got = [(x["k"], x["card"], x["v"]) for x in read(pg, t) if x["k"] not in ("util", "none")]
        if got != want: bad.append((t, got))
    check(f"thirteen ways of writing an effect are read as what they say ({bad})", not bad)
    util = {t: [x["k"] for x in read(pg, t)] for t in ["Increases NP Gain by 30%", "Gain 20 stars", "Grants Invincible for 1 turn", "Charge NP by 20%"]}
    check(f"words that don't touch damage are named, not counted ({util})", all(v == ["util"] for v in util.values()))
    check("words with nothing in them say so, and nothing is made up", [x["k"] for x in read(pg, "Become very cool")] == ["none"])
    r = read(pg, "Increase ATK for other allies by 20%")
    check("an effect for the other allies isn't this servant's", r[0]["others"])
    r = read(pg, "70% chance to raise Arts performance")
    check(f"a chance is counted as if it works, and says so ({r[0]['notes']})", r[0]["k"] == "card" and "70%" in r[0]["notes"])
    r = read(pg, "Special attack vs Divine 50%")
    check(f"the trait is kept ({r[0]['label']})", "Divine" in r[0]["label"])

    # ---------- in the Workshop: the same Caster as test_46 ----------
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="blank"]'); pg.wait_for_timeout(200)
    pg.click('[data-ws="blank-cls"][data-v="Caster"]'); pg.click('[data-ws="blank-go"][data-r="5"]'); pg.wait_for_timeout(400)
    typ(pg, "#ws-name", "Orielle of the Last Light")
    go(pg, 2); typ(pg, '[data-wk="atk.1"]', "11000"); pg.wait_for_timeout(300)
    go(pg, 3); pg.click('[data-ws="set"][data-p="np.card"][data-v="Arts"]'); pg.click('[data-ws="set"][data-p="np.tg"][data-v="AoE"]'); pg.wait_for_timeout(300)
    k = K(pg); DECK = k["deck"]
    terr = sum(TERR.get(str(x.get("rank", "")).upper(), 0) for x in k["ps"] if x["name"] == "Territory Creation")
    ATK, C = 11000, 0.9
    def card(c, card_up=0, atk=0, pow_=0, dp=0, crit=None, eff=1): return ATK * 0.23 * CARD[c] * (1 + ((terr if c == "Arts" else 0) + card_up) / 100) * C * (1 + atk / 100) * (1 + (pow_ + (crit or 0)) / 100) * (2 if crit is not None else 1) * eff + dp
    def np_(card_up=0, atk=0, npup=0, pow_=0, dp=0, eff=1): return ATK * 0.23 * 4.5 * (1 + (terr + card_up) / 100) * C * (1 + atk / 100) * (1 + (pow_ + npup) / 100) * eff + dp
    def extra(atk=0, pow_=0, dp=0, eff=1): return ATK * 0.23 * 2 * C * (1 + atk / 100) * (1 + pow_ / 100) * eff + dp
    go(pg, 5)
    add_fx(pg, "own")
    typ(pg, '[data-wk="sk.0.fx.0.txt"]', "Grants 1 Waterside Battlefield Buster+"); pg.wait_for_timeout(600)
    box = pg.locator(".ws-dmg").inner_text()
    check("nothing says it can't be counted", "can't be counted" not in box and "written by hand" not in box)
    line = pg.locator(".ws-read").first.inner_text()
    check(f"under the effect: what it was read as ({line})", "Buster up" in line and "30% → 50%" in line and "estimate" in line)
    used = pg.locator(".ws-dmg-used li").all_inner_texts()
    check(f"Counted: Buster up +50%, marked as an estimate with the number it took ({used})", len(used) == 1 and "Buster up" in used[0] and "+50%" in used[0] and "estimate" in used[0] and "30% → 50%" in used[0])
    T = table(pg); D = deck(pg)
    check(f"the table has every row: NP, a row for each kind of card in the deck, the Extra attack ({list(T)})", list(T) == ["np"] + [c for c in ["Buster", "Arts", "Quick"] if c[0] in DECK] + ["extra"])
    check(f"Buster cards: {T['Buster'][0]} against {card('Buster'):.0f} → {card('Buster', 50):.0f}; critical {T['Buster'][1]}", near(T["Buster"][0][0], card("Buster")) and near(T["Buster"][0][1], card("Buster", 50)) and near(T["Buster"][1][1], card("Buster", 50, crit=0)))
    check("Arts, Quick, the Arts NP and the Extra attack don't change, and are still shown", T["Arts"][0][0] == T["Arts"][0][1] and near(T["Arts"][0][0], card("Arts")) and T["np"][0][0] == T["np"][0][1] and near(T["np"][0][0], np_()) and near(T["extra"][0][0], extra()) and T["extra"][0][0] == T["extra"][0][1])
    names = [d["name"] for d in D]
    want = [{"Q": "Quick", "A": "Arts", "B": "Buster"}[l] for l in DECK] + ["Extra", "NP1"]
    check(f"the deck is shown card by card, then the Extra attack and the NP ({names})", names == want)
    bt = [d for d in D if d["name"] == "Buster"]
    check(f"each Buster card shows its numbers and what reaches it ({bt[0]})", all(d["hit"] and near(d["nums"][0], card("Buster")) and near(d["nums"][1], card("Buster", 50)) and d["buffs"] == ["Buster +50%"] for d in bt))
    check("the other cards say nothing reaches them", all(not d["hit"] and len(d["nums"]) >= 1 for d in D if d["name"] in ("Arts", "Quick", "Extra", "NP1")))

    # a number written in: no estimate any more
    typ(pg, '[data-wk="sk.0.fx.0.txt"]', "Grants 1 Waterside Battlefield Buster+ 25% and ATK up 20%"); pg.wait_for_timeout(600)
    used = pg.locator(".ws-dmg-used li").all_inner_texts(); T = table(pg); D = deck(pg)
    check(f"with numbers written, both parts are counted exactly ({used})", len(used) == 2 and not any("estimate" in u for u in used))
    check("Buster with both, the rest with the ATK up", near(T["Buster"][0][1], card("Buster", 25, 20)) and near(T["Arts"][0][1], card("Arts", 0, 20)) and near(T["np"][0][1], np_(0, 20)) and near(T["extra"][0][1], extra(20)))
    ar = [d for d in D if d["name"] == "Arts"][0]
    check(f"an Arts card lists the ATK up only ({ar['buffs']})", ar["buffs"] == ["ATK +20%"] and [d for d in D if d["name"] == "Buster"][0]["buffs"] == ["Buster +25%", "ATK +20%"])

    # the Lv 1 → Lv 10 boxes, at another skill level
    typ(pg, '[data-wk="sk.0.fx.0.txt"]', "Tide's Blessing: Arts+"); typ(pg, '[data-wk="sk.0.fx.0.v1"]', "10"); typ(pg, '[data-wk="sk.0.fx.0.v10"]', "30"); pg.wait_for_timeout(600)
    T = table(pg)
    check("the boxes' number is used at the skill's level (Lv 10: 30%)", near(T["Arts"][0][1], card("Arts", 30)) and near(T["np"][0][1], np_(30)))
    check("kept in the draft as written", K(pg)["sk"][0]["fx"][0]["txt"] == "Tide's Blessing: Arts+" and K(pg)["sk"][0]["fx"][0]["v10"] == 30)

    # words without a damage effect: named, with what to write
    typ(pg, '[data-wk="sk.0.fx.0.v1"]', ""); typ(pg, '[data-wk="sk.0.fx.0.v10"]', "")
    typ(pg, '[data-wk="sk.0.fx.0.txt"]', "Become very cool"); pg.wait_for_timeout(600)
    box = pg.locator(".ws-dmg").inner_text()
    check("words with no damage effect: the block says so and how to write one, and the deck is still there", "no damage effect found" in box and "Buster up 30%" in box and len(deck(pg)) == len(want) and "can't be counted" not in box)
    typ(pg, '[data-wk="sk.0.fx.0.txt"]', "Increases NP Gain by 30% and gain 10 stars"); pg.wait_for_timeout(600)
    box = pg.locator(".ws-dmg").inner_text()
    check("NP Gain and stars are named as having no hand in damage", "NP Gain" in box and "Critical Stars" in box and "without a hand in damage" in box)

    # ---------- all skills together ----------
    typ(pg, '[data-wk="sk.0.fx.0.txt"]', "Arts up 30%"); pg.wait_for_timeout(400)
    pg.click('.ws-sktabs [data-i="1"], [data-ws="sk"][data-i="1"]'); pg.wait_for_timeout(300)
    add_fx(pg, "atk"); pg.wait_for_timeout(400)
    fx2 = K(pg)["sk"][1]["fx"][0]; a2 = fx2["v"][1]
    one = table(pg)
    pg.click('[data-wsd="all"]'); pg.wait_for_timeout(300)
    both = table(pg); used = pg.locator(".ws-dmg-used li").all_inner_texts()
    check(f"This skill: the ATK up alone; All skills together: with the first skill's Arts up ({used})", near(one["Arts"][0][1], card("Arts", 0, a2)) and near(both["Arts"][0][1], card("Arts", 30, a2)) and near(both["np"][0][1], np_(30, a2)) and len(used) == 2 and used[0].startswith("S1") and used[1].startswith("S2"))
    pg.click('[data-wsd="one"]'); pg.wait_for_timeout(200)
    check("and back", near(table(pg)["Arts"][0][1], card("Arts", 0, a2)))
    b.close()
if errs: print("page errors:", errs[:3])
print(f"FAILED {len(fails)}: {fails} errors {errs[:2]}" if fails or errs else "all passed")
sys.exit(1 if fails or errs else 0)
