import os
# 0.59.0: two rankings (Noyr, 27 Nov 2026). Raised (the default) is how far each servant is raised against their own
# ceiling: skills 33, level and grails 20, NP level 15, Fou 12, appends 10, Bond 10, so rarity and class don't count.
# Power is how strong they are: ATK and HP against the best of their class at Lv 120 with full Fou (45), skills 25, the
# NP's strength at its level 20 (NP1 is 60% of NP5), appends 10. Each has its own tier cut-offs and its own rank arrows.
import sys, re, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
KEY = "spirit-origin-list:v1"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
AD = open(f"{sp}/atlas_data.js", encoding="utf-8").read()
ATL = json.loads(re.search(r"^const ATLAS_S = (.*?);?$", AD, re.M).group(1))
CUR = json.loads(re.search(r"^const ATLAS_CURVES = (.*?);?$", AD, re.M).group(1))
def stat_at(x, lv, k):
    c = CUR[str(x["gc"])]; b, m = x[k][0], x[k][1]
    return b + (m - b) * c[lv - 1] // 1000
def best(cls):
    xs = [x for x in ATL if x.get("gc") and x.get("atk") and x.get("hp") and x["c"] == cls]
    return max(stat_at(x, 120, "atk") for x in xs) + 2000, max(stat_at(x, 120, "hp") for x in xs) + 2000
ARASH = next(x for x in ATL if x["n"] == "Arash"); ALTRIA = next(x for x in ATL if x["n"] == "Altria Pendragon")
def sv(id, x, lv, sk, np, fou, bond, ap):
    return {"id": id, "name": x["n"], "cls": x["c"], "rarity": x["r"], "level": lv, "skills": sk, "npLevel": np, "fouAtk": fou, "fouHp": fou,
            "bond": bond, "appends": ap, "atk": stat_at(x, lv, "atk"), "hp": stat_at(x, lv, "hp"), "atlas": x["no"]}
GOOD = dict(sk=[10, 10, 10], np=1, fou=1000, bond=10, ap=[0, 10, 0, 0, 0])
MAX = dict(sk=[10, 10, 10], np=5, fou=2000, bond=15, ap=[10] * 5)
ROSTER = [sv("arash", ARASH, ARASH["lv"], **GOOD), sv("altria", ALTRIA, ALTRIA["lv"], **GOOD),
          sv("arash-max", ARASH, 120, **MAX), sv("altria-max", ALTRIA, 120, **MAX),
          sv("altria-mid", ALTRIA, 100, sk=[10, 9, 5], np=2, fou=1500, bond=12, ap=[0, 10, 10, 0, 0]),
          sv("arash-ap", ARASH, 120, sk=[10, 10, 10], np=5, fou=2000, bond=15, ap=[10, 10, 9, 10, 10])]
for i, s in enumerate(ROSTER): s["order"] = i
def rows(pg):
    return {r[0]: (r[1], float(r[2])) for r in pg.evaluate("Array.from(document.querySelectorAll('#ranking .rank-row')).map((r) => [r.querySelector('.rk-name').dataset.id, r.querySelector('.rk-parts').textContent, r.querySelector('.rk-score').textContent])")}
def parts(t): return {k: float(v) for k, v in re.findall(r"(Stats|Skills|Level|NP|Fou|Appends|Bond) ([\d.]+)", t)}
def power_stats(x, lv, fou):
    b = best(x["c"]); a, h = stat_at(x, lv, "atk") + fou, stat_at(x, lv, "hp") + fou
    return (min(1, a / b[0]) * 0.7 + min(1, h / b[1]) * 0.3) * 45

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1360, "height": 1000}); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT)
    pg.route("https://**", lambda r: r.abort())
    # the test roster, set once before the page's own scripts run (later loads keep what the page saved); an old-style rank
    # order (one map, from before 0.59.0) is left unread
    data = json.dumps({"servants": ROSTER, "parties": [], "guests": []})
    pg.add_init_script("if (!sessionStorage.getItem('t59')) { sessionStorage.setItem('t59', '1'); localStorage.setItem('%s', %s); localStorage.setItem('%s:rankBase', %s); localStorage.setItem('%s:rankView', 'list'); }"
                       % (KEY, json.dumps(data), KEY, json.dumps(json.dumps({"arash": 5, "altria": 1})), KEY))
    pg.goto(SEEDED + "#ranking"); pg.wait_for_selector("#ranking .rank-row", timeout=20000); pg.wait_for_timeout(500)

    # ---------- Raised, the default ----------
    note = pg.locator("#rank-note").inner_text()
    w = [int(x) for x in re.findall(r"\((\d+)\)", note)]
    check(f"Raised is the default, with its note: six parts adding up to 100 ({w})", pg.get_attribute('[data-action="rank-mode"][data-v="raised"]', "aria-pressed") == "true"
          and w == [33, 20, 15, 12, 10, 10] and "rarity and class don't count" in note and "Rarity" not in note)
    R = rows(pg)
    check(f"six servants ranked, each in six parts ({R['arash'][0]})", len(R) == 6 and all(set(parts(t)) == {"Skills", "Level", "NP", "Fou", "Appends", "Bond"} for t, _ in R.values()))
    check("each score is its parts added up", all(abs(sum(parts(t).values()) - v) < 0.11 for t, v in R.values()))
    check(f"raised the same way, a ★1 and a ★5 score the same: 33 + 10 + 0 + 6 + 2 + 4.5 = 55.5 ({R['arash'][1]}, {R['altria'][1]})", R["arash"][1] == 55.5 and R["altria"][1] == 55.5)
    check(f"fully raised, both are 100 ({R['arash-max'][1]}, {R['altria-max'][1]})", R["arash-max"][1] == 100.0 and R["altria-max"][1] == 100.0)
    m = parts(R["altria-mid"][0])
    # Lv 100 from a cap of 90: 10 + 6; skills 10/9/5: (1 + 0.74 + 0.32) / 3 × 33; NP2: 7.5; Fou 1500 of 2000: 9; appends 20 of 50: 4; Bond 12: 6.5
    want = {"Level": 16.0, "Skills": round((1 + 0.74 + 0.32) / 3 * 33, 1), "NP": 7.5, "Fou": 9.0, "Appends": 4.0, "Bond": 6.5}
    check(f"each part works out as the note says ({m} vs {want})", all(abs(m[k] - want[k]) < 0.06 for k in want))
    check("the old single rank order wasn't read: no arrows from it", pg.locator("#ranking .mv.up, #ranking .mv.down").count() == 0 and pg.locator("#ranking .mv").count() == 6)
    base = json.loads(pg.evaluate(f"localStorage.getItem('{KEY}:rankBase')"))
    check(f"the Raised order is kept on its own ({base})", base.get("v") == 2 and base.get("raised", {}).get("arash-max") in (1, 2) and "power" not in base)
    # the next upgrade can be an append now
    roi = pg.locator('#ranking .rank-row:has([data-id="arash-max"]) .rk-roi').count()
    mid = pg.locator('#ranking .rank-row:has([data-id="altria-mid"]) .rk-roi').inner_text()
    check(f"a fully raised servant has no next step; others can ({roi}, {mid!r})", roi == 0 and "Skill 2: Lv 9 → 10" in mid)
    ap = pg.locator('#ranking .rank-row:has([data-id="arash-ap"]) .rk-roi').inner_text()
    check(f"with skills and level maxed, an append is the next step ({ap!r})", "Append 3: Lv 9 → 10" in ap)
    pg.click('[data-action="rank-view"][data-v="tiers"]'); pg.wait_for_timeout(300)
    tn = pg.locator(".tier-note").inner_text()
    tiers = pg.evaluate("Object.fromEntries(Array.from(document.querySelectorAll('.tier-card')).map((c) => [c.dataset.id, c.closest('[data-tier-drop]').dataset.tierDrop]))")
    check(f"Raised tier cut-offs ({tn[-75:]})", "Raised score ranges: EX 75+, S 60–75, A 45–60, B 30–45, C under 30" in tn and tiers["arash"] == "A" and tiers["arash-max"] == "SS")

    # ---------- Power ----------
    pg.click('[data-action="rank-mode"][data-v="power"]'); pg.wait_for_timeout(300)
    tn = pg.locator(".tier-note").inner_text()
    check(f"Power tier cut-offs ({tn[-75:]})", "Power score ranges: EX 80+, S 68–80, A 56–68, B 44–56, C under 44" in tn)
    pg.click('[data-action="rank-view"][data-v="list"]'); pg.wait_for_timeout(300)
    note = pg.locator("#rank-note").inner_text()
    check(f"Power's note ({note[:80]!r})", pg.get_attribute('[data-action="rank-mode"][data-v="power"]', "aria-pressed") == "true" and "best of the same class" in note and "Rarity counts here" in note)
    R = rows(pg)
    check(f"each in four parts: stats, skills, NP, appends ({R['arash'][0]})", all(set(parts(t)) == {"Stats", "Skills", "NP", "Appends"} for t, _ in R.values()) and all(abs(sum(parts(t).values()) - v) < 0.11 for t, v in R.values()))
    for id, x, lv, fou in (("arash", ARASH, ARASH["lv"], 1000), ("altria", ALTRIA, ALTRIA["lv"], 1000), ("altria-max", ALTRIA, 120, 2000), ("arash-max", ARASH, 120, 2000)):
        got, want = parts(R[id][0])["Stats"], power_stats(x, lv, fou)
        check(f"{id}: stats against the best {x['c']} at Lv 120 with full Fou ({got} vs {want:.2f})", abs(got - want) < 0.06)
    check(f"NP1 is 60% of the NP's 20, NP5 all of it ({parts(R['arash'][0])['NP']}, {parts(R['arash-max'][0])['NP']})", parts(R["arash"][0])["NP"] == 12.0 and parts(R["arash-max"][0])["NP"] == 20.0)
    check(f"here rarity counts: Altria above Arash, raised the same ({R['altria'][1]} > {R['arash'][1]})", R["altria"][1] > R["arash"][1] + 5)
    check(f"and nobody is stuck at 100 ({R['altria-max'][1]}, {R['arash-max'][1]})", R["altria-max"][1] < 100 and R["arash-max"][1] < R["altria-max"][1])
    base = json.loads(pg.evaluate(f"localStorage.getItem('{KEY}:rankBase')"))
    check("Power keeps its own order, next to Raised's", "power" in base and "raised" in base)
    pg.reload(); pg.wait_for_selector("#ranking .rank-row", timeout=20000); pg.wait_for_timeout(400)
    check("Power stays picked after a reload", pg.get_attribute('[data-action="rank-mode"][data-v="power"]', "aria-pressed") == "true" and pg.evaluate(f"localStorage.getItem('{KEY}:rankMode')") == "power")
    # the servant page says which ranking its rank is from
    pg.click('#ranking [data-action="goto"][data-id="altria"]'); pg.wait_for_timeout(600)
    chip = pg.locator("#dossier .rank-chip").inner_text()
    check(f"the servant page's rank says Power ({chip!r})", chip.startswith("Rank #") and "Power" in chip)
    # Versus shows both
    pg.evaluate("location.hash = '#versus'"); pg.wait_for_timeout(800)
    vs = pg.locator("#view-versus").inner_text() if pg.locator("#view-versus").count() else pg.locator("body").inner_text()
    check("Versus compares both scores", "Raised" in vs and "Power" in vs)
    # back to Raised
    pg.goto(SEEDED + "#ranking"); pg.wait_for_selector("#ranking .rank-row", timeout=20000)
    pg.click('[data-action="rank-mode"][data-v="raised"]'); pg.wait_for_timeout(300)
    check("Raised again: the setting is cleared", pg.evaluate(f"localStorage.getItem('{KEY}:rankMode')") is None and rows(pg)["arash"][1] == 55.5)
    pg.screenshot(path=f"{sp}/out/v59-ranking.png")
    check(f"no page errors ({errs[:2]})", not errs)
    b.close()

print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
sys.exit(1 if fails or errs else 0)
