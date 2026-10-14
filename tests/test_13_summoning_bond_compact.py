import os
import sys, tempfile, json, re, time
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
EMPTY = f"{URL}/out/Fate_Grand_Index.html"
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
def atlas(r):
    u = r.request.url
    f = "ph_buff.png" if "BuffIcons" in u else "ph_skill.png" if "SkillIcons" in u else "ph_face.png" if "/Faces/" in u else "ph_graph.png"
    r.fulfill(path=f"{sp}/{f}", content_type="image/png")
def docs(pg):
    v = json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1')") or '{"servants": []}')["servants"]; return v if isinstance(v, list) else list(v.values())
def page(p, w=1360, h=1000, init=None):
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": w, "height": h})
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    if init: pg.add_init_script(init)
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", atlas)
    return ctx, pg
AD = open(f"{sp}/atlas_data.js").read()
ATL = json.loads(re.search(r"const ATLAS_S = (\[.*?\]);\n", AD, re.S).group(1))
BY = {x["no"]: x for x in ATL}
def flat(v): v = [str(x).strip() for x in v[:5]]; return len(v) >= 2 and v[0] != "" and all(x == v[0] for x in v)

with sync_playwright() as p:
    # ================= your list at 30 fps, in the dark =================
    ctx, pg = page(p, init="if (!localStorage.getItem('spirit-origin-list:v1:fps')) { localStorage.setItem('spirit-origin-list:v1:fps', '30'); localStorage.setItem('spirit-origin-list:v1:theme', 'dark'); }")
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1600)
    pg.click("#theme-tgl"); pg.wait_for_timeout(1300)
    ok = True
    try: pg.click('#list .row[data-id="artoria"]', timeout=3000)
    except Exception: ok = False
    check("switching light / dark at 30 fps leaves the page clickable", ok and pg.locator("#dossier h2").first.inner_text() == "Artoria" and not pg.evaluate("document.documentElement.classList.contains('vt-theme')"))
    pg.click("#theme-tgl"); pg.wait_for_timeout(1300)
    ok = True
    try: pg.click('#list .row[data-id="ereshkigal"]', timeout=3000)
    except Exception: ok = False
    check("…and back again", ok and pg.locator("#dossier h2").first.inner_text() == "Ereshkigal")
    # the skill switch on A → A+
    b = pg.locator('#dossier [data-action="skup"][data-i="0"]')
    before = b.inner_text(); b.click(); pg.wait_for_timeout(600)
    after = pg.locator('#dossier [data-action="skup"][data-i="0"]').inner_text()
    e = next(x for x in docs(pg) if x["id"] == "ereshkigal")
    check(f"Ereshkigal's 'The Secret Great Crown A' flips to A+ ({before} → {after})", before == "Before upgrade" and after == "Upgraded" and e["skillInfo"][0]["name"].endswith("A+"))
    pg.click('#dossier [data-action="skup"][data-i="0"]'); pg.wait_for_timeout(600)
    e = next(x for x in docs(pg) if x["id"] == "ereshkigal")
    check("…and back to A with your own text", pg.locator('#dossier [data-action="skup"][data-i="0"]').inner_text() == "Before upgrade" and e["skillInfo"][0]["name"] == "The Secret Great Crown A")
    # Tamamo: both versions share the name
    pg.click('#list .row[data-id="tamamo-no-mae"]'); pg.wait_for_timeout(500)
    b = pg.locator('#dossier [data-action="skup"][data-i="2"]'); first = b.inner_text(); b.click(); pg.wait_for_timeout(600)
    second = pg.locator('#dossier [data-action="skup"][data-i="2"]').inner_text()
    pg.click('#dossier [data-action="skup"][data-i="2"]'); pg.wait_for_timeout(600)
    third = pg.locator('#dossier [data-action="skup"][data-i="2"]').inner_text()
    check(f"Tamamo's Fox's Wedding EX (same name both times) flips both ways ({first} → {second} → {third})", first != second and third == first)

    # ---- the NP switch and base damage
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(500)
    sw = pg.locator('#dossier [data-action="npup"]')
    check("Artoria's NP has an upgrade switch", sw.count() == 1 and sw.get_attribute("role") == "switch")
    check("Base Damage x1.5 for a Buster NP", "Base Damage: x1.5" in pg.locator("#dossier .npt-base").inner_text())
    st0 = sw.get_attribute("aria-checked"); sw.click(); pg.wait_for_timeout(600)
    a = next(x for x in docs(pg) if x["id"] == "artoria")
    sw = pg.locator('#dossier [data-action="npup"]')
    want = BY[2]["np"]["u"][0] if st0 == "true" else BY[2]["np"]
    check(f"switching the NP saves that version (rank {a['npTable']['v'][0]['rank']})", sw.get_attribute("aria-checked") != st0 and a["npTable"]["v"][0]["rank"] == want["k"] and a["npName"] == want["n"])
    sw.click(); pg.wait_for_timeout(600)
    check("…and back", pg.locator('#dossier [data-action="npup"]').get_attribute("aria-checked") == st0)

    # ---- stars, Bond and the EX tier
    check("a ★5 below Lv 100 has gold stars with a pulse", "st-r5" in pg.locator("#dossier .d-meta .stars").get_attribute("class"))
    pg.click('#dossier [data-action="ql-lv"][data-v="120"]'); pg.wait_for_timeout(600)
    check("…and rainbow past Lv 100", "st-rb" in pg.locator("#dossier .d-meta .stars").get_attribute("class"))
    pg.click('#list .row[data-id="space-ereshkigal"]'); pg.wait_for_timeout(500)
    check("Space Ereshkigal (Beast) wears her picture's colours", "st-pal" in pg.locator("#dossier .d-meta .stars").get_attribute("class"))
    for _ in range(10): pg.click('#dossier [data-action="bump"][data-f="bond"][data-d="1"]'); pg.wait_for_timeout(40)
    pg.wait_for_timeout(800)
    s = next(x for x in docs(pg) if x["id"] == "space-ereshkigal")
    check(f"Bond goes up to 10 and says so ({s.get('bond')})", s.get("bond") == 10 and "Bond CE" in pg.locator("#dossier .lv-row").inner_text())
    for _ in range(9): pg.click('#dossier [data-action="bump"][data-f="bond"][data-d="1"]'); pg.wait_for_timeout(40)
    pg.wait_for_timeout(800)
    check("…and stops at 15", next(x for x in docs(pg) if x["id"] == "space-ereshkigal").get("bond") == 15 and "Max bond" in pg.locator("#dossier .lv-row").inner_text())
    pg.click("#tab-home"); pg.wait_for_timeout(700)
    recs = pg.locator(".rec-list .rec").all_inner_texts()
    names = [r.split("\n")[0] for r in recs]
    check(f"new Master records ({len(recs)})", all(n in names for n in ["Bond 10", "Max Bond", "EX Servant", "Five S", "Ten A", "Holy Grail Servant", "Rainbow Fou", "Gold Fou"]))
    check("Bond 10 and Max Bond are earned", all("Earned" in r for r in recs if r.split("\n")[0] in ("Bond 10", "Max Bond")))
    pg.click("#tab-ranking"); pg.wait_for_timeout(400); pg.click('[data-action="rank-view"][data-v="tiers"]'); pg.wait_for_timeout(300)
    check("the top tier is called EX", pg.locator(".tier-lab b").first.inner_text() == "EX" and "EX 75+" in pg.locator(".tier-note").inner_text())

    # ---- the Compact layout
    pg.click("#tab-servants"); pg.wait_for_timeout(300)
    pg.click("#layout-tgl"); pg.wait_for_timeout(500)
    check("with a servant open, Compact shows them as a window over the list", pg.locator(".cmp-veil").is_visible() and pg.locator(".cmp-x").is_visible())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(600)
    L = pg.locator("#dossier .cmp-l"); R = pg.locator("#dossier .cmp-r")
    check("Compact: the picture on the left, name, deck, progress and stats beside it", L.locator(".scene").count() == 1 and R.locator(".d-head").count() == 1 and R.locator('[data-f="level"]').count() >= 1 and R.locator(".stat-grid").count() == 1 and L.bounding_box()["x"] < R.bounding_box()["x"])
    check("…remembered, and the switch says so", pg.evaluate("localStorage.getItem('spirit-origin-list:v1:layout')") == "compact" and pg.locator("#layout-tgl").get_attribute("aria-pressed") == "true")
    pg.reload(); pg.wait_for_timeout(1500)
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(600)
    check("…after a reload too", pg.locator("#dossier .cmp-top").count() == 1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc closes the Compact window", pg.locator("#dossier.open").count() == 0 and pg.locator(".cmp-veil").is_hidden())
    pg.click("#layout-tgl"); pg.wait_for_timeout(400)
    pg.click('#list .row[data-id="artoria"]'); pg.wait_for_timeout(400)
    check("Modern puts everything back in one column", pg.locator("#dossier .cmp-top").count() == 0 and pg.evaluate("document.documentElement.dataset.layout") == "modern")
    ctx.close()

    # ================= Past Chaldea and the Summoning page =================
    ctx, pg = page(p)
    pg.goto(EMPTY); pg.wait_for_timeout(1400); pg.keyboard.press("Escape"); pg.wait_for_timeout(150)
    pg.click("#tab-past"); pg.wait_for_timeout(500)
    pg.fill('[data-pc-q="q"]', "Altria Pendragon"); pg.wait_for_timeout(300)
    pg.click('.pc-card[data-no="2"]'); pg.wait_for_timeout(400)
    sw = pg.locator('.pcd-panel [data-action="pc-npup"]')
    nm = lambda: pg.locator(".pcd-panel .np-sec .npt-title b").first.inner_text()
    rk = lambda: pg.locator(".pcd-panel .np-sec .npt tr").nth(1).locator("td").first.inner_text()
    r1 = rk(); sw.click(); pg.wait_for_timeout(250); r2 = rk()
    check(f"Past Chaldea: Excalibur's switch goes from A++ to A ({r1} → {r2})", r1 == "A++" and r2 == "A" and nm() == "Excalibur")
    rows = pg.locator(".pcd-panel .np-sec tr:not(.oc) th.lab").all_inner_texts()
    want = [r[0] for r in BY[2]["np"]["u"][0]["r"] if not flat(r[1])]
    check(f"…its NP rows show only what changes with NP level ({rows[2:]})", rows[2:] == want)
    check("Base Damage x1.5 in Past Chaldea too", "Base Damage: x1.5" in pg.locator(".pcd-panel .npt-base").inner_text())
    nflat = sum(1 for x in ATL if x["np"] for r in x["np"]["r"] if flat(r[1]))
    check(f"the NA data has {nflat} NP rows that never change, now kept out of the tables", nflat > 0)
    pg.keyboard.press("Escape")
    # Quick NP: x0.8
    q = next(x for x in ATL if x["np"] and x["np"]["cd"] == "Q" and x["r"] >= 4)
    pg.fill('[data-pc-q="q"]', str(q["no"])); pg.wait_for_timeout(300); pg.click(f'.pc-card[data-no="{q["no"]}"]'); pg.wait_for_timeout(400)
    check(f"Quick NP ({q['n']}): Base Damage x0.8", "x0.8" in pg.locator(".pcd-panel .npt-base").inner_text())
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200)

    # ---- the Summoning page: the best card gets the ceremony; card backs by rarity
    pg.click("#tab-summon"); pg.wait_for_timeout(500)
    pg.click('[data-action="sm-pool"][data-v="all"]'); pg.wait_for_timeout(300)
    t0 = time.time(); pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(400)
    ov = pg.locator("#summon")
    shown = ov.is_visible()
    look = pg.evaluate("document.getElementById('summon').dataset.look")
    best = pg.evaluate("(() => { const L = JSON.parse(localStorage.getItem('spirit-origin-list:v1:summon')).last; const rk = (x) => x.r * 2 + (x.k === 's' ? 1 : 0); return L.slice().sort((a, b) => rk(b) - rk(a))[0]; })()")
    exp = "rainbow" if best["k"] == "s" and best["r"] == 5 else "gold" if best["r"] >= 4 else "silver"
    check(f"a 10-summon plays the ceremony for its best card ({best['k']}{best['r']} → {look})", shown and look == exp and pg.locator(".smr-list .smr").count() == 0)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(200); pg.click(".sm-done"); pg.wait_for_timeout(700)
    check("…then the eleven cards are dealt", pg.locator(".smr-list .smr").count() == 11 and ov.is_hidden())
    backs = pg.evaluate("Array.from(document.querySelectorAll('.smr')).map(li => [li.className.match(/is-[sc]/)[0], li.className.match(/\\br(\\d)\\b/)[1], li.querySelector('.smr-back img').src.length])")
    by = {}
    for k, r, n in backs: by.setdefault((k, r), set()).add(n)
    check(f"each kind and rarity has its own card back ({sorted((k, r) for k, r in by)})", len(set(min(v) for v in by.values())) == len(by) and all(len(v) == 1 for v in by.values()))
    pg.click('[data-sm-anim]'); pg.wait_for_timeout(200)
    pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(400)
    check("with the switch off, the cards are dealt straight away", ov.is_hidden() and pg.locator(".smr-list .smr").count() == 11 and json.loads(pg.evaluate("localStorage.getItem('spirit-origin-list:v1:summon')"))["anim"] is False)
    # a ★4 servant summoned from Past Chaldea: gold, faster than rainbow
    pg.click("#tab-past"); pg.wait_for_timeout(400)
    pg.fill('[data-pc-q="q"]', "emiya"); pg.wait_for_timeout(300); pg.click('.pc-card[data-no="11"]'); pg.wait_for_timeout(300)
    t0 = time.time(); pg.click('.pcd-panel [data-action="pc-summon"]')
    pg.wait_for_function("document.getElementById('summon').classList.contains('info')", timeout=15000); dt = time.time() - t0
    check(f"a ★4 servant gets the gold ceremony, quicker than a ★5 ({dt:.1f}s)", pg.evaluate("document.getElementById('summon').dataset.look") == "gold" and 3.0 < dt < 5.6 and pg.locator("#summon .s2-pillars").count() == 1)
    pg.click(".sm-done"); pg.wait_for_timeout(800)
    check("Emiya (★4) has beige stars on his page", "st-r4" in pg.locator("#dossier .d-meta .stars").get_attribute("class"))
    pg.mouse.move(10, 10)
    fr = pg.locator("#dossier .art-frame").first; bb = fr.bounding_box()
    pg.mouse.move(bb["x"] + bb["width"] * 0.3, bb["y"] + bb["height"] * 0.4); pg.wait_for_timeout(150); pg.mouse.move(bb["x"] + bb["width"] * 0.35, bb["y"] + bb["height"] * 0.45); pg.wait_for_timeout(200)
    check("the picture catches the light under the pointer", "glare-on" in (fr.get_attribute("class") or "") and fr.locator(".art-glare").count() == 1)
    ctx.close()

print("\nerrors:", errs)
print("FAILED:" if fails else "ALL PASSED", fails)
