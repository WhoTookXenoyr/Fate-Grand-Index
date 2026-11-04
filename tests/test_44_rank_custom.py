import os
# 0.50.0-beta: Count custom servants. The Ranking page has a box for it when the roster has servants of your own (made in
# the Workshop: custom). Unticked, they're left out of the ranking list, the tier board and Home's best servants, and
# their own page says Not ranked; the others' ranks close up without arrows saying they moved. It's remembered after a
# reload, and nothing about the servants changes. Without custom servants the box isn't shown.
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
RCK = KEY + ":rankCustom"
servants = lambda pg: pg.evaluate(f"JSON.parse(localStorage.getItem('{KEY}')).servants")
def tab(pg, t): pg.locator(f"#tab-{t}").click(); pg.wait_for_timeout(600)
ranked = lambda pg: pg.evaluate("Array.from(document.querySelectorAll('#ranking .rank-row .rk-name')).map((b) => b.dataset.id)")
board = lambda pg: pg.evaluate("Array.from(document.querySelectorAll('#tierboard .tier-card')).map((b) => b.dataset.id)")
def view(pg, v): pg.click(f'[data-action="rank-view"][data-v="{v}"]'); pg.wait_for_timeout(400)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#ranking"); pg.wait_for_timeout(1500)
    check("no custom servants: no box", pg.locator(".rank-ck").is_hidden())
    # two of the roster become servants of your own
    cus = pg.evaluate(f"""(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), m = d.servants.filter((x) => !x.wish).slice(1, 3); m.forEach((x) => {{ x.custom = true; }});
      localStorage.setItem('{KEY}', JSON.stringify(d)); return m.map((x) => x.id); }})()""")
    pg.reload(); pg.wait_for_timeout(1500)
    before = json.dumps(servants(pg), sort_keys=True)
    n_own = len([x for x in servants(pg) if not x.get("wish")])
    check("with custom servants the box is there, ticked", pg.locator(".rank-ck").is_visible() and pg.locator("#rank-custom").is_checked())
    r0 = ranked(pg)
    check(f"ticked: they're in the ranking ({len(r0)} of {n_own})", len(r0) == n_own and all(c in r0 for c in cus))
    view(pg, "tiers"); b0 = board(pg)
    check("and on the tier board", all(c in b0 for c in cus) and len(b0) == n_own)
    view(pg, "list")
    pg.click('[data-action="rank-seen"]'); pg.wait_for_timeout(300)

    # ---------- leaving them out ----------
    pg.locator("#rank-custom").uncheck(); pg.wait_for_timeout(600)
    r1 = ranked(pg)
    check(f"unticked: left out of the ranking ({len(r1)} of {n_own})", len(r1) == n_own - 2 and not any(c in r1 for c in cus))
    check("the others keep their order", r1 == [x for x in r0 if x not in cus])
    mv = pg.evaluate("[document.querySelectorAll('#ranking .mv.up').length, document.querySelectorAll('#ranking .mv.down').length]")
    check(f"and no arrows say they moved ({mv})", mv == [0, 0])
    check("it says so", "left out" in pg.locator("#toast").inner_text())
    view(pg, "tiers"); b1 = board(pg)
    check(f"left out of the tier board too ({len(b1)})", len(b1) == n_own - 2 and not any(c in b1 for c in cus))
    view(pg, "list")
    check("remembered", pg.evaluate(f"localStorage.getItem('{RCK}')") == "false")
    # their page and the others'
    tab(pg, "servants")
    pg.locator(f'#list [data-id="{cus[0]}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(700)
    check(f"a custom servant's page says Not ranked ({pg.locator('#dossier .rank-chip').inner_text()!r})", pg.locator("#dossier .rank-chip.off").count() == 1 and "Not ranked" in pg.locator("#dossier .rank-chip").inner_text())
    pg.locator(f'#list [data-id="{r1[0]}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(700)
    check(f"another's rank counts only the others ({pg.locator('#dossier .rank-chip').inner_text()!r})", f"Rank #1 of {n_own - 2}" in pg.locator("#dossier .rank-chip").inner_text())
    tab(pg, "home")
    hand = pg.evaluate("Array.from(document.querySelectorAll('#home .hm-card')).map((c) => c.dataset.id)")
    check(f"Home's best servants leave them out ({len(hand)})", hand and not any(c in hand for c in cus))
    pg.reload(); pg.wait_for_timeout(1500); tab(pg, "ranking")
    check("still left out after a reload", not pg.locator("#rank-custom").is_checked() and len(ranked(pg)) == n_own - 2)
    check("nothing about the servants changed", json.dumps(servants(pg), sort_keys=True) == before)

    # ---------- counting them again ----------
    pg.locator("#rank-custom").check(); pg.wait_for_timeout(600)
    check("ticked again: back in the ranking", ranked(pg) == r0)
    check("and the setting is gone (on is the default)", pg.evaluate(f"localStorage.getItem('{RCK}')") is None)
    ctx.close()

    # ---------- a phone ----------
    ctx = b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); pg.add_init_script(INIT + f";localStorage.setItem('{RCK}','false')"); pg.route("https://**", lambda r: r.abort())
    pg.goto(SEEDED + "#ranking"); pg.wait_for_timeout(1500)
    pg.evaluate(f"""(() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')); d.servants.filter((x) => !x.wish).slice(1, 3).forEach((x) => {{ x.custom = true; }}); localStorage.setItem('{KEY}', JSON.stringify(d)); }})()""")
    pg.reload(); pg.wait_for_timeout(1500)
    w = pg.evaluate("[document.scrollingElement.scrollWidth, innerWidth]")
    check(f"phone: the box is there, unticked, and nothing scrolls sideways ({w})", pg.locator(".rank-ck").is_visible() and not pg.locator("#rank-custom").is_checked() and w[0] <= w[1] + 1)
    ctx.close()
    b.close()
if errs: check("no page errors: " + "; ".join(errs[:3]), False)
print("ALL PASS" if not fails else f"{len(fails)} FAILED")
sys.exit(1 if fails else 0)
