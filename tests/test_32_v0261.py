import os
# 0.26.1: Guests (Remove from Guests with Undo, a removed stage picture comes back: Undo, Use NA's picture, Fill in),
# "Your Guests" in the support picker are the real Guests, green checks for what's cleared on the Story page, Worth
# borrowing, the livelier chapter backdrops (the summoning circle stays, in the chapter's colours), and the hosted site's
# robots.txt, 404 page and HSTS header. (Friends' story progress, friends' servants as Guests and Versus picks from the
# list are in tests/api/test_hosted_ui.py.)
import sys, json, re
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FX = os.path.join(ROOT, "tests", "fixtures", "story")
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
STK = "spirit-origin-list:v1:story"
def atlas(route):
    u = route.request.url
    m = re.search(r"/nice/NA/war/(\d+)", u); f = f"{FX}/war-{m.group(1)}.json" if m else ""
    if not m:
        m = re.search(r"/nice/NA/quest/(\d+)/(\d+)", u); f = f"{FX}/quest-{m.group(1)}-{m.group(2)}.json" if m else ""
    if f and os.path.exists(f): route.fulfill(path=f, content_type="application/json", headers={"Access-Control-Allow-Origin": "*"})
    else: route.fulfill(status=404, body="{}", headers={"Access-Control-Allow-Origin": "*"})
def page(b, story=None, w=1440, h=900, dark=False):
    ctx = b.new_context(viewport={"width": w, "height": h}, color_scheme="dark" if dark else "light")
    pg = ctx.new_page(); pg.add_init_script(INIT + (";localStorage.setItem('%s', %s)" % (STK, json.dumps(json.dumps(story))) if story else ""))
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", atlas)
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/{'ph_art.png' if 'CharaGraph' in r.request.url else 'ph_face.png'}", content_type="image/png"))
    return ctx, pg
def guest(pg, gid): return next((x for x in pg.evaluate(LS)["servants"] if x["id"] == gid), None)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx, pg = page(b)
    pg.goto(SEEDED + "#past"); pg.wait_for_timeout(1500)
    # ---------- a Guest from Past Chaldea, and its pictures ----------
    pg.fill('[data-pc-q="q"]', "Morgan"); pg.wait_for_timeout(500)
    pg.locator('.pc-card[aria-label^="Morgan,"]').first.click(); pg.wait_for_timeout(700)
    pg.click('[data-action="pc-add"]'); pg.wait_for_timeout(800); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    g = guest(pg, "morgan")
    check(f"Morgan is a Guest with NA's four stage pictures ({sorted((g or {}).get('art', {}))})", g and g.get("wish") and all(k in g["art"] for k in "1234"))
    st1 = g["art"]["1"]
    pg.click("#tab-servants"); pg.wait_for_timeout(500); pg.locator('#list [data-id="morgan"]').first.click(); pg.wait_for_timeout(800)
    acts = pg.evaluate("[...document.querySelectorAll('#dossier .wish-banner button')].map(b => b.textContent.trim())")
    check(f"the Guest's page has Remove from Guests next to Go to Summoning ({acts})", acts == ["Go to Summoning", "Remove from Guests"])
    pg.click('#dossier [data-action="stage"][data-slot="1"]'); pg.wait_for_timeout(300)
    check("the button under the picture says what it removes", pg.locator('#dossier [data-action="art-remove"]').inner_text().strip() == "Remove picture")
    pg.click('#dossier [data-action="art-remove"]'); pg.wait_for_timeout(200)
    check("and asking first says the servant stays", "Morgan stays in your Guests" in pg.locator("#dossier .art-side .confirm").inner_text())
    pg.click('#dossier [data-action="art-remove-go"]'); pg.wait_for_timeout(600)
    check("the Stage 1 picture is gone", "1" not in guest(pg, "morgan")["art"])
    pg.locator('#toast .toast-btn').click(); pg.wait_for_timeout(600)
    check("Undo brings it back", guest(pg, "morgan")["art"].get("1") == st1)
    pg.click('#dossier [data-action="stage"][data-slot="1"]'); pg.wait_for_timeout(200)
    pg.click('#dossier [data-action="art-remove"]'); pg.wait_for_timeout(200); pg.click('#dossier [data-action="art-remove-go"]'); pg.wait_for_timeout(600)
    pg.click('#dossier [data-action="stage"][data-slot="1"]'); pg.wait_for_timeout(300)
    check("an empty stage offers NA's picture", pg.locator('#dossier [data-action="art-na"]').count() == 1)
    fill = pg.locator("#dossier .fill-one").inner_text() if pg.locator("#dossier .fill-one").count() else ""
    check(f"and Fill in knows it's missing ({fill[:60]})", "Missing the Stage 1 picture" in fill)
    pg.click('#dossier [data-action="art-na"]'); pg.wait_for_timeout(600)
    check("Use NA's picture puts it back", guest(pg, "morgan")["art"].get("1") == st1)
    pg.click('#dossier [data-action="stage"][data-slot="2"]'); pg.wait_for_timeout(200)
    pg.click('#dossier [data-action="art-remove"]'); pg.wait_for_timeout(200); pg.click('#dossier [data-action="art-remove-go"]'); pg.wait_for_timeout(600)
    pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
    pg.click('#dossier [data-action="fill-one"]'); pg.wait_for_timeout(700)
    g = guest(pg, "morgan")
    check(f"Fill in puts back a missing stage picture even when the servant has others ({sorted(g['art'])})", "2" in g["art"] and g["art"]["1"] == st1)
    # ---------- the support picker's Guests ----------
    pg.locator('#list [data-id="cu-chulainn-alter"]').first.click(); pg.wait_for_timeout(800)
    pg.evaluate("(() => { const d = document.querySelector('#dossier details.npc'); if (d && !d.open) d.querySelector('summary').click(); })()"); pg.wait_for_timeout(300)
    pg.click('#dossier [data-npc-pick="0"]'); pg.wait_for_selector(".spk:not([hidden]) [data-spk]", timeout=5000)
    gs = pg.evaluate("(() => { const h = [...document.querySelectorAll('.spk-g')].find(g => g.querySelector('h3').textContent.startsWith('Your Guests')); return h ? [...h.querySelectorAll('[data-spk]')].map(x => x.dataset.spk) : []; })()")
    check(f"the support picker's Your Guests are the Guests on the Servants page ({gs})", "r:morgan" in gs and "r:castoria-altria-caster" in gs and not any(x.startswith("g:") for x in gs))
    pg.click('.spk [data-spk="r:castoria-altria-caster"]'); pg.wait_for_timeout(500)
    check("and one can be picked", "Castoria" in pg.locator('#dossier [data-npc-pick="0"]').inner_text())
    # ---------- Remove from Guests ----------
    pg.locator('#list [data-id="morgan"]').first.click(); pg.wait_for_timeout(700)
    pg.click('#dossier [data-action="wish-remove"]'); pg.wait_for_timeout(200)
    check("removing a Guest asks first", "Remove Morgan from your Guests?" in pg.locator("#wish-confirm").inner_text())
    pg.click('#dossier [data-action="wish-remove-go"]'); pg.wait_for_timeout(700)
    check("then Morgan is gone from the list and the roster", guest(pg, "morgan") is None and pg.locator('#list [data-id="morgan"]').count() == 0)
    pg.locator('#toast .toast-btn').click(); pg.wait_for_timeout(800)
    g = guest(pg, "morgan")
    check("Undo brings Morgan back, pictures and all", g and g.get("wish") and g["art"].get("1") == st1 and pg.locator('#list [data-id="morgan"]').count() == 1)
    # ---------- the file points to the site ----------
    check("the file's footer says accounts are on fategrandindex.com", "fategrandindex.com" in pg.locator(".sf-acct").inner_text())
    ctx.close()

    # ---------- the Story page: green checks ----------
    ctx, pg = page(b, {"pos": {"w": 101, "q": 0, "ph": 0}, "theme": True, "part": "1"})
    pg.goto(SEEDED + "#story"); pg.wait_for_timeout(2200)
    chips = pg.evaluate("[...document.querySelectorAll('#story .st-ch')].map(c => [c.dataset.w, c.classList.contains('done'), !!c.querySelector('.st-ok')])")
    check(f"a chapter before yours is cleared, with a green check ({chips[:3]})", chips[0] == ["100", True, True] and chips[1][1:] == [False, False])
    check("and the line at the top counts them", "1 chapter cleared" in pg.locator("#story .st-pos").inner_text())
    ok = pg.evaluate("getComputedStyle(document.querySelector('#story .st-ch.done .st-ok')).backgroundColor")
    check(f"the check is green ({ok})", re.match(r"rgb\((\d+), (\d+), (\d+)\)", ok) and (lambda m: int(m[1]) > int(m[0]) + 40 and int(m[1]) > int(m[2]) + 20)(re.match(r"rgb\((\d+), (\d+), (\d+)\)", ok).groups()))
    pg.click('#story [data-action="st-ch"][data-w="100"]'); pg.wait_for_selector("#story .st-secs", timeout=10000); pg.wait_for_timeout(600)
    rows = pg.evaluate("[...document.querySelectorAll('#story .st-row')].map(r => r.classList.contains('done') && !!r.querySelector('.st-row-done'))")
    check(f"inside a cleared chapter every section says Cleared ({rows})", rows and all(rows) and pg.locator("#story .st-sec.done").count() == len(rows))
    check("and the chapter's title says so", "Cleared" in pg.locator("#story .st-title p").inner_text())
    check("Part 1 isn't all cleared yet", pg.locator('#story [data-action="st-part"][data-k="1"].done').count() == 0)
    ctx.close()
    ctx, pg = page(b, {"pos": {"w": 100, "q": 1000010, "ph": 2}, "theme": True, "part": "1"})
    pg.goto(SEEDED + "#story"); pg.wait_for_timeout(2600)
    rows = pg.evaluate("[...document.querySelectorAll('#story .st-row')].map(r => r.classList.contains('done'))")
    check(f"the sections before yours are cleared, yours and the rest aren't ({rows})", rows == [True, True, True, False])
    bats = pg.evaluate("[...document.querySelectorAll('#story .st-row.open .st-bat')].map(x => x.classList.contains('done'))")
    check(f"in your section, the battles before yours are too ({bats})", bats[:2] == [True, False])
    check("no chapter is cleared yet", pg.locator("#story .st-ch.done").count() == 0 and "cleared" not in pg.locator("#story .st-pos").inner_text())
    borrow = pg.locator("#story .st-borrow").inner_text() if pg.locator("#story .st-borrow").count() else ""
    cls = pg.evaluate("[...document.querySelectorAll('#story .st-ccard b')].slice(0, 3).map(x => x.textContent)")
    check(f"worth borrowing: your Guests of the right classes ({borrow[:90]} for {cls})", ("Castoria" in borrow or "Merlin" in borrow or "Scathach-Skadi" in borrow) if "Caster" in cls else ("Koyanskaya" in borrow) if "Assassin" in cls else True)
    # ---------- the chapter's look ----------
    pg.click("#tab-ranking"); pg.wait_for_timeout(1600)
    look = pg.evaluate("""(() => { const i = document.getElementById('idle-bg'), s = document.getElementById('story-bg');
      return {idle: !!i && i.classList.contains('on') && i.classList.contains('st-tint'), c1: i && i.style.getPropertyValue('--c1'),
        glows: s ? s.querySelectorAll('.sb-glow').length : 0, rays: s ? s.querySelectorAll('.sb-rays').length : 0, heat: s ? s.querySelectorAll('.sb-heat').length : 0,
        parts: s ? s.querySelectorAll('.sb-parts i').length : 0, on: !!s && s.classList.contains('on')}; })()""")
    check(f"the summoning circle stays behind the chapter, in its colours ({look})", look["idle"] and look["c1"] == "#d9542b")
    check("with glows, light around the circle, more embers and Fuyuki's heat", look["on"] and look["glows"] == 3 and look["rays"] == 1 and look["heat"] == 1 and look["parts"] == 35)
    props = pg.evaluate("""[...new Set(document.getAnimations().filter(a => a.effect && a.effect.target && a.effect.target.closest && a.effect.target.closest('#story-bg')).flatMap(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x)))))]""")
    check(f"which only move and fade (nothing the graphics card has to repaint: {props})", props and all(x in ("transform", "opacity", "translate") for x in props))
    pg.click('[data-action="theme"]'); pg.wait_for_timeout(900)
    check("in the other theme too", pg.evaluate("document.getElementById('idle-bg').classList.contains('st-tint') && document.getElementById('story-bg').classList.contains('on')"))
    pg.click("#tab-story"); pg.wait_for_timeout(600); pg.uncheck("#story [data-st-theme]"); pg.wait_for_timeout(400); pg.click("#tab-ranking"); pg.wait_for_timeout(1600)
    off = pg.evaluate("(() => { const i = document.getElementById('idle-bg'), s = document.getElementById('story-bg'); return [!!i, i && i.className, i && i.style.cssText, s && s.className, location.hash]; })()")
    check(f"with the look off, the circle is the page's own again ({off})", off[0] and "st-tint" not in off[1] and not off[2] and (not off[3] or " on" not in off[3]))
    ctx.close()
    b.close()

# ---------- the hosted site's files ----------
site = os.path.join(ROOT, "site")
rd = lambda n: open(os.path.join(site, n), encoding="utf-8").read() if os.path.exists(os.path.join(site, n)) else ""
check("robots.txt lets crawlers read the page but not /api/", "User-agent: *" in rd("robots.txt") and "Disallow: /api/" in rd("robots.txt"))
check("a missing address gets a page of its own (404.html, no scripts)", "Nothing here" in rd("404.html") and "<script" not in rd("404.html") and 'href="/"' in rd("404.html"))
check("every file says HTTPS only (HSTS)", re.search(r"^/\*\n(  .*\n)*  Strict-Transport-Security: max-age=31536000; includeSubDomains", rd("_headers"), re.M) is not None)
check("the app doesn't answer robots.txt with the page", "!/\\.[a-z0-9]{2,5}$/i.test(u.pathname)" in rd("sw.js"))
check("no page errors" + (": " + "; ".join(errs[:3]) if errs else ""), not errs)
print(f"\n{len(fails)} failed" if fails else "\nall passed")
sys.exit(1 if fails else 0)
