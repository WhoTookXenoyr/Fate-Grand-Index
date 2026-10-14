import re
import sys, tempfile, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]
NEW = f"file://{sp}/_seeded.html#servants"
errs = []
prof = tempfile.mkdtemp()
def page(ctx):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return pg
def check(label, ok): print(("PASS " if ok else "FAIL ") + label)
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000}, accept_downloads=True)
    pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(900)
    pg.click('[data-id="ereshkigal"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(100); pg.click('[data-action="bump"][data-f="level"][data-d="-1"]'); pg.wait_for_timeout(700)
    # ---- skill ranks
    tiers = pg.evaluate("Array.from(document.querySelectorAll('article.skill')).map(a=>a.className)")
    check(f"Ereshkigal skill tiers {tiers}", tiers == ["skill tier-a", "skill tier-a", "skill tier-ex"])
    pg.locator(".skills").scroll_into_view_if_needed(); pg.wait_for_timeout(1200)
    pg.locator(".skills").screenshot(path=f"{sp}/v7-skills-ex.png")
    # rank box in the form
    pg.click('[data-action="edit"]'); pg.wait_for_timeout(400)
    check(f"form splits rank out of the name: {pg.input_value('#sv-s3-name')!r} / {pg.input_value('#sv-s3-rank')!r}", pg.input_value("#sv-s3-name") == "Blessing of Kur" and pg.input_value("#sv-s3-rank") == "EX")
    pg.fill("#sv-s1-rank", "B+"); pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
    st = pg.evaluate(LS + ".servants.find(s=>s.id==='ereshkigal')")
    check(f"ranks saved {[ (x.get('name'), x.get('rank')) for x in st['skillInfo']]}", st["skillInfo"][0]["rank"] == "B+" and st["skillInfo"][2]["rank"] == "EX" and st["skillInfo"][2]["name"] == "Blessing of Kur")
    tiers = pg.evaluate("Array.from(document.querySelectorAll('article.skill')).map(a=>a.className)")
    check(f"after save tiers {tiers}", tiers == ["skill tier-b", "skill tier-a", "skill tier-ex"])
    # passive with rank
    pg.click('[data-action="ps-add"]'); pg.wait_for_timeout(300)
    pg.keyboard.type("Territory Creation"); pg.click('[data-ps="0:rank"]'); pg.keyboard.type("EX"); pg.click('[data-action="ps-edit"]'); pg.wait_for_timeout(400)
    check("passive EX styled", pg.locator(".ps-row.tier-ex .sk-rk").count() == 1)
    # ---- deck: official cards
    pg.locator(".deck-sec").scroll_into_view_if_needed()
    for i, n in enumerate([1, 1, 2, 3, 3]):
        for _ in range(n): pg.click(f'[data-action="deck"][data-i="{i}"]'); pg.wait_for_timeout(120)
    check(f"deck shows official card art ({pg.locator('.deck .cmd-img').count()})", pg.locator(".deck .cmd-img").count() == 5)
    pg.wait_for_timeout(900); pg.locator(".deck-sec").screenshot(path=f"{sp}/v7-deck.png")
    check("NP table uses the official card", pg.locator(".np-card").count() == 1)
    check("roster rows use card art", pg.locator("#list .card-mini").count() >= 15)
    # ---- wishlist
    pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(400)
    check("guest form", "guest" in pg.locator("#servant-form h2").inner_text().lower() and pg.is_checked("#sv-wish"))
    pg.fill("#sv-name", "Altria Caster"); pg.select_option("#sv-cls", "Caster"); pg.select_option("#sv-rarity", "5"); pg.fill("#sv-level", "1")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
    check("wish row shows", pg.locator('.wish-row .wish-pick[data-id="altria-caster"]').count() == 1)
    check("not in roster rows", pg.locator('#list > .row[data-id="altria-caster"]').count() == 0)
    check(f"summary counts Guests: {pg.locator('#summary').inner_text()!r}", re.search(r"\d+ in Guests", pg.locator("#summary").inner_text()) is not None)
    check("dossier wish banner", pg.locator(".wish-banner .summon-btn").count() == 1)
    pg.click('[data-action="tab"][data-tab="ranking"]'); pg.wait_for_timeout(300)
    check("wish servant not ranked", pg.locator('#ranking [data-id="altria-caster"]').count() == 0)
    pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(300)
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(200)
    pg.locator(".wish").screenshot(path=f"{sp}/v7-wish.png")
    # ---- summoning animation
    pg.click("#tab-summon"); pg.wait_for_timeout(600); pg.click('.smg [data-action="summon"][data-id="altria-caster"]')
    for t, nm in [(700, "a"), (1500, "b"), (2250, "c"), (2600, "d"), (3300, "e"), (4000, "f"), (5100, "g"), (8200, "h")]:
        pg.wait_for_timeout(t - (0 if nm == "a" else prev)); prev = t
        pg.screenshot(path=f"{sp}/v7-summon-{nm}.png")
    check("summon overlay revealed", pg.evaluate("document.getElementById('summon').classList.contains('info')"))
    check("page behind is inert", pg.evaluate("document.querySelector('.shell').inert"))
    pg.click(".sm-done"); pg.wait_for_timeout(700)
    check("overlay closed", pg.evaluate("document.getElementById('summon').hidden"))
    check("summoned servant now in roster with glow", pg.locator('#list > .row.fresh[data-id="altria-caster"]').count() == 1)
    st = pg.evaluate(LS + ".servants.find(s=>s.id==='altria-caster')")
    check("saved as summoned", "wish" not in st)
    check(f"toast: {pg.locator('#toast').inner_text()!r}", "joined your roster" in pg.locator("#toast").inner_text())
    # summon via the edit form, skipped with Escape
    pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(300)
    pg.fill("#sv-name", "Morgan"); pg.select_option("#sv-cls", "Berserker"); pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
    pg.click('.wish-row [data-id="morgan"]'); pg.wait_for_timeout(300); pg.click('[data-action="edit"]'); pg.wait_for_timeout(300)
    pg.uncheck("#sv-wish"); pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900)
    check("form summon plays the animation", pg.evaluate("!document.getElementById('summon').hidden"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc skips to the reveal", pg.evaluate("document.getElementById('summon').classList.contains('info')"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(700)
    check("Esc again closes; Morgan in roster", pg.evaluate("document.getElementById('summon').hidden") and pg.locator('#list > .row[data-id="morgan"]').count() == 1)
    # ---- Versus
    pg.click('[data-id="ereshkigal"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="vs-add"]'); pg.wait_for_timeout(700)
    check("Compare opens Versus with Ereshkigal as A", pg.evaluate("document.querySelector('[data-vs-pick=\"0\"]').value") == "ereshkigal" and not pg.evaluate("document.getElementById('view-versus').hidden"))
    pg.select_option('[data-vs-pick="1"]', "artoria"); pg.wait_for_timeout(400)
    check(f"verdict: {pg.locator('.vs-verdict').inner_text()!r}", "Artoria has the class advantage" in pg.locator(".vs-verdict").inner_text())
    pg.click('[data-action="vs-add3"]'); pg.wait_for_timeout(400)
    check("third servant added", pg.locator(".vs-hero").count() == 3)
    pg.select_option('[data-vs-pick="2"]', "space-ereshkigal"); pg.wait_for_timeout(400)
    pg.click('[data-action="vs-swap"]'); pg.wait_for_timeout(300)
    check("swap A and B", pg.evaluate("document.querySelector('[data-vs-pick=\"0\"]').value") == "artoria")
    pg.screenshot(path=f"{sp}/v7-versus3.png", full_page=True)
    pg.locator('.vs-match').scroll_into_view_if_needed(); pg.wait_for_timeout(300); pg.hover('.vs-match td.aff-c >> nth=0'); pg.wait_for_timeout(200)
    check(f"tooltip: {pg.locator('#vs-tip').inner_text()!r}", pg.evaluate("!document.getElementById('vs-tip').hidden") and "attacking" in pg.locator("#vs-tip").inner_text())
    pg.click('[data-action="vs-del"]'); pg.wait_for_timeout(300)
    check("third removed", pg.locator(".vs-hero").count() == 2)
    # ---- affinity chart editing
    cell = lambda a, d: pg.evaluate(f"""(() => {{ const r=[...document.querySelectorAll('.aff tbody tr')].find(t=>t.querySelector('th span').textContent==='{a}'); const i=['Saber','Archer','Lancer','Rider','Caster','Assassin','Berserker','Shielder','Ruler','Avenger','Moon Cancer','Alter Ego','Foreigner','Pretender','Beast'].indexOf('{d}'); return r.querySelectorAll('td')[i].textContent.trim(); }})()""")
    check(f"Saber > Lancer = {cell('Saber','Lancer')}, Lancer > Saber = {cell('Lancer','Saber')}, Beast > Avenger = {cell('Beast','Avenger')}, Berserker > Pretender = {cell('Berserker','Pretender')}",
          cell("Saber", "Lancer") == "2×" and cell("Lancer", "Saber") == "½×" and cell("Beast", "Avenger") == "½×" and cell("Berserker", "Pretender") == "1.5×")
    pg.click('[data-action="aff-edit"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="aff-cycle"][data-a="Beast"][data-d="Berserker"]'); pg.wait_for_timeout(200)
    check(f"cell cycles 1× -> ½× ({cell('Beast','Berserker')!r})", cell("Beast", "Berserker") == "½×")
    pg.click('[data-action="aff-cycle"][data-a="Beast"][data-d="Berserker"]'); pg.wait_for_timeout(200)
    check(f"then -> 2× ({cell('Beast','Berserker')!r})", cell("Beast", "Berserker") == "2×")
    pg.locator(".aff-panel").screenshot(path=f"{sp}/v7-aff-edit.png")
    pg.click('[data-action="aff-edit"]'); pg.wait_for_timeout(200)
    with pg.expect_download() as dl:
        pg.click('#btn-export'); pg.click('[data-action="export"]')
    data = json.load(open(dl.value.path()))
    check(f"backup carries chart changes {data['settings'].get('affinity')}", data["settings"].get("affinity") == {"Beast>Berserker": 2})
    pg.reload(); pg.wait_for_timeout(900); pg.click('[data-action="tab"][data-tab="versus"]'); pg.wait_for_timeout(500)
    check("chart change kept after reload", cell("Beast", "Berserker") == "2×" and pg.locator(".aff td.ov").count() == 1)
    pg.click('[data-action="aff-reset"]'); pg.wait_for_timeout(200); pg.click('[data-action="aff-reset-go"]'); pg.wait_for_timeout(300)
    check("reset to standard", cell("Beast", "Berserker") == "1×" and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:affinity')") is None)
    check("Versus picks kept after reload", pg.evaluate("document.querySelector('[data-vs-pick=\"0\"]').value") == "artoria")
    pg.evaluate("window.scrollTo(0,0)"); pg.screenshot(path=f"{sp}/v7-versus-top.png")
    ctx.close()

    # ---- background: class word + emblem for every class
    classes = ["Saber", "Archer", "Lancer", "Rider", "Caster", "Assassin", "Berserker", "Ruler", "Avenger", "Moon Cancer", "Alter Ego", "Foreigner", "Pretender", "Shielder", "Beast"]
    from PIL import Image, ImageDraw
    for scheme in ["light", "dark"]:
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 900}, color_scheme=scheme)
        pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(700)
        shots = []
        for cl in (classes if scheme == "light" else ["Saber", "Avenger", "Foreigner", "Beast", "Moon Cancer", "Alter Ego"]):
            pg.evaluate("(cl) => { const k='spirit-origin-list:v1', d=JSON.parse(localStorage.getItem(k)); d.servants.find(x=>x.id==='artoria').cls=cl; localStorage.setItem(k, JSON.stringify(d)); }", cl)
            pg.reload(); pg.wait_for_timeout(500); pg.click('[data-id="artoria"]'); pg.wait_for_timeout(2600); pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(200)
            k = pg.evaluate("document.querySelector('.pc-word') && document.querySelector('.pc-word').dataset.k")
            txt = pg.evaluate("document.querySelector('.pc-word') && document.querySelector('.pc-word').textContent")
            if txt != cl.upper(): print("FAIL word", cl, txt)
            f = f"{sp}/v7-bg-{scheme}-{cl.replace(' ', '')}.png"; pg.screenshot(path=f); shots.append((cl, f))
        n = len(shots); cols = 5 if n > 6 else 3
        rows = (n + cols - 1) // cols
        sheet = Image.new("RGB", (cols * 454, rows * 320), "white"); dr = ImageDraw.Draw(sheet)
        for i, (cl, f) in enumerate(shots):
            im = Image.open(f).convert("RGB").resize((454, 300)); sheet.paste(im, ((i % cols) * 454, (i // cols) * 320)); dr.text(((i % cols) * 454 + 6, (i // cols) * 320 + 303), cl, fill="black")
        sheet.save(f"{sp}/v7-bg-{scheme}-sheet.png")
        if scheme == "dark":
            pg.click('[data-id="ereshkigal"]'); pg.wait_for_timeout(600); pg.locator(".skills").scroll_into_view_if_needed(); pg.wait_for_timeout(1000)
            pg.locator(".skills").screenshot(path=f"{sp}/v7-dark-skills.png")
            pg.click('[data-action="tab"][data-tab="versus"]'); pg.wait_for_timeout(700)
            pg.screenshot(path=f"{sp}/v7-dark-versus.png", full_page=True)
        ctx.close()

    # ---- phones
    for wdt in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": wdt, "height": 820})
        pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(800)
        sw = [pg.evaluate("document.documentElement.scrollWidth")]
        pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(300); pg.fill("#sv-name", f"Phone Wish {wdt}"); pg.select_option("#sv-cls", "Archer"); pg.select_option("#sv-rarity", "4"); pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
        pg.click('[data-action="close"]'); pg.wait_for_timeout(300)
        pg.locator(".wish").scroll_into_view_if_needed(); sw.append(pg.evaluate("document.documentElement.scrollWidth")); pg.screenshot(path=f"{sp}/v7-phone{wdt}-wish.png")
        pg.click("#tab-summon"); pg.wait_for_timeout(700); sw.append(pg.evaluate("document.documentElement.scrollWidth")); pg.click(f'.smg [data-action="summon"]'); pg.wait_for_timeout(2700); pg.screenshot(path=f"{sp}/v7-phone{wdt}-summon1.png"); pg.wait_for_timeout(2300)
        pg.screenshot(path=f"{sp}/v7-phone{wdt}-summon2.png"); sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        pg.click(".sm-done"); pg.wait_for_timeout(700)
        pg.click('[data-action="vs-add"]'); pg.wait_for_timeout(700)
        sw.append(pg.evaluate("document.documentElement.scrollWidth")); pg.screenshot(path=f"{sp}/v7-phone{wdt}-versus.png", full_page=True)
        if pg.locator('[data-action="vs-add3"]').count(): pg.click('[data-action="vs-add3"]')
        pg.wait_for_timeout(500); sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        pg.screenshot(path=f"{sp}/v7-phone{wdt}-versus3.png")
        pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(300); pg.click('#list > .row >> nth=0'); pg.wait_for_timeout(900)
        sw.append(pg.evaluate("document.documentElement.scrollWidth")); pg.screenshot(path=f"{sp}/v7-phone{wdt}-dossier.png")
        tabs = pg.evaluate("[document.querySelector('.tabs').scrollWidth, document.querySelector('.tabs').clientWidth]")
        check(f"phone {wdt}: no sideways scroll {sw}, tabs fit {tabs}", max(sw) <= wdt)
        ctx.close()

    # ---- reduced motion: summon goes straight to the result
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1000, "height": 800}, reduced_motion="reduce")
    pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(800)
    pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(300); pg.fill("#sv-name", "Calm Wish"); pg.select_option("#sv-cls", "Ruler"); pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(600)
    pg.click("#tab-summon"); pg.wait_for_timeout(600); pg.click('.smg [data-action="summon"]'); pg.wait_for_timeout(300)
    check("reduced motion: result shown at once", pg.evaluate("document.getElementById('summon').classList.contains('info')"))
    pg.screenshot(path=f"{sp}/v7-rm-summon.png")
    pg.click(".sm-done"); pg.wait_for_timeout(600)
    ctx.close()
print("page errors:", errs)
