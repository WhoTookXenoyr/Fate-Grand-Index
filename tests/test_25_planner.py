import os
# 0.24.0: append skills, Servant Coins and the materials planner on the servant page. The numbers are checked against
# Atlas Academy's NA data (src/data/atlas_data.js) and a few known FGO costs: Skill 1->10 on a 5-star is 54.4M QP,
# Grails to Lv 100 on a 5-star are 9+10+11+12+13M QP, each Grail past Lv 100 is 15M QP and 30 coins, an append unlock 120
# coins. Also: what you have is shared with the Event calculator and goes into backups, Done takes the materials and
# can be undone, Compact keeps the planner under the top block, and a phone gets no sideways scroll.
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
EVK = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:event') || '{}')"

# the NA data, as the page has it
src = open(os.path.join(sp, "atlas_data.js"), encoding="utf-8").read()
def jsconst(name):
    m = re.search(r"^const " + name + r" = (.*);$", src, re.M); return json.loads(m.group(1))
ATLAS = {x["no"]: x for x in jsconst("ATLAS_S")}; MATS = jsconst("ATLAS_MATS"); APPENDS = jsconst("ATLAS_APPENDS")
ALTRIA = ATLAS[2]
def items_of(rows):
    out = {}
    for row in rows:
        for j in range(0, len(row) - 1, 2):
            m = MATS[row[j]]; out[m[1]] = out.get(m[1], 0) + row[j + 1]
    return out
def add(a, b):
    o = dict(a)
    for k, v in b.items(): o[k] = o.get(k, 0) + v
    return o

def sv(pg, sid): return next((x for x in pg.evaluate(LS)["servants"] if x["id"] == sid), None)
def table(pg):
    return {r[0]: int(r[1].replace(",", "")) for r in pg.evaluate("[...document.querySelectorAll('#dossier .pl-tb tbody tr')].map(tr => [tr.querySelector('.pl-it span').textContent, tr.children[1].textContent])")}
def qp_total(pg):
    t = pg.locator("#dossier .pl-tile", has_text="QP").first.inner_text()
    m = re.search(r"\(([\d,]+)\)", t); return int(m.group(1).replace(",", "")) if m else None
def tile(pg, word):
    loc = pg.locator("#dossier .pl-tile", has_text=word)
    return loc.first.inner_text() if loc.count() else ""
def open_planner(pg):
    pg.evaluate("(() => { const d = document.querySelector('#dossier details.pl'); if (d && !d.open) d.querySelector('summary').click(); })()"); pg.wait_for_timeout(250)
def pre(pg, k): pg.click(f'#dossier [data-action="pl-pre"][data-k="{k}"]'); pg.wait_for_timeout(450)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1360, "height": 900}, accept_downloads=True); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="artoria"]'); pg.wait_for_timeout(800)

    # ---------- Append skills ----------
    names = pg.evaluate("[...document.querySelectorAll('#dossier .ap-row .ap-n b')].map(e => e.textContent)")
    want = [APPENDS[i]["n"] for i in ALTRIA["ap"]]
    check(f"the servant page lists Artoria's five append skills from the NA data ({names})", names == want)
    check("all five start locked", pg.locator("#dossier .ap-row.locked").count() == 5)
    eff = pg.locator("#dossier .ap-row").nth(1).locator(".ap-eff").inner_text()
    check(f"a locked append shows its Lv 1 effect ({eff!r})", "10%" in eff and "Lv 1" in eff and "{{" not in eff)
    pg.click('#dossier [data-action="bump"][data-f="ap1"][data-d="1"]'); pg.wait_for_timeout(300)
    pg.click('#dossier [data-action="bump"][data-f="ap1"][data-d="1"]'); pg.wait_for_timeout(900)
    eff = pg.locator("#dossier .ap-row").nth(1).locator(".ap-eff").inner_text()
    check(f"+ twice unlocks append 2 and raises it to Lv 2: the effect follows ({eff!r}) and it's saved ({sv(pg, 'artoria').get('appends')})", "11%" in eff and sv(pg, "artoria").get("appends") == [0, 2, 0, 0, 0])
    pg.click('#dossier [data-action="bump"][data-f="ap1"][data-d="-1"]'); pg.wait_for_timeout(800)
    check("− lowers it again", sv(pg, "artoria").get("appends") == [0, 1, 0, 0, 0])
    pg.click('#dossier [data-action="bump"][data-f="ap1"][data-d="-1"]'); pg.wait_for_timeout(800)
    check("and − at Lv 1 locks it", sv(pg, "artoria").get("appends") == [0, 0, 0, 0, 0] and pg.locator("#dossier .ap-row.locked").count() == 5)
    ci = pg.locator("#dossier input[data-coins]"); ci.fill("85"); pg.wait_for_timeout(900)
    check(f"Servant Coins are saved on the servant ({sv(pg, 'artoria').get('coins')})", sv(pg, "artoria").get("coins") == 85)
    check("typing coins keeps the box focused", pg.evaluate("document.activeElement && document.activeElement.matches('input[data-coins]')"))

    # ---------- the planner: skills ----------
    open_planner(pg)
    pre(pg, "sk10")
    exp_items = items_of([ALTRIA["ms"][l - 1] for _ in range(3) for l in range(1, 10)])
    got = table(pg)
    check(f"Skills 10/10/10 (from 1/1/locked): every material matches the NA data ({len(got)} kinds)", got == exp_items)
    check(f"and costs 3 x 54.4M QP ({qp_total(pg)})", qp_total(pg) == 3 * 54_400_000 == 3 * sum(ALTRIA["qs"]))
    check("the plan is saved on the servant", sv(pg, "artoria").get("plan", {}).get("sk") == [10, 10, 10])
    # ---------- level: ascensions and Grails ----------
    pre(pg, "lv100")
    asc = items_of(ALTRIA["ma"][2:4])
    check(f"Lv 70 -> 100 adds the last two ascensions and five Grails (9+10+11+12+13M QP): {qp_total(pg)}", qp_total(pg) == 3 * 54_400_000 + 4_000_000 + 55_000_000 and table(pg) == add(exp_items, asc))
    gt = tile(pg, "Grail")
    check(f"the Grail tile says 5 ({gt.splitlines()[0] if gt else ''})", gt.startswith("5"))
    ex = tile(pg, "EXP")
    check(f"EXP to Lv 100 is worked out with Gold Embers ({' '.join(ex.split())})", "Gold Embers" in ex and "451" in ex)
    # the ascension at a cap you've already done
    pg.check("#dossier input[data-pl-asc]"); pg.wait_for_timeout(700)
    check(f"'Already ascended at Lv 70' takes that ascension out ({qp_total(pg)})", qp_total(pg) == 3 * 54_400_000 + 3_000_000 + 55_000_000 and sv(pg, "artoria").get("ascAt") == 70)
    pg.uncheck("#dossier input[data-pl-asc]"); pg.wait_for_timeout(700)
    # ---------- appends ----------
    pre(pg, "ap2")
    coins = tile(pg, "Servant Coins")
    check(f"Append 2 to 10 adds its unlock (120 coins: 85 have, 35 short = 1 copy) ({' '.join(coins.split())})", coins.startswith("120") and "35 short (1 copy)" in coins)
    full = add(add(exp_items, asc), items_of(ALTRIA["mp"]))
    check(f"and its materials and QP ({qp_total(pg)})", table(pg) == full and qp_total(pg) == 4 * 54_400_000 + 4_000_000 + 55_000_000)
    summ = pg.locator("#dossier details.pl > summary").inner_text()
    check(f"the planner's heading sums the plan up ({summ!r})", "Lv 70 → 100" in summ and "10/10/10" in summ)

    # ---------- what you have ----------
    inp = pg.locator('#dossier .pl-tb input[data-ev-have="6001"]')
    need = table(pg)["Gem of Saber"]
    inp.click(); inp.type("10"); pg.wait_for_timeout(500)
    short = pg.locator('#dossier [data-pl-short="6001"]').inner_text()
    check(f"typing what you have updates the shortfall ({need} need, 10 have: {short!r})", short == f"{need - 10:,} short")
    check("without redrawing the page (the box keeps focus)", pg.evaluate("document.activeElement && document.activeElement.dataset.evHave === '6001'"))
    check("it's the Event calculator's list (saved under its key)", pg.evaluate(EVK).get("have", {}).get("6001") == 10)
    pg.locator('#dossier input[data-ev-have="qp"]').fill("300000000"); pg.wait_for_timeout(500)
    check("a QP count over 7 digits is kept whole", pg.evaluate(EVK).get("have", {}).get("qp") == 300000000 and pg.locator('#dossier [data-pl-short="qp"]').inner_text() == "enough")
    pg.click("#dossier .pl-sum"); pg.wait_for_timeout(300); open_planner(pg)

    # ---------- every plan added up ----------
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(800)
    open_planner(pg); pre(pg, "lv120")
    cu = tile(pg, "Servant Coins")
    check(f"Cu Chulainn Alter Lv 100 -> 120: ten Grails at 15M QP and 30 coins each ({qp_total(pg)}, {' '.join(cu.split())[:40]})", qp_total(pg) == 150_000_000 and cu.startswith("300") and tile(pg, "Grail").startswith("10"))
    pg.click('#dossier [data-action="pl-view"][data-v="all"]'); pg.wait_for_timeout(600)
    note = pg.locator("#dossier .pl-note").inner_text()
    check(f"All plans adds both servants up ({note!r}, {qp_total(pg)})", "Artoria" in note and "Cu Chulainn Alter" in note and qp_total(pg) == 150_000_000 + 4 * 54_400_000 + 4_000_000 + 55_000_000)
    check("and names both as short of coins", "2" in tile(pg, "short of coins")[:3])
    pg.click('#dossier [data-action="pl-view"][data-v="one"]'); pg.wait_for_timeout(400)
    pg.click('#dossier [data-action="pl-clear"]'); pg.wait_for_timeout(700)
    check("Clear plan removes it", "plan" not in sv(pg, "cu-chulainn-alter"))

    # ---------- the Event calculator can count plans ----------
    # (its page needs an event; the option and its note are checked where they're made)
    check("the Event calculator offers 'your plans'", "your plans" in open(os.path.join(sp, "out", "Fate_Grand_Index.html"), encoding="utf-8").read())

    # ---------- Done, and Undo ----------
    pg.click('#list [data-id="artoria"]'); pg.wait_for_timeout(800); open_planner(pg)
    before = sv(pg, "artoria")
    pg.click('#dossier [data-action="pl-done"]'); pg.wait_for_timeout(900)
    a = sv(pg, "artoria"); have = pg.evaluate(EVK).get("have", {})
    check(f"Done sets Artoria to the plan (Lv {a.get('level')}, skills {a.get('skills')}, appends {a.get('appends')})", a.get("level") == 100 and a.get("skills") == [10, 10, 10] and a.get("appends") == [0, 10, 0, 0, 0] and "plan" not in a)
    check(f"and takes what it used out of what you have (gems {have.get('6001')}, QP {have.get('qp')}, coins {a.get('coins')})", "6001" not in have and have.get("qp") == 300000000 - (4 * 54_400_000 + 4_000_000 + 55_000_000) and "coins" not in a)
    check("HP and ATK follow the new level", a.get("atk") != before.get("atk"))
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(900)
    a = sv(pg, "artoria"); have = pg.evaluate(EVK).get("have", {})
    check(f"Undo puts the servant back (Lv {a.get('level')}, skills {a.get('skills')}, coins {a.get('coins')}, plan {bool(a.get('plan'))})", a.get("level") == 70 and a.get("skills") == [1, 1, "Locked"] and a.get("coins") == 85 and a.get("plan") and a.get("atk") == before.get("atk"))
    check("and your materials", have.get("6001") == 10 and have.get("qp") == 300000000)

    # ---------- backups ----------
    pg.evaluate("window.scrollTo(0, 0)"); pg.click("#btn-export")
    with pg.expect_download() as dl: pg.click('#export-menu [data-action="export"]')
    bk = json.load(open(dl.value.path(), encoding="utf-8"))
    ar = next(x for x in bk["servants"] if x["id"] == "artoria")
    check("a backup carries the plan, coins and appends on the servant", ar.get("plan") and ar.get("coins") == 85 and "appends" in ar)
    check("and what you have", bk.get("settings", {}).get("have", {}).get("6001") == 10)
    bk["settings"]["have"] = {"6001": 77, "6002": 5}
    path = os.path.join(sp, "_t25_backup.json"); json.dump(bk, open(path, "w"))
    pg.set_input_files("#f-import", path); pg.wait_for_timeout(500); pg.click('[data-action="import-go"]'); pg.wait_for_timeout(1500)
    have = pg.evaluate(EVK).get("have", {})
    check(f"importing it brings its counts in ({have.get('6001')}, {have.get('6002')}) and keeps the rest (QP {have.get('qp')})", have.get("6001") == 77 and have.get("6002") == 5 and have.get("qp") == 300000000)
    pg.click('[data-action="import-undo"]'); pg.wait_for_timeout(1200)
    have = pg.evaluate(EVK).get("have", {})
    check("Undo import puts the counts back", have.get("6001") == 10 and "6002" not in have)

    # ---------- Compact ----------
    pg.evaluate("localStorage.setItem('spirit-origin-list:v1:layout', 'compact')"); pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="artoria"]'); pg.wait_for_timeout(800)
    check("in Compact the planner comes right under the top block", pg.evaluate("(() => { const t = document.querySelector('#dossier .cmp-top'); return !!t && t.nextElementSibling && t.nextElementSibling.classList.contains('pl-sec'); })()"))
    check("and the append skills right after the skills", pg.evaluate("(() => { const s = document.querySelector('#dossier .skills'); const sec = s && s.closest('.d-sec'); return !!sec && sec.nextElementSibling && sec.nextElementSibling.classList.contains('ap-sec'); })()"))
    pg.evaluate("localStorage.setItem('spirit-origin-list:v1:layout', 'modern')")
    ctx.close()

    # ---------- a phone ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click('#list [data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(900)
    open_planner(pg); pre(pg, "sk10"); pre(pg, "lv120")
    pg.locator("#dossier .pl-tb").scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    wide = pg.evaluate("(() => { const d = document.querySelector('#dossier'); return [d.scrollWidth, d.clientWidth]; })()")
    check(f"on a phone the servant page with the planner doesn't scroll sideways ({wide})", wide[0] <= wide[1] + 1)
    rows = pg.evaluate("[...document.querySelectorAll('#dossier .ap-row')].map(r => { const a = r.getBoundingClientRect(), s = r.querySelector('.ap-step').getBoundingClientRect(); return s.right <= a.right + 1 && s.left >= a.left; })")
    check("the append steppers fit in their rows", len(rows) == 5 and all(rows))
    ctx.close()
    b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
