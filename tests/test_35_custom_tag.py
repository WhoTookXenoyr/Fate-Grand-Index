import os
# 0.27.1: a servant made in the Servant Workshop says Custom wherever it's listed (roster, Guests, Ranking, Home,
# Versus, parties, Summoning, the support picker), so nobody takes them for a servant from the game. Plain-text
# lists say "(Custom)". A long name is cut short and the tag stays. Not when the name already ends in "(Custom)".
import sys, json
from playwright.sync_api import sync_playwright
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}));localStorage.setItem('spirit-origin-list:v1:statsync','1')"
KEY = "spirit-origin-list:v1"
LS = f"JSON.parse(localStorage.getItem('{KEY}'))"
LONG = "Ulrike of the Ten Thousand Shattered Swords of the Last Dawn"
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def quiet(pg): pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
def go(pg, i): pg.click(f".ws-rail [data-i='{i}']"); pg.wait_for_timeout(250)
def tab(pg, t): pg.evaluate(f"location.hash = '#{t}'"); pg.wait_for_timeout(900)
# waits for something that a busy machine can draw late (the whole suite at once), without failing on its own
def soon(pg, sel, t=8000):
    try: pg.wait_for_selector(sel, timeout=t, state="attached")
    except Exception: pass
def tags(pg, sel): return pg.evaluate("(s) => Array.from(document.querySelectorAll(s)).filter((e) => e.offsetParent !== null || e.closest('option')).map((e) => (e.closest('[data-id]') || e.parentElement).innerText.replace(/\\s+/g, ' ').trim())", sel)
def make(pg, name):
    pg.evaluate(f"localStorage.removeItem('{KEY}:workshop')")
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="dice"]'); pg.wait_for_timeout(500)
    go(pg, 1); typ(pg, "#ws-name", name); pg.wait_for_timeout(300)
    go(pg, 7); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1000); quiet(pg)
    return next(x for x in pg.evaluate(LS)["servants"] if x.get("custom") and x["name"] == name)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    cam = make(pg, "Camellya"); ulr = make(pg, LONG); rem = make(pg, "Morgan (Custom)")
    # a ★5 Camellya, in the first party and on Versus
    pg.evaluate(f"""(id) => {{ const d = JSON.parse(localStorage.getItem('{KEY}')); const s = d.servants.find((x) => x.id === id); s.rarity = 5; s.kit.r = 5;
      d.parties[0].front[0] = 'Camellya'; localStorage.setItem('{KEY}', JSON.stringify(d)); localStorage.setItem('{KEY}:vs', JSON.stringify([id])); }}""", cam["id"])
    pg.reload(); pg.wait_for_timeout(1500)

    # ---------- the roster ----------
    t = tags(pg, "#list .cu-tag")
    check(f"the roster tags the two servants made in the Workshop ({t})", len(t) == 2 and any(x.lower().startswith("camellya custom") for x in t) and any(x.lower().startswith(LONG.lower() + " custom") for x in t))
    check("and not the one whose name already says (Custom)", not any(x.startswith("Morgan") for x in t) and pg.locator("#list .row-name", has_text="Morgan (Custom)").count() == 1)
    pg.locator("#list .row-name .cu-tag").last.scroll_into_view_if_needed()
    box = pg.evaluate("""() => { const t = Array.from(document.querySelectorAll('#list .row-name')).find((e) => e.innerText.startsWith('Ulrike')); const a = t.getBoundingClientRect(), g = t.querySelector('.cu-tag').getBoundingClientRect(), n = t.querySelector('.cu-n');
      return {inside: g.right <= a.right + 0.5 && g.width > 20, cut: n.scrollWidth > n.clientWidth}; }""")
    check(f"a long name is cut short and the tag stays in view ({box})", box["inside"] and box["cut"])
    check("NA servants have no tag", pg.locator("#list .row-name", has_text="Space Ishtar").locator(".cu-tag").count() == 0)
    # the servant page keeps its one Custom tag by the class, and the name stays plain
    pg.click(f'#list [data-id="{cam["id"]}"]'); pg.wait_for_timeout(500)
    check("their page: one Custom tag, the name as it is", pg.locator("#dossier .d-head .ws-tag").count() == 1 and pg.locator("#dossier .d-head h2").inner_text() == "Camellya")

    # ---------- everywhere else ----------
    tab(pg, "ranking")
    check(f"Ranking ({tags(pg, '#view-ranking .cu-tag')})", len(tags(pg, "#view-ranking .rk-name .cu-tag")) == 2)
    tab(pg, "home")
    check(f"Home ({len(tags(pg, '#view-home .cu-tag'))} tags)", len(tags(pg, "#view-home .cu-tag")) >= 2 and pg.locator('#view-home [data-cap="Camellya (Custom)"]').count() + pg.locator("#view-home .hm-row", has_text="Camellya").locator(".cu-tag").count() >= 1)
    tab(pg, "versus"); soon(pg, "#view-versus .vs-th-n .cu-tag")
    opts = pg.evaluate("Array.from(document.querySelectorAll('#view-versus option')).map((o) => o.textContent)")
    check("Versus lists to pick from say (Custom)", "Camellya (Custom)" in opts and f"{LONG} (Custom)" in opts and "Morgan (Custom)" in opts and "Morgan (Custom) (Custom)" not in opts)
    check("and its tables tag them", pg.locator("#view-versus .vs-th-n .cu-tag").count() == 2)
    tab(pg, "parties")
    check("a party card tags them", pg.locator(".fc .fc-name", has_text="Camellya").locator(".cu-tag").count() >= 1)
    pg.locator('#parties [data-action="party-img"]').first.click(); pg.wait_for_timeout(2500)
    check("the party picture is drawn with them in it (CUSTOM under LEADER)", pg.evaluate("(() => { const i = document.getElementById('pimg-img'); return !!i && i.naturalWidth === 2400; })()"))
    pg.locator("#pimg-img").screenshot(path=f"{sp}/out/cu-party-img.png")
    pg.click('[data-action="pimg-close"]'); pg.wait_for_timeout(300)
    tab(pg, "summon")
    typ(pg, 'select[data-sm-feat="5"]', cam["id"]); pg.wait_for_timeout(800)
    check("Summoning: the featured ★5 banner tags them", pg.locator(".smh-title .cu-tag").count() == 1 and pg.locator(".smh-title").inner_text().startswith("Camellya"))
    check("and its list of who to feature says (Custom)", pg.evaluate("Array.from(document.querySelectorAll('select[data-sm-feat=\"5\"] option')).some((o) => o.textContent === 'Camellya (Custom)')"))
    # the damage calculator's support picker
    tab(pg, "servants"); pg.click(f'#list [data-id="{ulr["id"]}"]'); soon(pg, "#dossier [data-npc-for]")
    pg.evaluate("() => { const d = document.querySelector('#dossier [data-npc-for]'); if (d) { d.open = true; d.dispatchEvent(new Event('toggle')); } }"); soon(pg, '#dossier [data-npc-pick="0"]')
    check("the damage calculator tags them", pg.locator("#dossier .npc-wh .cu-tag").count() == 1)
    pg.click('#dossier [data-npc-pick="0"]'); pg.wait_for_selector(".spk:not([hidden]) [data-spk]", timeout=5000)
    pg.fill(".spk [data-spk-q]", "Camellya"); pg.wait_for_timeout(400)
    check(f"and so does its support picker ({pg.locator('.spk .pc-card .pc-n').first.inner_text()!r})", pg.locator(".spk .pc-card .pc-n .cu-tag").count() >= 1)
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
