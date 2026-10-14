import os
import sys, tempfile, json
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
BASE = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script("if (!localStorage.getItem('spirit-origin-list:v1:summon')) localStorage.setItem('spirit-origin-list:v1:summon', JSON.stringify({anim: false}))"); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    def atlas(r):
        u = r.request.url
        seg = u.split("CharaGraph/")[1].split("/")[0] if "CharaGraph/" in u else ""
        f = "ph_face.png" if "/Faces/" in u else ("ph_ce.png" if len(seg) >= 7 and seg[:2] in ("90", "93", "94", "95", "96", "97", "98", "99") else "ph_graph.png")
        r.fulfill(path=f"{sp}/{f}", content_type="image/png")
    pg.route("https://static.atlasacademy.io/**", atlas)
    return pg
def docs(pg):
    v = pg.evaluate(LS)["servants"]; return v if isinstance(v, list) else list(v.values())
prof = tempfile.mkdtemp()
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000})
    pg = page(ctx); pg.goto(BASE + "#servants"); pg.wait_for_timeout(1600)
    before = {d["id"]: json.dumps(d, sort_keys=True) for d in docs(pg)}

    # ---- the tab and the page
    pg.click("#tab-past"); pg.wait_for_timeout(1200)
    check("Past Chaldea tab opens", pg.evaluate("location.hash") == "#past" and pg.locator("#tab-past").get_attribute("aria-selected") == "true" and pg.locator(".tabs .tab").count() == 7)
    n_srv = pg.locator('.pc-view [data-v="servants"] small').inner_text()
    check(f"418 NA servants minus the 27 on your list ({n_srv})", n_srv == "391")
    check("first 240 shown, the rest behind Show more", pg.locator(".pc-grid .pc-card").count() == 240 and pg.locator('[data-action="pc-more"]').count() == 1)
    pg.click('[data-action="pc-more"]'); pg.wait_for_timeout(500)
    check("Show more shows them all", pg.locator(".pc-grid .pc-card").count() == 391)
    hidden = ["2", "196", "417", "250", "284", "150", "37", "316", "179"]
    shown = pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(c => c.dataset.no)")
    check("your roster and Guests are left out (Altria, both Ereshkigals, Demon King Nobunaga, Castoria, Merlin, Waver, Oberon, Salter)", not any(h in shown for h in hidden))
    check("Oda Nobunaga (Archer) and Lancer Altria are still here", "69" in shown and "119" in shown)
    pg.fill('[data-pc-q="q"]', "jeanne"); pg.wait_for_timeout(400)
    names = pg.locator(".pc-grid .pc-n").all_inner_texts()
    check(f"search finds {len(names)} Jeannes", len(names) >= 3 and all("Jeanne" in n for n in names))
    pg.fill('[data-pc-q="q"]', ""); pg.select_option('[data-pc-f="cls"]', "Shielder"); pg.wait_for_timeout(400)
    check("class filter: Mash is the only Shielder", pg.locator(".pc-grid .pc-n").all_inner_texts() == ["Mash Kyrielight"])
    pg.select_option('[data-pc-f="cls"]', ""); pg.select_option('[data-pc-f="r"]', "5"); pg.click('[data-action="pc-card"][data-card="Q"]'); pg.wait_for_timeout(400)
    check(f"★5 Quick filter ({pg.locator('.pc-grid .pc-card').count()})", pg.locator(".pc-grid .pc-card").count() > 5 and all(c.endswith("5") for c in pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(c => c.className.match(/r\\d/)[0])")))
    pg.select_option('[data-pc-f="r"]', ""); pg.click('[data-action="pc-card"][data-card=""]'); pg.wait_for_timeout(300)
    pg.check("[data-pc-mine]"); pg.wait_for_timeout(500); pg.click('[data-action="pc-more"]'); pg.wait_for_timeout(400)
    check(f"Show mine too marks yours ({pg.locator('.pc-card.is-mine').count()})", pg.locator(".pc-card.is-mine").count() == 27 and pg.locator(".pc-grid .pc-card").count() == 418)
    pg.uncheck("[data-pc-mine]"); pg.wait_for_timeout(400)
    pg.screenshot(path=f"{sp}/v12-past-desktop.png")

    # ---- a servant's page
    pg.click('.pc-card[data-no="215"]') if pg.locator('.pc-card[data-no="215"]').count() else None
    pg.click('.pc-card[data-no="3"]'); pg.wait_for_timeout(700)
    check("servant page opens", pg.locator("#pc-dlg").is_visible() and pg.locator("#pcd-title").inner_text() == "Altria Pendragon (Alter)")
    check("three skills with icons and values", pg.locator(".pcd-skills .skill").count() == 3 and pg.locator(".pcd-skills .ln-i .ic").count() >= 3 and "→" in pg.locator(".pcd-skills .skill-nums").first.inner_text())
    check("the game's skill icon sits by each skill's name", pg.locator(".pcd-skills .skill header img.sk-ic").count() == 3)
    check("passive and NP table", pg.locator(".pcd-panel .ps-row").count() >= 1 and pg.locator(".pcd-panel .npt").count() == 1 and "450%" in pg.locator(".pcd-panel .npt").inner_text())
    check("stats at Lv 1 / cap / 100 / 120", pg.locator(".pcd-stats tbody tr").count() == 2 and "Lv 120" in pg.locator(".pcd-stats thead").inner_text())
    check("stage and costume pictures", pg.locator(".pcd-stages button").count() == 5)
    pg.click('.pcd-stages [data-k="3"]'); pg.wait_for_timeout(300)
    check("picking Stage 4 shows it", "800" not in pg.locator(".pcd-frame img").get_attribute("src") and pg.locator('.pcd-stages [data-k="3"]').get_attribute("aria-pressed") == "true")
    pg.screenshot(path=f"{sp}/v12-past-detail.png")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc closes it and the page is usable again", pg.locator("#pc-dlg").is_hidden() and not pg.evaluate("document.querySelector('.shell').inert"))

    # ---- adding to Guests (and nothing else changes)
    pg.click('.pc-card[data-no="3"]'); pg.wait_for_timeout(500)
    pg.click('.pcd-panel [data-action="pc-add"]'); pg.wait_for_timeout(900)
    after = docs(pg)
    g = next((d for d in after if d.get("atlas") == 3), None)
    check("added as a Guest with the NA data", g and g.get("wish") is True and g["name"] == "Altria Pendragon (Alter)" and g["cls"] == "Saber" and g["rarity"] == 4 and len(g["skillInfo"]) == 3 and g["npTable"]["v"][0]["rows"][0]["vals"][0] == "450%" and g["art"]["1"].startswith("https://static.atlasacademy.io/"))
    check("its page now says it's a Guest", "Guest" in pg.locator(".pcd-mine").inner_text())
    changed = [k for k, v in before.items() if json.dumps(next(d for d in after if d["id"] == k), sort_keys=True) != v]
    check(f"no servant you already had was changed ({changed})", not changed and len(after) == len(before) + 1)
    pg.click('.pcd-panel [data-action="pc-go"]'); pg.wait_for_timeout(1200)
    check("Open Guest goes to their page with the art", pg.evaluate("location.hash") == "#servants" and pg.locator("#dossier h2").first.inner_text() == "Altria Pendragon (Alter)" and pg.locator("#dossier .art-frame img[data-art]").count() >= 1)
    check("their skills and NP table show in the servant panel", pg.locator("#dossier .skill").count() == 3 and pg.locator("#dossier .npt").count() == 1)
    pg.screenshot(path=f"{sp}/v12-guest-dossier.png")
    pg.click("#tab-past"); pg.wait_for_timeout(900)
    check("and they leave Past Chaldea", pg.locator('.pc-card[data-no="3"]').count() == 0 and pg.locator('.pc-view [data-v="servants"] small').inner_text() == "390")

    # ---- summoning straight to the roster, paced by rarity
    import time
    pg.click("#tab-past"); pg.wait_for_timeout(700)
    # 0.16.0: ★1–2 have no ceremony, ★3 a short silver one, ★5 the full rainbow one
    for no, want, edge in ((16, "none", 0), (13, "brisk", 1), (119, "full", 1)):
        if not pg.locator(f'.pc-card[data-no="{no}"]').count(): pg.click('[data-action="pc-more"]'); pg.wait_for_timeout(300)
        pg.click(f'.pc-card[data-no="{no}"]'); pg.wait_for_timeout(400)
        t0 = time.time(); pg.click('.pcd-panel [data-action="pc-summon"]')
        pg.wait_for_function("document.getElementById('summon').classList.contains('info')", timeout=15000); dt = time.time() - t0
        tier = pg.evaluate("document.getElementById('summon').dataset.tier")
        check(f"No. {no}: {want} summon ({dt:.1f}s, {tier}, outline {pg.locator('#summon .sm-edge').count()})", pg.evaluate("document.getElementById('summon').dataset.speed") == want and pg.locator("#summon .sm-edge").count() == edge and dt < {"none": 1.4, "brisk": 2.4, "full": 7.2}[want] and dt > {"none": 0, "brisk": 0.7, "full": 4.6}[want])
        pg.click(".sm-done"); pg.wait_for_timeout(900)
        d = next((x for x in docs(pg) if x.get("atlas") == no), None)
        check(f"No. {no} joined the roster at the start", d and not d.get("wish") and d["level"] == 1 and d["skills"] == [1, "Locked", "Locked"] and pg.evaluate("location.hash") == "#servants" and pg.locator("#dossier h2").first.inner_text() == d["name"])
        pg.click("#tab-past"); pg.wait_for_timeout(600)
    check("rainbow outline for ★5, gold for ★4 (CSS)", pg.evaluate("""(() => { let ok = 0; for (const sh of document.styleSheets) { let rs; try { rs = sh.cssRules; } catch (e) { continue; } for (const r of rs) { const t = r.cssText || ''; if (t.includes('data-tier="gold5"] .sm-edge > b') && t.includes('conic-gradient')) ok |= 1; if (t.includes('data-tier="gold"] .sm-edge > b') && t.includes('rgb(232, 185, 62)')) ok |= 2; } } return ok; })()""") == 3)
    after2 = docs(pg)
    changed = [k for k, v in before.items() if json.dumps(next(d for d in after2 if d["id"] == k), sort_keys=True) != v]
    check(f"still no servant you already had was changed ({changed})", not changed)

    # ---- matching by hand, kept apart from your servants
    pg.click('[data-action="pc-review"]'); pg.wait_for_timeout(300); pg.check("[data-pc-all]"); pg.wait_for_timeout(400)
    sel = pg.locator('select[data-pc-link="oda-nobunaga"]')
    sel.select_option("69"); pg.wait_for_timeout(500)
    check("linking Oda Nobunaga to the Archer by hand is saved apart", pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1:atlaslink'))['oda-nobunaga']") == 69 and "oda-nobunaga" not in [k for k, v in before.items() if json.dumps(next(d for d in docs(pg) if d["id"] == k), sort_keys=True) != v])
    shown = pg.evaluate("Array.from(document.querySelectorAll('.pc-card')).map(c => c.dataset.no)")
    check("so Demon King Nobunaga comes back and the Archer leaves", "250" in shown and "69" not in shown)
    pg.locator('select[data-pc-link="oda-nobunaga"]').select_option(""); pg.wait_for_timeout(400)
    pg.click('[data-action="pc-review"]'); pg.wait_for_timeout(300)

    # ---- Craft Essences
    pg.click('[data-action="pc-view"][data-v="ces"]'); pg.wait_for_timeout(700)
    check("2135 Craft Essences", pg.locator('.pc-view [data-v="ces"] small').inner_text() == "2135" and pg.locator(".pc-grid.ce-grid .pc-card").count() == 240)
    pg.fill('[data-pc-q="cq"]', "kaleidoscope"); pg.wait_for_timeout(400)
    check("search finds Kaleidoscope", "Kaleidoscope" in pg.locator(".pc-grid.ce-grid").inner_text())
    pg.fill('[data-pc-q="cq"]', ""); pg.select_option('[data-pc-f="cf"]', "B"); pg.wait_for_timeout(400)
    check("Bond CEs filter", pg.locator(".pc-count").inner_text().startswith("417"))
    pg.locator(".pc-grid.ce-grid .pc-card").first.click(); pg.wait_for_timeout(500)
    check("a Bond CE names its servant", pg.locator(".pcd-panel .linkish").count() == 1)
    pg.locator(".pcd-panel .linkish").click(); pg.wait_for_timeout(500)
    check("and opens them", pg.locator("#pcd-title").inner_text() == "Altria Pendragon")
    pg.keyboard.press("Escape"); pg.select_option('[data-pc-f="cf"]', ""); pg.wait_for_timeout(300)
    pg.locator('.pc-card.is-ce[data-no="31"]').click(); pg.wait_for_timeout(500)
    check("CE page: effect, max limit break and stats", "Formal Craft" in pg.locator("#pcd-title").inner_text() and "max limit break" in pg.locator(".pcd-panel").inner_text().lower() and "25%" in pg.locator(".ce-eff").inner_text())
    pg.screenshot(path=f"{sp}/v12-ce-detail.png"); pg.keyboard.press("Escape")
    pg.click('[data-action="pc-view"][data-v="servants"]'); pg.wait_for_timeout(300)
    pg.reload(); pg.wait_for_timeout(1500)
    check("reload stays on Past Chaldea", pg.evaluate("location.hash") == "#past" and pg.locator(".pc-grid .pc-card").count() > 0)

    # ---- Summoning
    pg.click("#tab-summon"); pg.wait_for_timeout(800)
    pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(500)
    st = pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1:summon'))")
    ces = [x for x in st["last"] if x["k"] == "c"]
    check(f"Craft Essences that come out are real story-pool CEs ({len(ces)})", ces and all(x.get("ce") for x in ces))
    check("your list only by default: no NA strangers", not any(x.get("pc") for x in st["last"]))
    pg.click('[data-action="sm-pool"][data-v="all"]'); pg.wait_for_timeout(400)
    for _ in range(3): pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(250)
    st = pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1:summon'))")
    check(f"All of NA: Past Chaldea servants can come out ({sum(1 for x in st['last'] if x.get('pc'))} in the last 11)", st["pool"] == "all" and any(x.get("pc") for x in st["last"]))
    pg.click('[data-action="sm-reveal"]') if pg.locator('[data-action="sm-reveal"]').count() else None
    check("drop chances add the Past Chaldea share", pg.locator(".smc-n b", has_text="from Past Chaldea").count() == 3)
    pc = pg.locator('.smr.from-pc .smr-n button').first
    if pc.count():
        pc.click(); pg.wait_for_timeout(500)
        check("a Past Chaldea result opens its page", pg.locator("#pc-dlg").is_visible())
        pg.keyboard.press("Escape")
    pg.click('[data-action="sm-pool"][data-v="list"]'); pg.wait_for_timeout(300)

    # ---- Home
    pg.click("#tab-home"); pg.wait_for_timeout(1000)
    check("Home shows today's visitor from Past Chaldea", pg.locator(".hm-b-past .hp-spot").count() == 1)
    pg.click(".hm-b-past .hp-spot"); pg.wait_for_timeout(500)
    check("and opens them", pg.locator("#pc-dlg").is_visible()); pg.keyboard.press("Escape")

    # ---- dark mode
    pg.click('[data-action="theme"]'); pg.wait_for_timeout(900)
    pg.click("#tab-past"); pg.wait_for_timeout(800); pg.screenshot(path=f"{sp}/v12-past-dark.png")
    pg.click('.pc-card[data-no="129"]'); pg.wait_for_timeout(600); pg.screenshot(path=f"{sp}/v12-detail-dark.png"); pg.keyboard.press("Escape")
    pg.click('[data-action="theme"]'); pg.wait_for_timeout(700)
    ctx.close()

    for wdt in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": wdt, "height": 800})
        pg = page(ctx); pg.goto(BASE + "#past"); pg.wait_for_timeout(1500)
        tb = pg.evaluate("(() => { const t = document.querySelector('.tabs'); return [t.scrollWidth, t.clientWidth]; })()")
        check(f"{wdt}px: all seven tabs fit ({tb})", tb[0] <= tb[1] + 1)
        sw = [pg.evaluate("document.documentElement.scrollWidth")]
        pg.screenshot(path=f"{sp}/v12-phone{wdt}-past.png")
        pg.locator(".pc-card").nth(4).click(); pg.wait_for_timeout(700)
        r = pg.evaluate("(() => { const b = document.querySelector('.pcd-panel').getBoundingClientRect(); return [b.left, b.width, innerWidth]; })()")
        check(f"{wdt}px: servant page fills the screen ({[round(x) for x in r]})", abs(r[0]) < 1 and abs(r[1] - r[2]) < 1)
        pw = pg.evaluate("document.querySelector('.pcd-panel').scrollWidth <= document.querySelector('.pcd-panel').clientWidth + 1")
        pg.screenshot(path=f"{sp}/v12-phone{wdt}-detail.png")
        pg.locator(".pcd-panel").evaluate("el => el.scrollTop = el.scrollHeight"); pg.wait_for_timeout(300); pg.screenshot(path=f"{sp}/v12-phone{wdt}-detail2.png")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        check(f"{wdt}px: no sideways scroll ({sw}, panel ok {pw})", max(sw) <= wdt and pw)
        ctx.close()
check("no page errors" + (": " + "; ".join(errs[:3]) if errs else ""), not errs)
print("FAILS:", len(fails))
