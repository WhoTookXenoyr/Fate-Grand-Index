import os
# 0.24.0: speed with a big roster (tests/fixtures/roster-200.json: 194 real NA servants, filled in from the NA data).
# Before 0.24.0 a + press took 0.8-2.2 s of work with this roster, opening Parties 11 s and filling everyone in 75 s.
# The limits here are loose (CI machines vary); the printed numbers are the ones to watch. Also checks that the speed
# changes don't show stale things: a tab drawn later, rows kept between redraws, sorting.
import sys, json, statistics, time
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
HERE = os.path.dirname(os.path.abspath(__file__))
ROSTER = open(os.path.join(HERE, "fixtures", "roster-200.json"), encoding="utf-8").read()
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');if(!localStorage.getItem('spirit-origin-list:v1'))localStorage.setItem('spirit-origin-list:v1'," + json.dumps(ROSTER) + ")"
# the work a press starts: the handler and the redraws it schedules (not the wait for the screen's next frame)
PRESS = """async (sel) => { const b = document.querySelector(sel); if (!b) return -1; const t0 = performance.now(); b.click();
  await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); return Math.round(performance.now() - t0); }"""
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def sv(pg, sid): return next((x for x in pg.evaluate(LS)["servants"] if x["id"] == sid), None)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 1360, "height": 900}); pg = ctx.new_page()
    pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    t0 = time.time(); pg.goto(SEEDED + "#servants"); pg.wait_for_selector("#list [data-id]", timeout=30000); pg.wait_for_timeout(2500)
    n = pg.evaluate(LS + ".servants.length")
    check(f"the big roster is loaded ({n} servants, {time.time() - t0:.1f} s to the list)", n >= 190)
    ids = pg.evaluate("[...document.querySelectorAll('#list [data-id]')].map(e => e.dataset.id)")
    res = {"open a servant": [], "+ Bond": [], "+ Level": [], "+ NP": [], "+ Skill 1": []}
    for i in range(4):
        res["open a servant"].append(pg.evaluate(PRESS, f'#list [data-id="{ids[i * 9 + 4]}"]')); pg.wait_for_timeout(600)
        for k, f in (("+ Bond", "bond"), ("+ Level", "level"), ("+ NP", "np"), ("+ Skill 1", "sk0")):
            res[k].append(pg.evaluate(PRESS, f'#dossier [data-action="bump"][data-f="{f}"][data-d="1"]')); pg.wait_for_timeout(600)
    for k, v in res.items():
        m = statistics.median([x for x in v if x >= 0] or [9999])
        check(f"{k}: {m:.0f} ms of work with {n} servants ({v})", m < 450)
    t = pg.evaluate("""async () => { const i = document.querySelector('#q'); const t0 = performance.now(); i.value = 'ar'; i.dispatchEvent(new Event('input', {bubbles: true})); await new Promise(r => setTimeout(r, 0)); return Math.round(performance.now() - t0); }""")
    check(f"typing in search: {t} ms", t < 400)
    pg.evaluate("(() => { const i = document.querySelector('#q'); i.value = ''; i.dispatchEvent(new Event('input', {bubbles: true})); })()"); pg.wait_for_timeout(500)
    for tab in ("parties", "ranking", "home", "past", "servants"):
        t = pg.evaluate(PRESS, f"#tab-{tab}"); pg.wait_for_timeout(700)
        check(f"opening {tab}: {t} ms", t < 900)
    pg.click("#tab-parties"); pg.wait_for_timeout(800)
    check("Party DNA still finds three stall trios with a big roster", pg.locator(".dna-team").count() == 3)

    # a tab drawn later shows the change made while it was hidden
    sid = ids[2]
    score = lambda: float(pg.locator("#ranking .rank-row", has=pg.locator(f'[data-action="goto"][data-id="{sid}"]')).locator(".rk-score").inner_text())
    pg.click("#tab-ranking"); pg.wait_for_timeout(700); sc0 = score()
    pg.click("#tab-servants"); pg.wait_for_timeout(500)
    pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(400)
    lv0 = sv(pg, sid)["level"]
    for _ in range(3): pg.click('#dossier [data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(100)
    pg.wait_for_timeout(900)
    pg.click("#tab-ranking"); pg.wait_for_timeout(700)
    sc1 = score()
    check(f"Ranking, drawn when opened, has the lower level's score (Lv {lv0} -> {sv(pg, sid)['level']}: {sc0} -> {sc1})", sv(pg, sid)["level"] == lv0 - 3 and sc1 < sc0)

    # rows that didn't change are kept; the changed one is redrawn
    pg.click("#tab-servants"); pg.wait_for_timeout(500)
    pg.evaluate("document.querySelectorAll('#list .row').forEach((r) => { r.__t23 = 1; })")
    pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(300)
    pg.click('#dossier [data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(900)
    kept = pg.evaluate(f"[...document.querySelectorAll('#list .row')].filter((r) => r.dataset.id !== '{sid}' && r.__t23).length")
    total = pg.evaluate("document.querySelectorAll('#list .row').length")
    lvtxt = pg.locator(f'#list .row[data-id="{sid}"] .row-lv').inner_text()
    check(f"a press keeps the other rows as they are ({kept} of {total - 1}) and redraws the changed one ({lvtxt!r})", kept == total - 1 and str(sv(pg, sid)["level"]) in lvtxt)
    # sorting still reorders the list
    opts = pg.evaluate("[...document.querySelectorAll('#f-sort option, select[aria-label*=\"ort\"] option')].map(o => o.value)")
    sel = pg.evaluate("(() => { const s = document.querySelector('#f-sort') || [...document.querySelectorAll('select')].find(x => /order|sort/i.test(x.getAttribute('aria-label') || '') || [...x.options].some(o => /level/i.test(o.textContent))); return s ? '#' + s.id : ''; })()")
    if sel:
        lv_opt = pg.evaluate(f"[...document.querySelector('{sel}').options].find(o => /level/i.test(o.textContent))?.value")
        if lv_opt:
            pg.select_option(sel, lv_opt); pg.wait_for_timeout(700)
            lvls = pg.evaluate("[...document.querySelectorAll('#list > .row')].map(r => parseInt((r.querySelector('.row-lv') || {}).textContent.replace(/[^0-9 ]/g, ' ').trim().split(' ')[0]) || 0)")
            check(f"sorting by level puts the rows in level order ({lvls[:6]}…)", lvls == sorted(lvls, reverse=True) or lvls == sorted(lvls))
    ctx.close()

    # importing the whole roster as a backup, then filling everyone in, finishes quickly
    ctx = b.new_context(viewport={"width": 1360, "height": 900}); pg = ctx.new_page()
    pg.add_init_script("localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9')"); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(f"{URL}/out/Fate_Grand_Index.html#servants"); pg.wait_for_timeout(1500)
    bk = json.loads(ROSTER); bk["app"] = "spirit-origin-list"; bk["version"] = 1
    for s in bk["servants"]:
        for k in ("skillInfo", "traits", "attr", "lawOrder", "moral", "traitsSet", "npTable", "passives", "hp", "atk"): s.pop(k, None)
    path = os.path.join(sp, "_t23_backup.json"); json.dump(bk, open(path, "w"))
    pg.set_input_files("#f-import", path); pg.wait_for_timeout(400)
    t0 = time.time(); pg.evaluate("document.querySelector('[data-action=\"import-go\"]').click()")
    pg.wait_for_function("document.querySelectorAll('#list [data-id]').length >= 190", timeout=60000); ti = time.time() - t0
    pg.wait_for_selector('[data-action="fill-open"]', timeout=20000); pg.evaluate("document.querySelector('[data-action=\"fill-open\"]').click()"); pg.wait_for_timeout(500)
    t0 = time.time(); pg.evaluate("document.querySelector('[data-action=\"fill-go\"]').click()")
    pg.wait_for_function("!document.querySelector('[data-action=\"fill-go\"]')", timeout=120000, polling=200); tf = time.time() - t0
    filled = sum(1 for x in pg.evaluate(LS)["servants"] if x.get("skillInfo"))
    check(f"importing {len(bk['servants'])} servants took {ti:.1f} s", ti < 15)
    check(f"filling in {filled} servants took {tf:.1f} s (75 s before 0.24.0)", tf < 20 and filled >= 190)
    b.close()
print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
