import os
# 0.57.0-beta: Materials (69-materials.js). A page for how many of each material you have: every ascension, skill and
# append material NA's servants use, QP, Grails, Lore and Class Score's, sorted as the game does. It's the list the
# Planner and the Event page's calculator already used (evPref.have), so the Planner reads what's typed here; it counts
# what your plans (or every servant to skills 10 or 9) and the rest of Class Score need; Class Score shows what you have
# beside its costs and can take what a sign costs out of it. A synced copy from another device is read again before
# anything is saved over it. Atlas Academy is stood in for.
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
EVK = KEY + ":event"
AD = open(f"{sp}/atlas_data.js", encoding="utf-8").read()
MATS = json.loads(re.search(r"^const ATLAS_MATS = (.*?);?$", AD, re.M).group(1))
CB = json.loads(re.search(r"^const ATLAS_CB = (.*?);?$", AD, re.M).group(1))
BY = {m[0]: m for m in MATS}
HAVE = f"JSON.parse(localStorage.getItem('{EVK}') || '{{}}').have || {{}}"
NEEDS = "window.__fgiMaterials.needs()"

# ---------- the data ----------
check("every material has its tier (bronze, silver, gold, or a servant's own) and the game's order",
      all(len(m) == 5 and m[3] in ("b", "s", "g", "x") and isinstance(m[4], int) for m in MATS))
check("Gems are bronze, Magic Gems silver, Secret Gems gold; Pieces silver, Monuments and Lore gold",
      BY[6001][3] == "b" and BY[6101][3] == "s" and BY[6201][3] == "g" and BY[7001][3] == "s" and BY[7101][3] == "g" and BY[6999][3] == "g")
board_total = {}
for b in CB["boards"]:
    for q in b["sq"]:
        for c in q[6]: board_total[c[0]] = board_total.get(c[0], 0) + c[1]

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, color_scheme="dark")
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#materials"); pg.wait_for_timeout(1800)
    roster = json.dumps(pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants"), sort_keys=True)

    # ---------- the page ----------
    tabs = pg.evaluate("[...document.querySelectorAll('.tabs .tab')].map((t) => t.dataset.tab)")
    check(f"Materials is a page of its own, before Class Score ({tabs[-4:]})", pg.locator("#tab-materials").get_attribute("aria-selected") == "true" and tabs[-3:] == ["materials", "classscore", "past"])
    groups = pg.evaluate("window.__fgiMaterials.groups()")
    gid = {g["id"]: g for g in groups}
    check(f"grouped as the game sorts them ({[g['n'] for g in groups]})", [g["id"] for g in groups] == ["qp", "gems", "statues", "b", "s", "g", "c", "x"])
    check("QP, Holy Grails and Crystallized Lore first", gid["qp"]["items"] == ["qp", "7999", "6999"])
    check("Gems, Magic Gems and Secret Gems: a class to a column, Saber to Berserker", gid["gems"]["items"] == [str(i) for r in (6000, 6100, 6200) for i in range(r + 1, r + 8)])
    check("Pieces and Monuments the same", gid["statues"]["items"] == [str(i) for r in (7000, 7100) for i in range(r + 1, r + 8)])
    tiered = lambda t: [str(m[0]) for m in sorted(MATS, key=lambda m: m[4]) if m[3] == t and str(m[0]) not in gid["gems"]["items"] + gid["statues"]["items"] + gid["qp"]["items"]]
    check("bronze, silver and gold materials in the game's order", gid["b"]["items"] == tiered("b") and gid["s"]["items"] == tiered("s") and gid["g"]["items"] == tiered("g"))
    check(f"Class Score's own: Sand of Starlight and the three Torches ({gid['c']['items']})", sorted(gid["c"]["items"]) == ["50", "51", "52", "53"])
    every = [k for g in groups for k in g["items"]]
    check(f"every material NA's servants use is on it once ({len(every)})", len(every) == len(set(every)) and {str(m[0]) for m in MATS} <= set(every))
    shown = pg.evaluate("[...document.querySelectorAll('#materials [data-mk]')].map((c) => c.dataset.mk)")
    check(f"on the page: every one but the servants' own items nobody needs ({len(shown)})", set(shown) >= set(every) - set(gid["x"]["items"]) and pg.locator("#materials .mt-cell").count() == 35)

    # ---------- typing what you have ----------
    inp = pg.locator('#materials input[data-mat="6001"]'); inp.click(); inp.type("1234")
    have = pg.evaluate(HAVE)
    need = pg.evaluate(NEEDS).get("6001", 0)
    cell = pg.locator('#materials [data-mk="6001"] .mt-need').inner_text()
    check(f"typing saves it at once, in the list the Planner and the Event page read ({have.get('6001')})", have.get("6001") == 1234)
    check(f"its line follows as you type, without redrawing (need {need}: '{cell}')", ("enough" in cell if need <= 1234 else f"{need - 1234:,} short" in cell) and pg.evaluate("document.activeElement.dataset.mat") == "6001")
    pg.locator('#materials input[data-mat="qp"]').first.fill("2500000000"); pg.wait_for_timeout(50)
    pg.locator('#materials input[data-mat="6002"]').click(); pg.wait_for_timeout(50)
    check(f"leaving a box shows its number with commas ({pg.locator('#materials input[data-mat=qp]').first.input_value()}); QP keeps all ten digits",
          pg.locator('#materials input[data-mat="qp"]').first.input_value() == "2,500,000,000" and pg.evaluate(HAVE).get("qp") == 2500000000)
    pg.locator('#materials input[data-mat="6002"]').fill("0"); pg.wait_for_timeout(50)
    check("0 or nothing removes it", "6002" not in pg.evaluate(HAVE))

    # ---------- what's needed ----------
    pg.select_option("[data-mt-to]", "9"); pg.wait_for_timeout(200)
    n9 = pg.evaluate(NEEDS)
    pg.select_option("[data-mt-to]", "10"); pg.wait_for_timeout(200)
    n10 = pg.evaluate(NEEDS)
    check(f"every servant to skills 9 needs no Lore; to 10 does ({n9.get('6999', 0)}, {n10.get('6999', 0)}), and more of the rest",
          not n9.get("6999") and n10.get("6999", 0) > 0 and n10.get("qp", 0) > n9.get("qp", 0))
    pg.check("[data-mt-cs]"); pg.wait_for_timeout(200)
    ncs = pg.evaluate(NEEDS)
    check(f"ticking Class Score adds every board's rest: Sand of Starlight and Torches as in the data ({ncs.get('50')}, {ncs.get('51')})",
          ncs.get("50") == board_total.get(50) and ncs.get("51") == board_total.get(51) and ncs.get("qp", 0) == n10.get("qp", 0) + board_total.get(1, 0))
    st = pg.evaluate(f"JSON.parse(localStorage.getItem('{EVK}')).mat")
    check(f"the page's settings are kept with the list ({st})", st == {"to": 10, "cs": True, "show": "all"})
    pg.uncheck("[data-mt-cs]"); pg.wait_for_timeout(150)

    # a plan on a servant: exactly its skill materials
    sv = pg.evaluate("window.__fgiMaterials.planSkills10()")
    want = {}
    for v in sv["sk"]:
        for l in range(max(1, v), 10):
            row = sv["ms"][l - 1]
            for j in range(0, len(row) - 1, 2): want[str(MATS[row[j]][0])] = want.get(str(MATS[row[j]][0]), 0) + row[j + 1]
            want["qp"] = want.get("qp", 0) + sv["qs"][l - 1]
    pg.select_option("[data-mt-to]", "plan"); pg.wait_for_timeout(200)
    got = pg.evaluate(NEEDS)
    check(f"your plans: {sv['name']} to skills 10/10/10 from {sv['sk']} needs exactly its skill materials and QP ({len(want)} kinds)", got == want)
    pg.click('[data-action="mt-show"][data-v="short"]'); pg.wait_for_timeout(150)
    vis = pg.evaluate("[...document.querySelectorAll('#materials .mt-card:not([hidden])')].map((c) => c.dataset.mk)")
    check(f"Short shows only what you're short of ({len(vis)})", all(k in want and (pg.evaluate(HAVE).get(k, 0) < want[k]) for k in vis) and vis)
    pg.click('[data-action="mt-show"][data-v="all"]'); pg.wait_for_timeout(150)
    pg.fill("[data-mt-find]", "proof"); pg.wait_for_timeout(150)
    vis = pg.evaluate("[...document.querySelectorAll('#materials .mt-card:not([hidden])')].map((c) => c.dataset.mk)")
    check(f"Find: 'proof' leaves Proof of Hero ({vis}), and dims the gem tables", vis == ["6503"] and pg.locator("#materials .mt-cell[data-dim]").count() == 35)
    pg.fill("[data-mt-find]", ""); pg.wait_for_timeout(100)

    # ---------- the Planner reads it ----------
    pg.evaluate(f"document.querySelector('[data-action=\"tab\"][data-tab=\"servants\"]').click()"); pg.wait_for_timeout(300)
    pg.evaluate(f"document.querySelector('#list [data-id=\"{sv['id']}\"]').click()"); pg.wait_for_timeout(600)
    pv = pg.evaluate("(() => { const d = document.querySelector('#dossier details.pl'); if (d) d.open = true; const i = document.querySelector('#dossier input[data-ev-have=\"qp\"]'); return i ? i.value : null; })()")
    check(f"the servant's Planner shows the same QP ({pv})", pv == "2500000000")
    lk = pg.locator('#dossier .pl-foot [data-tab="materials"]')
    check("and links to the Materials page", lk.count() == 1)
    lk.click(); pg.wait_for_timeout(400)
    check("which opens it", pg.locator("#tab-materials").get_attribute("aria-selected") == "true" and pg.locator("#materials .mt-card").count() > 20)

    # ---------- Class Score: what you have, and taking a sign's cost ----------
    pg.evaluate("document.querySelector('[data-action=\"tab\"][data-tab=\"classscore\"]').click()"); pg.wait_for_timeout(500)
    start = pg.evaluate("window.__fgiClassScore.squares(1).filter((q) => q.start)[0].id")
    pg.evaluate(f"document.querySelector('.csx-sq[data-sq=\"{start}\"]').click()"); pg.wait_for_timeout(150)
    cost = {str(k): v for k, v in pg.evaluate(f"window.__fgiClassScore.cost(1, [{start}])")}
    rows = pg.evaluate("[...document.querySelectorAll('.csx-picked .csx-cost li')].map((l) => [l.querySelector('span').textContent, (l.querySelector('small') || {}).textContent, l.classList.contains('short')])")
    check(f"a sign's cost says what you have beside it, short or not ({rows})", rows[0][0] == "QP" and rows[0][1] == "have 2,500M" and not rows[0][2] and any(r[2] for r in rows[1:]))
    pg.evaluate("window.__fgiMaterials.put('50', 1000)")
    pg.check("[data-csx-spend]"); pg.wait_for_timeout(100)
    h0 = pg.evaluate(HAVE)
    pg.evaluate("document.querySelector('[data-action=\"csx-open\"]').click()"); pg.wait_for_timeout(200)
    h1 = pg.evaluate(HAVE)
    check(f"with 'Take what I open out of my materials' on, opening takes its QP and Sand of Starlight ({h0.get('qp')} → {h1.get('qp')}, {h0.get('50')} → {h1.get('50')}), and only what you'd filled in",
          h1.get("qp") == h0["qp"] - cost["1"] and h1.get("50") == 1000 - cost["50"] and all(k in h0 or k not in h1 for k in cost))
    toast = pg.locator("#toast").inner_text()
    pg.evaluate("document.querySelector('#toast .toast-btn').click()"); pg.wait_for_timeout(200)
    h2 = pg.evaluate(HAVE)
    check(f"the toast says so ('{toast}')", "out of your materials" in toast)
    check(f"Undo puts the materials back with the sign ({h2.get('qp')}, {h2.get('50')})", h2.get("qp") == h0["qp"] and h2.get("50") == 1000 and start not in pg.evaluate("window.__fgiClassScore.open(1)"))
    pg.uncheck("[data-csx-spend]"); pg.wait_for_timeout(100)
    pg.evaluate(f"document.querySelector('.csx-sq.sel[data-sq=\"{start}\"]') || document.querySelector('.csx-sq[data-sq=\"{start}\"]').click()"); pg.wait_for_timeout(100)
    pg.evaluate("document.querySelector('[data-action=\"csx-open\"]').click()"); pg.wait_for_timeout(200)
    check("with it off, opening leaves them as they are", pg.evaluate(HAVE) == h2)

    # ---------- a synced copy from another device ----------
    pg.evaluate("document.querySelector('[data-action=\"tab\"][data-tab=\"materials\"]').click()"); pg.wait_for_timeout(300)
    pg.evaluate(f"""(() => {{ const v = JSON.parse(localStorage.getItem('{EVK}')); v.have['6503'] = 77; window.__fgiMaterials.pull(JSON.stringify(v)); }})()"""); pg.wait_for_timeout(200)
    check("a change synced from another device shows at once", pg.locator('#materials input[data-mat="6503"]').input_value() == "77")
    pg.locator('#materials input[data-mat="6505"]').fill("5"); pg.wait_for_timeout(100)
    h = pg.evaluate(HAVE)
    check(f"and typing here afterwards keeps it ({h.get('6503')}, {h.get('6505')})", h.get("6503") == 77 and h.get("6505") == 5)
    # a backup carries the list
    check("backups carry it (settings.have)", "settings: {fonts: fontPrefs(), affinity: affOverrides(), tiers: tierOverrides(), have: evPref.have}" in open(f"{sp}/out/Fate_Grand_Index.html", encoding="utf-8").read())
    check("the roster isn't touched by any of it", json.dumps([{k: v for k, v in x.items() if k != "plan"} for x in pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants")], sort_keys=True)
          == json.dumps([{k: v for k, v in x.items() if k != "plan"} for x in json.loads(roster)], sort_keys=True))
    pg.screenshot(path=f"{sp}/../t57-materials.png")
    ctx.close()

    # ---------- a phone ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#materials"); pg.wait_for_timeout(1800)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    mx = pg.evaluate("(() => { const m = document.querySelector('#materials .mt-mx'), s = m.parentElement; return [s.scrollWidth, s.clientWidth, getComputedStyle(m).gridTemplateColumns.split(' ').length]; })()")
    h = pg.locator('#materials input[data-mat="6001"]').bounding_box()["height"]
    check(f"phone: no sideways scrolling ({w}); the gem table turns round to a class a row, three across, no scrolling ({mx})", w[0] <= w[1] + 1 and mx[0] <= mx[1] + 1 and mx[2] == 4)
    check(f"and the boxes are big enough to tap ({h:.0f}px)", h >= 40)
    pg.screenshot(path=f"{sp}/../t57-phone.png")
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
