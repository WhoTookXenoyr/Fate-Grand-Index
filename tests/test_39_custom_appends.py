import os
# 0.28.1: append skills for servants of your own. Their Append section shows NA's real appends: 1, 2, 4 and 5 are the same
# on every NA servant (so they come with the slot, with their effects), and the 3rd (ATK Up or Critical Resistance Up
# against one class) is picked from a list, kept on the servant as appendPick, with Undo. The levels work like any
# servant's. A pick survives a reload, Edit details and the Workshop's save; NA servants have no picker.
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
def typ(pg, sel, v):
    pg.evaluate("([s, v]) => { const e = document.querySelector(s); e.value = v; e.dispatchEvent(new Event(e.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true})); }", [sel, v])
def quiet(pg): pg.evaluate("document.getElementById('toast').classList.remove('show', 'has-btn')")
def go(pg, i): pg.click(f".ws-rail [data-i='{i}']"); pg.wait_for_timeout(250)
def get(pg, sid): return next(x for x in pg.evaluate(LS)["servants"] if x["id"] == sid)
AP = "#dossier .ap-sec .ap-row"
# opens a servant from the roster list (the list is long: its row can be far down the page, so the click is sent to it directly)
def pick(pg, sid): pg.locator(f'#list [data-id="{sid}"]').evaluate("(e) => e.click()"); pg.wait_for_timeout(500)
PICK = "#dossier .ap-sec .ap-list > .ap-row:nth-child(3) select[data-ap-pick]"
name = lambda pg, i: pg.locator(AP).nth(i).locator(".ap-n b").inner_text() if pg.locator(AP).nth(i).locator(".ap-n b").count() else ""
eff = lambda pg, i: pg.locator(AP).nth(i).locator(".ap-eff").inner_text() if pg.locator(AP).nth(i).locator(".ap-eff").count() else ""
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    pg = ctx.new_page(); pg.add_init_script(INIT)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    # ---------- make Camellya ----------
    pg.click('#view-servants .toolbar [data-action="ws-new"]'); pg.wait_for_timeout(400)
    pg.click('[data-ws="dice"]'); pg.wait_for_timeout(500)
    go(pg, 1); typ(pg, "#ws-name", "Camellya"); pg.wait_for_timeout(300)
    go(pg, 7); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1000); quiet(pg)
    cam = next(x for x in pg.evaluate(LS)["servants"] if x["name"] == "Camellya"); sid = cam["id"]
    pg.wait_for_selector(AP, timeout=8000)

    # ---------- what the section shows ----------
    check(f"five append rows ({pg.locator(AP).count()})", pg.locator(AP).count() == 5)
    check(f"1, 2, 4 and 5 are NA's real ones ({[name(pg, i) for i in (0, 1, 3, 4)]})", [name(pg, i) for i in (0, 1, 3, 4)] == ["Extra Attack Boost", "Load Magical Energy", "Special Attack Boost", "Skill Reload"])
    check(f"with their effects at Lv 1 ({eff(pg, 0)!r})", "Increase Extra Attack Card's effectiveness by 30% for yourself" in eff(pg, 0) and "(at Lv 1)" in eff(pg, 0) and "NP charged at 10%" in eff(pg, 1) and "Critical Strength by 20%" in eff(pg, 3))
    sel = pg.locator(AP).nth(2).locator("select[data-ap-pick]")
    n_opts = sel.locator("option").count()
    check(f"the 3rd is a list to pick from, none picked yet ({n_opts} options)", sel.count() == 1 and sel.input_value() == "" and n_opts > 25 and "Choose one" in sel.locator("option").first.inner_text())
    groups = sel.evaluate("(e) => Array.from(e.querySelectorAll('optgroup')).map((g) => [g.label, g.children.length])")
    check(f"grouped: ATK Up, then Critical Resistance Up ({groups})", [g[0] for g in groups][:2] == ["ATK Up against a class", "Critical Resistance Up against a class"] and all(g[1] > 5 for g in groups[:2]))
    check("no effect shown until one is picked", eff(pg, 2) == "")
    others = sum(pg.locator(AP).nth(i).locator("select").count() for i in (0, 1, 3, 4))
    check("the other four have no list", others == 0)

    # ---------- picking ----------
    typ(pg, PICK, "Anti-Berserker (ATK Up)"); pg.wait_for_timeout(1200)
    check(f"picked: its effect shows ({eff(pg, 2)!r})", "Increase ATK against [Berserker] class by 20% for yourself" in eff(pg, 2) and "(at Lv 1)" in eff(pg, 2))
    check("kept on the servant by its name", get(pg, sid).get("appendPick") == "Anti-Berserker (ATK Up)")
    check("the toast says so and offers Undo", "Anti-Berserker (ATK Up)" in pg.inner_text("#toast") and pg.locator("#toast .toast-btn").count() == 1)
    pg.locator("#toast .toast-btn").click(); pg.wait_for_timeout(1200)
    check("Undo puts it back to not picked", "appendPick" not in get(pg, sid) and pg.locator(AP).nth(2).locator("select").input_value() == "" and eff(pg, 2) == "")
    typ(pg, PICK, "Anti-Saber (Crit. Res. Up)"); pg.wait_for_timeout(1200); quiet(pg)
    check(f"a Critical Resistance one ({eff(pg, 2)!r})", "Increase Critical Resistance against [Saber] class by 20% for yourself" in eff(pg, 2))
    typ(pg, PICK, "Anti-Berserker (ATK Up)"); pg.wait_for_timeout(1200); quiet(pg)

    # ---------- levels work like on any servant ----------
    pg.click(f'{AP} >> nth=2 >> [data-action="bump"][data-d="1"]'); pg.wait_for_timeout(1200)
    check(f"unlocking it: Lv 1, the effect without the (at Lv 1) note ({eff(pg, 2)!r})", get(pg, sid)["appends"][2] == 1 and "(at Lv 1)" not in eff(pg, 2) and "20%" in eff(pg, 2))
    for _ in range(9): pg.click(f'{AP} >> nth=2 >> [data-action="bump"][data-d="1"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1500)   # (saves are a moment after the last change)
    check(f"at Lv 10 it's maxed at 30% ({eff(pg, 2)!r})", get(pg, sid)["appends"][2] == 10 and "30%" in eff(pg, 2) and pg.locator(AP).nth(2).locator(".status.grail").count() == 1)
    check("the section counts it", "1 of 5 unlocked" in pg.locator("#dossier .ap-sec .sec-head small").inner_text())
    pg.click(f'{AP} >> nth=0 >> [data-action="bump"][data-d="1"]'); pg.wait_for_timeout(1500)
    check("and the others unlock on their own", get(pg, sid)["appends"][0] == 1 and "(at Lv 1)" not in eff(pg, 0) and "2 of 5 unlocked" in pg.locator("#dossier .ap-sec .sec-head small").inner_text())

    # ---------- it stays ----------
    pg.reload(); pg.wait_for_timeout(1500); pick(pg, sid); pg.wait_for_selector(AP, timeout=8000)
    check("after a reload", pg.locator(AP).nth(2).locator("select").input_value() == "Anti-Berserker (ATK Up)" and "Berserker" in eff(pg, 2))
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    pg.click('#servant-form button[type="submit"]'); pg.wait_for_timeout(1500); quiet(pg)
    check("through Edit details", get(pg, sid).get("appendPick") == "Anti-Berserker (ATK Up)" and get(pg, sid)["appends"][2] == 10)
    pg.click('#dossier .d-head [data-action="ws-open"]'); pg.wait_for_timeout(500)
    go(pg, 7); pg.click('[data-ws="save"]'); pg.wait_for_timeout(1800); quiet(pg)
    pg.wait_for_selector(AP, timeout=8000)
    check("and through a save in the Workshop", get(pg, sid).get("appendPick") == "Anti-Berserker (ATK Up)" and pg.locator(AP).nth(2).locator("select").input_value() == "Anti-Berserker (ATK Up)")
    # it goes along in a single-servant file (the whole servant is exported)
    with pg.expect_download() as dl: pg.click('#dossier [data-action="sv-export"]')
    path = f"{sp}/out/Camellya-ap.servant.json"; dl.value.save_as(path)
    f = json.load(open(path))
    check("it's in the exported file", f["servants"][0].get("appendPick") == "Anti-Berserker (ATK Up)")

    # ---------- NA servants are as before ----------
    pg.locator('#list .row-name:has-text("Space Ishtar")').evaluate("(e) => e.click()"); pg.wait_for_selector(AP, timeout=8000); pg.wait_for_timeout(400)
    check(f"an NA servant has no list ({name(pg, 2)!r})", pg.locator("#dossier .ap-pick").count() == 0 and name(pg, 2).startswith("Anti-") and name(pg, 0) == "Extra Attack Boost")

    # ---------- a phone ----------
    pg.set_viewport_size({"width": 390, "height": 800}); pg.wait_for_timeout(400)
    pick(pg, sid); pg.wait_for_selector(AP, timeout=8000); pg.wait_for_timeout(400)
    over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    fit = pg.evaluate("(() => { const r = document.querySelector('#dossier .ap-pick').getBoundingClientRect(); return r.right <= window.innerWidth - 4; })()")
    check(f"phone: the list fits ({over}px sideways)", over <= 1 and fit)
    pg.locator("#dossier .ap-sec").screenshot(path=f"{sp}/out/ap-phone.png")
    check(f"no script errors ({errs[:3]})", not errs)
    b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
