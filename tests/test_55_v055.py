import os
# 0.55.0-beta: Class Score (68-class-score.js). The game's nine class boards from Atlas Academy's data, drawn as the
# game lays them out; signs open along the game's paths (from the two start signs, through locks and empty squares);
# what a board adds (worked out here from the data too) counts in the NP calculator and the Battle simulator for every
# servant of its classes, and can be turned off. What it costs, Undo, kept and synced under its own key; the roster
# never changes. Atlas Academy is stood in for.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1')"
KEY = "spirit-origin-list:v1"
CSK = KEY + ":classscore"
CB = json.loads(re.search(r"^const ATLAS_CB = (.*?);?$", open(f"{sp}/atlas_data.js", encoding="utf-8").read(), re.M).group(1))
BOARD = {b["id"]: b for b in CB["boards"]}
SQ = lambda bid: {q[0]: q for q in BOARD[bid]["sq"]}
CS = "window.__fgiClassScore"

def expect(bid, opened):
    """What a board adds, from the data: per (buff, card), the sum over its passives of the value at their level."""
    lv, out = {}, {}
    for q in BOARD[bid]["sq"]:
        if q[3] == "p" and q[0] in opened: lv[q[4]] = lv.get(q[4], 0) + 1
    for ref, n in lv.items():
        sk = CB["sk"][str(ref)]; v = sk["v"][min(n, len(sk["v"])) - 1]
        out[(sk["b"], sk["c"])] = round(out.get((sk["b"], sk["c"]), 0) + v, 2)
    return out
def cost(bid, ids):
    t = {}; s = SQ(bid)
    for i in ids:
        for c in s[i][6]: t[c[0]] = t.get(c[0], 0) + c[1]
    return t

# ---------- the data ----------
check(f"nine boards ({[b['n'] for b in CB['boards']]})", [b["n"] for b in CB["boards"]] == ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker", "Extra I", "Extra II"])
check("Extra I is Shielder, Ruler, Avenger and Moon Cancer; Extra II Alter Ego, Foreigner, Pretender and Beast",
      BOARD[8]["cls"] == ["Shielder", "Ruler", "Avenger", "Moon Cancer"] and BOARD[9]["cls"] == ["Alter Ego", "Foreigner", "Pretender", "Beast"])
check("each has 62 signs (two start signs), 10 locks and lines joining them",
      all(sum(q[3] in "pc" for q in b["sq"]) == 62 and sum(q[3] == "l" for q in b["sq"]) == 10 and sum(q[7] for q in b["sq"]) == 2 and len(b["ln"]) >= len(b["sq"]) - 2 for b in CB["boards"]))
check("every passive grows level by level, and every sign and lock has a cost (QP, Sand of Starlight, Torches)",
      all(sk["v"] == sorted(sk["v"]) and sk["v"][0] > 0 for sk in CB["sk"].values()) and all(q[6] for b in CB["boards"] for q in b["sq"] if q[3] != "b")
      and any(c[0] == 51 for b in CB["boards"] for q in b["sq"] if q[3] == "l" for c in q[6]))

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#classscore"); pg.wait_for_timeout(1800)
    roster = json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True)

    # ---------- the page ----------
    check("Class Score is a page of its own, in the sidebar before Past Chaldea", pg.locator("#tab-classscore").get_attribute("aria-selected") == "true"
          and pg.evaluate("[...document.querySelectorAll('.tabs .tab')].map((t) => t.dataset.tab).slice(-2).join()") == "classscore,past")
    check("the nine boards to pick from, Saber first", pg.locator(".csx-tab").count() == 9 and pg.locator(".csx-tab.on .csx-tn").inner_text() == "Saber")
    n = pg.locator(".csx-sq").count()
    check(f"Saber's board: every sign and lock on the map ({n}), the empty squares as dots, the lines between", n == 72 and pg.locator(".csx-dot").count() == sum(q[3] == "b" for q in BOARD[1]["sq"]) and pg.locator(".csx-lines line").count() == len(BOARD[1]["ln"]))
    starts = [q[0] for q in BOARD[1]["sq"] if q[7]]
    can = sorted(int(x) for x in pg.evaluate("[...document.querySelectorAll('.csx-sq.can')].map((b) => b.dataset.sq)"))
    check(f"to begin with, only the two start signs can be opened ({can})", can == sorted(starts))
    s = SQ(1); far = [q[0] for q in BOARD[1]["sq"] if q[3] == "p"][-1]
    check("a sign further on can't be opened yet", pg.evaluate(f"{CS}.can(1, {far})") is False)

    # ---------- opening the way ----------
    pg.locator(f'.csx-sq[data-sq="{far}"]').click(); pg.wait_for_timeout(250)
    path = pg.evaluate(f"{CS}.path(1, {far})")
    txt = pg.locator(".csx-picked").inner_text()
    check(f"picking it says what it does and what the way there costs ({len(path)} squares)", "Closed" in txt and "The way here costs" in txt and f"Open the way here ({len(path)} squares)" in txt and path[-1] == far and path[0] in starts)
    want = cost(1, path)
    shown = pg.evaluate("[...document.querySelectorAll('.csx-picked .csx-cost li')].map((l) => [l.querySelector('span').textContent, l.querySelector('b').textContent])")
    names = {str(k): v[0] for k, v in CB["items"].items()}
    check(f"the cost is the sum of the squares on the way ({shown[:3]})", len(shown) == len(want) and shown[1] == [names["50"], f"{want[50]:,}"] and shown[0][0] == "QP")
    pg.click('[data-action="csx-path"]'); pg.wait_for_timeout(300)
    opened = set(pg.evaluate(f"{CS}.open(1)"))
    check(f"Open the way opens every square on it, with Undo ({pg.locator('#toast').inner_text()!r})", opened == set(path) and "Undo" in pg.locator("#toast").inner_text())
    check("the lines between open squares turn gold", pg.locator(".csx-lines line.on").count() >= len(path) - 1)
    exp = expect(1, opened)
    mods = pg.evaluate(f"{CS}.mods('Saber')")
    got = {}
    for c in "BAQE":
        if mods["card"][c]: got[("card", c)] = mods["card"][c]
    for c in "BAQ":
        if mods["crit"][c]: got[("crit", c)] = mods["crit"][c]
    want2 = {}
    for (bt, c), v in exp.items():
        k = ("card", c) if bt in ("upCommandatk", "upCommandall") else ("crit", c) if bt == "upCriticaldamage" and c else None
        if k: want2[k] = round(want2.get(k, 0) + v, 2)
    check(f"what it adds matches the data ({got})", got == want2 and mods["star"] == exp.get(("upCriticalpoint", ""), 0) and mods["np"] == exp.get(("upNpdamage", ""), 0))
    fx = pg.locator(".csx-fx li").all_inner_texts()
    check(f"the board says so, one line each ({fx})", len(fx) == len(exp) + (1 if any(s[i][3] == "c" for i in opened) else 0) and all(re.search(r"\+\d", t) for t in fx))

    # ---------- closing, Undo ----------
    mid = path[len(path) // 2]
    pg.locator(f'.csx-sq[data-sq="{mid}"]').click(); pg.wait_for_timeout(200)
    t = pg.locator(".csx-picked").inner_text()
    check(f"an open sign in the middle says what closing it takes with it ({t.splitlines()[-1]!r})", "Close it (and" in t)
    pg.click('[data-action="csx-close"]'); pg.wait_for_timeout(250)
    left = set(pg.evaluate(f"{CS}.open(1)"))
    check(f"closing it closes the squares past it ({len(opened)} → {len(left)})", mid not in left and far not in left and left < opened)
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(250)
    check("Undo puts them back", set(pg.evaluate(f"{CS}.open(1)")) == opened)

    # ---------- the calculators ----------
    mu = pg.evaluate(f"{CS}.npcAuto('miyamoto-musashi')")
    check(f"the NP calculator counts it for a Saber, and says where it came from ({mu['card']}, {mu['from']})", mu["card"]["Arts"] >= got.get(("card", "A"), 0) and any(x.startswith("Class Score") for x in mu["from"]))
    ca = pg.evaluate(f"{CS}.npcAuto('cu-chulainn-alter')")
    check("not for a Berserker (that's another board)", not any(x.startswith("Class Score") for x in ca["from"]))
    t = pg.evaluate(f"{CS}.battle('miyamoto-musashi')")
    check(f"the Battle simulator's Musashi fights with it ({t.get('cs')})", t.get("cs") and t["cs"]["card"]["A"] == got.get(("card", "A"), 0) and t["cs"]["star"] == mods["star"])
    # (its star drop set aside here, so both fights get the same stars and the same criticals)
    dmg = pg.evaluate("""() => { const B = window.__fgiBattle, me = window.__fgiClassScore.battle('miyamoto-musashi'), plain = Object.assign({}, me, {cs: null});
      me.cs = Object.assign({}, me.cs, {star: 0});
      const foe = () => [[B.made({cls: 'Rider', name: 'Pillow', hp: 900000000, atk: 0})]];
      const run = (t) => { const ev = B.run({party: [t], waves: foe()}, 4242).events.filter((e) => e.t === 'card' && e.card === 'A');
        return [ev.filter((e) => !e.crit).reduce((a, e) => a + e.dmg, 0), ev.filter((e) => e.crit).reduce((a, e) => a + e.dmg, 0)]; };
      return [run(plain), run(me)]; }""")
    check(f"the same fight's Arts cards hit harder with it, criticals more so ({dmg})", dmg[0][0] > 0 and dmg[1][0] > dmg[0][0] and (dmg[0][1] == 0 or dmg[1][1] / dmg[0][1] > dmg[1][0] / dmg[0][0]))
    pg.uncheck("[data-csx-on]"); pg.wait_for_timeout(200)
    mu2 = pg.evaluate(f"{CS}.npcAuto('miyamoto-musashi')")
    check("\"Count Class Score\" off: the calculators leave it out", not any(x.startswith("Class Score") for x in mu2["from"]) and not pg.evaluate(f"{CS}.battle('miyamoto-musashi')").get("cs"))
    pg.check("[data-csx-on]"); pg.wait_for_timeout(200)

    # ---------- the other boards ----------
    pg.click('.csx-tab[data-b="8"]'); pg.wait_for_timeout(300)
    check("Extra I's board says whose it is", "for Shielder, Ruler, Avenger and Moon Cancer" in pg.locator(".csx-bh h3").inner_text() and pg.locator(".csx-sq").count() == sum(q[3] != "b" for q in BOARD[8]["sq"]))
    pg.click('[data-action="csx-all"]'); pg.wait_for_timeout(300)
    allopen = pg.evaluate(f"{CS}.open(8)")
    check(f"Open every square opens all 62 signs and 10 locks ({len(allopen)})", len(allopen) == 72 and "62</b> of 62" in pg.locator(".csx-count").inner_html())
    m = pg.evaluate(f"{CS}.mods('Avenger')")
    full = expect(8, set(allopen))
    check(f"the whole board, for an Avenger ({m['card']}, NP {m['np']})", m["np"] == full.get(("upNpdamage", ""), 0) and m["np"] > 0 and m["card"]["B"] > 0 and m["card"]["E"] > 0)
    check("the Extra I tab shows it's full", "62/62" in pg.locator('.csx-tab[data-b="8"]').inner_text() and pg.locator('.csx-tab[data-b="8"].full').count() == 1)
    spent = pg.evaluate(f"{CS}.cost(8, {CS}.open(8))")
    check(f"what it all cost: the sum over the board ({spent[:2]})", dict((a, n) for a, n in spent) == cost(8, allopen))

    # ---------- kept ----------
    pg.reload(); pg.wait_for_timeout(1800)
    st = pg.evaluate(f"JSON.parse(localStorage.getItem('{CSK}'))")
    check("kept under its own key, the board you were on too", st["sel"] == 8 and sorted(st["b"]["1"]) == sorted(opened) and len(st["b"]["8"]) == 72 and pg.locator(".csx-tab.on .csx-tn").inner_text() == "Extra I")
    check("nothing on the roster changed", json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True) == roster)
    # keyboard: a sign is a button; Enter picks it
    pg.locator(".csx-sq").first.focus(); pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check("signs work from the keyboard", pg.locator(".csx-sq.sel").count() == 1 and pg.locator(".csx-picked").count() == 1)
    ctx.close()

    # ---------- a phone, dark ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, color_scheme="dark")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#classscore"); pg.wait_for_timeout(1800)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    wrap = pg.evaluate("(() => { const w = document.querySelector('.csx-map-wrap'); return [w.scrollWidth, w.clientWidth]; })()")
    check(f"phone: the page doesn't scroll sideways ({w}); the map does, inside its frame ({wrap})", w[0] <= w[1] + 1 and wrap[0] > wrap[1])
    box = pg.locator(".csx-sq").first.bounding_box()
    check(f"and its signs are big enough to tap ({box['width']:.0f}px)", box["width"] >= 26)
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
