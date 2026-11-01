import os
# 0.28.0: one servant to a file and back. Export on the SERVANTPAGE saves that servant with their pictures
# (<name>.servant.json); Import in another browser adds them with new picture IDs, keeps their levels, kit and
# Custom tag; a servant already there is added as a copy or replaced, and Undo import takes it back.
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
def page(b):
    ctx = b.new_context(viewport={"width": 1440, "height": 900}, accept_downloads=True)
    pg = ctx.new_page(); pg.add_init_script(INIT); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://fonts.**", lambda r: r.abort()); pg.route("https://api.atlasacademy.io/**", lambda r: r.fulfill(status=404, body="{}"))
    pg.route("https://static.atlasacademy.io/**", lambda r: r.fulfill(path=f"{sp}/ph_face.png", content_type="image/png"))
    return ctx, pg
cams = lambda pg: [x for x in pg.evaluate(LS)["servants"] if x["name"] == "Camellya"]
with sync_playwright() as p:
    b = p.chromium.launch()
    # ---------- browser A: make Camellya, give her a picture and levels, export her ----------
    ctxA, A = page(b)
    A.goto(SEEDED + "#servants"); A.wait_for_timeout(1500)
    A.click('#view-servants .toolbar [data-action="ws-new"]'); A.wait_for_timeout(400)
    A.click('[data-ws="dice"]'); A.wait_for_timeout(500)
    go(A, 1); typ(A, "#ws-name", "Camellya"); A.wait_for_timeout(300)
    go(A, 7); A.click('[data-ws="save"]'); A.wait_for_timeout(1000); quiet(A)
    cam = cams(A)[0]
    A.set_input_files('#dossier input[type="file"][data-art-file]', f"{sp}/ph_purple.png"); A.wait_for_timeout(900)
    A.evaluate(f"""() => {{ const d = JSON.parse(localStorage.getItem('{KEY}')), s = d.servants.find((x) => x.id === '{cam["id"]}'); s.bond = 7; s.notes = "made offline"; localStorage.setItem('{KEY}', JSON.stringify(d)); }}""")
    A.reload(); A.wait_for_timeout(1500); A.click(f'#list [data-id="{cam["id"]}"]'); A.wait_for_timeout(600)
    cam = cams(A)[0]; pic0 = [v for v in cam["art"].values() if v.startswith("img_")]
    check(f"Camellya has an uploaded picture ({pic0})", len(pic0) == 1)
    check("her page has Export", A.locator('#dossier .d-head-actions [data-action="sv-export"]').count() == 1)
    with A.expect_download() as dl: A.click('#dossier [data-action="sv-export"]')
    path = f"{sp}/out/Camellya.servant.json"; dl.value.save_as(path)
    check(f"the file is named after her ({dl.value.suggested_filename})", dl.value.suggested_filename == "Camellya.servant.json")
    f = json.load(open(path))
    check("it holds one servant, kind servant, with her picture", f.get("kind") == "servant" and len(f["servants"]) == 1 and f["servants"][0]["name"] == "Camellya" and list(f["images"]) == pic0 and f["images"][pic0[0]].startswith("data:image/"))
    check("and everything about her: custom, kit, bond, notes", f["servants"][0].get("custom") is True and isinstance(f["servants"][0].get("kit"), dict) and f["servants"][0]["bond"] == 7 and f["servants"][0]["notes"] == "made offline")
    ctxA.close()

    # ---------- browser B (the website, another browser…): import her ----------
    ctxB, B = page(b)
    B.goto(SEEDED + "#home"); B.wait_for_timeout(1500)
    n0 = len(B.evaluate(LS)["servants"])
    B.set_input_files("#f-import", path); B.wait_for_timeout(500)
    note = B.inner_text("#notice")
    check(f"Import shows what's coming ({note.splitlines()[0][:90]!r})", "Add Camellya from this file?" in note and "Custom servant" in note and "1 picture" in note)
    check("one button to add her (no Replace: she isn't here)", B.locator('#notice [data-action="import-go"]').count() == 1 and B.locator('#notice [data-mode="replace"]').count() == 0)
    B.click('#notice [data-action="import-go"]'); B.wait_for_timeout(1500)
    got = cams(B)
    check(f"she's added ({len(B.evaluate(LS)['servants'])} servants, was {n0})", len(got) == 1 and len(B.evaluate(LS)["servants"]) == n0 + 1)
    g = got[0]; pic1 = [v for v in g["art"].values() if v.startswith("img_")]
    check("with her levels, kit and notes", g["bond"] == 7 and g["notes"] == "made offline" and g.get("custom") is True and g["kit"] == f["servants"][0]["kit"] and g["level"] == f["servants"][0]["level"])
    stored = B.evaluate("""(id) => new Promise((res) => { const rq = indexedDB.open('spirit-origin-list-images'); rq.onsuccess = () => { try { const g = rq.result.transaction('img', 'readonly').objectStore('img').get(id); g.onsuccess = () => res(!!g.result); g.onerror = () => res(false); } catch (e) { res(false); } }; rq.onerror = () => res(false); })""", pic1[0] if pic1 else "")
    check(f"and her picture under a new ID, stored in this browser ({pic1}, stored {stored})", len(pic1) == 1 and pic1 != pic0 and stored)
    check("her page is open, with her picture and the Custom tag", B.locator("#dossier .d-head h2").inner_text() == "Camellya" and (B.locator("#dossier .art-frame img[data-art]").get_attribute("src") or "").startswith("blob:") and B.locator('#list .row-name .cu-tag').count() == 1)
    check("Undo import is offered", B.locator('#notice [data-action="import-undo"]').count() == 1)
    # again: she's here now, so a copy or Replace
    B.set_input_files("#f-import", path); B.wait_for_timeout(500)
    note = B.inner_text("#notice")
    check("importing her again offers Add as a copy and Replace", "You already have this servant" in note and B.locator('#notice [data-mode="copy"]').count() == 1 and B.locator('#notice [data-mode="replace"]').count() == 1)
    B.click('#notice [data-mode="copy"]'); B.wait_for_timeout(1500)
    two = cams(B)
    check(f"Add as a copy keeps both ({[x['id'] for x in two]})", len(two) == 2 and len({x["id"] for x in two}) == 2)
    B.click('#notice [data-action="import-undo"]'); B.wait_for_timeout(1200)
    check("Undo import takes the copy away again", len(cams(B)) == 1)
    # Replace: the file says bond 9
    f["servants"][0]["bond"] = 9; json.dump(f, open(path, "w"))
    B.set_input_files("#f-import", path); B.wait_for_timeout(500)
    B.click('#notice [data-mode="replace"]'); B.wait_for_timeout(1500)
    one = cams(B)
    check(f"Replace puts the file's version in her place ({[x['bond'] for x in one]})", len(one) == 1 and one[0]["bond"] == 9 and one[0]["id"] == g["id"])
    B.click('#notice [data-action="import-undo"]'); B.wait_for_timeout(1200)
    check("and Undo brings yours back", cams(B)[0]["bond"] == 7)
    # a whole backup still imports the way it did
    bk = {"app": "spirit-origin-list", "version": 1, "servants": [{"id": "zz-test", "name": "Backup Servant", "cls": "Saber", "rarity": 3}], "parties": [], "guests": [], "images": {}}
    bp = f"{sp}/out/backup-test.json"; json.dump(bk, open(bp, "w"))
    B.set_input_files("#f-import", bp); B.wait_for_timeout(500)
    check("a whole backup still gets the backup preview", "from this backup" in B.inner_text("#notice"))
    B.click('#notice [data-action="import-cancel"]'); B.wait_for_timeout(300)
    check(f"no script errors ({errs[:3]})", not errs)
    ctxB.close(); b.close()
print("\n%d failed" % len(fails) if fails else "\nall passed")
sys.exit(1 if fails else 0)
