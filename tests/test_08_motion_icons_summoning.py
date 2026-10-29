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
SMS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1:summon'))"
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script("if (!localStorage.getItem('spirit-origin-list:v1:summon')) localStorage.setItem('spirit-origin-list:v1:summon', JSON.stringify({anim: false}))"); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    return pg
def srv(pg, sid):
    d = pg.evaluate(LS); v = d["servants"]
    return v.get(sid) if isinstance(v, dict) else next((x for x in v if x.get("id") == sid), None)
prof = tempfile.mkdtemp()
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context(prof, viewport={"width": 1360, "height": 1000})
    pg = page(ctx); pg.goto(BASE + "#servants"); pg.wait_for_timeout(1600)

    # ---- frame-rate switch
    fb = pg.locator("#fps-btn")
    check("fps button starts at 60", fb.get_attribute("data-fps") == "60")
    fb.click(); pg.wait_for_timeout(500)
    st = pg.evaluate("""() => { const run = document.getAnimations().filter(a => a instanceof CSSAnimation && a.playState === 'running' && !(a.effect.target.closest && a.effect.target.closest('#summon')));
      const k = 1000 / 30, ok = run.filter(a => { const t = a.effect.getTiming(); return String(t.easing).startsWith('steps(') && Math.abs(t.duration / k - Math.round(t.duration / k)) < 1e-6; });
      return [run.length, ok.length]; }""")
    check(f"30 fps: the CSS animations move in 1/30 s steps on the graphics card ({st[1]} of {st[0]})", fb.get_attribute("data-fps") == "30" and st[0] > 0 and st[0] == st[1])
    t1 = pg.evaluate("(() => { const a = document.getAnimations().find(a => a instanceof CSSAnimation && a.playState === 'running'); return a ? a.currentTime : null; })()")
    pg.wait_for_timeout(400)
    t2 = pg.evaluate("(() => { const a = document.getAnimations().find(a => a instanceof CSSAnimation && a.playState === 'running'); return a ? a.currentTime : null; })()")
    check(f"and they keep running ({t1} → {t2})", t1 is not None and t2 is not None and t2 > t1)
    fb.click(); pg.wait_for_timeout(300)
    check("then 15 fps", fb.get_attribute("data-fps") == "15" and pg.evaluate("localStorage.getItem('spirit-origin-list:v1:fps')") == "15")
    pg.reload(); pg.wait_for_timeout(1400)
    check("15 fps kept after reload", pg.locator("#fps-btn").get_attribute("data-fps") == "15")
    pg.locator("#fps-btn").click(); pg.wait_for_timeout(400)
    check("and back to 60 with everything playing", pg.locator("#fps-btn").get_attribute("data-fps") == "60" and pg.evaluate("document.getAnimations().filter(a => a.playState === 'paused' && !(a.effect.target.closest && a.effect.target.closest('[data-off]'))).length") == 0)

    # ---- icons on effect lines
    pg.click('#list .row[data-id="oberon"]'); pg.wait_for_timeout(1000)
    slots = pg.locator("#dossier .skill .ln-ic")
    check(f"every skill line has an icon slot ({slots.count()})", slots.count() >= 3 and slots.count() == pg.locator("#dossier .skill .effect .ln").count())
    check("lines get a guessed icon", pg.locator("#dossier .skill .ln-ic.auto .ic").count() >= 1)
    check("NP effect line has an icon slot", pg.locator("#dossier .npt .ln-ic").count() >= 1)
    first = slots.first; k = first.get_attribute("data-k")
    first.click(); pg.wait_for_timeout(300)
    check(f"picker opens with your 153 icons and the game's 239 ({pg.locator('#ic-pick .ic-grid button').count()})", pg.locator("#ic-pick").is_visible() and pg.locator("#ic-pick .ic-grid.ig-set button").count() == 153 and pg.locator("#ic-pick .ic-grid.ig-buff button").count() == 119 and pg.locator("#ic-pick .ic-grid.ig-skill button").count() == 120)
    pg.fill(".ic-q", "heal"); pg.wait_for_timeout(100)
    vis = pg.locator(".ic-grid button:not([hidden])").count()
    check(f"search narrows the icons ({vis})", 0 < vis < 40)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check("Esc closes the picker, not the servant", pg.locator("#ic-pick").is_hidden() and pg.locator("#dossier h2").first.inner_text() == "Oberon")
    first.click(); pg.wait_for_timeout(300)
    pg.click('.ic-grid button[data-ic="Hpregen"]'); pg.wait_for_timeout(900)
    s = srv(pg, "oberon")
    check("picked icon saved with the servant", s and s.get("lineIcons", {}).get(k) == "Hpregen")
    check("slot shows the picked icon", pg.locator(f'#dossier .ln-ic[data-k="{k}"]').first.get_attribute("class").split()[-1] == "mine")
    pg.locator(f'#dossier .ln-ic[data-k="{k}"]').first.click(); pg.wait_for_timeout(200); pg.click('#ic-pick [data-ic="none"]'); pg.wait_for_timeout(700)
    check("No icon leaves an empty slot", srv(pg, "oberon")["lineIcons"][k] == "none" and pg.locator(f'#dossier .ln-ic[data-k="{k}"] .ic-add').count() >= 1)
    pg.locator(f'#dossier .ln-ic[data-k="{k}"]').first.click(); pg.wait_for_timeout(200); pg.click('#ic-pick [data-ic="auto"]'); pg.wait_for_timeout(700)
    check("Automatic goes back to the guess", "lineIcons" not in srv(pg, "oberon") and "auto" in pg.locator(f'#dossier .ln-ic[data-k="{k}"]').first.get_attribute("class"))
    pg.reload(); pg.wait_for_timeout(1400)
    pg.click('#list .row[data-id="oberon"]'); pg.wait_for_timeout(900)
    pg.locator("#dossier .skill .ln-ic").nth(1).click(); pg.wait_for_timeout(200); pg.click('.ic-grid button[data-ic="NpCharge"]'); pg.wait_for_timeout(700)
    pg.reload(); pg.wait_for_timeout(1400); pg.click('#list .row[data-id="oberon"]'); pg.wait_for_timeout(900)
    check("picked icons survive a reload", pg.locator("#dossier .skill .ln-ic.mine").count() == 1)
    pg.locator("#dossier .skill").first.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    pg.locator("#dossier .skills").first.screenshot(path=f"{sp}/v11-icons-skills.png")
    pg.locator("#dossier .ln-ic").first.click(); pg.wait_for_timeout(300); pg.screenshot(path=f"{sp}/v11-icons-picker.png"); pg.keyboard.press("Escape")
    pg.locator("#ic-pick .ic-auto-in").evaluate("el => { el.checked = false; el.dispatchEvent(new Event('change', {bubbles: true})); }"); pg.wait_for_timeout(500)
    check("turning guesses off hides guessed icons", pg.locator("#dossier .ln-ic.auto").count() == 0 and pg.locator("#dossier .ln-ic.mine").count() == 1)
    pg.locator("#ic-pick .ic-auto-in").evaluate("el => { el.checked = true; el.dispatchEvent(new Event('change', {bubbles: true})); }"); pg.wait_for_timeout(500)

    # ---- Servants and Home no longer summon; they point to Summoning
    check("Guests list has no Summon buttons", pg.locator('.wish [data-action="summon"]').count() == 0 and pg.locator('.wish [data-tab="summon"]').count() == 1)
    pg.click('.wish-row [data-id="merlin"]'); pg.wait_for_timeout(700)
    check("Guest page points to Summoning", pg.locator('.wish-banner [data-action="to-summon"]').count() == 1 and pg.locator('#dossier [data-action="summon"]').count() == 0)
    pg.click('.wish-banner [data-action="to-summon"]'); pg.wait_for_timeout(900)
    check("Go to Summoning opens the page at that Guest", pg.evaluate("location.hash") == "#summon" and pg.locator("#smg-merlin").count() == 1)

    # ---- Summoning page
    check("eight tabs, Story then Summoning after Servants (Story joined in 0.24.0)", pg.locator(".tabs .tab").count() == 8 and pg.locator(".tabs .tab").nth(2).inner_text() == "Story" and pg.locator(".tabs .tab").nth(3).inner_text() == "Summoning")
    check("Guests can be summoned here", pg.locator('.smg [data-action="summon"]').count() == 5)
    n35 = pg.evaluate("(" + LS + ").servants") ; n35 = len([x for x in (n35.values() if isinstance(n35, dict) else n35) if x.get("rarity") in (3, 4, 5)])
    check(f"drop chances list every ★3–★5 servant ({pg.locator('.smc').count()} of {n35})", pg.locator(".smc").count() == n35)
    pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(500)
    check("11 cards dealt face down", pg.locator(".smr-list.deal .smr").count() == 11)
    pg.wait_for_timeout(3200)
    st = pg.evaluate(SMS)
    last = st["last"]
    check(f"11 summons for 30 Saint Quartz (n={st['n']}, sq={st['sq']})", st["n"] == 11 and st["sq"] == 30 and len(last) == 11)
    check("an 11-summon has a servant and a ★4 or higher", any(x["k"] == "s" for x in last) and any(x["r"] >= 4 for x in last))
    pg.click('[data-action="sm-roll"][data-n="1"]'); pg.wait_for_timeout(300)
    pg.click('[data-action="sm-reveal"]'); pg.wait_for_timeout(200)
    st = pg.evaluate(SMS)
    check("a single summon costs 3", st["n"] == 12 and st["sq"] == 33 and pg.locator(".smr-list .smr").count() == 1 and pg.locator(".smr-list.now").count() == 1)
    pg.select_option('[data-sm-feat="5"]', "space-ishtar"); pg.wait_for_timeout(500)
    st = pg.evaluate(SMS)
    check("featuring a ★5 starts a new banner", st["f5"] == "space-ishtar" and st["n"] == 0 and "Space Ishtar" in pg.locator(".smh-title").inner_text())
    pg.click("#toast .toast-btn"); pg.wait_for_timeout(400)
    st = pg.evaluate(SMS)
    check("and Undo puts the old banner back", st["n"] == 12 and not st["f5"])
    pg.select_option('[data-sm-feat="5"]', "space-ishtar"); pg.wait_for_timeout(400)
    pg.fill('[data-sm-calc="sq"]', "900"); pg.wait_for_timeout(400)
    big = pg.locator(".smo-big").inner_text()
    check(f"900 Saint Quartz is the guarantee ({big[:60]!r})", "330 summons" in big and "100%" in big)
    rows = pg.locator(".smo-t tbody tr")
    check("odds table: 30 SQ ≈ 8.46%", rows.count() == 6 and "8.46%" in rows.first.inner_text())
    pg.click('[data-action="sm-until"]'); pg.wait_for_timeout(600)
    st = pg.evaluate(SMS)
    check(f"until the rate-up: got her on summon {st['got']} (≤ 330)", 0 < st["got"] <= 330 and st["n"] >= st["got"] and any(x.get("f") and x["r"] == 5 for x in st["last"]))
    check("summary names the run", "Space Ishtar came on summon" in pg.locator(".smr-sum").inner_text())
    pg.wait_for_timeout(3000)
    pg.screenshot(path=f"{sp}/v11-summon-desktop.png")
    pg.screenshot(path=f"{sp}/v11-summon-full.png", full_page=True)
    # the guarantee itself, on a banner where luck never comes
    pg.evaluate("Math.random = () => 0.9999")
    pg.click('[data-action="sm-until"]'); pg.wait_for_timeout(500)
    st = pg.evaluate(SMS)
    check(f"with no luck at all, summon 330 is the guarantee (got {st['got']})", st["got"] == 330 and any(x.get("pity") for x in st["last"]) and "the guarantee" in pg.locator(".smr-sum").inner_text())
    pg.reload(); pg.wait_for_timeout(1400)
    check("the banner is kept after reload", pg.evaluate("location.hash") == "#summon" and pg.locator(".smr-list .smr").count() == 11 and pg.locator(".smr-list.deal").count() == 0)
    # summon a Guest for real from here
    pg.click('.smg [data-action="summon"][data-id="merlin"]'); pg.wait_for_timeout(300); pg.keyboard.press("Escape"); pg.wait_for_timeout(500); pg.keyboard.press("Escape"); pg.wait_for_timeout(900)
    m = srv(pg, "merlin")
    check("Summon on the Summoning page adds the Guest to your roster", m and not m.get("wish") and pg.evaluate("location.hash") == "#servants")

    # ---- Home
    pg.click("#tab-home"); pg.wait_for_timeout(1200)
    check("Home has no Summon buttons, a Summoning block instead", pg.locator('#home [data-action="summon"]').count() == 0 and pg.locator(".hm-b-sum").count() == 1)
    log = pg.evaluate("JSON.parse(localStorage.getItem('spirit-origin-list:v1:log') || '[]')")
    check(f"recent progress logged the summon ({[x['k'] for x in log][:3]})", any(x["k"] == "summon" and x["id"] == "merlin" for x in log) and "Summoned" in pg.locator(".hm-b-log").inner_text())
    pg.click('.hv-c[data-cls="Caster"]'); pg.wait_for_timeout(300)
    check("Up against Caster: best answers listed with 2×", pg.locator(".hm-b-vs .hv-x.a2").count() >= 1)
    check("19 Master records with some earned", pg.locator(".rec").count() == 19 and pg.locator(".rec.done").count() >= 1)
    pg.fill("#hm-find", "nito"); pg.press("#hm-find", "Enter"); pg.wait_for_timeout(900)
    check("find a servant from Home", pg.evaluate("location.hash") == "#servants" and pg.locator("#dossier h2").first.inner_text() == "Nitocris Alter")
    pg.click("#tab-home"); pg.wait_for_timeout(900)
    check("Up against choice kept", pg.locator('.hv-c.on').get_attribute("data-cls") == "Caster")
    pg.screenshot(path=f"{sp}/v11-home-desktop.png", full_page=True)

    # ---- dark mode
    pg.click('[data-action="theme"]'); pg.wait_for_timeout(900)
    pg.click("#tab-summon"); pg.wait_for_timeout(900)
    pg.screenshot(path=f"{sp}/v11-summon-dark.png")
    pg.click("#tab-home"); pg.wait_for_timeout(900)
    pg.locator(".hm-b-rec").scroll_into_view_if_needed(); pg.wait_for_timeout(300); pg.screenshot(path=f"{sp}/v11-home-dark.png")
    pg.click('[data-action="theme"]'); pg.wait_for_timeout(900)
    ctx.close()

    # ---- phones
    for wdt in (360, 400):
        ctx = p.chromium.launch_persistent_context(prof, viewport={"width": wdt, "height": 800})
        pg = page(ctx); pg.goto(BASE + "#summon"); pg.wait_for_timeout(1400)
        tb = pg.evaluate("(() => { const t = document.querySelector('.tabs'); return [t.scrollWidth, t.clientWidth]; })()")
        check(f"{wdt}px: all seven tabs fit ({tb})", tb[0] <= tb[1] + 1)
        sw = [pg.evaluate("document.documentElement.scrollWidth")]
        pg.click('[data-action="sm-roll"][data-n="11"]'); pg.wait_for_timeout(3600)
        pg.locator("#sm-results").scroll_into_view_if_needed(); pg.screenshot(path=f"{sp}/v11-phone{wdt}-summon.png")
        sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        pg.click("#tab-home"); pg.wait_for_timeout(1000); sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        pg.locator(".hm-b-vs").scroll_into_view_if_needed(); pg.screenshot(path=f"{sp}/v11-phone{wdt}-home.png")
        pg.click("#tab-servants"); pg.wait_for_timeout(700); pg.click('#list .row[data-id="oberon"]'); pg.wait_for_timeout(900)
        pg.locator("#dossier .skill .ln-ic").first.scroll_into_view_if_needed(); pg.locator("#dossier .skill .ln-ic").first.click(); pg.wait_for_timeout(300)
        r = pg.evaluate("(() => { const b = document.getElementById('ic-pick').getBoundingClientRect(); return [b.left, b.right, b.bottom, innerWidth, innerHeight]; })()")
        check(f"{wdt}px: picker is a bottom sheet ({[round(x) for x in r]})", abs(r[0]) < 1 and abs(r[1] - r[3]) < 1 and abs(r[2] - r[4]) < 1)
        pg.screenshot(path=f"{sp}/v11-phone{wdt}-picker.png"); pg.keyboard.press("Escape")
        sw.append(pg.evaluate("document.documentElement.scrollWidth"))
        check(f"{wdt}px: no sideways scroll ({sw})", max(sw) <= wdt)
        ctx.close()
check("no page errors" + (": " + "; ".join(errs[:3]) if errs else ""), not errs)
print("FAILS:", len(fails))
