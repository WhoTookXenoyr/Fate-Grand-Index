import os
# 0.23.1: Back walks through the tabs (and closes the servant page on a phone), opening the page on #home stays at the
# top, an import can be undone and says what it will change, and a warning stays while the browser can't save.
import sys, json
from playwright.sync_api import sync_playwright
# tests/run.py serves the page over http (FGI_URL); run by hand, a suite opens the files directly
sp = sys.argv[1]; URL = os.environ.get("FGI_URL") or "file://" + sp
SEEDED = f"{URL}/_seeded.html"
errs, fails = [], []
def check(label, ok):
    print(("PASS " if ok else "FAIL ") + label)
    if not ok: fails.append(label)
INIT = "localStorage.setItem('spirit-origin-list:v1:intro','1');localStorage.setItem('spirit-origin-list:v1:news','9.9.9');if(!localStorage.getItem('spirit-origin-list:v1:summon'))localStorage.setItem('spirit-origin-list:v1:summon',JSON.stringify({anim:false}))"
LS = "JSON.parse(localStorage.getItem('spirit-origin-list:v1'))"
def page(ctx):
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.googleapis.com/**", lambda r: r.abort()); pg.route("https://fonts.gstatic.com/**", lambda r: r.abort())
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    return pg
def sv(pg, sid): return next((x for x in pg.evaluate(LS)["servants"] if x["id"] == sid), None)
def tab(pg): return pg.evaluate("document.documentElement.dataset.tab")
def sheet_open(pg): return pg.evaluate("!!document.querySelector('#dossier .d-back') && getComputedStyle(document.querySelector('#dossier')).display !== 'none' && !!document.querySelector('#dossier').firstElementChild")
def back(pg): pg.go_back(wait_until="commit"); pg.wait_for_timeout(450)
def toast(pg): return pg.locator("#toast").inner_text()

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- desktop: Back and Forward between tabs
    ctx = b.new_context(viewport={"width": 1360, "height": 900}); pg = page(ctx)
    pg.goto(SEEDED); pg.wait_for_timeout(1400)
    start_len = pg.evaluate("history.length")
    check(f"opening the page adds no history step of its own ({pg.url[-7:]}, length {start_len}: the blank tab and the page)", pg.url.endswith("#home") and start_len == 2)
    for t in ("servants", "ranking", "parties"): pg.click(f"#tab-{t}"); pg.wait_for_timeout(250)
    check(f"each tab opened is a step ({pg.evaluate('history.length')} steps)", pg.evaluate("history.length") == start_len + 3)
    back(pg); check(f"Back: Parties -> Ranking ({tab(pg)})", tab(pg) == "ranking" and pg.url.endswith("#ranking"))
    back(pg); back(pg); check(f"Back twice more: Home ({tab(pg)})", tab(pg) == "home")
    pg.go_forward(); pg.wait_for_timeout(450); check(f"Forward: Servants ({tab(pg)})", tab(pg) == "servants")
    pg.click("#tab-ranking"); pg.wait_for_timeout(250); pg.click("#tab-ranking"); pg.wait_for_timeout(250)
    n1 = pg.evaluate("history.length")
    check(f"pressing the tab you're on adds no step ({n1})", n1 == start_len + 2)
    pg.reload(); pg.wait_for_timeout(1200)
    check(f"a reload stays on the tab and adds no step ({tab(pg)}, {pg.evaluate('history.length')})", tab(pg) == "ranking" and pg.evaluate("history.length") == n1)
    # opening a servant from Home goes to Servants, and Back returns Home
    pg.click("#tab-home"); pg.wait_for_timeout(400)
    pg.locator('#home [data-action="goto"]').first.click(); pg.wait_for_timeout(500)
    check(f"a servant from Home opens on Servants ({tab(pg)})", tab(pg) == "servants")
    back(pg); check(f"Back returns Home ({tab(pg)})", tab(pg) == "home")
    ctx.close()

    # ---- phone: the servant page is a step of its own
    ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True); pg = page(ctx)
    pg.goto(SEEDED + "#home"); pg.wait_for_timeout(1500)
    check(f"opened fresh on #home, the phone page starts at the top (scrollY {pg.evaluate('scrollY')})", pg.evaluate("scrollY") == 0)
    pg.click("#tab-servants"); pg.wait_for_timeout(400)
    first = pg.evaluate("document.querySelector('#list [data-id]').dataset.id")
    pg.click(f'#list [data-id="{first}"]'); pg.wait_for_timeout(500)
    check("tapping a servant opens their page", sheet_open(pg))
    back(pg)
    check(f"Back closes the servant page and stays on Servants ({tab(pg)}, open {sheet_open(pg)})", tab(pg) == "servants" and not sheet_open(pg))
    pg.go_forward(); pg.wait_for_timeout(450)
    check("Forward opens it again", sheet_open(pg) and pg.evaluate("history.state && history.state.sheet") == first)
    # closing with the page's own button takes the step back too, so the next Back leaves Servants
    pg.click('#dossier [data-action="close"]'); pg.wait_for_timeout(450)
    check(f"'← Roster' closes it ({sheet_open(pg)}, state {pg.evaluate('history.state')})", not sheet_open(pg) and not pg.evaluate("history.state && history.state.sheet"))
    back(pg); check(f"the next Back goes to Home, no dead press ({tab(pg)})", tab(pg) == "home")
    # leaving for another tab keeps the step: Back from there brings the servant page back
    pg.click("#tab-servants"); pg.wait_for_timeout(300); pg.click(f'#list [data-id="{first}"]'); pg.wait_for_timeout(400)
    pg.click('#dossier [data-action="vs-add"]'); pg.wait_for_timeout(500)
    check(f"Compare leaves the servant page for Versus ({tab(pg)})", tab(pg) == "versus")
    back(pg); check(f"Back from Versus returns to the servant page ({tab(pg)}, open {sheet_open(pg)})", tab(pg) == "servants" and sheet_open(pg))
    # another servant from inside the page replaces the step instead of piling up
    n0 = pg.evaluate("history.length")
    second = pg.evaluate("[...document.querySelectorAll('#list [data-id]')].map(e => e.dataset.id)[2]")
    pg.evaluate(f"document.querySelector('#list [data-id=\"{second}\"]').click()"); pg.wait_for_timeout(400)
    check(f"switching servant keeps one step ({pg.evaluate('history.state')}, {pg.evaluate('history.length')} = {n0})", pg.evaluate("history.state && history.state.sheet") == second and pg.evaluate("history.length") == n0)
    # an edit form isn't thrown away by Back
    pg.click('#dossier [data-action="edit"]'); pg.wait_for_timeout(500)
    has_form = pg.locator("#servant-form").count() == 1
    pg.locator("#servant-form input[name], #servant-form input").first.fill("typed but not saved")
    back(pg)
    check(f"Back with the edit form open keeps the form and says why ({toast(pg)!r})", has_form and pg.locator("#servant-form").count() == 1 and "Save or cancel" in toast(pg))
    pg.reload(); pg.wait_for_timeout(1200)
    check(f"after a reload the servant page starts closed, and Back isn't stuck on it ({pg.evaluate('history.state')})", not sheet_open(pg) and not pg.evaluate("history.state && history.state.sheet"))
    ctx.close()

    # ---- opening on a tab's address from a bookmark: no jump, on every tab
    for w, h in ((360, 760), (800, 1000), (1360, 900)):
        jumps = []
        for v in ("home", "servants", "summon", "parties", "ranking", "versus", "past"):
            ctx = b.new_context(viewport={"width": w, "height": h}); pg = page(ctx)
            pg.goto(f"{SEEDED}#{v}"); pg.wait_for_timeout(1300)
            if pg.evaluate("scrollY") > 0: jumps.append((v, pg.evaluate("scrollY")))
            ctx.close()
        check(f"{w}px: opening any tab's address starts at the top ({jumps or 'all 0'})", not jumps)
    ctx = b.new_context(viewport={"width": 360, "height": 760}); pg = page(ctx)
    pg.goto(f"{SEEDED}#home"); pg.wait_for_timeout(1300); pg.mouse.wheel(0, 900); pg.wait_for_timeout(300)
    y = pg.evaluate("scrollY"); pg.reload(); pg.wait_for_timeout(1500)
    check(f"a reload keeps your own scroll position ({y} -> {pg.evaluate('scrollY')})", y > 0 and abs(pg.evaluate("scrollY") - y) < 5)
    ctx.close()

    # ---- import: say what changes, and undo it
    ctx = b.new_context(viewport={"width": 1360, "height": 900}, accept_downloads=True); pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    pg.click("#btn-export")
    with pg.expect_download() as dl: pg.click('[data-action="export"]')
    path = os.path.join(sp, "_t20_backup.json"); dl.value.save_as(path)
    bk = json.load(open(path))
    # the backup is a day older than the list
    bk["exportedAt"] = "2026-10-01T10:00:00.000Z"; json.dump(bk, open(path, "w"))
    before = pg.evaluate(LS)
    sid = before["servants"][0]["id"]; name = before["servants"][0]["name"]
    pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(300)
    for _ in range(3): pg.click('#dossier [data-action="bump"][data-f="bond"][data-d="1"]'); pg.wait_for_timeout(80)
    pg.wait_for_timeout(900); newer = sv(pg, sid).get("bond")
    pg.set_input_files("#f-import", path); pg.wait_for_timeout(500)
    note = pg.locator("#notice").inner_text()
    check(f"the import says which entries on the list change ({note[:170]!r})", "1 entry already on your list gets the backup's values" in note and "1 Oct 2026" in note)
    check("and that the backup is older than the list, and can be undone", "older than your list's last change" in note and "undo the import afterwards" in note)
    pg.locator("#notice summary").click(); pg.wait_for_timeout(150)
    check(f"'See what changes' names {name}", name in pg.locator("#notice details").inner_text())
    pg.click('[data-action="import-go"]'); pg.wait_for_timeout(1500)
    check(f"the import happened (Bond {newer} -> {sv(pg, sid).get('bond')})", newer == 3 and sv(pg, sid).get("bond") in (None, 0))
    check(f"Undo import is offered and stays ({pg.locator('#notice').inner_text()[:90]!r})", pg.locator('[data-action="import-undo"]').count() == 1)
    pg.wait_for_timeout(11000)
    check("still there after the toasts are gone", pg.locator('[data-action="import-undo"]').is_visible())
    pg.click('[data-action="import-undo"]'); pg.wait_for_timeout(900)
    after = pg.evaluate(LS)
    check(f"Undo import brings Bond {newer} back ({sv(pg, sid).get('bond')})", sv(pg, sid).get("bond") == 3)
    same = all(json.dumps(sorted(x.items())) == json.dumps(sorted(y.items())) for x, y in zip(sorted(after["servants"], key=lambda z: z["id"]), sorted(before["servants"], key=lambda z: z["id"])) if x["id"] != sid)
    check(f"and the rest of the list is as it was ({len(after['servants'])} servants, {len(after['parties'])} parties)", same and len(after["servants"]) == len(before["servants"]) and len(after["parties"]) == len(before["parties"]))
    check(f"the notice is gone and a toast says so ({toast(pg)!r})", pg.locator('[data-action="import-undo"]').count() == 0 and "Import undone" in toast(pg))
    pg.reload(); pg.wait_for_timeout(1200)
    check("the undo is saved (still Bond 3 after a reload)", sv(pg, sid).get("bond") == 3)
    # Keep it hides the offer; a spreadsheet import can be undone too
    pg.set_input_files("#f-import", path); pg.wait_for_timeout(400); pg.click('[data-action="import-go"]'); pg.wait_for_timeout(1300)
    pg.click('[data-action="import-keep"]'); pg.wait_for_timeout(200)
    check("Keep it hides the offer and keeps the import", pg.locator('[data-action="import-undo"]').count() == 0 and sv(pg, sid).get("bond") in (None, 0))
    csvp = os.path.join(sp, "_t20.csv")
    open(csvp, "w").write(f"Name;Level;Bond\n{name};77;9\nScheherazade;65;\n")
    lv0 = sv(pg, sid).get("level")
    pg.set_input_files("#f-import", csvp); pg.wait_for_timeout(400); pg.click('[data-action="import-go"]'); pg.wait_for_timeout(1300)
    lv1 = sv(pg, sid).get("level"); added = any(x["name"] == "Scheherazade" for x in pg.evaluate(LS)["servants"])
    pg.click('[data-action="import-undo"]'); pg.wait_for_timeout(900)
    check(f"a spreadsheet import is undone too (Lv {lv0} -> {lv1} -> {sv(pg, sid).get('level')}; Scheherazade added {added}, then gone)", lv1 == 77 and added and sv(pg, sid).get("level") == lv0 and not any(x["name"] == "Scheherazade" for x in pg.evaluate(LS)["servants"]))
    ctx.close()

    # ---- storage full: a warning that stays, a backup that has everything, and a retry
    ctx = b.new_context(viewport={"width": 1360, "height": 900}, accept_downloads=True); pg = page(ctx)
    pg.goto(SEEDED + "#servants"); pg.wait_for_timeout(1500)
    sid = pg.evaluate(LS)["servants"][1]["id"]
    pg.click(f'#list [data-id="{sid}"]'); pg.wait_for_timeout(300)
    pg.evaluate("""() => { let i = 0; for (const n of [1 << 18, 1 << 12, 64, 1]) { const s = 'x'.repeat(n); try { for (;;) localStorage.setItem('t20junk' + i++, s); } catch (e) {} } }""")
    b0 = sv(pg, sid).get("bond")
    for _ in range(2): pg.click('#dossier [data-action="bump"][data-f="bond"][data-d="1"]'); pg.wait_for_timeout(100)
    pg.wait_for_timeout(900)
    warn = pg.locator("#save-warn")
    check(f"a full storage shows a warning ({warn.inner_text()[:80]!r})", warn.is_visible() and "aren't being saved" in warn.inner_text() and pg.get_attribute("#save-warn", "role") == "alert")
    check(f"the change wasn't saved ({b0} stays {sv(pg, sid).get('bond')})", sv(pg, sid).get("bond") == b0)
    check(f"and a toast says so too, for when the servant page covers the warning ({toast(pg)[:40]!r})", "Not saved" in toast(pg))
    pg.wait_for_timeout(5000)
    check("the warning stays after toasts would have gone", warn.is_visible())
    with pg.expect_download() as dl: pg.click('#save-warn [data-action="export"]')
    bk = json.loads(open(dl.value.path()).read())
    check(f"its backup has the unsaved change (Bond {next(x for x in bk['servants'] if x['id'] == sid).get('bond')})", next(x for x in bk["servants"] if x["id"] == sid).get("bond") == (b0 or 0) + 2)
    pg.click('#save-warn [data-action="save-retry"]'); pg.wait_for_timeout(300)
    check(f"Try saving again while still full says so ({toast(pg)!r})", "Still no room" in toast(pg) and warn.is_visible())
    pg.evaluate("for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k && k.startsWith('t20junk')) localStorage.removeItem(k); }")
    pg.click('#save-warn [data-action="save-retry"]'); pg.wait_for_timeout(300)
    check(f"with room again, it saves everything and the warning goes ({sv(pg, sid).get('bond')}, {toast(pg)!r})", sv(pg, sid).get("bond") == (b0 or 0) + 2 and not warn.is_visible() and "Saving works again" in toast(pg))
    b.close()

print("errors", errs)
print("ALL PASSED" if not fails and not errs else f"FAILED {len(fails)}: {fails} errors {errs}")
