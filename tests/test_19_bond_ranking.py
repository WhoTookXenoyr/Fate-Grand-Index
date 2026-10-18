import os
# 0.23.0: Bond counts in the ranking score. Bond 1-5 add a little each, 6-10 more, 11-14 more again and 14 -> 15 the
# most; the other parts were scaled down so the score still tops out at 100. The SERVANTPAGE shows the game's Bond gems.
import sys, re
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');"
WHO = "oberon"
def row_parts(pg):
    t = pg.locator("#ranking .rank-row", has=pg.locator(f'[data-action="goto"][data-id="{WHO}"]')).text_content()
    b = re.search(r"Bond (\d+\.\d)", t); sc = re.search(r"(\d+\.\d)\s*$", t.strip())
    return float(b.group(1)) if b else None, float(sc.group(1)) if sc else None
def bond_of(pg): return next(x for x in pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1')).servants") if x["id"] == WHO).get("bond")

with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1360, "height": 1100}); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.add_init_script(INIT)
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.goto(SEEDED + "#ranking"); pg.wait_for_selector("#ranking .rank-row", timeout=20000); pg.wait_for_timeout(500)
    note = pg.locator(".rank-note").first.inner_text()
    weights = [int(x) for x in re.findall(r"\((\d+)\)", note)]
    check(f"the note lists Bond, and the parts still add up to 100 ({weights})", "Bond (10)" in note and sum(weights) == 100 and len(weights) == 6)
    bond0, score0 = row_parts(pg)
    check(f"every row shows its Bond part; no Bond yet is 0 ({bond0}, {score0})", bond0 == 0.0 and score0 is not None and pg.locator("#ranking .rk-parts", has_text="Bond").count() == pg.locator("#ranking .rank-row").count())
    check("no score goes over 100", all(float(x) <= 100 for x in pg.locator("#ranking .rk-score").all_inner_texts()))

    # raise Oberon's Bond one level at a time and read his Bond points after each
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(800); pg.click(f'#list [data-id="{WHO}"]'); pg.wait_for_timeout(500)
    gems = lambda: pg.evaluate("[...document.querySelectorAll('#dossier .bond-gems .bg')].map((e) => e.className.replace('bg ', ''))")
    shown = {0: gems()}
    seen = [0.0]
    for lv in range(1, 16):
        pg.click('#dossier [data-action="bump"][data-f="bond"][data-d="1"]'); pg.wait_for_timeout(60)
        seen.append(row_parts(pg)[0])
        if lv in (7, 10, 11, 15): shown[lv] = gems()
    check(f"Bond 0: ten dark gems ({shown[0]})", shown[0] == ["g0"] * 10)
    check(f"Bond 7: the first seven gems lit, three dark ({shown[7]})", shown[7] == [f"g{i}" for i in range(1, 8)] + ["g0"] * 3)
    check(f"Bond 10: all ten, each its own colour ({shown[10]})", shown[10] == [f"g{i}" for i in range(1, 11)])
    check(f"Bond 11: the ten fold into the rainbow gem, then one lit and four dark ({shown[11]})", shown[11] == ["gall", "g1", "g0", "g0", "g0", "g0"])
    check(f"Bond 15: the rainbow gem and five lit, in the colours of Bond 1-5 ({shown[15]})", shown[15] == ["gall", "g1", "g2", "g3", "g4", "g5"])
    check("the gems are pictures built into the page (no download)", pg.evaluate("getComputedStyle(document.querySelector('#dossier .bond-gems .bg.g1')).backgroundImage").startswith('url("data:image/webp'))
    pg.wait_for_timeout(900)  # typing and pressing are saved half a second later
    steps = [round(seen[i] - seen[i - 1], 1) for i in range(1, 16)]
    check(f"Bond 1-5 add 0.3 each ({steps[0:5]})", steps[0:5] == [0.3] * 5)
    check(f"Bond 6-10 add more, 0.6 each ({steps[5:10]})", steps[5:10] == [0.6] * 5)
    check(f"Bond 11-14 add more again, 1 each ({steps[10:14]})", steps[10:14] == [1.0] * 4)
    check(f"14 -> 15 adds the most ({steps[14]})", steps[14] == 1.5 and steps[14] == max(steps))
    check(f"Bond 15 is worth the full 10 ({seen[15]}; Bond 10 is {seen[10]}, Bond 5 is {seen[5]})", seen[15] == 10.0 and seen[10] == 4.5 and seen[5] == 1.5 and bond_of(pg) == 15)
    pg.goto(SEEDED + "#ranking"); pg.wait_for_selector("#ranking .rank-row", timeout=20000); pg.wait_for_timeout(400)
    b15, s15 = row_parts(pg)
    check(f"the ranking reads it back after a reload: +10 on the score ({score0} -> {s15})", b15 == 10.0 and abs((s15 - score0) - 10.0) <= 0.11)
    check("still nobody over 100", all(float(x) <= 100 for x in pg.locator("#ranking .rk-score").all_inner_texts()))
    chip = pg.evaluate("document.querySelector('#ranking .rank-row .rk-bar').title")
    check(f"the bar's hover text lists the Bond part too ({chip[:90]!r})", "Bond" in chip)
    # back down a level from the SERVANTPAGE
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(800); pg.click(f'#list [data-id="{WHO}"]'); pg.wait_for_timeout(500)
    pg.click('#dossier [data-action="bump"][data-f="bond"][data-d="-1"]'); pg.wait_for_timeout(900)
    check(f"lowering Bond to 14 takes the 1.5 back ({row_parts(pg)[0]})", row_parts(pg)[0] == 8.5 and bond_of(pg) == 14)
    b.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
