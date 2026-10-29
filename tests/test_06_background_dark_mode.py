import os
import sys, tempfile, json
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
NEW = f"{URL}/_seeded.html#servants"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def page(ctx):
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return pg
idle = "document.getElementById('idle-bg') && document.getElementById('idle-bg').classList.contains('on')"
emb = "document.getElementById('page-emblem').classList.contains('on')"
prof = tempfile.mkdtemp()
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000})
    pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(1300)

    # ---- background: servant colours only while picked
    check("resting backdrop on at start, no class emblem", pg.evaluate(idle) and not pg.evaluate(emb))
    pg.click('[data-id="oberon"]'); pg.wait_for_timeout(900)
    check("picking Oberon brings his class backdrop", not pg.evaluate(idle) and pg.evaluate(emb) and "PRETENDER" in pg.evaluate("document.getElementById('page-class').textContent"))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(900)
    check("Esc lets go: the backdrop returns and Oberon stays on show", pg.evaluate(idle) and not pg.evaluate(emb) and pg.evaluate("document.getElementById('page-class').textContent.trim()") == "" and pg.locator("#dossier h2").first.inner_text() == "Oberon")
    pg.click('[data-id="oberon"]'); pg.wait_for_timeout(700)
    pg.click('[data-action="tab"][data-tab="ranking"]'); pg.wait_for_timeout(700)
    check("another tab shows the resting backdrop", pg.evaluate(idle) and not pg.evaluate(emb))
    pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(900)
    check("back on Servants, Oberon's backdrop again", not pg.evaluate(idle) and pg.evaluate(emb))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(800)
    check("Escape lets go on desktop", pg.evaluate(idle))
    pg.screenshot(path=f"{sp}/v9-idle-desktop.png")

    # ---- theme switch
    tg = pg.locator("#theme-tgl")
    check("theme switch in the header", tg.count() == 1 and tg.get_attribute("aria-pressed") == "false")
    tg.click(); pg.wait_for_timeout(1500)
    print("   theme now:", pg.evaluate("document.documentElement.dataset.theme"), pg.evaluate("localStorage.getItem('spirit-origin-list:v1:theme')"), tg.get_attribute("aria-pressed"))
    check("switch turns dark mode on and saves it", pg.evaluate("document.documentElement.dataset.theme") == "dark" and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:theme')") == "dark" and tg.get_attribute("aria-pressed") == "true")
    pg.screenshot(path=f"{sp}/v9-dark-idle.png")
    pg.reload(); pg.wait_for_timeout(1000)
    check("dark mode kept after reload", pg.evaluate("document.documentElement.dataset.theme") == "dark" and pg.locator("#theme-tgl").get_attribute("aria-pressed") == "true")
    pg.locator("#theme-tgl").click(); pg.wait_for_timeout(900)
    check("and back to light", pg.evaluate("document.documentElement.dataset.theme") == "light")

    # ---- Guests: tab gone, wishlist renamed, old guests moved over
    check("Guests tab removed (eight tabs since Story joined in 0.24.0)", pg.locator('#tab-guests').count() == 0 and pg.locator(".tabs .tab").count() == 8)
    head = pg.locator(".wish-head h2").inner_text()
    check(f"wishlist is now 'Guests' ({head!r})", head.startswith("Guests") and pg.locator('[data-action="add-wish"]').inner_text().strip() == "+ Add guest")
    d = pg.evaluate(LS)
    old = d.get("guests", [])
    moved = [g for g in old if g.get("movedTo")]
    names = {s["name"] for s in d["servants"] if s.get("wish")}
    check(f"old guest entries moved into Guests and kept ({len(moved)}/{len(old)})", old and len(moved) == len(old) and all(g["name"] in names or any(s["name"] == g["name"] for s in d["servants"]) for g in old))
    pg.click('[data-action="tab"][data-tab="parties"]'); pg.wait_for_timeout(400)
    if pg.locator('[data-action="edit-party"]').count():
        pg.locator('[data-action="edit-party"]').first.click(); pg.wait_for_timeout(400)
        groups = pg.evaluate("Array.from(document.querySelectorAll('#pt-guest optgroup')).map(g=>g.label)")
        check(f"party guest picker lists Guests first {groups}", groups and groups[0] == "Guests")
        pg.click('[data-action="cancel-party"]') if pg.locator('[data-action="cancel-party"]').count() else None
    pg.click('[data-action="tab"][data-tab="servants"]'); pg.wait_for_timeout(400)

    # ---- Fou tiers
    pg.click('[data-id="space-ereshkigal"]'); pg.wait_for_timeout(700)
    def fou(v):
        pg.fill("#fou-hp", str(v)); pg.press("#fou-hp", "Tab"); pg.wait_for_timeout(800)
        return pg.evaluate("document.querySelector('#dossier .stat .v').className")
    check("Fou 800 is silver", "fou-s" in fou(800))
    check("Fou 1,500 is gold", "fou-g" in fou(1500))
    check("Fou 2,600 is rainbow", "fou-r" in fou(2600))
    fou(3000)
    check("Fou goes up to 3,000", pg.evaluate(LS + ".servants.find(s=>s.id==='space-ereshkigal').fouHp") == 3000)
    pg.locator("#dossier .stat-grid").screenshot(path=f"{sp}/v9-fou.png")

    # ---- skills: colour by level, Lv 10 party
    pg.click('[data-id="artoria"]'); pg.wait_for_timeout(500); pg.click('[data-action="edit"]'); pg.wait_for_timeout(500)
    pg.fill("#sv-s1-name", "Charisma"); pg.fill("#sv-s1-rank", "B"); pg.fill("#sv-s2-name", "Mana Burst"); pg.fill("#sv-s2-rank", "A"); pg.fill("#sv-s3-name", "Instinct"); pg.fill("#sv-s3-rank", "EX")
    pg.select_option("#sv-sk0", "3"); pg.select_option("#sv-sk1", "9"); pg.select_option("#sv-sk2", "10")
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(800)
    ps = pg.evaluate("Array.from(document.querySelectorAll('#dossier .skills .skill')).map(k=>[k.className, k.style.getPropertyValue('--sk-p')])")
    check(f"skills carry their level strength {ps}", ps[0][1].strip() == "0.3" and ps[1][1].strip() == "0.9" and "tier-ex" in ps[2][0] and "sk-max" in ps[2][0])
    c0, c1 = pg.evaluate("Array.from(document.querySelectorAll('#dossier .skills .skill')).slice(0,2).map(k=>getComputedStyle(k).borderTopColor)")
    check(f"lower level shows less colour ({c0} vs {c1})", c0 != c1)
    pg.locator("#dossier .skills").screenshot(path=f"{sp}/v9-skills-tiers.png")
    pg.click('[data-action="bump"][data-f="sk1"][data-d="1"]'); pg.wait_for_timeout(150)
    check("raising a skill to 10 plays the celebration", pg.locator("#dossier .skill.sk-celebrate .sk-stamp").count() == 1 and pg.locator("#dossier .status.grail.pop").count() == 1)
    pg.wait_for_timeout(400); pg.locator("#dossier .skills").screenshot(path=f"{sp}/v9-skill-celebrate.png")
    pips = pg.evaluate("Array.from(document.querySelectorAll('[data-id=\"artoria\"] .pip')).map(x=>x.className)")
    check(f"roster pips tinted by rank {pips}", "t-b" in pips[0] and "t-a" in pips[1] and "t-ex" in pips[2])

    # ---- stage art: crossfade and accent colour
    pg.click('[data-action="edit"]'); pg.wait_for_timeout(500)
    pg.set_input_files('input[data-form-art="1"]', f"{sp}/ph_red.png"); pg.wait_for_timeout(600)
    pg.set_input_files('input[data-form-art="2"]', f"{sp}/ph_blue.png"); pg.wait_for_timeout(600)
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(1400)
    acc1 = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--art-l').trim()")
    pg.click('#dossier .stage-btn[data-slot="2"]'); pg.wait_for_timeout(120)
    check("switching stage crossfades the portrait", pg.locator("#dossier .art-frame .art-ghost").count() == 1 and pg.locator("#dossier .art-frame img.art-in").count() == 1)
    pg.wait_for_timeout(1600)
    acc2 = pg.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--art-l').trim()")
    check(f"accent follows the art ({acc1} -> {acc2})", acc1 and acc2 and acc1 != acc2)
    check("ghost removed afterwards", pg.locator("#dossier .art-frame .art-ghost").count() == 0)
    vcol = pg.evaluate("getComputedStyle(document.querySelector('#dossier .stat .k')).color")
    print("   stat label colour:", vcol)
    pg.locator("#dossier .scene").screenshot(path=f"{sp}/v9-art-accent.png")

    # ---- command cards: 3D hover
    for i in range(5):
        pg.locator("#dossier .deck .cmd").nth(i).click(); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1000)
    c = pg.locator("#dossier .deck .cmd").nth(2); c.scroll_into_view_if_needed(); pg.wait_for_timeout(200); b = c.bounding_box()
    pg.mouse.move(b["x"] + b["width"] * 0.85, b["y"] + b["height"] * 0.2, steps=5); pg.wait_for_timeout(250)
    st = c.get_attribute("style") or ""
    check(f"hovering a command card tilts it ({c.get_attribute('class')})", "tilt" in c.get_attribute("class") and "--rx" in st and c.locator(".cmd-glare").count() == 1)
    pg.locator("#dossier .deck-sec").screenshot(path=f"{sp}/v9-deck-tilt.png")
    pg.mouse.move(5, 5); pg.wait_for_timeout(300)
    check("leaving the card settles it", "tilt" not in (c.get_attribute("class") or ""))

    # ---- NP atmospheres
    for sid, k in (("artoria", "buster"), ("space-ereshkigal", "arts"), ("salter-rider", "quick")):
        pg.click(f'[data-id="{sid}"]'); pg.wait_for_timeout(500)
        box = pg.locator("#dossier .npt-box")
        check(f"{sid} NP table has the {k} atmosphere", box.get_attribute("data-atmo") == k and box.locator(f'.npt-atmo[data-k="{k}"] i').count() >= 6)
        box.scroll_into_view_if_needed(); pg.wait_for_timeout(900); box.locator(".npt-title").screenshot(path=f"{sp}/v9-np-{k}.png")

    # ---- grails
    pg.click('[data-id="cu-chulainn-alter"]'); pg.wait_for_timeout(500)
    check("Lv 100 gets the gold frame", pg.locator("#dossier .scene.gr100 .gr-ring").count() == 1 and pg.locator('#list .row.gr100[data-id="cu-chulainn-alter"]').count() == 1)
    pg.click('[data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(200); pg.click('[data-action="bump"][data-f="level"][data-d="1"]'); pg.wait_for_timeout(500)
    check("Lv 102 gets the gold and rainbow frame", pg.locator("#dossier .scene.gr102 .gr-ring").count() == 1 and pg.locator('#list .row.gr102[data-id="cu-chulainn-alter"]').count() == 1)
    pg.locator("#dossier .scene").screenshot(path=f"{sp}/v9-grail102.png")

    # ---- summon a Guest with stats filled: card back, slow reveal, caption, stats reset
    pg.click('[data-action="add-wish"]'); pg.wait_for_timeout(400)
    pg.fill("#sv-name", "Test Guest"); pg.select_option("#sv-cls", "Caster"); pg.select_option("#sv-rarity", "5")
    pg.fill("#sv-level", "90"); pg.select_option("#sv-np", "3"); pg.fill("#sv-hp", "14000"); pg.fill("#sv-atk", "11000"); pg.fill("#sv-fouhp", "1000"); pg.fill("#sv-fouatk", "1000")
    for i in range(3): pg.select_option(f"#sv-sk{i}", "10")
    pg.set_input_files('input[data-form-art="1"]', f"{sp}/ph_purple.png"); pg.wait_for_timeout(600)
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(900)
    gid = pg.evaluate(LS + ".servants.find(s=>s.name==='Test Guest').id")
    pg.click("#tab-summon"); pg.wait_for_timeout(600); pg.click(f'.smg [data-action="summon"][data-id="{gid}"]')
    pg.wait_for_timeout(3300)
    check("the card shows the blue back", pg.locator(".s2-cover img").count() == 1 and "webp" in pg.locator(".s2-cover img").first.get_attribute("src")[:30])
    pg.screenshot(path=f"{sp}/v9-sum-a.png")
    pg.wait_for_timeout(1700)
    check("the back opens onto the art", pg.evaluate("document.getElementById('summon').classList.contains('unveil')"))
    pg.screenshot(path=f"{sp}/v9-sum-b.png")
    pg.wait_for_timeout(900)
    hss = pg.locator(".sm-hss").inner_text()
    check(f"gold caption reads 'Heroic Spirit Summoned' ({hss!r})", "Heroic Spirit Summoned".lower() in hss.lower().replace("\n", "") and pg.evaluate("document.getElementById('summon').classList.contains('hss')"))
    pg.screenshot(path=f"{sp}/v9-sum-c.png")
    pg.wait_for_timeout(1500)
    pg.screenshot(path=f"{sp}/v9-sum-d.png")
    pg.click(".sm-done"); pg.wait_for_timeout(900)
    g = pg.evaluate(LS + f".servants.find(s=>s.id==='{gid}')")
    check(f"summoned at the start: Lv {g.get('level')} NP{g.get('npLevel')} skills {g.get('skills')} HP {g.get('hp')} Fou {g.get('fouHp')}",
          "wish" not in g and g["level"] == 1 and g["npLevel"] == 1 and g["skills"] == [1, "Locked", "Locked"] and g.get("hp") is None and g.get("fouHp") == 0)
    check(f"filled stats kept as a goal {g.get('goal')}", g.get("goal", {}).get("level") == 90 and g["goal"]["hp"] == 14000 and pg.locator("#dossier .goal-line").count() == 1)
    btn = pg.locator("#toast .toast-btn")
    check("toast offers to keep the old stats", btn.count() == 1)
    btn.click(); pg.wait_for_timeout(800)
    g = pg.evaluate(LS + f".servants.find(s=>s.id==='{gid}')")
    check(f"…which puts them back (Lv {g.get('level')}, skills {g.get('skills')})", g["level"] == 90 and g["skills"] == [10, 10, 10] and g["hp"] == 14000 and "goal" not in g and "wish" not in g)
    ctx.close()

    # ---- phones
    for w in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": w, "height": 820})
        pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(1000)
        check(f"{w}px: resting backdrop at start", pg.evaluate(idle))
        sw = pg.evaluate("document.documentElement.scrollWidth")
        check(f"{w}px: no sideways scroll ({sw})", sw <= w)
        pg.screenshot(path=f"{sp}/v9-phone{w}-idle.png")
        pg.click('[data-id="space-ereshkigal"] >> nth=0'); pg.wait_for_timeout(900)
        check(f"{w}px: picking a servant brings their backdrop", not pg.evaluate(idle))
        pg.locator("#dossier .npt-box").scroll_into_view_if_needed(); pg.wait_for_timeout(400)
        pg.screenshot(path=f"{sp}/v9-phone{w}-np.png")
        pg.click('#dossier [data-action="close"]'); pg.wait_for_timeout(900)
        check(f"{w}px: ← Roster puts the resting backdrop back", pg.evaluate(idle) and not pg.evaluate(emb))
        sw = pg.evaluate("document.documentElement.scrollWidth")
        check(f"{w}px: still no sideways scroll ({sw})", sw <= w)
        ctx.close()

    # ---- dark mode look
    ctx = p.chromium.launch_persistent_context(tempfile.mkdtemp(), viewport={"width": 1360, "height": 1000}, color_scheme="dark")
    pg = page(ctx); pg.goto(NEW); pg.wait_for_timeout(1200)
    check("system dark mode shows the switch as dark", pg.locator("#theme-tgl").get_attribute("aria-pressed") == "true")
    pg.screenshot(path=f"{sp}/v9-dark-desktop.png")
    pg.click('[data-id="space-ereshkigal"]'); pg.wait_for_timeout(900)
    pg.fill("#fou-hp", "1500"); pg.press("#fou-hp", "Tab"); pg.wait_for_timeout(300); pg.fill("#fou-atk", "800"); pg.press("#fou-atk", "Tab"); pg.wait_for_timeout(1200)
    pg.locator("#dossier .stat-grid").screenshot(path=f"{sp}/v9-dark-fou.png")
    pg.locator("#dossier .npt-box").screenshot(path=f"{sp}/v9-dark-np.png")
    pg.locator("#dossier .skills").screenshot(path=f"{sp}/v9-dark-skills.png")
    ctx.close()
check("no page errors", not errs)
if errs: print(errs[:6])
print("FAILS:", len(fails))
